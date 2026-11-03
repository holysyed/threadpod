import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
export class CodexClient {
  constructor(binary=process.env.CODEX_BIN||'codex'){this.binary=binary;this.nextId=1;this.pending=new Map();this.ready=null;this.child=null;}
  async start(){
    if(this.ready)return this.ready;
    this.ready=(async()=>{
      this.child=spawn(this.binary,['app-server','--listen','stdio://'],{stdio:['pipe','pipe','pipe'],windowsHide:true});
      this.child.stderr.resume();
      const fail=()=>{for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new Error('The local Codex connection stopped. Make sure the Codex CLI is installed and available on PATH.'));}this.pending.clear();this.ready=null;};
      this.child.on('error',fail);this.child.on('exit',fail);
      createInterface({input:this.child.stdout}).on('line',line=>{let value;try{value=JSON.parse(line);}catch{return;}const p=this.pending.get(value.id);if(!p)return;clearTimeout(p.timer);this.pending.delete(value.id);if(value.error)p.reject(new Error(value.error.message||'Codex request failed'));else p.resolve(value.result);});
      await this.request('initialize',{clientInfo:{name:'threadpod_reader',title:'threadPod',version:'1.0.0'}});
      this.child.stdin.write(JSON.stringify({method:'initialized',params:{}})+'\n');
    })();
    try{await this.ready;}catch(error){this.stop();throw error;}
  }
  request(method,params){
    if(!['initialize','thread/list','thread/read','thread/turns/list'].includes(method))return Promise.reject(new Error('Only read-only thread operations are supported.'));
    return new Promise((resolve,reject)=>{const id=this.nextId++;const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('Codex took too long to respond. Please reconnect.'));},18000);this.pending.set(id,{resolve,reject,timer});this.child.stdin.write(JSON.stringify({id,method,params})+'\n',error=>{if(error){clearTimeout(timer);this.pending.delete(id);reject(error);}});});
  }
  async list(){
    await this.start();let cursor=null,rows=[];
    do{const page=await this.request('thread/list',{limit:100,sortKey:'updated_at',archived:false,modelProviders:[],sourceKinds:['cli','vscode','exec','appServer','subAgent','subAgentReview','subAgentCompact','subAgentThreadSpawn','subAgentOther','unknown'],...(cursor?{cursor}:{})});rows.push(...page.data);cursor=page.nextCursor;}while(cursor&&rows.length<1000);
    return rows.slice(0,1000).map(mapThread);
  }
  async read(id){
    await this.start();const result=await this.request('thread/read',{threadId:id,includeTurns:true});
    let turns=result.thread?.turns||[];
    if(!turns.length){try{const page=await this.request('thread/turns/list',{threadId:id,limit:20,sortDirection:'desc',itemsView:'full'});turns=(page.data||[]).reverse();}catch{/* Older app servers return turns directly. */}}
    return {messages:turns.flatMap(turn=>(turn.items||[]).filter(item=>['userMessage','agentMessage'].includes(item.type)).map(item=>({role:item.type==='userMessage'?'You':'Codex',text:item.text||(item.content||[]).filter(c=>c.type==='text').map(c=>c.text).join('\n')}))).slice(-60)};
  }
  stop(){this.child?.kill();this.child=null;this.ready=null;}
}
export function mapThread(t){
  const status=t.status?.type||'notLoaded';
  return {id:t.id,title:t.name||t.preview?.split('\n')[0]||'Untitled thread',summary:t.preview||'',agent:'Codex',project:t.cwd?.split(/[\\/]/).filter(Boolean).pop()||'Personal',status:status==='notLoaded'?'saved':status,updatedAt:t.updatedAt,latest:t.preview||'',messages:[]};
}

