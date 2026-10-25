// Browser evidence delivery only: no repeated click, forced action or evaluation.
import fs from 'node:fs/promises';
import path from 'node:path';

export function publicSchema(tool){
 const copy=structuredClone(tool);
 if(copy.name==='browser_take_screenshot'&&copy.inputSchema?.properties?.scale?.default==='css')
  copy.inputSchema.required=(copy.inputSchema.required||[]).filter(k=>k!=='scale');
 return copy;
}

export async function inlineOwnedSnapshot(result,outputDir,startedAt){
 const texts=(result.content||[]).filter(x=>x.type==='text').map(x=>x.text);
 const match=texts.map(t=>t.match(/^### Snapshot\r?\n- \[Snapshot\]\(([^)\r\n]+\.yml)\)/m)).find(Boolean);
 if(!match)return result;
 const root=await fs.realpath(outputDir);
 const candidate=path.resolve(match[1]);
 if(path.dirname(candidate)!==path.resolve(outputDir)||!/^page-[\dTZ.:-]+\.yml$/.test(path.basename(candidate)))return result;
 const actual=await fs.realpath(candidate).catch(()=>null);
 if(!actual||path.dirname(actual)!==root)return result;
 const stat=await fs.stat(actual);
 if(stat.size>128*1024||stat.mtimeMs<startedAt-1000)return result;
 return{...result,content:[...(result.content||[]),{type:'text',text:'### Current browser-generated snapshot\n```yaml\n'+await fs.readFile(actual,'utf8')+'\n```'}]};
}

export async function observeFailure(result,name,call){
 if(!result.isError||['browser_close','browser_snapshot','browser_take_screenshot'].includes(name))return{result,observation:null};
 let observation;
 try{observation=await call('browser_snapshot',{});}
 catch{observation={isError:true,content:[{type:'text',text:'Fresh observation unavailable; cause unknown.'}]};}
 const text=(observation.content||[]).filter(x=>x.type==='text').map(x=>x.text).join('\n');
 return{result:{...result,content:[...(result.content||[]),{type:'text',text:'### Observation after failed or uncertain action\nThe action was not repeated. This observation does not prove the action succeeded.\n'+text}]},observation};
}
