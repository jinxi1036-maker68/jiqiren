// Synthetic-only server for the Owner-approved browser-profile isolation check.
// No credentials, request bodies or response bodies are logged.
import fs from 'node:fs';import path from 'node:path';import http from 'node:http';import crypto from 'node:crypto';
const config=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
if(config.kind!=='lingju.ego-extension-canary.v1'||!path.isAbsolute(config.output))throw Error('Explicit private canary output required');
const dir=config.output;fs.mkdirSync(dir,{recursive:false});
const events=[],record=e=>{events.push({at:new Date().toISOString(),...e});fs.writeFileSync(path.join(dir,'truth.json'),JSON.stringify({synthetic:true,events},null,2));};
const response=(res,body,type='text/html; charset=utf-8')=>{res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',type);res.end(body);};
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://127.0.0.1:61987'),parts=u.pathname.split('/').filter(Boolean),phase=parts[0];
 if(!['candidate','control'].includes(phase)){res.writeHead(404);return res.end();}
 record({port:61987,phase,method:req.method,path:u.pathname,who:u.searchParams.get('who')||null});
 if(u.pathname.endsWith('/write')){req.resume();return response(res,'synthetic write reached server','text/plain');}
 if(u.pathname.endsWith('/read'))return response(res,'synthetic read reached server','text/plain');
 const base='/'+phase;
 const probeFunction=`async function probe(who){let read,write;try{read=await fetch('${base}/read?who='+who).then(r=>r.text())}catch(e){read='blocked'};try{await fetch('${base}/write?who='+who,{method:'POST',body:'synthetic-only'});write='sent'}catch(e){write='blocked'};return {who,read,write};}`;
 if(u.pathname.endsWith('/worker.js'))return response(res,probeFunction+`;probe('worker').then(v=>postMessage(v));`,'text/javascript');
 if(u.pathname.endsWith('/sw.js'))return response(res,probeFunction+`;self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));self.addEventListener('message',e=>e.waitUntil(probe('serviceworker').then(v=>e.ports[0].postMessage(v))));`,'text/javascript');
 if(u.pathname.endsWith('/frame')||u.pathname.endsWith('/popup')){
  const who=u.pathname.endsWith('/popup')?'popup':(u.searchParams.get('who')==='crossframe'?'crossframe':'frame');
  return response(res,`<!doctype html><h1>合成${who}</h1><script>${probeFunction};probe('${who}').then(v=>(opener||parent).postMessage({canary:true,...v},'*'));</script>`);
 }
 if(!u.pathname.endsWith('/root')){res.writeHead(404);return res.end();}
 const full=phase==='candidate',nonce=crypto.randomBytes(8).toString('hex');
 response(res,`<!doctype html><html><meta charset="utf-8"><title>凌矩纯合成保护核验</title><h1>纯合成：${phase}</h1><p>没有真实业务或账号数据。仅统计请求是否到达本机。</p><button id="popup" onclick="window.open('${base}/popup')">打开合成弹窗</button><pre id="result">检查中</pre>${full?`<iframe title="同源合成框架" src="${base}/frame?who=frame"></iframe><iframe title="跨源合成框架" src="http://localhost:61987${base}/frame?who=crossframe"></iframe>`:''}<script>
 window.results={};window.done=false;
 ${probeFunction}
 function save(v){results[v.who]=v;document.querySelector('#result').textContent=JSON.stringify(results,null,2);}
 addEventListener('message',e=>{if(['http://127.0.0.1:61987','http://localhost:61987'].includes(e.origin)&&e.data?.canary)save(e.data);});
 const jobs=[probe('root').then(save),fetch('http://127.0.0.1:61988/outside?phase=${phase}').then(()=>save({who:'outside',read:'sent'})).catch(()=>save({who:'outside',read:'blocked'})),new Promise(resolve=>{let settled=false;const finish=v=>{if(settled)return;settled=true;save({who:'websocket',read:v});resolve()};const w=new WebSocket('ws://127.0.0.1:61987${base}/socket');w.onopen=()=>{finish('opened');w.close()};w.onerror=()=>finish('blocked');setTimeout(()=>finish('unknown'),4000)})];
 ${full?`jobs.push(new Promise(resolve=>{const w=new Worker('${base}/worker.js');w.onmessage=e=>{save(e.data);w.terminate();resolve()};w.onerror=()=>{save({who:'worker',read:'unknown'});w.terminate();resolve()};setTimeout(resolve,6000)}));
 jobs.push((async()=>{let r;try{r=await navigator.serviceWorker.register('${base}/${nonce}/sw.js',{scope:'${base}/${nonce}/'});if(r.installing)await new Promise(resolve=>{const w=r.installing;w.addEventListener('statechange',()=>{if(w.state==='activated')resolve()});setTimeout(resolve,5000)});const active=r.active;if(!active)throw Error('not active');const ch=new MessageChannel();const value=await new Promise(resolve=>{ch.port1.onmessage=e=>resolve(e.data);active.postMessage('synthetic check',[ch.port2]);setTimeout(()=>resolve({who:'serviceworker',read:'unknown'}),5000)});save(value);}catch(e){save({who:'serviceworker',read:'unavailable',error:String(e)})}finally{if(r)await r.unregister();}})());`:''}
 Promise.allSettled(jobs).then(()=>{window.done=true;document.querySelector('#result').textContent=JSON.stringify(results,null,2)});
 </script></html>`);
});
const outside=http.createServer((req,res)=>{record({port:61988,phase:new URL(req.url,'http://127.0.0.1:61988').searchParams.get('phase'),method:req.method,path:'/outside'});res.setHeader('Access-Control-Allow-Origin','*');response(res,'synthetic outside-origin control','text/plain');});
server.on('upgrade',(req,socket)=>{
 const phase=req.url.startsWith('/candidate/')?'candidate':'control';record({port:61987,phase,method:'UPGRADE',path:'/socket'});
 const key=crypto.createHash('sha1').update(String(req.headers['sec-websocket-key'])+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
 socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+key+'\r\n\r\n');socket.on('error',()=>{});socket.on('data',()=>socket.end(Buffer.from([0x88,0])));setTimeout(()=>socket.destroy(),1500);
});
const listen=s=>new Promise((resolve,reject)=>{s.once('error',reject);s.listen(s===server?61987:61988,'127.0.0.1',resolve);});
try{await listen(server);await listen(outside);}catch(e){server.closeAllConnections();outside.closeAllConnections();server.close();outside.close();throw Error('Reserved canary port unavailable; no other process changed');}
record({kind:'canary_ready',pid:process.pid});console.log(JSON.stringify({kind:config.kind,pid:process.pid,origin:'http://127.0.0.1:61987',outside:'http://127.0.0.1:61988',synthetic:true}));
let stopping=false;async function stop(){if(stopping)return;stopping=true;server.closeAllConnections();outside.closeAllConnections();await Promise.all([new Promise(r=>server.close(r)),new Promise(r=>outside.close(r))]);record({kind:'canary_stopped'});process.exit(0);}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
