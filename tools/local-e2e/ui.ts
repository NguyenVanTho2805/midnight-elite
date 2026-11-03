// Helper trình duyệt cho test UI (gitignored).
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { BASE, cookieFor, type TUser } from "./h";

let browser: Browser | null = null;
export const ADMIN = `http://admin.midnightelite-edu.com:${new URL(BASE).port || 3100}`; // middleware ép /admin sang host này (cổng theo BASE)
export async function launch() {
  // CHROMIUM_PATH: đường dẫn trình duyệt Chromium/Chrome. Mặc định là bản Playwright trong hộp cát Linux; trên máy Mac đặt
  // CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" (xem env.example.sh).
  const executablePath = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
  browser = await chromium.launch({ headless: true, executablePath, args: ["--no-sandbox", "--no-proxy-server", "--host-resolver-rules=MAP admin.midnightelite-edu.com 127.0.0.1, MAP midnightelite-edu.com 127.0.0.1, MAP localhost 127.0.0.1"] });
  return browser;
}
/** Trạng thái thanh bên đặt sẵn cho ngữ cảnh: "mo" (hẹp 79px), "rong" (272px), "thu", hoặc "mac-dinh" = KHÔNG đặt gì (đúng như người dùng mới: sản phẩm mặc định thanh RỘNG). */
export type TestRail = "mo" | "rong" | "thu" | "mac-dinh";
export async function ctxFor(u: TUser | null, o: { width?: number; height?: number; rail?: TestRail } = {}): Promise<BrowserContext> {
  const ctx = await browser!.newContext({ viewport: { width: o.width ?? 1280, height: o.height ?? 900 }, locale: "vi-VN" });
  // 25/10/2026: mặc định của sản phẩm nay là thanh bên RỘNG 272px có nhóm (Figma "Nền móng"). Phần lớn bài ui-* viết cho thanh HẸP 79px (nút "Khác", đo x=79…), nên
  // ở đây mặc định vẫn đặt sẵn "mo" để chúng giữ nguyên ý nghĩa; bài nào kiểm thanh rộng / mặc định thì truyền rail: "mac-dinh" (hoặc "rong").
  // Chỉ đặt khi máy chưa lưu gì: bài nào tự thu / mở rồi tải lại vẫn thấy lựa chọn của chính nó.
  const rail = o.rail ?? "mo";
  if (rail !== "mac-dinh") await ctx.addInitScript(`try{if(localStorage.getItem("kin.thanh-ben")===null)localStorage.setItem("kin.thanh-ben",${JSON.stringify(rail)})}catch(e){}`);
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
/**
 * GET tới tên miền admin KHÔNG phụ thuộc /etc/hosts (APIRequestContext của Playwright phân giải bằng DNS của Node, không dùng --host-resolver-rules của Chrome):
 * nối 127.0.0.1:<cổng> và đặt header Host. Không đi theo chuyển hướng (như maxRedirects: 0). Cookie lấy từ ngữ cảnh của trang. Trả về giao diện giống APIResponse (status/headers/text/json).
 */
export async function adminGet(page: Page, url: string) {
  const u = new URL(url);
  const cookie = (await page.context().cookies(url)).map(c => `${c.name}=${c.value}`).join("; ");
  const http = await import("node:http");
  return new Promise<{ status(): number; headers(): Record<string, string>; text(): Promise<string>; json(): Promise<any> }>((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port: Number(u.port || 80), path: u.pathname + u.search, method: "GET", headers: { host: u.host, ...(cookie ? { cookie } : {}) } }, res => {
      const chunks: Buffer[] = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => { const body = Buffer.concat(chunks).toString("utf8"); resolve({ status: () => res.statusCode ?? 0, headers: () => Object.fromEntries(Object.entries(res.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : String(v ?? "")])), text: async () => body, json: async () => JSON.parse(body) }); });
    });
    req.setTimeout(60000, () => req.destroy(new Error("adminGet timeout " + url)));
    req.on("error", reject); req.end();
  });
}
export async function closeAll() { await browser?.close(); }
export type { Page };
