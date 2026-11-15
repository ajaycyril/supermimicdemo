import {readFile,writeFile} from 'node:fs/promises';
import {actionAt,seededRandom,errors,DT} from '../src/math.mjs';
const nativeFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>typeof url==='string'&&url.startsWith('assets/')?new Response(await readFile('dist/'+url)):nativeFetch(url,options);
const {LabEngine}=await import('../dist/src/engine.mjs');
const engine=new LabEngine();await engine.load();
const horizons=[1,5,10,25,50],seeds=[1,2,3,4,5,6,7,8],windows=[];
for(const seed of seeds){
 const cfg={seed,duration:4,amplitude:.2,noise:.05,frequency:.5,friction:1,push:0,correction:0};
 const states=[engine.reset(cfg)],rng=seededRandom(seed),actions=[];
 for(let k=0;k<200;k++){const a=actionAt(k,engine.robot.joints,cfg.amplitude,cfg.noise,rng,cfg.frequency);actions.push(a);states.push(engine.step(a));}
 for(let anchor=0;anchor<=150;anchor+=10){
  let wm=Float64Array.from(states[anchor]);const samples=[];
  for(let h=1;h<=50;h++){wm=await engine.predict(wm,actions[anchor+h-1],1);if(horizons.includes(h)){const e=errors(states[anchor+h],wm);samples.push({steps:h,seconds:h*DT,rootCm:e.root*100,jointDeg:e.joint,orientationDeg:e.orientation});}}
  windows.push({seed,anchorStep:anchor,anchorSeconds:anchor*DT,rootHeightM:states[anchor][2],highRoot:states[anchor][2]>.6,samples});
 }
}
const quantile=(a,q)=>{const s=[...a].sort((a,b)=>a-b),p=(s.length-1)*q,l=Math.floor(p);return s[l]+(s[Math.ceil(p)]-s[l])*(p-l);};
const summarize=group=>horizons.map(h=>{const values=group.map(w=>w.samples.find(s=>s.steps===h));const v=values.map(s=>s.rootCm);return{steps:h,seconds:h*DT,count:v.length,medianRootCm:quantile(v,.5),p10RootCm:quantile(v,.1),p90RootCm:quantile(v,.9),maxRootCm:Math.max(...v),meanRootCm:v.reduce((a,b)=>a+b,0)/v.length,medianJointDeg:quantile(values.map(s=>s.jointDeg),.5)};});
const report={schema:1,checkpoint:engine.manifest.checkpoint_sha256,onnxSha256:engine.manifest.onnx_sha256,method:'Each window starts from a MuJoCo state. The world model independently predicts the next 1–50 transitions using the identical saved commands. Errors are measured against MuJoCo at each horizon; no state refresh occurs inside a window.',settings:{seeds,referenceSeconds:4,anchorIntervalSeconds:.2,anchorRangeSeconds:[0,3],amplitude:.2,frequency:.5,noise:.05,friction:1},limits:['Scripted shoulder movement, not a trained policy.','128 overlapping windows from 8 seeded trajectories, not 128 independent trials.','Reference trajectories include falling and ground-contact states. High-root subset means anchor root height >0.6 m; it does not guarantee stable standing.','Native MuJoCo WASM differs from the training Warp backend.','No training, throughput, SONIC-policy or physical-robot benchmark.'],summary:{all:summarize(windows),highRoot:summarize(windows.filter(w=>w.highRoot)),lowRoot:summarize(windows.filter(w=>!w.highRoot))},windows};
await writeFile('article/horizon-study.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.summary,null,2));
engine.data.delete();engine.visual.delete();engine.model.delete();await engine.session.release();globalThis.fetch=nativeFetch;
