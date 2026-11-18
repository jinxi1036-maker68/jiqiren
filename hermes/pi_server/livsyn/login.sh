#!/bin/bash
set -euo pipefail
umask 077

runtime=/run/pi-livsyn-login
export DISPLAY=:74
export XAUTHORITY="$runtime/Xauthority"
exec 9>/var/lib/pi-livsyn/profile.lock
flock -n 9

x_pid=
vnc_pid=
web_pid=
browser_pid=
cleanup() {
    if [[ -n "$browser_pid" ]]; then
        kill -TERM "$browser_pid" 2>/dev/null || true
        wait "$browser_pid" || true
    fi
    for process in "$web_pid" "$vnc_pid" "$x_pid"; do
        if [[ -n "$process" ]]; then kill -TERM "$process" 2>/dev/null || true; fi
    done
}
trap cleanup EXIT
trap 'exit 0' TERM INT

xauth -q add "$DISPLAY" MIT-MAGIC-COOKIE-1 "$(mcookie)"
Xvfb "$DISPLAY" -screen 0 1200x800x24 -nolisten tcp -auth "$XAUTHORITY" &
x_pid=$!
for attempt in {1..30}; do
    if [[ -S /tmp/.X11-unix/X74 ]]; then break; fi
    sleep 0.2
done
test -S /tmp/.X11-unix/X74
secret=$(openssl rand -hex 4)
x11vnc -storepasswd "$secret" "$runtime/vnc.auth" >/dev/null 2>&1
printf '%s' "$secret" >"$runtime/client-password"
unset secret
x11vnc -display "$DISPLAY" -auth "$XAUTHORITY" -localhost -rfbport 18818 -rfbauth "$runtime/vnc.auth" -forever -quiet -noxdamage -no6 &
vnc_pid=$!
websockify --web=/usr/share/novnc --idle-timeout=900 127.0.0.1:18819 127.0.0.1:18818 &
web_pid=$!
/usr/bin/node /srv/pi-livsyn/app/browser.mjs login &
browser_pid=$!
wait "$browser_pid"
