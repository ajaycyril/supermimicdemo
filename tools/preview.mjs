// Development-only server. Capture endpoint writes only this project's article assets.
import http from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const valid=new Set(['one-step','drift','correction','friction','noise','push','architecture']);
export const server=http.createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
  if(req.method==='POST'&&pathname==='/__capture'){
   if(req.headers.origin!=='http://127.0.0.1:8765'){res.writeHead(403);res.end();return;}
   let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>30*1024*1024)throw Error('Capture too large');chunks.push(c);}
   const item=JSON.parse(Buffer.concat(chunks));if(!valid.has(item.name))throw Error('Invalid capture name');
   if(item.kind==='gif'){const b=Buffer.from(item.base64,'base64');if(b.subarray(0,6).toString()!=='GIF89a')throw Error('Not a GIF');await mkdir(path.join(root,'article/gifs'),{recursive:true});await writeFile(path.join(root,'article/gifs',item.name+'.gif'),b);}
   else if(item.kind==='json'){await mkdir(path.join(root,'article/runs'),{recursive:true});await writeFile(path.join(root,'article/runs',item.name+'.json'),JSON.stringify(item.data,null,2));}
   else throw Error('Unknown capture type');
   res.writeHead(200,{'Content-Type':'application/json'});res.end('{"saved":true}');return;
  }
  if(req.method!=='GET'){res.writeHead(405);res.end();return;}
  const rel=pathname.endsWith('/')?pathname+'index.html':pathname;
  const file=path.resolve(root,'dist','.'+rel);if(!file.startsWith(root+'/dist/'))throw Error('Invalid path');
  const data=await readFile(file);const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.wasm':'application/wasm','.gif':'image/gif','.xml':'application/xml'}[path.extname(file)]||'application/octet-stream';
  res.writeHead(200,{'Content-Type':mime,'Cache-Control':'no-store'});res.end(data);
 }catch(e){res.writeHead(400);res.end('Request failed');}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(8765,'127.0.0.1',resolve)});
console.log('Preview: http://127.0.0.1:8765');
