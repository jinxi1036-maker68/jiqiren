// Protocol-only probe through the unchanged original registered wrapper.
// Does not start a browser, Agent, model request or gateway.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const home=os.homedir(),root=path.join(home,'.hermes','tools','company-browser');
const entry=path.join(root,'work-entry','entry.json');
const cfg=JSON.parse(await fs.readFile(entry,'utf8'));
assert.equal(cfg.toolRoot,root);assert.equal(cfg.mode,'synthetic-only');
const req=createRequire(path.join(root,'package.json'));
const {Client}=req('@modelcontextprotocol/sdk/client/index.js');
const {StdioClientTransport}=req('@modelcontextprotocol/sdk/client/stdio.js');
const env={};for(const k of ['PATH','PATHEXT','SYSTEMROOT','WINDIR','COMSPEC','USERPROFILE','APPDATA','LOCALAPPDATA','TEMP','TMP'])if(process.env[k])env[k]=process.env[k];
env.XDG_LINGJU_BROWSER_RUNTIME=entry;
env.HERMES_HOME=path.join(home,'.hermes');
const transport=new StdioClientTransport({command:path.join(home,'AppData','Local','hermes','hermes-agent','venv','Scripts','python.exe'),
 args:['-I','-B',path.join(home,'.hermes','tools','company-browser-simulation','launch_bridge.py')],
 cwd:root,env,stderr:'pipe'});
let stderrBytes=0;transport.stderr?.on('data',b=>stderrBytes+=b.length);
const client=new Client({name:'stable-entry-zero-model-probe',version:'0.1.0'});
let result;
try{
 await client.connect(transport);
 const before=(await client.listTools()).tools;
 assert.equal(before.length,13);assert.ok(!before.some(t=>['browser_run_code','browser_evaluate','browser_file_upload'].includes(t.name)));
 const denied=await client.callTool({name:'browser_snapshot',arguments:{}},undefined,{timeout:15000});
 assert.equal(denied.isError,true);
 assert.match(denied.content.filter(b=>b.type==='text').map(b=>b.text).join('\n'),/WORKPLACE_CLOSED/);
 assert.deepEqual((await client.listTools()).tools,before);
 result={passed:true,original_registered_wrapper:true,tools_before:13,tools_after:13,
  closed_workplace_call:'WORKPLACE_CLOSED',no_browser_or_fixture_started:true,
  model_requests:0,Hermes_messages:0,gateway_restarts:0,stderr_bytes:stderrBytes};
}finally{await client.close().catch(()=>{});await transport.close().catch(()=>{});}
await fs.writeFile(path.join(root,'work-entry','zero-model-probe.json'),JSON.stringify({at:new Date().toISOString(),...result},null,2)+'\n');
console.log(JSON.stringify(result));
