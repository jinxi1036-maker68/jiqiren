import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readSiteUrl,permittedBrowsingPages,snapshotElement,permittedBrowsingAction,guardedBrowsing,browsingTools,upstreamReadArguments} from '../read_browsing_policy.mjs';
const require=createRequire(import.meta.url),network=require('../read_browsing_init.cjs');
const scope={origin:'https://ldp.lingrobotics.com',paths:['*'],same_site_read_navigation:true};
const pages={ownedBrowser:true,pages:[scope.origin+'/statistics',scope.origin+'/devices?page=2']};
test('read scope discovers multiple same-site pages without accepting other sites or auth',()=>{
 assert.ok(permittedBrowsingPages(pages,scope));assert.ok(readSiteUrl(scope.origin+'/devices?filter=available',scope));
 for(const url of ['https://other.test/devices','https://ldp.lingrobotics.com.evil.test','file:///private','https://ldp.lingrobotics.com/login','https://user:secret@ldp.lingrobotics.com/devices'])assert.equal(readSiteUrl(url,scope),false);
 assert.equal(permittedBrowsingPages({...pages,pages:[...pages.pages,'https://private.test']},scope),false);
});
test('actual page label prevents a renamed destructive button from becoming a read click',()=>{
 const text='- button "系统管理" [ref=e1]\n- button "删除设备" [ref=e2]\n- textbox "搜索名称" [ref=e3]\n- textbox "密码" [ref=e4]';
 assert.ok(permittedBrowsingAction('browser_click',{ref:'e1'},scope,snapshotElement(text,'e1')));
 assert.equal(permittedBrowsingAction('browser_click',{ref:'e2',element:'查看'},scope,snapshotElement(text,'e2')),false);
 assert.ok(permittedBrowsingAction('browser_type',{ref:'e3',text:'合成查询'},scope,snapshotElement(text,'e3')));
 assert.equal(permittedBrowsingAction('browser_type',{ref:'e4',text:'never-send'},scope,snapshotElement(text,'e4')),false);
 assert.equal(permittedBrowsingAction('browser_click',{ref:'stale'},scope,snapshotElement(text,'stale')),false);
});
test('scroll screenshot and existing tabs supported, arbitrary JS and confirmation absent',()=>{
 assert.ok(permittedBrowsingAction('browser_press_key',{key:'PageDown'},scope));
 assert.ok(permittedBrowsingAction('browser_take_screenshot',{fullPage:true},scope));
 assert.ok(permittedBrowsingAction('browser_tabs',{action:'select',index:1},scope));
 for(const [name,args] of [['browser_run_code',{}],['browser_evaluate',{}],['browser_take_screenshot',{filename:'../private.png'}],['browser_handle_dialog',{accept:true}],['browser_press_key',{key:'Enter'}]])assert.equal(permittedBrowsingAction(name,args,scope),false);
 assert.equal(browsingTools.length,10);
});
test('menu click autonomously refreshes reference and executes once',async()=>{
 const calls=[];const r=await guardedBrowsing({name:'browser_click',args:{ref:'e1'},scope,ownerLoginConfirmed:true,getBrowserState:async()=>pages,read:async(name,args,automatic)=>{calls.push({name,automatic});return {content:[{type:'text',text:name==='browser_snapshot'?'- button "系统管理" [ref=e1]':'visible menu'}]};}});
 assert.equal(r.isError,undefined);assert.deepEqual(calls.map(x=>x.name),['browser_snapshot','browser_click']);assert.equal(calls[0].automatic,true);
});
test('out of site result is withheld without retriggering an action',async()=>{
 let reads=0,checks=0;const r=await guardedBrowsing({name:'browser_navigate',args:{url:scope.origin+'/devices'},scope,ownerLoginConfirmed:true,getBrowserState:async()=>++checks===1?pages:{ownedBrowser:true,pages:['https://private.test']},read:async()=>{reads++;return {content:[{type:'text',text:'private value'}]};}});
 assert.equal(reads,1);assert.equal(r.isError,true);assert.ok(!JSON.stringify(r).includes('private value'));
});
test('HTTP gate blocks mutations and other origins before they reach the platform',()=>{
 assert.ok(network.allowedRequest(scope.origin+'/api/devices?page=2','GET'));
 for(const method of ['POST','PUT','PATCH','DELETE'])assert.equal(network.allowedRequest(scope.origin+'/api/devices',method),false);
 assert.equal(network.allowedRequest('https://other.test/api','GET'),false);
 assert.equal(network.allowedRequest(scope.origin+'/api/devices/delete/1','GET'),false);
});
test('read element references match the pinned MCP target schema without bypassing validation',()=>{
 assert.deepEqual(upstreamReadArguments('browser_click',{ref:'e51',element:'系统管理'}),{target:'e51',element:'系统管理'});
 assert.deepEqual(upstreamReadArguments('browser_type',{ref:'e3',text:'synthetic'}),{target:'e3',text:'synthetic'});
 assert.deepEqual(upstreamReadArguments('browser_select_option',{ref:'e4',values:['available']}),{target:'e4',values:['available']});
});
