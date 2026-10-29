import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {extensionGuard} from '../ego/extension_guard.mjs';
import {workplaceState,validateConfig} from '../ego/policy.mjs';
async function fixture(t){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'lingju-ego-life-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 for(const n of ['manifest.json','rules.json'])await fs.writeFile(path.join(dir,n),n);
 const hash=async n=>crypto.createHash('sha256').update(await fs.readFile(path.join(dir,n))).digest('hex');
 const state={schema:'lingju.ego-workplace-state.v1',state:'awaiting-owner-login',ownerLoginConfirmed:false,revision:'fixture'};
 const c={schema:'lingju.ego-browser.v2',mode:'company-readonly',origin:'https://ldp.lingrobotics.com',productionEnabled:false,businessWritesEnabled:false,spaceId:1,profileId:'Profile 1',profileDirectory:path.join(dir,'Profile 1'),stateFile:path.join(dir,'state.json'),extension:{id:'fpifglepgaacbbabakmcjmkinlpnconi',directory:dir,ruleset:'company_readonly',manifestSha256:await hash('manifest.json'),rulesSha256:await hash('rules.json')},cliVersion:'0.6.1.13',cliSha256:'a'.repeat(64),guideSha256:'b'.repeat(64),approvalReference:'fixture only',home:'H',workspace:'W'};
 const save=()=>fs.writeFile(c.stateFile,JSON.stringify(state));await save();
 let url='about:blank',enabled=['company_readonly'],ownership='agent',profile='Profile 1',created=0,closed=0;
 const page={async goto(u){url=u;},async url(){return url;},async evaluate(){return url==='chrome://version/'?c.profileDirectory:{rules:enabled,dynamic:[],session:[]};},async close(){closed++;}};
 const task={async newPage(){created++;return page;}};
 const guard=extensionGuard(task,c,{spaces:async()=>[{id:1,profileId:profile,ownership}]});
 return {c,state,save,guard,dir,setEnabled(v){enabled=v;},setOwner(v){ownership=v;},setProfile(v){profile=v;},counts:()=>({created,closed})};
}
test('waiting-login can inspect own extension but cannot operate a business page',async t=>{
 const f=await fixture(t);assert.equal(validateConfig(f.c),f.c);
 const s=await f.guard.inspect();assert.equal(s.ready,false);assert.equal(s.extensionEnabled,true);
 await assert.rejects(f.guard.inspect({requireActive:true}),/EGO_OWNER_LOGIN_REQUIRED/);
 await f.guard.close();assert.equal(f.counts().closed,1);
});
test('each active action gate detects extension disable, payload change and user takeover',async t=>{
 const f=await fixture(t);Object.assign(f.state,{state:'active',ownerLoginConfirmed:true,ownerConfirmationReference:'Owner fixture'});await f.save();
 assert.equal((await f.guard.inspect({requireActive:true})).ready,true);
 f.setEnabled([]);await assert.rejects(f.guard.inspect({requireActive:true}),/NOT_ENABLED/);
 f.setEnabled(['company_readonly']);f.setOwner('user');await assert.rejects(f.guard.inspect({requireActive:true}),/CONTROL_CHANGED/);
 f.setOwner('agent');await fs.appendFile(path.join(f.dir,'rules.json'),'tamper');await assert.rejects(f.guard.inspect({requireActive:true}),/BYTES_CHANGED/);
 await f.guard.close();
});
test('wrong profile fails before creating or inspecting a metadata Page',async t=>{
 const f=await fixture(t);f.setProfile('Profile 2');await assert.rejects(f.guard.inspect(),/PROFILE/);assert.equal(f.counts().created,0);
});
test('active requires Owner evidence; production/writes cannot be enabled by a switch',async t=>{
 const f=await fixture(t);for(const change of [{productionEnabled:true},{businessWritesEnabled:true},{origin:'https://example.com'},{mode:'production'}])assert.throws(()=>validateConfig({...f.c,...change}));
 assert.throws(()=>workplaceState({...f.state,state:'active',ownerLoginConfirmed:true}),/OWNER_LOGIN/);
 assert.equal(workplaceState({...f.state,state:'paused'}).ready,false);
});
test('handed-off guard cannot resume itself',async t=>{
 const f=await fixture(t);await f.guard.inspect();await f.guard.close();await assert.rejects(f.guard.inspect(),/USER_CONTROL/);assert.equal(f.counts().created,1);
});
