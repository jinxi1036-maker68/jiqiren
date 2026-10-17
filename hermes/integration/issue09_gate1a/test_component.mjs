// Gate 1A component acceptance only. These are scripted probes, not Agent tasks.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {resolveSdk} from './sdk_resolver.mjs';

const templatePath=path.resolve(process.argv[2]);
const template=JSON.parse(fs.readFileSync(templatePath,'utf8'));
const root=path.dirname(templatePath);
const sdk=resolveSdk(template.sdkAnchorPackage);
const python=process.env.GATE1A_PYTHON;
if(!python)throw Error('Explicit existing interpreter is required');
const transport=new sdk.StdioClientTransport({command:python,args:['-I','-B',path.join(root,'launch_bridge.py'),templatePath],stderr:'pipe'});
const client=new sdk.Client({name:'gate1a-scripted-component-probe',version:'1.0.0'});
const results={kind:'component_only_no_agent_no_model',started_at_utc:new Date().toISOString(),checks:[]};
let origin;
const text=r=>r.content?.filter(x=>x.type==='text').map(x=>x.text).join('\n')||'';
const call=async(name,args={})=>{const r=await client.callTool({name,arguments:args},undefined,{timeout:30000});if(r.isError)throw Error(text(r));return text(r);};
const click=async(snapshot,label)=>{
 const line=snapshot.split('\n').find(x=>x.includes('button "'+label+'"'));
 const ref=line?.match(/\[ref=([^\]]+)\]/)?.[1];
 assert.ok(ref,'DOM must expose the requested synthetic button');
 await call('browser_click',{target:ref,element:label});
 return call('browser_snapshot');
};
try{
 transport.stderr?.on('data',()=>{});
 await client.connect(transport);
 const tools=(await client.listTools()).tools;
 assert.deepEqual(tools.map(x=>x.name).sort(),['browser_click','browser_close','browser_navigate','browser_snapshot']);
 origin=tools.find(x=>x.name==='browser_navigate').description.match(/http:\/\/127\.0\.0\.1:\d+/)[0];
 results.checks.push('real stdio through Python owned Job, neutral SDK 1.30.0, real Playwright MCP; exactly four browser tools');
 await call('browser_navigate',{url:origin+'/change'});
 let dom=await call('browser_snapshot');
 dom=await click(dom,'查看审核列表');
 assert.match(dom,/DEMO-001/);assert.match(dom,/待审/);
 dom=await click(dom,'刷新演示审核结果');
 assert.match(dom,/cell "DEMO-001"[\s\S]*?cell "已审"[\s\S]*?cell "模拟通过"[\s\S]*?cell "DEMO-002"/);
 results.checks.push('real headless browser reads baseline and changed QA from synthetic DOM');
 await call('browser_navigate',{url:origin+'/partial'});
 dom=await call('browser_snapshot');
 dom=await click(dom,'查看审核列表');
 dom=await click(dom,'下一页');
 dom=await call('browser_snapshot');
 assert.match(dom,/第2页读取失败 HTTP 503/);
 results.checks.push('synthetic partial paging exposes HTTP 503 and unread page evidence');
 for(const [name,args] of [['browser_navigate',{url:'https://example.invalid/'}],['browser_navigate',{url:origin+'/invented'}],['browser_evaluate',{function:'()=>1'}]]){
  const denied=await client.callTool({name,arguments:args});assert.equal(denied.isError,true);
 }
 results.checks.push('external navigation, guessed same-origin path and evaluate denied');
 await call('browser_close');
}finally{
 await client.close();await transport.close();
}
for(let i=0;i<30;i++){
 const runs=fs.existsSync(path.join(root,'runs'))?fs.readdirSync(path.join(root,'runs')).sort():[];
 const latest=runs.at(-1);if(!latest)throw Error('No component run evidence');
 const run=path.join(root,'runs',latest);
 const life=JSON.parse(fs.readFileSync(path.join(run,'lifecycle.json'),'utf8'));
 if(life.closed_at_utc){
  assert.equal(life.children_exited,true);assert.notEqual(life.cleanup_timeout,true);
  results.checks.push('owned bridge and fixture processes exit; Windows Job closes its child tree');
  results.run_id=latest;results.lifecycle=life;
  const requests=fs.readFileSync(path.join(run,'requests.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
  assert.ok(requests.every(x=>['/change','/partial','/api/page2','/favicon.ico'].includes(x.path)));
  results.requests=requests;break;
 }
 await new Promise(r=>setTimeout(r,100));
}
assert.equal(results.checks.length,5,'Lifecycle cleanup must be observed');
results.completed_at_utc=new Date().toISOString();results.passed=true;
fs.writeFileSync(process.argv[3],JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify({passed:true,kind:results.kind,checks:results.checks,run_id:results.run_id}));
