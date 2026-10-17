// Gate 1A original-Hermes synthetic tool; inherited loopback boundary is unchanged.
// Bounded MCP bridge. Hermes decides all navigation/snapshot/click calls.
import fs from 'node:fs/promises';
import path from 'node:path';
import {resolveSdk} from './sdk_resolver.mjs';
import {allowedNavigation} from './navigation_policy.mjs';
const runtime=JSON.parse(await fs.readFile(process.argv[2],'utf8'));
if(runtime.sdkPackage)throw Error('Legacy sdkPackage is not supported; explicitly select the neutral sdkAnchorPackage');
const {Client,StdioClientTransport,Server,StdioServerTransport,ListToolsRequestSchema,CallToolRequestSchema}=resolveSdk(runtime.sdkAnchorPackage);
const allow=new Set(['browser_navigate','browser_snapshot','browser_click','browser_close']);
const env={};
for(const key of ['PATH','PATHEXT','SYSTEMROOT','WINDIR','COMSPEC','USERPROFILE','APPDATA','LOCALAPPDATA','TEMP','TMP'])if(process.env[key])env[key]=process.env[key];
env.HERMES_HOME=runtime.profile;
env.PHASE_DEMO_ORIGIN=runtime.origin;
const transport=new StdioClientTransport({command:runtime.node,args:[runtime.mcpCli,'--isolated','--headless','--executable-path',runtime.browser,'--block-service-workers','--allowed-origins',runtime.origin,'--init-page',runtime.guard,'--output-mode','stdout','--output-dir',runtime.browserOutput,'--timeout-action','5000','--timeout-navigation','10000'],env,cwd:runtime.workspace,stderr:'pipe'});
const client=new Client({name:'hermes-phase02a-bounded-browser',version:'1.0.0'});
await client.connect(transport);
transport.stderr?.on('data',()=>{});
const tools=(await client.listTools()).tools.filter(t=>allow.has(t.name)).map(t=>t.name==='browser_navigate'?{...t,description:t.description+'\nThis invocation serves synthetic pages at '+runtime.origin+'/change and '+runtime.origin+'/partial. No other pages or real accounts are authorized.'}:t);
const server=new Server({name:'phase02a-demo-browser',version:'1.0.0'},{capabilities:{tools:{}}});
server.setRequestHandler(ListToolsRequestSchema,async()=>({tools}));
server.setRequestHandler(CallToolRequestSchema,async request=>{
 const {name,arguments:args={}}=request.params;
 let result;
 if(!allow.has(name))result={isError:true,content:[{type:'text',text:'Tool denied by local demo policy'}]};
 else if(name==='browser_navigate'&&!allowedNavigation(args.url,runtime.origin,JSON.parse(await fs.readFile(runtime.navigationScope,'utf8')).paths))result={isError:true,content:[{type:'text',text:'Navigation denied: URL is not an explicitly authorized demo page. No HTTP request was made; no HTTP status was observed. Do not invent a route or status code.'}]};
 else result=await client.callTool({name,arguments:args},undefined,{timeout:25000});
 await fs.appendFile(runtime.trace,JSON.stringify({at:new Date().toISOString(),name,arguments:args,result})+'\n');
 return result;
});
await server.connect(new StdioServerTransport());
const close=async()=>{try{await client.close();await transport.close();}finally{process.exit(0);}};
process.on('SIGTERM',close);process.on('SIGINT',close);process.stdin.on('end',close);

