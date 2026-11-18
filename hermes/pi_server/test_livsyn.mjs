import assert from "node:assert/strict";
import test from "node:test";
import { livsynAuthorized } from "./src/livsyn_client.mjs";
import { createLivsynTool } from "./src/livsyn_tool.mjs";
import { summarize } from "./src/livsyn_ego.mjs";

const type = new Proxy({}, { get: () => (value) => value });

test("only the sole allowlisted human in direct chat can request real business data", () => {
  const authorized = { chatType: "p2p", senderId: "owner", raw: { sender: { sender_type: "user" } } };
  assert.ok(livsynAuthorized(authorized, ["owner"]));
  assert.ok(!livsynAuthorized(authorized, []));
  assert.ok(!livsynAuthorized(authorized, ["owner", "another"]));
  assert.ok(!livsynAuthorized({ ...authorized, senderId: "another" }, ["owner"]));
  assert.ok(!livsynAuthorized({ ...authorized, chatType: "group" }, ["owner"]));
  assert.ok(!livsynAuthorized({ ...authorized, raw: { sender: { sender_type: "bot" } } }, ["owner"]));
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
