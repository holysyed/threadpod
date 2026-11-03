import assert from 'node:assert/strict';
const base='http://127.0.0.1:4173';
const page=await fetch(base);assert.equal(page.status,200);
const health=await (await fetch(base+'/api/health')).json();assert.equal(health.readOnly,true);
const threads=await (await fetch(base+'/api/threads')).json();assert.ok(Array.isArray(threads.threads));assert.ok(threads.threads.length>0);
const data=await(await fetch(base+'/api/threads/'+threads.threads[0].id)).json();assert.ok(Array.isArray(data.messages));
const crossOrigin=await fetch(base+'/api/threads',{headers:{Origin:'https://untrusted.example'}});assert.equal(crossOrigin.status,403);
const mutation=await fetch(base+'/api/threads',{method:'POST'});assert.equal(mutation.status,405);
const model=await fetch(base+'/models/threadpod.glb');assert.equal(model.status,200);const buffer=await model.arrayBuffer();assert.equal(new DataView(buffer).getUint32(0,true),0x46546c67);
console.log(JSON.stringify({http:page.status,threadCount:threads.threads.length,messageCount:data.messages.length,crossOrigin:crossOrigin.status,mutations:mutation.status,modelBytes:buffer.byteLength}));

