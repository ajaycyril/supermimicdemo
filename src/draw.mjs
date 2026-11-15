export const palette={background:'#f8f7f3',ink:'#142d32',muted:'#697e80',physics:'#116d79',model:'#da6836',grid:'#dce5e1'};
export function draw(canvas,frame,parents,meta={}) {
 const c=canvas.getContext('2d'),W=canvas.width,H=canvas.height;
 c.fillStyle=palette.background;c.fillRect(0,0,W,H);
 c.fillStyle=palette.ink;c.font=`600 ${W*.026}px system-ui`;c.fillText(meta.title||'Prediction Lab',W*.035,H*.08);
 c.font=`${W*.015}px system-ui`;c.fillStyle=palette.muted;c.fillText('Same initial state. Same motor commands.',W*.035,H*.125);
 const top=H*.18,bottom=H*.82;
 const project=(p,cx)=>[cx+(p[1]*.9-p[0]*.45)*W*.24,bottom-p[2]*H*.43-(p[0]*.18+p[1]*.06)*H*.15];
 [0,1].forEach(side=>{
  const cx=W*(side?.75:.25);c.save();c.beginPath();c.rect(W*.5*side,top,W*.5,bottom-top+H*.06);c.clip();
  c.strokeStyle=palette.grid;c.lineWidth=1;
  for(let i=-4;i<=4;i++){for(let axis=0;axis<2;axis++){const a=project(axis?[i*.25,-1,0]:[-1,i*.25,0],cx),b=project(axis?[i*.25,1,0]:[1,i*.25,0],cx);c.beginPath();c.moveTo(...a);c.lineTo(...b);c.stroke();}}
  const points=side?frame?.wmBodies:frame?.simBodies;
  if(points){
    const color=side?palette.model:palette.physics;
    c.strokeStyle=color;c.fillStyle=color;c.lineWidth=W*.004;c.lineCap='round';c.globalAlpha=.38;
    for(let i=1;i<parents.length;i++){const p=parents[i];if(p===0)continue;const a=project(points.slice(i*3,i*3+3),cx),b=project(points.slice(p*3,p*3+3),cx);c.beginPath();c.moveTo(...a);c.lineTo(...b);c.stroke();}
    c.globalAlpha=1;
    const geometry=side?frame.wmGeometry:frame.simGeometry;
    if(geometry)for(const g of [...geometry].sort((a,b)=>(a.a[0]+a.a[1])-(b.a[0]+b.a[1]))){const a=project(g.a,cx),b=project(g.b,cx);c.lineWidth=Math.max(2,2*g.r*H*.43);c.strokeStyle=color;c.beginPath();c.moveTo(...a);c.lineTo(...b);c.stroke();if(Math.hypot(a[0]-b[0],a[1]-b[1])<1){c.beginPath();c.arc(a[0],a[1],c.lineWidth/2,0,Math.PI*2);c.fill();}c.strokeStyle='#ffffff35';c.lineWidth=Math.max(1,g.r*H*.12);c.beginPath();c.moveTo(a[0]-2,a[1]-2);c.lineTo(b[0]-2,b[1]-2);c.stroke();}
  } else {c.fillStyle=palette.muted;c.font=`${W*.017}px system-ui`;c.textAlign='center';c.fillText('Start comparison',cx,H*.53);}
  c.restore();
  c.fillStyle=side?palette.model:palette.physics;c.font=`600 ${W*.018}px system-ui`;c.textAlign='center';c.fillText(side?'COMMUNITY WORLD MODEL':'NATIVE MUJOCO WASM',cx,top+H*.035);
 });
 c.textAlign='left';c.strokeStyle=palette.grid;c.beginPath();c.moveTo(W*.5,top+H*.07);c.lineTo(W*.5,H*.82);c.stroke();
 c.fillStyle=palette.ink;c.font=`500 ${W*.017}px system-ui`;
 const e=frame?.error;c.fillText(`t = ${(frame?.t||0).toFixed(2)} s`,W*.035,H*.9);
 c.fillText(e?`Root gap ${(e.root*100).toFixed(1)} cm · Joint gap ${e.joint.toFixed(1)}°`:'Same starting state, independent predictions.',W*.21,H*.9);
 c.font=`${W*.012}px system-ui`;c.fillStyle=palette.muted;c.fillText('Identical scripted commands · positions computed live',W*.035,H*.96);
 if(frame?.corrected){c.fillStyle=palette.model;c.textAlign='right';c.fillText('State refreshed from MuJoCo',W*.965,H*.96);c.textAlign='left';}
}
export function chart(canvas,frames,at=frames.length-1){
 const c=canvas.getContext('2d'),W=canvas.width,H=canvas.height;c.clearRect(0,0,W,H);
 c.fillStyle=palette.background;c.fillRect(0,0,W,H);const max=Math.max(.01,...frames.map(f=>f.error.root)),end=frames.at(-1)?.t||4;
 c.font='12px system-ui';c.fillStyle=palette.muted;c.fillText(`${(max*100).toFixed(1)} cm`,6,16);c.fillText('0',6,H-12);c.fillText(`${end.toFixed(1)} s`,W-30,H-3);
 c.strokeStyle=palette.grid;c.beginPath();c.moveTo(54,10);c.lineTo(54,H-20);c.lineTo(W-8,H-20);c.stroke();
 c.strokeStyle=palette.model;c.lineWidth=2;c.beginPath();frames.forEach((f,i)=>{const x=54+(W-65)*f.t/end,y=H-20-(H-35)*f.error.root/max;i?c.lineTo(x,y):c.moveTo(x,y);});c.stroke();
 const f=frames[at];if(f){const x=54+(W-65)*f.t/end;c.strokeStyle=palette.ink;c.lineWidth=1;c.beginPath();c.moveTo(x,10);c.lineTo(x,H-20);c.stroke();}
}
