import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WorkBroker} from '../work_broker_core.mjs';

const tools=[{name:'browser_click',inputSchema:{type:'object'}},{name:'browser_snapshot',inputSchema:{type:'object'}}];
function fixture(){
 let state={available:true,key:'one',revision:'one'},calls=[],connects=[],closed=[];
 const b=new WorkBroker({tools,inspect:async()=>({...state}),connect:async s=>{
  connects.push(s.key);return {call:async(n,a)=>{calls.push([s.key,n,a]);return {content:[{type:'text',text:'actual result'}]};},close:async()=>{closed.push(s.key);}};
 }});
 return {b,calls,connects,closed,set:v=>{state=v;}};
}
test('closed workplace retains catalog and causes no connection or action',async()=>{
 const f=fixture();f.set({available:false,code:'WORKPLACE_CLOSED'});
 assert.equal((await f.b.call('browser_click')).isError,true);
 assert.deepEqual(f.b.list().tools,tools);assert.equal(f.connects.length,0);assert.equal(f.calls.length,0);
});
test('switches workplace without recreating MCP server or reusing old worker',async()=>{
 const f=fixture();await f.b.call('browser_snapshot');f.set({available:true,key:'two',revision:'two'});
 await f.b.call('browser_snapshot');assert.deepEqual(f.connects,['one','two']);assert.deepEqual(f.closed,['one']);
 assert.deepEqual(f.calls.map(x=>x[0]),['one','two']);assert.deepEqual(f.b.list().tools,tools);await f.b.close();
});
test('a transport failure never replays a possibly committed mutation',async()=>{
 let actions=0,connects=0;
 const b=new WorkBroker({tools,inspect:async()=>({available:true,key:'x',revision:'x'}),connect:async()=>{
  connects++;return {call:async()=>{actions++;throw Error('saved but response lost');},close:async()=>{}};
 }});
 const r=await b.call('browser_click');assert.equal(actions,1);assert.equal(connects,1);
 assert.ok(r.isError);assert.match(r.content[0].text,/ACTION_OUTCOME_UNKNOWN/);assert.deepEqual(b.list().tools,tools);
 await b.close();
});
test('revocation during connection prevents action',async()=>{
 let reads=0,actions=0;
 const b=new WorkBroker({tools,inspect:async()=>++reads===1?{available:true,key:'x'}:{available:false},
  connect:async()=>({call:async()=>{actions++;},close:async()=>{}})});
 const r=await b.call('browser_click');assert.ok(r.isError);assert.match(r.content[0].text,/BEFORE_ACTION/);assert.equal(actions,0);
});
test('switch during action preserves result and warns of unknown outcome',async()=>{
 let reads=0,actions=0;
 const b=new WorkBroker({tools,inspect:async()=>({available:true,key:++reads<=2?'x':'y'}),
  connect:async()=>({call:async()=>{actions++;return {content:[{type:'text',text:'record PRJ-001 saved'}]};},close:async()=>{}})});
 const r=await b.call('browser_click');assert.equal(actions,1);assert.ok(r.isError);
 assert.match(r.content[0].text,/PRJ-001/);assert.match(r.content[1].text,/CHANGED_DURING_ACTION/);
});
test('parallel requests serialize mutations',async()=>{
 const order=[];let release;
 const b=new WorkBroker({tools,inspect:async()=>({available:true,key:'x'}),connect:async()=>({
  call:async(n,a)=>{order.push('start'+a.id);if(a.id===1)await new Promise(r=>release=r);order.push('end'+a.id);return {content:[]};},close:async()=>{}})});
 const one=b.call('browser_click',{id:1}),two=b.call('browser_click',{id:2});
 while(!release)await new Promise(r=>setImmediate(r));assert.deepEqual(order,['start1']);release();
 await Promise.all([one,two]);assert.deepEqual(order,['start1','end1','start2','end2']);await b.close();
});
test('inspection error and unknown tool cannot reach browser',async()=>{
 let actions=0;const b=new WorkBroker({tools,inspect:async()=>{throw Error('bad proof');},connect:async()=>{actions++;}});
 assert.ok((await b.call('browser_run_code')).isError);assert.ok((await b.call('browser_click')).isError);assert.equal(actions,0);
});
test('closing entry closes only its worker and no further actions',async()=>{
 const f=fixture();await f.b.call('browser_snapshot');await f.b.close();
 assert.deepEqual(f.closed,['one']);assert.ok((await f.b.call('browser_click')).isError);assert.equal(f.calls.length,1);
});
