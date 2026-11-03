import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, stat } from 'node:fs/promises';
import { CodexClient } from './codex-client.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','dist');
const port=Number(process.env.PORT||4173),codex=new CodexClient();
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.glb':'model/gltf-binary','.webmanifest':'application/manifest+json','.png':'image/png','.woff2':'font/woff2'};
let cache=null,cacheAt=0,inflight=null;
const server=http.createServer(async(req,res)=>{
  const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
  const permittedHosts=new Set([`localhost:${port}`,`127.0.0.1:${port}`]);
  if(!permittedHosts.has(req.headers.host))return json(403,{error:'This app accepts local connections only.'});
  if(req.method!=='GET'&&req.method!=='HEAD')return json(405,{error:'Read-only service.'});
  let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{return json(400,{error:'Invalid URL.'});}
  if(pathname.startsWith('/api/')){
    if((req.headers.origin&&!new Set([`http://localhost:${port}`,`http://127.0.0.1:${port}`]).has(req.headers.origin))||req.headers['sec-fetch-site']==='cross-site')return json(403,{error:'Cross-origin thread access is disabled.'});
    if(pathname==='/api/health')return json(200,{app:'threadpod',readOnly:true});
    try{
      if(pathname==='/api/threads'){
        if(!cache||Date.now()-cacheAt>10000){inflight??=codex.list().then(rows=>{cache=rows;cacheAt=Date.now();return rows;}).finally(()=>{inflight=null;});await inflight;}
        return json(200,{threads:cache,refreshedAt:new Date(cacheAt).toISOString(),statusScope:'This read-only app-server connection. Other running clients may appear as saved.'});
      }
      const match=pathname.match(/^\/api\/threads\/([a-zA-Z0-9_-]{1,200})$/);
      if(match){if(!cache?.some(t=>t.id===match[1]))return json(404,{error:'Thread not found in this library.'});return json(200,await codex.read(match[1]));}
      return json(404,{error:'Unknown API route.'});
    }catch(error){return json(503,{error:error.message});}
  }
  try{const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+path.sep))return json(403,{error:'Invalid path.'});const info=await stat(file);if(!info.isFile())return json(404,{error:'Not found.'});const data=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'});res.end(req.method==='HEAD'?undefined:data);}catch{return json(404,{error:'Not found.'});}
});
server.listen(port,'127.0.0.1',()=>console.log(`threadPod is ready: http://127.0.0.1:${port}\nRead-only Codex connection available. Press Ctrl+C to stop.`));
const shutdown=()=>{codex.stop();server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),1000).unref();};
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);

