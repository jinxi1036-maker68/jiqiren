"""Local-only GUI for Owner to store a dedicated GitHub PAT in WinCred.

Never accepts a token from CLI, environment, chat, or a file.
"""
import ctypes
from ctypes import wintypes
import tkinter as tk
from tkinter import messagebox

from client import CREDENTIAL_TARGET


class CREDENTIAL(ctypes.Structure):
    _fields_ = [("Flags", wintypes.DWORD), ("Type", wintypes.DWORD),
                ("TargetName", wintypes.LPWSTR), ("Comment", wintypes.LPWSTR),
                ("LastWritten", wintypes.FILETIME), ("CredentialBlobSize", wintypes.DWORD),
                ("CredentialBlob", ctypes.POINTER(ctypes.c_ubyte)),
                ("Persist", wintypes.DWORD), ("AttributeCount", wintypes.DWORD),
                ("Attributes", ctypes.c_void_p), ("TargetAlias", wintypes.LPWSTR),
                ("UserName", wintypes.LPWSTR)]


def write_credential(token):
    if not token or len(token) > 4096 or "\n" in token:
        raise ValueError("Token format is invalid")
    raw = token.encode("utf-8")
    blob = (ctypes.c_ubyte * len(raw)).from_buffer_copy(raw)
    item = CREDENTIAL()
    item.Type = 1  # CRED_TYPE_GENERIC
    item.TargetName = CREDENTIAL_TARGET
    item.UserName = "lingju-hermes-github-readonly"
    item.CredentialBlobSize = len(raw)
    item.CredentialBlob = ctypes.cast(blob, ctypes.POINTER(ctypes.c_ubyte))
    item.Persist = 2  # CRED_PERSIST_LOCAL_MACHINE, scoped to this Windows user
    api = ctypes.windll.advapi32
    api.CredWriteW.argtypes = [ctypes.POINTER(CREDENTIAL), wintypes.DWORD]
    api.CredWriteW.restype = wintypes.BOOL
    if not api.CredWriteW(ctypes.byref(item), 0):
        raise OSError("Windows Credential Manager declined the write")


def main():
    root = tk.Tk()
    root.title("凌矩 GitHub 只读凭据")
    root.geometry("560x210")
    tk.Label(root, text="仅粘贴限定 jiqiren 仓库、Contents: read 的 fine-grained PAT。\n请勿在聊天中发送。此窗口不会把凭据写入文件、配置或日志。",
             justify="left", wraplength=530).pack(padx=14, pady=16)
    value = tk.StringVar()
    field = tk.Entry(root, textvariable=value, show="•", width=68)
    field.pack(padx=14)
    field.focus_set()

    def save():
        try:
            write_credential(value.get().strip())
        except (ValueError, OSError) as exc:
            messagebox.showerror("未保存", str(exc))
            return
        value.set("")
        messagebox.showinfo("已保存", "专用只读凭据已保存到当前 Windows 用户的凭据管理器。")
        root.destroy()

    tk.Button(root, text="保存到 Windows 凭据管理器", command=save).pack(pady=20)
    root.mainloop()


if __name__ == "__main__":
    main()
