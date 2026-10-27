"""Owner-operated, private training browser; opens about:blank only.

This launcher never logs in, reads a business page, copies cookies, starts an
Agent or grants model calls. Owner confirmation and a new model allowance are
separate requirements before a later read-only teaching task.
"""
import argparse
import datetime
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import uuid

sys.path.insert(0,str(Path(__file__).resolve().parent))
from owned_job import OwnedJob
from safety import ordinary_path,windows_metadata,write_new_json

ORIGIN='https://ldp.lingrobotics.com'
PATHS=['/statistics']


def chrome_args(chrome,profile,*,direct_network=False):
    args=[str(chrome),'--user-data-dir='+str(profile),'--remote-debugging-port=0',
            '--remote-debugging-address=127.0.0.1','--disable-sync',
            '--disable-default-apps','--disable-extensions','--no-first-run',
            '--no-default-browser-check','--window-size=1280,900','about:blank']
    if direct_network:args.insert(-1,'--no-proxy-server')
    return args


def private_new_folder(folder):
    folder=ordinary_path(folder,allow_missing=True)
    folder.mkdir()
    ordinary_path(folder)
    # Only the new child folder is changed, never its parent or existing data.
    script="""$p='%s'; $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User;
$acl=New-Object Security.AccessControl.DirectorySecurity;
$acl.SetAccessRuleProtection($true,$false);
foreach($id in @($sid,(New-Object Security.Principal.SecurityIdentifier('S-1-5-18')))) {
 $rule=New-Object Security.AccessControl.FileSystemAccessRule($id,'FullControl','ContainerInherit,ObjectInherit','None','Allow');
 $acl.AddAccessRule($rule);
}; Set-Acl -LiteralPath $p -AclObject $acl;
$actual=Get-Acl -LiteralPath $p;
$bad=@($actual.Access | Where-Object {$_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -notin @($sid.Value,'S-1-5-18')});
if($bad.Count -ne 0 -or -not $actual.AreAccessRulesProtected){throw 'Training directory is not private'}; 'private_acl_ok'
""" % str(folder).replace("'","''")
    if windows_metadata(script)!='private_acl_ok':raise RuntimeError('Private ACL not confirmed')
    return folder


def resume_record(root,record):
    record=ordinary_path(record)
    if record.parent.parent!=root/'work-entry' or record.name!='preparation.json' or not record.parent.name.startswith('owner-training-'):
        raise RuntimeError('Only this project owned training profile can be resumed')
    old=json.loads(record.read_text('utf-8'))
    if (old.get('kind')!='lingju.readonly-teaching.preparation.v1'
            or ordinary_path(old['profile'])!=record.parent/'chrome-profile'
            or old.get('origin')!=ORIGIN or old.get('paths')!=PATHS):
        raise RuntimeError('Resume profile/scope differs')
    import psutil
    for p in psutil.process_iter(['name']):
        try:
            if p.name().lower()=='chrome.exe' and '--user-data-dir='+old['profile'] in p.cmdline():
                raise RuntimeError('Owned training browser is already open; do not duplicate')
        except (psutil.NoSuchProcess,psutil.AccessDenied):
            continue
    return record.parent,Path(old['profile']),old


def wait_owned_debugger(process,profile,timeout=20):
    """An old DevToolsActivePort file is insufficient after a computer restart."""
    import psutil
    marker=profile/'DevToolsActivePort';end=time.monotonic()+timeout
    while process.poll() is None and time.monotonic()<end:
        try:
            port=int(marker.read_text('utf-8').splitlines()[0])
            if 0<port<65536 and any(c.status==psutil.CONN_LISTEN and c.laddr.ip=='127.0.0.1' and c.laddr.port==port
                                   for c in psutil.Process(process.pid).net_connections(kind='tcp')):
                return port
        except (FileNotFoundError,ValueError,IndexError,psutil.NoSuchProcess):
            pass
        time.sleep(.1)
    raise RuntimeError('Owned Chrome debugger did not become ready; stale marker is not accepted')


