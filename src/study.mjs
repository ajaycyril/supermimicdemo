import './warp-replay.mjs';
const $=s=>document.querySelector(s);
const canvas=$('#study-chart'),ctx=canvas.getContext('2d');
let data,group='all',chosen=4;
function draw(){
 const mobile=canvas.getBoundingClientRect().width<550;canvas.height=mobile?600:460;
 const rows=data.summary[group],W=canvas.width,H=canvas.height,left=80,right=W-35,top=55,bottom=H-70;
 const y=v=>bottom-v/16*(bottom-top),xs=rows.map((_,i)=>150+i*180);
 ctx.fillStyle='#f8f7f3';ctx.fillRect(0,0,W,H);ctx.font=(mobile?'34':'18')+'px system-ui';ctx.fillStyle='#647a7c';ctx.fillText('Root-position gap · cm',28,27);
 for(const v of [0,4,8,12,16]){ctx.strokeStyle='#dbe3df';ctx.beginPath();ctx.moveTo(left,y(v));ctx.lineTo(right,y(v));ctx.stroke();ctx.fillText(String(v),35,y(v)+6);}
 rows.forEach((r,i)=>{const x=xs[i];ctx.fillStyle=i===chosen?'#116d79':'#b6ccc9';ctx.fillRect(x-34,y(r.medianRootCm),68,bottom-y(r.medianRootCm));ctx.strokeStyle='#142d32';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y(r.p10RootCm));ctx.lineTo(x,y(r.p90RootCm));for(const v of [r.p10RootCm,r.p90RootCm]){ctx.moveTo(x-9,y(v));ctx.lineTo(x+9,y(v));}ctx.stroke();ctx.fillStyle='#142d32';ctx.textAlign='center';ctx.fillText(r.seconds<1?`${r.seconds*1000} ms`:'1 sec',x,H-30);ctx.fillStyle=i===chosen?'#116d79':'#647a7c';ctx.fillText(r.medianRootCm.toFixed(2),x,y(r.p90RootCm)-12);});ctx.textAlign='left';
 const r=rows[chosen];$('#study-median').textContent=r.medianRootCm.toFixed(2);$('#study-tail').textContent=r.p90RootCm.toFixed(2);$('#study-horizon').textContent=r.seconds<1?`${r.seconds*1000} ms`:'1 second';$('#study-count').textContent=r.count;
 $('#study-caption').textContent=group==='all'?'All 128 windows, including falls and ground contacts. Bars show medians; whiskers span the 10th–90th percentile.':'56 windows whose initial root height is above 0.6 m. This does not guarantee standing throughout the prediction. Whiskers span the 10th–90th percentile.';
 canvas.setAttribute('aria-label',rows.map(r=>`${r.seconds} second horizon: median ${r.medianRootCm.toFixed(2)} cm, 90th percentile ${r.p90RootCm.toFixed(2)} cm`).join('; '));
}
try{
 const response=await fetch('article/horizon-study.json');if(!response.ok)throw Error('Study unavailable');data=await response.json();
 $('#study-group').onchange=e=>{group=e.target.value;draw();};
 $('#horizon').oninput=e=>{chosen=Number(e.target.value);draw();};draw();
window.addEventListener('resize',()=>data&&draw());
}catch{$('#study-caption').textContent='The measurements could not be loaded. The article includes the results and source data.';}
