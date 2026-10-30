import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import {validateConfig,validateActions,validateToolCall,requireScope,guide,isCompany,authority} from './policy.mjs';
import {nativeReadGuard} from './native_guard.mjs';
import {releaseOwnedLease,actionBatch} from './lifecycle.mjs';

export async function run(runtimeFile,ownerLock){
 let guard,server,watchdog,yielded=false,tail=Promise.resolve(),phase='configuration',startupComplete=false;
 const pages=new Map();let record=async()=>{};
 try{
 let cfg=validateConfig(JSON.parse(await fs.readFile(runtimeFile,'utf8')));const configuredSpaceId=cfg.spaceId;
 const output=path.join(path.dirname(runtimeFile),'output');await fs.mkdir(output,{recursive:true});
 record=e=>fs.appendFile(path.join(output,'receipts.jsonl'),JSON.stringify({at:new Date().toISOString(),...e})+'\n');
 const company=isCompany(cfg);
 phase='company-workplace';
 let resolution,needsApprovedStart;
 if(company){
  const mod=await import('./workplace.mjs');
  needsApprovedStart=mod.needsApprovedStart;
  resolution=await mod.resolveCompanyWorkplace(cfg,{list:()=>listTaskSpaces(),open:(...args)=>taskSpace(...args),profiles:()=>profiles()});
  cfg=resolution.cfg;
 }else resolution={task:await taskSpace(cfg.spaceId),created:false,method:'synthetic-existing-space'};
 const task=resolution.task;pages.set('p1',task.page('p1'));
 await record({kind:'workplace_resolved',configuredSpaceId,resolvedSpaceId:cfg.spaceId,method:resolution.method,created:resolution.created,profileId:cfg.profileId});
 const tableReader=company?await import('./table_readback.mjs'):null;
 guard=company?(await import('./extension_guard.mjs')).extensionGuard(task,cfg):nativeReadGuard(globalThis.ego,cfg,e=>{void record(e);});
 const requirePage=async(label='p1')=>{
  if(!pages.has(label))throw Error('Only adapter-owned Page labels are available');
  const p=pages.get(label);requireScope(await p.url(),cfg.origin,{blank:true});return p;
 };
 phase='actual-profile-and-extension';await guard.protect(company&&cfg.workplaceBinding?task.page('p1'):await requirePage());
 if(company&&needsApprovedStart(cfg,resolution,await task.page('p1').url())){
  phase='approved-workplace-navigation';const p=task.page('p1');
  await p.goto(cfg.workplaceBinding.startUrl,{timeout:15000});
  const u=new URL(await p.url());
  if(u.origin!==cfg.origin||u.pathname!=='/statistics')throw Object.assign(Error('Company page requires Owner login/navigation confirmation; no credentials read'),{code:'EGO_OWNER_LOGIN_REQUIRED'});
 }
 if(company)requireScope(await task.page('p1').url(),cfg.origin);
 if(company&&/(^|\/)(login|signin|sign-in)(\/|$)/i.test(new URL(await task.page('p1').url()).pathname))throw Object.assign(Error('Company workplace is on a login page; Owner must log in personally'),{code:'EGO_OWNER_LOGIN_REQUIRED'});
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
  if(name==='ego_browser_status')return {driver:'ego-native',version:cfg.cliVersion,guideSha256:cfg.guideSha256,spaceId:cfg.spaceId,configuredSpaceId,workplaceResolution:resolution.method,workplaceRestored:resolution.created,workplaceName:cfg.workplaceBinding?.name,home:cfg.home,workspace:cfg.workspace,scope:cfg.origin,mode:cfg.mode,productionEnabled:cfg.productionEnabled,authority:authority(cfg),...authority(cfg),guardHealthy:guard.healthy(),...(company?await guard.inspect():{}),limitations:[...(company?['Same-site tool capability is not server account authorization; business success needs actual saved-result verification.']:['cross-target protection not yet verified']),'Readiness alone does not prove an accurate business report or visual interpretation; each actual task needs its own evidence.']};
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
   return actionBatch(validateActions(args.actions),async()=>{
    if(company)await guard.inspect({requireActive:true});
    await requirePage(p.label);
   },a=>act(p,a),()=>observe(p));
  }
  throw Error('Unknown browser tool');
 };
 const token=crypto.randomBytes(32).toString('hex');let finish,busy=false,pending=0;
 const stopped=new Promise(resolve=>{finish=resolve;});let lastContact=Date.now();
 server=http.createServer(async(req,res)=>{
  if(req.headers.authorization!=='Bearer '+token||req.method!=='POST'){res.writeHead(403);res.end();return;}
  lastContact=Date.now();
  let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>65536){res.writeHead(413);res.end();return;}}
  let parsed;try{parsed=JSON.parse(raw);}catch{res.writeHead(400);res.end();return;}
  if(parsed.name==='__health'||parsed.name==='__ping'){
   res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({alive:true,busy,pending}));return;
  }
  if(parsed.name==='__stop'&&(busy||pending)){
   res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({error:'EGO_RECOVERY_IN_FLIGHT',code:'EGO_RECOVERY_IN_FLIGHT'}));return;
  }
  pending++;
  const job=async()=>{
   pending--;busy=true;
   try{
    const {name,args}=parsed;
    if(name==='__ping')return {alive:true};
    if(name==='__stop'){setTimeout(finish,30);return {stopping:true};}
    const result=await execute(name,args);await record({tool:name,ok:!result.error,...(result.error?{errorCode:result.code}:{}),resultSha256:crypto.createHash('sha256').update(JSON.stringify(result)).digest('hex')});return result;
   }catch(e){await record({kind:'tool_error',errorCode:e.error_code||'EGO_OPERATION_FAILED'});return {error:String(e.message||e),code:e.error_code||'EGO_OPERATION_FAILED',outcome:'unknown; no automatic retry'};}
   finally{busy=false;}
  };
  const result=tail.then(job,job);tail=result.catch(()=>{});
  res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(await result));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 await fs.writeFile(path.join(path.dirname(runtimeFile),'worker-private.json'),JSON.stringify({port:server.address().port,token,spaceId:cfg.spaceId,pid:process.pid,ownerNonce:ownerLock?.nonce}));
 console.log(JSON.stringify({workerReady:true,driver:'ego-native',spaceId:cfg.spaceId}));
 startupComplete=true;watchdog=setInterval(()=>{if(Date.now()-lastContact>30000)finish();},5000);
 await stopped;
 }catch(e){
  if(!startupComplete){
   const raw=String(e.error_code||e.code||String(e).match(/EGO_[A-Z_]+/)?.[0]||'EGO_NATIVE_INITIALIZATION_FAILED');
   const code=/^EGO_[A-Z_]+$/.test(raw)?raw:'EGO_NATIVE_INITIALIZATION_FAILED';
   await fs.writeFile(path.join(path.dirname(runtimeFile),'worker-startup-error.json'),JSON.stringify({ownerNonce:ownerLock?.nonce,code,phase,detail:String(e.message||e).slice(0,500)})).catch(()=>{});
   await record({kind:'worker_startup_failed',code,phase}).catch(()=>{});
  }
  throw e;
 }finally{
  clearInterval(watchdog);await tail.catch(()=>{});
  if(guard&&!yielded)await guard.close([...pages.values()]).catch(()=>{});
  if(server?.listening){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  await record({kind:'worker_stopped',finishedSpace:false}).catch(()=>{});
  if(ownerLock)await releaseOwnedLease(ownerLock.file,ownerLock.nonce);
 }
}
