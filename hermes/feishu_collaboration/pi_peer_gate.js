// Keep bot-to-bot collaboration inside one Feishu group and one known peer.
// Human @Pi messages continue through the bridge's existing policy.
const REQUEST = /^【协作请求 ([A-Za-z0-9_-]{6,40}) ([1-3])\/3】\s*/u;

export class PeerGate {
  constructor({ groupId, peerOpenId, peerAppId, maxRequests = 3, windowMs = 30 * 60_000, now = Date.now }) {
    this.groupId = groupId;
    this.peerOpenId = peerOpenId;
    this.peerAppId = peerAppId;
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.now = now;
    this.seen = new Map();
    this.acceptedAt = [];
  }

  admit(msg, text) {
    const senderType = msg.raw?.sender?.sender_type;
    if (senderType !== "bot" && senderType !== "app") return { kind: "human" };
    if (!this.groupId || !(this.peerOpenId || this.peerAppId) || msg.chatType !== "group" ||
        msg.chatId !== this.groupId ||
        (msg.senderId !== this.peerOpenId && msg.senderId !== this.peerAppId) || !msg.mentionedBot) {
      return { kind: "reject", reason: "untrusted_bot_or_chat" };
    }
    const match = REQUEST.exec(text);
    if (!match) return { kind: "reject", reason: "missing_collaboration_request" };
    const [, id, rawTurn] = match;
    const turn = Number(rawTurn);
    const now = this.now();
    for (const [key, entry] of this.seen) {
      if (now - entry.at > this.windowMs) this.seen.delete(key);
    }
    this.acceptedAt = this.acceptedAt.filter((at) => now - at <= this.windowMs);
    if (this.acceptedAt.length >= this.maxRequests) {
      return { kind: "reject", reason: "collaboration_budget_exhausted" };
    }
    const previous = this.seen.get(id);
    if ((!previous && turn !== 1) || (previous && turn !== previous.turn + 1)) {
      return { kind: "reject", reason: "duplicate_or_out_of_order" };
    }
    const task = text.slice(match[0].length).trim();
    if (!task) return { kind: "reject", reason: "empty_request" };
    this.seen.set(id, { turn, at: now });
    this.acceptedAt.push(now);
    return { kind: "peer", id, turn, task };
  }
}
