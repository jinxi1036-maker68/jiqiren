import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Type } from "typebox";
import { PiAgentPool } from "./src/piagent.js";
import { SharedMemoryStore, createSharedMemoryTool } from "./src/shared_memory.mjs";
import { SharedSkillCatalog, createPublishSharedSkillTool } from "./src/shared_skills.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const dataDir = process.env.PI_DATA_DIR || path.join(root, "data");
const skillRoot = process.env.PI_SKILL_ROOT || path.join(process.env.HOME, ".pi", "agent", "skills");
const workspace = process.env.PI_CWD || path.resolve(root, "..", "workspace");
const skillName = process.env.VERIFY_SHARED_SKILL || "ego-sop";
const temporary = mkdtempSync(path.join(os.tmpdir(), "pi-shared-skill-verify-"));
let pool;

try {
  const memory = new SharedMemoryStore({ file: path.join(dataDir, "shared-memory.json") });
  const skills = new SharedSkillCatalog({ file: path.join(dataDir, "shared-skills.json"), skillRoot });
  const skillFile = path.join(skillRoot, skillName, "SKILL.md");
  const lessonsFile = path.join(skillRoot, skillName, "LESSONS.md");
  if (!existsSync(skillFile)) throw Error(`缺少技能文件 ${skillName}`);
  const skill = readFileSync(skillFile, "utf8");
  const lessons = existsSync(lessonsFile) ? readFileSync(lessonsFile, "utf8") : "";
  const expectedHash = createHash("sha256").update(skill).update("\n").update(lessons).digest("hex");
  const entry = skills.activeSkills().find((item) => item.name === skillName);
  if (!entry || entry.sourceHash !== expectedHash) throw Error("共享技能快照与当前技能源文件不一致");

  const context = [memory.context(), skills.context()].filter(Boolean).join("\n\n");
  if (!context.includes(`共享技能 ${skillName}`)) throw Error("统一上下文没有装载共享技能");
  const tools = [createSharedMemoryTool(Type, memory), createPublishSharedSkillTool(Type, skills)];
  pool = new PiAgentPool({ dataDir: temporary, cwd: workspace, sharedMemoryTools: tools, sharedContext: () => context });
  const record = await pool.sessionFor("zero-model-verification", { reset: true, allowSharedMemory: true });
  const activeTools = record.session.getActiveToolNames();
  for (const name of ["remember_shared", "publish_shared_skill"]) {
    if (!activeTools.includes(name)) throw Error(`负责人会话缺少工具 ${name}`);
  }
  console.log(JSON.stringify({
    skills: skills.status().skills,
    names: skills.status().names,
    sourceHash: entry.sourceHash,
    contextChars: context.length,
    ownerTools: activeTools.filter((name) => ["remember_shared", "publish_shared_skill"].includes(name)),
    modelRequests: 0,
  }));
} finally {
  await pool?.disposeAll();
  rmSync(temporary, { recursive: true, force: true });
}
