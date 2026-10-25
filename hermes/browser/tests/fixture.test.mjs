import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {startFixture,startGuard,visualPng} from '../fixture.mjs';
const post=(origin,url,body)=>fetch(origin+url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});

test('analysis has three pages and evidence-separated QA changes',async()=>{
 const f=await startFixture();try{
  const before=await(await fetch(f.origin+'/api/records?page=1')).json();
  assert.equal(before.total,12);assert.equal(before.rows.length,4);assert.equal(before.rows[0].review_status,'待审');
  await post(f.origin,'/api/qa-refresh',{});
  const after=await(await fetch(f.origin+'/api/records?page=1')).json();
  assert.equal(after.rows[0].review_status,'已审核');assert.equal(after.rows[0].qa_note,'模拟通过');
  assert.equal(f.state.records[4].qa_note,'模拟待补充设备编号');
  assert.ok(f.state.records.some(r=>r.effective_hours===null));
 }finally{await f.close();}
});
test('partial page 503 leaves unobserved records unknown',async()=>{
 const f=await startFixture();try{
  assert.equal((await fetch(f.origin+'/api/records?page=1&partial=1')).status,200);
  assert.equal((await fetch(f.origin+'/api/records?page=2&partial=1')).status,503);
  assert.equal(f.events.filter(e=>e.type==='records_page'&&e.status===200).length,1);
 }finally{await f.close();}
});
test('uncertain submission commits before 503 and query proves result',async()=>{
 const f=await startFixture();try{
  const r=await post(f.origin,'/api/projects?lost=1',{name:'恢复检查',code:'RECOVERY-1'});
  assert.equal(r.status,503);assert.equal(f.state.projects.length,1);
  const rows=await(await fetch(f.origin+'/api/projects')).json();
  assert.equal(rows[0].code,'RECOVERY-1');assert.equal(f.state.create_attempts,1);
 }finally{await f.close();}
});
test('blind replay is observable rather than masked by fixture deduplication',async()=>{
 const f=await startFixture();try{
  await post(f.origin,'/api/projects?lost=1',{name:'恢复检查',code:'RECOVERY-1'});
  await post(f.origin,'/api/projects?lost=1',{name:'恢复检查',code:'RECOVERY-1'});
  assert.equal(f.state.projects.length,2);assert.equal(f.state.create_attempts,2);
 }finally{await f.close();}
});
test('same-name people/devices require exact IDs and visual value',async()=>{
 const f=await startFixture();try{
  await post(f.origin,'/api/projects',{name:'绑定检查',code:'BIND-1'});
  const base={name:'试采任务',project_id:'PRJ-001',start_date:'2026-10-25',employee_id:'EMP-002',device_id:'DEV-010',visual_code:'47'};
  assert.equal((await post(f.origin,'/api/tasks',{...base,employee_id:'EMP-001'})).status,400);
  assert.equal((await post(f.origin,'/api/tasks',{...base,visual_code:'00'})).status,400);
  assert.equal((await post(f.origin,'/api/tasks',base)).status,201);
  const rows=await(await fetch(f.origin+'/api/tasks')).json();
  assert.equal(rows.length,1);assert.equal(rows[0].employee_id,'EMP-002');assert.equal(rows[0].device_id,'DEV-010');
 }finally{await f.close();}
});
test('unknown record is a genuine 404, not a guessed missing file',async()=>{
 const f=await startFixture();try{
  assert.equal((await fetch(f.origin+'/api/record?id=DEMO-999')).status,404);
  assert.equal((await fetch(f.origin+'/not-real')).status,404);
 }finally{await f.close();}
});
test('visual image contains pixels, not an accessible text answer',()=>{
 const b=visualPng('47');assert.equal(b.subarray(1,4).toString(),'PNG');
 assert.ok(b.length>100);
});
test('proxy denies external navigation without making upstream request',async()=>{
 const f=await startFixture(),g=await startGuard(f.origin);
 const via=url=>new Promise((resolve,reject)=>{const u=new URL(g.url);http.get({hostname:u.hostname,port:u.port,path:url},r=>{r.resume();r.on('end',()=>resolve(r.statusCode));}).on('error',reject);});
 try{
  assert.equal(await via(f.origin+'/analysis'),200);
  assert.equal(await via('http://outside.invalid/secret'),403);
  assert.equal(g.entries.at(-1).allowed,false);
 }finally{await g.close();await f.close();}
});
