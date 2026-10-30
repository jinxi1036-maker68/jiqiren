import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
import {resolveCompanyWorkplace,validateWorkplaceBinding,needsApprovedStart} from '../ego/workplace.mjs';
import {startupFailure} from '../ego/lifecycle.mjs';
import {run} from '../ego/worker.mjs';
const cfg={schema:'lingju.ego-browser.v3',spaceId:2,profileId:'Profile 1',origin:'https://ldp.lingrobotics.com',
 workplaceBinding:{schema:'lingju.ego-workplace-binding.v1',name:'凌矩工作-正式浏览器',profileId:'Profile 1',profileName:'凌矩工作',startUrl:'https://ldp.lingrobotics.com/statistics',restoreWhenMissing:true,ownerRestorationApproved:true,approvalReference:'Standing Owner restore approval'}};
function fixture(spaces){let openCalls=[];return {get calls(){return openCalls;},
 list:async()=>spaces,profiles:async()=>[{id:'Profile 1',name:'凌矩工作'}],
 open:async(value,opt)=>{openCalls.push({value,opt});if(typeof value==='number')return {spaceId:value};const entry={id:9,name:value,profileId:opt.profileId,ownership:'agent'};spaces.push(entry);return {spaceId:9};}};}
test('stable company name reuses changed numeric id without creating or writing runtime',async()=>{
 const api=fixture([{id:7,name:cfg.workplaceBinding.name,profileId:'Profile 1',ownership:'agent'}]);
 const r=await resolveCompanyWorkplace(cfg,api);assert.equal(r.cfg.spaceId,7);assert.equal(r.created,false);assert.equal(cfg.spaceId,2);assert.equal(api.calls[0].value,7);
});
test('missing window restores exactly one in existing approved profile then resumes it',async()=>{
 const api=fixture([]);const a=await resolveCompanyWorkplace(cfg,api),b=await resolveCompanyWorkplace(cfg,api);
 assert.equal(a.created,true);assert.equal(b.created,false);assert.equal(a.cfg.spaceId,b.cfg.spaceId);
 assert.equal(api.calls.filter(x=>x.opt).length,1);assert.equal(api.calls[0].opt.profileId,'Profile 1');
});
test('user-controlled or ambiguous existing company windows are never bypassed',async()=>{
 for(const spaces of [[{id:7,name:cfg.workplaceBinding.name,profileId:'Profile 1',ownership:'user'}],
  [{id:8,name:'another company task',profileId:'Profile 1',ownership:'agent'}],
  [{id:9,name:cfg.workplaceBinding.name,profileId:'Default',ownership:'agent'}]]){
  const api=fixture(spaces);await assert.rejects(resolveCompanyWorkplace(cfg,api));assert.equal(api.calls.length,0);
 }
});
test('no restoration without explicit approval or original company profile',async()=>{
 for(const binding of [{...cfg.workplaceBinding,ownerRestorationApproved:false},{...cfg.workplaceBinding,startUrl:'https://example.com'}])assert.throws(()=>validateWorkplaceBinding({...cfg,workplaceBinding:binding}));
 const api=fixture([]);api.profiles=async()=>[];await assert.rejects(resolveCompanyWorkplace(cfg,api),{code:'EGO_COMPANY_PROFILE_MISSING'});assert.equal(api.calls.length,0);
});
test('legacy missing id reports exact workplace cause and does not create a window',async()=>{
 const api=fixture([]);await assert.rejects(resolveCompanyWorkplace({...cfg,workplaceBinding:undefined},api),{code:'EGO_WORKPLACE_MISSING'});assert.equal(api.calls.length,0);
});
test('approved owned blank/new-tab initializes to approved site, arbitrary old pages do not bypass scope',()=>{
 assert(needsApprovedStart(cfg,{created:false},'chrome://new-tab-page/'));
 assert(needsApprovedStart(cfg,{created:false},'about:blank'));
 assert(!needsApprovedStart(cfg,{created:false},'https://example.com/private'));
 assert(!needsApprovedStart(cfg,{created:false},cfg.origin+'/device-list'));
 assert(!needsApprovedStart({...cfg,workplaceBinding:undefined},{created:false},'chrome://new-tab-page/'));
});
test('startup receipt is bound to this nonce and preserves specific phase/cause',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'lingju-startup-')),file=path.join(dir,'error.json');
 try{
  assert.equal(await startupFailure(file,'current'),null);
  await fs.writeFile(file,JSON.stringify({ownerNonce:'old',code:'EGO_WORKPLACE_MISSING',phase:'company-workplace',detail:'Saved window missing'}));
  assert.equal(await startupFailure(file,'current'),null);
  const e=await startupFailure(file,'old');assert.equal(e.code,'EGO_WORKPLACE_MISSING');assert.equal(e.startupPhase,'company-workplace');assert.match(e.message,/missing/);
 }finally{await fs.unlink(file).catch(()=>{});await fs.rmdir(dir);}
});
test('actual worker records missing-window startup cause and releases only its lease',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'lingju-workplace-start-')),file=path.join(dir,'lock'),runtime=path.join(dir,'runtime.json');
 const oldList=globalThis.listTaskSpaces;
 try{
  const c={...cfg,schema:'lingju.ego-browser.v2',mode:'company-readonly',productionEnabled:false,businessWritesEnabled:false,workplaceBinding:undefined,
   profileDirectory:'fixture',stateFile:'fixture',extension:{id:'fpifglepgaacbbabakmcjmkinlpnconi',ruleset:'company_readonly'},
   cliVersion:'0.6.1.13',cliSha256:'a'.repeat(64),guideSha256:'b'.repeat(64),approvalReference:'fixture',home:'H',workspace:'W'};
  await fs.writeFile(runtime,JSON.stringify(c));await fs.writeFile(file,JSON.stringify({nonce:'owner'}));globalThis.listTaskSpaces=async()=>[];
  await assert.rejects(run(runtime,{file,nonce:'owner'}),{code:'EGO_WORKPLACE_MISSING'});
  const e=await startupFailure(path.join(dir,'worker-startup-error.json'),'owner');assert.equal(e.code,'EGO_WORKPLACE_MISSING');assert.equal(e.startupPhase,'company-workplace');
  await assert.rejects(fs.stat(file),{code:'ENOENT'});
 }finally{
  globalThis.listTaskSpaces=oldList;
  for(const f of ['runtime.json','worker-startup-error.json','lock'])await fs.unlink(path.join(dir,f)).catch(()=>{});
  await fs.unlink(path.join(dir,'output/receipts.jsonl')).catch(()=>{});await fs.rmdir(path.join(dir,'output')).catch(()=>{});await fs.rmdir(dir);
 }
});
