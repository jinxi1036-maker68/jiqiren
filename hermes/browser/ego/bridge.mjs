// Browser-only MCP facade. The native worker owns Ego; Hermes owns decisions.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {tools,validateConfig,validateToolCall,workplaceState,guide,VERSION,isCompany,authority} from './policy.mjs';
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
const expectedSources=['bridge.mjs','worker.mjs','policy.mjs','native_guard.mjs','lifecycle.mjs',...(isCompany(cfg)?['extension_guard.mjs','table_readback.mjs','workplace.mjs']:[])];
for(const [name,sha] of Object.entries(cfg.sourceSha256||{})){
 if(!expectedSources.includes(name)||await digest(path.join(egoRoot,name))!==sha)throw Error('Adapter bytes changed');
}
if(Object.keys(cfg.sourceSha256||{}).length!==expectedSources.length)throw Error('Complete adapter version required');
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
 const response=await fetch('http://127.0.0.1:'+endpoint.port+'/tool',{method:'POST',headers:{authorization:'Bearer '+endpoint.token,'content-type':'application/json'},body:JSON.stringify({name,args}),signal:AbortSignal.timeout(45000)});
 if(!response.ok)throw Error('Native worker transport failed');return response.json();
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
const server=new Server({name:'lingju-ego-company-browser',version:VERSION},{capabilities:{tools:{}}});
server.setRequestHandler(ListToolsRequestSchema,async()=>({tools}));
let tail=Promise.resolve();
server.setRequestHandler(CallToolRequestSchema,async request=>{
 const work=async()=>{
  const name=request.params.name,args=request.params.arguments||{};
  if(!tools.some(t=>t.name===name))return invalidInputResult('Unknown Ego browser tool');
  try{validateToolCall(name,args);}catch(e){return invalidInputResult(e.message);}
  try{
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
   if(/^EGO_(WORKPLACE|COMPANY_PROFILE|USER_CONTROL|OWNER_LOGIN|EXTENSION|ACTUAL_PROFILE|PROFILE|SCOPE)/.test(e.code||''))return operationResult({error:e.message,code:e.code,startupPhase:e.startupPhase,outcome:'no business action dispatched; respect user control and login/extension boundaries'});
   return {isError:true,content:[{type:'text',text:JSON.stringify({driver:'ego-native',mode:cfg.mode,error:e.code||'EGO_UNAVAILABLE',startupPhase:e.startupPhase,detail:String(e.message),outcome:'unknown; no automatic action retry, takeover or alternate driver'})}]};
  }
 };
 const result=tail.then(work,work);tail=result.catch(()=>{});return result;
});
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
