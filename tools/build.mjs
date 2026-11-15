import {cp,mkdir,readdir,readFile,writeFile,rm} from 'node:fs/promises';
await rm('dist/vendor/ort',{recursive:true,force:true});
await mkdir('dist/vendor/mujoco',{recursive:true});await mkdir('dist/vendor/ort',{recursive:true});
for(const n of ['mujoco.js','mujoco.wasm'])await cp(`node_modules/@mujoco/mujoco/${n}`,`dist/vendor/mujoco/${n}`);
for(const n of ['ort.wasm.min.mjs','ort-wasm-simd-threaded.mjs','ort-wasm-simd-threaded.wasm'])await cp(`node_modules/onnxruntime-web/dist/${n}`,`dist/vendor/ort/${n}`);
await cp('node_modules/gifenc/dist/gifenc.esm.js','dist/vendor/gifenc.esm.js');
await cp('src','dist/src',{recursive:true});
for(const n of ['index.html','style.css','article.html'])await cp(n,`dist/${n}`);
await rm('dist/article',{recursive:true,force:true});
await cp('article','dist/article',{recursive:true,filter:source=>!source.endsWith('.json')||!source.includes('/runs/')});await cp('docs','dist/docs',{recursive:true});
await writeFile('dist/.nojekyll','');
console.log('Static build ready in dist/');

for(const [pkg,name] of [["@mujoco/mujoco","MuJoCo"],["onnxruntime-web","ONNXRuntime"],["gifenc","gifenc"]]){ for(const n of ["LICENSE","LICENSE.txt","LICENSE.md"]){try{await cp(`node_modules/${pkg}/${n}`,`dist/docs/licenses/${name}.txt`);break;}catch{}}}
