"""Original employee's ordinary owner-initiated QQ conversation, not an exercise.

No browser/task allowance is reopened. No runner.start(), cron, extra platform,
MCP, or business tools. The native model/identity/history/QQ reply path is used.
Only actual authorized Owner messages admit model requests; startup/background
requests fail closed. Old acceptance ledgers are neither opened RW nor reset.
"""
import argparse
import asyncio
import contextlib
import datetime
import functools
import json
import logging
import os
from pathlib import Path
import sys
import sqlite3
import threading

from qq_runtime import apply_model_proxy_bypass, event, metadata_catalog_urls, official_qq_websocket
from request_budget import BudgetBlocked, _inside_metered_transport
from provider_pacing import ModelPacer
from traffic_guard import TrafficAudit

OWNER_CHAT_AUTH = '2026-10-25 Owner: restore ordinary QQ model conversation, separate from simulated acceptance'
CHAT_TOOLSETS = []


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
    if gate.get('browser_tasks_enabled') is not False or gate.get('business_tools_enabled') is not False:
        raise RuntimeError('Restoring dialogue does not open business or simulation tools')


class OwnerMessageMeter:
    """Ordinary usage receipt, not a new or compensated acceptance budget."""
    def __init__(self, output):
        self.output = output
        self.active = threading.Event()
        self.ordinal = 0
        self.lock = threading.Lock()

    def begin(self):
        with self.lock:
            if self.active.is_set():
                raise RuntimeError('Owner conversation is already active')
            self.active.set()

    def finish(self):
        self.active.clear()

    def check_active(self):
        if not self.active.is_set():
            raise BudgetBlocked('No active authorized Owner message; background model request denied')

    def take(self, family='unclassified'):
        with self.lock:
            self.check_active()
            self.ordinal += 1
            event(self.output, 'ordinary_chat_request_attempt', ordinal=self.ordinal, family=family)
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
    saved = yaml.safe_load((home / 'config.yaml').read_text('utf-8')) or {}
    policy = TrafficPolicy(metadata_urls=metadata_catalog_urls(saved))
    audit = OrdinaryTrafficAudit(out / 'traffic.sqlite')
    meter = OwnerMessageMeter(out)
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
        runner._resolve_enabled_toolsets_for_source = lambda *a, **kw: list(CHAT_TOOLSETS)
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
        primary = runner._primary_message_handler()
        busy = asyncio.Lock()
        async def receive(msg):
            if msg.source.chat_type != 'dm' or not runner._is_user_authorized(msg.source):
                return None
            if msg.text.strip().lower() == '/status':
                return 'QQ已连接，普通文字对话已接回原Hermes模型；模型域名绕过HTTP代理。模拟验收和业务操作没有重新开放。'
            if msg.text.startswith('/'):
                return '本次恢复普通对话；设置、服务控制及其他命令未开放。你可以直接说话，或用/status查看连接状态。'
            if busy.locked():
                return '我正在处理上一条消息，请等回复后再发下一条。'
            async with busy:
                meter.begin()
                before = meter.ordinal
                event(out, 'owner_chat_admitted', cwd=str(workspace), native_session_routing=True,
                      existing_source_thread_preserved=True, acceptance_ledger_used=False)
                try:
                    return await primary(msg)
                finally:
                    meter.finish()
                    event(out, 'owner_chat_returned', request_attempts=meter.ordinal-before,
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
        event(out, 'ordinary_qq_ready', pid=os.getpid(), home=str(home), cwd=os.getcwd(),
              python=sys.executable, original_identity=True, native_session_routing=True,
              source_sha256=sha256(__file__), model_proxy_bypass=bypass,
              toolsets=CHAT_TOOLSETS, browser_started=False, cron_started=False,
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
