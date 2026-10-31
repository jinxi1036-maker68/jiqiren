import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
import {run} from '../ego/worker.mjs';import {operationResult} from '../ego/lifecycle.mjs';
async function fixture(body){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'lingju-worker-contract-')),runtime=path.join(dir,'runtime.json'),lock=path.join(dir,'lock');
 const oldTask=globalThis.taskSpace,oldEgo=globalThis.ego;let saveCount=0,failRead=false;const observations=[];
 const cfg={schema:'lingju.ego-browser.v1',mode:'synthetic',productionEnabled:false,origin:'http://127.0.0.1:12345',spaceId:1,
  cliVersion:'0.6.1.13',cliSha256:'a'.repeat(64),guideSha256:'b'.repeat(64),approvalReference:'synthetic protocol test',home:'H',workspace:'W'};
 const page={label:'p1',url:async()=>cfg.origin+'/synthetic',cdp:async()=>({}),
  click:async()=>{saveCount++;return {dispatched:true};},snapshot:async options=>{
   observations.push(options);
   if(failRead==='subtree'&&options.scope==='subtree')throw Error('Subtree root no longer exists');
   if(failRead==='control')throw Object.assign(Error('EGO_USER_CONTROL'),{code:'EGO_USER_CONTROL'});
   if(failRead===true)throw Error('synthetic observation failed');return 'synthetic current snapshot';}};
 globalThis.taskSpace=async()=>({page:()=>page});globalThis.ego={sendCDPMessage:()=>{},onCDPMessage:()=>{}};
 await fs.writeFile(runtime,JSON.stringify(cfg));await fs.writeFile(lock,JSON.stringify({nonce:'synthetic-owner'}));
 const running=run(runtime,{file:lock,nonce:'synthetic-owner'});let endpoint;
 try{
  for(let i=0;i<200;i++){
   try{endpoint=JSON.parse(await fs.readFile(path.join(dir,'worker-private.json'),'utf8'));break;}catch(e){if(e.code!=='ENOENT')throw e;}
   await new Promise(r=>setTimeout(r,5));
  }
  assert(endpoint);
  const call=async(name,args={})=>{const r=await fetch('http://127.0.0.1:'+endpoint.port+'/tool',{method:'POST',headers:{authorization:'Bearer '+endpoint.token},body:JSON.stringify({name,args})});return r.json();};
  await body({call,get saves(){return saveCount;},observations,failRead(value){failRead=value;}});
  await call('__stop');await running;
 }finally{
  if(endpoint)await fetch('http://127.0.0.1:'+endpoint.port+'/tool',{method:'POST',headers:{authorization:'Bearer '+endpoint.token},body:JSON.stringify({name:'__stop',args:{}})}).catch(()=>{});
  await running.catch(()=>{});globalThis.taskSpace=oldTask;globalThis.ego=oldEgo;
  const resolved=await fs.realpath(dir);assert.equal(path.dirname(resolved),await fs.realpath(os.tmpdir()));assert(path.basename(resolved).startsWith('lingju-worker-contract-'));assert(!(await fs.lstat(dir)).isSymbolicLink());await fs.rm(resolved,{recursive:true,force:true});
 }
}
test('actual worker page listing returns the object envelope expected by the live MCP bridge',async()=>fixture(async f=>{
 const r=await f.call('ego_browser_pages',{action:'list'});assert.equal(r.count,1);assert.equal(r.pages[0].page,'p1');
 const mcp=operationResult(r);assert.equal(mcp.isError,false);assert(JSON.parse(mcp.content[0].text).operationSucceeded);assert.equal(f.saves,0);
}));

test('action default keeps full-page refs and avoids duplicate table formatting',async()=>fixture(async f=>{
 const r=await f.call('ego_browser_actions',{actions:[{type:'click',selector:'@1'},{type:'click',selector:'@2'}]});
 assert.equal(f.saves,2);assert.equal(r.receipts.length,2);assert.equal(r.observation.scope,'full_page');
 assert.equal(r.observation.format,'snapshot');assert.equal(r.table_readback,undefined);assert.match(r.snapshot,/current/);
}));

test('vanished dialog subtree falls back to a full-page read without replaying actions',async()=>fixture(async f=>{
 f.failRead('subtree');const r=await f.call('ego_browser_actions',{actions:[{type:'click',selector:'@1'}],observation:{scope:'subtree',root:'@5',format:'snapshot'}});
 assert.equal(f.saves,1);assert.equal(r.receipts.length,1);assert.equal(r.observation.scope,'full_page');assert.match(r.observationFallback,/no action replay/);
 assert.deepEqual(f.observations.map(x=>x.scope),['subtree','full_page']);
}));

test('local observation validation and user takeover never permit extra retries',async()=>fixture(async f=>{
 const invalid=await f.call('ego_browser_actions',{actions:[{type:'click',selector:'@1'}],observation:{scope:'subtree'}});
 assert(invalid.error);assert.equal(f.saves,0);
 f.failRead('control');const r=await f.call('ego_browser_actions',{actions:[{type:'click',selector:'@1'}],observation:{scope:'subtree',root:'@5'}});
 assert.equal(r.code,'EGO_USER_CONTROL');assert.equal(f.saves,1);assert.equal(f.observations.length,1);
 assert.equal(r.savedBusinessState,'unverified');
}));
test('actual worker preserves a dispatched save when only verification fails',async()=>fixture(async f=>{
 f.failRead(true);const r=await f.call('ego_browser_actions',{actions:[{type:'click',selector:'@1'}]});
 assert.equal(r.code,'EGO_VERIFICATION_READ_FAILED');assert.equal(r.receipts.length,1);assert.equal(r.all_actions_dispatched,true);assert.equal(f.saves,1);
 assert.equal(operationResult(r).structuredContent.operationSucceeded,false);
 f.failRead(false);const observed=await f.call('ego_browser_observe',{});assert.match(observed.snapshot,/current/);assert.equal(f.saves,1);
}));
