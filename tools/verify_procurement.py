import csv,hashlib,io,json,posixpath,shutil,tempfile,zipfile
from pathlib import Path
from xml.etree import ElementTree as ET
from PIL import Image,ImageStat
from openpyxl import load_workbook

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'deliverables/2026-10-15'
FILE=OUT/'平顶山三场景_线下采购清单_21项实物图片版.xlsx'
rows=list(csv.DictReader((ROOT/'knowledge/tasks/data/2026-10-15_平顶山三场景线下采购_21项原始数据.csv').open(encoding='utf-8-sig')))
sources=json.loads((OUT/'image_sources.json').read_text(encoding='utf8'))
mapping=json.loads((OUT/'row_mapping.json').read_text(encoding='utf8'))
wb=load_workbook(FILE,data_only=False);cached=load_workbook(FILE,data_only=True)
ws=wb['完整采购表'];raw=wb['CSV原始数据'];shop=wb['看图采购']
cols={'序号':1,'区域':2,'优先级':3,'物品名称':4,'数量':6,'单位':7,'单价低元':8,'单价高元':9,'线下优先渠道':10,'缺货替代':11,'规格和用途':12}
dataChecks=[]
for r,m in zip(rows,mapping):
 for key,col in cols.items():
  expected=int(r[key]) if key in ['序号','数量','单价低元','单价高元'] else r[key]
  actual=ws.cell(m['mainRow'],col).value
  assert actual==expected,(r['序号'],key,expected,actual)
 for col,(key,value) in enumerate(r.items(),1):
  expected=int(value) if key in ['序号','数量','单价低元','单价高元'] else value
  assert raw.cell(m['id']+3,col).value==expected,('raw',m['id'],key)
 assert shop.cell(m['shopRow'],1).value==m['id']
 assert shop.cell(m['shopRow'],3).value==r['物品名称']
 assert shop.cell(m['shopRow'],4).value==r['数量']+r['单位']
 assert shop.cell(m['shopRow'],5).value==r['规格和用途']
 assert ws.cell(m['mainRow'],14).value is None
 assert ws.cell(m['mainRow'],16).value==f"=F{m['mainRow']}*H{m['mainRow']}"
 assert ws.cell(m['mainRow'],17).value==f"=F{m['mainRow']}*I{m['mainRow']}"
 dataChecks.append({'id':m['id'],'name':r['物品名称'],'source_fields_checked':11,'main_row':m['mainRow'],'shop_row':m['shopRow'],'result':'PASS'})
