/**
 * PiAgentPool — 每个飞书聊天对应一个持久 pi 会话。
 * - 会话文件持久化在 data/sessions/，重启后按 chatId 自动接续
 * - 每个聊天内部串行执行（消息排队），跨聊天可并行
 * - 空闲会话定期释放，超限按 LRU 释放
 */
import { createAgentSession, SessionManager } from "@earendil-works/pi-coding-agent";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const log = (...a) => console.log("[pi]", ...a);

export class PiAgentPool {
  constructor({ dataDir, cwd, idleMs = 30 * 60_000, maxActive = 8 }) {
    this.dataDir = dataDir;
    this.sessionsDir = path.join(dataDir, "sessions");
    this.mapFile = path.join(dataDir, "session-map.json");
    this.cwd = cwd;
    this.idleMs = idleMs;
    this.maxActive = maxActive;

    /** chatId -> 持久会话文件路径 */
    this.map = {};
    /** chatId -> { session, file, lastUsed, busy } */
    this.sessions = new Map();
    /** chatId -> 串行链尾 Promise */
    this.queues = new Map();

    mkdirSync(this.sessionsDir, { recursive: true });
    try {
      this.map = JSON.parse(readFileSync(this.mapFile, "utf8"));
    } catch {
      this.map = {};
    }
    this.sweeper = setInterval(() => this.sweep(), 5 * 60_000);
    this.sweeper.unref?.();
  }

  saveMap() {
    try {
      writeFileSync(this.mapFile, JSON.stringify(this.map, null, 2));
    } catch (e) {
      log("写 session-map 失败:", e.message);
    }
  }

  /** 获取（必要时创建/恢复）某聊天的 pi 会话 */
  async sessionFor(chatId, { reset = false } = {}) {
    if (!reset) {
      const hit = this.sessions.get(chatId);
      if (hit) {
        hit.lastUsed = Date.now();
        return hit;
      }
    }
    if (reset) delete this.map[chatId];
    if (this.sessions.size >= this.maxActive) this.disposeOldestIdle();

    let file = reset ? null : this.map[chatId] ?? null;
    let sessionManager;
    if (file && existsSync(file)) {
      sessionManager = SessionManager.open(file, this.sessionsDir, this.cwd);
    } else {
      file = null;
      sessionManager = SessionManager.create(this.cwd, this.sessionsDir);
    }

    const { session, modelFallbackMessage } = await createAgentSession({
      sessionManager,
      cwd: this.cwd,
    });
    if (modelFallbackMessage) log(chatId, "model fallback:", modelFallbackMessage);

    const fileNow = session.sessionFile || null;
    if (fileNow) this.map[chatId] = fileNow;
    this.saveMap();

    const rec = { session, file: fileNow, lastUsed: Date.now(), busy: false };
    this.sessions.set(chatId, rec);
    log("session ready:", chatId, fileNow ?? "(not persisted yet)");
    return rec;
  }

  /** 串行执行一次 prompt，返回助手最终文本 */
  async prompt(chatId, text) {
    const prev = this.queues.get(chatId) ?? Promise.resolve();
    const run = prev.then(async () => {
      const rec = await this.sessionFor(chatId);
      rec.busy = true;
      try {
        await rec.session.prompt(text);
        rec.lastUsed = Date.now();
        const reply = rec.session.getLastAssistantText?.() ?? "";
        return reply || "(没有输出)";
      } finally {
        rec.busy = false;
      }
    });
    // 链尾捕获错误，避免打断后续排队消息
    this.queues.set(chatId, run.catch(() => {}));
    return run;
  }

  /** 为某聊天开新会话 */
  async newSession(chatId) {
    const cur = this.sessions.get(chatId);
    if (cur?.session) {
      try {
        cur.session.dispose();
      } catch {
        /* ignore */
      }
      this.sessions.delete(chatId);
    }
    return this.sessionFor(chatId, { reset: true });
  }

  status(chatId) {
    const rec = this.sessions.get(chatId);
    return {
      activeSessions: this.sessions.size,
      persisted: Boolean(this.map[chatId]),
      file: this.map[chatId] ?? null,
      inMemory: Boolean(rec),
      busy: rec?.busy ?? false,
      model: rec ? (rec.session.model?.modelId ?? rec.session.model?.id ?? String(rec.session.model)) : null,
      cwd: this.cwd,
    };
  }

  disposeOldestIdle() {
    let oldest = null;
    for (const [chatId, rec] of this.sessions) {
      if (rec.busy) continue;
      if (!oldest || rec.lastUsed < oldest.rec.lastUsed) oldest = { chatId, rec };
    }
    if (oldest) {
      log("释放空闲会话:", oldest.chatId);
      try {
        oldest.rec.session.dispose();
      } catch {
        /* ignore */
      }
      this.sessions.delete(oldest.chatId);
    }
  }

  sweep() {
    const now = Date.now();
    for (const [chatId, rec] of [...this.sessions]) {
      if (rec.busy) continue;
      if (now - rec.lastUsed > this.idleMs) {
        log("空闲释放:", chatId);
        try {
          rec.session.dispose();
        } catch {
          /* ignore */
        }
        this.sessions.delete(chatId);
      }
    }
  }

  async disposeAll() {
    clearInterval(this.sweeper);
    for (const [chatId, rec] of this.sessions) {
      try {
        rec.session.dispose();
      } catch {
        /* ignore */
      }
      this.sessions.delete(chatId);
    }
    this.saveMap();
  }
}
