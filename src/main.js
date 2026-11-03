import { createDevice } from './device.js';
import { normalizeThreads, filterThreads, stepIndex, relativeTime, STATUSES } from './state.js';
import { demoThreads } from './demo.js';
const $=id=>document.getElementById(id);
const paths={layers:'<path d="m3 6 7-4 7 4-7 4Z"/><path d="m3 10 7 4 7-4M3 14l7 4 7-4"/>',activity:'<path d="M2 10h4l2-6 4 12 2-6h4"/>',circle:'<circle cx="10" cy="10" r="7"/><path d="M10 6v5m0 3v.1"/>',star:'<path d="m10 2 2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5L2 7.8 7.5 7Z"/>',search:'<circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4 4"/>',help:'<circle cx="10" cy="10" r="8"/><path d="M7.5 7a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4m0 3v.1"/>',sound:'<path d="M3 8h3l4-4v12l-4-4H3Z"/><path d="M13 7a5 5 0 0 1 0 6m3-9a9 9 0 0 1 0 12"/>',mute:'<path d="M3 8h3l4-4v12l-4-4H3Z"/><path d="m14 8 4 4m0-4-4 4"/>'};
function icon(name){return `<svg viewBox="0 0 20 20" aria-hidden="true">${paths[name]||paths.layers}</svg>`;}
document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));
$('help').innerHTML=icon('help');$('search-toggle').innerHTML=icon('search');$('favorite').innerHTML=icon('star');$('sound').innerHTML=icon('mute');
const storage={get(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}},set(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}};
let threads=normalizeThreads(demoThreads),source='demo',filter='all',query='',index=0,page='list',homeIndex=0,playing=false,sound=false,device=null,localAvailable=false;
let favorites=new Set(storage.get('threadpod-favorites',[]));
const saved=storage.get('threadpod-collection',null);
if(saved){try{threads=normalizeThreads(saved);source='import';}catch{}}
let visible=threads, timer=null, toastTimer=null, audioContext=null, lastSync=null, liveRequest=false;
const homeFilters=['all','active','waiting','starred'];
function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),4200);}
function tick(){if(!sound)return;try{audioContext??=new (window.AudioContext||window.webkitAudioContext)();audioContext.resume();const oscillator=audioContext.createOscillator(),gain=audioContext.createGain();oscillator.type='triangle';oscillator.frequency.setValueAtTime(1100,audioContext.currentTime);gain.gain.setValueAtTime(.035,audioContext.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+.025);oscillator.connect(gain);gain.connect(audioContext.destination);oscillator.start();oscillator.stop(audioContext.currentTime+.03);}catch{}}
const selected=()=>visible[index];
function updateVisible(preserveId){visible=filterThreads(threads,filter,query,favorites);index=preserveId?Math.max(0,visible.findIndex(t=>t.id===preserveId)):0;}
function paint(){device?.paint({threads:visible,index,page,filter,playing,favorites,source,homeIndex});}
function el(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
function render(){
  updateVisible(selected()?.id);
  $('library-count').textContent=String(threads.length).padStart(2,'0');
  for(const [key,value] of Object.entries({all:threads.length,active:threads.filter(t=>t.status==='active').length,waiting:threads.filter(t=>t.status==='waiting').length,starred:threads.filter(t=>favorites.has(t.id)).length}))$('count-'+key).textContent=value;
  document.querySelectorAll('[data-filter]').forEach(b=>{const active=b.dataset.filter===filter;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
  const list=$('thread-list');list.replaceChildren();
  if(!visible.length)list.append(el('p','empty-list',query?'No threads match your search.':'Nothing in this collection yet. Try another filter.'));
  visible.forEach((t,i)=>{const row=el('button','thread-item'+(i===index?' selected':''));row.dataset.threadId=t.id;row.setAttribute('aria-label',`${t.title}, ${STATUSES[t.status]}`);row.setAttribute('aria-current',String(i===index));const initial=el('span','thread-initial',t.agent.toLowerCase().includes('codex')?'✳':t.agent.toLowerCase().includes('claude')?'✴':t.agent.toLowerCase().includes('cursor')?'↗':'◈');const copy=el('span','thread-item-copy');copy.append(el('strong','',t.title),el('small','',`${t.agent} · ${relativeTime(t.updatedAt)}`));row.append(initial,copy,el('span','status-dot '+t.status));row.addEventListener('click',()=>{index=i;page='list';tick();render();});row.addEventListener('dblclick',openDetail);const item=el('div');item.setAttribute('role','listitem');item.append(row);list.append(item);});
  const t=selected();
  $('position').textContent=String(t?index+1:0).padStart(2,'0');$('total-position').textContent=String(visible.length).padStart(2,'0');$('art-number').textContent=String(t?index+1:0).padStart(3,'0');
  $('thread-title').textContent=t?.title||'A little room for your next idea.';
  $('thread-description').textContent=t?.summary|| (t?'No summary was included with this thread.':'Choose another collection or add your own threads.');
  $('agent-badge').textContent=t?'✳ '+t.agent:'Your collection';
  $('thread-project').textContent=t?.project||'—';$('thread-project').title=t?.project||'';
  $('thread-updated').textContent=t?relativeTime(t.updatedAt):'—';
  const status=$('thread-status');status.replaceChildren();status.className='status';if(t)status.append(el('i','status-dot '+t.status),document.createTextNode(STATUSES[t.status]));else status.textContent='—';
  $('latest-note').textContent=t?.latest||t?.summary||'Select a thread to see what’s happening.';
  $('snapshot-note').textContent=source==='demo'?'SAMPLE ACTIVITY · DEMO COLLECTION':source==='local'?'SAVED HISTORY · REFRESHES EVERY 15S':'IMPORTED COLLECTION · STORED IN THIS BROWSER';
  $('source-label').textContent=source==='demo'?'Demo collection':source==='local'?'Local Codex':'Your collection';
  $('source-note').textContent=source==='demo'?'Take it for a spin, or bring your own threads.':source==='local'?'Your saved Codex history. Status reflects this connection.':'Imported threads stay on this device.';
  $('connection-label').textContent=source==='local'?'Codex connected':source==='import'?'Your collection':'Connect threads';
  $('footer-source').textContent=source==='demo'?'EXAMPLE THREADS · LOCAL-FIRST':source==='local'?'LOCAL CODEX · READ-ONLY':'YOUR THREADS · BROWSER-LOCAL';
  $('favorite').disabled=!t;$('open-thread').disabled=!t;
  const starred=t&&favorites.has(t.id);$('favorite').setAttribute('aria-pressed',String(!!starred));$('favorite').setAttribute('aria-label',starred?'Remove from favorites':'Add to favorites');
  $('play-control').textContent=playing?'Ⅱ':'▶';$('play-control').setAttribute('aria-pressed',String(playing));$('play-control').setAttribute('aria-label',playing?'Pause browsing slideshow':'Start browsing slideshow');
  $('thread-art').style.background=t?.status==='waiting'?'#ece5d2':t?.status==='completed'?'#dce8e3':'#e2e9d5';
  paint();
}
function step(delta){if(page==='home'){homeIndex=stepIndex(homeIndex,delta,4);paint();}else{index=stepIndex(index,delta,visible.length);render();const list=$('thread-list'),row=list.querySelector('[aria-current=true]');if(row){const r=row.getBoundingClientRect(),b=list.getBoundingClientRect();if(r.top<b.top)list.scrollTop+=r.top-b.top;else if(r.bottom>b.bottom)list.scrollTop+=r.bottom-b.bottom;}}tick();}
function select(){tick();if(page==='home'){setFilter(homeFilters[homeIndex]);return;}if(!selected())return;if(page==='detail')openDetail();else{page='detail';paint();}}
function back(){tick();if(page==='detail'){page='list';}else if(page==='list'){page='home';homeIndex=homeFilters.indexOf(filter);}else page='list';paint();}
function setFilter(value){filter=value;page='list';updateVisible();render();}
function play(){playing=!playing;clearInterval(timer);if(playing){page='list';timer=setInterval(()=>{if(!document.hidden&&!document.querySelector('dialog[open]'))step(1);},3500);toast('Browsing slideshow on. Your agents keep working as usual.');}else toast('Browsing paused.');render();}
async function openDetail(){
  const t=selected();if(!t)return;
  if(t.url){window.open(t.url,'_blank','noopener,noreferrer');return;}
  $('detail-title').textContent=t.title;$('detail-agent').textContent=t.agent.toUpperCase()+' / '+t.project.toUpperCase();
  const body=$('detail-content');body.replaceChildren(el('p','',t.summary||'No summary was provided.'));
  const showMessages=messages=>{if(!messages.length)return;body.replaceChildren();messages.forEach(m=>{const item=el('div','transcript-message');item.append(el('strong','',m.role.toUpperCase()),el('div','',m.text));body.append(item);});};
  showMessages(t.messages);
  $('thread-dialog').showModal();
  if(source==='local'){
    body.append(el('p','dialog-note','Loading saved conversation…'));
    try{const response=await fetch(`/api/threads/${encodeURIComponent(t.id)}`,{signal:AbortSignal.timeout(20000)});const result=await response.json();if(!response.ok)throw new Error(result.error||'Could not read this thread.');if($('detail-title').textContent!==t.title)return;body.replaceChildren(el('p','',t.summary||''));if(result.messages?.length)showMessages(result.messages);else body.append(el('p','dialog-note','This thread has no saved messages available yet.'));}catch(error){body.querySelector('.dialog-note')?.remove();body.append(el('p','dialog-note',error.message));}
  }
}
async function connectLocal(quiet=false){
  if(liveRequest)return;liveRequest=true;
  try{const response=await fetch('/api/threads',{signal:AbortSignal.timeout(25000)});if(!response.ok)throw new Error('Start the local app with npm start and make sure Codex is installed.');const result=await response.json();if(result.error)throw new Error(result.error);const id=selected()?.id;threads=normalizeThreads(result);source='local';lastSync=new Date();updateVisible(id);render();if(!quiet){$('connect-dialog').close();toast(`Connected ${threads.length} local Codex threads.`);}}
  catch(error){if(!quiet){$('connect-message').textContent=error.message;toast(error.message);}else if(source==='local'){$('connection-label').textContent='Connection lost';$('source-note').textContent='Showing the last successful refresh. Reconnect to update.';}}
  finally{liveRequest=false;}
}
function exportFile(name,data){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=el('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>setFilter(b.dataset.filter)));
$('search').addEventListener('input',e=>{query=e.target.value;updateVisible();render();});$('search-toggle').onclick=()=>$('search').focus();
$('menu-control').onclick=back;$('prev-control').onclick=()=>step(-1);$('next-control').onclick=()=>step(1);$('select-control').onclick=select;$('play-control').onclick=play;
$('favorite').onclick=()=>{const id=selected()?.id;if(!id)return;favorites.has(id)?favorites.delete(id):favorites.add(id);storage.set('threadpod-favorites',[...favorites]);render();};
$('open-thread').onclick=openDetail;
$('sound').onclick=()=>{sound=!sound;$('sound').innerHTML=icon(sound?'sound':'mute');$('sound').setAttribute('aria-pressed',String(sound));$('sound').setAttribute('aria-label',sound?'Mute wheel sounds':'Enable wheel sounds');tick();toast(sound?'Click-wheel sounds on.':'Click-wheel sounds off.');};
const showConnect=()=>{$('connect-message').textContent=localAvailable?'Read your saved Codex threads from this computer. No inference or agent actions are performed.':'Run the included local app with npm start to enable the Codex connection. You can also import JSON here.';$('connect-dialog').showModal();};
$('connect').onclick=showConnect;$('import-side').onclick=showConnect;$('help').onclick=()=>$('help-dialog').showModal();
$('local-connect').onclick=()=>connectLocal();
document.querySelectorAll('.close-dialog').forEach(b=>b.onclick=()=>b.closest('dialog').close());
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
$('reset-view').onclick=()=>{device?.reset();toast('Back to the classic view.');};
document.querySelectorAll('[data-finish]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-finish]').forEach(other=>{other.classList.toggle('selected',other===b);other.setAttribute('aria-pressed',String(other===b));});device?.setFinish(b.dataset.finish);$('finish-label').textContent=b.dataset.finish==='white'?'Ivory':'Graphite';});
$('import-file').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>5e6)throw new Error('Please choose a JSON file smaller than 5 MB.');const collection=normalizeThreads(JSON.parse(await file.text()));threads=collection;source='import';filter='all';query='';$('search').value='';page='list';updateVisible();const persisted=storage.set('threadpod-collection',collection);render();$('connect-dialog').close();toast(`${collection.length} threads in rotation.${persisted?'':' Browser storage is full; this collection will last for this session.'}`);}catch(error){toast(error.message);$('connect-message').textContent=error.message;}finally{e.target.value='';}});
$('download-example').onclick=()=>exportFile('threadpod-example.json',{threads:demoThreads.slice(0,2)});
$('use-demo').onclick=()=>{threads=normalizeThreads(demoThreads);source='demo';storage.set('threadpod-collection',null);filter='all';query='';$('search').value='';updateVisible();render();$('connect-dialog').close();};
$('clear-data').onclick=()=>{storage.set('threadpod-collection',null);storage.set('threadpod-favorites',[]);favorites.clear();threads=normalizeThreads(demoThreads);source='demo';filter='all';query='';$('search').value='';updateVisible();render();toast('Imported threads and favorites cleared.');};
let deferredInstall=null;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;});
$('install-app').onclick=async()=>{if(deferredInstall){await deferredInstall.prompt();deferredInstall=null;}else toast('On Mac: Safari → File → Add to Dock. In Chrome, use Install page as app.');};
window.addEventListener('keydown',e=>{if(e.metaKey||e.ctrlKey||e.altKey||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||document.querySelector('dialog[open]'))return;if(e.target.tagName==='BUTTON'&&(e.key==='Enter'||e.key===' '))return;const handlers={ArrowDown:()=>step(1),ArrowRight:()=>step(1),ArrowUp:()=>step(-1),ArrowLeft:()=>step(-1),Enter:select,Escape:back,' ':play};if(handlers[e.key]){e.preventDefault();handlers[e.key]();}});
render();
createDevice($('device-canvas'),{step,select,back,play,error:toast}).then(d=>{device=d;paint();$('device-loading').hidden=true;document.body.dataset.modelReady='true';}).catch(error=>{$('device-loading').hidden=true;$('fallback').hidden=false;console.error('3D view unavailable:',error);});
// A hosted page never probes a user's loopback interface. The local server supplies this route.
if(['localhost','127.0.0.1','[::1]'].includes(location.hostname)){
  fetch('/api/health').then(r=>r.json()).then(result=>{localAvailable=result.app==='threadpod';if(localAvailable&&source!=='import')connectLocal(true);}).catch(()=>{});
}
setInterval(()=>{if(source==='local'&&!document.hidden)connectLocal(true);},15000);
window.addEventListener('pagehide',()=>{clearInterval(timer);device?.dispose();});

