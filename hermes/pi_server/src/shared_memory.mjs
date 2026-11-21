import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

const recordKinds = new Set(["capability", "rule", "workflow", "task"]);
const maxRecords = 80;
const maxTitleLength = 120;
const maxContentLength = 1600;

function text(value, field, maxLength) {
  if (typeof value !== "string") throw Error(`${field}必须是文字`);
  const normalized = value.trim().replace(/\r\n/g, "\n");
  if (!normalized || normalized.length > maxLength) throw Error(`${field}长度不符合要求`);
  return normalized;
}

function containsCredential(value) {
  return /(?:\b(?:api[ _-]?key|password|cookie)\b|-----BEGIN [A-Z ]+-----|\b(?:wk|sk)-[A-Za-z0-9_-]{12,})/i.test(value);
}

function emptyState() {
  return { version: 1, records: [] };
}

export class SharedMemoryStore {
  constructor({ file, now = () => new Date().toISOString() }) {
    this.file = file;
    this.now = now;
    this.state = this.load();
  }

  load() {
    if (!existsSync(this.file)) return emptyState();
    try {
      const parsed = JSON.parse(readFileSync(this.file, "utf8"));
      if (parsed?.version === 1 && Array.isArray(parsed.records)) return parsed;
    } catch {
      // A corrupt shared-memory file must never prevent Feishu from starting.
    }
    return emptyState();
  }

  save() {
    mkdirSync(path.dirname(this.file), { recursive: true, mode: 0o700 });
    const temporary = `${this.file}.${process.pid}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(this.state, null, 2)}\n`, { mode: 0o600 });
    renameSync(temporary, this.file);
  }

  remember({ kind, title, content }) {
    if (!recordKinds.has(kind)) throw Error("不支持的共享记录类型");
    const safeTitle = text(title, "标题", maxTitleLength);
    const safeContent = text(content, "内容", maxContentLength);
    if (containsCredential(`${safeTitle}\n${safeContent}`)) {
      throw Error("共享记忆不能保存密钥、密码、Cookie或类似凭据");
    }

    const now = this.now();
    const existing = this.state.records.find((record) => record.kind === kind && record.title === safeTitle);
    const record = existing ?? { id: randomUUID(), kind, title: safeTitle, createdAt: now };
    record.content = safeContent;
    record.updatedAt = now;
    record.source = "owner-confirmed";
    record.status = "active";
    if (!existing) this.state.records.push(record);
    if (this.state.records.length > maxRecords) this.state.records.splice(0, this.state.records.length - maxRecords);
    this.save();
    return { ...record };
  }

  activeRecords() {
    return this.state.records
      .filter((record) => record?.status === "active" && recordKinds.has(record.kind))
      .map((record) => ({ ...record }));
  }

  context() {
    const records = this.activeRecords();
    if (!records.length) return "【小派派统一岗位记忆】目前没有额外的全员共享记录。";
    const items = records.map((record) => `- ${record.kind}｜${record.title}\n  ${record.content}`);
    return [
      "【小派派统一岗位记忆】",
      "以下内容由负责人确认，适用于所有聊天入口。它不包含任何个人聊天记录、密码、令牌或后台私人数据。",
      ...items,
      "只把它用作共同能力和工作依据。当前聊天未提供的事实仍需如实说明。",
    ].join("\n");
  }

  status() {
    const records = this.activeRecords();
    const counts = Object.fromEntries([...recordKinds].map((kind) => [kind, records.filter((record) => record.kind === kind).length]));
    return { records: records.length, counts };
  }
}

export function createSharedMemoryTool(Type, store) {
  return {
    name: "remember_shared",
    label: "记录全员共享岗位记忆",
    description: "仅在负责人明确要求某项能力、长期规则、标准流程或正式待办应让所有小派派聊天入口共同使用时调用。只记录通用工作知识。不得记录个人聊天内容、账号、密码、Token、Cookie、员工隐私或未确认事实。",
    parameters: Type.Object({
      kind: Type.Union([...recordKinds].map((kind) => Type.Literal(kind))),
      title: Type.String({ minLength: 2, maxLength: maxTitleLength }),
      content: Type.String({ minLength: 2, maxLength: maxContentLength }),
    }, { additionalProperties: false }),
    async execute(_id, record) {
      try {
        const saved = store.remember(record);
        const details = { ok: true, kind: saved.kind, title: saved.title, updatedAt: saved.updatedAt };
        return { content: [{ type: "text", text: `已写入全员共享岗位记忆：${saved.title}` }], details };
      } catch (error) {
        const details = { ok: false, error: error.message };
        return { content: [{ type: "text", text: `未写入共享岗位记忆：${error.message}` }], details };
      }
    },
  };
}
