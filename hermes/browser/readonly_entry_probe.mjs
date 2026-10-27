// No business-content call: the draft grant is deliberately unapproved.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const runtime=path.resolve(process.argv[2]);
const home=os.homedir(),root=path.join(home,'.hermes','tools','company-browser');
assert.ok(runtime.startsWith(path.join(root,'runs')+path.sep));
const r=JSON.parse(await fs.readFile(runtime,'utf8'));
assert.equal(JSON.parse(await fs.readFile(r.grant,'utf8')).Owner_model_and_reload_approved,false);
const req=createRequire(path.join(root,'package.json'));
const {Client}=req('@modelcontextprotocol/sdk/client/index.js');
const {StdioClientTransport}=req('@modelcontextprotocol/sdk/client/stdio.js');
const env={};for(const k of ['PATH','PATHEXT','SYSTEMROOT','WINDIR','COMSPEC','USERPROFILE','APPDATA','LOCALAPPDATA','TEMP','TMP'])if(process.env[k])env[k]=process.env[k];
env.XDG_LINGJU_BROWSER_RUNTIME=runtime;env.HERMES_HOME=path.join(home,'.hermes');
const transport=new StdioClientTransport({command:path.join(home,'AppData','Local','hermes','hermes-agent','venv','Scripts','python.exe'),args:['-I','-B',path.join(home,'.hermes','tools','company-browser-simulation','launch_bridge.py')],env,cwd:root,stderr:'pipe'});
let stderrBytes=0;transport.stderr?.on('data',b=>stderrBytes+=b.length);
const client=new Client({name:'readonly-entry-no-content-probe',version:'0.1.0'});
let result;
try{
 await client.connect(transport);const tools=(await client.listTools()).tools;
 assert.deepEqual(tools.map(t=>t.name).sort(),['browser_snapshot','browser_take_screenshot','browser_tabs','browser_wait_for'].sort());
 const denied=await client.callTool({name:'browser_snapshot',arguments:{}},undefined,{timeout:15000});
 assert.equal(denied.isError,true);assert.match(denied.content[0].text,/READ_ONLY_NOT_OPEN/);
 assert.equal((await client.listTools()).tools.length,4);
 result={passed:true,original_registered_entry:true,passive_tools:4,unapproved_call_denied:true,
  page_body_reads:0,model_requests:0,Hermes_messages:0,gateway_restarts:0,stderr_bytes:stderrBytes};
}finally{await client.close().catch(()=>{});await transport.close().catch(()=>{});}
await fs.writeFile(path.join(path.dirname(runtime),'readonly-protocol-probe.json'),JSON.stringify({at:new Date().toISOString(),...result},null,2)+'\n');
console.log(JSON.stringify(result));
