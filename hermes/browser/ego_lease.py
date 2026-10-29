"""Recover only a proven-dead same-runtime tool lease, never live ownership."""
import datetime
import errno
import hashlib
import json
from pathlib import Path
import socket
import os
import psutil
from safety import ordinary_path


def _port_closed(port):
    with socket.socket() as s:
        s.settimeout(.3)
        result=s.connect_ex(('127.0.0.1',port))
    return result in {errno.ECONNREFUSED,10061}


def recover_dead_ego_lease(runtime,root,*,alive=psutil.pid_exists,port_closed=_port_closed):
    runtime,root=Path(runtime),Path(root)
    lock=root/'ego/active-worker.lock';meta=runtime.parent/'worker-private.json'
    mutex=lock.with_suffix('.recovery')
    def proof():
        try:
            ordinary_path(lock);ordinary_path(meta)
            if lock.is_symlink() or meta.is_symlink() or lock.stat().st_size>4096 or meta.stat().st_size>8192:return None
            raw=lock.read_bytes();owner=json.loads(raw);worker=json.loads(meta.read_bytes())
            pid,wpid,port=owner.get('pid'),worker.get('pid'),worker.get('port')
            if owner.get('runtime')!=str(runtime):return None
            if not all(isinstance(x,int) and not isinstance(x,bool) and 0<x<2**31 for x in [pid,wpid,port]) or port>65535:return None
            if alive(pid) or alive(wpid) or not port_closed(port):return None
            return raw,pid,wpid
        except (OSError,ValueError,RuntimeError,OverflowError,psutil.Error):return None
    first=proof()
    if not first:return False
    try:
        ordinary_path(mutex,allow_missing=True)
        fd=os.open(mutex,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
    except (OSError,RuntimeError):return False  # Never take over an unknown recovery owner.
    try:
        again=proof()
        if not again or again[0]!=first[0]:return False
        # All other recoverers use this mutex; normal wx creators cannot
        # replace an extant lease. Recheck while holding the mutex.
        if lock.read_bytes()!=again[0]:return False
        lock.unlink()
        with (runtime.parent/'lease-recovery-events.jsonl').open('a',encoding='utf-8') as f:
            f.write(json.dumps({'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),
                'event':'same_runtime_dead_lease_recovered','owner_pid':again[1],
                'worker_pid':again[2],'port_confirmed_closed':True,
                'lease_sha256':hashlib.sha256(again[0]).hexdigest(),'no_live_takeover':True})+'\n')
        return True
    finally:
        os.close(fd)
        mutex.unlink()  # This process created the exclusive recovery mutex.
