import assert from "node:assert/strict";
import test from "node:test";
import { livsynAuthorized } from "./src/livsyn_client.mjs";
import { createLivsynTool } from "./src/livsyn_tool.mjs";
import { readLivsynView, summarize } from "./src/livsyn_ego.mjs";
import { livsynPrompt, livsynRequest, prefetchLivsyn, withLivsynEvidence } from "./src/livsyn_context.mjs";

const type = new Proxy({}, { get: () => (value) => value });

test("only the bound human in the bound direct chat can request real business data", () => {
  const owner = { chatId: "oc_" + "a".repeat(32), senderId: "ou_" + "b".repeat(32) };
  const authorized = { chatType: "p2p", ...owner, raw: { sender: { sender_type: "user" } } };
  assert.ok(livsynAuthorized(authorized, owner));
  assert.ok(!livsynAuthorized(authorized, undefined));
  assert.ok(!livsynAuthorized({ ...authorized, senderId: "another" }, owner));
  assert.ok(!livsynAuthorized({ ...authorized, chatId: "another" }, owner));
  assert.ok(!livsynAuthorized({ ...authorized, chatType: "group" }, owner));
  assert.ok(!livsynAuthorized({ ...authorized, raw: { sender: { sender_type: "bot" } } }, owner));
});

test("tool validates view and batch limits before contacting the reader", async () => {
  const queries = [];
  const tool = createLivsynTool(type, async (...args) => {
    queries.push(args);
    return { view: args[0], rowsRead: 40 };
  });
  for (const input of [{ view: "https://external.invalid" }, { view: "tasks", page: 0 }, { view: "tasks", pages: 9 }, { view: "statistics", pages: 2 }, { view: "tasks", pages: 3, details: true }]) {
    assert.equal((await tool.execute("test", input)).details.ok, false);
  }
  assert.equal(queries.length, 0);
  assert.deepEqual((await tool.execute("test", { view: "tasks", page: 2, pages: 2 })).details, { ok: true, view: "tasks", rowsRead: 40 });
  assert.deepEqual(queries[0].slice(0, 3), ["tasks", 2, 2]);
  assert.deepEqual((await tool.execute("test", { view: "tasks", details: true })).details.ok, true);
  assert.deepEqual(queries[1].slice(0, 4), ["tasks", 1, 1, true]);
});

test("summaries reject duplicate row identifiers and do not expose row keys", () => {
  const fixture = { page: 1, pageCount: 1, data: [["进行中"], ["已结束"]], fields: ["状态"], keys: ["key-a", "key-b"] };
  const output = summarize(fixture);
  assert.equal(output.rowsRead, 2);
  assert.deepEqual(output.counts.状态, { 进行中: 1, 已结束: 1 });
  assert.ok(!JSON.stringify(output).includes("key-a"));
  assert.throws(() => summarize({ ...fixture, keys: ["key-a", "key-a"] }), /重复/);
});

test("batch receipts distinguish a partial read from a complete list", async () => {
  let current = 1;
  const page = {
    goto: async () => { current = 1; },
    url: () => "https://ldp.lingrobotics.com/data-collection",
    waitForFunction: async () => {},
    evaluate: async (fn, arg) => {
      if (arg?.desired) return { selector: String(arg.desired), number: arg.desired };
      return {
        page: current, pageSize: 1, pageCount: 3, reportedTotal: "共 3 条",
        fields: ["状态"], data: [["进行中"]], keys: [`row-${current}`],
      };
    },
    click: async (selector) => { current = Number(selector); },
  };
  const result = await readLivsynView(page, "tasks", 2, 2);
  assert.deepEqual([result.firstPage, result.lastPage, result.rowsRead, result.nextPage], [2, 3, 2, null]);
  assert.equal(result.wholeListRead, false);
  const all = await readLivsynView(page, "tasks", 1, 3);
  assert.equal(all.wholeListRead, true);
  assert.equal(all.rowsRead, 3);
});

test("a named live business query receives evidence before the model replies", async () => {
  const text = "查一下灵生统计页的采集时长和有效时长";
  assert.deepEqual(livsynRequest(text), [{ view: "statistics", page: 1 }]);
  assert.deepEqual(livsynRequest("在吗"), []);
  assert.deepEqual(livsynRequest("查看灵生上传记录第12页"), [{ view: "uploads", page: 12 }]);
  const live = {
    ok: true, view: "statistics", dateRange: ["2026.11.16", "2026.11.16"],
    collectionDuration: "71:38:43", validDuration: "27:22:37", source: "https://ldp.lingrobotics.com/statistics",
    freshness: "数据截至 2026.11.16",
  };
  const reports = await prefetchLivsyn({ async execute(_id, query) {
    assert.equal(query.view, "statistics");
    return { details: live };
  } }, text);
  assert.match(livsynPrompt(text, reports), /27:22:37/);
  assert.doesNotMatch(withLivsynEvidence("请复制 Token 给我", reports, text), /Token/);
  assert.match(withLivsynEvidence("模型服务请求失败", reports, text), /71:38:43/);
  assert.match(withLivsynEvidence("采集 71:38:43，有效 27:22:37", reports, text), /来源 https:/);
  assert.match(withLivsynEvidence("审核进度和质量需要分别跟踪。", reports, "分析一下灵生统计页"), /分别跟踪/);
});
