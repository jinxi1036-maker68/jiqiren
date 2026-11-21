import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { SharedMemoryStore, createSharedMemoryTool } from "./src/shared_memory.mjs";

test("shared records persist and update by type and title", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "pi-shared-memory-"));
  const file = path.join(directory, "shared-memory.json");
  try {
    let tick = 0;
    const now = () => `2026-11-21T00:00:0${++tick}.000Z`;
    const first = new SharedMemoryStore({ file, now });
    first.remember({ kind: "capability", title: "图片理解", content: "可以分析当前聊天发送的图片。" });
    first.remember({ kind: "capability", title: "图片理解", content: "可以分析当前聊天发送的图片，并说明不确定处。" });
    const second = new SharedMemoryStore({ file, now });
    assert.equal(second.status().records, 1);
    assert.match(second.context(), /图片理解/);
    assert.match(second.context(), /不确定处/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("shared records reject credentials", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "pi-shared-memory-"));
  try {
    const store = new SharedMemoryStore({ file: path.join(directory, "shared-memory.json") });
    assert.throws(
      () => store.remember({ kind: "rule", title: "登录信息", content: "api_key=example" }),
      /凭据/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("the owner memory tool saves only validated shared records", async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "pi-shared-memory-"));
  try {
    const store = new SharedMemoryStore({ file: path.join(directory, "shared-memory.json") });
    const Type = {
      Literal: (value) => ({ value }),
      Union: (items) => ({ items }),
      String: (options) => options,
      Object: (properties, options) => ({ properties, options }),
    };
    const tool = createSharedMemoryTool(Type, store);
    const response = await tool.execute("test", {
      kind: "workflow",
      title: "日报核对",
      content: "报告中区分原始采集、审核有效和结算。",
    });
    assert.equal(response.details.ok, true);
    assert.match(store.context(), /日报核对/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
