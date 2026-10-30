// Connection lifecycle only. Never reclaim another owner or retry a browser action.
import fs from 'node:fs/promises';

export async function actionBatch(actions,before,act,observe){
 const receipts=[];
 for(let i=0;i<actions.length;i++){
  try{
   await before();const receipt=await act(actions[i]);receipts.push({type:actions[i].type,receipt});
   if(receipt?.dialog)return {receipts,dialog:receipt.dialog,verification:'pending dialog'};
  }catch(e){
   let currentState=null;
   // A fresh *read*, never an alternate click or hidden submit retry.
   try{await before();currentState=await observe();}catch{}
   return {error:String(e.message||e),code:e.error_code||e.code||'EGO_PAGE_ACTION_FAILED',
    receipts,failed_action_index:i,remaining_actions_not_executed:actions.length-i-1,
    state_after_failure:currentState,savedBusinessState:'unverified',
    outcome:'No action replay. Use this fresh state or a current screenshot to choose your own next step; query any uncertain saved result first.'};
  }
 }
 try{return {receipts,...await observe()};}
 catch(e){return {error:String(e.message||e),code:e.error_code||e.code||'EGO_VERIFICATION_READ_FAILED',
  receipts,all_actions_dispatched:true,remaining_actions_not_executed:0,savedBusinessState:'unverified',
  outcome:'Actions were dispatched but the subsequent observation failed. Query saved state; never replay the batch merely because verification failed.'};}
}

export async function startupFailure(file,nonce){
 let data;try{data=JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT'||e instanceof SyntaxError)return null;throw e;}
 if(!nonce||data.ownerNonce!==nonce||!/^EGO_[A-Z_]+$/.test(data.code||''))return null;
 return Object.assign(Error(String(data.detail||data.code).slice(0,500)),{code:data.code,startupPhase:data.phase});
}

// A completed authenticated worker response proves RPC liveness, even when
// the requested browser operation failed. Hermes counts MCP isError toward a
// server-wide transport breaker. Preserve domain errors explicitly in content
// without falsely making three stale selectors look like a disconnected server.
export function operationResult(result){
 if(!result||typeof result!=='object'||Array.isArray(result))throw Error('Invalid native worker response');
 const failed=typeof result.error==='string'&&result.error.length>0;
 const payload={...result,
  transportHealthy:true,operationSucceeded:!failed,
  ...(failed?{failureScope:result.failureScope||'browser_operation',savedBusinessState:'unverified',
   next:'No automatic action retry. Read current full-page state without stale subtree refs before deciding a safe next action; query saved state before any repeat submission.'}:{})};
 // Native Hermes also needs an unescaped, early structured error field so its
 // ordinary error display/repeated-failure guard still sees the real failure.
 return failed?{isError:false,content:[{type:'text',text:'Browser operation failed; saved business state is unverified. See structuredContent.error.'}],structuredContent:payload}
  :{isError:false,content:[{type:'text',text:JSON.stringify(payload)}]};
}

export function invalidInputResult(message){
 return {isError:false,content:[{type:'text',text:'Tool arguments rejected; no browser action dispatched.'}],structuredContent:{error:String(message),code:'EGO_INVALID_ARGUMENT',
  transportHealthy:true,browserConnectionChecked:false,operationSucceeded:false,actionDispatched:false,failureScope:'tool_arguments',
  outcome:'no browser action dispatched; fix arguments, do not classify as a server connection failure'}};
}

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
