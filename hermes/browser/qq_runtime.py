"""Temporary QQ intake for the original employee; no business steps or model sends.

Uses the installed QQ adapter and GatewayRunner's native message pipeline, with
the existing browser round's shared request ledger. Deliberately does not call
start_gateway()/runner.start(): those also start unrelated platforms, cron,
kanban dispatch and history maintenance. No startup item/config is rewritten.
"""
import argparse
import asyncio
import contextlib
import dataclasses
import datetime
import functools
import hashlib
import json
import logging
import os
from pathlib import Path
import sqlite3
import sys
from urllib.parse import urlsplit


TOOLSETS = ["company_browser_simulation", "file", "vision"]
EXPECTED_BROWSER_TOOLS = {
    "browser_close", "browser_handle_dialog", "browser_fill_form", "browser_press_key",
    "browser_type", "browser_navigate", "browser_navigate_back", "browser_take_screenshot",
    "browser_snapshot", "browser_click", "browser_select_option", "browser_tabs", "browser_wait_for",
}


def verify_browser_catalog(status, names, expected):
    company = [s for s in status if s.get("name") == "company_browser_simulation"]
    if len(company) != 1 or not company[0].get("connected"):
        raise RuntimeError("Company browser MCP is not connected in this QQ process")
    if not set(expected).issubset(names):
        raise RuntimeError("Company browser tools missing from this process's model catalog")


async def discover_company_browser(out):
    """Run the native startup step omitted by the initial QQ transport adapter."""
    from tools import mcp_tool
    original_config_loader = mcp_tool._load_mcp_config
    def selected_config():
        configured = original_config_loader()
        if "company_browser_simulation" not in configured:
            raise RuntimeError("Original company browser registration is absent")
        # Process-local tool selection, not a persisted MCP permission/config edit.
        return {"company_browser_simulation": configured["company_browser_simulation"]}
    mcp_tool._load_mcp_config = selected_config
    await asyncio.wait_for(asyncio.to_thread(mcp_tool.discover_mcp_tools), timeout=35)
    from model_tools import get_tool_definitions
    wanted = {mcp_tool.mcp_prefixed_tool_name("company_browser_simulation", t)
              for t in EXPECTED_BROWSER_TOOLS}
    full = get_tool_definitions(enabled_toolsets=TOOLSETS, quiet_mode=True,
                                skip_tool_search_assembly=True)
    names = {t["function"]["name"] for t in full}
    status = mcp_tool.get_mcp_status()
    verify_browser_catalog(status, names, wanted)
    initial = get_tool_definitions(enabled_toolsets=TOOLSETS, quiet_mode=True)
    event(out, "qq_browser_catalog_verified", pid=os.getpid(),
          server_status=[{k:s.get(k) for k in ["name", "connected", "tools", "transport"]}
                         for s in status],
          model_catalog_browser_tools=sorted(wanted),
          initial_model_tool_names=sorted(t["function"]["name"] for t in initial),
          tool_execution_performed=False, model_calls=0)
    return True


def official_qq_websocket(url):
    u = urlsplit(url)
    if (u.scheme != "wss" or u.hostname != "api.sgroup.qq.com"
            or u.port not in (None, 443) or u.username or u.password
            or u.path != "/websocket"):
        raise RuntimeError("Unexpected QQ WebSocket destination; stopped")
    return url


class Intake:
    """Durable dedup/admission, separate from prompts, credentials and memories."""
    def __init__(self, path, cap=3):
        self.path, self.cap = Path(path), cap
        with contextlib.closing(sqlite3.connect(self.path)) as c, c:
            c.execute("CREATE TABLE IF NOT EXISTS tasks (message_hash TEXT PRIMARY KEY, slot INTEGER UNIQUE, at TEXT)")

    def take(self, message_id):
        if not message_id:
            raise RuntimeError("No inbound message ID; cannot safely deduplicate")
        digest = hashlib.sha256(message_id.encode()).hexdigest()
        with contextlib.closing(sqlite3.connect(self.path)) as c, c:
            c.execute("BEGIN IMMEDIATE")
            if c.execute("SELECT 1 FROM tasks WHERE message_hash=?", (digest,)).fetchone():
                return None
            n = c.execute("SELECT count(*) FROM tasks").fetchone()[0]
            if n >= self.cap:
                raise RuntimeError("This route's three task messages have been admitted")
            c.execute("INSERT INTO tasks VALUES(?,?,?)", (digest, n + 1, datetime.datetime.now(datetime.timezone.utc).isoformat()))
            return n + 1

    def count(self):
        with contextlib.closing(sqlite3.connect(self.path)) as c:
            return c.execute("SELECT count(*) FROM tasks").fetchone()[0]


def event(out, kind, **fields):
    row = {"at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
           "event": kind, **fields}
    with (out / "receipts.jsonl").open("a", encoding="utf-8") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")