def open_browser(root,resume=None,*,direct_network=False):
    root=ordinary_path(root)
    if root!=Path.home()/'.hermes/tools/company-browser':raise RuntimeError('Owned tool root required')
    chrome=ordinary_path(Path(os.environ.get('ProgramFiles',r'C:\Program Files'))/'Google/Chrome/Application/chrome.exe')
    parent=ordinary_path(root/'work-entry')
    if resume:
        folder,profile,old=resume_record(root,resume)
    else:
        folder=private_new_folder(parent/('owner-training-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'-'+uuid.uuid4().hex[:8]))
        profile=folder/'chrome-profile';profile.mkdir();old=None
    meta={'kind':'lingju.readonly-teaching.preparation.v1','created_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),
          'origin':ORIGIN,'paths':PATHS,'profile':str(profile),'owner_login_confirmed':False,
          'model_stage_authorized':False,'Hermes_messages':0,'model_requests':0,
          'business_page_opened_by_Codex':False,'cookies_copied':False,
          'network_route':'process-only direct' if direct_network else 'existing system route',
          'state':'awaiting_Owner_manual_login; model stage closed'}
    if old:
        meta['previous_attempts']=[*old.get('previous_attempts',[]),{k:old.get(k) for k in
            ('created_at','opened_at','closed_at','chrome_pid','owner_login_confirmed','owner_login_confirmation')}]
        meta['resumed_same_private_profile']=True
        (folder/'preparation.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n','utf-8')
    else:write_new_json(folder/'preparation.json',meta)
    env={k:v for k,v in os.environ.items() if k.upper() in {'PATH','PATHEXT','SYSTEMROOT','WINDIR','COMSPEC','USERPROFILE','APPDATA','LOCALAPPDATA','TEMP','TMP'}}
    job=OwnedJob();p=None
    try:
        startup=subprocess.STARTUPINFO()
        startup.dwFlags|=subprocess.STARTF_USESHOWWINDOW
        startup.wShowWindow=1  # Explicit interactive launch, not inherited minimized state.
        p=subprocess.Popen(chrome_args(chrome,profile,direct_network=direct_network),env=env,cwd=folder,
                           stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,
                           startupinfo=startup,creationflags=subprocess.CREATE_NO_WINDOW)
        job.add(p)
        port=wait_owned_debugger(p,profile)
        meta.update(chrome_pid=p.pid,cdp='http://127.0.0.1:'+str(port),opened_at=datetime.datetime.now(datetime.timezone.utc).isoformat())
        (folder/'preparation.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n','utf-8')
        print(json.dumps({'event':'owner_training_blank_browser_ready','folder':str(folder),'chrome_pid':p.pid,
                         'manual_url':ORIGIN+PATHS[0],'model_requests':0,'business_page_opened_by_Codex':False}),flush=True)
        while p.poll() is None:
            line=sys.stdin.readline()
            if not line or line.strip()=='stop':break
    finally:
        job.close()
        if p:
            p.wait(timeout=10)
        meta.update(closed_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),children_exited=p is None or p.poll() is not None)
        (folder/'preparation.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n','utf-8')


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--open',action='store_true')
    parser.add_argument('--owner-at-computer',action='store_true')
    parser.add_argument('--resume')
    parser.add_argument('--direct-network',action='store_true',help='Bypass the system HTTP proxy only for this owned browser process; does not bypass a VPN tunnel')
    a=parser.parse_args()
    if a.open:
        if not a.owner_at_computer:raise RuntimeError('Wait for Owner presence/authorization before opening')
        open_browser(Path(__file__).resolve().parent,a.resume,direct_network=a.direct_network)
    else:
        print(json.dumps({'state':'preparation_only','url':ORIGIN+PATHS[0],
                          'model_requests':0,'browser_started':False,'owner_login_required':True}))


if __name__=='__main__':main()
