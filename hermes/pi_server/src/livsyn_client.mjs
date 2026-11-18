import http from "node:http";

export const livsynSocket = "/run/pi-livsyn/reader.sock";

export function readLivsyn(view, page, count, details, signal) {
  return new Promise((resolve, reject) => {
    const request = http.get({ socketPath: livsynSocket, path: `/read/${view}/${page}/${count}/${details ? 1 : 0}`, signal }, (response) => {
      response.setEncoding("utf8");
      let body = "";
      response.on("data", (chunk) => {
        body += chunk;
        if (body.length > 128000) request.destroy(Error("invalid reader response"));
      });
      response.on("error", reject);
      response.on("end", () => {
        try {
          const receipt = JSON.parse(body);
          if (response.statusCode !== 200 || receipt.ok !== true || receipt.result?.view !== view) {
            throw Object.assign(Error("reader did not return requested data"), { code: receipt.code });
          }
          resolve(receipt.result);
        } catch (error) {
          reject(error);
        }
      });
    });
    const timer = setTimeout(() => request.destroy(Object.assign(Error("read timeout"), { code: "TIMEOUT" })), 74000);
    request.on("close", () => clearTimeout(timer));
    request.on("error", reject);
  });
}

export function isLivsynOwner(owner) {
  return typeof owner?.chatId === "string" && /^oc_[a-f0-9]{16,64}$/i.test(owner.chatId)
    && typeof owner?.senderId === "string" && /^ou_[a-f0-9]{16,64}$/i.test(owner.senderId);
}

export function livsynAuthorized(message, owner) {
  return isLivsynOwner(owner) && message.chatType === "p2p" && message.chatId === owner.chatId
    && message.senderId === owner.senderId && message.raw?.sender?.sender_type === "user";
}
