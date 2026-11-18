import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";
import { readLivsynView } from "./livsyn_ego.mjs";

const origin = "https://ldp.lingrobotics.com";
const state = "/var/lib/pi-livsyn";
const chrome = "/srv/pi-livsyn/chrome/chrome";
const [action, view, rawPage, rawCount, rawDetails] = process.argv.slice(2);
let context;

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, async () => {
    await context?.close().catch(() => {});
    process.exit(0);
  });
}

function browserPage(page) {
  const locate = (selector) => page.locator(selector);
  return {
    goto: (url, { timeout }) => page.goto(url, { timeout, waitUntil: "domcontentloaded" }),
    url: () => page.url(),
    evaluate: (fn, arg) => page.evaluate(fn, arg),
    waitForFunction: (fn, arg, options) => page.waitForFunction(fn, arg, options),
    click: (selector) => locate(selector).click({ timeout: 5000 }),
    fill: (selector, text) => locate(selector).fill(text, { timeout: 5000 }),
    press: (selector, key) => locate(selector).press(key, { timeout: 5000 }),
  };
}

const test = action === "probe";
const login = action === "login";
const diagnostic = action === "diagnose";
const blocked = { method: 0, foreign: 0, socket: 0 };
try {
  if (!["probe", "login", "read", "diagnose"].includes(action)) throw new Error("invalid worker action");
  const profile = test ? state + "/probe-profile" : state + "/profile";
  await mkdir(profile, { recursive: true, mode: 0o700 });
  context = await chromium.launchPersistentContext(profile, {
    executablePath: chrome,
    chromiumSandbox: true,
    timeout: 18000,
    headless: !login,
    viewport: { width: 1180, height: 770 },
    serviceWorkers: "block",
    acceptDownloads: false,
    args: ["--disable-background-networking", "--disable-sync", "--disable-features=MediaRouter", "--window-size=1200,800"],
  });
  if (!login) {
    await context.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const permittedOrigin = test ? "https://fixture.invalid" : origin;
      if (url.origin !== permittedOrigin) {
        blocked.foreign++;
        await route.abort("blockedbyclient");
        return;
      }
      if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
        blocked.method++;
        await route.abort("blockedbyclient");
        return;
      }
      if (test) {
        await route.fulfill({ contentType: "text/html", body: "<title>Read fixture</title><main>read-only probe</main>" });
        return;
      }
      await route.continue();
    });
    await context.routeWebSocket("**/*", async (socket) => {
      blocked.socket++;
      await socket.close({ code: 1008, reason: "read-only" });
    });
  }
  const page = context.pages()[0] ?? await context.newPage();
  if (test) {
    await page.goto("https://fixture.invalid/", { waitUntil: "domcontentloaded" });
    const read = await page.locator("main").textContent();
    const rejected = await page.evaluate(() => fetch("/save", { method: "POST" }).then(() => false, () => true));
    if (read !== "read-only probe" || !rejected || blocked.method !== 1) throw new Error("read-only fixture failed");
    console.log(JSON.stringify({ ok: true, rendered: true, blocked }));
  } else if (login) {
    await page.goto(origin + "/statistics", { waitUntil: "domcontentloaded", timeout: 20000 });
    console.log("login_window_ready");
    await new Promise((resolve) => context.once("close", resolve));
  } else if (diagnostic) {
    const response = await page.goto(origin + "/statistics", { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForFunction(() => (document.body?.innerText?.length ?? 0) > 20, undefined, { timeout: 15000 });
    console.log(JSON.stringify({
      ok: true, http: response?.status(), siteMatches: new URL(page.url()).origin === origin,
      requiresLogin: await page.locator('input[type="password"]').count() > 0 || /login|sign-in|signin/i.test(new URL(page.url()).pathname),
      blocked,
    }));
  } else {
    const result = await readLivsynView(browserPage(page), view, Number(rawPage), Number(rawCount) || 1, rawDetails === "1");
    console.log(JSON.stringify({ ok: true, result }));
  }
} catch (error) {
  const code = ["LOGIN_REQUIRED", "PAGE_OUT_OF_RANGE"].includes(error?.code) ? error.code : "READ_UNAVAILABLE";
  console.log(JSON.stringify({ ok: false, code, blocked }));
  if (test || login || diagnostic) {
    console.error(String(error.message ?? error).split("\n").slice(0, 14).join("\n"));
    process.exitCode = 1;
  }
} finally {
  await context?.close().catch(() => {});
}
