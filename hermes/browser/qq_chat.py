"""Original employee's QQ dialogue with an explicitly optional browser exercise.

Default dialogue has no business tools. A separately approved, exact-prefix
message may use a fresh browser thread and its own hard request budget.
No runner.start(), cron or extra platform. Native identity/history/replies stay
in use; old acceptance ledgers are neither opened RW nor reset.
"""
import argparse
import asyncio
import contextlib
import contextvars
import dataclasses
import datetime
import functools
import json
import logging
import os
from pathlib import Path
import sys
import sqlite3
import threading

from qq_runtime import (apply_model_proxy_bypass, event, metadata_catalog_urls, official_qq_websocket,
                        discover_company_browser, TOOLSETS, newly_budget_blocked)
from request_budget import BudgetBlocked, _inside_metered_transport
from provider_pacing import ModelPacer
from traffic_guard import TrafficAudit

OWNER_CHAT_AUTH = '2026-10-25 Owner: restore ordinary QQ model conversation, separate from simulated acceptance'
CHAT_TOOLSETS = []
CURRENT_OWNER_TURN = contextvars.ContextVar('lingju_owner_turn', default=None)


class OrdinaryTrafficAudit(TrafficAudit):
    # The exercise's lifetime QQ/metadata count limits must not disable a
    # normal service after token renewal or ordinary conversation.
    def reserve(self, category, family):
        with contextlib.closing(sqlite3.connect(self.path)) as c, c:
            c.execute('INSERT INTO traffic VALUES(?,?,?)', (
                datetime.datetime.now(datetime.timezone.utc).isoformat(), category, family))


def validate_chat_gate(gate):
    if gate.get('mode') != 'ordinary_owner_chat' or gate.get('owner_authorization') != OWNER_CHAT_AUTH:
        raise RuntimeError('Ordinary QQ chat requires its own Owner restoration instruction')
    if gate.get('business_tools_enabled') is not False:
        raise RuntimeError('Restoring dialogue does not open real business tools')
    if gate.get('browser_tasks_enabled') is not False:
        from qq_browser_task import validate_browser_grant
        validate_browser_grant(gate.get('browser_exercise'))


class OwnerMessageMeter:
    """Ordinary usage receipt, not a new or compensated acceptance budget."""
    def __init__(self, output, browser_budget=None):
        self.output = output
        self.active = threading.Event()
        self.ordinal = 0
        self.lock = threading.Lock()
        self.browser_budget = browser_budget
        self.turn = self.token = None

    def begin(self, mode='ordinary'):
        with self.lock:
            if self.active.is_set():
                raise RuntimeError('Owner conversation is already active')
            if mode not in ('ordinary', 'browser') or (mode == 'browser' and self.browser_budget is None):
                raise RuntimeError('This request mode has no authorization')
            self.turn = {'mode': mode, 'live': threading.Event(), 'meter': self}
            self.turn['live'].set()
            self.token = CURRENT_OWNER_TURN.set(self.turn)
            self.active.set()

    def finish(self):
        if self.turn:
            self.turn['live'].clear()
        if self.token is not None:
            try:
                CURRENT_OWNER_TURN.reset(self.token)
            except ValueError:
                # Shutdown can run in the parent task. The shared live marker
                # is already cleared, so copied worker contexts stay denied.
                pass
        self.turn = self.token = None
        self.active.clear()

    def check_active(self):
        turn = CURRENT_OWNER_TURN.get()
        if (not turn or turn['meter'] is not self or not turn['live'].is_set()
                or not self.active.is_set()):
            raise BudgetBlocked('No active authorized Owner message; background model request denied')
        if turn['mode'] == 'browser':
            state = self.browser_budget.status()
            if not state['armed'] or state['reserved_network_attempts'] >= state['limit']:
                self.browser_budget.take('unclassified')  # Record denial, never send.
        return turn

    def take(self, family='unclassified'):
        with self.lock:
            turn = self.check_active()
            if turn['mode'] == 'browser':
                self.browser_budget.take(family)
            self.ordinal += 1
            event(self.output, turn['mode']+'_chat_request_attempt', ordinal=self.ordinal, family=family)
            return self.ordinal


class OwnerMessagePacer(ModelPacer):
    def check(self):
        self.budget.check_active()
        if self.frozen:
            raise BudgetBlocked('Provider requested a long pause; no further requests')


