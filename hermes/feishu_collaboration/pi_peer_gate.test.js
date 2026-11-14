import assert from "node:assert/strict";
import { PeerGate } from "./pi_peer_gate.js";

const groupId = "oc_test";
const peerOpenId = "ou_hermes";
let time = 1000;
const gate = new PeerGate({ groupId, peerOpenId, now: () => time });
const peer = (text, extra = {}) => ({
  chatType: "group", chatId: groupId, senderId: peerOpenId, mentionedBot: true,
  raw: { sender: { sender_type: "bot" } }, ...extra,
});
assert.equal(gate.admit(peer("ordinary"), "ordinary").reason, "missing_collaboration_request");
assert.equal(gate.admit(peer("【协作请求 ABCDEF 1/3】 看资料", { chatId: "oc_other" }),
  "【协作请求 ABCDEF 1/3】 看资料").reason, "untrusted_bot_or_chat");
assert.equal(gate.admit(peer("【协作请求 ABCDEF 1/3】 看资料", { senderId: "ou_other" }),
  "【协作请求 ABCDEF 1/3】 看资料").reason, "untrusted_bot_or_chat");
assert.equal(gate.admit(peer("【协作请求 ABCDEF 1/3】 看资料", { mentionedBot: false }),
  "【协作请求 ABCDEF 1/3】 看资料").reason, "untrusted_bot_or_chat");
assert.equal(gate.admit(peer("【协作请求 ABCDEF 1/3】 看资料"),
  "【协作请求 ABCDEF 1/3】 看资料").kind, "peer");
assert.equal(gate.admit(peer("【协作请求 ABCDEF 1/3】 看资料"),
  "【协作请求 ABCDEF 1/3】 看资料").reason, "duplicate_or_out_of_order");
assert.equal(gate.admit(peer("【协作请求 ABCDEF 2/3】 再核对"),
  "【协作请求 ABCDEF 2/3】 再核对").kind, "peer");
assert.equal(gate.admit(peer("【协作请求 ABCDEF 3/3】 最后确认"),
  "【协作请求 ABCDEF 3/3】 最后确认").kind, "peer");
assert.equal(gate.admit(peer("【协作请求 OTHER1 1/3】 新任务"),
  "【协作请求 OTHER1 1/3】 新任务").reason, "collaboration_budget_exhausted");
time += 30 * 60_000 + 1;
assert.equal(gate.admit(peer("【协作请求 OTHER1 1/3】 新任务"),
  "【协作请求 OTHER1 1/3】 新任务").kind, "peer");
assert.equal(gate.admit({ chatType: "group", raw: { sender: { sender_type: "user" } } }, "你好").kind, "human");
console.log("Pi peer gate: 10 checks passed");
