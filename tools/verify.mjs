import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import * as ort from '../node_modules/onnxruntime-web/dist/ort.wasm.min.mjs';
import load from '../node_modules/@mujoco/mujoco/mujoco.js';
import {features,integrate,errors,actionAt,seededRandom} from '../src/math.mjs';
const bytes=await readFile('dist/assets/world-model.onnx');
const manifest=JSON.parse(await readFile('dist/assets/model-manifest.json','utf8'));
assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.onnx_sha256);
ort.env.wasm.numThreads=1;
const net=await ort.InferenceSession.create(bytes,{executionProviders:['wasm']});
const infer=async input=>{const tensor=new ort.Tensor('float32',input,[1,133]);const r=await net.run({features:tensor});const d=Array.from(r.delta.data);tensor.dispose();r.delta.dispose();return d;};
const fixture=JSON.parse(await readFile('dist/assets/parity-fixtures.json','utf8'));let maxError=0;
for(const c of fixture.cases){const d=await infer(Float32Array.from(c.features));maxError=Math.max(maxError,...d.map((v,i)=>Math.abs(v-c.delta[i])));}
assert.ok(maxError<fixture.absolute_tolerance,`MLP export mismatch: ${maxError}`);
const mj=await load(),model=mj.MjModel.from_xml_string(await readFile('dist/assets/g1.xml','utf8')),data=new mj.MjData(model);
assert.deepEqual([model.nq,model.nv,model.nu],[36,35,29]);
const robot=JSON.parse(await readFile('dist/assets/robot.json','utf8'));
const report={mujoco:mj.mj_versionString(),modelSha256:manifest.onnx_sha256,reference:fixture.reference,parityMaxAbsError:maxError,experiments:[]};
for(const [name,correction,friction,noise,push] of [['one-step',1,1,0,0],['drift',0,1,0,0],['correction',25,1,0,0],['friction',0,.3,0,0],['noise',0,1,.1,0],['push',0,1,0,.3]]){
 mj.mj_resetData(model,data);for(let i=0;i<model.ngeom;i++)if(model.geom_priority[i]===1)model.geom_friction[i*3]=friction;
 data.qpos[2]=.76;data.qpos[3]=1;data.qvel[0]=push;robot.joints.forEach((j,i)=>{data.qpos[7+i]=j.home;data.ctrl[i]=j.home;});mj.mj_forward(model,data);
 const read=()=>Float64Array.from([...data.qpos,...data.qvel]);let wm=read(),last,maxRoot=0;const rng=seededRandom(42);
 for(let k=0;k<200;k++){
  if(correction&&k%correction===0)wm=read();const a=actionAt(k,robot.joints,.2,noise,rng);
  wm=integrate(wm,await infer(features(wm,a,friction)));
  robot.joints.forEach((j,i)=>data.ctrl[i]=j.home+j.scale*a[i]);for(let n=0;n<4;n++)mj.mj_step(model,data);
  const sim=read();assert.ok([...sim,...wm].every(Number.isFinite),name+' non-finite state');last=errors(sim,wm);maxRoot=Math.max(maxRoot,last.root);
 }
 report.experiments.push({name,seed:42,duration:4,correction,friction,noise,push,finalRootGapM:last.root,maxRootGapM:maxRoot,finalJointRmseDeg:last.joint});
}
await writeFile('docs/validation-results.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));data.delete();model.delete();await net.release();
