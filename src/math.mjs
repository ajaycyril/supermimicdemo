// State/canonical integration adapted from CuboiLeo/SuperMimic-Reproduced (MIT).
// Full 71D state uses MuJoCo's qpos | qvel, including body-frame angular velocity.
export const DT = 0.02;
export function normalize(q) { const n=Math.hypot(...q); if(n<1e-12)throw Error('Invalid quaternion'); return q.map(x=>x/n); }
export const conjugate = q => [q[0],-q[1],-q[2],-q[3]];
export function multiply(a,b) {const [w,x,y,z]=a,[v,i,j,k]=b;return [w*v-x*i-y*j-z*k,w*i+x*v+y*k-z*j,w*j-x*k+y*v+z*i,w*k+x*j-y*i+z*v];}
export function rotate(q,v) {return multiply(multiply(q,[0,...v]),conjugate(q)).slice(1);}
export function heading(q) {const [w,x,y,z]=q;const a=Math.atan2(2*(w*z+x*y),1-2*(y*y+z*z))/2;return [Math.cos(a),0,0,Math.sin(a)];}
export function expQuaternion(v) {const a=Math.hypot(...v);const k=a<1e-4?.5-a*a/48:Math.sin(a/2)/a;return [a<1e-4?1-a*a/8:Math.cos(a/2),...v.map(x=>x*k)];}
export function canonical(s) {
  const q=normalize(Array.from(s.slice(3,7))), h=heading(q), inv=conjugate(h);
  const [w,x,y,z]=multiply(inv,q);
  const rot6=[1-2*(y*y+z*z),2*(x*y-w*z),2*(x*y+w*z),1-2*(x*x+z*z),2*(x*z-w*y),2*(y*z+w*x)];
  return [s[2],...rot6,...rotate(inv,Array.from(s.slice(36,39))),...Array.from(s.slice(39,42),v=>v/2),...s.slice(7,36),...Array.from(s.slice(42,71),v=>v/5)];
}
export function features(s,action,friction=1) {
  if(s.length!==71||action.length!==29)throw Error('Invalid state/action shape');
  return Float32Array.from([...canonical(s),...action,(friction-.75)/.45,...Array(32).fill(0)]);
}
export function integrate(s,d) {
  if(d.length!==70)throw Error('Expected 70 residuals');
  const out=Float64Array.from(s),q=normalize(Array.from(s.slice(3,7))), h=heading(q);
  const dv=rotate(h,Array.from(d.slice(0,3),v=>v*.3)),dp=rotate(h,Array.from(d.slice(35,38),v=>v*.01));
  for(let i=0;i<3;i++){out[36+i]+=dv[i];out[39+i]+=d[3+i]*.5;out[i]+=DT*out[36+i]+dp[i];}
  for(let i=0;i<29;i++){out[42+i]+=d[6+i]*2;out[7+i]+=DT*out[42+i]+d[41+i]*.02;}
  out.set(normalize(multiply(q,expQuaternion([0,1,2].map(i=>DT*out[39+i]+d[38+i]*.02)))),3);
  return out;
}
export function errors(a,b) {
 const root=Math.hypot(...[0,1,2].map(i=>a[i]-b[i]));
 const joint=Math.sqrt(Array.from({length:29},(_,i)=>(a[7+i]-b[7+i])**2).reduce((x,y)=>x+y,0)/29)*180/Math.PI;
 const qa=normalize(Array.from(a.slice(3,7))), qb=normalize(Array.from(b.slice(3,7)));
 const orientation=2*Math.acos(Math.min(1,Math.abs(qa.reduce((v,x,i)=>v+x*qb[i],0))))*180/Math.PI;
 return {root,joint,orientation};
}
export function seededRandom(seed=42){let n=seed>>>0;return()=>{n=(1664525*n+1013904223)>>>0;return(n+.5)/4294967296;};}
export function gaussian(rng){return Math.sqrt(-2*Math.log(rng()))*Math.cos(2*Math.PI*rng());}
export function actionAt(step,joints,amplitude,noise,rng) {
  // A deliberately simple probe, not a trained policy. Both engines get identical samples.
  const wave=Math.sin(2*Math.PI*.5*step*DT);
  return Float32Array.from(joints.map(j=>(j.name.includes('shoulder_pitch')?amplitude*wave:0)+noise*gaussian(rng)));
}
