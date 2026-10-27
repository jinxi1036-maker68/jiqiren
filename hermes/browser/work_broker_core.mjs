// Keeps the MCP catalog alive independently of a finite workplace session.
// Dependency injection permits transport/lifecycle checks without a model.
export class WorkBroker {
 constructor({tools,inspect,connect,record=async()=>{}}){
  this.tools=tools;this.inspect=inspect;this.connect=connect;this.record=record;
  this.worker=null;this.key=null;this.tail=Promise.resolve();this.closed=false;
 }
 list(){return {tools:this.tools};}
 reject(code,text){return {isError:true,content:[{type:'text',text:`${code}: ${text}`}]};}
 async drop(){const worker=this.worker;this.worker=null;this.key=null;if(worker)await worker.close().catch(()=>{});}
 call(name,args={}){
  const job=()=>this.execute(name,args);
  const result=this.tail.then(job,job);this.tail=result.catch(()=>{});return result;
 }
 async execute(name,args){
  if(this.closed)return this.reject('ENTRY_CLOSED','浏览器接入进程已经结束。');
  if(!this.tools.some(t=>t.name===name))return this.reject('TOOL_NOT_ALLOWED','本入口不提供此工具。');
  let current;
  try{current=await this.inspect();}catch{current={available:false,code:'ENTRY_CHECK_FAILED'};}
  if(!current.available){
   await this.drop();await this.record({event:'workplace_unavailable',code:current.code});
   return this.reject(current.code||'WORKPLACE_UNAVAILABLE',
    '当前没有开放的获准浏览器工作站。工具目录仍保留；未发网页请求、未重试操作。请由Owner明确下一阶段范围，不能复用旧验收额度。');
  }
  if(current.key!==this.key){
   await this.drop();
   try{this.worker=await this.connect(current);this.key=current.key;}
   catch{await this.drop();return this.reject('WORKPLACE_CONNECT_FAILED','连接工作站失败；原因未知，未执行目标操作。');}
  }
  // Re-check after a possibly slow startup; never send to a retired workplace.
  let before;
  try{before=await this.inspect();}catch{before={available:false};}
  if(!before.available||before.key!==current.key){
   await this.drop();return this.reject('WORKPLACE_CHANGED_BEFORE_ACTION','工作站已切换或结束，未执行操作。');
  }
  let result;
  try{result=await this.worker.call(name,args);}
  catch{
   await this.drop();await this.record({event:'action_transport_failed',name,revision:current.revision});
   return this.reject('ACTION_OUTCOME_UNKNOWN','浏览器调用中断；操作是否生效及原因未知。没有自动重放，请先读取页面核实。');
  }
  let after;
  try{after=await this.inspect();}catch{after={available:false};}
  await this.record({event:'browser_action_returned',name,revision:current.revision,isError:!!result.isError});
  if(!after.available||after.key!==current.key){
   await this.drop();
   return {...result,isError:true,content:[...(result.content||[]),{type:'text',text:
    'WORKPLACE_CHANGED_DURING_ACTION: 执行期间工作站结束或切换；保留以上原始结果，动作可能已生效，不可据中断直接重提。'}]};
  }
  return result;
 }
 async close(){this.closed=true;await this.tail;await this.drop();}
}
