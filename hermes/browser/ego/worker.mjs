import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import {validateConfig,validateActions,validateToolCall,requireScope,guide} from './policy.mjs';
import {nativeReadGuard} from './native_guard.mjs';
import {releaseOwnedLease} from './lifecycle.mjs';

export async function run(runtimeFile,ownerLock){
 let guard,server,watchdog,yielded=false,tail=Promise.resolve();
 const pages=new Map();let record=async()=>{};
 try{
 const cfg=validateConfig(JSON.parse(await fs.readFile(runtimeFile,'utf8')));
 const task=await taskSpace(cfg.spaceId);pages.set('p1',task.page('p1'));
 const output=path.join(path.dirname(runtimeFile),'output');await fs.mkdir(output,{recursive:true});
 record=e=>fs.appendFile(path.join(output,'receipts.jsonl'),JSON.stringify({at:new Date().toISOString(),...e})+'\n');
 const company=cfg.mode==='company-readonly';
 const tableReader=company?await import('./table_readback.mjs'):null;
 guard=company?(await import('./extension_guard.mjs')).extensionGuard(task,cfg):nativeReadGuard(globalThis.ego,cfg,e=>{void record(e);});
 const requirePage=async(label='p1')=>{
  if(!pages.has(label))throw Error('Only adapter-owned Page labels are available');
  const p=pages.get(label);requireScope(await p.url(),cfg.origin,{blank:true});return p;
 };
 await guard.protect(await requirePage());
 const observe=async(p,args={})=>{
  requireScope(await p.url(),cfg.origin);
  const snapshot=String(await p.snapshot({scope:args.scope||'full_page',...(args.root?{root:args.root}:{})}));
  const format=args.format||'both';
  return {page:p.label,url:await p.url(),...(tableReader?{observed_at:tableReader.observationTime()}:{}),...(format!=='tables'||!tableReader?{snapshot}:{}),...(tableReader&&format!=='snapshot'?{table_readback:tableReader.readTables(snapshot)}:{})};
 };
 const act=async(p,a)=>{
  const option={timeout:6000,label:(a.label||'Operate requested browser control').slice(0,80)};
  switch(a.type){
   case 'navigate':requireScope(a.url,cfg.origin);return p.goto(a.url,{timeout:12000});
   case 'click':case 'dblclick':case 'hover':return p[a.type](a.selector,option);
   case 'focus':return p.focus(a.selector);
   case 'fill':return p.fill(a.selector,a.text);
   case 'select':return p.selectOption(a.selector,{value:a.value});
   case 'press':return p.press(a.selector,a.key);
   case 'scroll':await p.mouse.move(a.x??400,a.y??300,{label:option.label});return p.mouse.wheel(a.dx||0,a.dy||0,{label:option.label});
   case 'mouse_click':return p.mouse.click(a.x,a.y,{label:option.label});
   case 'mouse_move':return p.mouse.move(a.x,a.y,{label:option.label});
   case 'dialog_dismiss':return p.dismissDialog();
   case 'dialog_accept':return p.acceptDialog(a.text);
   case 'wait_text':return p.waitForFunction(value=>document.body.innerText.includes(value),a.text,{timeout:6000});
  }
 };
 const execute=async(name,args={})=>{
  validateToolCall(name,args);
  if(name==='ego_browser_status')return {driver:'ego-native',version:cfg.cliVersion,guideSha256:cfg.guideSha256,spaceId:cfg.spaceId,home:cfg.home,workspace:cfg.workspace,scope:cfg.origin,mode:cfg.mode,productionEnabled:false,businessWritesEnabled:false,guardHealthy:guard.healthy(),...(company?await guard.inspect():{}),limitations:[...(company?['recorded synthetic extension coverage passed; GET business semantics still need judgment']:['cross-target protection not yet verified']),'Readiness alone does not prove an accurate business report or visual interpretation; each actual task needs its own evidence.']};
  if(name==='ego_browser_guide')return {topic:args.topic||'overview',text:args.topic==='official'?await fs.readFile(cfg.officialGuide,'utf8'):guide[args.topic||'overview'],officialGuideSha256:cfg.guideSha256};
  if(yielded)throw Error('EGO_USER_CONTROL: wait for Owner; no automatic reclaim');
  if(!guard.healthy())throw Error('EGO_GUARD_UNHEALTHY');
  if(company)await guard.inspect({requireActive:true});
  if(name==='ego_browser_window'){
   const p=await requirePage();const before=await task.cdp('Browser.getWindowForTarget',{targetId:p.targetId});
   if(args.action==='restore'&&before.bounds?.windowState==='minimized')await task.cdp('Browser.setWindowBounds',{windowId:before.windowId,bounds:{windowState:'normal'}});
   return {before:before.bounds,after:(await task.cdp('Browser.getWindowForTarget',{targetId:p.targetId})).bounds};
  }
  if(name==='ego_browser_handoff'){
   await guard.close([...pages.values()]);await task.handOff();yielded=true;return {handedOff:true,spaceId:cfg.spaceId};
  }
  if(name==='ego_browser_pages'){
   if(args.action==='new'){
    if(args.url)requireScope(args.url,cfg.origin);
    const p=await task.newPage();pages.set(p.label,p);await guard.protect(p);
    if(args.url)await p.goto(args.url,{timeout:12000});return {page:p.label,...(args.url?await observe(p):{url:'about:blank'})};
   }
   if(args.action==='close'){
    if(args.page==='p1')throw Error('Keep the goal primary Page');
    const p=await requirePage(args.page);await p.close();pages.delete(args.page);return {closed:args.page};
   }
   const result=[];for(const [label] of pages){const p=await requirePage(label);result.push({page:label,url:await p.url()});}return result;
  }
  const p=await requirePage(args.page);
  if(name==='ego_browser_observe')return observe(p,args);
  if(name==='ego_browser_screenshot'){
   requireScope(await p.url(),cfg.origin);
   const filename='ego-'+crypto.randomUUID()+'.png',destination=path.join(output,filename).replaceAll('\\','/');
   const saved=await p.screenshot({path:destination});
   if(path.resolve(saved)!==path.resolve(destination))throw Error('Unexpected screenshot destination');
   return {screenshot:filename,page:p.label};
  }
  if(name==='ego_browser_actions'){
   const receipts=[];
   for(const a of validateActions(args.actions)){
    if(company)await guard.inspect({requireActive:true});
    await requirePage(p.label);const receipt=await act(p,a);receipts.push({type:a.type,receipt});
    if(receipt?.dialog)return {receipts,dialog:receipt.dialog,verification:'pending dialog'};
   }
   return {receipts,...await observe(p)};
  }
  throw Error('Unknown browser tool');
 };
 const token=crypto.randomBytes(32).toString('hex');let finish;
 const stopped=new Promise(resolve=>{finish=resolve;});let lastContact=Date.now();
 server=http.createServer(async(req,res)=>{
  if(req.headers.authorization!=='Bearer '+token||req.method!=='POST'){res.writeHead(403);res.end();return;}
  lastContact=Date.now();
  let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>65536){res.writeHead(413);res.end();return;}}
  const job=async()=>{
   try{
    const {name,args}=JSON.parse(raw);
    if(name==='__ping')return {alive:true};
    if(name==='__stop'){setTimeout(finish,30);return {stopping:true};}
    const result=await execute(name,args);await record({tool:name,ok:true,resultSha256:crypto.createHash('sha256').update(JSON.stringify(result)).digest('hex')});return result;
   }catch(e){await record({kind:'tool_error',errorCode:e.error_code||'EGO_OPERATION_FAILED'});return {error:String(e.message||e),code:e.error_code||'EGO_OPERATION_FAILED',outcome:'unknown; no automatic retry'};}
  };
  const result=tail.then(job,job);tail=result.catch(()=>{});
  res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(await result));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 await fs.writeFile(path.join(path.dirname(runtimeFile),'worker-private.json'),JSON.stringify({port:server.address().port,token,spaceId:cfg.spaceId,pid:process.pid}));
 console.log(JSON.stringify({workerReady:true,driver:'ego-native',spaceId:cfg.spaceId}));
 watchdog=setInterval(()=>{if(Date.now()-lastContact>30000)finish();},5000);
 await stopped;
 }finally{
  clearInterval(watchdog);await tail.catch(()=>{});
  if(guard&&!yielded)await guard.close([...pages.values()]).catch(()=>{});
  if(server?.listening){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  await record({kind:'worker_stopped',finishedSpace:false}).catch(()=>{});
  if(ownerLock)await releaseOwnedLease(ownerLock.file,ownerLock.nonce);
 }
}
