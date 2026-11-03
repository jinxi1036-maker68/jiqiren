import fs from 'node:fs/promises';
import path from 'node:path';
import {Workbook, SpreadsheetFile} from '@oai/artifact-tool';

const root=process.cwd();
const out=path.join(root,'deliverables/2026-10-15');
const csv=await fs.readFile(path.join(root,'knowledge/tasks/data/2026-10-15_平顶山三场景线下采购_21项原始数据.csv'),'utf8');
const imported=await Workbook.fromCSV(csv,{sheetName:'CSV'});
const grid=imported.worksheets.getItemAt(0).getUsedRange().values;
const rows=grid.slice(1).filter(r=>r[0]!==null && r[0]!=='').map(r=>Object.fromEntries(grid[0].map((k,i)=>[k,String(r[i]??'')])));
if(rows.length!==21)throw new Error(`Expected 21 authoritative CSV records, found ${rows.length}`);
const sources=JSON.parse(await fs.readFile(path.join(out,'image_sources.json'),'utf8'));
const wb=Workbook.create();
const main=wb.worksheets.add('完整采购表');
const shop=wb.worksheets.add('看图采购');
const raw=wb.worksheets.add('CSV原始数据');
const provenance=wb.worksheets.add('图片来源');
const fileName='平顶山三场景_线下采购清单_21项实物图片版.xlsx';
const font='Microsoft YaHei';
const navy='#233C57', muted='#536577', light='#EDF3F8';
const disclaimer='照片为采购参考，并非指定厂家、已验证平顶山现货或已验证实际售价。';
const questions=[
'有约120厘米宽、40厘米深的金属货架吗？层高能调、能固定防倒吗？',
'要4个同款浅口塑料筐，约40×30厘米，深12—18厘米，尽量无标。',
'要4个不太深的分格托盘，能分开放三类小件，另留备用。',
'要三类同类小件，每类12件，共36件。掌心大小、无标、不锋利。',
'有货架防滑片或小挡条吗？要让小件不往下滑。',
'要6个同款空周转箱，约40×30×15—20厘米，有扶手，试叠要稳。',
'有约60×40厘米的小托盘或底板吗？要牢固、没有毛刺。',
'先找现有结实台子借用，放箱后要稳，不能拿不稳的箱子垫高。',
'同款样件要18件，正常12件、已有可见缺陷6件；请如实说清缺陷来源。',
'要4个浅口检验盘，分别放待检、完好、有问题和备用的样件。',
'有纯色小圆点贴吗？先确认上游标注方法再买。',
'先借2张约120×60厘米的桌子，桌脚稳、不晃，站着操作高度合适。',
'要2张约60×45厘米的纯色哑光防滑垫，颜色要和小件有对比。',
'要2卷纯色地面定位胶带，贴地不翘边，尽量哑光。',
'先借灯试拍，要照得均匀、无明显频闪，不直射镜头。',
'先找现有合格插排；需要买时，要正规产品，按实际负载选。',
'先借一块哑光纯色布遮背景，也可用纯色墙面。',
'要一套镜头布和清洁布，不掉毛，按设备说明清洁。',
'要一本登记本和一支笔，记录放在拍摄视频外完成。',
'要一个小收纳筐，装备用样件、贴片和清洁工具。',
'要一套扎带和理线用品，也可用魔术贴理线带。'
];

function base(sheet,range){
 sheet.showGridLines=false;
 sheet.getRange(range).format.font={name:font,size:11,color:'#203044'};
 sheet.getRange(range).format.verticalAlignment='center';
 sheet.getRange(range).format.rowHeightPx=28;
}
function title(sheet,text,lastCol){
 sheet.getRange('A2').values=[[text]];
 sheet.getRange('A2').format.font={name:font,size:16,bold:true,color:navy};
 sheet.getRange('A2:'+lastCol+'2').format.rowHeightPx=36;
 sheet.getRange('A3').values=[[disclaimer]];
 sheet.getRange('A3').format.font={name:font,size:10,color:muted};
 sheet.getRange('A3:'+lastCol+'3').format.rowHeightPx=28;
}
function header(sheet,range){
 const r=sheet.getRange(range);r.format.fill=navy;
 r.format.font={name:font,size:11,bold:true,color:'#FFFFFF'};
 r.format.horizontalAlignment='center';r.format.wrapText=true;r.format.rowHeightPx=38;
}
function widths(sheet,cols){
 cols.forEach((v,i)=>sheet.getRangeByIndexes(0,i,1,1).format.columnWidthPx=v);
}
async function imageAt(sheet,row,col,src){
 const bytes=await fs.readFile(path.join(out,src.file));
 if(bytes.length<2048)throw new Error(`Image ${src.id} is too small`);
 sheet.images.add({dataUrl:'data:image/png;base64,'+bytes.toString('base64'),anchor:{
  from:{row:row-1,col:col-1,rowOffsetPx:5,colOffsetPx:6},
  extent:{widthPx:248,heightPx:172}
 }});
}

