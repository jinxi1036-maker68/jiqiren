// Browser-only MCP facade. The native worker owns Ego; Hermes owns decisions.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {tools,validateConfig,validateToolCall,workplaceState,guide,VERSION} from './policy.mjs';
import {attachScreenshot} from '../image_result.mjs';
const egoRoot=path.dirname(fileURLToPath(import.meta.url)),root=path.dirname(egoRoot);
if(root!==path.join(os.homedir(),'.hermes','tools','company-browser'))throw Error('Original owned tool root required');
const runtimeFile=path.resolve(process.argv[2]);
if(!runtimeFile.startsWith(path.join(root,'runs')+path.sep))throw Error('Owned runtime required');
const cfg=validateConfig(JSON.parse(await fs.readFile(runtimeFile,'utf8')));
if(cfg.toolRoot!==root||cfg.home!==path.join(os.homedir(),'.hermes')||cfg.workspace!==path.join(cfg.home,'company-workspace'))throw Error('Original identity/workspace required');
const digest=async file=>crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex');
if(await digest(cfg.cli)!==cfg.cliSha256||await digest(cfg.officialGuide)!==cfg.guideSha256)throw Error('Vendor bytes changed');
const expectedSources=['bridge.mjs','worker.mjs','policy.mjs','native_guard.mjs',...(cfg.mode==='company-readonly'?['extension_guard.mjs','table_readback.mjs']:[])];
for(const [name,sha] of Object.entries(cfg.sourceSha256||{})){
 if(!expectedSources.includes(name)||await digest(path.join(egoRoot,name))!==sha)throw Error('Adapter bytes changed');
}
if(Object.keys(cfg.sourceSha256||{}).length!==expectedSources.length)throw Error('Complete adapter version required');
const checkExtensionPayload=cfg.mode==='company-readonly'?(await import('./extension_guard.mjs')).checkExtensionPayload:null;
if(checkExtensionPayload)await checkExtensionPayload(cfg);
const req=createRequire(path.join(root,'package.json'));
const sdk=await fs.realpath(path.join(root,'node_modules','@modelcontextprotocol','sdk'));
if(JSON.parse(await fs.readFile(path.join(sdk,'package.json'),'utf8')).version!=='1.30.0')throw Error('Pinned SDK required');
const load=p=>req(path.join(sdk,'dist','cjs',p));
const {Server}=load('server/index.js'),{StdioServerTransport}=load('server/stdio.js'),{ListToolsRequestSchema,CallToolRequestSchema}=load('types.js');
const run=path.dirname(runtimeFile),privateFile=path.join(run,'worker-private.json'),lockFile=path.join(egoRoot,'active-worker.lock');
let child,endpoint,lockNonce,heartbeat,starting,closing=false;
async function callWorker(name,args){
 const response=await fetch('http://127.0.0.1:'+endpoint.port+'/tool',{method:'POST',headers:{authorization:'Bearer '+endpoint.token,'content-type':'application/json'},body:JSON.stringify({name,args}),signal:AbortSignal.timeout(45000)});
 if(!response.ok)throw Error('Native worker transport failed');return response.json();
}
async function ensureWorker(){
 if(endpoint)return;
 if(starting)return starting;
 starting=(async()=>{
  lockNonce=crypto.randomBytes(20).toString('hex');
  const lock=await fs.open(lockFile,'wx').catch(()=>{throw Error('EGO_BUSY: another channel or a stale worker lock exists; no silent takeover');});
  await lock.writeFile(JSON.stringify({pid:process.pid,nonce:lockNonce,runtime:runtimeFile}));await lock.close();
  await fs.unlink(privateFile).catch(e=>{if(e.code!=='ENOENT')throw e;});
  const boot=path.join(run,'boot-'+crypto.randomUUID()+'.mjs');
  await fs.writeFile(boot,'import {run} from '+JSON.stringify(pathToFileURL(path.join(egoRoot,'worker.mjs')).href)+';\nawait run('+JSON.stringify(runtimeFile)+','+JSON.stringify({file:lockFile,nonce:lockNonce})+');\n',{flag:'wx'});
  child=spawn(cfg.cli,['nodejs','-e',"await import('"+pathToFileURL(boot).href+"')"],{windowsHide:true,stdio:['ignore','pipe','pipe']});
  let failure;child.on('error',e=>{failure=e;});child.stdout.on('data',()=>{});child.stderr.on('data',()=>{});
  for(let i=0;i<100;i++){
   if(failure||child.exitCode!==null)throw Error('Native Ego worker could not start');
   try{endpoint=JSON.parse(await fs.readFile(privateFile,'utf8'));break;}catch(e){if(e.code!=='ENOENT')throw e;}
   await new Promise(resolve=>setTimeout(resolve,100));
  }
  if(!endpoint||!Number.isInteger(endpoint.port)||!/^[a-f0-9]{64}$/.test(endpoint.token))throw Error('Native Ego handshake missing');
  heartbeat=setInterval(()=>{void callWorker('__ping',{}).catch(()=>{});},5000);heartbeat.unref();
 })();
 return starting;
}
const server=new Server({name:'lingju-ego-company-browser',version:VERSION},{capabilities:{tools:{}}});
server.setRequestHandler(ListToolsRequestSchema,async()=>({tools}));
let tail=Promise.resolve();
server.setRequestHandler(CallToolRequestSchema,async request=>{
 const work=async()=>{
  const name=request.params.name,args=request.params.arguments||{};
  if(!tools.some(t=>t.name===name))return {isError:true,content:[{type:'text',text:'Unknown Ego browser tool'}]};
  try{
   validateToolCall(name,args);
   if(cfg.mode==='company-readonly'){
    await checkExtensionPayload(cfg);
    const state=workplaceState(JSON.parse(await fs.readFile(cfg.stateFile,'utf8')));
    if(name==='ego_browser_guide')return {content:[{type:'text',text:JSON.stringify({topic:args.topic||'overview',text:args.topic==='official'?await fs.readFile(cfg.officialGuide,'utf8'):guide[args.topic||'overview']})}]};
    if(!state.ready){
     const result={driver:'ego-native',mode:cfg.mode,...state,spaceId:cfg.spaceId,profileId:cfg.profileId,businessWritesEnabled:false,pageContentRead:false,liveGuardChecked:false,next:'Owner completes manual login in company Ego, then confirms to Codex; no automatic reclaim, alternate driver or model test.'};
     return {isError:name!=='ego_browser_status',content:[{type:'text',text:JSON.stringify(result)}]};
    }
   }
   await ensureWorker();const result=await callWorker(name,args);
   let response={isError:!!result.error,content:[{type:'text',text:JSON.stringify(result)}]};
   if(result.screenshot)response=await attachScreenshot(response,{filename:result.screenshot},path.join(run,'output'));
   return response;
  }catch(e){return {isError:true,content:[{type:'text',text:'EGO_UNAVAILABLE: '+String(e.message)+'; outcome unknown, no automatic retry or alternate driver.'}]};}
 };
 const result=tail.then(work,work);tail=result.catch(()=>{});return result;
});
await server.connect(new StdioServerTransport());
async function close(){
 if(closing)return;closing=true;clearInterval(heartbeat);await tail;
 if(endpoint)await callWorker('__stop',{}).catch(()=>{});
 if(child&&child.exitCode===null)await Promise.race([new Promise(resolve=>child.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,7000))]);
 // No kill of browser/other services. Worker heartbeat timeout releases itself.
 if(lockNonce){const lock=JSON.parse(await fs.readFile(lockFile,'utf8').catch(()=>'{}'));if(lock.nonce===lockNonce)await fs.unlink(lockFile);}
 await server.close().catch(()=>{});process.exit(0);
}
process.stdin.on('end',close);process.on('SIGTERM',close);process.on('SIGINT',close);
