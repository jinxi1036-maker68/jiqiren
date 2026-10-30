// Browser-only MCP facade. The native worker owns Ego; Hermes owns decisions.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {toolsFor,supportEnabled,validateConfig,validateToolCall,workplaceState,guide,VERSION,isCompany,authority} from './policy.mjs';
import {helper,verifySupport,boundedRecovery,diagnostics,releaseDeadOwned,workerCall} from './support.mjs';
import {attachScreenshot} from '../image_result.mjs';
import {singleFlight,releaseStoppedStart,operationResult,invalidInputResult,startupFailure} from './lifecycle.mjs';
const egoRoot=path.dirname(fileURLToPath(import.meta.url)),root=path.dirname(egoRoot);
if(root!==path.join(os.homedir(),'.hermes','tools','company-browser'))throw Error('Original owned tool root required');
const runtimeFile=path.resolve(process.argv[2]);
if(!runtimeFile.startsWith(path.join(root,'runs')+path.sep))throw Error('Owned runtime required');
const cfg=validateConfig(JSON.parse(await fs.readFile(runtimeFile,'utf8')));
if(cfg.toolRoot!==root||cfg.home!==path.join(os.homedir(),'.hermes')||cfg.workspace!==path.join(cfg.home,'company-workspace'))throw Error('Original identity/workspace required');
const digest=async file=>crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex');
if(await digest(cfg.cli)!==cfg.cliSha256||await digest(cfg.officialGuide)!==cfg.guideSha256)throw Error('Vendor bytes changed');
const expectedSources=['bridge.mjs','worker.mjs','policy.mjs','native_guard.mjs','lifecycle.mjs','support.mjs',...(isCompany(cfg)?['extension_guard.mjs','table_readback.mjs','workplace.mjs']:[])];
for(const [name,sha] of Object.entries(cfg.sourceSha256||{})){
 if(!expectedSources.includes(name)||await digest(path.join(egoRoot,name))!==sha)throw Error('Adapter bytes changed');
}
if(Object.keys(cfg.sourceSha256||{}).length!==expectedSources.length)throw Error('Complete adapter version required');
const tools=toolsFor(cfg);if(supportEnabled(cfg))await verifySupport(cfg);
const checkExtensionPayload=isCompany(cfg)?(await import('./extension_guard.mjs')).checkExtensionPayload:null;
if(checkExtensionPayload)await checkExtensionPayload(cfg);
const req=createRequire(path.join(root,'package.json'));
const sdk=await fs.realpath(path.join(root,'node_modules','@modelcontextprotocol','sdk'));
if(JSON.parse(await fs.readFile(path.join(sdk,'package.json'),'utf8')).version!=='1.30.0')throw Error('Pinned SDK required');
const load=p=>req(path.join(sdk,'dist','cjs',p));
const {Server}=load('server/index.js'),{StdioServerTransport}=load('server/stdio.js'),{ListToolsRequestSchema,CallToolRequestSchema}=load('types.js');
const run=path.dirname(runtimeFile),privateFile=path.join(run,'worker-private.json'),lockFile=path.join(egoRoot,'active-worker.lock');
let child,endpoint,lockNonce,heartbeat,closing=false;
async function callWorker(name,args){
 return workerCall(endpoint,name,args);
}
const startWorker=singleFlight(async()=>{
 try{
  lockNonce=crypto.randomBytes(20).toString('hex');
  const lock=await fs.open(lockFile,'wx').catch(e=>{if(e.code==='EEXIST')throw Error('EGO_BUSY: another channel or a stale worker lock exists; no silent takeover');throw e;});
  await lock.writeFile(JSON.stringify({pid:process.pid,nonce:lockNonce,runtime:runtimeFile}));await lock.close();
  child=undefined;
  await fs.unlink(privateFile).catch(e=>{if(e.code!=='ENOENT')throw e;});
  const boot=path.join(run,'boot-'+crypto.randomUUID()+'.mjs');
  await fs.writeFile(boot,'import {run} from '+JSON.stringify(pathToFileURL(path.join(egoRoot,'worker.mjs')).href)+';\nawait run('+JSON.stringify(runtimeFile)+','+JSON.stringify({file:lockFile,nonce:lockNonce})+');\n',{flag:'wx'});
  child=spawn(cfg.cli,['nodejs','-e',"await import('"+pathToFileURL(boot).href+"')"],{windowsHide:true,stdio:['ignore','pipe','pipe']});
  const startedChild=child;
  startedChild.once('exit',()=>{
   if(child!==startedChild)return;
   endpoint=undefined;clearInterval(heartbeat);
   // Clear the dead connection cache only. The native worker owns normal
   // lease release; a CLI exit alone does not prove that worker has died.
  });
  let failure;child.on('error',e=>{failure=e;});child.stdout.on('data',()=>{});child.stderr.on('data',()=>{});
  for(let i=0;i<300;i++){
   if(failure||child.exitCode!==null)throw await startupFailure(path.join(run,'worker-startup-error.json'),lockNonce)||Object.assign(Error('Native Ego process failed before a matching startup receipt'),{code:'EGO_NATIVE_PROCESS_START_FAILED'});
   try{endpoint=JSON.parse(await fs.readFile(privateFile,'utf8'));break;}catch(e){if(e.code!=='ENOENT')throw e;}
   await new Promise(resolve=>setTimeout(resolve,100));
  }
  if(!endpoint||!Number.isInteger(endpoint.port)||!/^[a-f0-9]{64}$/.test(endpoint.token)||endpoint.ownerNonce!==lockNonce)throw await startupFailure(path.join(run,'worker-startup-error.json'),lockNonce)||Object.assign(Error('Native Ego handshake missing or not owned by this start'),{code:'EGO_NATIVE_HANDSHAKE_FAILED'});
  heartbeat=setInterval(()=>{void callWorker('__ping',{}).catch(()=>{});},5000);heartbeat.unref();
 }catch(e){
  endpoint=undefined;clearInterval(heartbeat);
  await releaseStoppedStart(lockFile,lockNonce,child).catch(()=>{});
  throw e;
 }
});
async function ensureWorker(){
 if(endpoint)return;
 return startWorker();
}
async function recover(action){
 return boundedRecovery(action,{
  hasEndpoint:()=>!!endpoint,health:()=>callWorker('__health',{}),
  releaseDead:async()=>{
   const owned=await releaseDeadOwned(lockFile,privateFile,lockNonce);
   if(owned){endpoint=undefined;clearInterval(heartbeat);}
   return {releasedOwnedDeadWorker:owned,...await helper(cfg,runtimeFile,'lease')};
  },
  connect:async()=>{await ensureWorker();await callWorker('__health',{});},
  stop:async()=>{
   const r=await callWorker('__stop',{});if(r.error)throw Error(r.code);
   clearInterval(heartbeat);const p=child;
   if(p&&p.exitCode===null)await Promise.race([new Promise(resolve=>p.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,8000))]);
   try{const lease=JSON.parse(await fs.readFile(lockFile,'utf8'));if(lease.nonce===lockNonce)throw Error('EGO_RECOVERY_NOT_STOPPED: waiting for owned worker; no force kill');}catch(e){if(e.code!=='ENOENT')throw e;}
   endpoint=undefined;
  }
 });
}
const server=new Server({name:'lingju-ego-company-browser',version:VERSION},{capabilities:{tools:{}}});
server.setRequestHandler(ListToolsRequestSchema,async()=>({tools}));
let tail=Promise.resolve();
server.setRequestHandler(CallToolRequestSchema,async request=>{
 const work=async()=>{
  const name=request.params.name,args=request.params.arguments||{};
  if(!tools.some(t=>t.name===name))return invalidInputResult('Unknown Ego browser tool');
  try{validateToolCall(name,args);}catch(e){return invalidInputResult(e.message);}
  try{
   if(supportEnabled(cfg)){
    if(name==='ego_browser_diagnostics')return operationResult(await diagnostics(cfg,runtimeFile,endpoint));
    if(name==='ego_browser_recover')return operationResult(await recover(args.action));
    if(name==='company_task_notes'||name==='company_knowledge')return operationResult(await helper(cfg,runtimeFile,name==='company_knowledge'?'knowledge':'notes',args));
   }
   if(isCompany(cfg)){
    await checkExtensionPayload(cfg);
    const state=workplaceState(JSON.parse(await fs.readFile(cfg.stateFile,'utf8')));
    if(name==='ego_browser_guide')return {content:[{type:'text',text:JSON.stringify({mode:cfg.mode,authority:authority(cfg),topic:args.topic||'overview',text:args.topic==='official'?await fs.readFile(cfg.officialGuide,'utf8'):guide[args.topic||'overview']})}]};
    if(!state.ready){
     const result={driver:'ego-native',mode:cfg.mode,...state,spaceId:cfg.spaceId,profileId:cfg.profileId,businessWritesEnabled:false,configuredAuthority:authority(cfg),pageContentRead:false,liveGuardChecked:false,next:'Owner completes manual login in company Ego, then confirms to Codex; no automatic reclaim, alternate driver or model test.'};
     return {isError:name!=='ego_browser_status',content:[{type:'text',text:JSON.stringify(result)}]};
    }
   }
   await ensureWorker();const result=await callWorker(name,args);
   let response=operationResult(result);
   if(result.screenshot)response=await attachScreenshot(response,{filename:result.screenshot},path.join(run,'output'));
   return response;
  }catch(e){
   if(['ego_browser_recover','ego_browser_diagnostics','company_task_notes','company_knowledge'].includes(name))return operationResult({error:String(e.message),code:e.code||String(e.message).match(/EGO_[A-Z_]+/)?.[0]||'EGO_SUPPORT_FAILED',businessActionDispatched:false});
   if(/^EGO_(WORKPLACE|COMPANY_PROFILE|USER_CONTROL|OWNER_LOGIN|EXTENSION|ACTUAL_PROFILE|PROFILE|SCOPE)/.test(e.code||''))return operationResult({error:e.message,code:e.code,startupPhase:e.startupPhase,outcome:'no business action dispatched; respect user control and login/extension boundaries'});
   // The MCP bridge is demonstrably alive if it can return this receipt.
   // A broken native worker must not hide diagnostics/recovery behind the
   // Hermes MCP-server-wide circuit breaker. A dead bridge still fails RPC.
   return operationResult({driver:'ego-native',mode:cfg.mode,error:String(e.message),code:e.code||'EGO_UNAVAILABLE',startupPhase:e.startupPhase,
     nativeWorkerConnected:false,failureScope:'browser_connection',outcome:'unknown; no business action replay, takeover or alternate driver'});
  }
 };
 const recorded=async()=>{
  const response=await work();
  if(supportEnabled(cfg)&&nameForReceipt(request.params.name)){
   let parsed=response.structuredContent;try{parsed??=JSON.parse(response.content?.find(c=>c.type==='text')?.text||'{}');}catch{parsed={};}
   const receipt=crypto.randomUUID(),ok=!response.isError&&!parsed.error&&parsed.operationSucceeded!==false;
   const code=parsed.code||parsed.error||(ok?null:'EGO_UNAVAILABLE');
   try{
    const taskReceipt=await helper(cfg,runtimeFile,'event',{tool:request.params.name,ok,code,receipt,digest:crypto.createHash('sha256').update(JSON.stringify(parsed)).digest('hex')});
    response.content.push({type:'text',text:JSON.stringify({taskReceipt})});
   }catch(e){response.content.push({type:'text',text:JSON.stringify({taskJournalRecorded:false,error:String(e.message),automaticContinuationAvailable:false})});}
  }
  return response;
 };
 const result=tail.then(recorded,recorded);tail=result.catch(()=>{});return result;
});
function nameForReceipt(n){return ['ego_browser_actions','ego_browser_observe','ego_browser_pages','ego_browser_screenshot','ego_browser_status','ego_browser_recover'].includes(n);}
await server.connect(new StdioServerTransport());
async function close(){
 if(closing)return;closing=true;clearInterval(heartbeat);await tail;
 if(endpoint)await callWorker('__stop',{}).catch(()=>{});
 if(child&&child.exitCode===null)await Promise.race([new Promise(resolve=>child.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,7000))]);
 // No kill of browser/other services. Worker heartbeat timeout releases itself.
 if(lockNonce)await releaseStoppedStart(lockFile,lockNonce,child).catch(()=>{});
 await server.close().catch(()=>{});process.exit(0);
}
process.stdin.on('end',close);process.on('SIGTERM',close);process.on('SIGINT',close);
