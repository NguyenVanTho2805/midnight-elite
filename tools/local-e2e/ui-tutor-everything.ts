// Rà soát TOÀN BỘ vai GIA SƯ bằng trình duyệt thật (15/10/2026, Thọ: "kiểm tra toàn bộ role gia sư xem có lỗi hay button đến sai địa chỉ").
//
// Gia sư ở tên miền chính (midnightelite-edu.com): vỏ gia sư (/lop-cua-toi/*), các trang quản lớp / đề thi dùng chung (/admin/khoa-hoc, /admin/thi-thu…) chạy ngay
// trong vỏ gia sư, và các trang công khai (/thu-vien, /khoa-hoc, /giang-vien, /mentor/…) cũng hiện trong vỏ gia sư.
//
// Ba lớp kiểm tra, trên một "thế giới gia sư" đủ dữ liệu (tools/local-e2e/tutor-world.ts):
//   A. LIÊN KẾT: duyệt từ mọi trang xuất phát, mở thật từng đích của mọi <a href> (kể cả trong menu "Khác" và menu tài khoản) → không 404 / không bị đẩy về đăng nhập /
//      không đổi sang đích khác đường dẫn (trừ chuyển hướng có chủ đích).
//   B. NÚT: với mỗi kiểu trang, bấm thử từng nút / tab / mục menu (bỏ nút huỷ-xoá-gửi-lưu…) rồi ghi nó làm gì: đổi trang, mở tab mới, mở hộp thoại hay không điều hướng.
//      Bắt cả nút điều hướng bằng router.push (không phải <a>), thứ mà bài kiểm liên kết không thấy.
//   C. LỖI: suốt cả hai phần trên, gom lỗi JS chưa bắt (pageerror), console.error của chính ứng dụng và mọi phản hồi HTTP ≥ 400 cùng nguồn gốc.
// Báo cáo đầy đủ (mọi "nhãn → đích") ghi ra scratchpad/tutor-report.txt để đọc bằng mắt: đích có thể đúng đường dẫn nhưng sai ý nghĩa nhãn.
import { writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { launch, closeAll } from "./ui";
import { wipe, check, section, done, cookieFor } from "./h";
import { seedTutorWorld, OTHER } from "./tutor-world";
import { prisma } from "@/lib/prisma";
import type { BrowserContext, Page } from "playwright";

const PORT = Number(process.env.PORT ?? 3100);
const MAIN = `http://midnightelite-edu.com:${PORT}`;
const MAIN_ORIGIN = new URL(MAIN).origin;
const REPORT = process.env.TUTOR_REPORT ?? "scratchpad/tutor-report.txt";
const MAX_PAGES = Number(process.env.MAX_PAGES ?? 160);   // trần số đích khác nhau được mở ở phần A
const MAX_BTN = Number(process.env.MAX_BTN ?? 28);        // trần số nút được bấm thử trên mỗi kiểu trang ở phần B
const MAX_PER_PATTERN = 4;
const COMPACT = process.env.TUTOR_MODULES === "compact";     // chế độ gọn TƯỜNG MINH (gia sư tự tắt hết: `modules: []`): thanh chỉ có Lịch + Học phí, cửa vào là Lịch. Mặc định của mã (BU-00) là đủ module.
const EMPTY = process.env.TUTOR_WORLD === "empty";           // gia sư MỚI TINH chưa có lớp nào: trang trống + nút hướng dẫn
const [VW, VH] = (process.env.VIEWPORT ?? "1280x900").split("x").map(Number); // VIEWPORT=390x844 để rà bản điện thoại (thanh module dưới đáy)

const isId = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(s) || /^c[a-z0-9]{20,}$/i.test(s) || /^\d{3,}$/.test(s) || /^(lop|u|kh|exam|les|sec|chap)-[a-z0-9-]{6,}$/i.test(s) || (/^[a-z0-9_-]{16,}$/i.test(s) && /\d/.test(s));
const pattern = (u: URL) => u.pathname.split("/").map(s => (s && isId(s) ? ":id" : s)).join("/");
const norm = (p: string) => (p.length > 1 ? p.replace(/\/+$/, "") : p);
const abs = (u: URL) => `${u.protocol}//${u.host}${u.pathname}${u.search}`;
const PROTECTED = [/^\/student(\/|$)/, /^\/lop-cua-toi(\/|$)/, /^\/admin(\/|$)/, /^\/cai-dat(\/|$)/];

// ── C. gom lỗi ─────────────────────────────────────────────────────────────────────────────────────────────────
type Issue = { at: string; kind: string; msg: string };
const issues: Issue[] = [];
let at = "";
function watch(p: Page) {
  p.on("pageerror", e => issues.push({ at, kind: "lỗi JS", msg: String(e).replace(/\s+/g, " ").slice(0, 260) }));
  p.on("console", m => {
    if (m.type() !== "error") return;
    const loc = m.location().url ?? "";
    if (loc && !loc.startsWith(MAIN_ORIGIN)) return;                 // tài nguyên ngoài bị chặn mạng (phông Google, ảnh VietQR…)
    const t = m.text();
    if (/^Failed to load resource/i.test(t)) return;                  // đã được ghi bằng bộ nghe phản hồi bên dưới
    if (/favicon|Download the React DevTools/i.test(t)) return;
    issues.push({ at, kind: "console.error", msg: t.replace(/\s+/g, " ").slice(0, 260) });
  });
  p.on("response", r => {
    let u: URL; try { u = new URL(r.url()); } catch { return; }
    if (u.origin !== MAIN_ORIGIN || r.status() < 400) return;
    if (u.pathname.startsWith("/_next/") || /favicon/.test(u.pathname)) return;
    issues.push({ at, kind: `HTTP ${r.status()}`, msg: `${r.request().method()} ${u.pathname}${u.search}` });
  });
}

async function settle(p: Page) {
  await p.waitForLoadState("domcontentloaded").catch(() => {});
  await p.waitForLoadState("networkidle", { timeout: 7000 }).catch(() => {});
  let last = p.url(), still = 0;
  for (let i = 0; i < 24 && still < 4; i++) {
    await p.waitForTimeout(180);
    const now = p.url();
    if (now === last) still++; else { last = now; still = 0; await p.waitForLoadState("networkidle", { timeout: 4000 }).catch(() => {}); }
  }
}

// Vỏ đang hiện: aria-label của thanh module ("Module của gia sư" / "Module của học sinh" / "Module quản trị"); rỗng nếu trang không có vỏ.
const SHELL_OF = `(document.querySelector('nav[aria-label^="Module"]') || {getAttribute: () => ''}).getAttribute('aria-label') || ''`;
async function open(p: Page, url: string): Promise<{ status: number | null; final: URL; text: string; shell: string }> {
  at = url;
  const resp = await p.goto(url, { waitUntil: "domcontentloaded", timeout: 70000 }).catch(() => null);
  const status = resp ? resp.status() : null;
  await settle(p);
  const text = await p.evaluate(`document.body ? document.body.innerText.slice(0, 6000) : ''`).catch(() => "") as string;
  const shell = await p.evaluate(SHELL_OF).catch(() => "") as string;
  return { status, final: new URL(p.url()), text, shell };
}

const NOT_FOUND = /Trang không tồn tại|This page could not be found|Đường dẫn bạn truy cập không tồn tại/i;
const APP_ERROR = /Application error|Something went wrong|Đã xảy ra lỗi|Lỗi server|Không tải được/i;

// ── A. liên kết ────────────────────────────────────────────────────────────────────────────────────────────────
const COLLECT = `(() => {
  const out = [];
  for (const a of document.querySelectorAll('a[href]')) {
    if (a.closest('[data-feedback-toolbar],[data-annotation-popup],[data-annotation-marker]')) continue;
    const raw = a.getAttribute('href') || '';
    if (!raw || raw.startsWith('#') || raw.startsWith('javascript:')) continue;
    const reg = a.closest('header,footer,nav,aside,[role=dialog],[role=menu],main');
    const region = reg ? reg.tagName.toLowerCase() + (reg.getAttribute('aria-label') ? '[' + reg.getAttribute('aria-label') + ']' : '') : 'body';
    out.push({ href: a.href, text: (a.getAttribute('aria-label') || a.innerText || a.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 70), region, blank: a.target === '_blank', download: a.hasAttribute('download') });
  }
  return out;
})()`;
type Rec = { from: string; href: string; text: string; region: string; blank: boolean };

async function collect(p: Page, from: string, openMenus: boolean): Promise<Rec[]> {
  const grab = async () => (await p.evaluate(COLLECT) as { href: string; text: string; region: string; blank: boolean; download: boolean }[]).filter(l => !l.download).map(l => ({ from, href: l.href, text: l.text, region: l.region, blank: l.blank }));
  const all: Rec[] = await grab();
  if (openMenus) {
    const SEL = 'header button[aria-expanded="false"], aside button[aria-expanded="false"], nav button[aria-expanded="false"], button[aria-haspopup]';
    const n = await p.locator(SEL).count().catch(() => 0);
    for (let i = 0; i < Math.min(n, 12); i++) {
      const b = p.locator(SEL).nth(i);
      const label = ((await b.getAttribute("aria-label").catch(() => "")) ?? "") + " " + ((await b.textContent().catch(() => "")) ?? "");
      if (/xóa|xoá|đăng xuất|logout|delete|gửi|submit/i.test(label)) continue;
      if (!(await b.isVisible().catch(() => false))) continue;
      await b.click({ timeout: 1500 }).catch(() => {});
      await p.waitForTimeout(250);
      all.push(...(await grab()));
      await p.keyboard.press("Escape").catch(() => {});
      await p.waitForTimeout(100);
    }
  }
  return all;
}

// Chuyển hướng CÓ CHỦ ĐÍCH cho gia sư: trang chủ / đăng nhập / đăng ký → Hộp việc; /admin (bảng tổng quan quản trị) → Hộp việc.
const HOME = COMPACT ? "/lop-cua-toi/lich" : "/lop-cua-toi";   // trang đầu của gia sư sau đăng nhập
const STUDENT_ALIASES: Record<string, string> = { "/admin/khoa-hoc/tao-moi": "/admin/khoa-hoc", "/admin/thi-thu/tao-moi": "/admin/thi-thu", "/student/thi-thu": "/thi-thu", "/student/bang-xep-hang": "/bang-xep-hang", "/student/cong-dong": "/cong-dong", "/student/hoi-dap": "/cong-dong", "/student/tin-tuc": "/tin-tuc", "/student/tra-cuu": "/tra-cuu" };
function expected(reqPath: string, finPath: string): boolean {
  if (STUDENT_ALIASES[reqPath] === finPath) return true;
  if (["/", "/dang-nhap", "/dang-ky", "/admin"].includes(reqPath)) return finPath === HOME;
  if (COMPACT && reqPath === "/lop-cua-toi") return finPath === HOME;            // Hộp việc đã tắt (modules: []) → màn đầu là Lịch (TT-203)
  return false;
}
function judge(requested: URL, r: { status: number | null; final: URL; text: string }): string | null {
  if (r.status !== null && r.status >= 400) return `HTTP ${r.status}`;
  if (NOT_FOUND.test(r.text)) return "giao diện 404";
  if (APP_ERROR.test(r.text)) return "trang báo lỗi";
  const reqP = norm(requested.pathname), finP = norm(r.final.pathname);
  if (r.final.origin !== requested.origin) return `sang tên miền khác: ${r.final.host}${finP}`;
  if (finP === "/dang-nhap" && reqP !== "/dang-nhap") return "bị đẩy về trang đăng nhập dù đã đăng nhập";
  if (reqP !== finP) return expected(reqP, finP) ? null : `đổi đích: ${reqP} → ${finP}`;
  return null;
}

// ── B. nút ─────────────────────────────────────────────────────────────────────────────────────────────────────
const BTN_SEL = 'button, [role="button"], [role="tab"], [role="menuitem"], summary';
// Mỗi nút đủ điều kiện được gắn data-audit-i = số thứ tự rồi bấm theo thẻ ấy (không dùng chỉ số trong danh sách: bộ chọn của Playwright còn xuyên vào shadow DOM
// của thanh công cụ dev nên chỉ số lệch và bấm nhầm / hết giờ).
const CANDIDATES = `(() => {
  const SKIP = '[data-feedback-toolbar],[data-annotation-popup],[data-annotation-marker]';
  const out = [];
  const seen = {};
  let n = 0;
  document.querySelectorAll('[data-audit-i]').forEach(e => e.removeAttribute('data-audit-i'));
  [...document.querySelectorAll(${JSON.stringify(BTN_SEL)})].forEach(el => {
    if (el.closest(SKIP)) return;
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') return;
    const r = el.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) return;
    const st = getComputedStyle(el);
    if (st.visibility === 'hidden' || st.display === 'none') return;
    const own = (el.getAttribute('aria-label') || el.innerText || el.textContent || '').replace(/\\s+/g, ' ').trim();
    const title = (el.getAttribute('title') || '').trim();
    const named = !!(own || title || el.getAttribute('aria-labelledby') || (el.querySelector('img[alt]') || {}).alt);
    // nhãn hiển thị trong báo cáo: chữ trên nút (+ gợi ý title); nút chỉ có biểu tượng thì ghi rõ "không tên" kèm lớp CSS để tìm ra trong mã
    const text = (own ? own + (title && title !== own ? ' (' + title + ')' : '') : title || '⟨không tên ' + (typeof el.className === 'string' ? el.className.split(' ').filter(Boolean).slice(0, 2).join('.') : '') + '⟩').slice(0, 70);
    el.setAttribute('data-audit-i', String(n));
    seen[text] = (seen[text] || 0) + 1;
    out.push({ idx: n, occ: seen[text], text, named, type: el.getAttribute('type') || '', role: el.getAttribute('role') || '', expanded: el.getAttribute('aria-expanded') });
    n++;
  });
  return out;
})()`;
// Khi một nút không bấm được: nó nằm ở đâu và CÁI GÌ đang đè lên giữa nút (phân biệt lỗi thật "nút bị che" với lỗi công cụ).
const DIAG = (idx: number) => `(() => {
  const el = document.querySelector('[data-audit-i="${idx}"]'); if (!el) return 'thẻ không còn';
  const r = el.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  const inView = r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth;
  const who = top && top !== el && !el.contains(top) ? top.tagName.toLowerCase() + (typeof top.className === 'string' && top.className ? '.' + top.className.split(' ').filter(Boolean).slice(0, 3).join('.') : '') + ' «' + (top.innerText || '').replace(/\\s+/g, ' ').slice(0, 30) + '»' : 'không bị che';
  return 'vị trí ' + Math.round(r.left) + ',' + Math.round(r.top) + ' cỡ ' + Math.round(r.width) + 'x' + Math.round(r.height) + ', trong khung nhìn=' + inView + ', ở trên cùng giữa nút: ' + who;
})()`;
// Nút KHÔNG bấm thử: phá dữ liệu / gửi đi / đăng xuất / tải về / lưu (không điều hướng, chỉ làm bẩn dữ liệu thử). Các nút "Tạo…", "Thêm…" vẫn bấm vì thường dẫn tới trang mới.
const SKIP_BTN = /thu gọn thanh bên|mở rộng thanh bên|mở thanh bên|bỏ qua|xóa|xoá|delete|đăng xuất|logout|huỷ|hủy|từ chối|khoá|khóa|gỡ|đóng lớp|mở lớp|thanh toán|gạch|đối soát|gửi|duyệt|áp dụng|reset|lưu|cập nhật|sao chép|copy|tải|xuất|in phiếu|nhắc|thu hồi/i;

type Click = { page: string; label: string; kind: "đổi trang" | "tab mới" | "hộp thoại" | "không điều hướng" | "không bấm được"; dest?: string; why?: string | null; issuesAfter: number };
type Cand = { idx: number; occ: number; text: string; named: boolean; type: string; role: string; expanded: string | null };
const sig = (cs: Cand[]) => cs.map(x => x.text).join("\u0001");
const lastLog = (e: unknown) => String((e as Error)?.message ?? e).replace(/\u001b\[[0-9;]*m/g, "").split("\n").map(x => x.trim()).filter(Boolean).slice(-3).join(" | ").slice(0, 260);
const unnamed = new Map<string, number>();   // trang -> số nút không có tên truy cập được (trình đọc màn hình đọc "nút")

// Mỗi nút được thử trong trạng thái trang "sạch": sau lần bấm làm đổi hình dạng trang (mở ngăn kéo, đổi tuần, xoá một dòng…) thì nạp lại trang rồi mới bấm nút kế,
// nếu không thẻ gắn sẵn bị cũ và nút sau bị coi nhầm là "không bấm được" (lần chạy 4: 19 trường hợp, phần lớn do cách này).
async function clickAudit(ctx: BrowserContext, p: Page, url: string, out: Click[]) {
  const load = async () => { await open(p, url); return await p.evaluate(CANDIDATES) as Cand[]; };
  let cands = await load();
  const todo = cands.filter(c => c.type !== "submit" && !SKIP_BTN.test(c.text)).slice(0, MAX_BTN);
  const bad = cands.filter(c => !c.named).length;
  if (bad) unnamed.set(url, bad);
  let fresh = true;
  for (const c of todo) {
    let now = cands.find(x => x.text === c.text && x.occ === c.occ);
    if (!now && !fresh) { cands = await load(); fresh = true; now = cands.find(x => x.text === c.text && x.occ === c.occ); }
    if (!now) continue;                                                     // nút này không còn ở trạng thái sạch (vd. chỉ hiện sau khi dữ liệu đổi) → bỏ
    const before = p.url(), nIssues = issues.length, sigBefore = sig(cands);
    const popupP = ctx.waitForEvent("page", { timeout: 1500 }).catch(() => null);
    let err: string | null = null;
    await p.locator(`[data-audit-i="${now.idx}"]`).first().click({ timeout: 3000 }).catch(e => { err = lastLog(e); });
    const popup = await popupP;
    await p.waitForTimeout(550);
    if (err && !popup) {
      const diag = await p.evaluate(DIAG(now.idx)).catch(() => "?") as string;
      out.push({ page: url, label: c.text, kind: "không bấm được", why: `${err} || ${diag}`, issuesAfter: issues.length - nIssues });
      cands = await load(); fresh = true; continue;
    }
    if (popup) {
      await popup.waitForLoadState("domcontentloaded", { timeout: 2500 }).catch(() => {});
      out.push({ page: url, label: c.text, kind: "tab mới", dest: popup.url(), issuesAfter: issues.length - nIssues });
      await popup.close().catch(() => {});
      cands = await load(); fresh = true; continue;
    }
    if (p.url() !== before) {
      await settle(p);
      const fin = new URL(p.url());
      const text = await p.evaluate(`document.body ? document.body.innerText.slice(0, 6000) : ''`).catch(() => "") as string;
      const why = judge(fin, { status: null, final: fin, text });
      out.push({ page: url, label: c.text, kind: "đổi trang", dest: abs(fin), why, issuesAfter: issues.length - nIssues });
      cands = await load(); fresh = true; continue;
    }
    const dlg = await p.locator('[role="dialog"], [role="alertdialog"]').first().isVisible().catch(() => false);
    out.push({ page: url, label: c.text, kind: dlg ? "hộp thoại" : "không điều hướng", issuesAfter: issues.length - nIssues });
    await p.keyboard.press("Escape").catch(() => {});                     // đóng menu / hộp thoại / ngăn kéo vừa mở
    await p.waitForTimeout(200);
    cands = await p.evaluate(CANDIDATES) as Cand[];                        // gắn lại thẻ trên DOM hiện tại
    const stillDlg = await p.locator('[role="dialog"], [role="alertdialog"]').first().isVisible().catch(() => false);
    if (dlg && stillDlg || sig(cands) !== sigBefore) { cands = await load(); fresh = true; } else fresh = false;
  }
}

(async () => {
  mkdirSync("scratchpad", { recursive: true });
  await wipe();
  const w = await seedTutorWorld({ empty: EMPTY, compact: COMPACT });
  const full = w.empty ? null : w;
  const T = w.T;
  console.log(`  thế giới thử: ${EMPTY ? "gia sư mới tinh (chưa có lớp)" : "gia sư có dữ liệu đầy đủ"}; module: ${COMPACT ? "chế độ gọn tường minh modules: [] (Lịch + Học phí)" : "bật đủ 4 module (cũng là mặc định BU-00)"}; khung nhìn ${VW}x${VH}`);
  const browser = await launch();
  // x-forwarded-proto: Vercel luôn đặt; không có thì trang /mentor/[id] (tự gọi lại API của chính nó theo https) hỏng ở `next dev` chạy http.
  const ctx: BrowserContext = await browser.newContext({ viewport: { width: VW, height: VH }, locale: "vi-VN", extraHTTPHeaders: { "x-forwarded-proto": "http" } });
  // Thanh công cụ góp ý `agentation` chỉ có ở `next dev` (AgentationWrapper trả null ngoài development) nhưng nằm đè góc phải-dưới: ở khung điện thoại nó che nút «Khác»
  // của thanh module dưới đáy và mọi lần bấm bị chặn. Ẩn nó đi để bài rà đo đúng giao diện người dùng thật thấy.
  // (script khởi tạo chạy trước cả khi có <html>: phải đợi DOMContentLoaded mới gắn được thẻ <style>, nếu không báo "Cannot read properties of null (reading 'appendChild')" ở mọi trang)
  await ctx.addInitScript(`(() => { const add = () => { const css = document.createElement("style"); css.textContent = "[data-agentation-root]{display:none !important}"; (document.head || document.documentElement).appendChild(css); }; if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", add); else add(); })()`);
  const externalNavs: { from: string; url: string }[] = [];
  await ctx.route(u => u.origin !== MAIN_ORIGIN && /^https?:$/.test(u.protocol), route => {
    const r = route.request();
    if (!r.isNavigationRequest()) return route.continue();
    externalNavs.push({ from: at, url: r.url() });
    return route.fulfill({ status: 200, contentType: "text/html", body: "<title>trang ngoài (đã chặn lúc thử)</title>" });
  });
  const [cookieName, ...cookieRest] = (await cookieFor(T)).split("=");
  await ctx.addCookies([{ name: cookieName, value: cookieRest.join("="), url: MAIN }]);   // gia sư chỉ có phiên ở tên miền chính, như thật
  const p = await ctx.newPage();
  // Trình soạn kế hoạch buổi có hộp "rời trang?" (beforeunload) khi đang sửa dở: nếu BỎ nó thì mọi lần goto sau đó bị huỷ và cả bài rà cứ ở lại trang soạn
  // (lần chạy 3 bấm nhầm «Soạn / Bản gia sư / Phiếu học sinh» trên 40 trang) → phải CHẤP NHẬN hộp rời trang, còn các hộp khác thì bỏ.
  p.on("dialog", d => { void (d.type() === "beforeunload" ? d.accept() : d.dismiss()); });
  watch(p);

  const course1 = full?.c1.id, course2 = full?.c2.id;
  const seeds = [
    "/lop-cua-toi", "/lop-cua-toi/tong-quan", "/lop-cua-toi/lich", "/lop-cua-toi/lop", "/lop-cua-toi/hoc-phi", "/lop-cua-toi/doanh-thu", "/lop-cua-toi/bao-cao-thang",
    "/lop-cua-toi/ke-hoach-buoi", ...(full?.planId ? [`/lop-cua-toi/ke-hoach-buoi/${full.planId}`] : []), "/lop-cua-toi/kiem-duyet", "/lop-cua-toi/ho-so", "/lop-cua-toi/bai-dang", "/lop-cua-toi/cai-dat",
    ...(full ? [`/lop-cua-toi/${course1}`, `/lop-cua-toi/${course2}`] : []),
    "/admin/khoa-hoc", "/admin/khoa-hoc/tao-moi", ...(full ? [`/admin/khoa-hoc/${course1}`, ...["chuong-bai", "lich-hoc", "hoc-vien"].map(t => `/admin/khoa-hoc/${course1}?tab=${t}`)] : []), "/admin/khoa-hoc/danh-muc",
    "/admin/thi-thu", "/admin/thi-thu/tao-moi", ...(full ? [`/admin/thi-thu/${full.examId}`] : []), "/admin/thi-thu/ngan-hang-cau-hoi", "/admin/thi-thu/ngan-hang-de-thi",
    "/thu-vien", "/khoa-hoc", ...(full ? [`/khoa-hoc/${course1}`] : []), "/giang-vien", `/mentor/${T.id}`, "/thi-thu", "/cong-dong", "/tin-tuc", "/diem-chuan", "/bang-xep-hang", "/cai-dat/chu-de", "/",
  ].map(s => MAIN + s);

  // ── A. liên kết ──
  section("A. Liên kết: mở thật từng đích của mọi <a> trong vỏ gia sư");
  const seen = new Set<string>(), perPattern = new Map<string, number>();
  const queue = seeds.map(url => ({ url, menus: true }));
  const pageLinks = new Map<string, Rec[]>();
  const visited: { requested: string; final: string; why: string | null; shell: string }[] = [];
  const external = new Map<string, string>();
  let opened = 0;
  while (queue.length && opened < MAX_PAGES) {
    const { url, menus } = queue.shift()!;
    const u = new URL(url); u.hash = "";
    const key = abs(u);
    if (seen.has(key)) continue;
    const pat = u.origin + pattern(u);
    if ((perPattern.get(pat) ?? 0) >= MAX_PER_PATTERN) continue;
    perPattern.set(pat, (perPattern.get(pat) ?? 0) + 1);
    seen.add(key); opened++;
    const r = await open(p, key);
    const why = judge(u, r);
    visited.push({ requested: key, final: abs(r.final), why, shell: r.shell });
    if (r.final.origin !== MAIN_ORIGIN || r.final.pathname.startsWith("/api")) continue;
    const links = await collect(p, abs(r.final), menus).catch(() => [] as Rec[]);
    if (!pageLinks.has(abs(r.final))) pageLinks.set(abs(r.final), links);
    for (const l of links) {
      let lu: URL; try { lu = new URL(l.href); } catch { continue; }
      if (!/^https?:$/.test(lu.protocol)) { external.set(l.href, l.text); continue; }
      if (lu.origin !== MAIN_ORIGIN) { if (!/agentation\./.test(lu.host)) external.set(l.href, l.text); continue; }
      if (lu.pathname.startsWith("/api") || /\.(pdf|csv|xlsx?|docx?|zip|png|jpe?g|svg|webp|mp4)$/i.test(lu.pathname)) { external.set(l.href, l.text + " [tệp/API]"); continue; }
      lu.hash = "";
      queue.push({ url: abs(lu), menus: false });
    }
  }
  if (queue.length) console.log(`  (còn ${queue.length} đích chưa mở do trần ${MAX_PAGES})`);
  const badLinks = visited.filter(v => v.why);
  console.log(`  đã mở ${visited.length} đích khác nhau, ${badLinks.length} sai`);
  for (const b of badLinks.slice(0, 40)) console.log(`   ✗ ${new URL(b.requested).pathname}${new URL(b.requested).search} → ${b.final.replace(MAIN, "")}  (${b.why})`);
  check("mọi liên kết trong vỏ gia sư mở ra đúng mục (không 404 / không về đăng nhập / không sai đích)", badLinks.length === 0, badLinks.slice(0, 6));

  // ── Vỏ: gia sư luôn thấy vỏ GIA SƯ (trừ khu học viên /student/* mà họ chủ động vào xem thử) ──
  section("Vỏ: gia sư không bao giờ bị đưa vào khung học viên / quản trị ngoài khu học viên");
  const wrongShell = visited.filter(v => v.shell && v.shell !== "Module của gia sư" && !new URL(v.final).pathname.startsWith("/student"));
  for (const w2 of wrongShell.slice(0, 20)) console.log(`   ✗ ${new URL(w2.final).pathname} hiện khung "${w2.shell}"`);
  check("mọi trang ngoài /student/* đều dùng khung GIA SƯ", wrongShell.length === 0, wrongShell.slice(0, 5).map(w2 => [new URL(w2.final).pathname, w2.shell]));
  // 16/10/2026: bản đầu của bài rà này chỉ bắt khung SAI, không bắt "không có khung nào" — nên trang lớp /lop-cua-toi/[lớp] (trần, không thanh module, không dải trên) lọt qua.
  // Bài rà vai học sinh (ui-role-everything) kiểm cả hai chiều và bắt được; nay kiểm cả hai chiều ở đây.
  const NO_SHELL_OK = /^\/(dang-nhap|dang-ky|quen-mat-khau|dat-lai-mat-khau|xac-thuc-email|xac-nhan-phu-huynh|phieu|so-cua-con|xem-tai-lieu)(\/|$)/;   // trang xác thực / trang phụ huynh mở bằng link
  const bareShell = visited.filter(v => !v.why && new URL(v.final).origin === MAIN_ORIGIN && !v.shell && !NO_SHELL_OK.test(new URL(v.final).pathname));
  for (const w2 of bareShell.slice(0, 20)) console.log(`   ✗ ${new URL(w2.final).pathname} KHÔNG có khung gia sư (trang trần)`);
  check("mọi trang của gia sư (kể cả trang công khai, trang lớp) nằm trong khung GIA SƯ — không trang nào hiện trần", bareShell.length === 0, bareShell.slice(0, 5).map(w2 => new URL(w2.final).pathname));
  const shellSeen = new Set(visited.map(v => v.shell));
  check("đã thực sự nhìn thấy khung gia sư ở nhiều trang (bài rà không rỗng)", visited.filter(v => v.shell === "Module của gia sư").length >= 20, [...shellSeen]);

  // ── Quyền: gia sư mở trang chỉ dành cho quản trị thì được đưa về Hộp việc, không trang trắng / lỗi ──
  section("Quyền: trang chỉ dành cho quản trị → gia sư về Hộp việc (không trắng, không lỗi)");
  const issuesBeforePerm = issues.length;
  for (const path of ["/admin", "/admin/doanh-thu", "/admin/hoc-sinh", "/admin/quan-tri-vien", "/admin/tin-tuc", "/admin/vinh-danh", "/admin/pheu", "/admin/diem-chuan"]) {
    const r = await open(p, MAIN + path);
    check(`gia sư mở ${path} → về ${HOME}`, r.final.origin === MAIN_ORIGIN && norm(r.final.pathname) === HOME, abs(r.final));
  }
  // /admin/kiem-duyet là hàng chờ gộp THEO QUYỀN (src/lib/adminQueueServer.ts): gia sư được vào, chỉ thấy báo cáo bài viết trong lớp của mình, KHÔNG thấy hồ sơ gia sư xin duyệt.
  {
    const r = await open(p, MAIN + "/admin/kiem-duyet");
    check("gia sư mở /admin/kiem-duyet → vào được, khung gia sư, không thấy đơn xin làm gia sư của người khác", r.final.pathname === "/admin/kiem-duyet" && r.shell === "Module của gia sư" && !r.text.includes(OTHER.applicant), { url: abs(r.final), shell: r.shell });
    check("hàng chờ trống của gia sư nói về báo cáo trong lớp của họ (không hứa hồ sơ gia sư xin duyệt)", EMPTY && VW >= 900 ? /Báo cáo bài viết trong lớp của bạn/.test(r.text) && !/Hồ sơ gia sư xin duyệt/.test(r.text) : true, r.text.slice(0, 300));   // khung đọc (bên phải) chỉ có ở màn rộng
  }
  // Mở trang cấm làm trang gọi API trước khi PermissionGuard kịp đẩy đi → 403 là KỲ VỌNG, không tính vào mục C.
  const expected403 = issues.splice(issuesBeforePerm).filter(i => i.kind === "HTTP 403");
  console.log(`  ℹ ${expected403.length} phản hồi 403 kỳ vọng khi mở trang cấm (đã loại khỏi mục C)`);

  // ── Cô lập giữa các gia sư ──
  section("Cô lập: dữ liệu của gia sư KHÁC không lọt vào trang của gia sư này");
  {
    const before = issues.length;
    const marks = [OTHER.course, OTHER.plan, OTHER.exam, OTHER.tutor];
    const leaks: string[] = [];
    for (const path of ["/lop-cua-toi", "/lop-cua-toi/lop", "/lop-cua-toi/lich", "/lop-cua-toi/hoc-phi", "/lop-cua-toi/ke-hoach-buoi", "/lop-cua-toi/bao-cao-thang", "/lop-cua-toi/kiem-duyet", "/admin/khoa-hoc", "/admin/thi-thu", "/admin/thi-thu/ngan-hang-de-thi"]) {
      const r = await open(p, MAIN + path);
      for (const m of marks) if (r.text.includes(m)) leaks.push(`${path} có «${m}»`);
    }
    check("các trang riêng của gia sư không hiện lớp / kế hoạch / đề thi / tên của gia sư khác", leaks.length === 0, leaks);
    const direct = [`/lop-cua-toi/${w.c3.id}`, `/admin/khoa-hoc/${w.c3.id}`, `/admin/thi-thu/${w.exam2Id}`, ...(w.plan2Id ? [`/lop-cua-toi/ke-hoach-buoi/${w.plan2Id}`] : [])];
    const seenOther: string[] = [];
    const textOf = new Map<string, string>();
    for (const path of direct) {
      const r = await open(p, MAIN + path);
      textOf.set(path, r.text);
      const hit = marks.filter(m => r.text.includes(m));
      console.log(`   ${path.replace(/[0-9a-z]{20,}/gi, ":id").padEnd(44)} → ${abs(r.final).replace(MAIN, "").replace(/[0-9a-z]{20,}/gi, ":id")}${hit.length ? "  (HIỆN: " + hit.join(", ") + ")" : ""}`);
      if (hit.length) seenOther.push(`${path} hiện «${hit.join(", ")}»`);
    }
    check("mở thẳng địa chỉ lớp / đề / kế hoạch của gia sư khác → không thấy dữ liệu của họ", seenOther.length === 0, seenOther);
    const editText = textOf.get(`/admin/khoa-hoc/${w.c3.id}`) ?? "";
    check("trang sửa khoá của gia sư khác báo 'không có quyền', không hiện giao diện sửa (Lưu thay đổi / Học viên đăng ký)", /không có quyền/i.test(editText) && !/Lưu thay đổi|Học viên đăng ký/.test(editText), editText.slice(0, 160));
    // mở địa chỉ của người khác làm API trả 403/404 trước khi trang kịp đẩy đi → kỳ vọng, không tính vào mục C
    const dropped = issues.splice(before).filter(i => /^HTTP (401|403|404)$/.test(i.kind));
    console.log(`  ℹ ${dropped.length} phản hồi 401/403/404 kỳ vọng khi mở địa chỉ của gia sư khác (đã loại khỏi mục C)`);
  }

  // ── B. nút ──
  section("B. Nút: bấm thử từng nút / tab / mục menu trên mỗi kiểu trang");
  const patternsDone = new Set<string>(), clickTargets: string[] = [];
  for (const v of visited) {
    if (v.why) continue;
    const fu = new URL(v.final);
    if (fu.origin !== MAIN_ORIGIN) continue;
    const pt = pattern(fu) + (fu.searchParams.get("tab") ? `?tab=${fu.searchParams.get("tab")}` : "");   // mỗi tab của trang sửa khoá / cộng đồng là một kiểu trang riêng
    if (patternsDone.has(pt)) continue;
    patternsDone.add(pt); clickTargets.push(v.final);
  }
  console.log(`  ${clickTargets.length} kiểu trang sẽ được bấm thử (tối đa ${MAX_BTN} nút mỗi trang)`);
  const clicks: Click[] = [];
  for (const url of clickTargets) {
    const n0 = clicks.length;
    await clickAudit(ctx, p, url, clicks).catch(e => console.log(`   (bỏ qua ${url}: ${String(e).slice(0, 100)})`));
    const mine = clicks.slice(n0);
    console.log(`  ${new URL(url).pathname.padEnd(46)} ${String(mine.length).padStart(3)} nút: ${mine.filter(c => c.kind === "đổi trang").length} đổi trang, ${mine.filter(c => c.kind === "tab mới").length} tab mới, ${mine.filter(c => c.kind === "hộp thoại").length} hộp thoại`);
  }
  const badClicks = clicks.filter(c => c.why);
  for (const b of badClicks.slice(0, 40)) console.log(`   ✗ [${new URL(b.page).pathname}] «${b.label}» → ${b.dest?.replace(MAIN, "")}  (${b.why})`);
  check("mọi nút điều hướng đưa tới trang đúng (không 404 / không về đăng nhập / không sai đích)", badClicks.length === 0, badClicks.slice(0, 6));
  const stuck = clicks.filter(c => c.kind === "không bấm được");
  for (const b of stuck.slice(0, 25)) console.log(`   ⚠ không bấm được [${new URL(b.page).pathname}] «${b.label}» — ${b.why}`);
  console.log(`  ℹ ${stuck.length} nút không bấm được trong trạng thái trang sạch (bị che / ngoài khung nhìn / đang chuyển động) — xem báo cáo`);
  const unnamedTotal = [...unnamed.values()].reduce((a, b) => a + b, 0);
  console.log(`  ℹ ${unnamedTotal} nút chỉ có biểu tượng, không có tên truy cập được, trên ${unnamed.size} kiểu trang (xem báo cáo)`);
  console.log(`  ℹ địa chỉ ngoài đã mở bằng nút: ${[...new Set(externalNavs.map(x => x.url))].slice(0, 6).join(" · ") || "không có"}`);

  // ── C. lỗi ──
  section("C. Lỗi: JS chưa bắt, console.error của ứng dụng, phản hồi HTTP ≥ 400");
  // DB thử cục bộ không cài được pgvector (cột `embedding` là text) nên tầng "giống nghĩa" của /api/question-categories/:id/duplicates báo 500 — chỉ lỗi môi trường.
  // Chỉ bỏ qua đúng đường này VÀ chỉ khi DB thử thật sự thiếu extension `vector`; có pgvector mà vẫn 500 thì là lỗi thật.
  const hasVector = ((await prisma.$queryRawUnsafe(`select 1 from pg_extension where extname = 'vector'`)) as unknown[]).length > 0;
  if (!hasVector) {
    const envOnly = issues.filter(i => /^HTTP 500$/.test(i.kind) && /^GET \/api\/question-categories\/[^/]+\/duplicates/.test(i.msg));
    for (const i of envOnly) issues.splice(issues.indexOf(i), 1);
    if (envOnly.length) console.log(`  ℹ ${envOnly.length} lỗi 500 của /api/question-categories/:id/duplicates là do DB thử thiếu pgvector (chỉ môi trường, production có cột vector) — đã loại`);
  }
  const byKind = new Map<string, Issue[]>();
  for (const i of issues) byKind.set(i.kind.startsWith("HTTP") ? "HTTP ≥ 400" : i.kind, [...(byKind.get(i.kind.startsWith("HTTP") ? "HTTP ≥ 400" : i.kind) ?? []), i]);
  for (const [k, list] of byKind) {
    const uniq = new Map<string, Issue>();
    for (const i of list) { const id = `${i.kind}|${i.msg}`; if (!uniq.has(id)) uniq.set(id, i); }
    console.log(`  ✗ ${k}: ${list.length} lần (${uniq.size} khác nhau)`);
    for (const i of [...uniq.values()].slice(0, 14)) console.log(`      [${i.at.replace(MAIN, "").slice(0, 60)}] ${i.kind} ${i.msg}`);
  }
  check("không có lỗi JS chưa bắt ở bất kỳ trang nào của gia sư", !issues.some(i => i.kind === "lỗi JS"), issues.filter(i => i.kind === "lỗi JS").slice(0, 3));
  check("không có console.error của ứng dụng", !issues.some(i => i.kind === "console.error"), issues.filter(i => i.kind === "console.error").slice(0, 3));
  check("không có phản hồi HTTP ≥ 400 ở các trang / API của gia sư", !issues.some(i => i.kind.startsWith("HTTP")), issues.filter(i => i.kind.startsWith("HTTP")).slice(0, 5));

  // ── Báo cáo ──
  const lines: string[] = [];
  lines.push("=== LIÊN KẾT: mỗi liên kết khác nhau một dòng (vùng · nhãn → đích) ===");
  const uniq = new Map<string, { region: string; text: string; href: string; pages: Set<string>; blank: boolean }>();
  for (const [, links] of pageLinks) for (const l of links) {
    const id = `${l.region}|${l.text}|${l.href}`;
    const cur = uniq.get(id) ?? { region: l.region, text: l.text, href: l.href, pages: new Set<string>(), blank: l.blank };
    cur.pages.add(new URL(l.from).pathname); uniq.set(id, cur);
  }
  const vmap = new Map(visited.map(v => [v.requested, v]));
  for (const x of [...uniq.values()].sort((a, b) => a.region.localeCompare(b.region) || a.href.localeCompare(b.href))) {
    let res = "·";
    try { const lu = new URL(x.href); lu.hash = ""; const v = vmap.get(abs(lu)); if (v) res = v.why ? `✗ ${v.why}` : v.requested === v.final ? "✓" : `✓→ ${v.final.replace(MAIN, "")}`; } catch { /* */ }
    lines.push(`  [${x.region}] «${x.text}» → ${x.href.replace(MAIN, "")}${x.blank ? " (tab mới)" : ""}   ${res}   (trên ${x.pages.size} trang)`);
  }
  lines.push("\n=== NÚT: mỗi nút đã bấm thử ===");
  for (const c of clicks) lines.push(`  [${new URL(c.page).pathname}] «${c.label}» → ${c.kind}${c.dest ? " " + c.dest.replace(MAIN, "") : ""}${c.why ? "  ✗ " + c.why : ""}${c.issuesAfter ? `  (+${c.issuesAfter} lỗi)` : ""}`);
  lines.push("\n=== NÚT KHÔNG CÓ TÊN (trình đọc màn hình chỉ đọc \"nút\") ===");
  for (const [pg, n] of unnamed) lines.push(`  [${new URL(pg).pathname}] ${n} nút`);
  lines.push("\n=== ĐỊA CHỈ NGOÀI MÀ NÚT / LIÊN KẾT MỞ RA ===");
  for (const x of externalNavs) lines.push(`  [${x.from.replace(MAIN, "").slice(0, 70)}] ${x.url}`);
  lines.push("\n=== LỖI GOM ĐƯỢC ===");
  for (const i of issues) lines.push(`  [${i.at.replace(MAIN, "")}] ${i.kind} ${i.msg}`);
  lines.push("\n=== LIÊN KẾT RA NGOÀI ===");
  for (const [k, v] of external) lines.push(`  ${k}   «${v}»`);
  writeFileSync(REPORT, lines.join("\n"), "utf-8");
  console.log(`\nBáo cáo đầy đủ: ${REPORT} (${lines.length} dòng)`);

  // ── độ phủ: các kiểu trang của gia sư đã được mở ──
  const walk = (d: string, out: string[] = []) => { for (const n of readdirSync(join(process.cwd(), d))) { const q = join(d, n); if (statSync(join(process.cwd(), q)).isDirectory()) { if (n !== "generated" && n !== "node_modules") walk(q, out); } else out.push(q); } return out; };
  const all = walk("src/app").filter(f => /\/page\.tsx?$/.test(f)).map(f => "/" + f.replace(/^src\/app\//, "").replace(/\/page\.\w+$/, "").split("/").filter(s => s && !/^\(.*\)$/.test(s)).join("/"));
  const mine = all.filter(x => x.startsWith("/lop-cua-toi") || /^\/admin\/(khoa-hoc|thi-thu)/.test(x));
  const vis = new Set(visited.map(v => new URL(v.final).pathname));
  const match = (pt: string, path: string) => { const a = pt.split("/").filter(Boolean), b = path.split("/").filter(Boolean); return a.length === b.length && a.every((s, i) => /^\[.+\]$/.test(s) || s === b[i]); };
  const missing = mine.filter(pt => ![...vis].some(v => match(pt, v)));
  if (!EMPTY) console.log(`Độ phủ trang của gia sư: ${mine.length - missing.length}/${mine.length}${missing.length ? " — chưa mở: " + missing.join(", ") : ""}`);

  await closeAll();
  await prisma.$disconnect();
  done();
})().catch(async e => { console.error("CRASH", e); await closeAll(); process.exit(1); });
