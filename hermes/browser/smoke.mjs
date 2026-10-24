// Zero-model interface checks. Does not perform the employee's business tasks.
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
const toolRoot=process.env.LINGJU_SMOKE_ROOT;
const python=process.env.LINGJU_ORIGINAL_PYTHON;
const chrome=process.env.LINGJU_CHROME;
if(!toolRoot||!python||!chrome)throw Error('Explicit tool root, original interpreter and Chrome required');
const results={model_calls:0,employee_tasks_performed:false,routes:{}};
const selectedRoute=process.env.LINGJU_SMOKE_ROUTE||'both';
if(!['playwright','both'].includes(selectedRoute))throw Error('Only playwright or both is supported');
async function control(route,caseId){
 const p=spawn(python,['-I','-B',path.join(toolRoot,'launch.py'),'--route',route,'--case',caseId,'--chrome',chrome,'--node',process.execPath],{stdio:['pipe','pipe','pipe'],windowsHide:true});
 const lines=readline.createInterface({input:p.stdout});const queue=[],waiters=[];
 lines.on('line',line=>{try{const j=JSON.parse(line);if(waiters.length)waiters.shift()(j);else queue.push(j);}catch{}});
 let err='';p.stderr.on('data',b=>err+=b);
 const next=()=>new Promise((resolve,reject)=>{if(queue.length){resolve(queue.shift());return;}const timer=setTimeout(()=>reject(Error('Controller timeout: '+err)),60000);waiters.push(j=>{clearTimeout(timer);resolve(j);});});
 const ready=await next();
 assert.equal(ready.event,'run_ready');
 return{p,ready,next,async close(){p.stdin.end('stop\n');await new Promise((resolve,reject)=>{if(p.exitCode!==null){resolve();return;}const t=setTimeout(()=>reject(Error('Controller cleanup timeout')),20000);p.once('exit',()=>{clearTimeout(t);resolve();});});return JSON.parse(await fs.readFile(path.join(ready.output,'lifecycle.json'),'utf8'));}};
}
let ctl,activeClient,activeTransport;
try{
 ctl=await control('playwright','binding');
 const runtime=JSON.parse(await fs.readFile(ctl.ready.runtime,'utf8'));
 const client=new Client({name:'lingju-zero-model-check',version:'0.1.0'});
 const transport=new StdioClientTransport({command:process.execPath,args:[path.join(toolRoot,'bridge.mjs'),ctl.ready.runtime],cwd:runtime.browserOutput,stderr:'pipe'});
 activeClient=client;activeTransport=transport;
 let mcpError='';transport.stderr?.on('data',b=>mcpError+=b);
 await client.connect(transport);
 const schemas=(await client.listTools()).tools;
 const names=schemas.map(x=>x.name);
 for(const n of ['browser_navigate','browser_snapshot','browser_type','browser_fill_form','browser_select_option','browser_tabs','browser_handle_dialog','browser_take_screenshot'])assert.ok(names.includes(n),'Missing '+n);
 assert.ok(!names.includes('browser_run_code'));assert.ok(!names.includes('browser_evaluate'));assert.ok(!names.includes('browser_file_upload'));
 const call=(name,args)=>client.callTool({name,arguments:args},undefined,{timeout:30000});
 const text=r=>r.content.filter(b=>b.type==='text').map(b=>b.text).join('\n');
 const nav=await call('browser_navigate',{url:runtime.origin+'/binding'});assert.ok(!nav.isError,text(nav));
 const snap=await call('browser_snapshot',{}),s=text(snap);
 const ref=s.match(/textbox "项目名称" \[ref=(\w+)\]/)?.[1];assert.ok(ref,'Project name field not in snapshot');
 const typed=await call('browser_type',{element:'项目名称',target:ref,text:'仅零模型接口检查，未提交'});assert.ok(!typed.isError,text(typed));
 const emp=s.match(/combobox "员工" \[ref=(\w+)\]/)?.[1];assert.ok(emp,'Employee selector missing');
 const selected=await call('browser_select_option',{element:'员工',target:emp,values:['EMP-002']});assert.ok(!selected.isError,text(selected));
 const shot=await call('browser_take_screenshot',{type:'png',scale:'css',fullPage:true,filename:'interface-check.png'});
 assert.ok(!shot.isError,text(shot));
 assert.ok(shot.content.some(b=>b.type==='image'),'Screenshot image not delivered');
 const tabs=await call('browser_tabs',{action:'list'});assert.ok(!tabs.isError,text(tabs));
 const after=text(await call('browser_snapshot',{}));
 const dr=after.match(/button "测试页面确认框" \[ref=(\w+)\]/)?.[1];assert.ok(dr,'Dialog test button missing');
 await call('browser_click',{element:'测试页面确认框',target:dr});
 const dialog=await call('browser_handle_dialog',{accept:false});assert.ok(!dialog.isError,text(dialog));
 assert.equal((await call('browser_navigate',{url:'https://outside.invalid/'})).isError,true);
 assert.equal((await call('browser_take_screenshot',{scale:'css',filename:'../outside.png'})).isError,true);
 const truth=JSON.parse(await fs.readFile(path.join(ctl.ready.output,'fixture-truth.json'),'utf8'));
 assert.equal(truth.state.projects.length,0);assert.equal(truth.state.tasks.length,0);
 results.routes.playwright={status:'component_pass',tools:names,screenshot_image_delivered:true,vision_understanding:'unverified',business_records_created:0,output:ctl.ready.output};
 await client.close();await transport.close();activeClient=null;activeTransport=null;
 results.routes.playwright.lifecycle=await ctl.close();ctl=null;
 if(selectedRoute==='both'){
  ctl=await control('native','analysis');
  ctl.p.stdin.write('native-smoke\n');
  const native=await ctl.next();
  results.routes.native={...native,output:ctl.ready.output,status:!native.error&&native.exit_code===0&&native.stdout?.includes('读取与分析')?'component_pass':'component_failed'};
  results.routes.native.lifecycle=await ctl.close();ctl=null;
 }else results.routes.native={status:'not_repeated_after_recorded_failure'};
}catch(e){
 results.error=String(e);results.routes.playwright??={status:'component_failed'};
 process.exitCode=1;
}finally{
 if(activeClient){try{await activeClient.close();}catch{}}
 if(activeTransport){try{await activeTransport.close();}catch{}}
 if(ctl){try{results.cleanup=await ctl.close();}catch(e){results.cleanup_error=String(e);}}
 const out=path.join(toolRoot,'zero-model-smoke.json');await fs.writeFile(out,JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
}
