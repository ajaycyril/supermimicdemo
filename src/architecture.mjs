// Original conceptual diagram based on the linked research, not a benchmark trace.
export function drawArchitecture(canvas,t){
 const c=canvas.getContext('2d');c.fillStyle='#f8f7f3';c.fillRect(0,0,800,600);
 const ink='#142d32',muted='#647a7c',teal='#116d79',orange='#da6836';
 const text=(s,x,y,size=15,color=ink)=>{c.fillStyle=color;c.font=`${size>=20?'600':'400'} ${size}px system-ui`;c.textAlign='left';c.fillText(s,x,y);};
 const box=(x,y,w,h,title,sub,color)=>{c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,10);c.fill();text(title,x+16,y+27,16,'white');if(sub)text(sub,x+16,y+49,11,'#ffffffc7');};
 const arrow=(points,color,progress)=>{c.strokeStyle=color;c.lineWidth=2;c.beginPath();c.moveTo(...points[0]);points.slice(1).forEach(p=>c.lineTo(...p));c.stroke();const b=points.at(-1),a=points.at(-2),ang=Math.atan2(b[1]-a[1],b[0]-a[0]);c.beginPath();c.moveTo(...b);c.lineTo(b[0]-10*Math.cos(ang-.45),b[1]-10*Math.sin(ang-.45));c.moveTo(...b);c.lineTo(b[0]-10*Math.cos(ang+.45),b[1]-10*Math.sin(ang+.45));c.stroke();let lengths=points.slice(1).map((p,i)=>Math.hypot(p[0]-points[i][0],p[1]-points[i][1]));let d=(progress%1)*lengths.reduce((a,b)=>a+b,0);for(let i=0;i<lengths.length;i++){if(d<=lengths[i]){let r=d/lengths[i],x=points[i][0]+r*(points[i+1][0]-points[i][0]),y=points[i][1]+r*(points[i+1][1]-points[i][1]);c.fillStyle=color;c.beginPath();c.arc(x,y,5,0,Math.PI*2);c.fill();break;}d-=lengths[i];}};
 text('Two ways to improve a robot policy',30,38,25);text('Conceptual training loops · animation speed does not represent compute time',30,65,12,muted);
 text('SONIC',30,110,17,teal);text('PPO learns from sampled simulator outcomes',180,110,13,muted);
 box(30,135,185,65,'Policy','Choose joint commands',teal);box(307,135,185,65,'Physics simulator','Compute the next state',teal);box(585,135,185,65,'Scores + critic','Assess the outcomes',teal);
 arrow([[215,166],[307,166]],teal,t);arrow([[492,166],[585,166]],teal,t+.5);
 arrow([[677,201],[677,236],[122,236],[122,201]],teal,t/1.5);text('PPO update of the policy',285,258,13,teal);
 c.strokeStyle='#dbe3df';c.beginPath();c.moveTo(30,280);c.lineTo(770,280);c.stroke();
 text('SUPERMIMIC',30,320,17,orange);text('Learn dynamics; differentiate imagined outcomes',235,320,13,muted);
 box(30,390,185,65,'Policy','Choose joint commands',orange);box(307,390,185,65,'World model','Predict the next state',orange);box(585,390,185,65,'Objective + critic','Value the imagined rollout',orange);
 arrow([[215,422],[307,422]],orange,t);arrow([[492,422],[585,422]],orange,t+.5);
 arrow([[677,456],[677,495],[400,495],[400,456]],orange,1-t/1.5);arrow([[400,495],[122,495],[122,456]],orange,1-t/1.5+.5);
 text('Gradients through learned dynamics improve the policy',192,522,13,orange);
 text('MuJoCo data keeps training the world model',270,354,12,muted);arrow([[400,362],[400,390]],muted,t);
 text('The simulator remains the source of dynamics data. The two learners update throughout training.',30,563,12,ink);
 text('Ajay Cyril · DigDeepTech · Sources: SONIC (NVIDIA) and SuperMimic (UC Berkeley)',30,587,10,muted);
}
export async function saveArchitecture(){
 const {GIFEncoder,quantize,applyPalette}=await import('../vendor/gifenc.esm.js');
 const canvas=document.createElement('canvas');canvas.width=800;canvas.height=600;const c=canvas.getContext('2d',{willReadFrequently:true}),gif=GIFEncoder();
 for(let i=0;i<40;i++){drawArchitecture(canvas,i/40);const rgba=c.getImageData(0,0,800,600).data,palette=quantize(rgba,128);gif.writeFrame(applyPalette(rgba,palette),800,600,{palette,delay:100,repeat:0});if(i%10===0)await new Promise(r=>setTimeout(r,0));}
 gif.finish();const b=gif.bytes();let raw='';for(let i=0;i<b.length;i+=8192)raw+=String.fromCharCode(...b.subarray(i,i+8192));
 const r=await fetch('/__capture',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'architecture',kind:'gif',base64:btoa(raw)})});if(!r.ok)throw Error('Could not save architecture GIF');
}
