"""Opt-in browser exercise in the original, full native Hermes gateway.

No second gateway/profile, no persisted platform or tool configuration changes.
All original adapters are started by the native runner. Only the pinned Owner's
exact-prefix Feishu task gets the new exercise tools/budget. Run only after a
controlled handoff from the existing gateway; never use --replace here.
"""
import argparse
import asyncio
import contextlib
import hashlib
import json
import logging
import os
from pathlib import Path
import sqlite3
import sys
import traceback

from feishu_meter import CURRENT_TURN, GatewayMeter, gateway_pacer, propagate_title_threads
from feishu_transport import FeishuTrafficPolicy, tag_sdk_transport, validate_websocket
from qq_browser_task import BrowserExercise, FEISHU_TRANSFER, PREFIX
from qq_runtime import (TOOLSETS, EXPECTED_BROWSER_TOOLS, verify_browser_catalog,
                        metadata_catalog_urls, apply_model_proxy_bypass, newly_budget_blocked, event)
from safety import ordinary_path, sha256, check_snapshot
from traffic_guard import install_traffic_guard
from qq_chat import OrdinaryTrafficAudit
from feishu_session_fence import resolve_native_session, local_session_command
from feishu_progress import FeishuProgress, approved_progress


def validate_gateway_handoff(gate):
    if (gate.get('channel_transfer_authorization')!=FEISHU_TRANSFER
            or gate.get('native_gateway_restart_approved') is not True
            or gate.get('existing_other_platforms_not_disabled') is not True):
        raise RuntimeError('Owner-approved native gateway handoff required')


def is_owner(source, binding):
    platform=getattr(source.platform,'value',source.platform)
    return (platform=='feishu' and source.chat_type=='dm'
            and hashlib.sha256((source.user_id or '').encode()).hexdigest()==binding['user_sha256']
            and hashlib.sha256((source.chat_id or '').encode()).hexdigest()==binding['chat_sha256'])


def native_connected(adapter):
    # Native BasePlatformAdapter.is_connected is a property, not a method.
    value=getattr(adapter,'is_connected',False)
    if not isinstance(value,bool):raise RuntimeError('Unreviewed native connection-status interface')
    return value


def check_fresh_session(db, entry):
    # No chat bodies, titles, prompt or private memory are read.
    with contextlib.closing(sqlite3.connect(Path(db).as_uri()+'?mode=ro',uri=True)) as c:
        row=c.execute('select api_call_count,message_count,tool_call_count from sessions where id=?',
                      (entry.session_id,)).fetchone()
    if row and any(value or 0 for value in row):
        raise RuntimeError('Native new session is not empty')
    return entry.session_id


