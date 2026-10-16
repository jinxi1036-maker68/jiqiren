// Component boundary test; separate from Hermes autonomous acceptance runs.
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const r=JSON.parse(await fs.readFile(process.argv[2],'utf8'));
const req=createRequire(r.sdkPackage);
const {Client}=req('@modelcontextprotocol/sdk/client/index.js');
const {StdioClientTransport}=req('@modelcontextprotocol/sdk/client/stdio.js');
const transport=new StdioClientTransport({command:r.node,args:[new URL('./browser_bridge.mjs',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'),process.argv[2]],stderr:'pipe'});
const client=new Client({name:'phase02-policy-test',version:'1.0.0'});
try{
 await client.connect(transport);transport.stderr?.on('data',()=>{});
 const tools=(await client.listTools()).tools.map(t=>t.name);
 const deniedCode=await client.callTool({name:'browser_evaluate',arguments:{function:'() => 1'}});
 const deniedUrl=await client.callTool({name:'browser_navigate',arguments:{url:'https://example.org/'}});
 const deniedGuess=await client.callTool({name:'browser_navigate',arguments:{url:r.origin+'/refresh'}});
 const passed=tools.length===4&&!tools.includes('browser_evaluate')&&deniedCode.isError&&deniedUrl.isError&&deniedGuess.isError;
 console.log(JSON.stringify({component_policy_test:true,exposed:tools,arbitrary_code_denied:!!deniedCode.isError,external_navigation_denied:!!deniedUrl.isError,guessed_route_denied:!!deniedGuess.isError,passed}));
 if(!passed)process.exitCode=1;
}finally{await client.close();await transport.close();}
