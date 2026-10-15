// Synthetic QA fixture only. No business data, login, upload, or backend writes.
import http from 'node:http';
import fs from 'node:fs/promises';
const runtime=JSON.parse(await fs.readFile(process.argv[2],'utf8'));
const server=http.createServer(async(req,res)=>{
 await fs.appendFile(runtime.requests,JSON.stringify({method:req.method,path:req.url})+'\n');
 const pathname=new URL(req.url,'http://127.0.0.1').pathname;
 if(pathname==='/unavailable'){res.writeHead(503,{'Content-Type':'text/html; charset=utf-8'});res.end('<h1>503 Service Unavailable</h1><p>模拟审核服务暂时不可用。无法读取任务与QA状态。</p>');return;}
 if(!['/change','/unchanged'].includes(pathname)){res.writeHead(404);res.end('not found');return;}
 const change=pathname==='/change';
 res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; form-action 'none'"});
 res.end(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>数采审核模拟台</title><h1>数采审核模拟台</h1><p>仅虚拟数据，不代表灵生真实业务验收。</p><nav><button id="menu">查看审核列表</button></nav><section id="panel" hidden><p>本次模拟任务列表</p><table><thead><tr><th>任务编号</th><th>状态</th><th>QA说明</th></tr></thead><tbody><tr><td>DEMO-001</td><td id="status">待审</td><td id="qa">暂无</td></tr><tr><td>DEMO-002</td><td>已审</td><td>模拟通过</td></tr></tbody></table><button id="refresh">刷新演示审核结果</button><p id="version">快照 v1</p></section><script>document.querySelector('#menu').onclick=()=>document.querySelector('#panel').hidden=false;document.querySelector('#refresh').onclick=()=>{${change?"document.querySelector('#status').textContent='已审';document.querySelector('#qa').textContent='模拟通过';document.querySelector('#version').textContent='快照 v2';":"document.querySelector('#version').textContent='快照 v1（刷新完成，状态相同）';"}}</script></html>`);
});
await new Promise(resolve=>server.listen(runtime.port,'127.0.0.1',resolve));
console.log(JSON.stringify({event:'demo_ready',port:runtime.port}));
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
