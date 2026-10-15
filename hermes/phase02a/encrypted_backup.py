"""Local AES-GCM + Windows DPAPI backup and non-executing restore verification.

Never publish the archive, raw manifest, restored files, or local work directory.
The encryption key is wrapped for the current Windows account, not portable DR.
"""
from pathlib import Path
import argparse, base64, ctypes, datetime, gzip, hashlib, io, json, os, shutil, sqlite3, struct, tarfile, time
from concurrent.futures import ThreadPoolExecutor,as_completed
from ctypes import wintypes
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.exceptions import InvalidTag

MAGIC=b'HERMES-DPAPI-AESGCM-V1\n'
class Blob(ctypes.Structure):
    _fields_=[('cbData',wintypes.DWORD),('pbData',ctypes.POINTER(ctypes.c_ubyte))]
def dpapi(data, decrypt=False):
    buf=ctypes.create_string_buffer(data); src=Blob(len(data),ctypes.cast(buf,ctypes.POINTER(ctypes.c_ubyte))); dst=Blob()
    api=ctypes.windll.crypt32.CryptUnprotectData if decrypt else ctypes.windll.crypt32.CryptProtectData
    if decrypt:ok=api(ctypes.byref(src),None,None,None,None,1,ctypes.byref(dst))
    else:ok=api(ctypes.byref(src),'Hermes local recovery key',None,None,None,1,ctypes.byref(dst))
    if not ok:raise ctypes.WinError()
    try:return ctypes.string_at(dst.pbData,dst.cbData)
    finally:ctypes.windll.kernel32.LocalFree(dst.pbData)

class EncryptedWriter:
    def __init__(self, handle, encryptor):self.handle=handle;self.encryptor=encryptor
    def write(self,b):self.handle.write(self.encryptor.update(b));return len(b)
    def flush(self):self.handle.flush()

class DecryptedReader(io.RawIOBase):
    def __init__(self,handle,decryptor,length):self.handle=handle;self.decryptor=decryptor;self.remaining=length;self.done=False
    def readable(self):return True
    def readinto(self,destination):
        if self.done:return 0
        if self.remaining:
            b=self.handle.read(min(len(destination),self.remaining));self.remaining-=len(b)
            if not b:raise ValueError('Truncated ciphertext')
            plain=self.decryptor.update(b);destination[:len(plain)]=plain;return len(plain)
        self.decryptor.finalize();self.done=True;return 0
    def authenticate(self):
        while self.remaining:
            b=self.handle.read(min(4*1024*1024,self.remaining));self.remaining-=len(b)
            if not b:raise ValueError('Truncated ciphertext')
            self.decryptor.update(b)
        if not self.done:self.decryptor.finalize();self.done=True

def sha(p):
    h=hashlib.sha256()
    with p.open('rb') as f:
        for chunk in iter(lambda:f.read(4*1024*1024),b''):h.update(chunk)
    return h.hexdigest()

def files_for_backup(plan):
    allowed={'memories','skills','cron','desktop','desktop-plugins','hooks','kanban','pairing','profiles','providers','scripts','tools','config'}
    result=[]
    for row in plan['files']:
        parts=Path(row['relative']).parts
        if parts[-1].lower() in {'lockfile','devtoolsactiveport'}:continue
        if row['scope']=='platform_home' and len(parts)>1 and parts[0] not in allowed:continue
        result.append(row)
    return result

def safe_destination(root,name):
    dest=(root/name).resolve()
    if not dest.is_relative_to(root.resolve()):raise ValueError('Unsafe archive path')
    return dest

