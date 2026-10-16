"""Create two separate local launch files, never modify original shortcuts."""
from pathlib import Path
import argparse,json

p=argparse.ArgumentParser();p.add_argument('runtime',type=Path);p.add_argument('destination',type=Path);a=p.parse_args()
r=a.runtime.resolve();runtime=json.loads(r.read_text(encoding='utf-8'));entry=Path(__file__).with_name('entry.py').resolve();dest=a.destination.resolve();dest.mkdir(parents=True,exist_ok=True)
for name,flag in [('启动数采Hermes.cmd',''),('自检数采身份.cmd','--check')]:
    path=dest/name
    if path.exists():raise FileExistsError('Refusing to overwrite any existing entry file')
    literal=lambda x:str(x).replace('%','%%')
    body='@echo off\r\nsetlocal\r\nchcp 65001 >nul\r\ntitle Hermes - Data Operations - Isolated Simulation\r\n"'+literal(runtime['python'])+'" -I -B "'+literal(entry)+'" "'+literal(r)+'" '+flag+'\r\nif errorlevel 1 pause\r\n'+('pause\r\n' if flag else '')+'endlocal\r\n'
    path.write_text(body,encoding='utf-8',newline='')
print(json.dumps({'separate_entry_files_created':2,'desktop_shortcuts_overwritten':False,'global_environment_changed':False,'installations_performed':False}))
