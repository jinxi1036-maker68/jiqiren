// Non-business integration test of the installed Playwright MCP component.
// Uses an isolated headless browser and loopback fixture; no Hermes config edit.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';

const output = path.resolve(process.argv[2] || 'work/hermes_phase01/browser_test');
const home = os.homedir();
const mcpRoot=path.join(home,'.hermes','tools','playwright-mcp');
const sdkRequire=createRequire(path.join(home,'.hermes','tools','xianyu-browser-tools','package.json'));
const {Client}=sdkRequire('@modelcontextprotocol/sdk/client/index.js');
const {StdioClientTransport}=sdkRequire('@modelcontextprotocol/sdk/client/stdio.js');
const executableCandidates=[
 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
 'C:/Program Files/Google/Chrome/Application/chrome.exe'
];
const exists=async p=>{try{await fs.access(p);return true;}catch{return false;}};
let executable;
for(const p of executableCandidates)if(await exists(p)){executable=p;break;}
if(!executable)throw new Error('No existing browser executable found; installation is prohibited by this audit');
await fs.mkdir(output,{recursive:true});
const dummy='task_id,status\nDEMO-001,pending\nDEMO-002,approved\n';
const dummyPath=path.join(output,'demo-upload.csv');await fs.writeFile(dummyPath,dummy,'utf8');
const facts={started_at:new Date().toISOString(),scope:'isolated existing Playwright MCP component; not an autonomous Hermes agent or business-system test',no_business_site_access:true,no_original_config_edit:true,tests:[]};
const requests=[]; let uploaded=null;
const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; img-src data:"><title>PHASE 01 local demo</title><style>body{font:18px sans-serif;max-width:900px;margin:36px auto}table{border-collapse:collapse;width:100%}td,th{padding:12px;border:1px solid #999}section{margin:22px 0}label,button,a{margin:8px}input,button{font-size:18px}</style><h1>Hermes Phase 01 local demo</h1><p>Fictional records only. No business accounts or employee data.</p><table id="reviews"><thead><tr><th>Task ID</th><th>Status</th><th>QA note</th></tr></thead><tbody><tr><td>DEMO-001</td><td id="review-status">pending</td><td id="qa-note">none</td></tr><tr><td>DEMO-002</td><td>approved</td><td>none</td></tr></tbody></table><section><label>Audit note <input id="note" aria-label="Audit note"></label><button id="apply">Apply note</button><p id="note-result"></p><button id="refresh">Simulate returned QA</button></section><section><label>Dummy upload <input id="file" type="file" aria-label="Dummy upload"></label><button id="upload">Upload demo file</button><p id="upload-result"></p><a id="download" href="/download">Download demo CSV</a><a href="/second">Second demo page</a></section><script>document.querySelector('#apply').onclick=()=>{document.querySelector('#note-result').textContent='Saved note: '+document.querySelector('#note').value};document.querySelector('#refresh').onclick=()=>{document.querySelector('#review-status').textContent='approved';document.querySelector('#qa-note').textContent='DEMO QA returned'};document.querySelector('#upload').onclick=async()=>{const f=document.querySelector('#file').files[0];if(!f){document.querySelector('#upload-result').textContent='No file';return;}const r=await fetch('/upload',{method:'POST',body:f});const d=await r.json();document.querySelector('#upload-result').textContent='Uploaded '+d.bytes+' bytes'};</script></html>`;
const server=http.createServer(async(req,res)=>{
 requests.push({method:req.method,path:req.url});
 if(req.url==='/upload'&&req.method==='POST'){
  const chunks=[];for await(const chunk of req)chunks.push(chunk);
  const bytes=Buffer.concat(chunks);uploaded={bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
  res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(uploaded));return;
 }
 if(req.url==='/download'){res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="phase01-demo.csv"'});res.end(dummy);return;}
 if(req.url==='/second'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end('<h1>Second demo page</h1><a href="/">Back to demo</a>');return;}
 if(req.url==='/'||req.url==='/favicon.ico'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(req.url==='/'?html:'');return;}
 res.writeHead(404);res.end('Not found');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=server.address().port;
const origin=`http://127.0.0.1:${port}`;
const childEnv={};
for(const k of ['PATH','PATHEXT','SYSTEMROOT','WINDIR','COMSPEC','USERPROFILE','APPDATA','LOCALAPPDATA','TEMP','TMP'])if(process.env[k])childEnv[k]=process.env[k];
childEnv.HERMES_HOME=path.join(output,'isolated-home');
const transport=new StdioClientTransport({command:process.execPath,args:[path.join(mcpRoot,'node_modules','@playwright','mcp','cli.js'),'--isolated','--headless','--executable-path',executable,'--block-service-workers','--allowed-origins',origin,'--output-dir',output,'--caps','vision','--timeout-action','5000','--timeout-navigation','15000'],env:childEnv,stderr:'pipe',cwd:output});
const client=new Client({name:'hermes-phase01-readonly-audit',version:'1.0.0'});
const textOf=result=>(result.content||[]).filter(x=>x.type==='text').map(x=>x.text).join('\n');
const assert=(ok,message)=>{if(!ok)throw new Error(message);};
const record=(name,ok,details={})=>facts.tests.push({name,passed:!!ok,...details});
let stderr='';
const call=async(name,args={})=>{const r=await client.callTool({name,arguments:args},undefined,{timeout:25000});if(r.isError)throw new Error(name+': '+textOf(r));return r;};
const snap=async()=>textOf(await call('browser_snapshot'));
const refFor=(snapshot,label)=>{
 const line=snapshot.split('\n').find(x=>x.includes('"'+label+'"')&&/\[ref=/.test(x));
 const match=line?.match(/\[ref=([^\]]+)\]/);if(!match)throw new Error('No current snapshot ref for '+label);return match[1];
};
try{
 await client.connect(transport);transport.stderr?.on('data',chunk=>{stderr+=chunk.toString();});
 const tools=(await client.listTools()).tools;
 facts.mcp_tool_count=tools.length;facts.mcp_tool_names=tools.map(x=>x.name);
 facts.mcp_server_version=JSON.parse(await fs.readFile(path.join(mcpRoot,'node_modules','@playwright','mcp','package.json'),'utf8')).version;
 await fs.writeFile(path.join(output,'tool_schemas.json'),JSON.stringify(tools,null,2));
 record('MCP initialization and tool discovery',tools.length>0);
 await call('browser_navigate',{url:origin+'/'});
 let state=await snap();assert(state.includes('Hermes Phase 01 local demo')&&state.includes('DEMO-001'),'Initial DOM not found');
 record('Navigate and read DOM/text',true);
 await call('browser_type',{element:'Audit note input',target:refFor(state,'Audit note'),text:'phase01-safe-demo'});
 state=await snap();
 await call('browser_click',{element:'Apply note',target:refFor(state,'Apply note')});
 state=await snap();assert(state.includes('Saved note: phase01-safe-demo'),'Input/click result missing');
 record('Input and click with current DOM references',true);
 assert(state.includes('pending'),'Pending fixture state missing');
 await call('browser_click',{element:'Simulate returned QA',target:refFor(state,'Simulate returned QA')});
 state=await snap();assert(state.includes('DEMO QA returned'),'New QA state missing');
 record('Observe pending-to-reviewed transition',true,{note:'Synthetic transition only; not production polling, persistence or notification'});
 const tableResult=await call('browser_evaluate',{function:'() => Array.from(document.querySelectorAll("#reviews tbody tr")).map(r => Array.from(r.cells).map(c => c.textContent))'});
 const tableText=textOf(tableResult);assert(tableText.includes('DEMO-001')&&tableText.includes('DEMO QA returned'),'DOM table extraction failed');
 record('Parse synthetic HTML table',true,{rows:2});
 await call('browser_click',{element:'Dummy upload input',target:refFor(state,'Dummy upload')});
 await call('browser_file_upload',{paths:[dummyPath]});
 state=await snap();
 await call('browser_click',{element:'Upload demo file',target:refFor(state,'Upload demo file')});
 state=await snap();
 const expected=crypto.createHash('sha256').update(dummy).digest('hex');
 assert(uploaded?.sha256===expected,'Loopback upload byte/hash mismatch');
 record('Upload dummy CSV to loopback server',true,{bytes:uploaded.bytes,sha256:uploaded.sha256});
 await call('browser_take_screenshot',{type:'png',scale:'css',filename:'audit-demo.png',fullPage:true});
 const screenshot=await fs.readFile(path.join(output,'audit-demo.png'));
 assert(screenshot.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&screenshot.length>1000,'Screenshot invalid');
 record('Screenshot',true,{bytes:screenshot.length,artifact:'audit-demo.png'});
 state=await snap();await call('browser_click',{element:'Download demo CSV',target:refFor(state,'Download demo CSV')});
 await snap();
 const findCsv=async(dir)=>{const matches=[];for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())matches.push(...await findCsv(p));else if(e.name==='phase01-demo.csv')matches.push(p);}return matches;};
 const downloads=await findCsv(output);
 assert(downloads.length>0,'Downloaded file not found');
 const bytes=await fs.readFile(downloads[0]);assert(crypto.createHash('sha256').update(bytes).digest('hex')===expected,'Download hash mismatch');
 record('Download dummy CSV and verify bytes',true,{bytes:bytes.length,sha256:expected});
 await call('browser_navigate',{url:origin+'/second'});state=await snap();assert(state.includes('Second demo page'),'Second page missing');
 await call('browser_navigate_back');state=await snap();assert(state.includes('Hermes Phase 01 local demo'),'Back navigation failed');
 record('Navigate back',true);
 facts.completed=true;
}catch(error){facts.completed=false;facts.error=String(error.message).replaceAll(home,'<USER_HOME>');}
finally{
 try{await client.close();}catch{}
 try{await transport.close();}catch{}
 server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
 facts.loopback_request_log=requests;facts.finished_at=new Date().toISOString();
 await fs.writeFile(path.join(output,'test_results.json'),JSON.stringify(facts,null,2));
 if(stderr)await fs.writeFile(path.join(output,'stderr_local_only.txt'),stderr);
 console.log(JSON.stringify(facts,null,2));
}
if(!facts.completed)process.exitCode=1;
