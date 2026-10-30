"""Process-only hooks behind the genuine installed ``hermes gateway run`` CLI.

The CLI's live command line remains native; no argv spoofing, .pth installation,
default shortcut edits, or original-source patches. The explicit probe mode
imports the native CLI/runner but never starts its adapters or model loop.
"""
import asyncio
import functools
import importlib.abc
import importlib.machinery
import inspect
import json
import logging
import os
from pathlib import Path
import sys
import types


def validate_native_argv(argv):
    if '-m' not in argv or argv[argv.index('-m')+1:] != ['hermes_cli.main','gateway','run']:
        raise RuntimeError('Only the genuine native module gateway-run entry is allowed')
    if any(a not in ('-B','-u') for a in argv[1:argv.index('-m')]):
        raise RuntimeError('Unreviewed Python entry flags')


def install_import_hook(install, on_start, *, probe_run=None):
    install=Path(install)
    targets={'gateway.run','tools.skills_sync','hermes_cli.plugins'} | ({'hermes_cli.gateway'} if probe_run else set())

    class Loader:
        def __init__(self, original, name):self.original,self.name=original,name
        def create_module(self,spec):return self.original.create_module(spec)
        def exec_module(self,module):
            self.original.exec_module(module)
            if self.name=='gateway.run':
                original=module.start_gateway
                signature=inspect.signature(original)
                if set(signature.parameters)!={'config','replace','verbosity'}:
                    raise RuntimeError('Unreviewed native gateway start signature')
                @functools.wraps(original)
                async def start(*args,**kwargs):
                    values=signature.bind(*args,**kwargs);values.apply_defaults()
                    if values.arguments['replace']:raise RuntimeError('Forced replacement is not approved')
                    return await on_start(original,dict(values.arguments))
                module.start_gateway=start
            elif self.name=='hermes_cli.gateway':
                def dry_run(*args,**kwargs):
                    if kwargs.get('replace') or kwargs.get('force'):
                        raise RuntimeError('Probe cannot force or replace a gateway')
                    return probe_run()
                module.run_gateway=dry_run
            elif self.name=='tools.skills_sync':
                if not callable(getattr(module,'sync_skills',None)):
                    raise RuntimeError('Unreviewed native skill-sync interface')
                # CLI housekeeping must not update/clean the Owner's existing
                # Skills as a side effect of this temporary browser exercise.
                module.sync_skills=lambda quiet=False: {
                    'copied':[],'updated':[],'cleaned':[],'user_modified':[],
                    'skipped':0,'total_bundled':0,'skipped_temporary_exercise':True}
            elif self.name=='hermes_cli.plugins':
                if not callable(getattr(module,'_persist_plugin_toolset_keys',None)):
                    raise RuntimeError('Unreviewed native plugin-cache interface')
                # Keep discovery/registration active; omit only the disk cache
                # write, never disable an existing platform or plugin.
                module._persist_plugin_toolset_keys=lambda:None

    class Finder(importlib.abc.MetaPathFinder):
        def find_spec(self,fullname,path=None,target=None):
            if fullname not in targets:return None
            spec=importlib.machinery.PathFinder.find_spec(fullname,path)
            expected=install.joinpath(*fullname.split('.')).with_suffix('.py')
            if spec is None or Path(spec.origin).resolve()!=expected.resolve():
                raise RuntimeError('Native gateway module resolved outside the original installation')
            spec.loader=Loader(spec.loader,fullname)
            return spec
    if any(name in sys.modules for name in targets):
        raise RuntimeError('Bootstrap must precede native module imports')
    finder=Finder();sys.meta_path.insert(0,finder)
    return lambda:sys.meta_path.remove(finder)


