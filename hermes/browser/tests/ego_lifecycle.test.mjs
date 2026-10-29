import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {singleFlight,releaseOwnedLease,releaseStoppedStart} from '../ego/lifecycle.mjs';
import {run} from '../ego/worker.mjs';
async function removeFixture(dir,prefix){
 const resolved=path.resolve(dir),parent=path.resolve(os.tmpdir());
 assert.equal(path.dirname(resolved),parent);assert.ok(path.basename(resolved).startsWith(prefix));
 const stat=await fs.lstat(resolved);assert.ok(stat.isDirectory()&&!stat.isSymbolicLink());
 await fs.rm(resolved,{recursive:true,force:true});
}
test('simultaneous initialization starts only once',async()=>{
 let count=0,finish;const ready=new Promise(r=>finish=r);
 const start=singleFlight(async()=>{count++;await ready;return 'ok';});
 const a=start(),b=start();assert.equal(a,b);finish();
 assert.deepEqual(await Promise.all([a,b]),['ok','ok']);assert.equal(count,1);
});
test('rejected initialization does not poison future authorized attempts',async()=>{
 let count=0;const start=singleFlight(async()=>{if(++count===1)throw Error('synthetic startup failure');return 'ready';});
 await assert.rejects(start(),/synthetic/);assert.equal(await start(),'ready');assert.equal(count,2);
});
test('lease cleanup is nonce-owned and never releases a still-running child',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ego-lease-')),file=path.join(dir,'lock');
 try{
  await fs.writeFile(file,JSON.stringify({nonce:'owner'}));
  assert.equal(await releaseOwnedLease(file,'another'),false);
  assert.equal(await releaseStoppedStart(file,'owner',{pid:1,exitCode:null,signalCode:null}),false);
  assert.equal(await releaseStoppedStart(file,'owner',{pid:1,exitCode:1,signalCode:null}),true);
  assert.equal(await releaseOwnedLease(file,'owner'),false);
  await fs.writeFile(file,'malformed');assert.equal(await releaseOwnedLease(file,'owner'),false);
  assert.equal(await fs.readFile(file,'utf8'),'malformed');
 }finally{await removeFixture(dir,'ego-lease-');}
});
test('real worker startup exception releases its own lease without finishing a space',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ego-start-')),file=path.join(dir,'lock'),runtime=path.join(dir,'runtime.json');
 const original=globalThis.taskSpace;let called=0;
 try{
  const cfg={schema:'lingju.ego-browser.v1',mode:'synthetic',productionEnabled:false,origin:'http://127.0.0.1:12345',spaceId:1,
   cliVersion:'0.6.1.13',cliSha256:'a'.repeat(64),guideSha256:'b'.repeat(64),approvalReference:'synthetic unit',home:'H',workspace:'W'};
  await fs.writeFile(runtime,JSON.stringify(cfg));await fs.writeFile(file,JSON.stringify({nonce:'owner'}));
  globalThis.taskSpace=async()=>{called++;throw Error('synthetic native connection failure');};
  await assert.rejects(run(runtime,{file,nonce:'owner'}),/synthetic native connection/);
  assert.equal(called,1);await assert.rejects(fs.stat(file),{code:'ENOENT'});
 }finally{globalThis.taskSpace=original;await removeFixture(dir,'ego-start-');}
});
