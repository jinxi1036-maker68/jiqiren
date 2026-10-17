"""Windows job kills only the launcher's own children when its window closes."""
import ctypes
from ctypes import wintypes as w

class Basic(ctypes.Structure):
    _fields_=[('process_time',ctypes.c_longlong),('job_time',ctypes.c_longlong),('flags',w.DWORD),('min_working',ctypes.c_size_t),('max_working',ctypes.c_size_t),('active_limit',w.DWORD),('affinity',ctypes.c_size_t),('priority',w.DWORD),('scheduling',w.DWORD)]
class IO(ctypes.Structure):
    _fields_=[(n,ctypes.c_ulonglong) for n in ['read_ops','write_ops','other_ops','read_bytes','write_bytes','other_bytes']]
class Extended(ctypes.Structure):
    _fields_=[('basic',Basic),('io',IO),('process_memory',ctypes.c_size_t),('job_memory',ctypes.c_size_t),('peak_process_memory',ctypes.c_size_t),('peak_job_memory',ctypes.c_size_t)]

class OwnedJob:
    def __init__(self):
        self.k=ctypes.WinDLL('kernel32',use_last_error=True)
        self.k.CreateJobObjectW.argtypes=[ctypes.c_void_p,w.LPCWSTR];self.k.CreateJobObjectW.restype=w.HANDLE
        self.k.SetInformationJobObject.argtypes=[w.HANDLE,ctypes.c_int,ctypes.c_void_p,w.DWORD];self.k.SetInformationJobObject.restype=w.BOOL
        self.k.AssignProcessToJobObject.argtypes=[w.HANDLE,w.HANDLE];self.k.AssignProcessToJobObject.restype=w.BOOL
        self.k.CloseHandle.argtypes=[w.HANDLE];self.k.CloseHandle.restype=w.BOOL
        self.handle=self.k.CreateJobObjectW(None,None)
        if not self.handle:raise ctypes.WinError(ctypes.get_last_error())
        info=Extended();info.basic.flags=0x2000 # JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
        if not self.k.SetInformationJobObject(self.handle,9,ctypes.byref(info),ctypes.sizeof(info)):
            error=ctypes.get_last_error();self.close();raise ctypes.WinError(error)
    def add(self,process):
        if not self.k.AssignProcessToJobObject(self.handle,w.HANDLE(int(process._handle))):
            error=ctypes.get_last_error();process.terminate();process.wait(timeout=5);raise ctypes.WinError(error)
    def close(self):
        if self.handle:self.k.CloseHandle(self.handle);self.handle=None