def install_runner_hooks(native, exercise, meter, out, baseline, binding, home, progress_options=None):
    Runner=native.GatewayRunner
    old_primary=Runner._primary_message_handler
    old_handle=Runner._handle_message
    old_tools=Runner._resolve_enabled_toolsets_for_source
    old_start=Runner.start
    old_adapter=Runner._create_adapter
    old_iterations=native._current_max_iterations
    sdk_restores=[]

    def create_adapter(self, platform, config):
        adapter=old_adapter(self,platform,config)
        if getattr(platform,'value',platform)=='feishu' and adapter is not None:
            from lark_oapi.core.http.transport import Transport
            if not sdk_restores:sdk_restores.append(tag_sdk_transport(Transport))
        return adapter

    def tools(self, user_config, source, platform_key):
        turn=CURRENT_TURN.get()
        if turn and turn.get('browser') and turn['live'].is_set():
            if not is_owner(source,binding):raise RuntimeError('Browser source changed')
            if turn.get('control'):return []
            return list(getattr(exercise,'toolsets',TOOLSETS))
        if getattr(source.platform,'value',source.platform)=='feishu':
            # Temporary exercise launcher: natural text replies continue, but
            # a plain "continue" cannot reopen browser/business permissions.
            return []
        # The temporary simulation cannot be invoked as unmetered normal chat.
        # Other platforms keep their native tools except this test-only MCP.
        # No saved tool configuration is changed.
        return [t for t in old_tools(self,user_config,source,platform_key)
                if t!='company_browser_simulation']

    def primary(self):
        async def native_handler(msg):return await old_handle(self,msg)
        async def continuous_handle(msg):
            owner=is_owner(msg.source,binding)
            if not owner:
                turn,token=meter.begin(False)
                try:return await native_handler(msg)
                finally:meter.finish(turn,token)
            if not self._is_user_authorized(msg.source):return None
            control=(msg.text or '').lstrip().startswith('/')
            if not control:
                if check_snapshot(baseline):
                    exercise.pause()
                    return '受保护文件发生变化，请交Codex核对；当前消息未提交模型。'
                if not exercise.catalog_ready:return '浏览器入口尚未就绪，请稍后正常发送工作目标。'
                if not exercise.session_initialized:
                    sid=resolve_native_session(self.session_store,msg.source)
                    exercise.session_initialized=True
                    event(out,'daily_readonly_session_started',session_id=sid,cwd=os.getcwd(),native_force_new=False,native_conversation_continued=True)
            turn,token=meter.begin(True,control=control)
            progress=None
            outcome='error'
            try:
                if not control:
                    exercise.budget.arm()
                    if progress_options is not None:
                        try:
                            adapter=self._adapter_for_source(msg.source)
                            if adapter is not None:
                                progress=FeishuProgress(adapter,msg,out,
                                    interval=progress_options['interval_seconds'],
                                    io_timeout=progress_options['io_timeout_seconds']).start()
                                turn['progress']=progress
                        except Exception as exc:
                            event(out,'owner_progress_unavailable',error_type=type(exc).__name__)
                result=await native_handler(msg)
                outcome='returned'
                return result
            except asyncio.CancelledError:
                outcome='cancelled'
                raise
            finally:
                if progress is not None:progress.finish(outcome)
                meter.finish(turn,token)
                exercise.pause()
                if not control:event(out,'daily_readonly_message_returned',audit=exercise.budget.status(),protected_changes=check_snapshot(baseline))
        async def handle(msg):
            if getattr(exercise,'continuous',False):return await continuous_handle(msg)
            browser=exercise.matches(msg.text or '')
            owner=is_owner(msg.source,binding)
            # Native routing, not a language heuristic, determines whether this
            # is still the old exercise. Persist across controlled restarts.
            if owner and not self._is_user_authorized(msg.source):return None
            if not browser and owner:
                sid=resolve_native_session(self.session_store,msg.source)
                phase=exercise.fence.phase(sid)
                if phase:
                    if local_session_command(msg):
                        turn,token=meter.begin(True,control=True)
                        try:return await native_handler(msg)
                        finally:meter.finish(turn,token)
                    event(out,'exercise_continuation_blocked_before_model',session_id=sid,phase=phase)
                    return ('本次模拟会话正在执行或已经结束，不能用“继续”追加任务或绕过额度。'
                            '旧结果已保留；日常聊天请在原界面新建会话或发送 /new。新的模拟任务需另行授权。')
                if exercise.fence.mentions_protected_session(msg.text or ''):
                    return '该会话属于已记录的模拟验收，不能在普通聊天中恢复执行；旧记录保留，新的任务需另行授权。'
            if browser:
                if not owner:
                    return None
                if check_snapshot(baseline):
                    exercise.pause()
                    return '保护文件出现新变化，本轮模拟任务未提交模型；请交由Codex核对。'
                try:slot=exercise.admit(msg.message_id)
                except RuntimeError:
                    return '本轮模拟任务尚未开放或已接收。普通聊天仍按原通道工作，请不要重复发验收任务。'
                if slot is None:return None
                # Native new-conversation operation. Preserve source/Feishu
                # delivery IDs and old history; no synthetic /new or model message.
                try:
                    entry=self.session_store.get_or_create_session(msg.source,force_new=True)
                    sid=check_fresh_session(home/'state.db',entry)
                    exercise.fence.bind(sid,exercise.ledger)
                except Exception as exc:
                    exercise.pause()
                    event(out,'feishu_fresh_session_failed',error_type=type(exc).__name__,model_calls=0)
                    raise
                event(out,'feishu_browser_admitted',session_id=sid,cwd=os.getcwd(),
                      original_source_and_delivery_preserved=True,native_force_new=True)
            turn,token=meter.begin(browser)
            before=exercise.budget.status() if browser else None
            try:
                # READY is not permission for idle/background generation.
                # Arm only after the actual Owner task, new native session,
                # durable fence and request context have all been established.
                if browser:exercise.budget.arm()
                try:result=await native_handler(msg)
                except Exception:
                    if not browser or not newly_budget_blocked(before,exercise.budget.status()):raise
                    result=None
                if browser and newly_budget_blocked(before,exercise.budget.status()):
                    return '本轮模拟任务已达到30次请求上限，后续模型请求已拦住。未完成范围由Codex按收据核对；普通聊天不受这份模拟额度限制。'
                return result
            finally:
                meter.finish(turn,token)
                if browser:
                    exercise.pause()
                    exercise.fence.close(sid)
                    event(out,'feishu_browser_returned',budget=exercise.budget.status(),
                          protected_changes=check_snapshot(baseline))
        return handle

    async def dispatch(self,msg):
        return await primary(self)(msg)

    async def start(self):
        phase='native_start'
        event(out,'gateway_start_phase',phase=phase)
        try:
            success=await old_start(self)
            if not success:return success
            phase='browser_catalog'
            event(out,'gateway_start_phase',phase=phase)
            def catalog():
                from model_tools import get_tool_definitions
                from tools import mcp_tool
                definitions=get_tool_definitions(enabled_toolsets=getattr(exercise,'toolsets',TOOLSETS),quiet_mode=True,
                                                skip_tool_search_assembly=True)
                expected={mcp_tool.mcp_prefixed_tool_name('company_browser_simulation',name)
                          for name in getattr(exercise,'expected_tools',EXPECTED_BROWSER_TOOLS)}
                verify_browser_catalog(mcp_tool.get_mcp_status(),
                                       {t['function']['name'] for t in definitions},expected)
                return expected
            # Synchronous SDK/catalog work must not block native heartbeats or
            # the planned-stop handler on the gateway's event loop.
            expected=await asyncio.wait_for(asyncio.to_thread(catalog),35)
            phase='feishu_connection_and_protection'
            event(out,'gateway_start_phase',phase=phase)
            from gateway.config import Platform
            feishu=self.adapters.get(Platform.FEISHU)
            if not native_connected(feishu):raise RuntimeError('Native Feishu did not connect')
            conn=getattr(getattr(feishu,'_ws_client',None),'_conn_url',None)
            if not conn:raise RuntimeError('Native Feishu has no WebSocket receipt')
            validate_websocket(conn)
            if check_snapshot(baseline):raise RuntimeError('Protected files changed during native startup')
            exercise.catalog_ready=True
            exercise.pause()
            event(out,'original_feishu_browser_ready',pid=os.getpid(),home=str(home),cwd=os.getcwd(),
                  native_all_adapters_preserved=True,profile_created=False,browser_catalog_tools=len(expected),
                  native_ordinary_request_attempts=meter.ordinary_attempts,budget=exercise.budget.status(),
                  protected_changes=[],new_model_task_messages_sent_by_Codex=0)
            print(json.dumps({'event':'original_feishu_browser_ready','pid':os.getpid(),
                              'task_prefix':getattr(exercise,'prefix',None),'budget':exercise.budget.status()}),flush=True)
            return success
        except BaseException as exc:
            exercise.pause()
            event(out,'gateway_start_failed',phase=phase,error_type=type(exc).__name__,
                  frames=[{'file':Path(f.filename).name,'line':f.lineno,'function':f.name}
                          for f in traceback.extract_tb(exc.__traceback__)][-8:])
            with contextlib.suppress(Exception):await asyncio.wait_for(self.stop(),30)
            raise

    def iterations():
        turn=CURRENT_TURN.get()
        return 16 if (not getattr(exercise,'continuous',False) and turn and turn.get('browser') and turn['live'].is_set()) else old_iterations()

    # Wrap the common native handler, not only the adapter's factory. Deferred
    # or queued messages that call _handle_message directly keep the same fence.
    Runner._handle_message=dispatch
    Runner._resolve_enabled_toolsets_for_source=tools
    Runner._create_adapter=create_adapter
    Runner.start=start
    native._current_max_iterations=iterations

    def restore():
        Runner._primary_message_handler=old_primary
        Runner._handle_message=old_handle
        Runner._resolve_enabled_toolsets_for_source=old_tools
        Runner._create_adapter=old_adapter
        Runner.start=old_start
        native._current_max_iterations=old_iterations
        for close in sdk_restores:close()
    return restore


