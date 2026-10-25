import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {attachScreenshot} from '../image_result.mjs';
import {visualPng} from '../fixture.mjs';
async function output(){await fs.mkdir('.local',{recursive:true});return fs.mkdtemp(path.resolve('.local','image-test-'));}
test('a saved synthetic screenshot is attached as an actual image block',async()=>{
 const root=await output();await fs.writeFile(path.join(root,'shot.png'),visualPng('47'));
 const r=await attachScreenshot({content:[{type:'text',text:'Saved screenshot'}]},{filename:'shot.png'},root);
 assert.equal(r.content[1].type,'image');assert.equal(r.content[1].mimeType,'image/png');
 assert.ok(Buffer.from(r.content[1].data,'base64').equals(visualPng('47')));
});
test('existing image blocks are preserved without another file read',async()=>{
 const root=await output(),r={content:[{type:'image',mimeType:'image/png',data:'AA=='}]};
 assert.equal(await attachScreenshot(r,{filename:'not-there.png'},root),r);
});
test('failed screenshot results never attach a stale image',async()=>{
 const root=await output(),r={isError:true,content:[]};
 assert.equal(await attachScreenshot(r,{filename:'not-there.png'},root),r);
});
test('non-image files cannot be used as screenshot attachments',async()=>{
 const root=await output();await fs.writeFile(path.join(root,'fake.png'),'synthetic non-image');
 await assert.rejects(attachScreenshot({content:[]},{filename:'fake.png'},root),/not a supported image/);
});
test('screenshot attachment rejects paths outside the run output',async()=>{
 const root=await output();await fs.writeFile(path.join(root,'..','outside.png'),visualPng('47'));
 await assert.rejects(attachScreenshot({content:[]},{filename:'../outside.png'},root),/escaped/);
});
