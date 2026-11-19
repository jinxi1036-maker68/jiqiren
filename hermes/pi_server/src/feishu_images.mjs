export const imageOnlyPrompt = "请描述这张图片里看得见的场景和环境、主要物体、空间布局、人物动作及可辨认的文字（如有）。区分直接观察和推测，对模糊、遮挡或画面以外的情况如实说明。";

const imageTypes = {
  "image/png": Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  "image/jpeg": Buffer.from([0xff, 0xd8, 0xff]),
};
const maxImages = 4;
const maxImageBytes = 8 * 1024 * 1024;
const maxTotalBytes = 12 * 1024 * 1024;

export class FeishuImageError extends Error {}

export function feishuImageParts(message) {
  const resources = (message.resources ?? []).filter((resource) => resource.type === "image");
  const keys = [...new Set(resources.map(({ fileKey }) => fileKey))];
  let caption = message.rawContentType === "image" ? "" : (message.content ?? "");
  for (const key of keys) caption = caption.replaceAll(`![image](${key})`, "");
  return { hasImages: message.rawContentType === "image" || resources.length > 0, keys, caption };
}

function detectImageMime(bytes) {
  for (const [mime, prefix] of Object.entries(imageTypes)) {
    if (bytes.subarray(0, prefix.length).equals(prefix)) return mime;
  }
  if (bytes.length >= 16 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }
  return null;
}

async function downloadImage(getResource, messageId, fileKey, maxBytes) {
  let stream;
  let timer;
  let timedOut = false;
  const work = async () => {
    const response = await getResource({ path: { message_id: messageId, file_key: fileKey }, params: { type: "image" } });
    stream = response.getReadableStream();
    if (timedOut) {
      stream.destroy();
      return;
    }
    const size = Number(response.headers?.["content-length"]);
    if (size > maxBytes) {
      stream.destroy();
      throw new FeishuImageError("图片太大，请压缩后重发。");
    }
    const chunks = [];
    let length = 0;
    for await (const chunk of stream) {
      const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      length += data.length;
      if (length > maxBytes) throw new FeishuImageError("图片太大，请压缩后重发。");
      chunks.push(data);
    }
    return Buffer.concat(chunks, length);
  };
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      stream?.destroy();
      reject(new FeishuImageError("飞书图片下载超时，请稍后重发。"));
    }, 25000);
  });
  try {
    return await Promise.race([work(), deadline]);
  } catch (error) {
    if (error instanceof FeishuImageError) throw error;
    if ([401, 403].includes(error?.response?.status) || Number(error?.response?.data?.code) === 234009) {
      throw new FeishuImageError("飞书拒绝读取这张图片，需要检查机器人的消息资源读取权限。");
    }
    throw new FeishuImageError("这张图片从飞书读取失败，可以直接重发图片。");
  } finally {
    clearTimeout(timer);
    stream?.destroy();
  }
}

export async function loadFeishuImages(getResource, messageId, keys) {
  const validKey = (key) => typeof key === "string" && /^[A-Za-z0-9_-]{1,180}$/.test(key);
  if (!validKey(messageId) || !keys.length || keys.some((key) => !validKey(key))) {
    throw new FeishuImageError("这条消息没有可读取的图片，请直接发送图片。");
  }
  if (keys.length > maxImages) throw new FeishuImageError("请把图片分开发送，每条最多 4 张。");
  const images = [];
  let total = 0;
  for (const key of keys) {
    const bytes = await downloadImage(getResource, messageId, key, Math.min(maxImageBytes, maxTotalBytes - total));
    total += bytes.length;
    const mimeType = detectImageMime(bytes);
    if (!mimeType) throw new FeishuImageError("这张图片的内容格式无法识别，请用 JPG、PNG 或 WebP 重发。");
    images.push({ type: "image", mimeType, data: bytes.toString("base64") });
  }
  return images;
}
