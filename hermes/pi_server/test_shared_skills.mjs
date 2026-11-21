import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { SharedSkillCatalog, createPublishSharedSkillTool } from "./src/shared_skills.mjs";

function fixture() {
  const directory = mkdtempSync(path.join(os.tmpdir(), "pi-shared-skills-"));
  const skillRoot = path.join(directory, "skills");
  const skill = path.join(skillRoot, "ego-sop");
  mkdirSync(skill, { recursive: true });
  writeFileSync(path.join(skill, "SKILL.md"), "# ego-sop\n\n按图片编写六步动作。\n");
  writeFileSync(path.join(skill, "LESSONS.md"), "# 避坑\n\n看不清不编。\n");
  return { directory, skillRoot, file: path.join(directory, "shared-skills.json") };
}

test("a published skill persists as a versioned shared snapshot", () => {
  const paths = fixture();
  try {
    const catalog = new SharedSkillCatalog(paths);
    const first = catalog.publish("ego-sop");
    assert.match(first.sourceHash, /^[a-f0-9]{64}$/);
    const reopened = new SharedSkillCatalog(paths);
    assert.deepEqual(reopened.status().names, ["ego-sop"]);
    assert.match(reopened.context(), /按图片编写六步动作/);
    assert.match(reopened.context(), /看不清不编/);
    assert.match(reopened.context(), /不能读取或修改服务器文件/);
    assert.match(reopened.context(), /应直接分析，不要要求用户提供服务器文件路径/);
  } finally {
    rmSync(paths.directory, { recursive: true, force: true });
  }
});

test("skill publication rejects traversal and credential-like content", () => {
  const paths = fixture();
  try {
    const catalog = new SharedSkillCatalog(paths);
    assert.throws(() => catalog.publish("../secret"), /名称/);
    writeFileSync(path.join(paths.skillRoot, "ego-sop", "SKILL.md"), "password=hidden");
    assert.throws(() => catalog.publish("ego-sop"), /凭据/);
  } finally {
    rmSync(paths.directory, { recursive: true, force: true });
  }
});

test("the owner tool publishes an existing skill", async () => {
  const paths = fixture();
  try {
    const catalog = new SharedSkillCatalog(paths);
    const Type = {
      String: (options) => options,
      Object: (properties, options) => ({ properties, options }),
    };
    const tool = createPublishSharedSkillTool(Type, catalog);
    const result = await tool.execute("test", { name: "ego-sop" });
    assert.equal(result.details.ok, true);
    assert.equal(result.details.name, "ego-sop");
  } finally {
    rmSync(paths.directory, { recursive: true, force: true });
  }
});
