// Bộ chạy test trình duyệt (Playwright) cho khu quản lý Đợt 1 — không dùng @playwright/test, chỉ thư viện `playwright`.
// Chạy trên máy chủ dev ĐÃ BẬT sẵn với DB dữ liệu giả (README "Cài và chạy dev"), ví dụ:
//   BCA_UI_BASE=http://localhost:3110 BCA_DATABASE_URL=postgresql://…/bca_gia_kt npm run test:ui
// Biến môi trường:
//   BCA_UI_BASE      địa chỉ máy chủ dev (mặc định http://localhost:3110)
//   BCA_DATABASE_URL DB mà máy chủ dev đang dùng — bộ chạy seed lại (seed-gia.ts) trước mỗi nhóm; tên DB phải chứa "gia" hoặc kết thúc "_test"
//   BCA_UI_KHONG_SEED=1 bỏ bước seed (khi tự seed tay)
//   BCA_UI_ANH       thư mục lưu ảnh chụp (mặc định thư mục tạm của hệ điều hành / bca-tests-ui) — KHÔNG commit ảnh
//   BCA_UI_CHI       biểu thức chính quy: chỉ chạy ca có tên khớp
//   PW_MODULE        đường dẫn module playwright (mặc định: tìm `playwright` cục bộ, rồi bản cài toàn cục)
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const BASE = (process.env.BCA_UI_BASE ?? "http://localhost:3110").replace(/\/$/, "");
export const ANH = process.env.BCA_UI_ANH ?? path.join(os.tmpdir(), "bca-tests-ui");
export const W = { dt: { width: 390, height: 844 }, mt: { width: 1280, height: 800 } };
const THU_MUC = path.dirname(fileURLToPath(import.meta.url));
const GOC_APP = path.resolve(THU_MUC, "..");

// ── Playwright: thử từng nơi cài, lấy bản khởi động được Chromium có sẵn trên máy (không tải trình duyệt) ──
let pw = null;
let trinhDuyet = null;
async function layPw() {
  if (pw) return pw;
  const req = createRequire(import.meta.url);
  const noi = [process.env.PW_MODULE, "playwright"];
  try { noi.push(path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright")); } catch {}
  const loi = [];
  for (const n of noi.filter(Boolean)) {
    try {
      const m = req(n);
      const b = await m.chromium.launch();
      pw = m;
      trinhDuyet = b;
      return pw;
    } catch (e) { loi.push(`${n}: ${String(e.message).split("\n")[0]}`); }
  }
  throw new Error(`Không khởi động được Chromium:\n${loi.join("\n")}`);
}

// ── Seed lại DB dữ liệu giả ──
export function seedLai() {
  if (process.env.BCA_UI_KHONG_SEED === "1") return;
  const url = process.env.BCA_DATABASE_URL ?? "";
  const ten = (() => { try { return new URL(url).pathname.slice(1); } catch { return ""; } })();
  if (!ten || ten === "bca" || !(/gia/.test(ten) || /_test$/.test(ten))) {
    throw new Error(`Từ chối seed: BCA_DATABASE_URL phải trỏ DB dữ liệu giả (tên chứa "gia" hoặc kết thúc "_test"), đang là "${ten || "(trống)"}"`);
  }
  execSync("npx tsx scripts/seed-gia.ts", { cwd: GOC_APP, env: { ...process.env, BCA_DATABASE_URL: url }, stdio: ["ignore", "ignore", "inherit"] });
}

// ── Đăng ký và chạy ca ──
const ca = [];
export function test(nhom, ten, fn) { ca.push({ nhom, ten, fn }); }

export class Loi extends Error {}
export function ok(dk, thongDiep) { if (!dk) throw new Loi(thongDiep); }
export function bang(a, b, thongDiep) { if (a !== b) throw new Loi(`${thongDiep}: nhận ${JSON.stringify(a)}, cần ${JSON.stringify(b)}`); }

/** Dòng trong tệp test nơi ca hỏng (khung đầu tiên trong tests-ui/*.mjs khác lib.mjs). */
function dongLoi(e) {
  const dong = String(e?.stack ?? "").split("\n").map((s) => s.match(/tests-ui\/([\w-]+\.mjs):(\d+)/)).find((m) => m && m[1] !== "lib.mjs");
  return dong ? `${dong[1]}:${dong[2]}` : "";
}

/** Ngữ cảnh một ca: mở trang theo vai, gom lỗi console, chụp ảnh, dọn dẹp. */
class Ca {
  constructor(ten) { this.ten = ten; this.ctxs = []; this.loiConsole = []; this.boQua = [/Download the React DevTools/]; }
  /** Bỏ qua một loại dòng lỗi console có chủ đích (vd. 403 khi cố ý gọi API bị chặn). */
  choPhepConsole(re) { this.boQua.push(re); }
  async trang(vai, kich = W.dt) {
    const p = await layPw();
    const ctx = await trinhDuyet.newContext({ viewport: kich, baseURL: BASE, locale: "vi-VN", timezoneId: "Asia/Ho_Chi_Minh" });
    this.ctxs.push(ctx);
    if (vai) {
      const r = await ctx.request.post(`${BASE}/api/dev/dang-nhap`, { data: { vai } });
      ok(r.ok(), `Đăng nhập thử vai ${vai} lỗi ${r.status()} — máy chủ dev có BCA_DEV_LOGIN=1 và DB có dấu DU_LIEU_GIA chưa?`);
    }
    const page = await ctx.newPage();
    page.setDefaultTimeout(10_000);
    page.on("console", (m) => { if (m.type() === "error") this.loiConsole.push(`[${vai ?? "khách"} ${kich.width}] ${m.text().slice(0, 300)}`); });
    page.on("pageerror", (e) => this.loiConsole.push(`[${vai ?? "khách"} ${kich.width}] pageerror: ${String(e.message).slice(0, 300)}`));
    void p;
    return { ctx, page };
  }
  /** Phiên gọi API riêng (không chung mạng với trình duyệt — dùng để kiểm máy chủ khi trình duyệt đang "mất mạng"). */
  async api(vai) {
    const p = await layPw();
    const r = await p.request.newContext({ baseURL: BASE });
    this.ctxs.push(r);
    if (vai) {
      const d = await r.post("/api/dev/dang-nhap", { data: { vai } });
      ok(d.ok(), `Đăng nhập API vai ${vai} lỗi ${d.status()}`);
    }
    return {
      get: async (u) => { const x = await r.get(u); return { status: x.status(), json: await x.json().catch(() => null) }; },
      gui: async (method, u, data) => { const x = await r.fetch(u, { method, data }); return { status: x.status(), json: await x.json().catch(() => null) }; },
    };
  }
  async chup(page, ten) {
    fs.mkdirSync(ANH, { recursive: true });
    const f = path.join(ANH, `${ten}.png`);
    await page.screenshot({ path: f, fullPage: true });
    return f;
  }
  async don() { for (const c of this.ctxs) await (c.dispose ? c.dispose() : c.close()).catch(() => {}); }
}

export async function chay(tenNhom) {
  const loc = process.env.BCA_UI_CHI ? new RegExp(process.env.BCA_UI_CHI, "i") : null;
  const ds = ca.filter((c) => !loc || loc.test(`${c.nhom} ${c.ten}`));
  const kq = [];
  if (ds.length) seedLai();
  for (const c of ds) {
    const t = new Ca(c.ten);
    const bd = Date.now();
    let loi = null;
    try {
      await c.fn(t);
      const con = t.loiConsole.filter((s) => !t.boQua.some((re) => re.test(s)));
      if (con.length) throw Object.assign(new Loi(`Lỗi console (${con.length}): ${con.slice(0, 3).join(" | ")}`), { stack: "" });
    } catch (e) {
      loi = e;
    } finally {
      await t.don();
    }
    const dong = { nhom: c.nhom, ten: c.ten, dat: !loi, giay: ((Date.now() - bd) / 1000).toFixed(1), loi: loi ? `${dongLoi(loi)} ${String(loi.message).split("\n")[0]}`.trim() : "" };
    kq.push(dong);
    console.log(`${dong.dat ? "ĐẠT" : "ĐỎ "} · ${c.nhom} · ${c.ten} (${dong.giay}s)${dong.loi ? `\n      ↳ ${dong.loi}` : ""}`);
  }
  if (trinhDuyet) await trinhDuyet.close();
  trinhDuyet = null;
  pw = null;
  const dat = kq.filter((x) => x.dat).length;
  console.log(`\n${tenNhom}: ${dat}/${kq.length} đạt`);
  const f = process.env.BCA_UI_KET_QUA;
  if (f) fs.appendFileSync(f, kq.map((x) => JSON.stringify(x)).join("\n") + (kq.length ? "\n" : ""));
  process.exitCode = dat === kq.length ? 0 : 1;
  return kq;
}

// ── Trợ giúp chung ──
export const boDau = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

/** Trang không có thanh cuộn ngang (cho lệch 1px làm tròn). */
export async function khongTranNgang(page, ten = "") {
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth, bw: document.body.scrollWidth }));
  ok(Math.max(r.sw, r.bw) <= r.w + 1, `Tràn ngang ${ten}: scrollWidth ${Math.max(r.sw, r.bw)} > ${r.w}`);
}

