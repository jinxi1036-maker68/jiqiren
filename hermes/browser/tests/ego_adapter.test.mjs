import test from 'node:test';
import assert from 'node:assert/strict';
import {validateConfig,requireScope,allowRequest,validateToolCall,tools} from '../ego/policy.mjs';
import {nativeReadGuard} from '../ego/native_guard.mjs';
const c={schema:'lingju.ego-browser.v1',mode:'synthetic',productionEnabled:false,origin:'http://127.0.0.1:12345',spaceId:1,cliVersion:'0.6.1.13',cliSha256:'a'.repeat(64),guideSha256:'b'.repeat(64),approvalReference:'Owner plan',home:'H',workspace:'W'};
test('production cannot be activated by scope or mode changes',()=>{
 for(const changed of [{mode:'production'},{productionEnabled:true},{origin:'https://ldp.lingrobotics.com'},{origin:'http://127.0.0.1:12345/private'},{spaceId:0}])assert.throws(()=>validateConfig({...c,...changed}));
 assert.equal(validateConfig(c),c);
});
test('scope rejects welcome/private/auth origins and credentials before observation',()=>{
 for(const u of ['chrome://new-tab-page/','https://example.com','http://u:p@127.0.0.1:12345/','file:///C:/private'])assert.throws(()=>requireScope(u,c.origin));
 requireScope(c.origin+'/binding',c.origin);requireScope('about:blank',c.origin,{blank:true});
});
test('read guard denies cross-origin, POST writes, login and unsafe schemes',()=>{
 for(const request of [{url:c.origin+'/api/projects',method:'POST'},{url:c.origin+'/api/login',method:'POST'},{url:'https://example.com',method:'GET'},{url:'file:///C:/private',method:'GET'},{url:c.origin+'/api/tasks',method:'DELETE'}])assert.equal(allowRequest(request,c),false);
 assert.equal(allowRequest({url:c.origin+'/api/records?page=2',method:'GET'},c),true);
 assert.equal(allowRequest({url:c.origin+'/api/reorder',method:'POST'},c),false);
 assert.equal(allowRequest({url:c.origin+'/api/reorder',method:'POST'},{...c,allowSyntheticReorder:true}),true);
});
test('Agent interface rejects system-code/CDP/file injection and malformed input',()=>{
 assert.equal(tools.length,8);
 for(const [n,a] of [['terminal',{}],['ego_browser_observe',{path:'C:/private'}],['ego_browser_actions',{actions:[{type:'evaluate',text:'process.env'}]}],['ego_browser_actions',{actions:[{type:'click',selector:'#x',code:'x'}]}],['ego_browser_actions',{actions:[{type:'mouse_click',x:NaN,y:2}]}],['ego_browser_observe',{page:'p0'}],['ego_browser_actions',{actions:[]}],['ego_browser_actions',{actions:Array(9).fill({type:'hover',selector:'#x'})}]])assert.throws(()=>validateToolCall(n,a));
 validateToolCall('ego_browser_actions',{actions:[{type:'hover',selector:'@2'},{type:'press',selector:'@2',key:'Enter'}]});
});
test('native guard survives SDK callback replacement and restores its own hooks',async()=>{
 const sends=[],records=[],delivered=[];
 const sdk1=m=>delivered.push(['sdk1',JSON.parse(m).method]);
 const native={onCDPMessage:sdk1,sendCDPMessage(raw){const m=JSON.parse(raw);sends.push(m);if(m.id>=1500000000)queueMicrotask(()=>native.onCDPMessage(JSON.stringify({id:m.id,result:{}})));}};
 const originalSend=native.sendCDPMessage;
 const guard=nativeReadGuard(native,c,e=>records.push(e));
 const page={async cdp(method,params){native.onCDPMessage=m=>delivered.push(['sdk2',JSON.parse(m).method]);native.sendCDPMessage(JSON.stringify({id:2,sessionId:'owned',method,params}));}};
 await guard.protect(page);
 native.onCDPMessage(JSON.stringify({method:'Fetch.requestPaused',sessionId:'owned',params:{requestId:'r1',request:{url:c.origin+'/api/projects',method:'POST'}}}));
 await new Promise(r=>setImmediate(r));
 assert(sends.some(m=>m.method==='Fetch.failRequest'&&m.params.requestId==='r1'));
 assert.equal(records[0].allowed,false);assert(delivered.some(x=>x[0]==='sdk2'));
 const before=sends.length;
 native.onCDPMessage(JSON.stringify({method:'Fetch.requestPaused',sessionId:'unrelated',params:{requestId:'private',request:{url:c.origin,method:'GET'}}}));
 assert.equal(sends.length,before,'must not act on unrelated profile sessions');
 await guard.close([page]);assert.equal(native.sendCDPMessage,originalSend);
});
