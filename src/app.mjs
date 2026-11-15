import {LabEngine} from './engine.mjs';
import {draw,chart} from './draw.mjs';
const $=s=>document.querySelector(s);
const presets=[
 {id:'one-step',title:'One-step prediction',short:'One step',question:'One-step prediction',text:'MuJoCo calculates the next state from physics. The world model predicts it from examples it learned earlier. Refreshing the model from MuJoCo before every step measures one-step disagreement with native MuJoCo WASM.',observe:'Look for the root gap at each step. Compare this gap with the Free rollout view, where each prediction becomes the next input.',correction:1,amplitude:.2,friction:1,noise:0,push:0},
 {id:'drift',title:'Free prediction',short:'Free rollout',question:'Free rollout',text:'The world model now feeds its own predicted state back into itself. MuJoCo keeps running independently. This sequence is called a rollout. Any mismatch can compound.',observe:'Compare this curve with One step. A widening gap shows the predictions separating. A hardware trajectory would let you test which is closer.',correction:0,amplitude:.2,friction:1,noise:0,push:0},
 {id:'correction',title:'Periodic correction',short:'Periodic correction',question:'Periodic state refresh',text:'Every half second, replace the model’s imagined state with MuJoCo’s current state. The model weights stay fixed. This limits how long the model runs on its own predictions.',observe:'Look for changes after each refresh. The error shown is measured after prediction, before the next correction.',correction:25,amplitude:.2,friction:1,noise:0,push:0},
 {id:'friction',title:'Low-friction floor',short:'Friction',question:'Low-friction floor',text:'Set the same foot friction in MuJoCo and in the model’s context input. The model is told this value. It does not infer the material by looking at the floor.',observe:'Run once at 1.0 and again at 0.3 with the same seed and commands. A different outcome is not, by itself, evidence of worse prediction.',correction:0,amplitude:.2,friction:.3,noise:0,push:0},
 {id:'noise',title:'Noisy motor commands',short:'Motion noise',question:'Noisy movement',text:'A seeded random perturbation is added to each joint command. Both engines receive exactly the same noisy command sequence. Repeating the seed repeats the experiment.',observe:'Compare with Accumulated drift. This changes the inputs; it does not retrain the model or test policy recovery.',correction:0,amplitude:.2,friction:1,noise:.1,push:0},
 {id:'push',title:'Initial momentum',short:'Initial velocity',question:'Initial momentum',text:'Give both copies the same initial forward velocity of 0.3 m/s. This is an initial-state change, not a continuous external force. The simple motor script does not learn to balance.',observe:'Watch where the trajectories diverge. A fall can be an expected result of using a simple script instead of a trained controller.',correction:0,amplitude:.2,friction:1,noise:0,push:.3}
];
let preset=presets[1],engine=null,result=null,index=0,playing=false,raf=0,busy=false,running=false,paused=false,cancel=false,loaded=false,steps=0,operation=null,preview=null;
const canvas=$('#scene'),plot=$('#plot');
const speed=()=>Number($('#speed').value);
const controls=()=>Object.fromEntries(['amplitude','friction','noise','correction','frequency'].map(k=>[k,Number($('#'+k).value)]));
function status(s,error=false){$('#status').textContent=s;$('#status').classList.toggle('error',error);}
function settings(){return{preset:preset.id,title:preset.title,seed:Number($('#seed').value),duration:Number($('#duration').value),push:Number($('#push').value),...controls()};}
function stopReplay(){playing=false;cancelAnimationFrame(raf);}
function updateLabels(){document.querySelectorAll('input[type=range]').forEach(e=>{const o=document.querySelector(`output[for="${e.id}"]`);if(o)o.textContent=e.value;});}
function initialPreview(){if(!loaded)return;const s=engine.reset(settings());preview={t:0,simBodies:engine.bodies(s),wmBodies:engine.bodies(s),simGeometry:engine.geometry(s),wmGeometry:engine.geometry(s),error:{root:0,joint:0}};}
function selectPreset(l){if(running||busy)return;stopReplay();preset=l;result=null;index=0;$('#preset-title').textContent=l.title;$('#question').textContent=l.question;$('#explanation').textContent=l.text;$('#observe').textContent=l.observe;for(const key of ['correction','amplitude','friction','noise','push'])$('#'+key).value=l[key];$('#frequency').value=.5;$('.preset.active')?.classList.remove('active');$(`[data-preset="${l.id}"]`).classList.add('active');$('#interpretation').textContent='';$('#progress').value=0;updateLabels();initialPreview();render();buttons();status('Adjust the controls, then start. You can change the motion and floor while it runs.');}
presets.forEach(l=>{const b=document.createElement('button');b.className='preset';b.dataset.preset=l.id;b.textContent=l.short;b.onclick=()=>selectPreset(l);$('#presets').append(b);});
function buttons(){
 $('#run').disabled=busy||running;$('#run').textContent=result?'Run again':'Start comparison';
 $('#pause').disabled=busy||(!running&&!result);$('#pause').textContent=running?(paused?'Resume':'Pause'):(playing?'Pause':'Play');
 $('#stop').disabled=!running;$('#reset').disabled=busy;$('#step').disabled=busy||(!result&&!running)||(running&&!paused);
 $('#scrub').disabled=running||!result;$('#back').disabled=running||!result;$('#next').disabled=running||!result;
 for(const id of ['gif','json','csv'])$('#'+id).disabled=!result||running||busy;
 document.querySelectorAll('.settings input,.settings select,.preset').forEach(e=>e.disabled=busy);
 document.querySelectorAll('.preset,#duration,#seed,#push').forEach(e=>e.disabled=busy||running);
 $('#activity').textContent=busy?'Preparing':running?(paused?'Paused':'Live'):playing?'Replay':result?'Recorded':'Ready';
}
function render(){
 const f=result?.frames[index]||preview;
 draw(canvas,f,engine?.parents||[],{title:result?.settings.title||preset.title});
 chart(plot,result?.frames||[],index);
 $('#root-error').textContent=f?(f.error.root*100).toFixed(1):'—';$('#joint-error').textContent=f?f.error.joint.toFixed(1):'—';
 $('#time').textContent=(f?.t||0).toFixed(2);$('#total-time').textContent=(running?Number($('#duration').value):(result?.frames.at(-1)?.t||Number($('#duration').value))).toFixed(2);
 $('#scrub').max=Math.max(0,(result?.frames.length||1)-1);$('#scrub').value=index;
 if(result?.frames.length){const peak=result.frames.reduce((a,b)=>b.error.root>a.error.root?b:a);$('#peak-error').textContent=(peak.error.root*100).toFixed(1);}
 else $('#peak-error').textContent='—';
}
function replay(){
 if(!result)return;stopReplay();playing=true;if(index>=result.frames.length-1)index=0;let position=index,previous=performance.now();
 const tick=now=>{position+=Math.max(0,now-previous)*speed()/20;previous=now;if(position>=result.frames.length-1){if($('#loop').checked)position=0;else{index=result.frames.length-1;stopReplay();render();buttons();return;}}index=Math.floor(position);render();raf=requestAnimationFrame(tick);};
 raf=requestAnimationFrame(tick);buttons();
}
function describe(){
 if(!result?.frames.length)return;const peak=result.frames.reduce((a,b)=>b.error.root>a.error.root?b:a),last=result.frames.at(-1);
 const edits=result.controlChanges?.length>1?` You changed the conditions ${result.controlChanges.length-1} time${result.controlChanges.length>2?'s':''} during this run.`:'';
 $('#interpretation').textContent=`The largest position difference was ${(peak.error.root*100).toFixed(1)} cm at ${peak.t.toFixed(2)} s. At ${last.t.toFixed(2)} s, the gap was ${(last.error.root*100).toFixed(1)} cm.${edits}`;
}
async function run(){
 stopReplay();busy=true;buttons();
 try{
  if(!loaded){engine=new LabEngine();await engine.load(status);loaded=true;}
  busy=false;running=true;paused=false;cancel=false;steps=0;index=0;result=null;$('#interpretation').textContent='';buttons();
  const cfg=settings();let deadline=performance.now();
  const beforeStep=async()=>{while(paused&&!steps&&!cancel){await new Promise(r=>setTimeout(r,25));deadline=performance.now();}if(steps){steps--;deadline=performance.now();return;}const delay=Math.max(0,deadline-performance.now());if(delay)await new Promise(r=>setTimeout(r,Math.min(delay,200)));deadline=performance.now()+20/speed();};
  status('Running. Motion, friction and prediction settings apply to both robots as you change them.');
  result=await engine.run(cfg,frames=>{result={frames,settings:cfg};index=frames.length-1;render();$('#progress').value=frames.at(-1).t/cfg.duration;},()=>cancel,{beforeStep,controls});
  index=result.frames.length-1;running=false;paused=false;render();describe();
  status(result.stopReason==='Stopped by user'?'Run stopped. Scrub through it or start again.':result.stopReason||'Run complete. Scrub through the result or play it again.');
  if(!cancel&&$('#loop').checked){index=0;replay();}
 }catch(e){console.error(e);status('The comparison could not continue. Reset and try again.',true);}finally{busy=false;running=false;paused=false;buttons();}
}
$('#run').onclick=()=>{operation=run();};
$('#pause').onclick=()=>{if(running){paused=!paused;status(paused?'Paused. Change a setting or advance one step.':'Running. Changes apply to both robots.');buttons();}else if(playing){stopReplay();buttons();}else replay();};
$('#stop').onclick=()=>{cancel=true;paused=false;};
$('#reset').onclick=async()=>{cancel=true;paused=false;stopReplay();if(operation)await operation;result=null;index=0;$('#interpretation').textContent='';$('#progress').value=0;initialPreview();render();buttons();status('Reset. Adjust the starting conditions or run again.');};
$('#step').onclick=()=>{if(running&&paused){steps++;return;}stopReplay();if(result)index=Math.min(index+1,result.frames.length-1);render();buttons();};
$('#back').onclick=()=>{stopReplay();index=Math.max(0,index-1);render();buttons();};
$('#next').onclick=()=>{stopReplay();if(result)index=Math.min(result.frames.length-1,index+1);render();buttons();};
$('#scrub').oninput=e=>{stopReplay();index=Number(e.target.value);render();buttons();};
for(const input of document.querySelectorAll('.settings input,.settings select'))input.addEventListener('input',()=>{updateLabels();if(running){status('Settings updated for the next step. Both robots receive the same inputs.');}else if(result){status('Settings changed. Run again to compare the new conditions.');}else{initialPreview();render();}});
function download(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);}
const stem=()=>`supermimic-${result.settings.preset}-seed${result.settings.seed}`;
$('#json').onclick=()=>download(new Blob([JSON.stringify(result,(_,v)=>ArrayBuffer.isView(v)?Array.from(v):v,2)],{type:'application/json'}),stem()+'.json');
$('#csv').onclick=()=>download(new Blob(['time_s,root_gap_m,joint_rmse_deg,orientation_gap_deg,state_refreshed,friction,amplitude,frequency_hz,noise\n'+result.frames.map(f=>[f.t,f.error.root,f.error.joint,f.error.orientation,f.corrected,f.controls?.friction??result.settings.friction,f.controls?.amplitude??result.settings.amplitude,f.controls?.frequency??.5,f.controls?.noise??result.settings.noise].join(',')).join('\n')],{type:'text/csv'}),stem()+'.csv');
$('#gif').onclick=async()=>{
 stopReplay();busy=true;buttons();status('Creating animation…');
 try{
  const {GIFEncoder,quantize,applyPalette}=await import('../vendor/gifenc.esm.js');const gif=GIFEncoder();
  const scene=document.createElement('canvas');scene.width=800;scene.height=460;
  const graph=document.createElement('canvas');graph.width=800;graph.height=120;
  const out=document.createElement('canvas');out.width=800;out.height=610;const ctx=out.getContext('2d',{willReadFrequently:true});
  const stride=Math.max(2,Math.ceil(result.frames.length/160)),rate=speed();
  const indices=[];for(let i=0;i<result.frames.length;i+=stride)indices.push(i);if(indices.at(-1)!==result.frames.length-1)indices.push(result.frames.length-1);
  for(let n=0;n<indices.length;n++){
   const i=indices[n],frame=result.frames[i];draw(scene,frame,engine.parents,{title:result.settings.title});chart(graph,result.frames,i);
   ctx.fillStyle='#f8f7f3';ctx.fillRect(0,0,800,610);ctx.drawImage(scene,0,0);ctx.drawImage(graph,0,460);
   ctx.font='11px system-ui';ctx.fillStyle='#647a7c';const s={...result.settings,...frame.controls};
   ctx.fillText(`friction ${s.friction} · arm ${s.amplitude} · frequency ${s.frequency??.5} Hz · noise ${s.noise} · seed ${s.seed} · ${rate}× playback`,24,599);
   const pixels=ctx.getImageData(0,0,out.width,out.height).data,palette=quantize(pixels,128);
   const next=indices[n+1]??(i+stride);gif.writeFrame(applyPalette(pixels,palette),out.width,out.height,{palette,delay:Math.max(20,(next-i)*20/rate),repeat:0});
   if(n%5===0)await new Promise(r=>setTimeout(r,0));
  }
  gif.finish();download(new Blob([gif.bytes()],{type:'image/gif'}),stem()+'.gif');status('Animation saved.');
 }catch(e){console.error(e);status('The animation could not be saved. Try a shorter run.',true);}finally{busy=false;buttons();render();}
};
selectPreset(preset);
