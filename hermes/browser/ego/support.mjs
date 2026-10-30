import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import net from 'node:net';

export async function workerCall(endpoint,name,args,fetcher=fetch){
 try{
  const r=await fetcher('http://127.0.0.1:'+endpoint.port+'/tool',{method:'POST',headers:{authorization:'Bearer '+endpoint.token,'content-type':'application/json'},body:JSON.stringify({name,args}),signal:AbortSignal.timeout(45000)});
  if(!r.ok)throw Error('Native worker transport failed');return await r.json();
 }catch(e){throw Object.assign(Error(String(e.message||e)),{code:'EGO_TRANSPORT_FAILED',mayHaveLateEffects:true});}
}

export function helper(cfg,runtime,op,args={}){
 return new Promise((resolve,reject)=>{
  const p=spawn(cfg.employeeSupport.python,['-I','-B',path.join(cfg.toolRoot,'company_support.py'),runtime],{windowsHide:true,stdio:['pipe','pipe','pipe'],env:{...process.env,PYTHONIOENCODING:'utf-8'}});
  let raw='',overflow=false;
  const timeout=setTimeout(()=>{p.kill();reject(Error('EGO_SUPPORT_TIMEOUT'));},10000);timeout.unref();
  p.stdout.on('data',b=>{raw+=b;if(raw.length>150000){overflow=true;p.kill();}});p.stderr.on('data',()=>{});
  p.once('error',e=>{clearTimeout(timeout);reject(e);});
  p.once('exit',()=>{clearTimeout(timeout);try{if(overflow)throw Error('Oversized support result');const r=JSON.parse(raw);if(!r.ok)throw Error(r.detail||r.error);resolve(r.result);}catch(e){reject(e);}});
  p.stdin.on('error',()=>{});p.stdin.end(JSON.stringify({op,args}));
 });
}
export async function verifySupport(cfg){
 const s=cfg.employeeSupport,names=['company_support.py','company_tasks.py','ego_lease.py','safety.py'];
 if(s?.schema!=='lingju.employee-support.v1'||!s.approvalReference||s.ownerApproved!==true||s.taskDatabase!==path.join(cfg.toolRoot,'private-state','company-tasks.sqlite')||!s.python||Object.keys(s.sourceSha256||{}).sort().join()!==names.sort().join())throw Error('EGO_SUPPORT_GRANT_INVALID');
 for(const name of names)if(crypto.createHash('sha256').update(await fs.readFile(path.join(cfg.toolRoot,name))).digest('hex')!==s.sourceSha256[name])throw Error('EGO_SUPPORT_SOURCE_CHANGED');
}
export async function boundedRecovery(action,io){
 if(action==='release_dead_lease')return io.releaseDead();
 if(action==='reconnect'&&io.hasEndpoint()){
  const health=await io.health(); // Must fail closed when outcome/ownership unknown.
  if(health.busy||health.pending)throw Error('EGO_RECOVERY_IN_FLIGHT: action may still be running; no restart or business replay');
  await io.stop();
 }
 await io.releaseDead();
 await io.connect();return {recovered:true,businessActionReplayed:false};
}
export async function releaseDeadOwned(file,privateFile,nonce){
 if(!nonce)return false;
 let raw,lease,worker;
 try{raw=await fs.readFile(file,'utf8');lease=JSON.parse(raw);worker=JSON.parse(await fs.readFile(privateFile,'utf8'));}catch(e){if(e.code==='ENOENT')return false;throw e;}
 if(lease.nonce!==nonce||lease.pid!==process.pid||worker.ownerNonce!==nonce||!Number.isSafeInteger(worker.pid)||worker.pid<1||!Number.isInteger(worker.port)||worker.port<1||worker.port>65535)return false;
 try{process.kill(worker.pid,0);return false;}catch(e){if(e.code!=='ESRCH')return false;}
 const refused=await new Promise(resolve=>{const s=net.createConnection({host:'127.0.0.1',port:worker.port});s.setTimeout(400);s.once('connect',()=>{s.destroy();resolve(false);});s.once('timeout',()=>{s.destroy();resolve(false);});s.once('error',e=>{s.destroy();resolve(e.code==='ECONNREFUSED');});});
 if(!refused||await fs.readFile(file,'utf8')!==raw)return false;
 // Only this bridge can own this nonce; the dead native worker cannot be
 // in flight. A live foreign lease is never released by this path.
 await fs.unlink(file);return true;
}
export async function diagnostics(cfg,runtime,endpoint){
 let lease;try{lease=JSON.parse(await fs.readFile(path.join(cfg.toolRoot,'ego','active-worker.lock'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 let ownerAlive=false;if(lease?.pid)try{process.kill(lease.pid,0);ownerAlive=true;}catch{}
 let health=null;if(endpoint)try{const r=await fetch('http://127.0.0.1:'+endpoint.port+'/tool',{method:'POST',headers:{authorization:'Bearer '+endpoint.token},body:JSON.stringify({name:'__health',args:{}}),signal:AbortSignal.timeout(1500)});if(r.ok)health=await r.json();}catch{}
 return {runtimeOwned:true,leasePresent:!!lease,leaseSameRuntime:lease?.runtime===runtime,leaseOwnerAlive:ownerAlive,
  endpointReachable:!!health,workerBusy:health?.busy??null,queuedOperations:health?.pending??null,
  next:ownerAlive&&!endpoint?'A live lease may belong to another native client; no takeover.':'Use bounded recovery for an idle owned connection. Owner handles login/user-control/extension permission.',
  pageContentRead:false,businessActionDispatched:false};
}
