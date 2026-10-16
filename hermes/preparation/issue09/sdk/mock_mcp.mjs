// Test double only: no browser, HTTP client, model or business server.
import {resolveSdk} from './sdk_resolver.mjs';
export async function startMock(anchor){
const {Server,StdioServerTransport,ListToolsRequestSchema,CallToolRequestSchema}=resolveSdk(anchor);
const server=new Server({name:'synthetic-sdk-component',version:'0.0.0'},{capabilities:{tools:{}}});
const names=['browser_navigate','browser_snapshot','browser_click','browser_close','browser_evaluate'];
server.setRequestHandler(ListToolsRequestSchema,async()=>({tools:names.map(name=>({name,description:'MOCK only',inputSchema:{type:'object',properties:{url:{type:'string'}},additionalProperties:true}}))}));
server.setRequestHandler(CallToolRequestSchema,async req=>({content:[{type:'text',text:'MOCK DOM '+req.params.name+'; no browser or HTTP request'}]}));
await server.connect(new StdioServerTransport());
}

