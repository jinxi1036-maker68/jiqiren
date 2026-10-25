import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {publicSchema,inlineOwnedSnapshot,observeFailure} from '../browser_evidence.mjs';

test('screenshot css default is optional; target requirements survive',()=>{
 const t={name:'browser_take_screenshot',inputSchema:{properties:{scale:{default:'css'},target:{type:'string'}},required:['scale','target']}};
 assert.deepEqual(publicSchema(t).inputSchema.required,['target']);
 assert.deepEqual(t.inputSchema.required,['scale','target']);
});
test('only newly generated snapshot artifacts from owned output are attached',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'lingju-snapshot-'));
 try{
  const p=path.join(root,'page-2026-10-25T00-00-00-000Z.yml');await fs.writeFile(p,'synthetic current page');
  const r={content:[{type:'text',text:'### Snapshot\n- [Snapshot]('+p+')'}]};
  assert.equal((await inlineOwnedSnapshot(r,root,Date.now())).content.length,2);
  const outside={content:[{type:'text',text:'### Snapshot\n- [Snapshot]('+path.join(root,'../private.yml')+')'}]};
  assert.equal(await inlineOwnedSnapshot(outside,root,Date.now()),outside);
  assert.equal(await inlineOwnedSnapshot(r,root,Date.now()+60000),r);
 }finally{
  const actual=await fs.realpath(root),parent=await fs.realpath(os.tmpdir());
  assert.equal(path.dirname(actual),parent);assert.ok(path.basename(actual).startsWith('lingju-snapshot-'));
  await fs.rm(actual,{recursive:true});
 }
});
test('failed action produces one fresh observation and never a repeated click',async()=>{
 const calls=[];const r={isError:true,content:[{type:'text',text:'Timeout cause unknown'}]};
 const out=await observeFailure(r,'browser_click',async(n,a)=>{calls.push([n,a]);return{content:[{type:'text',text:'page1'}]};});
 assert.deepEqual(calls,[['browser_snapshot',{}]]);assert.equal(out.result.isError,true);
 assert.match(out.result.content.at(-1).text,/not repeated/);
});
test('a failed observation cannot recurse or turn the action into success',async()=>{
 let calls=0;const r={isError:true,content:[]};
 const out=await observeFailure(r,'browser_click',async()=>{calls++;throw Error('closed');});
 assert.equal(calls,1);assert.equal(out.result.isError,true);assert.equal(out.observation.isError,true);
 const snap=await observeFailure(r,'browser_snapshot',async()=>{throw Error('must not recurse');});
 assert.equal(snap.observation,null);
});
