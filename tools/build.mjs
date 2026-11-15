import {cp,mkdir,readdir,readFile,writeFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
await rm('dist/vendor/ort',{recursive:true,force:true});
await mkdir('dist/vendor/mujoco',{recursive:true});await mkdir('dist/vendor/ort',{recursive:true});
for(const n of ['mujoco.js','mujoco.wasm'])await cp(`node_modules/@mujoco/mujoco/${n}`,`dist/vendor/mujoco/${n}`);
for(const n of ['ort.wasm.min.mjs','ort-wasm-simd-threaded.mjs','ort-wasm-simd-threaded.wasm'])await cp(`node_modules/onnxruntime-web/dist/${n}`,`dist/vendor/ort/${n}`);
await cp('node_modules/gifenc/dist/gifenc.esm.js','dist/vendor/gifenc.esm.js');
await rm('dist/src',{recursive:true,force:true});
await cp('src','dist/src',{recursive:true});
for(const n of ['index.html','style.css','article.html'])await cp(n,`dist/${n}`);
for(const file of await readdir('src')){if(!file.endsWith('.mjs'))continue;let code=await readFile(`src/${file}`,'utf8');for(const dep of ['engine.mjs','math.mjs','draw.mjs']){const hash=createHash('sha256').update(await readFile(`src/${dep}`)).digest('hex').slice(0,12);code=code.replaceAll(`'./${dep}'`,`'./${dep}?v=${hash}'`);}await writeFile(`dist/src/${file}`,code);}
const appVersion=createHash('sha256').update(await readFile('src/app.mjs')).digest('hex').slice(0,12);
const studyVersion=createHash('sha256').update(await readFile('src/study.mjs')).digest('hex').slice(0,12);
const styleVersion=createHash('sha256').update(await readFile('style.css')).digest('hex').slice(0,12);
for(const page of ['index.html','article.html'])await writeFile(`dist/${page}`,(await readFile(`dist/${page}`,'utf8')).replace('href="style.css"',`href="style.css?v=${styleVersion}"`));
await writeFile('dist/index.html',(await readFile('dist/index.html','utf8')).replace('src="src/app.mjs"',`src="src/app.mjs?v=${appVersion}"`).replace('src="src/study.mjs"',`src="src/study.mjs?v=${studyVersion}"`));
await rm('dist/article',{recursive:true,force:true});
await cp('article','dist/article',{recursive:true,filter:source=>!source.endsWith('.json')||!source.includes('/runs/')});
await rm('dist/docs',{recursive:true,force:true});await cp('docs','dist/docs',{recursive:true,filter:source=>!source.endsWith('validation-results.json')});
await writeFile('dist/.nojekyll','');
console.log('Static build ready in dist/');

for(const [pkg,name] of [["@mujoco/mujoco","MuJoCo"],["onnxruntime-web","ONNXRuntime"],["gifenc","gifenc"]]){ for(const n of ["LICENSE","LICENSE.txt","LICENSE.md"]){try{await cp(`node_modules/${pkg}/${n}`,`dist/docs/licenses/${name}.txt`);break;}catch{}}}
