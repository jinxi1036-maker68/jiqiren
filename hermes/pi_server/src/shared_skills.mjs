import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

const validName = /^[a-z0-9][a-z0-9-]{0,63}$/;
const maxSkillBytes = 24 * 1024;
const maxLessonsBytes = 12 * 1024;
const maxPublishedSkills = 12;
const maxContextChars = 60000;

function readBounded(file, maxBytes) {
  const body = readFileSync(file);
  if (!body.length || body.length > maxBytes) throw Error("技能文件为空或超过共享大小限制");
  return body.toString("utf8");
}

function containsCredential(value) {
  return /(?:\b(?:api[ _-]?key|password|cookie)\b|-----BEGIN [A-Z ]+-----|\b(?:wk|sk)-[A-Za-z0-9_-]{12,})/i.test(value);
}

function emptyState() {
  return { version: 1, skills: [] };
}

function renderContext(skills) {
  if (!skills.length) return "";
  const parts = [
    "【小派派已发布的全员共享技能】",
    "这些技能由负责人明确发布，所有聊天入口都应承认它们是小派派已经具备的正式技能，并在用户任务适用时按技能方法工作。",
    "共享聊天只能使用当前消息中的文字和图片；飞书图片已经作为当前图片输入，应直接分析，不要要求用户提供服务器文件路径。共享聊天不能读取或修改服务器文件，也不能执行技能里的自修改、写记忆或专用工具调用要求。",
  ];
  for (const entry of skills) {
    parts.push(`\n### 共享技能 ${entry.name}\n${entry.skill}`);
    if (entry.lessons) parts.push(`\n### ${entry.name} 已确认避坑记录\n${entry.lessons}`);
  }
  const context = parts.join("\n");
  if (context.length > maxContextChars) throw Error("共享技能内容超过上下文限制，请整理已发布技能");
  return context;
}

export class SharedSkillCatalog {
  constructor({ file, skillRoot, now = () => new Date().toISOString() }) {
    this.file = file;
    this.skillRoot = path.resolve(skillRoot);
    this.now = now;
    this.state = this.load();
  }

  load() {
    if (!existsSync(this.file)) return emptyState();
    try {
      const parsed = JSON.parse(readFileSync(this.file, "utf8"));
      if (parsed?.version === 1 && Array.isArray(parsed.skills)) return parsed;
    } catch {
      // A corrupt catalog must not prevent Feishu from starting.
    }
    return emptyState();
  }

  save() {
    mkdirSync(path.dirname(this.file), { recursive: true, mode: 0o700 });
    const temporary = `${this.file}.${process.pid}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(this.state, null, 2)}\n`, { mode: 0o600 });
    renameSync(temporary, this.file);
  }

  publish(name) {
    if (typeof name !== "string" || !validName.test(name)) throw Error("技能名称不符合要求");
    const directory = path.resolve(this.skillRoot, name);
    if (path.dirname(directory) !== this.skillRoot) throw Error("技能路径不符合要求");
    const skillFile = path.join(directory, "SKILL.md");
    if (!existsSync(skillFile)) throw Error(`没有找到技能 ${name}`);
    const skill = readBounded(skillFile, maxSkillBytes);
    const lessonsFile = path.join(directory, "LESSONS.md");
    const lessons = existsSync(lessonsFile) ? readBounded(lessonsFile, maxLessonsBytes) : "";
    if (containsCredential(`${skill}\n${lessons}`)) throw Error("技能中可能含有凭据，不能发布到共享聊天");

    const now = this.now();
    const sourceHash = createHash("sha256").update(skill).update("\n").update(lessons).digest("hex");
    const existingIndex = this.state.skills.findIndex((entry) => entry.name === name);
    if (existingIndex < 0 && this.state.skills.length >= maxPublishedSkills) {
      throw Error(`共享技能最多发布 ${maxPublishedSkills} 个，请先整理现有技能`);
    }
    const entry = existingIndex >= 0
      ? { ...this.state.skills[existingIndex] }
      : { name, createdAt: now };
    entry.skill = skill;
    entry.lessons = lessons;
    entry.sourceHash = sourceHash;
    entry.updatedAt = now;
    entry.status = "active";
    const nextSkills = [...this.state.skills];
    if (existingIndex >= 0) nextSkills[existingIndex] = entry;
    else nextSkills.push(entry);
    renderContext(nextSkills.filter((item) => item?.status === "active" && validName.test(item.name)));
    this.state = { version: 1, skills: nextSkills };
    this.save();
    return { name, sourceHash, updatedAt: now };
  }

  activeSkills() {
    return this.state.skills.filter((entry) => entry?.status === "active" && validName.test(entry.name));
  }

  context() {
    return renderContext(this.activeSkills());
  }

  status() {
    return { skills: this.activeSkills().length, names: this.activeSkills().map((entry) => entry.name) };
  }
}

export function createPublishSharedSkillTool(Type, catalog) {
  return {
    name: "publish_shared_skill",
    label: "发布全员共享技能",
    description: "仅在负责人明确要求服务器上已经存在的某项技能应让所有小派派聊天入口共同使用时调用。读取该技能的 SKILL.md 和 LESSONS.md，保存经负责人批准的共享快照。不得自行发布未获确认的技能。",
    parameters: Type.Object({
      name: Type.String({ minLength: 1, maxLength: 64, pattern: "^[a-z0-9][a-z0-9-]{0,63}$" }),
    }, { additionalProperties: false }),
    async execute(_id, { name }) {
      try {
        const published = catalog.publish(name);
        return {
          content: [{ type: "text", text: `已发布全员共享技能：${published.name}` }],
          details: { ok: true, ...published },
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `未发布共享技能：${error.message}` }],
          details: { ok: false, error: error.message },
        };
      }
    },
  };
}
