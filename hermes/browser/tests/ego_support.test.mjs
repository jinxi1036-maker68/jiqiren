import test from 'node:test';import assert from 'node:assert/strict';
import {boundedRecovery,workerCall} from '../ego/support.mjs';
import {toolsFor,validateToolCall} from '../ego/policy.mjs';
import {actionBatch,operationResult} from '../ego/lifecycle.mjs';
test('support tools require an explicit company grant and expose no arbitrary code',()=>{
 assert.equal(toolsFor({schema:'lingju.ego-browser.v1'}).length,8);
 const offered=toolsFor({schema:'lingju.ego-browser.v3',employeeSupport:{ownerApproved:true}});assert.equal(offered.length,12);
 assert.throws(()=>validateToolCall('ego_browser_recover',{action:'kill'}));
 assert.throws(()=>validateToolCall('company_knowledge',{action:'read'}));
 assert.throws(()=>validateToolCall('company_task_notes',{action:'checkpoint',shell:'x'}));
});
test('recovery never stops an in-flight worker or replays business actions',async()=>{
 let stops=0,connections=0;
 await assert.rejects(boundedRecovery('reconnect',{hasEndpoint:()=>true,health:async()=>({busy:true}),stop:async()=>stops++,connect:async()=>connections++}),/IN_FLIGHT/);
 assert.equal(stops,0);assert.equal(connections,0);
});
test('unknown health fails closed, healthy owned idle reconnect has bounded order',async()=>{
 const order=[];
 await boundedRecovery('reconnect',{hasEndpoint:()=>true,health:async()=>({busy:false,pending:0}),stop:async()=>order.push('stop'),releaseDead:async()=>order.push('proof'),connect:async()=>order.push('connect')});
 assert.deepEqual(order,['stop','proof','connect']);
 await assert.rejects(boundedRecovery('reconnect',{hasEndpoint:()=>true,health:async()=>{throw Error('unknown');}}),/unknown/);
});
test('overlay failure returns fresh state and partial receipts, never runs the remaining save',async()=>{
 const performed=[];
 const r=await actionBatch([{type:'fill'},{type:'click'},{type:'click'}],async()=>{},async a=>{
  performed.push(a.type);if(a.type==='click')throw Error('element is not visible');return 'filled';
 },async()=>({snapshot:'fresh current refs: dialog closed'}));
 assert.deepEqual(performed,['fill','click']);assert.equal(r.receipts.length,1);assert.equal(r.remaining_actions_not_executed,1);
 assert.match(r.state_after_failure.snapshot,/fresh/);assert.equal(r.savedBusinessState,'unverified');
 const rpc=operationResult(r);assert.equal(rpc.isError,false);assert.equal(rpc.structuredContent.operationSucceeded,false);
});
test('native worker unavailability does not disable the responding MCP recovery tools',()=>{
 const rpc=operationResult({error:'Native process unavailable',code:'EGO_UNAVAILABLE',failureScope:'browser_connection',nativeWorkerConnected:false});
 assert.equal(rpc.isError,false);assert.equal(rpc.structuredContent.transportHealthy,true);assert.equal(rpc.structuredContent.nativeWorkerConnected,false);
 assert.equal(rpc.structuredContent.failureScope,'browser_connection');
});
test('numeric DOM timeout codes become explicit transport failures with late-effect uncertainty',async()=>{
 let calls=0;
 await assert.rejects(workerCall({port:1,token:'synthetic'},'synthetic',{},async()=>{calls++;throw new DOMException('timed out','TimeoutError');}),e=>e.code==='EGO_TRANSPORT_FAILED'&&e.mayHaveLateEffects===true);
 assert.equal(calls,1);
});
test('failed readback after a successful dispatched save preserves receipt and never resubmits',async()=>{
 let saves=0;const r=await actionBatch([{type:'click'}],async()=>{},async()=>{saves++;return {dispatched:true};},async()=>{throw Error('verification disconnected');});
 assert.equal(saves,1);assert.equal(r.all_actions_dispatched,true);assert.equal(r.receipts.length,1);
 assert.equal(r.savedBusinessState,'unverified');assert.equal(r.code,'EGO_VERIFICATION_READ_FAILED');
});
