// Synthetic error/coverage fixture. Only loopback, no account or real workflow.
import http from 'node:http';
import fs from 'node:fs/promises';
const r=JSON.parse(await fs.readFile(process.argv[2],'utf8'));
const headers={'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'none'"};
const shell=body=>`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>数采运营隔离模拟</title><h1>数采运营隔离模拟</h1><p>仅虚拟数据，不代表真实业务；禁止登录和正式任务操作。</p>${body}</html>`;
const errors={http503:[503,'HTTP 503 Service Unavailable','未取得审核记录。'],http401:[401,'HTTP 401 Unauthorized','未取得审核记录。'],http403:[403,'HTTP 403 Forbidden','未取得审核记录。']};
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,r.origin),p=url.pathname;
 let status=200,body;
 if(p.startsWith('/api/page2')){status=503;body='第2页读取失败 HTTP 503；尚未取得第2页记录。';}
 else if(p.startsWith('/api/detail')){status=500;body='任务详情加载失败 HTTP 500；未取得QA标注。';}
 else {
 const name=p.slice(1);
 if(errors[name]){const e=errors[name];status=e[0];body=shell(`<h2>${e[1]}</h2><p>${e[2]}</p>`);}
 else if(name==='expired')body=shell('<h2>登录状态提示</h2><p>会话已过期，请由Owner亲自重新登录。</p>');
 else if(['empty','unchanged','change','partial','detail'].includes(name)){
  const empty=name==='empty',partial=name==='partial',detail=name==='detail';
  const rows=empty?'':`<tr><td>DEMO-001</td><td id="state">${detail?'已审':'待审'}</td><td id="qa">${detail?'详情未取得':'暂无'}</td></tr><tr><td>DEMO-002</td><td>已审</td><td>模拟通过</td></tr>`;
  let extra='';
  if(partial)extra='<button id="next">下一页</button>';
  if(detail)extra='<button id="detail">查看 DEMO-001 质检详情</button>';
  if(['unchanged','change'].includes(name))extra='<button id="refresh">刷新演示审核结果</button>';
  body=shell(`<nav><button id="menu">查看审核列表</button></nav><section id="panel" hidden><p>筛选范围：本轮演示数据；加载完成。</p><p>第1页 / 共${partial?2:1}页；记录总数${empty?0:partial?4:2}（界面声明）。</p><table><thead><tr><th>任务编号</th><th>审核状态</th><th>QA说明</th></tr></thead><tbody>${rows}</tbody></table>${empty?'<p>当前筛选结果：0条</p>':''}${extra}<p id="message">当前快照 v1</p></section><script>document.querySelector('#menu').onclick=()=>document.querySelector('#panel').hidden=false;${partial?"document.querySelector('#next').onclick=async()=>{const a=await fetch('/api/page2');document.querySelector('#message').textContent=await a.text()};":''}${detail?"document.querySelector('#detail').onclick=async()=>{const a=await fetch('/api/detail/DEMO-001');document.querySelector('#message').textContent=await a.text()};":''}${name==='change'?"document.querySelector('#refresh').onclick=()=>{document.querySelector('#state').textContent='已审';document.querySelector('#qa').textContent='模拟通过';document.querySelector('#message').textContent='当前快照 v2'};":''}${name==='unchanged'?"document.querySelector('#refresh').onclick=()=>document.querySelector('#message').textContent='刷新完成，当前快照 v1，数据相同';":''}</script>`);
 }else{status=404;body=shell('<p>未找到模拟页面</p>');}
 }
 await fs.appendFile(r.requests,JSON.stringify({at:new Date().toISOString(),method:req.method,path:p,status})+'\n');
 res.writeHead(status,headers);res.end(body);
});
await new Promise(resolve=>server.listen(r.port,'127.0.0.1',resolve));
console.log(JSON.stringify({event:'demo_ready',port:r.port}));
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