def validate_context(root,env,argv,*,home=None,executable=None):
    from safety import ordinary_path,sha256,check_snapshot
    home=Path.home() if home is None else Path(home)
    executable=Path(sys.executable) if executable is None else Path(executable)
    root=ordinary_path(root);validate_native_argv(argv)
    if root!=home/'.hermes/tools/company-browser':raise RuntimeError('Not the owned tool directory')
    install=ordinary_path(env['LINGJU_FEISHU_INSTALL'])
    if install!=home/'AppData/Local/hermes/hermes-agent' or executable.resolve()!=install/'venv/Scripts/python.exe':
        raise RuntimeError('Original installed Python required')
    if env.get('HERMES_PROFILE') not in (None,'','default') or env.get('LINGJU_BROWSER_BUDGET')=='1':
        raise RuntimeError('Alternate profile or overlapping budget hook')
    gate_path=ordinary_path(env['LINGJU_FEISHU_GATE']);out=ordinary_path(env['LINGJU_FEISHU_OUTPUT'])
    if root/'runs' not in gate_path.parents or root/'runs' not in out.parents:
        raise RuntimeError('Gate/receipts must remain in owned runtime')
    baseline_path=ordinary_path(env['LINGJU_FEISHU_BASELINE'])
    gate=json.loads(gate_path.read_text('utf-8'))
    if sha256(baseline_path)!=gate['protected_baseline_sha256']:
        raise RuntimeError('Protected baseline changed')
    baseline=json.loads(baseline_path.read_text('utf-8'))
    required={'feishu_native_bootstrap.py','startup/sitecustomize.py','feishu_gateway.py','feishu_session_fence.py'}
    if not required<=set(gate['source_sha256']):raise RuntimeError('Bootstrap sources not pinned')
    for name,digest in gate['source_sha256'].items():
        candidate=ordinary_path(root/name)
        if root not in candidate.parents or sha256(candidate)!=digest:
            raise RuntimeError('Bootstrap source changed')
    if gate.get('runtime_protection') is not None and 'runtime_guard.py' not in gate['source_sha256']:
        raise RuntimeError('Native auth lifecycle guard source must be pinned')
    from runtime_guard import ProtectionView
    if ProtectionView(baseline,home/'.hermes',gate.get('runtime_protection')).blocking():
        raise RuntimeError('Protected files changed')
    runtime=ordinary_path(gate['browser_exercise']['runtime'])
    if root/'runs' not in runtime.parents or sha256(runtime)!=gate['browser_exercise']['runtime_sha256']:
        raise RuntimeError('Runtime changed')
    return types.SimpleNamespace(install=str(install),baseline=str(baseline_path),output=str(out),gate=str(gate_path)),runtime


def install_probe_guards(output):
    """Child-only zero-network, read-only-original-files compatibility probe."""
    output=Path(output).resolve()
    counts={'blocked_network':0,'blocked_original_writes':0,'asyncio_selfpipe':0}
    def allowed(path):
        if isinstance(path,int):return True
        p=Path(os.fsdecode(path)).resolve()
        return p==output or output in p.parents
    def audit(kind,args):
        if kind=='socket.connect':
            # Windows asyncio implements its own wake-up pipe with a local
            # socketpair. This is not an HTTP/browser/model connection.
            caller=sys._getframe(1)
            if (caller.f_code.co_name=='_fallback_socketpair' and caller.f_globals.get('__name__')=='socket'
                    and isinstance(args[1],tuple) and args[1][0] in ('127.0.0.1','::1')):
                counts['asyncio_selfpipe']+=1;return
            counts['blocked_network']+=1
            raise RuntimeError('No external or application network in native CLI probe')
        if kind in ('subprocess.Popen','os.system','os.exec','os.posix_spawn'):
            raise RuntimeError('No subprocesses in native CLI probe')
        if kind=='open':
            path,mode,flags=args
            writing=(isinstance(mode,str) and any(k in mode for k in 'wax+')) or (flags & (os.O_WRONLY|os.O_RDWR|os.O_CREAT|os.O_TRUNC|os.O_APPEND))
            # Windows tempfile retries PermissionError in an enormous loop for
            # a writable parent. This is a policy denial, not an OS ACL error.
            if writing and not allowed(path):
                counts['blocked_original_writes']+=1
                raise RuntimeError('Probe cannot write original files')
        if kind in ('os.mkdir','os.remove','os.rmdir','os.rename','os.chmod','os.utime','os.truncate','os.chown','os.link','os.symlink'):
            if kind=='os.mkdir' and Path(os.fsdecode(args[0])).is_dir():return
            paths=args[:2] if kind in ('os.rename','os.link','os.symlink') else args[:1]
            if not all(allowed(p) for p in paths):raise RuntimeError('Probe cannot mutate original paths')
    sys.addaudithook(audit)
    return counts


