import test from 'node:test';import assert from 'node:assert/strict';
import {operationResult,invalidInputResult} from '../ego/lifecycle.mjs';
import {validateToolCall} from '../ego/policy.mjs';
test('completed RPC preserves failed browser operation without alleging transport failure',()=>{
 const failure={error:'page.click failed: element is not visible',code:'EGO_OPERATION_FAILED',outcome:'unknown'};
 const r=operationResult(failure),p=r.structuredContent;
 assert.equal(r.isError,false);assert.equal(p.operationSucceeded,false);assert.equal(p.transportHealthy,true);
 assert.equal(p.error,failure.error);assert.equal(p.code,failure.code);assert.equal(p.savedBusinessState,'unverified');
 assert.equal(failure.operationSucceeded,undefined,'original receipt is not mutated');
});
test('successful RPC preserves the actual output and reports operation success',()=>{
 const r=operationResult({page:'p1',snapshot:'synthetic text'}),p=JSON.parse(r.content[0].text);
 assert.equal(r.isError,false);assert.equal(p.operationSucceeded,true);assert.equal(p.snapshot,'synthetic text');
});
test('bad arguments are explicitly not dispatched and not a broken connection',()=>{
 const r=invalidInputResult('Missing action input'),p=r.structuredContent;
 assert.equal(r.isError,false);assert.equal(p.operationSucceeded,false);assert.equal(p.actionDispatched,false);
 assert.equal(p.code,'EGO_INVALID_ARGUMENT');assert.equal(p.transportHealthy,true);
});
test('missing or malformed worker response is not silently classified as completed RPC',()=>{
 for(const r of [null,undefined,[],42])assert.throws(()=>operationResult(r));
});
test('argument guidance names the actual missing field',()=>{
 for(const [type,key] of [['fill','text'],['select','value'],['wait_text','text']]){
  assert.throws(()=>validateToolCall('ego_browser_actions',{actions:[{type,selector:'@1'}]}),new RegExp(type+' requires '+key));
 }
});