async def serve(args):
    from safety import ordinary_path, sha256, check_snapshot
    from request_budget import RequestBudget, install_httpx_budget, _inside_metered_transport
    root = ordinary_path(Path(__file__).parent)
    home = ordinary_path(Path.home() / ".hermes")
    workspace = ordinary_path(home / "company-workspace")
    install = ordinary_path(args.install)
    if root != home / "tools/company-browser":
        raise RuntimeError("Unexpected tool installation")
    if Path(sys.executable).resolve() != install / "venv/Scripts/python.exe":
        raise RuntimeError("Not the original installed employee's Python")
    runtime = ordinary_path(args.runtime)
    cfg = json.loads(runtime.read_text(encoding="utf-8"))
    if root / "runs" not in runtime.parents or cfg["route"] != "playwright" or cfg["toolRoot"] != str(root):
        raise RuntimeError("Not the current approved Playwright exercise")
    gate = json.loads((root / "acceptance-gate.json").read_text(encoding="utf-8"))
    if gate.get("active_runtime") != str(runtime) or not gate.get("all_zero_model_gates_passed"):
        raise RuntimeError("Desktop browser prerequisite gate missing")
    for rel, digest in gate["tool_source_sha256"].items():
        if sha256(root / rel) != digest:
            raise RuntimeError("Previously verified browser source changed")
    baseline = json.loads(Path(args.baseline).read_text(encoding="utf-8"))
    if check_snapshot(baseline):
        raise RuntimeError("Protected file differs before QQ startup")
    out = ordinary_path(args.output)
    if runtime.parent not in out.parents:
        raise RuntimeError("QQ receipts outside the current owned run")
    budget = RequestBudget(cfg["roundBudget"])
    if budget.status()["limit"] != 120 or not budget.status()["armed"]:
        raise RuntimeError("The existing shared budget is not armed")
    os.environ.update(HERMES_HOME=str(home), TERMINAL_CWD=str(workspace),
                      LINGJU_BROWSER_EXERCISE="playwright",
                      LINGJU_BROWSER_RUNTIME=str(runtime),
                      XDG_LINGJU_BROWSER_RUNTIME=str(runtime))
    os.chdir(workspace)
    sys.path.insert(0, str(install))
    # Suppress native account IDs/message text; metadata-only receipts below.
    logging.disable(logging.CRITICAL)
    import gateway.run as native
    from gateway.config import Platform
    from gateway.platforms.qqbot.adapter import QQAdapter
    from gateway.status import (acquire_gateway_runtime_lock, release_gateway_runtime_lock,
                                get_running_pid, write_pid_file, remove_pid_file)
    from hermes_cli.config import load_config
    maintenance = load_config().get("sessions") or {}
    if maintenance.get("auto_archive") or maintenance.get("auto_prune"):
        raise RuntimeError("Native startup would maintain old history; not authorized")
    if get_running_pid() or not acquire_gateway_runtime_lock():
        raise RuntimeError("Another native gateway owns this employee; do not replace it")
    runner = adapter = None
    try:
        config = native.load_gateway_config_for_runner()
        qq = config.platforms[Platform.QQBOT]
        if not qq.enabled or not qq.extra.get("allow_from") or "*" in str(qq.extra["allow_from"]):
            raise RuntimeError("Original QQ owner allowlist is not restrictive")
        if config.multiplex_profiles:
            raise RuntimeError("Only the original identity may be served")
        # In-memory selection only. Saved platform/voice/model settings survive.
        config.platforms = {Platform.QQBOT: qq}
        runner = native.GatewayRunner(config)
        adapter = QQAdapter(qq)
        runner.adapters[Platform.QQBOT] = adapter
        runner.delivery_router.adapters = runner.adapters
        runner._gateway_loop = asyncio.get_running_loop()
        runner._running = True
        native._current_max_iterations = lambda: 16
        def selected_tools(user_config, source, platform_key):
            if source.platform != Platform.QQBOT:
                raise RuntimeError("Unexpected transport")
            return list(TOOLSETS)
        runner._resolve_enabled_toolsets_for_source = selected_tools
        os.environ["TERMINAL_CWD"] = str(workspace)  # native config bridge defaults to home
        runner._sync_voice_mode_state_to_adapter(adapter)
        adapter.set_session_store(runner.session_store)
        adapter.set_authorization_check(runner._make_adapter_auth_check(Platform.QQBOT))
        adapter.set_busy_session_handler(runner._handle_active_session_busy_message)
        adapter.set_fatal_error_handler(runner._handle_adapter_fatal_error)
        # QQ's native WebSocket uses aiohttp; narrowly allow that connection.
        # HTTPX model/aux/retry requests keep the unchanged shared hard guard.
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
        install_httpx_budget(budget, add_network_audit=True)
        browser_ready = False
        try:
            browser_ready = await discover_company_browser(out)
        except Exception as exc:
            event(out, "qq_browser_catalog_failed", error_type=type(exc).__name__, model_calls=0)
        intake = Intake(out / "intake.sqlite", cap=args.admit_through_slot or 3)
        busy = asyncio.Lock()
        ready = False
        primary = runner._primary_message_handler()
        async def receive(msg):
            if msg.source.chat_type != "dm" or not runner._is_user_authorized(msg.source):
                event(out, "inbound_rejected", reason="not_existing_authorized_dm")
                return None
            if msg.text.strip().lower() == "/status":
                event(out, "status_requested", model_calls=0)
                admission_open = args.allow_task_messages and intake.count() < intake.cap
                state = "本次批准的一条模拟任务接收已开启" if admission_open else "等待Owner复核，暂停新模型任务"
                browser = "13项浏览器工具目录预检通过" if browser_ready else "浏览器工具目录预检未通过"
                return (f"QQ通道已连接，仍是原Hermes、原公司工作区。{state}；{browser}。"
                        f"已接收{intake.count()}/3条任务；共享请求额度已用"
                        f"{budget.status()['reserved_network_attempts']}/120次（含QQ连接等HTTP请求）。"
                        "没有登录真实灵生后台。")
            if not ready or busy.locked():
                return "当前正在准备或处理上一条任务，请先等待完成；本条没有送给模型。"
            if not args.allow_task_messages or not browser_ready:
                event(out, "inbound_paused_without_model", model_calls=0)
                return "QQ仍在线。本轮第一条浏览器任务未通过，已暂停新模型任务，等待Owner复核；没有补发或重试。"
            if intake.count() >= intake.cap:
                event(out, "approved_message_allowance_used", model_calls=0)
                return "本次批准的任务机会已用完，QQ仍在线；本条没有提交模型，等待Owner复核。"
            if msg.text.startswith("/") or msg.media_urls:
                return "本轮仅接收文字任务和/status，不执行重启、配置、媒体或其他命令。"
            if budget.status()["reserved_network_attempts"] >= 115:
                return "本轮共享请求额度接近上限，已暂停接收任务。"
            async with busy:
                try:
                    slot = intake.take(msg.message_id)
                except RuntimeError:
                    return "本轮任务接收额度已满，或缺少可核对的消息编号；未提交模型。"
                if slot is None:
                    return None
                # Fresh conversation for each acceptance goal, same identity/home.
                # QQ reply destination/user identity are preserved by dataclass replace.
                msg.source = dataclasses.replace(msg.source, thread_id=out.name + "-" + str(slot))
                os.environ["TERMINAL_CWD"] = str(workspace)
                event(out, "owner_task_admitted", slot=slot, cwd=str(workspace),
                      toolsets=TOOLSETS, budget_before=budget.status())
                try:
                    return await primary(msg)
                finally:
                    event(out, "owner_task_returned", slot=slot, budget_after=budget.status(),
                          protected_changes=check_snapshot(baseline))
        adapter.set_message_handler(receive)
        write_pid_file()
        connected = await asyncio.wait_for(adapter.connect(), 40)
        for _ in range(40):
            if adapter._session_id or not connected:
                break
            await asyncio.sleep(.5)
        if not connected or not adapter._session_id:
            raise RuntimeError("QQ did not reach protocol READY")
        if check_snapshot(baseline):
            raise RuntimeError("Protected file changed during QQ startup")
        ready = True
        event(out, "qq_ready", pid=os.getpid(), python=sys.executable, install=str(install),
              home=str(home), cwd=os.getcwd(), toolsets=TOOLSETS, max_turns=16,
              source_sha256=sha256(__file__), budget=budget.status(),
              codex_model_messages=0, cron_started=False, other_channels_started=False,
              original_gateway_start_called=False, protected_changes=[],
              browser_catalog_verified=browser_ready, task_admission_enabled=args.allow_task_messages,
              admission_ceiling=intake.cap, existing_admitted_tasks=intake.count())
        print(json.dumps({"event":"qq_ready", "pid":os.getpid(), "budget":budget.status(),
                          "owner_can_send":"/status", "model_messages_sent_by_codex":0}), flush=True)
        await asyncio.Event().wait()
    finally:
        if runner:
            runner._running = False
        if adapter:
            with contextlib.suppress(Exception):
                await adapter.disconnect()
        with contextlib.suppress(Exception):
            from tools.mcp_tool import shutdown_mcp_servers
            await asyncio.to_thread(shutdown_mcp_servers)
        remove_pid_file()
        release_gateway_runtime_lock()


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    for name in ["runtime", "install", "baseline", "output"]:
        p.add_argument("--" + name, required=True)
    p.add_argument("--allow-task-messages", action="store_true",
                   help="Explicitly reopen intake only after Owner review; default is status only")
    p.add_argument("--admit-through-slot", type=int, choices=[1, 2, 3],
                   help="Persistent total admission ceiling for the explicitly approved opening")
    try:
        args = p.parse_args()
        if args.allow_task_messages and args.admit_through_slot is None:
            p.error("--allow-task-messages requires an explicit --admit-through-slot ceiling")
        asyncio.run(serve(args))
    except BaseException as exc:
        import traceback
        print(json.dumps({"event":"qq_stopped", "error_type":type(exc).__name__,
                          "frames":[{"file":f.filename, "line":f.lineno, "function":f.name}
                                    for f in traceback.extract_tb(exc.__traceback__)[-5:]]}), flush=True)
        raise SystemExit(1)