def build(plan_path, private):
    plan=json.loads(plan_path.read_text(encoding='utf-8'));rows=files_for_backup(plan)
    stage=private/'sqlite_snapshots';stage.mkdir(parents=True,exist_ok=True)
    archive=private/'hermes-state.hbak.enc'
    if archive.exists():raise FileExistsError('Refusing to overwrite a prior backup')
    key=os.urandom(32);nonce=os.urandom(12)
    header=json.dumps({'version':1,'algorithm':'AES-256-GCM','key_wrap':'Windows-DPAPI-CurrentUser','wrapped_key':base64.b64encode(dpapi(key)).decode(),'nonce':base64.b64encode(nonce).decode()},sort_keys=True).encode()
    encryptor=Cipher(algorithms.AES(key),modes.GCM(nonce)).encryptor();encryptor.authenticate_additional_data(header)
    manifest=[];dbs=0;total=0;start=time.monotonic();scope_counts={}
    print(json.dumps({'event':'backup_started','files':len(rows),'planned_bytes':sum(x['bytes'] for x in rows)}),flush=True)
    with archive.open('xb') as output:
        output.write(MAGIC+struct.pack('>I',len(header))+header)
        writer=EncryptedWriter(output,encryptor)
        with gzip.GzipFile(fileobj=writer,mode='wb',compresslevel=1) as compressed, tarfile.open(mode='w|',fileobj=compressed) as tar:
            for i,row in enumerate(rows):
                source=Path(row['source']);arc=row['scope']+'/'+row['relative'];selected=source;is_db=False
                with source.open('rb') as f:head=f.read(16)
                if head==b'SQLite format 3\0':
                    is_db=True;dbs+=1;selected=safe_destination(stage,arc);selected.parent.mkdir(parents=True,exist_ok=True)
                    original=sqlite3.connect(source.as_uri()+'?mode=ro',uri=True,timeout=10)
                    original.execute('PRAGMA query_only=ON')
                    copy=sqlite3.connect(selected)
                    original.backup(copy,pages=4096,sleep=0.02);copy.close();original.close()
                    # This snapshot includes committed WAL pages. Original WAL/SHM are not copied separately.
                before=selected.stat();digest=sha(selected)
                tar.add(selected,arcname=arc,recursive=False)
                after=selected.stat()
                if (before.st_size,before.st_mtime_ns)!=(after.st_size,after.st_mtime_ns):raise RuntimeError('Source changed during snapshot: scope='+row['scope'])
                manifest.append({'path':arc,'bytes':after.st_size,'sha256':digest,'sqlite_consistent_snapshot':is_db})
                total+=after.st_size;scope_counts[row['scope']]=scope_counts.get(row['scope'],0)+1
                if (i+1)%250==0:print(json.dumps({'event':'backup_progress','files_done':i+1,'bytes_done':total,'elapsed_seconds':round(time.monotonic()-start)}),flush=True)
            payload=json.dumps({'format':1,'files':manifest,'scope_counts':scope_counts,'exclusions':'Regenerable caches, installed application/source/dependencies, old backup/staging/test trees, volatile IPC/locks, raw WAL/SHM; live SQLite uses consistent online snapshots.'},ensure_ascii=False).encode()
            info=tarfile.TarInfo('__backup_manifest__.json');info.size=len(payload);tar.addfile(info,io.BytesIO(payload))
        output.write(encryptor.finalize());output.write(encryptor.tag)
    (private/'manifest_local_only.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    summary={'archive_created':True,'file_count':len(manifest),'plaintext_bytes':total,'sqlite_snapshots':dbs,'scope_counts':scope_counts,'encrypted_bytes':archive.stat().st_size,'key_wrap':'Windows DPAPI current user','original_data_overwritten':False,'restore_verified':False,'elapsed_seconds':round(time.monotonic()-start)}
    (private/'backup_summary.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
    print(json.dumps({'event':'backup_completed',**summary}),flush=True)

def verify(private,resume_extracted=False):
    archive=private/'hermes-state.hbak.enc';restore=private/'restore_verification'
    if restore.exists() and not resume_extracted:raise FileExistsError('Refusing to reuse restoration directory without explicit verification-only resume')
    if resume_extracted and not restore.exists():raise FileNotFoundError('No existing extraction to verify')
    restore.mkdir(exist_ok=resume_extracted);start=time.monotonic();expected=None;count=0
    with archive.open('rb') as source:
        if source.read(len(MAGIC))!=MAGIC:raise ValueError('Wrong archive format')
        length=struct.unpack('>I',source.read(4))[0];header_bytes=source.read(length);header=json.loads(header_bytes)
        key=dpapi(base64.b64decode(header['wrapped_key']),True);nonce=base64.b64decode(header['nonce'])
        pos=source.tell();source.seek(-16,2);tag=source.read(16);cipher_length=source.tell()-16-pos;source.seek(pos)
        dec=Cipher(algorithms.AES(key),modes.GCM(nonce,tag)).decryptor();dec.authenticate_additional_data(header_bytes)
        reader=DecryptedReader(source,dec,cipher_length)
        with tarfile.open(mode='r|gz',fileobj=reader) as tar:
            for entry in tar:
                if not entry.isfile():continue
                data=tar.extractfile(entry)
                if entry.name=='__backup_manifest__.json':expected=json.load(data);continue
                dest=safe_destination(restore,entry.name)
                if not resume_extracted:
                    dest.parent.mkdir(parents=True,exist_ok=True)
                    with dest.open('xb') as f:shutil.copyfileobj(data,f,4*1024*1024)
                count+=1
                if count%500==0:print(json.dumps({'event':'archive_verification_progress' if resume_extracted else 'restore_progress','archive_entries_checked' if resume_extracted else 'files_restored':count}),flush=True)
        reader.authenticate()
    if not expected or count!=len(expected['files']):raise ValueError('Restoration manifest/count mismatch')
    databases=[]
    def check_file(row):
        f=safe_destination(restore,row['path'])
        if f.stat().st_size!=row['bytes'] or sha(f)!=row['sha256']:raise ValueError('Restored file hash mismatch')
        if row['sqlite_consistent_snapshot']:
            conn=sqlite3.connect(f.as_uri()+'?mode=ro&immutable=1',uri=True)
            conn.execute('PRAGMA cache_size=-131072')
            conn.execute('PRAGMA mmap_size=268435456')
            result=[x[0] for x in conn.execute('PRAGMA integrity_check')]
            if result!=['ok']:raise ValueError('Restored SQLite integrity check failed')
            conn.close();return True
        return False
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures=[pool.submit(check_file,row) for row in expected['files']]
        for i,future in enumerate(as_completed(futures),1):
            if future.result():databases.append({'integrity':'ok'})
            if i%1000==0:print(json.dumps({'event':'verify_progress','files_verified':i}),flush=True)
    # Verify an altered tag on this actual archive, without changing its bytes.
    bad_tag=tag[:-1]+bytes([tag[-1]^1]);bad=Cipher(algorithms.AES(key),modes.GCM(nonce,bad_tag)).decryptor()
    bad.authenticate_additional_data(header_bytes)
    with archive.open('rb') as source:
        source.seek(pos);remaining=cipher_length
        while remaining:
            block=source.read(min(4*1024*1024,remaining));remaining-=len(block);bad.update(block)
    try:bad.finalize()
    except InvalidTag:tamper_rejected=True
    else:raise ValueError('Actual archive tag corruption was not rejected')
    summary=json.loads((private/'backup_summary.json').read_text())
    summary.update({'restore_verified':True,'restored_files_hash_verified':count,'restored_sqlite_integrity_ok':len(databases),'authenticated_decryption_verified':True,'tamper_negative_test_rejected':tamper_rejected,'restored_agent_started':False,'restored_jobs_executed':False,'verification_workers':8,'resume_extracted_verification_only':resume_extracted,'restore_elapsed_seconds':round(time.monotonic()-start),'recovery_limit':'Requires same Windows DPAPI user context; not an independently portable disaster recovery archive.'})
    (private/'backup_summary.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
    print(json.dumps({'event':'restore_verified',**summary}),flush=True)

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('action',choices=['build','verify']);ap.add_argument('--private',type=Path,required=True);ap.add_argument('--plan',type=Path);ap.add_argument('--resume-extracted',action='store_true');a=ap.parse_args()
    a.private.mkdir(parents=True,exist_ok=True)
    if a.action=='build':build(a.plan,a.private)
    else:verify(a.private,a.resume_extracted)