base(main,'A1:Q30');main.tabColor=navy;
widths(main,[48,90,72,210,260,50,48,82,82,220,210,320,100,96,220,90,90]);
title(main,'平顶山三个场景线下采购清单','Q');
main.getRange('A4').values=[['预算（元）']];main.getRange('D4').formulas=[['=P29']];
main.getRange('F4').values=[['至']];main.getRange('H4').formulas=[['=Q29']];
main.getRange('D4:H4').setNumberFormat('#,##0');
main.getRange('D4').format.font={name:font,size:16,bold:true,color:navy};
main.getRange('H4').format.font={name:font,size:16,bold:true,color:navy};
main.getRange('A5').values=[['先借物品的低价为0；价格、数量及渠道均按知识库CSV，非商家报价。黄色栏可手填。']];
main.getRange('A5').format.font={name:font,size:10,color:muted};
const headers=['序号','区域','优先级','物品名称','实物参考图片','数量','单位','单价低元','单价高元','线下优先渠道','缺货替代','规格和用途','购买情况','实付单价（元）','备注','预算低（元）','预算高（元）'];
main.getRange('A7:Q7').values=[headers];header(main,'A7:Q7');
const keys=['序号','区域','优先级','物品名称','数量','单位','单价低元','单价高元','线下优先渠道','缺货替代','规格和用途'];
const numeric=new Set(['序号','数量','单价低元','单价高元']);
rows.forEach((r,i)=>{
 const row=i+8;
 main.getRange(`A${row}:Q${row}`).values=[[
  Number(r['序号']),r['区域'],r['优先级'],r['物品名称'],null,Number(r['数量']),r['单位'],
  Number(r['单价低元']),Number(r['单价高元']),r['线下优先渠道'],r['缺货替代'],r['规格和用途'],null,null,null,null,null
 ]];
 main.getRange(`P${row}:Q${row}`).formulas=[[`=F${row}*H${row}`,`=F${row}*I${row}`]];
 main.getRange(`A${row}:Q${row}`).format.rowHeightPx=182;
 main.getRange(`A${row}:Q${row}`).format.wrapText=true;
 main.getRange(`A${row}:Q${row}`).format.borders={bottom:{style:'thin',color:'#DCE4EC'}};
 if(i%2===1)main.getRange(`A${row}:Q${row}`).format.fill='#F6F8FA';
 main.getRange(`M${row}:O${row}`).format.fill='#FFF4D6';
 main.getRange(`A${row}:C${row}`).format.horizontalAlignment='center';
 main.getRange(`F${row}:I${row}`).format.horizontalAlignment='right';
 main.getRange(`D${row}`).format.font={name:font,size:11,bold:true,color:navy};
 if(Number(r['序号'])===9)main.getRange(`O${row}`).values=[['参考图为公开数据中的正常/缺陷实物对照；不是本地厂实际样件。']];
});
main.getRange('H8:I28').setNumberFormat('0');main.getRange('N8:N28').setNumberFormat('0.00');main.getRange('P8:Q29').setNumberFormat('#,##0');
main.getRange('M8:M28').dataValidation={rule:{type:'list',values:['未买','已买','已借','缺货','待确认']}};
main.getRange('A29').values=[['预算合计']];main.getRange('P29:Q29').formulas=[['=SUM(P8:P28)','=SUM(Q8:Q28)']];
main.getRange('A29:Q29').format.fill=light;main.getRange('A29:Q29').format.font={name:font,size:11,bold:true,color:navy};main.getRange('A29:Q29').format.rowHeightPx=34;
main.freezePanes.freezeRows(7);

