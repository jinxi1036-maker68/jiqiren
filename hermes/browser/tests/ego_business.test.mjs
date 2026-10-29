import test from 'node:test';import assert from 'node:assert/strict';
import {validateConfig,expectedDynamicRules,verifyExtensionMode,allowRequest,authority,validateToolCall} from '../ego/policy.mjs';
const origin='https://ldp.lingrobotics.com';
const c={schema:'lingju.ego-browser.v3',mode:'company-business',origin,productionEnabled:true,businessWritesEnabled:true,
 spaceId:2,profileId:'Profile 1',profileDirectory:'C:/fixture/Profile 1',stateFile:'C:/fixture/workplace-state.json',
 extension:{id:'fpifglepgaacbbabakmcjmkinlpnconi',ruleset:'company_readonly'},
 cliVersion:'0.6.1.13',cliSha256:'a'.repeat(64),guideSha256:'b'.repeat(64),approvalReference:'Owner authorization',home:'H',workspace:'W',
 businessAuthorization:{schema:'lingju.browser-business-grant.v1',ownerApproved:true,scopeOrigin:origin,scope:'all-company-browser-ui-business-actions',reference:'Owner 2026-10-30',highImpactRequiresSpecificOwnerTask:true}};
test('business mode needs explicit scoped Owner grant, not just a production flag',()=>{
 assert.equal(validateConfig(c),c);
 for(const delta of [{businessAuthorization:null},{businessAuthorization:{...c.businessAuthorization,ownerApproved:false}},
  {businessAuthorization:{...c.businessAuthorization,scopeOrigin:'https://example.com'}},
  {businessAuthorization:{...c.businessAuthorization,scope:'all-websites'}},{businessWritesEnabled:false},
  {schema:'lingju.ego-browser.v2'},{mode:'company-readonly'},{productionEnabled:false}])assert.throws(()=>validateConfig({...c,...delta}));
});
test('all normal business HTTP methods allowed only inside authorized origin',()=>{
 for(const method of ['GET','HEAD','OPTIONS','POST','PUT','PATCH','DELETE']){
  assert.equal(allowRequest({url:origin+'/fixture-never-requested',method},c),true);
  for(const url of ['https://example.com/x','https://ldp.lingrobotics.com.evil.invalid/x','https://u:p@ldp.lingrobotics.com/x'])assert.equal(allowRequest({url,method},c),false);
 }
 assert.equal(allowRequest({url:origin+'/x',method:'TRACE'},c),false);
});
test('extension rules cover same-site writes without opening external hosts or loopback writes',()=>{
 const rules=expectedDynamicRules(c);assert.equal(rules.length,2);
 for(const url of ['https://ldp.lingrobotics.com/api/x','wss://ldp.lingrobotics.com/events'])assert(rules.some(r=>new RegExp(r.condition.regexFilter).test(url)));
 for(const url of ['https://example.com/api/x','http://127.0.0.1:61987/api/x','https://ldp.lingrobotics.com.evil.invalid/x'])assert(!rules.some(r=>new RegExp(r.condition.regexFilter).test(url)));
 assert(rules.every(r=>r.priority>100));assert(rules[0].condition.requestMethods.includes('delete'));
});
test('live guard fails closed on unexpected, missing, session or mode-mismatched rules',()=>{
 const dynamic=expectedDynamicRules(c),actual={rules:['company_readonly'],dynamic,session:[]};
 assert(verifyExtensionMode(actual,c));
 assert(verifyExtensionMode({...actual,dynamic:dynamic.toReversed().map(r=>({...r,condition:{...r.condition,resourceTypes:r.condition.resourceTypes.toReversed()}}))},c));
 for(const delta of [{dynamic:[]},{rules:[]},{session:[{id:9}]},{dynamic:[...dynamic,{id:99}]}])assert.throws(()=>verifyExtensionMode({...actual,...delta},c));
 const readonly={...c,schema:'lingju.ego-browser.v2',mode:'company-readonly',productionEnabled:false,businessWritesEnabled:false};
 assert.throws(()=>verifyExtensionMode(actual,readonly));assert(verifyExtensionMode({...actual,dynamic:[]},readonly));
});
test('actual authority exposes UI writes without hidden system or network tools',()=>{
 assert.equal(authority(c).businessWritesEnabled,true);assert.match(authority(c).businessCapabilities,/create, edit, group, bind/);
 validateToolCall('ego_browser_actions',{actions:[{type:'fill',selector:'@1',text:'fixture'},{type:'select',selector:'@2',value:'EMP-002'},{type:'click',selector:'@3'},{type:'dialog_accept'}]});
 for(const type of ['evaluate','fetch','terminal','write_file'])assert.throws(()=>validateToolCall('ego_browser_actions',{actions:[{type}]}));
});
