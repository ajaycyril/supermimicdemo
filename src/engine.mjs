import {features,integrate,errors,DT,seededRandom,actionAt} from './math.mjs';
export class LabEngine {
  async load(status=()=>{}) {
    status('Loading MuJoCo 3.16 physics…');
    const [{default:loadMj},ort,robot,xml]=await Promise.all([
      import('../vendor/mujoco/mujoco.js'),import('../vendor/ort/ort.wasm.min.mjs'),
      fetch('assets/robot.json').then(r=>r.json()),fetch('assets/g1.xml').then(r=>r.text())]);
    this.mj=await loadMj();this.model=this.mj.MjModel.from_xml_string(xml);this.data=new this.mj.MjData(this.model);this.visual=new this.mj.MjData(this.model);
    this.robot=robot;this.ort=ort;
    if(this.model.nq!==36||this.model.nv!==35||this.model.nu!==29)throw Error('Robot layout mismatch');
    status('Loading the released world-model weights…');
    ort.env.wasm.numThreads=1;ort.env.wasm.wasmPaths=new URL('../vendor/ort/',import.meta.url).href;
    const res=await fetch('assets/world-model.onnx');
    if(!res.ok)throw Error('World-model export is missing. Run the Prepare and deploy workflow in GitHub Actions.');
    this.session=await ort.InferenceSession.create(await res.arrayBuffer(),{executionProviders:['wasm'],graphOptimizationLevel:'all'});
    this.manifest=await fetch('assets/model-manifest.json').then(r=>r.ok?r.json():({}));
    this.parents=Array.from(this.model.body_parentid);
    status('Checking the exported model…');
    const checks=await fetch('assets/parity-fixtures.json');
    this.parity={verified:false};
    if(checks.ok){
      const f=await checks.json();
      // Exporter fixtures are also checked in CI. Validate raw MLP outputs at runtime.
      if(f.cases?.length){let max=0;for(const c of f.cases){if(c.features?.length!==133||c.delta?.length!==70)throw Error('Invalid parity fixture');const out=await this.raw(Float32Array.from(c.features));max=Math.max(max,...out.map((v,i)=>Math.abs(v-c.delta[i])));}if(max>0.0001)throw Error(`Model export parity failed (${max})`);this.parity={verified:true,maxAbsError:max};}
    }
    status('Ready · real MuJoCo + learned dynamics');
  }
  async raw(input){const t=new this.ort.Tensor('float32',input,[1,133]);const result=await this.session.run({[this.session.inputNames[0]]:t});const output=result[this.session.outputNames[0]];const d=Array.from(output.data);t.dispose();for(const v of Object.values(result))v.dispose();return d;}
  async predict(s,a,friction){return integrate(s,await this.raw(features(s,a,friction)));}
  read(){return Float64Array.from([...this.data.qpos,...this.data.qvel]);}
  write(d,s){d.qpos.set(s.slice(0,36));d.qvel.set(s.slice(36));this.mj.mj_forward(this.model,d);}
  bodies(s){this.write(this.visual,s);return Float32Array.from(this.visual.xpos);}
  geometry(s){this.write(this.visual,s);const out=[];for(let i=0;i<this.model.ngeom;i++){const type=this.model.geom_type[i];if(type!==2&&type!==3)continue;const p=Array.from(this.visual.geom_xpos.slice(i*3,i*3+3));const h=type===3?this.model.geom_size[i*3+1]:0;const axis=[2,5,8].map(k=>this.visual.geom_xmat[i*9+k]*h);out.push({a:p.map((v,k)=>v-axis[k]),b:p.map((v,k)=>v+axis[k]),r:this.model.geom_size[i*3]});}return out;}
  reset(settings){
    this.mj.mj_resetData(this.model,this.data);
    for(let i=0;i<this.model.ngeom;i++)if(this.model.geom_priority[i]===1)this.model.geom_friction[i*3]=settings.friction;
    const s=new Float64Array(71);s[2]=.76;s[3]=1;s[36]=settings.push;
    this.robot.joints.forEach((j,i)=>{s[7+i]=j.home;this.data.ctrl[i]=j.home;});this.write(this.data,s);return s;
  }
  step(a){this.robot.joints.forEach((j,i)=>{this.data.ctrl[i]=j.home+j.scale*a[i];});for(let i=0;i<4;i++)this.mj.mj_step(this.model,this.data);return this.read();}
  async run(settings,onProgress=()=>{},shouldStop=()=>false){
    let wm=this.reset(settings);const rng=seededRandom(settings.seed);const initial=Array.from(wm);
    const frames=[{t:0,sim:Array.from(wm),wm:Array.from(wm),simBodies:this.bodies(wm),wmBodies:this.bodies(wm),simGeometry:this.geometry(wm),wmGeometry:this.geometry(wm),error:errors(wm,wm),corrected:false}];
    const times={sim:[],wm:[]};let stopReason=null;
    for(let k=0;k<Math.round(settings.duration/DT);k++){
      if(shouldStop()){stopReason='Stopped by user';break;}
      const corrected=settings.correction>0&&k%settings.correction===0;
      if(corrected)wm=this.read();
      const a=actionAt(k,this.robot.joints,settings.amplitude,settings.noise,rng);
      let start=performance.now();wm=await this.predict(wm,a,settings.friction);let wmMs=performance.now()-start;
      start=performance.now();const sim=this.step(a);let simMs=performance.now()-start;
      if(k>=5){times.sim.push(simMs);times.wm.push(wmMs);}
      if(![...sim,...wm].every(Number.isFinite)){stopReason='Non-finite state: experiment stopped';break;}
      const f={t:(k+1)*DT,sim:Array.from(sim),wm:Array.from(wm),simBodies:this.bodies(sim),wmBodies:this.bodies(wm),simGeometry:this.geometry(sim),wmGeometry:this.geometry(wm),error:errors(sim,wm),corrected,action:Array.from(a)};
      frames.push(f);onProgress(frames,k);
      // Do not silently clip diverged predictions or pretend a fallen robot is stable.
      if(Math.max(...sim.slice(0,3).map(Math.abs),...wm.slice(0,3).map(Math.abs))>10){stopReason='Position exceeded the 10 m display boundary';break;}
      if(k%3===0)await new Promise(r=>setTimeout(r,0));
    }
    const mean=v=>v.length?v.reduce((a,b)=>a+b,0)/v.length:null;
    return {schema:1,created:new Date().toISOString(),settings,initial,frames,timing:{mujocoMs:mean(times.sim),worldModelMs:mean(times.wm),samples:times.sim.length},stopReason,provenance:{mujoco:'3.16.0 WASM single-thread',ort:'1.31.1 WASM single-thread',checkpoint:'CuboiLeo/SuperMimic-Reproduced e8-boneseed-100k',manifest:this.manifest,parity:this.parity,driver:'scripted shoulder sine + seeded Gaussian command noise; no trained policy',platform:navigator.userAgent}};
  }
}
