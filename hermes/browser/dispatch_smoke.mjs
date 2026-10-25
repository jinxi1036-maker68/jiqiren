// Regression of the single opt-in dispatch, no business tasks or model messages.
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
const root=process.env.LINGJU_SMOKE_ROOT,python=process.env.LINGJU_ORIGINAL_PYTHON,chrome=process.env.LINGJU_CHROME;
const home=path.dirname(path.dirname(root)),legacy=path.join(home,'tools','company-browser-simulation');
const result={model_calls:0,employee_tasks_performed:false};
async function connect(env){
 const client=new Client({name:'lingju-dispatch-regression',version:'0.1.0'});
 const transport=new StdioClientTransport({command:python,args:['-I','-B',path.join(legacy,'launch_bridge.py'),path.join(legacy,'template.json')],env,cwd:root,stderr:'pipe'});
 try{await client.connect(transport);return{client,transport};}catch(e){await transport.close();throw e;}
}
let current,controller;
try{
 const plainEnv={};for(const k of ['PATH','PATHEXT','SYSTEMROOT','WINDIR','COMSPEC','USERPROFILE','APPDATA','LOCALAPPDATA','TEMP','TMP'])if(process.env[k])plainEnv[k]=process.env[k];
 plainEnv.HERMES_HOME=home;
 current=await connect(plainEnv);
 const names=(await current.client.listTools()).tools.map(x=>x.name).sort();
 assert.deepEqual(names,['browser_click','browser_close','browser_navigate','browser_snapshot']);
 result.unmarked={status:'pass',tools:names};
 await current.client.close();await current.transport.close();current=null;
 controller=spawn(python,['-I','-B',path.join(root,'launch.py'),'--route','playwright','--case','binding','--chrome',chrome,'--node',process.execPath],{stdio:['pipe','pipe','pipe'],windowsHide:true});
 let errors='';controller.stderr.on('data',b=>errors+=b);
 const ready=await new Promise((resolve,reject)=>{const rl=readline.createInterface({input:controller.stdout});const t=setTimeout(()=>reject(Error('Controller not ready: '+errors)),30000);rl.once('line',line=>{clearTimeout(t);resolve(JSON.parse(line));});});
 const markedEnv={...plainEnv,LINGJU_BROWSER_EXERCISE:'playwright',LINGJU_BROWSER_RUNTIME:ready.runtime,HERMES_TUI_MAX_TURNS:'16',HERMES_TUI_TOOLSETS:'company_browser_simulation,file'};
 current=await connect(markedEnv);
 const richer=(await current.client.listTools()).tools.map(x=>x.name);
 assert.equal(richer.length,13);assert.ok(richer.includes('browser_take_screenshot'));assert.ok(richer.includes('browser_fill_form'));
 const receipt=JSON.parse(await fs.readFile(path.join(ready.output,'dispatch-receipt.json'),'utf8'));
 assert.equal(receipt.route_marker_received,true);assert.equal(receipt.original_home_unchanged,true);assert.equal(receipt.max_turns_received,'16');
 result.marked={status:'pass',tools:richer,receipt,output:ready.output};
 await current.client.close();await current.transport.close();current=null;
 const filteredEnv={...plainEnv,XDG_LINGJU_BROWSER_RUNTIME:ready.runtime};
 delete filteredEnv.HERMES_HOME;
 current=await connect(filteredEnv);
 const filteredTools=(await current.client.listTools()).tools.map(x=>x.name);
 assert.equal(filteredTools.length,13);
 const filteredReceipt=JSON.parse(await fs.readFile(path.join(ready.output,'dispatch-receipt.json'),'utf8'));
 assert.equal(filteredReceipt.activation_source,'xdg_runtime_path');
 assert.equal(filteredReceipt.runtime_validated,true);
 assert.equal(filteredReceipt.original_home_unchanged,true);
 result.filtered={status:'pass',tools:filteredTools,receipt:filteredReceipt};
 await current.client.close();await current.transport.close();current=null;
 controller.stdin.end('stop\n');
 await new Promise(resolve=>controller.once('exit',resolve));controller=null;
 result.desktop_environment_proven=false;
 result.note='Direct stdio dispatch only; this is not proof the original Desktop passed these variables.';
}catch(e){result.error=String(e);process.exitCode=1;}
finally{
 if(current){try{await current.client.close();await current.transport.close();}catch{}}
 if(controller){controller.stdin.end('stop\n');await new Promise(resolve=>controller.once('exit',resolve));}
 await fs.mkdir('.local',{recursive:true});await fs.writeFile('.local/dispatch-smoke.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}
