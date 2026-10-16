"""Offline preparation only: copy resolved vendor packages into new dev space."""
from pathlib import Path
import json,shutil,hashlib,sys,fnmatch
base=Path(__file__).resolve().parent;private=base/'private'
source_root=(Path.home()/'.hermes/tools/xianyu-browser-tools/node_modules').resolve()
dest=private/'neutral-sdk';dest.mkdir(exist_ok=False)
graph=json.loads((private/'dependency_graph_local_only.json').read_text(encoding='utf-8'))
def ignore(folder,names):return [n for n in names if n=='node_modules' or n=='.bin' or n=='.npmrc' or fnmatch.fnmatch(n,'.env*')]
summary=[];files=0
for pkg in graph['packages']:
    src=Path(pkg['source']).resolve();target=(dest/'node_modules'/pkg['relative']).resolve()
    if not src.is_relative_to(source_root) or not target.is_relative_to(dest):raise PermissionError('Package boundary mismatch')
    if any(p.is_symlink() for p in src.rglob('*') if p.name!='node_modules'):raise PermissionError('Vendor package contains a link; review before copying')
    shutil.copytree(src,target,ignore=ignore)
    digest=hashlib.sha256();count=0
    for p in sorted(target.rglob('*')):
        if p.is_file():
            value=p.read_bytes();digest.update(p.relative_to(target).as_posix().encode()+b'\0'+hashlib.sha256(value).digest());count+=1
    summary.append({'name':pkg['name'],'version':pkg['version'],'license':pkg['license'],'copied_files':count,'content_manifest_sha256':digest.hexdigest()});files+=count
(dest/'package.json').write_text(json.dumps({'name':'hermes-neutral-sdk-preparation','private':True,'version':'0.0.0-preparation','dependencies':{'@modelcontextprotocol/sdk':'1.30.0'}},indent=2),encoding='utf-8')
result={'method':'offline copy of resolved runtime vendor dependency closure into new dev directory only','packages':summary,'package_count':len(summary),'copied_files':files,'old_business_server_copied':False,'original_node_modules_modified':False,'package_install_or_network_used':False,'original_credential_files_read':False}
(private/'dependency_bundle_sanitized.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps({k:result[k] for k in ['package_count','copied_files','old_business_server_copied','original_node_modules_modified','package_install_or_network_used']}))