base(shop,'A1:F29');shop.tabColor='#577897';
widths(shop,[48,260,210,80,290,320]);title(shop,'看图采购（21项）','F');
shop.getRange('A4:F4').values=[['编号','实物照片','物品名','数量','参考规格','到店问法']];header(shop,'A4:F4');shop.freezePanes.freezeRows(4);
let shopRow=5;let zone='';const mapping=[];
for(let i=0;i<rows.length;i++){
 const r=rows[i];
 if(r['区域']!==zone){zone=r['区域'];shop.getRange(`A${shopRow}:F${shopRow}`).format.fill=light;shop.getRange(`C${shopRow}`).values=[[zone]];shop.getRange(`C${shopRow}`).format.font={name:font,size:11,bold:true,color:navy};shop.getRange(`A${shopRow}:F${shopRow}`).format.rowHeightPx=30;shopRow++;}
 shop.getRange(`A${shopRow}:F${shopRow}`).values=[[Number(r['序号']),null,r['物品名称'],r['数量']+r['单位'],r['规格和用途'],questions[i]]];
 shop.getRange(`A${shopRow}:F${shopRow}`).format.rowHeightPx=182;shop.getRange(`A${shopRow}:F${shopRow}`).format.wrapText=true;
 shop.getRange(`A${shopRow}:F${shopRow}`).format.borders={bottom:{style:'thin',color:'#DCE4EC'}};
 shop.getRange(`C${shopRow}`).format.font={name:font,size:11,bold:true,color:navy};shop.getRange(`A${shopRow}`).format.horizontalAlignment='center';
 mapping.push({id:Number(r['序号']),mainRow:i+8,mainCol:5,shopRow,shopCol:2});
 await imageAt(main,i+8,5,sources[i]);await imageAt(shop,shopRow,2,sources[i]);shopRow++;
}

base(raw,'A1:K25');widths(raw,[48,100,80,250,60,60,85,85,280,280,440]);
raw.getRange('A1').values=[['权威原始数据：knowledge/tasks/data/2026-10-15_平顶山三场景线下采购_21项原始数据.csv']];
raw.getRange('A1').format.font={name:font,size:11,bold:true,color:navy};
raw.getRange('A3:K3').values=[keys];header(raw,'A3:K3');
raw.getRange('A4:K24').values=rows.map(r=>keys.map(k=>numeric.has(k)?Number(r[k]):r[k]));
raw.getRange('A4:K24').format.wrapText=true;raw.getRange('A4:K24').format.rowHeightPx=94;raw.freezePanes.freezeRows(3);

base(provenance,'A1:I25');widths(provenance,[48,240,320,440,440,450,180,110,540]);
provenance.getRange('A1').values=[['图片来源记录（全部为实物参考图）']];
provenance.getRange('A2').values=[['仅供团队内部认物采购参考。图片权利归来源方，未核验商业授权；不是本地库存或价格证据。']];
provenance.getRange('A3:I3').values=[['序号','对应物品','来源页面标题','来源网页URL','原图片URL','匹配说明与限制','嵌入文件','字节数','SHA-256']];header(provenance,'A3:I3');
provenance.getRange('A4:I24').values=sources.map((s,i)=>[s.id,rows[i]['物品名称'],s.title,s.url,s.imageUrl,s.description,s.file,s.bytes,s.sha256]);
provenance.getRange('A4:I24').format.wrapText=true;provenance.getRange('A4:I24').format.rowHeightPx=135;provenance.freezePanes.freezeRows(3);

wb.recalculate();
await fs.writeFile(path.join(out,'row_mapping.json'),JSON.stringify(mapping,null,2));
console.log((await wb.inspect({kind:'table',range:'完整采购表!P28:Q29',include:'values,formulas',tableMaxRows:2,tableMaxCols:2,maxChars:2000})).ndjson);
console.log((await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:40},summary:'final formula scan',maxChars:2000})).ndjson);
await (await SpreadsheetFile.exportXlsx(wb)).save(path.join(out,fileName));
for(const [sheetName,range,name] of [
 ['完整采购表','A7:L10','完整采购表_局部预览.png'],
 ['看图采购','A4:F10','看图采购_A区.png'],
 ['看图采购','A11:F18','看图采购_BC区.png'],
 ['看图采购','A19:F24','看图采购_公共上.png'],
 ['看图采购','A25:F29','看图采购_公共下.png'],
 ['CSV原始数据','A3:K6','原始数据_预览.png'],
 ['图片来源','A3:C6','图片来源_预览.png']
]){
 const preview=await wb.render({sheetName,range,scale:1,format:'png'});
 await fs.writeFile(path.join(out,name),new Uint8Array(await preview.arrayBuffer()));
 console.log('rendered',name);
}
console.log('saved',path.join(out,fileName));
