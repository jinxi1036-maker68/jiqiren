// Connection lifecycle only. Never reclaim another owner or retry a browser action.
import fs from 'node:fs/promises';

export function singleFlight(start){
 let pending;
 return ()=>{
  if(pending)return pending;
  const current=Promise.resolve().then(start);
  const result=current.finally(()=>{if(pending===result)pending=undefined;});
  pending=result;return result;
 };
}

export async function releaseOwnedLease(file,nonce){
 let value;
 try{value=JSON.parse(await fs.readFile(file,'utf8'));}
 catch(e){if(e.code==='ENOENT'||e instanceof SyntaxError)return false;throw e;}
 if(!nonce||value.nonce!==nonce)return false;
 // Other compliant owners cannot replace this extant lease. Never delete
 // an unrelated nonce, and never use this as a stale-owner takeover API.
 try{await fs.unlink(file);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}
}

export async function releaseStoppedStart(file,nonce,child){
 if(child?.pid&&child.exitCode===null&&child.signalCode==null)return false;
 return releaseOwnedLease(file,nonce);
}
