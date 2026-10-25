import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {startFixture,startGuard} from '../fixture.mjs';
import {requestScope} from '../request_scope.mjs';

function via(g,origin,method,pathname,body){
 return new Promise((resolve,reject)=>{
  const p=new URL(g.url),data=body===undefined?'':JSON.stringify(body);
  const q=http.request({hostname:p.hostname,port:p.port,path:origin+pathname,method,agent:false,
   headers:{'content-type':'application/json','content-length':Buffer.byteLength(data)}},r=>{
    let b='';r.setEncoding('utf8');r.on('data',c=>b+=c);r.on('end',()=>resolve({status:r.statusCode,body:JSON.parse(b)}));
   });q.on('error',reject);q.end(data);
 });
}

test('explicit task grants preserve free reads, deny unknown writes and reject unknown scope',()=>{
 const a=requestScope('analysis'),b=requestScope('binding'),r=requestScope('recovery');
 for(const p of [a,b,r,requestScope()]){
  assert.ok(p.allows('GET','/api/records'));assert.ok(p.allows('HEAD','/api/projects'));
  assert.equal(p.allows('DELETE','/api/projects'),false);assert.equal(p.allows('POST','/api/login'),false);
 }
 assert.ok(a.allows('POST','/api/qa-refresh'));assert.equal(a.allows('POST','/api/projects'),false);
 assert.ok(b.allows('POST','/api/tasks'));assert.equal(b.allows('POST','/api/qa-refresh'),false);
 assert.ok(r.allows('POST','/api/projects'));assert.ok(r.allows('POST','/api/reorder'));
 assert.equal(r.allows('POST','/api/tasks'),false);assert.equal(r.allows('POST','/api/qa-refresh'),false);
 assert.equal(requestScope().allows('POST','/api/projects'),false);
 assert.throws(()=>requestScope('unapproved'));assert.throws(()=>requestScope('__proto__'));
});

test('recovery blocks both unauthorized QA refreshes before upstream, keeps uncertain submission and reads',async()=>{
 const f=await startFixture(),g=await startGuard(f.origin,{caseId:'recovery'});
 try{
  for(let n=0;n<2;n++){
   const x=await via(g,f.origin,'POST','/api/qa-refresh',{});
   assert.equal(x.status,403);assert.equal(x.body.code,'LINGJU_LOCAL_SCOPE_DENIED');
   assert.equal(x.body.source,'local_browser_permission_guard');assert.equal(x.body.upstream_request_sent,false);
  }
  assert.equal(f.state.qa_refreshes,0);assert.equal(f.state.phase,0);
  assert.equal(f.events.filter(x=>x.type==='qa_refresh').length,0);
  const created=await via(g,f.origin,'POST','/api/projects?lost=1',{name:'恢复检查',code:'SYNTHETIC-RECOVERY'});
  assert.equal(created.status,503);assert.equal(f.state.create_attempts,1);
  const read=await via(g,f.origin,'GET','/api/projects');assert.equal(read.body.length,1);
  assert.equal(read.body[0].code,'SYNTHETIC-RECOVERY');
  const partial=await via(g,f.origin,'GET','/api/records?page=2&partial=1');
  assert.equal(partial.status,503);assert.notEqual(partial.body.code,'LINGJU_LOCAL_SCOPE_DENIED');
  assert.equal((await via(g,f.origin,'POST','/api/reorder',{})).status,200);
  assert.equal(f.state.employees[0].id,'EMP-002');
  assert.equal((await via(g,f.origin,'POST','/api/tasks',{})).status,403);
  assert.equal((await via(g,f.origin,'POST','/api/login',{})).status,403);
  assert.equal(f.state.visual_attempts,0);assert.equal(f.state.login_attempts,0);
 }finally{await g.close();await f.close();}
});

test('binding allows correction of an invalid form, without granting QA mutation',async()=>{
 const f=await startFixture(),g=await startGuard(f.origin,{caseId:'binding'});
 try{
  assert.equal((await via(g,f.origin,'POST','/api/projects',{name:'模拟项目',code:'SYNTHETIC-BIND'})).status,201);
  const task={project_id:'PRJ-001',name:'模拟任务',start_date:'2026-10-25',employee_id:'EMP-002',device_id:'DEV-010',visual_code:'47'};
  assert.equal((await via(g,f.origin,'POST','/api/tasks',{...task,visual_code:'00'})).status,400);
  assert.equal((await via(g,f.origin,'POST','/api/tasks',task)).status,201);
  assert.equal(f.state.tasks.length,1);
  assert.equal((await via(g,f.origin,'POST','/api/qa-refresh',{})).status,403);
  assert.equal(f.state.qa_refreshes,0);
 }finally{await g.close();await f.close();}
});

test('analysis grants QA refresh but not project creation',async()=>{
 const f=await startFixture(),g=await startGuard(f.origin,{caseId:'analysis'});
 try{
  assert.equal((await via(g,f.origin,'POST','/api/qa-refresh',{})).status,200);
  assert.equal(f.state.qa_refreshes,1);
  assert.equal((await via(g,f.origin,'POST','/api/projects',{name:'not allowed',code:'NO'})).status,403);
  assert.equal(f.state.projects.length,0);
 }finally{await g.close();await f.close();}
});

test('a granted operation cannot bypass origin restriction',async()=>{
 const f=await startFixture(),g=await startGuard(f.origin,{caseId:'recovery'});
 try{
  assert.equal((await via(g,'http://outside.invalid','POST','/api/projects',{})).status,403);
  assert.equal(f.state.create_attempts,0);assert.equal(g.entries.at(-1).reason,'origin_not_authorized');
 }finally{await g.close();await f.close();}
});
