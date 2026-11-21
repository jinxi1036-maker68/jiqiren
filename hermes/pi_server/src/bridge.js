/**
 * pi-feishu 桥接服务
 * 飞书自建机器人（长连接）⇄ pi coding agent
 * 每个飞书聊天对应一个持久 pi 会话，支持 /new /status /help
 */
import { createLarkChannel } from "@larksuiteoapi/node-sdk";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Type } from "typebox";
import { PiAgentPool } from "./piagent.js";
import { PeerGate } from "./pi_peer_gate.js";
import { createLivsynTool } from "./livsyn_tool.mjs";
import { isLivsynOwner, livsynAuthorized, livsynSocket, readLivsyn } from "./livsyn_client.mjs";
import { FeishuImageError, feishuImageParts, imageOnlyPrompt, loadFeishuImages } from "./feishu_images.mjs";
import { createSharedChat } from "./shared_chat.mjs";
import { SharedMemoryStore, createSharedMemoryTool } from "./shared_memory.mjs";
import { SharedSkillCatalog, createPublishSharedSkillTool } from "./shared_skills.mjs";

const log = (...a) => console.log("[feishu]", ...a);

const appId = process.env.FEISHU_APP_ID;
const appSecret = process.env.FEISHU_APP_SECRET;
if (!appId || !appId.startsWith("cli_") || !appSecret) {
  console.error("请先在 .env 中配置 FEISHU_APP_ID / FEISHU_APP_SECRET（.env.example 有模板）");
  process.exit(1);
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(ROOT, "data");
const sharedMemory = new SharedMemoryStore({ file: path.join(dataDir, "shared-memory.json") });
if (sharedMemory.status().records === 0) {
  sharedMemory.remember({
    kind: "capability",
    title: "图片理解",
    content: "可以分析当前聊天发送的 JPG、PNG 或 WebP 图片，描述可见场景、物体、环境和文字，并说明模糊或无法确认之处。",
  });
}
const sharedMemoryTool = createSharedMemoryTool(Type, sharedMemory);
const sharedSkillsFile = path.join(dataDir, "shared-skills.json");
const firstSharedSkillsInit = !existsSync(sharedSkillsFile);
const sharedSkills = new SharedSkillCatalog({
  file: sharedSkillsFile,
  skillRoot: path.join(process.env.HOME, ".pi", "agent", "skills"),
});
if (firstSharedSkillsInit && existsSync(path.join(process.env.HOME, ".pi", "agent", "skills", "ego-sop", "SKILL.md"))) {
  try {
    sharedSkills.publish("ego-sop");
  } catch (error) {
    log("首次发布 ego-sop 共享技能失败，飞书继续启动:", error.message);
  }
}
const publishSharedSkillTool = createPublishSharedSkillTool(Type, sharedSkills);
const sharedContext = () => [sharedMemory.context(), sharedSkills.context()].filter(Boolean).join("\n\n");
const list = (v) => (v || "").split(",").map((s) => s.trim()).filter(Boolean);
const dmAllowlist = list(process.env.ALLOWED_DM_OPEN_IDS);
let livsynOwner;
try {
  const binding = JSON.parse(readFileSync(path.join(ROOT, "livsyn-owner.json"), "utf8"));
  if (isLivsynOwner(binding)) livsynOwner = binding;
} catch (error) {
  if (error.code !== "ENOENT") log("灵生只读权限配置无法加载");
}
const livsynTool = livsynOwner ? createLivsynTool(Type, readLivsyn) : undefined;

const pool = new PiAgentPool({
  dataDir,
  cwd: process.env.PI_CWD || process.cwd(),
  idleMs: (Number(process.env.IDLE_SESSION_MINUTES) || 30) * 60_000,
  maxActive: Number(process.env.MAX_ACTIVE_SESSIONS) || 8,
  livsynTool,
  sharedMemoryTools: [sharedMemoryTool, publishSharedSkillTool],
  sharedContext,
});
const sharedChat = createSharedChat({ sharedContext });

const groupAllowlist = list(process.env.GROUP_ALLOWLIST);
const ackEmoji = process.env.ACK_EMOJI || "OK";
const peerGate = new PeerGate({
  groupId: process.env.COLLAB_GROUP_ID,
  peerOpenId: process.env.HERMES_BOT_OPEN_ID,
  peerAppId: process.env.HERMES_BOT_APP_ID,
});

const channel = createLarkChannel({
  appId,
  appSecret,
  transport: "websocket",
  policy: {
    dmMode: dmAllowlist.length ? "allowlist" : "open",
    dmAllowlist: dmAllowlist,
    groupAllowlist: groupAllowlist.length ? groupAllowlist : undefined,
    requireMention: true, // 群聊中必须 @机器人
  },
  loggerLevel: "warn",
  includeRawEvent: true, // sender_type is needed to reject other bots; never log raw events
});

// ---------- 工具 ----------

async function react(messageId, emoji, remove = false) {
  try {
    if (remove) await channel.removeReactionByEmoji(messageId, emoji);
    else await channel.addReaction(messageId, emoji);
  } catch (e) {
    log("reaction 失败（不影响主流程）:", e.message);
  }
}

/** 去掉内容里的 @机器人 占位符（如 @_user_1） */
function stripMentions(content) {
  return (content || "").replace(/@_user_\d+/g, " ").replace(/\s+/g, " ").trim();
}

const HELP_TEXT = `可用命令：
/new — 为当前聊天开一个新会话（清空上下文）
/status — 查看当前会话状态
/help — 显示帮助

其他任意文本都会发给 pi agent 执行（可让它读文件、跑命令、写代码）。
群里使用时请先 @机器人。`;

// ---------- 消息处理 ----------

async function onMessage(msg) {
  if (msg.chatType === "group" && !msg.mentionedBot) return;
  const { hasImages, keys, caption } = feishuImageParts(msg);
  const text = stripMentions(caption);
  const peer = peerGate.admit(msg, text);
  if (peer.kind === "reject") {
    log("机器人协作消息被拒绝:", peer.reason,
      "chat:", msg.chatType, msg.chatId, "sender:", msg.senderId,
      "type:", msg.raw?.sender?.sender_type, "mentioned:", msg.mentionedBot);
    return;
  }

  if (msg.chatType === "group" && msg.mentionedBot && !hasImages) {
    if (!text) {
      // 只 @ 了一下没说话
      await channel.send(msg.chatId, { text: "有什么可以帮你？发 /help 看命令列表。" }, { replyTo: msg.messageId });
      return;
    }
  }
  if (!text && !hasImages) {
    log("收到非文本/空消息，跳过。type:", msg.rawContentType, "resources:", msg.resources?.length ?? 0);
    return;
  }

  const ownerDirect = peer.kind === "human" && livsynAuthorized(msg, livsynOwner);
  const shared = peer.kind === "human" && !ownerDirect;
  const readImages = hasImages && peer.kind === "human";
  const t = peer.kind === "peer" ? peer.task : (text || imageOnlyPrompt);
  const allowLivsyn = Boolean(livsynTool) && ownerDirect;
  const allowSharedMemory = ownerDirect;

  if (!hasImages && (t === "/new" || t === "new")) {
    if (shared) await sharedChat.reset(msg.chatId);
    else await pool.newSession(msg.chatId, { allowLivsyn });
    await channel.send(msg.chatId, { text: "已为当前聊天开新会话（旧上下文不再延续）。" }, { replyTo: msg.messageId });
    return;
  }
  if (!hasImages && (t === "/status" || t === "status")) {
    const sharedStatus = sharedMemory.status();
    const skillStatus = sharedSkills.status();
    const sharedLine = `统一岗位记忆: ${sharedStatus.records} 条；共享技能: ${skillStatus.skills} 个${skillStatus.names.length ? `（${skillStatus.names.join("、")}）` : ""}`;
    if (shared) {
      await channel.send(msg.chatId, { text: `小派派在线，可以发文字或图片。在群里请 @小派派。\n${sharedLine}` }, { replyTo: msg.messageId });
      return;
    }
    const s = pool.status(msg.chatId);
    const lines = [
      "pi 会话状态：",
      `  活动会话数: ${s.activeSessions}`,
      `  本聊天: ${s.inMemory ? "已加载" : "未加载（将在下一条消息时恢复）"}`,
      `  模型: ${s.model ?? "-"}`,
      `  工作目录: ${s.cwd}`,
      `  会话文件: ${s.file ?? "(未持久化)"}`,
    ];
    if (allowLivsyn) lines.push(existsSync(livsynSocket) ? "  灵生后台: 服务器只读取数入口在线" : "  灵生后台: 服务器取数入口暂不可用");
    if (ownerDirect) {
      const imageStatus = s.imageInput === null ? "收到图片后检查当前模型" : s.imageInput ? "当前模型支持图片输入" : "当前模型未启用图片输入";
      lines.push(`  图片识别: ${imageStatus}`);
    }
    lines.push(`  ${sharedLine}`);
    await channel.send(msg.chatId, { text: lines.join("\n") }, { replyTo: msg.messageId });
    return;
  }
  if (!hasImages && (t === "/help" || t === "help" || t === "帮助")) {
    const help = shared ? "可以发文字或图片给小派派。群里请先 @小派派。用 /new 清空当前会话的近期上下文。" : HELP_TEXT;
    await channel.send(msg.chatId, { text: help }, { replyTo: msg.messageId });
    return;
  }

  // 普通消息 → 交给 pi agent
  await react(msg.messageId, ackEmoji, false);
  log(`收到消息 chat=${msg.chatId} sender=${msg.senderId} len=${t.length} mode=${shared ? "shared" : "assigned"}`);
  try {
    const task = peer.kind === "peer"
      ? `来自凌矩正式数字员工 Hermes 的群内项目协作请求。请只处理消息中获准的内容；未核实的事实如实标明。\n${t}`
      : t;
    const images = readImages ? await loadFeishuImages(
      (options) => channel.rawClient.im.v1.messageResource.get(options), msg.messageId, keys,
    ) : [];
    if (images.length) log(shared ? "收到共享会话图片" : "收到授权单聊图片", { count: images.length, mimeTypes: images.map(({ mimeType }) => mimeType) });
    const input = hasImages && !readImages ? `当前聊天的图片未送入模型。请仅根据下列文字处理任务。\n\n${task}` : task;
    const reply = shared
      ? await sharedChat.reply(msg.chatId, input, images)
      : await pool.prompt(msg.chatId, input, { allowLivsyn, allowSharedMemory, images });
    if (peer.kind === "peer") {
      await channel.send(msg.chatId,
        { markdown: `【协作答复 ${peer.id} ${peer.turn}/3】\n${reply}` },
        { replyTo: msg.messageId,
          mentions: [{ openId: process.env.HERMES_BOT_OPEN_ID, name: "Hermes" }] });
    } else {
      await channel.send(msg.chatId, { markdown: reply }, { replyTo: msg.messageId });
      if (shared) log("共享会话已回复", { chatType: msg.chatType });
    }
  } catch (e) {
    if (e instanceof FeishuImageError) {
      log("图片读取未成功:", e.message);
      await channel.send(msg.chatId, { text: e.message }, { replyTo: msg.messageId }).catch(() => {});
      return;
    }
    log("执行失败:", e.stack || e.message);
    await channel
      .send(msg.chatId, { text: `⚠️ 执行出错：${String(e.message || e).slice(0, 300)}` }, { replyTo: msg.messageId })
      .catch(() => {});
  } finally {
    await react(msg.messageId, ackEmoji, true);
  }
}

channel.on({
  message: onMessage,
  reject: (evt) => log("消息被策略拒绝:", evt.reason, "chat:", evt.chatId, "sender:", evt.senderId),
  error: (err) => log("通道错误:", err.code, err.message),
  reconnecting: () => log("连接断开，重连中..."),
  reconnected: () => log("连接已恢复"),
});

// ---------- 启动 ----------

let stopping = false;
async function shutdown(sig) {
  if (stopping) return;
  stopping = true;
  log(`${sig}，正在关闭...`);
  try {
    await Promise.allSettled([pool.disposeAll(), channel.disconnect()]);
  } finally {
    process.exit(0);
  }
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

await channel.connect();
const name = channel.botIdentity?.name ? `「${channel.botIdentity.name}」` : "";
log(`飞书通道已上线${name}，等待消息...`);
log(`  工作目录: ${pool.cwd}`);
log(`  私聊: ${dmAllowlist.length ? "白名单模式 (" + dmAllowlist.length + ")" : "开放"}`);
log(`  群聊: ${groupAllowlist.length ? "白名单模式 (" + groupAllowlist.length + ")" : "开放（需 @）"}`);
log(`  灵生只读: ${livsynOwner ? "已绑定单聊" : "尚未绑定单聊"}`);
log("  共享会话: 已启用文字问答和图片识别");
