import {LabEngine} from './engine.mjs';
import {draw,chart} from './draw.mjs';
const $=s=>document.querySelector(s);
const lessons=[
 {id:'one-step',title:'One-step prediction',short:'One step',question:'Can a learned model predict the next 20 milliseconds?',text:'MuJoCo calculates the next state from physics. The world model predicts it from examples it learned earlier. Refreshing the model from MuJoCo before every step isolates short-horizon prediction error.',observe:'Look for the root gap at each step. Small one-step errors do not guarantee a reliable long rollout.',correction:1,amplitude:.2,friction:1,noise:0,push:0},
 {id:'drift',title:'Free prediction',short:'Accumulated drift',question:'What happens when a prediction becomes the next input?',text:'The world model now feeds its own predicted state back into itself. MuJoCo keeps running independently. This sequence is called a rollout. Any mismatch can compound.',observe:'Compare this curve with One step. A widening gap measures disagreement, not which engine is physically correct.',correction:0,amplitude:.2,friction:1,noise:0,push:0},
 {id:'correction',title:'Periodic correction',short:'Periodic correction',question:'Can occasional fresh state stop errors accumulating?',text:'Every half second, replace the model’s imagined state with MuJoCo’s current state. The model weights stay fixed. This is a teaching experiment about prediction horizon, not a recreation of SuperMimic training.',observe:'Look for changes after each refresh. The error shown is measured after prediction, before the next correction.',correction:25,amplitude:.2,friction:1,noise:0,push:0},
 {id:'friction',title:'Low-friction floor',short:'Friction',question:'Does the model respond when the floor gets more slippery?',text:'Set the same foot friction in MuJoCo and in the model’s context input. The model is told this value. It does not infer the material by looking at the floor.',observe:'Run once at 1.0 and again at 0.3 with the same seed and commands. A different outcome is not, by itself, evidence of worse prediction.',correction:0,amplitude:.2,friction:.3,noise:0,push:0},
 {id:'noise',title:'Noisy motor commands',short:'Command noise',question:'What if the motors receive slightly different commands?',text:'A seeded random perturbation is added to each joint command. Both engines receive exactly the same noisy command sequence. Repeating the seed repeats the experiment.',observe:'Compare with Accumulated drift. This changes the inputs; it does not retrain the model or test policy recovery.',correction:0,amplitude:.2,friction:1,noise:.1,push:0},
 {id:'push',title:'Initial momentum',short:'Initial velocity',question:'How does prediction change when the robot starts moving?',text:'Give both copies the same initial forward velocity of 0.3 m/s. This is an initial-state change, not a continuous external force. The simple motor script does not learn to balance.',observe:'Watch where the trajectories diverge. A fall can be an expected result of using a simple script instead of a trained controller.',correction:0,amplitude:.2,friction:1,noise:0,push:.3}
];
let lesson=lessons[1],engine=null,result=null,index=0,playing=false,raf=0,busy=false,running=false,cancel=false,loaded=false;
const canvas=$('#scene'),plot=$('#plot');
function status(s,error=false){$('#status').textContent=s;$('#status').classList.toggle('error',error);}
function settings(){return{lesson:lesson.id,title:lesson.title,seed:Number($('#seed').value),duration:Number($('#duration').value),correction:Number($('#correction').value),amplitude:Number($('#amplitude').value),friction:Number($('#friction').value),noise:Number($('#noise').value),push:Number($('#push').value)};}
function selectLesson(l){if(busy)return;stopReplay();lesson=l;result=null;index=0;$('#lesson-title').textContent=l.title;$('#question').textContent=l.question;$('#explanation').textContent=l.text;$('#observe').textContent=l.observe;for(const key of ['correction','amplitude','friction','noise','push'])$('#'+key).value=l[key];$('.lesson.active')?.classList.remove('active');$(`[data-lesson="${l.id}"]`).classList.add('active');updateLabels();render();buttons();}
lessons.forEach(l=>{const b=document.createElement('button');b.className='lesson';b.dataset.lesson=l.id;b.textContent=l.short;b.onclick=()=>selectLesson(l);$('#lessons').append(b);});
function updateLabels(){document.querySelectorAll('input[type=range]').forEach(e=>{const o=document.querySelector(`[for="${e.id}"]`);if(o)o.textContent=e.value;});}
function buttons(){for(const id of ['run','step'])$('#'+id).disabled=!loaded||busy;$('#load').disabled=busy||loaded;$('#stop').hidden=!running;for(const id of ['replay','gif','json','csv'])$('#'+id).disabled=!result||busy;document.querySelectorAll('.settings input,.settings select,.lesson').forEach(e=>e.disabled=busy);}
function render(){draw(canvas,result?.frames[index],engine?.parents||[],{title:result?.settings.title||lesson.title});if(result){chart(plot,result.frames,index);const f=result.frames[index];$('#root-error').textContent=(f.error.root*100).toFixed(1);$('#joint-error').textContent=f.error.joint.toFixed(1);$('#time').textContent=f.t.toFixed(2);$('#scrub').max=result.frames.length-1;$('#scrub').value=index;}else{$('#root-error').textContent='—';$('#joint-error').textContent='—';$('#time').textContent='0.00';chart(plot,[]);}}
function stopReplay(){playing=false;cancelAnimationFrame(raf);$('#replay').textContent='Replay';}
function replay(){if(playing){stopReplay();return;}playing=true;$('#replay').textContent='Pause';const start=performance.now();index=0;const tick=now=>{index=Math.max(0,Math.min(result.frames.length-1,Math.floor((now-start)/40)));render();if(index===result.frames.length-1)stopReplay();else raf=requestAnimationFrame(tick);};raf=requestAnimationFrame(tick);}
$('#load').onclick=async()=>{busy=true;buttons();try{engine=new LabEngine();await engine.load(status);loaded=true;$('#runtime').textContent='MuJoCo 3.16 · ONNX Runtime 1.31.1 · CPU / WASM';}catch(e){console.error(e);status(e.message,true);}finally{busy=false;buttons();}};
async function run(one=false){stopReplay();busy=true;running=true;cancel=false;buttons();status('Running identical commands through both engines…');try{const cfg=settings();if(one)cfg.duration=.02;result=await engine.run(cfg,(frames)=>{result={frames,settings:cfg};index=frames.length-1;render();$('#progress').value=frames.at(-1).t/cfg.duration;},()=>cancel);index=result.frames.length-1;render();$('#timing').textContent=`Per 20 ms control step: MuJoCo ${result.timing.mujocoMs?.toFixed(2)??'—'} ms · World model ${result.timing.worldModelMs?.toFixed(2)??'—'} ms. One environment; rendering excluded. This is not the paper’s GPU benchmark.`;status(result.stopReason||'Experiment complete. Replay, change one setting, or export your evidence.');if(!one)replay();}catch(e){console.error(e);result=null;status(e.message,true);}finally{busy=false;running=false;buttons();}}
$('#run').onclick=()=>run();$('#step').onclick=()=>run(true);$('#stop').onclick=()=>{cancel=true;};$('#replay').onclick=replay;
$('#scrub').oninput=e=>{stopReplay();index=Number(e.target.value);render();};document.querySelectorAll('input[type=range]').forEach(e=>e.addEventListener('input',updateLabels));
function download(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);}
const stem=()=>`supermimic-${result.settings.lesson}-seed${result.settings.seed}`;
$('#json').onclick=()=>download(new Blob([JSON.stringify(result,(_,v)=>ArrayBuffer.isView(v)?Array.from(v):v,2)],{type:'application/json'}),stem()+'.json');
$('#csv').onclick=()=>download(new Blob(['time_s,root_gap_m,joint_rmse_deg,orientation_gap_deg,state_refreshed\n'+result.frames.map(f=>[f.t,f.error.root,f.error.joint,f.error.orientation,f.corrected].join(',')).join('\n')],{type:'text/csv'}),stem()+'.csv');
async function exportGif(saveLocal=false){
 stopReplay();busy=true;buttons();status('Encoding your experiment GIF…');
 try{
  const {GIFEncoder,quantize,applyPalette}=await import('../vendor/gifenc.esm.js');const gif=GIFEncoder();
  const scene=document.createElement('canvas');scene.width=800;scene.height=460;
  const graph=document.createElement('canvas');graph.width=800;graph.height=120;
  const out=document.createElement('canvas');out.width=800;out.height=610;const ctx=out.getContext('2d',{willReadFrequently:true});
  for(let i=0;i<result.frames.length;i+=5){
   draw(scene,result.frames[i],engine.parents,{title:result.settings.title});chart(graph,result.frames,i);
   ctx.fillStyle='#f8f7f3';ctx.fillRect(0,0,800,610);ctx.drawImage(scene,0,0);ctx.drawImage(graph,0,460);
   ctx.font='11px system-ui';ctx.fillStyle='#647a7c';const s=result.settings;
   ctx.fillText(`seed ${s.seed} · friction ${s.friction} · command ${s.amplitude} · noise ${s.noise} · initial vx ${s.push} m/s · replay 0.5×`,24,599);
   const pixels=ctx.getImageData(0,0,out.width,out.height).data;const palette=quantize(pixels,128);
   gif.writeFrame(applyPalette(pixels,palette),out.width,out.height,{palette,delay:200,repeat:0});
   if(i%20===0)await new Promise(r=>setTimeout(r,0));
  }
  gif.finish();
  if(saveLocal){
   const bytes=gif.bytes();let binary='';for(let j=0;j<bytes.length;j+=8192)binary+=String.fromCharCode(...bytes.subarray(j,j+8192));
   for(const payload of [{name:result.settings.lesson,kind:'gif',base64:btoa(binary)},{name:result.settings.lesson,kind:'json',data:JSON.parse(JSON.stringify(result,(_,v)=>ArrayBuffer.isView(v)?Array.from(v):v))}]){
    const r=await fetch('/__capture',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});if(!r.ok)throw Error('Local capture save failed');
   }
  }else download(new Blob([gif.bytes()],{type:'image/gif'}),stem()+'.gif');
  status('GIF saved. Export JSON too, to preserve its exact settings and measurements.');
 }catch(e){status(e.message,true);}finally{busy=false;buttons();render();}
};
$('#gif').onclick=()=>exportGif(false);
if(location.hostname==='127.0.0.1'){
 const b=document.createElement('button');b.textContent='Save article capture';b.id='local-capture';b.onclick=()=>result&&!busy&&exportGif(true);$('.export>div:last-child').append(b);
 const a=document.createElement('button');a.textContent='Save architecture GIF';a.onclick=async()=>{a.disabled=true;status('Encoding architecture illustration…');try{await(await import('./architecture.mjs')).saveArchitecture();status('Architecture GIF saved.');}catch(e){status(e.message,true);}finally{a.disabled=false;}};$('.export>div:last-child').append(a);
}
selectLesson(lesson);
