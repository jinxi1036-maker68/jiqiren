import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import { feishuImageParts, loadFeishuImages } from "./src/feishu_images.mjs";

const imageKey = "img_test-123";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/01cAAAAASUVORK5CYII=", "base64");

test("a Feishu image placeholder is not used as the user prompt", () => {
  const resources = [{ type: "image", fileKey: imageKey }];
  assert.deepEqual(feishuImageParts({ rawContentType: "image", content: `![image](${imageKey})`, resources }),
    { hasImages: true, keys: [imageKey], caption: "" });
  assert.deepEqual(feishuImageParts({ rawContentType: "post", content: `![image](${imageKey})看看窗边`, resources: [...resources, ...resources] }),
    { hasImages: true, keys: [imageKey], caption: "看看窗边" });
  assert.deepEqual(feishuImageParts({ rawContentType: "text", content: "查看灵生统计" }),
    { hasImages: false, keys: [], caption: "查看灵生统计" });
});

test("downloads original message-scoped image bytes and encodes a Pi image block", async () => {
  const input = await loadFeishuImages(async (options) => {
    assert.deepEqual(options, { path: { message_id: "om_test", file_key: imageKey }, params: { type: "image" } });
    return { headers: { "content-length": png.length }, getReadableStream: () => Readable.from([png.subarray(0, 3), png.subarray(3)]) };
  }, "om_test", [imageKey]);
  assert.deepEqual(input, [{ type: "image", mimeType: "image/png", data: png.toString("base64") }]);
});

test("permission failure, excessive bytes and non-images are handled without forwarding data", async () => {
  await assert.rejects(loadFeishuImages(async () => {
    throw Object.assign(new Error("private error"), { response: { status: 403 } });
  }, "om_test", [imageKey]), /消息资源读取权限/);
  await assert.rejects(loadFeishuImages(async () => ({
    headers: { "content-length": 9 * 1024 * 1024 }, getReadableStream: () => Readable.from([]),
  }), "om_test", [imageKey]), /图片太大/);
  await assert.rejects(loadFeishuImages(async () => ({
    getReadableStream: () => Readable.from([Buffer.from("not an image")]),
  }), "om_test", [imageKey]), /内容格式无法识别/);
  await assert.rejects(loadFeishuImages(async () => { assert.fail("bad keys must be rejected before requesting"); }, "om_test", ["../../other"]), /没有可读取的图片/);
});
