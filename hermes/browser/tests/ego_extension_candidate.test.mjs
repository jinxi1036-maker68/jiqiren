// Offline declaration/permission checks only. These are NOT Chrome/Ego tests.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const dir=new URL('../ego/readonly-extension/',import.meta.url);
const manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',dir),'utf8'));
const rules=JSON.parse(fs.readFileSync(new URL('rules.json',dir),'utf8'));
const types=['main_frame','sub_frame','stylesheet','script','image','font','object','xmlhttprequest','ping','csp_report','media','websocket','webtransport','webbundle','other'];

test('candidate asks only for declarative blocking, with no code or data-reading capabilities',()=>{
 assert.equal(manifest.manifest_version,3);assert.deepEqual(manifest.permissions,['declarativeNetRequest']);
 for(const k of ['host_permissions','optional_permissions','optional_host_permissions','background','content_scripts','externally_connectable','web_accessible_resources','update_url','action','options_page'])assert(!Object.hasOwn(manifest,k));
 assert.deepEqual(manifest.declarative_net_request.rule_resources,[{id:'company_readonly',enabled:true,path:'rules.json'}]);
 assert.equal(rules.length,5);assert.equal(new Set(rules.map(r=>r.id)).size,5);
});
test('all allow declarations are method-limited and below deny priorities',()=>{
 const allow=rules.filter(r=>r.action.type==='allow'),deny=rules.filter(r=>r.action.type==='block');
 assert.equal(allow.length,2);assert.equal(deny.length,3);
 for(const r of allow){assert.deepEqual(r.condition.requestMethods,['get','head','options']);assert.equal(r.priority,10);assert(r.condition.regexFilter.startsWith('^'));assert(r.condition.regexFilter.endsWith('/'));assert(!r.action.redirect);}
 assert(!rules.some(r=>r.action.type==='allowAllRequests'));
 const methodDeny=rules.find(r=>r.id===1);assert.deepEqual(methodDeny.condition.excludedRequestMethods,['get','head','options']);assert.deepEqual(methodDeny.condition.resourceTypes,types);
 assert(rules.find(r=>r.id===5).condition.resourceTypes.includes('main_frame'),'top-level forms must not be silently omitted');
});
// A small independent declaration-intent check. Browser normalization, DNR
// schema acceptance, frame/worker coverage and real enforcement remain pending.
function intended(r){
 const url=new URL(r.url).href,method=r.method.toLowerCase();
 const matched=rules.filter(rule=>{
  const c=rule.condition;
  return (!c.regexFilter||new RegExp(c.regexFilter,'i').test(url))&&(!c.resourceTypes||c.resourceTypes.includes(r.type))&&(!c.requestMethods||c.requestMethods.includes(method))&&(!c.excludedRequestMethods||!c.excludedRequestMethods.includes(method));
 }).sort((a,b)=>b.priority-a.priority);
 return matched[0]?.action.type||'no_http_rule';
}
test('declaration intent covers navigation, frames, workers, spoofed hosts and other local ports',()=>{
 const good=['https://ldp.lingrobotics.com/','https://LDP.LINGROBOTICS.COM:443/statistics','http://127.0.0.1:61987/read','http://localhost:61987/read'];
 for(const url of good)for(const type of ['main_frame','sub_frame','xmlhttprequest','script'])assert.equal(intended({url,type,method:'GET'}),'allow');
 for(const type of types)for(const method of ['POST','PUT','PATCH','DELETE','CONNECT','TRACE'])assert.equal(intended({url:'https://ldp.lingrobotics.com/api/project',type,method}),'block');
 for(const url of ['https://ldp.lingrobotics.com.evil.invalid/','https://evil.ldp.lingrobotics.com/','https://ldp.lingrobotics.com:444/','http://ldp.lingrobotics.com/','https://example.invalid/','http://127.0.0.1:61988/read','http://localhost:61988/read'])assert.equal(intended({url,type:'main_frame',method:'GET'}),'block');
 for(const type of ['websocket','webtransport','ping','csp_report'])for(const url of ['wss://ldp.lingrobotics.com/socket','https://ldp.lingrobotics.com/channel','ws://127.0.0.1:61987/socket'])assert.equal(intended({url,type,method:'GET'}),'block');
});
test('extension payload is two static JSON files and no execution entry',()=>{
 const executable=fs.readdirSync(dir).filter(n=>!/^(manifest[.]json|rules[.]json|README[.]md)$/.test(n));assert.deepEqual(executable,[]);
 for(const rule of rules){assert(['allow','block'].includes(rule.action.type));for(const key of Object.keys(rule.condition))assert(['regexFilter','requestMethods','excludedRequestMethods','resourceTypes'].includes(key));}
});
