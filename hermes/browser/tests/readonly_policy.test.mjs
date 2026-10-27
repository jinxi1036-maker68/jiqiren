import {test} from 'node:test';
import assert from 'node:assert/strict';
import {permittedPage,permittedRead,guardedObservation} from '../readonly_policy.mjs';
const scope={origin:'https://ldp.lingrobotics.com',paths:['/statistics']};
const good={ownedBrowser:true,pages:['https://ldp.lingrobotics.com/statistics']};
test('only exact approved page, owned browser and one tab',()=>{
 assert.ok(permittedPage(good,scope));
 for(const pages of [['https://ldp.lingrobotics.com/login'],['https://ldp.lingrobotics.com/statistics?token=redacted'],['https://ldp.lingrobotics.com/statistics#login'],['https://ldp.lingrobotics.com.evil.test/statistics'],['https://example.test/statistics'],[...good.pages,'https://private.test']])assert.equal(permittedPage({ownedBrowser:true,pages},scope),false);
 assert.equal(permittedPage({...good,ownedBrowser:false},scope),false);
});
test('deny all actions and arbitrary screenshot paths or full-page export',()=>{
 for(const n of ['browser_navigate','browser_click','browser_type','browser_fill_form','browser_select_option','browser_press_key','browser_handle_dialog','browser_close','browser_evaluate','browser_run_code'])assert.equal(permittedRead(n,{}),false);
 assert.equal(permittedRead('browser_tabs',{action:'select',index:0}),false);
 assert.equal(permittedRead('browser_snapshot',{filename:'private.txt'}),false);
 assert.equal(permittedRead('browser_take_screenshot',{filename:'../../private.png'}),false);
 assert.equal(permittedRead('browser_take_screenshot',{fullPage:true}),false);
});
test('passive waits are bounded and no unexpected arguments allowed',()=>{
 assert.ok(permittedRead('browser_snapshot',{}));assert.ok(permittedRead('browser_take_screenshot',{type:'png'}));
 assert.ok(permittedRead('browser_wait_for',{text:'统计',time:2}));
 for(const a of [{time:6},{time:-1},{time:'5'},{url:'https://example.test'}])assert.equal(permittedRead('browser_wait_for',a),false);
});
test('no login confirmation means no metadata lookup or content read',async()=>{
 let calls=0;const r=await guardedObservation({name:'browser_snapshot',scope,ownerLoginConfirmed:false,getBrowserState:async()=>{calls++;},read:async()=>{calls++;}});
 assert.ok(r.isError);assert.equal(calls,0);
});
test('wrong page prevents content read and does not expose private URLs',async()=>{
 let reads=0;const r=await guardedObservation({name:'browser_snapshot',scope,ownerLoginConfirmed:true,getBrowserState:async()=>({ownedBrowser:true,pages:['https://private.test/login']}),read:async()=>{reads++;}});
 assert.ok(r.isError);assert.equal(reads,0);assert.ok(!JSON.stringify(r).includes('private.test'));
});
test('approved observation is passed through exactly once',async()=>{
 let reads=0;const actual={content:[{type:'text',text:'visible fields'}]};
 const r=await guardedObservation({name:'browser_snapshot',scope,ownerLoginConfirmed:true,getBrowserState:async()=>good,read:async()=>{reads++;return actual;}});
 assert.equal(r,actual);assert.equal(reads,1);
});
test('concurrent navigation withholds content and images from model',async()=>{
 let checks=0;const r=await guardedObservation({name:'browser_snapshot',scope,ownerLoginConfirmed:true,getBrowserState:async()=>++checks===1?good:{ownedBrowser:true,pages:['https://private.test']},read:async()=>({content:[{type:'text',text:'private payload'},{type:'image',data:'secret image'}]})});
 assert.ok(r.isError);assert.ok(!JSON.stringify(r).includes('private payload'));assert.ok(!JSON.stringify(r).includes('secret image'));
});
test('tool error does not trigger a repeated read',async()=>{
 let calls=0;const r=await guardedObservation({name:'browser_snapshot',scope,ownerLoginConfirmed:true,getBrowserState:async()=>good,read:async()=>{calls++;throw Error('unknown');}});
 assert.equal(calls,1);assert.match(r.content[0].text,/READ_OUTCOME_UNKNOWN/);
});