assert cached['完整采购表']['P29'].value==502
assert cached['完整采购表']['Q29'].value==1899
expectedHashes={s['sha256']:s['id'] for s in sources}
assert len(expectedHashes)==21
media=[];anchors=[];ns={'xdr':'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing','a':'http://schemas.openxmlformats.org/drawingml/2006/main','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
with zipfile.ZipFile(FILE) as z:
 assert z.testzip() is None
 for name in z.namelist():
  if name.startswith('xl/media/') and not name.endswith('/'):
   data=z.read(name);assert len(data)>2048,(name,len(data))
   im=Image.open(io.BytesIO(data));im.load()
   assert im.format in ['PNG','JPEG']
   assert min(im.size)>=200
   assert sum(ImageStat.Stat(im.convert('RGB')).stddev)>5
   if 'A' in im.getbands():assert im.getchannel('A').getbbox() is not None
   h=hashlib.sha256(data).hexdigest();assert h in expectedHashes,(name,h)
   media.append({'path':name,'bytes':len(data),'width':im.width,'height':im.height,'sha256':h,'id':expectedHashes[h]})
 assert len(media)>=21
 assert len({x['sha256'] for x in media})==21
 external=[]
 for name in z.namelist():
  if name.endswith('.rels'):
   rels=ET.fromstring(z.read(name))
   external += [{'part':name,'target':x.get('Target')} for x in rels if x.get('TargetMode')=='External']
 assert not external,external
 assert not any('externalLink' in p for p in z.namelist())
 assert not any('IMAGE(' in str(c.value) for sheet in wb for row in sheet for c in row if c.data_type=='f')
 # Follow worksheet -> drawing -> relationship -> actual embedded media, not file order.
 for idx,sheet in enumerate(wb.worksheets,1):
  sheetPart=f'xl/worksheets/sheet{idx}.xml';xml=ET.fromstring(z.read(sheetPart))
  drawing=xml.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}drawing')
  if drawing is None:continue
  rels={x.get('Id'):x.get('Target') for x in ET.fromstring(z.read(f'xl/worksheets/_rels/sheet{idx}.xml.rels'))}
  target=rels[drawing.get('{'+ns['r']+'}id')]
  drawPart=posixpath.normpath(posixpath.join('xl/worksheets',target)) if not target.startswith('/') else target[1:]
  dr=ET.fromstring(z.read(drawPart))
  relpath=posixpath.join(posixpath.dirname(drawPart),'_rels',posixpath.basename(drawPart)+'.rels')
  images={x.get('Id'):x.get('Target') for x in ET.fromstring(z.read(relpath))}
  perSheet=[]
  for anchor in dr:
   pic=anchor.find('xdr:pic',ns)
   if pic is None:continue
   f=anchor.find('xdr:from',ns);assert f is not None,'Absolute anchor unsupported for row audit'
   row=int(f.find('xdr:row',ns).text)+1;col=int(f.find('xdr:col',ns).text)+1
   blip=pic.find('.//a:blip',ns);assert blip.get('{'+ns['r']+'}link') is None
   target=images[blip.get('{'+ns['r']+'}embed')]
   mediaPart=posixpath.normpath(posixpath.join(posixpath.dirname(drawPart),target)) if not target.startswith('/') else target[1:]
   data=z.read(mediaPart);h=hashlib.sha256(data).hexdigest();item=expectedHashes[h]
   expected=next(m for m in mapping if m['id']==item)
   expectedRow,expectedCol=(expected['mainRow'],5) if sheet.title=='完整采购表' else (expected['shopRow'],2)
   assert (row,col)==(expectedRow,expectedCol),(sheet.title,item,row,col,expectedRow,expectedCol)
   ext=anchor.find('xdr:ext',ns)
   if ext is not None:
    width=int(ext.get('cx'))/9525;height=int(ext.get('cy'))/9525
    assert 240<=width<=252 and 168<=height<=176
   rowOffset=int(f.find('xdr:rowOff',ns).text)/9525
   assert rowOffset+172<=sheet.row_dimensions[row].height*96/72+1
   perSheet.append({'sheet':sheet.title,'id':item,'row':row,'column':col,'media':mediaPart,'sha256':h})
  assert sorted(x['id'] for x in perSheet)==list(range(1,22))
  anchors.extend(perSheet)
assert len(anchors)==42
# Copy only the .xlsx to an isolated temp folder: images/ and internet content are absent.
with tempfile.TemporaryDirectory(prefix='procurement_offline_') as tmp:
 p=Path(tmp)/FILE.name;shutil.copy2(FILE,p)
 with zipfile.ZipFile(p) as z:
  for m in media:Image.open(io.BytesIO(z.read(m['path']))).load()
 offline=load_workbook(p,data_only=True)
 assert len(offline['完整采购表']._images)==21
 assert len(offline['看图采购']._images)==21
report={'status':'PASS','data_rows':len(rows),'fields_compared_per_row':11,'budget_cny':{'low':502,'high':1899},'media_files':len(media),'unique_images':21,'zero_byte_images':0,'min_media_bytes':min(x['bytes'] for x in media),'max_media_bytes':max(x['bytes'] for x in media),'all_images_decode':True,'main_sheet_pictures':21,'shop_sheet_pictures':21,'anchors_checked':len(anchors),'external_relationships':0,'isolated_directory_decode':'PASS','workbook_sha256':hashlib.sha256(FILE.read_bytes()).hexdigest(),'data_checks':dataChecks,'media':media,'anchors':anchors}
(OUT/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({k:v for k,v in report.items() if k not in ['data_checks','media','anchors']},ensure_ascii=False,indent=2))
