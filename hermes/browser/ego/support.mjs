import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';

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
  let health;
  try{health=await io.health();}catch(error){
   // A timeout is not death evidence. Only the fixed local helper can prove
   // this caller owns the lease AND its native worker died with no listener.
   const proof=await io.releaseDead?.();
   if(!proof?.released_proven_dead_lease)throw error;
   await io.connect();return {recovered:true,provenDeadWorkerReleased:true,businessActionReplayed:false};
  }
  if(health.busy||health.pending)throw Error('EGO_RECOVERY_IN_FLIGHT: action may still be running; no restart or business replay');
  await io.stop();
 }
 await io.releaseDead();
 await io.connect();return {recovered:true,businessActionReplayed:false};
}
export async function diagnostics(cfg,runtime,endpoint,nonce){
 let lease;try{lease=JSON.parse(await fs.readFile(path.join(cfg.toolRoot,'ego','active-worker.lock'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 let ownerAlive=false;if(lease?.pid)try{process.kill(lease.pid,0);ownerAlive=true;}catch{}
 let worker;try{worker=JSON.parse(await fs.readFile(path.join(path.dirname(runtime),'worker-private.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 const matches=!!(lease&&worker&&worker.ownerNonce===lease.nonce);
 let workerAlive=null;if(matches&&Number.isSafeInteger(worker.pid)&&worker.pid>0){try{process.kill(worker.pid,0);workerAlive=true;}catch(e){if(e.code==='ESRCH')workerAlive=false;}}
 const ours=!!(lease&&nonce&&lease.pid===process.pid&&lease.nonce===nonce&&lease.runtime===runtime);
 let vendorPresent=true;try{await fs.access(cfg.cli);}catch{vendorPresent=false;}
 let health=null;if(endpoint)try{const r=await fetch('http://127.0.0.1:'+endpoint.port+'/tool',{method:'POST',headers:{authorization:'Bearer '+endpoint.token},body:JSON.stringify({name:'__health',args:{}}),signal:AbortSignal.timeout(1500)});if(r.ok)health=await r.json();}catch{}
 return {runtimeOwned:true,leasePresent:!!lease,leaseSameRuntime:lease?.runtime===runtime,leaseOwnerAlive:ownerAlive,
  leaseOwnedByThisBridge:ours,workerMetadataMatchesLease:matches,
  workerServiceProcessAlive:workerAlive,nativeWorkerAlive:health?true:workerAlive===false?false:null,
  servicePIDAloneDoesNotProveWorkerLiveness:true,
  vendorExecutablePresent:vendorPresent,endpointChecked:!!endpoint,endpointReachable:endpoint?!!health:null,workerBusy:health?.busy??null,queuedOperations:health?.pending??null,
  next:!vendorPresent?'Pinned Ego executable is missing; technical vendor binding repair is required. Do not ask Owner to close ordinary web pages.'
   :ours&&workerAlive===false?'Our bridge is alive but its native worker died. Use bounded recovery; exact ownership, worker death and closed-port proof are required. No business replay.'
   :ownerAlive&&!ours?'A different bridge owns the lease. Do not take over; PID liveness alone does not prove who is using a page.'
   :'Use bounded recovery for an idle owned connection. Owner handles login/user-control/extension permission.',
  pageContentRead:false,businessActionDispatched:false};
}