def install(root):
    root=Path(root)
    sys.path.insert(0,str(root))
    args,runtime=validate_context(root,os.environ,getattr(sys,'orig_argv',[]))
    home=Path.home()/'.hermes'
    os.environ.update(HERMES_HOME=str(home),TERMINAL_CWD=str(home/'company-workspace'),
                      LINGJU_BROWSER_EXERCISE='playwright',LINGJU_BROWSER_RUNTIME=str(runtime),
                      XDG_LINGJU_BROWSER_RUNTIME=str(runtime),PYTHONDONTWRITEBYTECODE='1')
    os.chdir(home/'company-workspace');sys.path.insert(0,args.install)
    logging.disable(logging.CRITICAL)
    probe=os.environ.get('LINGJU_FEISHU_ZERO_MODEL_PROBE')=='1'
    if probe:
        # Bound an unexpected import freeze to this isolated probe process.
        # The private dump contains stack locations, never frame locals.
        import faulthandler
        import tempfile
        scratch=Path(args.output)/'tmp';scratch.mkdir(exist_ok=True)
        tempfile.tempdir=str(scratch)
        os.environ.update(TEMP=str(scratch),TMP=str(scratch),TMPDIR=str(scratch))
        trace=(Path(args.output)/'probe-import-stack.txt').open('w',encoding='utf-8')
        faulthandler.dump_traceback_later(15,file=trace,exit=True)
        probe_counts=install_probe_guards(args.output)

    async def start(original,values):
        if probe:
            from gateway.status import looks_like_gateway_runtime_command_line
            import subprocess
            recognized=looks_like_gateway_runtime_command_line(subprocess.list2cmdline(sys.orig_argv))
            if not recognized:raise RuntimeError('Real native command is not recognized')
            from feishu_session_fence import resolve_native_session
            from gateway.session import SessionStore
            if (not all(callable(getattr(SessionStore,name,None)) for name in ('peek_session_id','_generate_session_key','get_or_create_session'))
                    or 'touch_activity' not in inspect.signature(SessionStore.get_or_create_session).parameters):
                raise RuntimeError('Native session lookup ABI changed')
            import gateway.run as native
            if not all(callable(getattr(native.GatewayRunner,name,None)) for name in
                       ('_handle_message','_primary_message_handler','_resolve_enabled_toolsets_for_source')):
                raise RuntimeError('Native message handler ABI changed')
            from safety import check_snapshot
            baseline=json.loads(Path(args.baseline).read_text('utf-8'))
            if check_snapshot(baseline):raise RuntimeError('Protected files changed in probe')
            result={'native_CLI_probe_passed':True,'real_native_argv_recognized':True,'adapters_started':0,
                    'model_requests':0,'gateway_PID_written':False,'original_files_writable':False,
                    'native_session_peek_ABI':True,'protected_changes':[],'pid':os.getpid(),
                    'probe_guard_counts':probe_counts,'native_common_message_handler_ABI':True}
            (Path(args.output)/'native-cli-probe.json').write_text(json.dumps(result,indent=2)+'\n','utf-8')
            import faulthandler
            faulthandler.cancel_dump_traceback_later()
            print(json.dumps(result),flush=True);return True
        from feishu_gateway import serve
        return await serve(args,native_start=original,cli_config=values['config'],verbosity=values['verbosity'])

    def dry_run():
        from gateway.run import start_gateway
        return asyncio.run(start_gateway())
    return install_import_hook(args.install,start,probe_run=dry_run if probe else None)
