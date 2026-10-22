// Helper trình duyệt cho test UI (gitignored).
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { BASE, cookieFor, type TUser } from "./h";

let browser: Browser | null = null;
export const ADMIN = "http://admin.midnightelite-edu.com:3100"; // middleware ép /admin sang host này
export async function launch() {
  // CHROMIUM_PATH: đường dẫn trình duyệt Chromium/Chrome. Mặc định là bản Playwright trong hộp cát Linux; trên máy Mac đặt
  // CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" (xem env.example.sh).
  const executablePath = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
  browser = await chromium.launch({ headless: true, executablePath, args: ["--no-sandbox", "--no-proxy-server", "--host-resolver-rules=MAP admin.midnightelite-edu.com 127.0.0.1, MAP midnightelite-edu.com 127.0.0.1, MAP localhost 127.0.0.1"] });
  return browser;
}
export async function ctxFor(u: TUser | null, o: { width?: number; height?: number } = {}): Promise<BrowserContext> {
  const ctx = await browser!.newContext({ viewport: { width: o.width ?? 1280, height: o.height ?? 900 }, locale: "vi-VN" });
  if (u) {
    const [name, ...rest] = (await cookieFor(u)).split("=");
    const value = rest.join("=");
    await ctx.addCookies([{ name, value, url: BASE }, { name, value, url: ADMIN }]);
  }
  return ctx;
}
export async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${process.env.SHOTS ?? "scratchpad/shots"}/${name}.png`, fullPage: true });
}
export async function closeAll() { await browser?.close(); }
export type { Page };
