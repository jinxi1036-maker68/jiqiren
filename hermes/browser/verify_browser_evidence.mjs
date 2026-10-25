// Targeted zero-model checks for new evidence delivery, not Agent acceptance.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const runtimePath=process.argv[2],r=JSON.parse(await fs.readFile(runtimePath,'utf8'));
if(new URL(r.origin).hostname!=='127.0.0.1'||r.case!=='analysis')throw Error('Local analysis fixture only');
const req=createRequire(path.join(r.toolRoot,'package.json'));
const {Client}=req('@modelcontextprotocol/sdk/client/index.js');
const {StdioClientTransport}=req('@modelcontextprotocol/sdk/client/stdio.js');
const c=new Client({name:'lingju-evidence-component-check',version:'0.1.0'});
const t=new StdioClientTransport({command:process.execPath,args:[path.join(r.toolRoot,'bridge.mjs'),runtimePath],cwd:r.browserOutput,stderr:'pipe'});
const text=x=>(x.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('\n');
const result={at:new Date().toISOString(),model_calls:0,agent_acceptance:false};
try{
 const priorTrace=await fs.readFile(r.trace,'utf8').catch(e=>{if(e.code==='ENOENT')return '';throw e;});
 const priorRows=priorTrace.trim()?priorTrace.trim().split('\n').length:0;
 await c.connect(t);
 const schemas=(await c.listTools()).tools;
 assert.equal(schemas.length,13);
 assert.ok(!schemas.find(x=>x.name==='browser_take_screenshot').inputSchema.required?.includes('scale'));
 assert.ok(schemas.find(x=>x.name==='browser_click').inputSchema.required.includes('target'));
 const call=(name,arguments_)=>c.callTool({name,arguments:arguments_},undefined,{timeout:20000});
 const nav=await call('browser_navigate',{url:r.origin+'/analysis'});
 assert.match(text(nav),/Current browser-generated snapshot/);
 assert.match(text(nav),/下一页/);
 const bad=await call('browser_click',{element:'Deliberately absent synthetic diagnostic button',target:'button#not-present-diagnostic'});
 assert.equal(bad.isError,true);
 assert.match(text(bad),/Observation after failed or uncertain action/);
 assert.match(text(bad),/not repeated/);
 const rows=(await fs.readFile(r.trace,'utf8')).trim().split('\n').slice(priorRows).map(JSON.parse);
 const automatic=rows.filter(x=>x.automatic_observation_only&&x.triggered_by==='browser_click');
 assert.equal(automatic.length,1);
 assert.equal(rows.filter(x=>x.name==='browser_click'&&x.arguments.target==='button#not-present-diagnostic').length,1);
 const shot=await call('browser_take_screenshot',{type:'png',fullPage:true});
 assert.ok(!shot.isError);assert.ok(shot.content.some(x=>x.type==='image'));
 const next=await call('browser_click',{element:'Synthetic next button',target:'button#next'});
 assert.ok(!next.isError,text(next));
 const events=(await fs.readFile(path.join(path.dirname(runtimePath),'fixture-events.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);
 assert.ok(events.some(x=>x.type==='records_page'&&x.page===2&&x.status===200));
 Object.assign(result,{passed:true,tools:13,inline_snapshot:true,screenshot_default_css:true,
  screenshot_image_delivered:true,failed_action_not_repeated:true,one_failure_observation:true,
  valid_next_page_click:true,initial_timeout_root_cause:'not reproduced; unknown'});
}catch(e){result.passed=false;result.error=String(e);process.exitCode=1;}
finally{
 await c.close().catch(()=>{});await t.close().catch(()=>{});
 await fs.writeFile(path.join(path.dirname(runtimePath),'browser-evidence-check.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify(result,null,2));
}
