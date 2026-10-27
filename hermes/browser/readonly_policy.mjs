// First real-platform teaching session: observe a page the Owner opened.
// No clicks, navigation, form input, tab changes, login or arbitrary JS.
// The caller must supply browser-engine URL metadata, never page text.
export const teachingTools=new Set(['browser_snapshot','browser_take_screenshot','browser_tabs','browser_wait_for']);
export function permittedPage(browserState,scope){
 if(browserState.ownedBrowser!==true||browserState.pages?.length!==1)return false;
 try{
  const u=new URL(browserState.pages[0]);
  return u.origin===scope.origin&&scope.paths.includes(u.pathname)&&!u.username&&!u.password&&!u.search&&!u.hash;
 }catch{return false;}
}
export function permittedRead(name,args={}){
 if(!teachingTools.has(name))return false;
 const keys=Object.keys(args);
 if(name==='browser_snapshot')return keys.length===0;
 if(name==='browser_tabs')return keys.length===1&&args.action==='list';
 if(name==='browser_wait_for')return keys.every(k=>['time','text','textGone'].includes(k))&&
  (!('time'in args)||(Number.isFinite(args.time)&&args.time>=0&&args.time<=5))&&
  ['text','textGone'].every(k=>!(k in args)||typeof args[k]==='string');
 if(name==='browser_take_screenshot')return keys.every(k=>['type','fullPage'].includes(k))&&
  (!('type'in args)||['png','jpeg'].includes(args.type))&&(!('fullPage'in args)||args.fullPage===false);
 return false;
}
export async function guardedObservation({name,args={},scope,ownerLoginConfirmed,getBrowserState,read}){
 const fail=(code,text)=>({isError:true,content:[{type:'text',text:code+': '+text}]});
 if(!ownerLoginConfirmed)return fail('OWNER_LOGIN_PENDING','Owner尚未确认亲自登录完成，未读取网页内容。');
 if(!permittedRead(name,args))return fail('READ_ONLY_TOOL_DENIED','首轮仅允许观察；没有点击、输入、导航或提交。');
 let before;
 try{before=await getBrowserState();}catch{return fail('BROWSER_STATE_UNKNOWN','无法核实当前标签页，未读取内容。');}
 if(!permittedPage(before,scope))return fail('PAGE_OUTSIDE_TEACHING_SCOPE','请Owner将专用浏览器保留为唯一获准页面；未返回其他页面的内容或地址。');
 if(name==='browser_tabs')return {content:[{type:'text',text:'专用浏览器只有一个获准标签页：'+scope.origin+scope.paths[0]}]};
 let result;
 try{result=await read(name,args);}catch{return fail('READ_OUTCOME_UNKNOWN','页面观察失败，原因未知；没有自动重试。');}
 let after;
 try{after=await getBrowserState();}catch{return fail('PAGE_CHANGED_DURING_READ','观察期间无法确认页面，已扣留本次内容，请Owner核对。');}
 if(!permittedPage(after,scope)||before.pages[0]!==after.pages[0])
  return fail('PAGE_CHANGED_DURING_READ','观察期间页面切换，已扣留本次文字及图片，请Owner核对。');
 return result;
}
