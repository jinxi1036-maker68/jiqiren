import assert from "node:assert/strict";
import { test } from "node:test";
import { promptWithStatus } from "./src/piagent.js";

const article = (text) => ({
  role: "toolResult",
  toolName: "read_webpage",
  content: [{ type: "text", text: JSON.stringify({ ok: true, text }) }],
});
const assistant = (text, stopReason = "stop", errorMessage) => ({
  role: "assistant",
  content: text ? [{ type: "text", text }] : [],
  stopReason,
  errorMessage,
});

function sample(messages, failure) {
  let listener;
  let removed = false;
  return {
    get listenerRemoved() { return removed; },
    subscribe(callback) {
      listener = callback;
      return () => { removed = true; };
    },
    async prompt() {
      for (const message of messages) listener({ type: "message_end", message });
      if (failure) throw failure;
    },
  };
}

test("an empty webpage and a 429 are both reported without provider payload", async () => {
  const session = sample([article(""), assistant("", "error", "429: upstream response with private details")]);
  const reply = await promptWithStatus(session, "分析网页");
  assert.match(reply, /没有获取到正文/);
  assert.match(reply, /HTTP 429/);
  assert.doesNotMatch(reply, /private details/);
  assert.ok(session.listenerRemoved);
});

test("the Pi SDK receives image blocks alongside the caption", async () => {
  const session = sample([assistant("看见了一扇窗")]);
  const originalPrompt = session.prompt;
  const images = [{ type: "image", mimeType: "image/png", data: "fixture" }];
  session.prompt = async (text, options) => {
    assert.equal(text, "看看画面环境");
    assert.deepEqual(options, { images, expandPromptTemplates: false });
    await originalPrompt();
  };
  assert.equal(await promptWithStatus(session, "看看画面环境", images), "看见了一扇窗");
});

test("readable content and the subsequent network failure are reported separately", async () => {
  const reply = await promptWithStatus(sample([article("已读到的正文")], new Error("connection reset")), "分析网页");
  assert.match(reply, /已读到文字/);
  assert.match(reply, /连接模型服务时出了问题/);
});

test("a successful retry returns its answer", async () => {
  const session = sample([assistant("", "error", "429: limited"), assistant("本次分析结果")]);
  assert.equal(await promptWithStatus(session, "继续分析"), "本次分析结果");
});

test("a progress message and a tool result cannot be sent as the final answer", async () => {
  const reply = await promptWithStatus(sample([assistant("正在查", "toolUse"), article("正文")]), "分析网页");
  assert.match(reply, /没有生成可发送的最终答复/);
  assert.doesNotMatch(reply, /正在查/);
});

test("interrupted calls disclose the interruption rather than partial output", async () => {
  const reply = await promptWithStatus(sample([assistant("尚未完成", "aborted")]), "分析网页");
  assert.match(reply, /已中断/);
  assert.doesNotMatch(reply, /尚未完成/);
});
