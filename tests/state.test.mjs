import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeThreads,filterThreads,stepIndex,wheelDelta} from '../src/state.js';
import {mapThread,CodexClient} from '../scripts/codex-client.mjs';
test('imports never execute links with active protocols',()=>{const [t]=normalizeThreads([{title:'<img onerror=alert(1)>',url:'javascript:alert(1)',status:'notLoaded'}]);assert.equal(t.url,null);assert.equal(t.status,'saved');assert.equal(t.title,'<img onerror=alert(1)>');});
test('invalid collections fail before replacing the current library',()=>{assert.throws(()=>normalizeThreads({items:[]}));assert.throws(()=>normalizeThreads([{title:''}]));assert.throws(()=>normalizeThreads([{id:'x',title:'one'},{id:'x',title:'two'}]));assert.throws(()=>normalizeThreads(Array.from({length:1001},(_,i)=>({id:i,title:'test'}))));});
test('import preserves timestamp and only accepts http links',()=>{const [t]=normalizeThreads([{title:'Test',updatedAt:1793671776,url:'https://example.com/thread',status:{type:'active'}}]);assert.equal(t.updatedAt,'2026-11-03T02:09:36.000Z');assert.equal(t.status,'active');assert.equal(t.url,'https://example.com/thread');});
test('search, favorites and status compose',()=>{const data=normalizeThreads([{id:'a',title:'Build API',agent:'Codex',status:'active'},{id:'b',title:'UI',agent:'Claude',status:'waiting'}]);assert.equal(filterThreads(data,'active','codex',new Set()).length,1);assert.equal(filterThreads(data,'starred','',new Set(['b']))[0].id,'b');assert.equal(filterThreads(data,'waiting','api',new Set()).length,0);});
test('wheel wraps continuously in both directions, including the angle seam',()=>{assert.equal(stepIndex(0,-1,6),5);assert.equal(stepIndex(5,2,6),1);assert.equal(stepIndex(1,1,0),0);assert.ok(Math.abs(wheelDelta(Math.PI-.1,-Math.PI+.1)-.2)<1e-6);});
test('a separate app-server does not invent runtime activity',()=>{const t=mapThread({id:'a',name:'Real title',preview:'Summary',status:{type:'notLoaded'},cwd:'C:\\Projects\\sample'});assert.equal(t.status,'saved');assert.equal(t.title,'Real title');assert.equal(t.project,'sample');});
test('bridge rejects all agent mutation operations',async()=>{const client=new CodexClient();await assert.rejects(client.request('turn/start',{}),/read-only/);await assert.rejects(client.request('thread/archive',{}),/read-only/);});

