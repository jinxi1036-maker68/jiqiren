import assert from "node:assert/strict";
import test from "node:test";
import { createSharedChat } from "./src/shared_chat.mjs";

test("shared replies use the current chat and current image without server tools", async () => {
  const requests = [];
  const chat = createSharedChat({
    openRuntime: async () => ({
      getModel(provider, id) {
        assert.equal(provider, "agnes");
        assert.equal(id, "agnes-3.0-flash");
        return { input: ["text", "image"] };
      },
      async completeSimple(_model, context) {
        requests.push(context);
        assert.equal(context.tools, undefined);
        return { role: "assistant", content: [{ type: "text", text: "已回复" }], stopReason: "stop" };
      },
    }),
  });
  const image = { type: "image", mimeType: "image/png", data: "synthetic" };
  await Promise.all([chat.reply("A", "同一会话第一条", [image]), chat.reply("A", "同一会话第二条")]);
  await chat.reply("B", "另一会话");
  assert.deepEqual(requests[0].messages[0].content[1], image);
  assert.equal(requests[1].messages[0].content[0].text, "同一会话第一条");
  assert.equal(requests[1].messages[0].content.length, 1);
  assert.equal(requests[2].messages.length, 1);
  await chat.reset("A");
  await chat.reply("A", "清空后的消息");
  assert.equal(requests[3].messages.length, 1);
});

test("the shared chat explains the current model quota without revealing provider errors", async () => {
  const chat = createSharedChat({
    openRuntime: async () => ({
      getModel: () => ({ input: ["text"] }),
      completeSimple: async () => ({
        content: [], stopReason: "error", errorMessage: "429: You have used up today's text quota and are now limited to 1 request every 3 minutes. (request id: private)",
      }),
    }),
  });
  assert.equal(await chat.reply("A", "你好"), "模型今天的额度已用完，目前每 3 分钟可请求一次。请稍后再试。");
});

test("a shared presence check replies without spending a model request", async () => {
  let opened = false;
  const chat = createSharedChat({
    openRuntime: async () => {
      opened = true;
      throw new Error("model should not be opened");
    },
  });
  assert.equal(await chat.reply("A", "在线吗"), "在，我在线。你可以直接说要我帮你处理什么。");
  assert.equal(opened, false);
});

test("a text reply is delivered when a provider uses a nonstandard completion status", async () => {
  const chat = createSharedChat({
    openRuntime: async () => ({
      getModel: () => ({ input: ["text"] }),
      completeSimple: async () => ({
        content: [{ type: "text", text: "我已经看到了。" }],
        stopReason: "completed",
      }),
    }),
  });
  assert.equal(await chat.reply("A", "看到了吗"), "我已经看到了。");
});
