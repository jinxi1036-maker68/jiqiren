import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {resolveSdk} from './sdk_resolver.mjs';
const root=path.resolve(process.env.HERMES_PREP_TEST_ROOT);
const anchor=path.join(root,'neutral-sdk/package.json');
test('neutral pinned SDK imports without old business modules',()=>{
 const sdk=resolveSdk(anchor);assert.equal(sdk.sdkVersion,'1.30.0');assert.equal(typeof sdk.Client,'function');assert.equal(typeof sdk.Server,'function');
 const req=createRequire(import.meta.url);assert.equal(Object.keys(req.cache).filter(x=>x.toLowerCase().includes('xianyu-browser-tools')).length,0);
});
test('missing explicit neutral anchor is rejected',()=>assert.throws(()=>resolveSdk(undefined),/required/));
test('old business anchor is rejected before imports',()=>assert.throws(()=>resolveSdk(path.join(os.homedir(),'.hermes/tools/xianyu-browser-tools/package.json')),/forbidden/));
test('adapted bridge negotiates over stdio and keeps simulated boundaries',async()=>{
 const sdk=resolveSdk(anchor);const code=path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
 const workspace=path.join(root,'component-workspace');fs.mkdirSync(workspace,{recursive:true});
 const scope=path.join(workspace,'scope.json');fs.writeFileSync(scope,JSON.stringify({paths:['/sample']}));
 const trace=path.join(workspace,'trace.jsonl');const runtime=path.join(workspace,'runtime.json');
 const fixture=path.join(workspace,'mock_entry.mjs');
 fs.writeFileSync(fixture,'import {startMock} from '+JSON.stringify(pathToFileURL(path.join(code,'mock_mcp.mjs')).href)+'; await startMock('+JSON.stringify(anchor)+');');
 fs.writeFileSync(runtime,JSON.stringify({sdkAnchorPackage:anchor,profile:path.join(workspace,'scratch-home'),node:process.execPath,mcpCli:fixture,browser:'unused-in-mock',guard:path.join(code,'loopback_guard.cjs'),origin:'http://127.0.0.1:61937',browserOutput:path.join(workspace,'output'),workspace,navigationScope:scope,trace}));
 const env={};for(const key of ['PATH','PATHEXT','SYSTEMROOT','WINDIR','COMSPEC','USERPROFILE','APPDATA','LOCALAPPDATA','TEMP','TMP'])if(process.env[key])env[key]=process.env[key];
 const transport=new sdk.StdioClientTransport({command:process.execPath,args:[path.join(code,'browser_bridge.mjs'),runtime],env,stderr:'pipe'});
 const client=new sdk.Client({name:'neutral-bridge-check',version:'0.0.0'});
 try{
  transport.stderr?.on('data',()=>{});await client.connect(transport);
  const names=(await client.listTools()).tools.map(x=>x.name).sort();assert.deepEqual(names,['browser_click','browser_close','browser_navigate','browser_snapshot']);
  const valid=await client.callTool({name:'browser_navigate',arguments:{url:'http://127.0.0.1:61937/sample'}});assert.match(valid.content[0].text,/MOCK DOM/);
  const outside=await client.callTool({name:'browser_navigate',arguments:{url:'https://example.invalid/'}});assert.equal(outside.isError,true);assert.match(outside.content[0].text,/No HTTP request/);
  assert.equal((await client.callTool({name:'browser_evaluate',arguments:{function:'() => 1'}})).isError,true);
  assert.equal((await client.callTool({name:'browser_navigate',arguments:{url:'http://127.0.0.1:61937/guessed'}})).isError,true);
 }finally{await client.close();await transport.close();}
});

