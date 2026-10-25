// Zero-model, synthetic-origin-only reproduction of the observed click failure.
// Diagnostic DOM inspection is not an Agent tool or a business workflow.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const runtimePath=process.argv[2];
const runtime=JSON.parse(await fs.readFile(runtimePath,'utf8'));
if(new URL(runtime.origin).hostname!=='127.0.0.1'||runtime.case!=='analysis')throw Error('Local analysis fixture required');
const req=createRequire(path.join(runtime.toolRoot,'package.json'));
const {Client}=req('@modelcontextprotocol/sdk/client/index.js');
const {StdioClientTransport}=req('@modelcontextprotocol/sdk/client/stdio.js');
const {chromium}=req('playwright');
const result={at:new Date().toISOString(),model_calls:0,agent_task:false,force_click_used:false};
const client=new Client({name:'lingju-actionability-diagnostic',version:'0.1.0'});
const transport=new StdioClientTransport({command:process.execPath,args:[path.join(runtime.toolRoot,'bridge.mjs'),runtimePath],cwd:runtime.browserOutput,stderr:'pipe'});
let browser;
const text=r=>(r.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('\n');
try{
 await client.connect(transport);
 const nav=await client.callTool({name:'browser_navigate',arguments:{url:runtime.origin+'/analysis'}});
 const artifact=text(nav).match(/\[Snapshot\]\(([^)]+\.yml)\)/)?.[1];
 if(!artifact||!path.resolve(artifact).startsWith(path.resolve(runtime.browserOutput)+path.sep))throw Error('Expected owned navigation snapshot');
 const snap=await fs.readFile(artifact,'utf8');
 result.snapshot_source='navigation artifact, as in the failed Agent task';
 const target=snap.match(/button "下一页" \[ref=([^\]]+)\]/)?.[1];
 if(!target)throw Error('Next button missing from snapshot');
 result.target=target;
 let page;
 async function inspect(){
  return page.evaluate(async()=>{
   const b=document.querySelector('#next'),s=getComputedStyle(b),r=b.getBoundingClientRect();
   const raf=await Promise.race([new Promise(ok=>requestAnimationFrame(()=>requestAnimationFrame(()=>ok(true)))),new Promise(ok=>setTimeout(()=>ok(false),700))]);
   return{visibility:document.visibilityState,hidden:document.hidden,raf_completed:raf,
    disabled:b.disabled,display:s.display,visibility_style:s.visibility,opacity:s.opacity,
    rect:{x:r.x,y:r.y,width:r.width,height:r.height},viewport:{width:innerWidth,height:innerHeight},
    animations:document.getAnimations().length,current_page:document.querySelector('#current-page').textContent};
  });
 }
 const started=Date.now();
 const click=await client.callTool({name:'browser_click',arguments:{element:'Synthetic next-page button',target}},undefined,{timeout:12000});
 result.mcp_click={duration_ms:Date.now()-started,is_error:!!click.isError,text:text(click).slice(0,3500)};
 // First attempt has no second CDP observer which could alter browser state.
 browser=await chromium.connectOverCDP(runtime.cdp,{timeout:5000});
 page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url()===runtime.origin+'/analysis');
 if(!page)throw Error('Expected fixture page not found');
 result.after=await inspect();
 if(click.isError){
  // Activating the same synthetic tab is a diagnostic contrast, not force click.
  await page.bringToFront();
  result.after_activation=await inspect();
  const t=Date.now();
  const second=await client.callTool({name:'browser_click',arguments:{element:'Synthetic next-page button after tab activation',target:'button#next'}},undefined,{timeout:12000});
  result.after_activation_click={duration_ms:Date.now()-t,is_error:!!second.isError,text:text(second).slice(0,1500)};
  result.final=await inspect();
 }
}catch(e){result.error=String(e);process.exitCode=1;}
finally{
 if(browser)await browser.close().catch(()=>{});
 await client.close().catch(()=>{});await transport.close().catch(()=>{});
 const stamp=result.at.replace(/[:.]/g,'-');
 await fs.writeFile(path.join(path.dirname(runtimePath),'actionability-'+stamp+'.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify(result,null,2));
}
