import fcntl
import json
import os
import pwd
import re
import signal
import socket
import socketserver
import struct
import subprocess
from http.server import BaseHTTPRequestHandler


SOCKET = "/run/pi-livsyn/reader.sock"
PROFILE_LOCK = "/var/lib/pi-livsyn/profile.lock"
BRIDGE_USER = pwd.getpwnam("pi-feishu").pw_uid
READ_PATH = re.compile(r"/read/(statistics|projects|tasks|uploads|datasets|reviews|devices)/([1-9]\d{0,3})/([1-5])/([01])$")


def bridge_connection(conn):
    credentials = conn.getsockopt(socket.SOL_SOCKET, socket.SO_PEERCRED, struct.calcsize("3i"))
    pid, uid, _ = struct.unpack("3i", credentials)
    if uid == 0:
        return True
    if uid != BRIDGE_USER:
        return False
    main_pid = subprocess.check_output(
        ["/usr/bin/systemctl", "show", "pi-feishu.service", "-p", "MainPID", "--value"],
        timeout=2, universal_newlines=True,
    ).strip()
    return main_pid == str(pid)


def read_browser(view, page, count, details):
    with open(PROFILE_LOCK, "a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return 409, {"ok": False, "code": "BUSY"}
        with subprocess.Popen(
            ["/usr/bin/node", "/srv/pi-livsyn/app/browser.mjs", "read", view, page, count, details],
            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, start_new_session=True,
        ) as proc:
            try:
                output, _ = proc.communicate(timeout=65)
            except subprocess.TimeoutExpired:
                os.killpg(proc.pid, signal.SIGTERM)
                try:
                    proc.communicate(timeout=4)
                except subprocess.TimeoutExpired:
                    os.killpg(proc.pid, signal.SIGKILL)
                    proc.communicate()
                return 504, {"ok": False, "code": "TIMEOUT"}
    result = json.loads(output)
    return (200 if result.get("ok") else 422), result


class Handler(BaseHTTPRequestHandler):
    def setup(self):
        super().setup()
        self.connection.settimeout(6)

    def log_message(self, *args):
        pass

    def reply(self, status, result):
        data = json.dumps(result, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        try:
            self.wfile.write(data)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_GET(self):
        match = READ_PATH.fullmatch(self.path)
        if not match:
            return self.reply(404, {"ok": False, "code": "UNKNOWN_VIEW"})
        try:
            if not bridge_connection(self.connection):
                return self.reply(403, {"ok": False, "code": "FORBIDDEN"})
            if (match[1] == "statistics" and match.groups()[1:] != ("1", "1", "0")) or (match[4] == "1" and int(match[3]) > 2):
                return self.reply(400, {"ok": False, "code": "UNKNOWN_VIEW"})
            status, result = read_browser(*match.groups())
            print("read {} page={} count={} details={} status={}".format(*match.groups(), status), flush=True)
            self.reply(status, result)
        except (OSError, ValueError, subprocess.SubprocessError):
            self.reply(503, {"ok": False, "code": "READ_UNAVAILABLE"})


class Server(socketserver.ThreadingMixIn, socketserver.UnixStreamServer):
    daemon_threads = True


if __name__ == "__main__":
    os.umask(0o077)
    with Server(SOCKET, Handler) as server:
        os.chmod(SOCKET, 0o660)
        server.serve_forever()