async def serve(args):
    from safety import ordinary_path, sha256, check_snapshot
    from traffic_guard import TrafficPolicy, install_traffic_guard
    import yaml
    root = ordinary_path(Path(__file__).parent)
    home = ordinary_path(Path.home() / '.hermes')
    workspace = ordinary_path(home / 'company-workspace')
    install = ordinary_path(args.install)
    if root != home / 'tools/company-browser' or Path(sys.executable).resolve() != install / 'venv/Scripts/python.exe':
        raise RuntimeError('Not the original employee installation')
    out = ordinary_path(args.output)
    if root / 'runs' not in out.parents:
        raise RuntimeError('Receipts outside owned tools runtime')
    gate = json.loads(Path(args.gate).read_text('utf-8'))
    validate_chat_gate(gate)
    for name, digest in gate['source_sha256'].items():
        if sha256(root / name) != digest:
            raise RuntimeError('Chat source changed after verification')
    baseline = json.loads(Path(args.baseline).read_text('utf-8'))
    if check_snapshot(baseline):
        raise RuntimeError('Protected files changed before restoration')
    os.environ.update(HERMES_HOME=str(home), TERMINAL_CWD=str(workspace))
    for key in ['LINGJU_BROWSER_EXERCISE', 'LINGJU_BROWSER_RUNTIME', 'XDG_LINGJU_BROWSER_RUNTIME']:
        os.environ.pop(key, None)
    os.chdir(workspace)
    sys.path.insert(0, str(install))
    exercise = None
    if gate.get('browser_tasks_enabled'):
        from qq_browser_task import BrowserExercise
        exercise = BrowserExercise(gate['browser_exercise'], root, home / 'state.db')
        os.environ.update(LINGJU_BROWSER_EXERCISE='playwright',
                          LINGJU_BROWSER_RUNTIME=str(exercise.runtime),
                          XDG_LINGJU_BROWSER_RUNTIME=str(exercise.runtime))
    saved = yaml.safe_load((home / 'config.yaml').read_text('utf-8')) or {}
    policy = TrafficPolicy(metadata_urls=metadata_catalog_urls(saved))
    audit = OrdinaryTrafficAudit(out / 'traffic.sqlite')
    meter = OwnerMessageMeter(out, exercise.budget if exercise else None)
    pacer = OwnerMessagePacer(meter, out / 'response-events.jsonl')
    install_traffic_guard(meter, audit, policy, add_network_audit=True, pacer=pacer)
    logging.disable(logging.CRITICAL)
    import gateway.run as native
    from gateway.config import Platform
    from gateway.platforms.qqbot.adapter import QQAdapter
    from gateway.status import (acquire_gateway_runtime_lock, release_gateway_runtime_lock,
                                get_running_pid, write_pid_file, remove_pid_file)
    from hermes_cli.config import load_config
    maintenance = load_config().get('sessions') or {}
    if maintenance.get('auto_archive') or maintenance.get('auto_prune'):
        raise RuntimeError('History maintenance is not part of restoring QQ conversation')
    if get_running_pid() or not acquire_gateway_runtime_lock():
        raise RuntimeError('Another native gateway is active; do not replace it')
    runner = adapter = None
    try:
        config = native.load_gateway_config_for_runner()
        bypass = apply_model_proxy_bypass(gate)
        if not bypass:
            raise RuntimeError('Approved model proxy bypass must remain active')
        qq = config.platforms[Platform.QQBOT]
        if not qq.enabled or not qq.extra.get('allow_from') or '*' in str(qq.extra['allow_from']) or config.multiplex_profiles:
            raise RuntimeError('Original sole identity/Owner QQ restriction not satisfied')
        config.platforms = {Platform.QQBOT: qq}
        runner = native.GatewayRunner(config)
        adapter = QQAdapter(qq)
        policy.qq_users = frozenset(adapter._allow_from)
        runner.adapters[Platform.QQBOT] = adapter
        runner.delivery_router.adapters = runner.adapters
        runner._gateway_loop = asyncio.get_running_loop()
        runner._running = True
        def select_tools(user_config, source, platform_key):
            return list(TOOLSETS) if exercise and source.thread_id == exercise.thread_id else list(CHAT_TOOLSETS)
        runner._resolve_enabled_toolsets_for_source = select_tools
        native._current_max_iterations = lambda: 16
        os.environ['TERMINAL_CWD'] = str(workspace)
        runner._sync_voice_mode_state_to_adapter(adapter)
        adapter.set_session_store(runner.session_store)
        adapter.set_authorization_check(runner._make_adapter_auth_check(Platform.QQBOT))
        adapter.set_fatal_error_handler(runner._handle_adapter_fatal_error)
        raw_open = adapter._open_ws
        @functools.wraps(raw_open)
        async def open_qq(url):
            official_qq_websocket(url)
            token = _inside_metered_transport.set(True)
            try:
                return await raw_open(url)
            finally:
                _inside_metered_transport.reset(token)
        adapter._open_ws = open_qq
        from model_tools import get_tool_definitions
        if get_tool_definitions(enabled_toolsets=CHAT_TOOLSETS, quiet_mode=True, skip_tool_search_assembly=True):
            raise RuntimeError('Restored ordinary dialogue unexpectedly exposes business tools')
        if exercise:
            exercise.catalog_ready = await discover_company_browser(out)
        primary = runner._primary_message_handler()
        busy = asyncio.Lock()
        async def receive(msg):
            if msg.source.chat_type != 'dm' or not runner._is_user_authorized(msg.source):
                return None
            if msg.text.strip().lower() == '/status':
                return ('QQ已连接，普通对话可用，模型域名绕过HTTP代理。真实业务未开放。'
                        + (exercise.summary() if exercise else '模拟验收未开启。'))
            if msg.text.startswith('/'):
                return '本次恢复普通对话；设置、服务控制及其他命令未开放。你可以直接说话，或用/status查看连接状态。'
            if busy.locked():
                return '我正在处理上一条消息，请等回复后再发下一条。'
            async with busy:
                browser = exercise and exercise.matches(msg.text)
                if browser:
                    try:
                        slot = exercise.admit(msg.message_id)
                    except RuntimeError:
                        return '本轮这条模拟验收尚未开放或已经接收，请不要重复发送。普通聊天仍然正常可用。'
                    if slot is None:
                        return None
                    msg.source = dataclasses.replace(msg.source, thread_id=exercise.thread_id)
                meter.begin('browser' if browser else 'ordinary')
                before = meter.ordinal
                event(out, 'owner_chat_admitted', cwd=str(workspace), native_session_routing=not bool(browser),
                      existing_source_thread_preserved=not bool(browser), acceptance_ledger_used=bool(browser),
                      browser_thread_id=exercise.thread_id if browser else None)
                try:
                    budget_before = exercise.budget.status() if browser else None
                    try:
                        result = await primary(msg)
                    except Exception:
                        if not browser or not newly_budget_blocked(budget_before, exercise.budget.status()):
                            raise
                        result = None
                    if browser and newly_budget_blocked(budget_before, exercise.budget.status()):
                        return '本轮模拟验收已达到30次请求上限，已拦住后续模型请求。这不是模型服务器失联；未完成事项由Codex按收据核对。普通聊天仍可使用。'
                    if pacer.frozen:
                        return '模型服务要求的等待时间超过本次自动等待范围，后续模型请求已暂停，没有缩短服务端等待或继续重试。'
                    return result
                finally:
                    meter.finish()
                    if browser:
                        exercise.pause()
                    event(out, 'owner_chat_returned', request_attempts=meter.ordinal-before,
                          acceptance_budget=exercise.budget.status() if browser else None,
                          protected_changes=check_snapshot(baseline))
        adapter.set_message_handler(receive)
        write_pid_file()
        connected = await asyncio.wait_for(adapter.connect(), 40)
        for _ in range(40):
            if adapter._session_id or not connected:
                break
            await asyncio.sleep(.5)
        if not connected or not adapter._session_id:
            raise RuntimeError('Original QQ did not reach READY')
        if check_snapshot(baseline):
            raise RuntimeError('Protected file changed during QQ restoration')
        if exercise and not exercise.intake.count():
            exercise.budget.arm()
        event(out, 'ordinary_qq_ready', pid=os.getpid(), home=str(home), cwd=os.getcwd(),
              python=sys.executable, original_identity=True, native_session_routing=True,
              source_sha256=sha256(__file__), model_proxy_bypass=bypass,
              toolsets=CHAT_TOOLSETS, browser_started=bool(exercise), cron_started=False,
              browser_catalog_verified=exercise.catalog_ready if exercise else False,
              browser_task_budget=exercise.budget.status() if exercise else None,
              old_test_budget_reopened=False, model_requests_sent=meter.ordinal,
              model_only_on_authorized_Owner_message=True)
        print(json.dumps({'event':'ordinary_qq_ready','pid':os.getpid(),'model_requests_sent':meter.ordinal}),flush=True)
        await asyncio.Event().wait()
    finally:
        meter.finish()
        if runner:
            runner._running = False
        if adapter:
            with contextlib.suppress(Exception):
                await adapter.disconnect()
        if exercise:
            exercise.pause()
            with contextlib.suppress(Exception):
                from tools.mcp_tool import shutdown_mcp_servers
                await asyncio.to_thread(shutdown_mcp_servers)
        remove_pid_file()
        release_gateway_runtime_lock()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    for field in ['install','baseline','output','gate']:
        parser.add_argument('--'+field,required=True)
    try:
        asyncio.run(serve(parser.parse_args()))
    except BaseException as exc:
        print(json.dumps({'event':'ordinary_qq_stopped','error_type':type(exc).__name__}),flush=True)
        raise SystemExit(1)
