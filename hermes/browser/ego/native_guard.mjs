// Trusted integration code using Ego's documented native CDP bindings.
// No raw CDP or arbitrary code is offered as an Agent tool.
import {allowRequest} from './policy.mjs';
export function nativeReadGuard(native,cfg,record=()=>{}){
 const originalSend=native.sendCDPMessage,originalReceive=native.onCDPMessage;
 let downstream=originalReceive,next=1500000000,closed=false,failed=false;
 const sessions=new Set(),pending=new Map();
 function command(method,params,sessionId){
  return new Promise((resolve,reject)=>{
   const id=next++;
   const timer=setTimeout(()=>{pending.delete(id);failed=true;reject(Error('Guard command timeout'));},5000);
   pending.set(id,{resolve,reject,timer});
   try{originalSend.call(native,JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));}
   catch(e){clearTimeout(timer);pending.delete(id);failed=true;reject(e);}
  });
 }
 const receive=function(payload){
  let m;try{m=JSON.parse(payload);}catch{return downstream?.(payload);}
  const p=pending.get(m.id);
  if(p){clearTimeout(p.timer);pending.delete(m.id);if(m.error){failed=true;p.reject(Error('Guard command rejected'));}else p.resolve(m.result);return;}
  if(m.method==='Fetch.requestPaused'&&sessions.has(m.sessionId||'')){
   const allowed=!closed&&!failed&&allowRequest(m.params.request,cfg);
   record({kind:'request_decision',method:m.params.request.method,allowed});
   void command(allowed?'Fetch.continueRequest':'Fetch.failRequest',allowed?{requestId:m.params.requestId}:{requestId:m.params.requestId,errorReason:'BlockedByClient'},m.sessionId)
    .catch(()=>{failed=true;record({kind:'guard_command_failed'});});
  }
  // SDK owns its own target graph/refs. Do not suppress protocol events.
  return downstream?.(payload);
 };
 const wrapped=function(payload){
  const m=JSON.parse(payload);
  if(m.id>=1500000000)throw Error('SDK guard namespace collision');
  // SDK rebinds its callback before each send. Install after that rebind,
  // preserving the current SDK callback instead of overwriting it once.
  if(native.onCDPMessage!==receive){downstream=native.onCDPMessage;native.onCDPMessage=receive;}
  if(m.method==='Fetch.enable')sessions.add(m.sessionId||'');
  return originalSend.call(native,payload);
 };
 native.sendCDPMessage=wrapped;
 return {
  async protect(page){
   await page.cdp('Network.setBypassServiceWorker',{bypass:true});
   await page.cdp('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
   if(failed)throw Error('Read guard is not healthy');
  },
  healthy(){return !failed&&!closed;},
  // Cross-target/OOPIF/WebSocket coverage is not claimed. policy.mjs blocks
  // production configuration until that gap is resolved.
  async close(pages){
   closed=true;
   for(const p of pages)await p.cdp('Fetch.disable').catch(()=>{failed=true;});
   if(native.sendCDPMessage===wrapped)native.sendCDPMessage=originalSend;
   if(native.onCDPMessage===receive)native.onCDPMessage=downstream;
   for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('Guard closed'));}pending.clear();
  }
 };
}
