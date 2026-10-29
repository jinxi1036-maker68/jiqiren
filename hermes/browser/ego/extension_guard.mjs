// Browser-native profile metadata and own-extension API only. No user-page DOM,
// Cookie, credential, global extension install, CDP discovery or cache clearing.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {workplaceState,verifyExtensionMode} from './policy.mjs';
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
export async function checkExtensionPayload(c){
 const dir=path.resolve(c.extension.directory);
 if(path.normalize(await fs.realpath(dir))!==path.normalize(dir))throw Error('EGO_EXTENSION_PATH_CHANGED');
 for(const [name,key] of [['manifest.json','manifestSha256'],['rules.json','rulesSha256']]){
  const file=path.join(dir,name);
  if(path.normalize(await fs.realpath(file))!==path.normalize(file)||hash(await fs.readFile(file))!==c.extension[key])throw Error('EGO_EXTENSION_BYTES_CHANGED');
 }
}
export function extensionGuard(task,c,{spaces=()=>listTaskSpaces()}={}){
 let metaPage,closed=false,healthy=false;
 const inspect=async({requireActive=false}={})=>{
  if(closed)throw Error('EGO_USER_CONTROL');
  healthy=false;
  const all=await spaces(),items=Array.isArray(all)?all:all.taskSpaces;
  const entry=items.find(s=>s.id===c.spaceId);
  if(!entry||entry.profileId!==c.profileId||entry.ownership!=='agent')throw Error('EGO_PROFILE_OR_CONTROL_CHANGED');
  await checkExtensionPayload(c);
  const state=workplaceState(JSON.parse(await fs.readFile(c.stateFile,'utf8')));
  if(requireActive&&!state.ready)throw Error('EGO_OWNER_LOGIN_REQUIRED: workplace is '+state.state+'; do not send credentials or ask Owner to locate menus');
  if(!metaPage){
   metaPage=await task.newPage();
   await metaPage.goto('chrome://version/');
   const actual=await metaPage.evaluate(()=>document.querySelector('#profile_path')?.textContent?.trim());
   if(!actual||path.normalize(actual)!==path.normalize(c.profileDirectory))throw Error('EGO_ACTUAL_PROFILE_PATH_CHANGED');
   await metaPage.goto('chrome-extension://'+c.extension.id+'/manifest.json');
  }
  if(await metaPage.url()!=='chrome-extension://'+c.extension.id+'/manifest.json')throw Error('EGO_EXTENSION_INSPECTOR_CHANGED');
  const enabled=await metaPage.evaluate(async()=>({rules:await chrome.declarativeNetRequest.getEnabledRulesets(),
   dynamic:await chrome.declarativeNetRequest.getDynamicRules(),session:await chrome.declarativeNetRequest.getSessionRules()}));
  verifyExtensionMode(enabled,c);
  healthy=true;
  return {...state,profileId:c.profileId,spaceId:c.spaceId,extensionEnabled:true,extensionPayloadMatched:true,extensionModeMatched:true,dynamicRuleIds:enabled.dynamic.map(r=>r.id)};
 };
 return {inspect,healthy:()=>healthy,protect:async()=>inspect(),async close(){closed=true;healthy=false;if(metaPage){await metaPage.close();metaPage=null;}}};
}
