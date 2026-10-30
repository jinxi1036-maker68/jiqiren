// Resolve the one approved company workplace, never another user/profile tab.
export function validateWorkplaceBinding(c){
 const b=c.workplaceBinding;if(!b)return null;
 if(!['lingju.ego-browser.v2','lingju.ego-browser.v3'].includes(c.schema)||b.schema!=='lingju.ego-workplace-binding.v1'
  ||typeof b.name!=='string'||!b.name.trim()||b.name.length>120||b.profileId!==c.profileId||b.profileName!=='凌矩工作'
  ||b.startUrl!==c.origin+'/statistics'||b.restoreWhenMissing!==true
  ||b.ownerRestorationApproved!==true||!b.approvalReference)throw Error('EGO_WORKPLACE_BINDING_INVALID');
 return b;
}
function fail(code,detail){throw Object.assign(Error(detail),{code});}
function entries(raw){return Array.isArray(raw)?raw:raw.taskSpaces;}
export function needsApprovedStart(c,resolution,url){
 return !!c.workplaceBinding&&(resolution.created||['about:blank','chrome://new-tab-page/','chrome://newtab/'].includes(url));
}
export async function resolveCompanyWorkplace(c,api){
 const b=validateWorkplaceBinding(c),all=entries(await api.list());
 if(!Array.isArray(all))fail('EGO_WORKPLACE_INVENTORY_INVALID','Company workplace inventory was not available');
 if(!b){
  const old=all.find(s=>s.id===c.spaceId);
  if(!old)fail('EGO_WORKPLACE_MISSING','Saved company window no longer exists; no approved restoration binding');
  if(old.profileId!==c.profileId)fail('EGO_WORKPLACE_PROFILE_CHANGED','Saved window is no longer the company profile');
  if(old.ownership!=='agent')fail('EGO_USER_CONTROL','Company window is under user control; no automatic takeover');
  return {task:await api.open(old.id),cfg:c,created:false,method:'existing-id'};
 }
 if(all.some(s=>s.name===b.name&&s.profileId!==c.profileId))fail('EGO_WORKPLACE_NAME_CONFLICT','Approved workplace name belongs to another profile; no claim or creation');
 const company=all.filter(s=>s.profileId===c.profileId),matches=company.filter(s=>s.name===b.name);
 if(matches.length>1)fail('EGO_WORKPLACE_AMBIGUOUS','More than one company workplace matches; no arbitrary choice');
 if(matches.length){
  const chosen=matches[0];if(chosen.ownership!=='agent')fail('EGO_USER_CONTROL','Company workplace is under user control; no automatic takeover');
  return {task:await api.open(chosen.id),cfg:{...c,spaceId:chosen.id},created:false,method:'stable-company-name'};
 }
 if(company.length)fail('EGO_WORKPLACE_AMBIGUOUS','A different company window exists; no replacement or takeover');
 const raw=await api.profiles(),profiles=Array.isArray(raw)?raw:raw.profiles;
 if(!profiles?.some(p=>p.id===b.profileId&&p.name===b.profileName))fail('EGO_COMPANY_PROFILE_MISSING','Approved existing company profile missing; do not create/import a profile');
 const task=await api.open(b.name,{profileId:b.profileId});
 const after=entries(await api.list()),actual=after.find(s=>s.id===task.spaceId);
 if(actual?.profileId!==c.profileId||actual.ownership!=='agent'||actual.name!==b.name)fail('EGO_WORKPLACE_PROFILE_CHANGED','Restored workplace metadata mismatch; do not navigate');
 return {task,cfg:{...c,spaceId:task.spaceId},created:true,method:'restored-approved-company-window'};
}