async def serve(args, *, native_start=None, cli_config=None, verbosity=0):
    if native_start is None:
        raise RuntimeError('Direct wrapper retired; use the genuine native CLI bootstrap')
    root=ordinary_path(Path(__file__).parent)
    home=ordinary_path(Path.home()/'.hermes')
    install=ordinary_path(args.install)
    if root!=home/'tools/company-browser' or Path(sys.executable).resolve()!=install/'venv/Scripts/python.exe':
        raise RuntimeError('Original employee runtime required')
    gate=json.loads(Path(args.gate).read_text('utf-8'))
    validate_gateway_handoff(gate)
    for name,digest in gate['source_sha256'].items():
        if sha256(root/name)!=digest:raise RuntimeError('Tool source changed')
    baseline=json.loads(Path(args.baseline).read_text('utf-8'))
    if check_snapshot(baseline):raise RuntimeError('Protected files changed')
    out=ordinary_path(args.output)
    if root/'runs' not in out.parents:raise RuntimeError('Receipts outside owned tool runtime')
    if gate['browser_exercise'].get('kind')=='lingju-ego-readonly-daily':
        from ego_task import EgoReadonlyExercise
        exercise=EgoReadonlyExercise(gate['browser_exercise'],root,home/'state.db',channel='feishu')
    elif gate['browser_exercise'].get('kind')=='livsyn-readonly-daily':
        from readonly_task import ContinuousReadonlyExercise
        exercise=ContinuousReadonlyExercise(gate['browser_exercise'],root,home/'state.db',channel='feishu')
    elif gate['browser_exercise'].get('kind')=='livsyn-readonly-first-page':
        from readonly_task import ReadonlyExercise
        exercise=ReadonlyExercise(gate['browser_exercise'],root,home/'state.db',channel='feishu')
    else:
        exercise=BrowserExercise(gate['browser_exercise'],root,home/'state.db',channel='feishu')
    for path,digest in gate['browser_exercise']['old_ledger_sha256'].items():
        if sha256(path)!=digest:raise RuntimeError('Historical ledger changed')
    os.environ.update(HERMES_HOME=str(home),TERMINAL_CWD=str(home/'company-workspace'),
                      LINGJU_BROWSER_EXERCISE='playwright',LINGJU_BROWSER_RUNTIME=str(exercise.runtime),
                      XDG_LINGJU_BROWSER_RUNTIME=str(exercise.runtime),PYTHONDONTWRITEBYTECODE='1')
    os.chdir(home/'company-workspace')
    sys.path.insert(0,str(install))
    # Native configuration/identity loading is retained. No logging request or
    # credential payloads into a new public artifact.
    logging.disable(logging.CRITICAL)
    import gateway.run as native
    from gateway.status import get_running_pid
    if get_running_pid():raise RuntimeError('Existing gateway active; controlled handoff required')
    config=cli_config if cli_config is not None else native.load_gateway_config_for_runner()
    if config.multiplex_profiles:raise RuntimeError('No alternate formal identities')
    from hermes_cli.config import load_config
    saved=load_config()
    if (saved.get('sessions') or {}).get('auto_archive') or (saved.get('sessions') or {}).get('auto_prune'):
        raise RuntimeError('Automatic history maintenance not approved')
    from agent.process_bootstrap import _get_proxy_for_base_url
    before_feishu=_get_proxy_for_base_url('https://open.feishu.cn')
    bypass=apply_model_proxy_bypass(gate)
    if not bypass or _get_proxy_for_base_url('https://open.feishu.cn')!=before_feishu:
        raise RuntimeError('Approved direct model route or original Feishu route not retained')
    meter=GatewayMeter(out,exercise.budget)
    policy=FeishuTrafficPolicy(metadata_urls=metadata_catalog_urls(saved))
    # Other native adapters may use non-HTTPX SDKs. Do not install a global
    # socket audit that would disconnect these existing services. Model main,
    # retries/aux HTTPX and unknown HTTPX during the exercise remain metered.
    restore_http=install_traffic_guard(meter,OrdinaryTrafficAudit(out/'traffic.sqlite'),policy,
                                     add_network_audit=False,
                                     pacer=gateway_pacer(meter,out/'response-events.jsonl',gate,
                                                        continuous=getattr(exercise,'continuous',False)))
    import agent.title_generator as titles
    restore_titles=propagate_title_threads(titles)
    restore_runner=install_runner_hooks(native,exercise,meter,out,baseline,gate['owner_binding'],home,
                                       progress_options=approved_progress(gate))
    try:
        if check_snapshot(baseline):raise RuntimeError('Protected files changed before native startup')
        await native_start(config=config,replace=False,verbosity=verbosity)
    finally:
        exercise.pause()
        restore_runner();restore_titles();restore_http()


if __name__=='__main__':
    p=argparse.ArgumentParser()
    for field in ['install','baseline','output','gate']:p.add_argument('--'+field,required=True)
    try:asyncio.run(serve(p.parse_args()))
    except BaseException as exc:
        print(json.dumps({'event':'feishu_browser_gateway_stopped','error_type':type(exc).__name__}),flush=True)
        raise SystemExit(1)
