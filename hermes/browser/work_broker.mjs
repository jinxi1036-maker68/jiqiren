import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import os from 'node:os';
import {WorkBroker} from './work_broker_core.mjs';

const root=path.dirname(fileURLToPath(import.meta.url));
const entry=path.resolve(process.argv[2]);
if(entry!==path.join(root,'work-entry','entry.json'))throw Error('Fixed owned entry required');
const cfg=JSON.parse(fs.readFileSync(entry,'utf8'));
if(cfg.toolRoot!==root||cfg.schema!=='lingju.browser.work-entry.v1')throw Error('Entry mismatch');
const env={};for(const k of ['PATH','PATHEXT','SYSTEMROOT','WINDIR','COMSPEC','USERPROFILE','APPDATA','LOCALAPPDATA','TEMP','TMP'])if(process.env[k])env[k]=process.env[k];
const exec=promisify(execFile);
const python=path.join(os.homedir(),'AppData','Local','hermes','hermes-agent','venv','Scripts','python.exe');
async function inspect(){
 const {stdout}=await exec(python,['-I','-B',path.join(root,'work_entry.py'),'--entry',entry],
  {env,cwd:root,windowsHide:true,timeout:8000,maxBuffer:65536});
 return JSON.parse(stdout);
}
// Validate before loading even the catalog, without creating a browser.
const initial=await inspect();
if(initial.code==='ENTRY_CHECK_FAILED')throw Error('Entry validation failed');
const req=createRequire(path.join(root,'package.json'));
const sdkRoot=fs.realpathSync(path.join(root,'node_modules','@modelcontextprotocol','sdk'));
if(JSON.parse(fs.readFileSync(path.join(sdkRoot,'package.json'))).version!=='1.30.0')throw Error('Pinned SDK required');
const load=p=>{const f=fs.realpathSync(req.resolve('@modelcontextprotocol/sdk/'+p));if(!f.startsWith(sdkRoot+path.sep))throw Error('SDK escaped root');return req(f);};
const {Client}=load('client/index.js'),{StdioClientTransport}=load('client/stdio.js');
const {Server}=load('server/index.js'),{StdioServerTransport}=load('server/stdio.js');
const {ListToolsRequestSchema,CallToolRequestSchema}=load('types.js');
const tools=JSON.parse(fs.readFileSync(cfg.catalog,'utf8')).tools;
const canonical=t=>JSON.stringify(t.map(x=>({name:x.name,inputSchema:x.inputSchema})).sort((a,b)=>a.name.localeCompare(b.name)));
const broker=new WorkBroker({tools,inspect,record:async e=>{
 fs.appendFileSync(path.join(root,'work-entry','receipts.jsonl'),JSON.stringify({at:new Date().toISOString(),...e})+'\n');
},connect:async observed=>{
 const client=new Client({name:'lingju-stable-workplace',version:'0.1.0'});
 const transport=new StdioClientTransport({command:cfg.node,args:[path.join(root,'bridge.mjs'),observed.runtime],
  env,cwd:root,stderr:'pipe'});
 // Never write raw upstream stderr to the protocol stream.
 transport.stderr?.on('data',()=>{});
 try{
  await client.connect(transport,{timeout:25000});
  if(canonical((await client.listTools()).tools)!==canonical(tools))throw Error('Worker tool schemas changed');
  return {call:(name,args)=>client.callTool({name,arguments:args},undefined,{timeout:30000}),
   close:async()=>{await client.close().catch(()=>{});await transport.close().catch(()=>{});}};
 }catch(e){await client.close().catch(()=>{});await transport.close().catch(()=>{});throw e;}
}});
const server=new Server({name:'lingju-stable-company-browser',version:'0.1.0'},{capabilities:{tools:{}}});
server.setRequestHandler(ListToolsRequestSchema,async()=>broker.list());
server.setRequestHandler(CallToolRequestSchema,async r=>broker.call(r.params.name,r.params.arguments));
await server.connect(new StdioServerTransport());
let closing=false;
const close=async()=>{if(closing)return;closing=true;await broker.close();await server.close().catch(()=>{});process.exit(0);};
process.on('SIGINT',close);process.on('SIGTERM',close);process.stdin.on('end',close);
