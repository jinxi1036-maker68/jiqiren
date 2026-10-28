// Installed by the tool, never supplied as arbitrary Agent JavaScript.
const fs=require('node:fs');
const crypto=require('node:crypto');
const origin='https://ldp.lingrobotics.com';
const installed=new WeakSet();
exports.allowedRequest=(url,method)=>{
 try{
  const u=new URL(url);
  return u.origin===origin&&['GET','HEAD','OPTIONS'].includes(method.toUpperCase())&&!u.username&&!u.password
   &&!/(?:^|\/)(?:delete|remove|create|update|save|submit|unbind|assign|approve|reject|logout|login)(?:\/|$)/i.test(u.pathname);
 }catch{return false;}
};
function receipt(row){
 const file=process.env.LINGJU_BROWSER_READ_GUARD_LOG;
 if(file)fs.appendFileSync(file,JSON.stringify({at:new Date().toISOString(),...row})+'\n');
}
exports.default=async({page})=>{
 const context=page.context();
 if(!installed.has(context)){
  await context.route('**/*',async route=>{
   const request=route.request();
   if(exports.allowedRequest(request.url(),request.method()))return route.continue();
   receipt({event:'read_guard_request_denied',method:request.method(),url_sha256:crypto.createHash('sha256').update(request.url()).digest('hex')});
   return route.abort('blockedbyclient');
  });
  if(context.routeWebSocket)await context.routeWebSocket('**',ws=>ws.close());
  installed.add(context);receipt({event:'same_site_read_guard_installed',mutation_methods_blocked:true});
 }
 const session=await context.newCDPSession(page);
 await session.send('Network.setBypassServiceWorker',{bypass:true});
 // An occluded/background Chrome can stop requestAnimationFrame entirely,
 // starving Playwright's actionability checks. Keep only this controlled page
 // active through its own CDP lease; do not force-click or change business DOM.
 await session.send('Emulation.setFocusEmulationEnabled',{enabled:true});
 receipt({event:'controlled_page_background_rendering_enabled',business_action:false});
 // Retain this page's CDP session until close; no Cookie/storage access.
 page.once('close',()=>session.detach().catch(()=>{}));
};