/** Chờ hết khung "đang tải" của Next (Suspense) và mạng yên. */
export async function moTrang(page, url) {
  const r = await page.goto(url, { waitUntil: "networkidle" });
  return r;
}

/** Danh sách buổi tháng (qua API chủ) → tra id theo môn + ngày. */
export async function bangBuoi(api, thang = "2026-11") {
  const r = await api.get(`/api/buoi-hoc?thang=${thang}`);
  ok(r.status === 200, `GET /api/buoi-hoc lỗi ${r.status}`);
  return (mon, ngay) => {
    const b = r.json.buoi.find((x) => x.mon.ma === mon && x.ngay === ngay);
    ok(b, `Không có buổi ${mon} ${ngay}`);
    return b;
  };
}

/** Gọi fetch NGAY TRONG TRANG (cookie của vai đang đăng nhập) — trả mã HTTP. */
export async function fetchTrongTrang(page, method, url, body) {
  return page.evaluate(async ([m, u, b]) => {
    const r = await fetch(u, { method: m, headers: { "content-type": "application/json" }, body: b === undefined ? undefined : JSON.stringify(b) });
    return r.status;
  }, [method, url, body]);
}

/** Màn điểm danh buổi quá 48 giờ: bấm "Mở sửa" + xác nhận (nếu có). */
export async function moSuaNeuCan(page) {
  const nut = page.getByRole("button", { name: "Mở sửa", exact: true });
  if (await nut.isVisible().catch(() => false)) {
    await nut.click();
    await page.getByRole("dialog").getByRole("button", { name: "Mở sửa cả buổi" }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
  }
}

export async function ngu(ms) { await new Promise((r) => setTimeout(r, ms)); }

/** Đợi tới khi fn() trả truthy (tối đa ms). */
export async function doi(fn, ms = 10_000, thongDiep = "hết giờ chờ") {
  const het = Date.now() + ms;
  let v;
  while (Date.now() < het) {
    v = await fn();
    if (v) return v;
    await ngu(250);
  }
  throw new Loi(thongDiep);
}
