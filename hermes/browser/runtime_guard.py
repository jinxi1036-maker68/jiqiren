"""Distinguish protected business/identity files from native auth lifecycle.

Never writes auth/config/baseline. The credential store is only hashed, never
parsed. Native auth.py itself caches endpoints and rotates credentials there;
an ordinary native write must not permanently disable the whole employee.
"""
from pathlib import Path
from safety import check_snapshot,ordinary_path,sha256

class ProtectionView:
    def __init__(self,baseline,home,policy=None,notify=None):
        self.baseline=baseline;self.home=Path(home);self.policy=policy;self.notify=notify;self.seen=set()
        if policy is not None:
            if (set(policy)!={'schema','ownerApprovedTechnicalRepair','reference','volatile_native_auth_only'}
                or policy.get('schema')!='lingju.protection-lifecycle.v1'
                or policy.get('ownerApprovedTechnicalRepair') is not True
                or policy.get('volatile_native_auth_only') is not True or not policy.get('reference')
                or Path(baseline.get('home',''))!=self.home):
                raise ValueError('Explicit narrow native-auth lifecycle policy required')
    def blocking(self):
        changes=check_snapshot(self.baseline);blocked=[]
        for name in changes:
            p=Path(name);old=self.baseline['files'][name]
            if self.policy is not None and p==self.home/'auth.json' and old.get('exists') and p.is_file():
                try:ordinary_path(p)
                except (OSError,RuntimeError):blocked.append(name);continue
                digest=sha256(p)
                if digest not in self.seen:
                    self.seen.add(digest)
                    if self.notify:self.notify({'file':'auth.json','old_sha256':old['sha256'],'observed_sha256':digest,
                        'credential_values_parsed_or_disclosed':False,'file_written_by_guard':False,'change_cause':'unknown; native auth lifecycle exists'})
            else:blocked.append(name)
        return blocked
