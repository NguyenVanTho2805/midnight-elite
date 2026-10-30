// Rà soát TOÀN BỘ vai HỌC SINH và vai KHÁCH bằng trình duyệt thật (16/10/2026, Thọ: "kiểm tra toàn bộ role học sinh và role guest xem có lỗi hay button đến sai địa chỉ").
// Cùng cách làm với `ui-tutor-everything` (xem đầu tệp đó), chạy trên "thế giới học sinh" (tools/local-e2e/student-world.ts):
//   A. LIÊN KẾT: duyệt từ mọi trang xuất phát, mở thật từng đích của mọi <a href> (kể cả trong menu "Khác", menu tài khoản, menu điện thoại) → không 404 /
//      không bị đẩy về đăng nhập (học sinh) / không sai đích; với khách: trang cần đăng nhập phải đưa về /dang-nhap KÈM ?redirect= đúng trang.
//   Vỏ / Quyền / Cô lập: học sinh luôn ở vỏ HỌC SINH (trừ phòng thi, trang phụ huynh); khách không bao giờ thấy thanh module; trang của vai khác được xử lý gọn
//      (không trắng, không lỗi); dữ liệu riêng của học sinh / lớp khác không lọt vào trang riêng của học sinh này.
//   Chuông thông báo (học sinh): bấm từng thông báo → đúng trang đích đã ghi.
//   B. NÚT: với mỗi kiểu trang, bấm thử từng nút / tab / mục menu trên TRANG NẠP LẠI SẠCH (bỏ nút nộp / gửi / xoá / lưu / đăng xuất…), ghi nó làm gì.
//   C. LỖI: gom lỗi JS chưa bắt, console.error của ứng dụng, mọi phản hồi HTTP ≥ 400 cùng nguồn gốc.
// Tuỳ chọn: ROLE=student|guest (mặc định student) · WORLD=empty (học sinh MỚI TINH) · VIEWPORT=390x844 (điện thoại) · ROLE_REPORT= · MAX_BTN= · MAX_PAGES=.
// Báo cáo đầy đủ (mọi "nhãn → đích") ghi ra scratchpad/role-report-<vai>.txt để đọc bằng mắt: đích có thể đúng đường dẫn nhưng sai ý nghĩa nhãn.
import { writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { launch, closeAll } from "./ui";
import { wipe, check, section, done, cookieFor, BASE } from "./h";
import { seedStudentWorld, OTHER_S, TOKENS } from "./student-world";
import { prisma } from "@/lib/prisma";
import type { BrowserContext, Page } from "playwright";

const ROLE = (process.env.ROLE ?? "student") as "student" | "guest";
if (ROLE !== "student" && ROLE !== "guest") throw new Error("ROLE phải là student hoặc guest");
const EMPTY = process.env.WORLD === "empty" && ROLE === "student";   // học sinh MỚI TINH chưa vào lớp nào
const PORT = Number(process.env.PORT ?? 3100);
const MAIN = `http://midnightelite-edu.com:${PORT}`;
const MAIN_ORIGIN = new URL(MAIN).origin;
const ADMIN = `http://admin.midnightelite-edu.com:${PORT}`;
const REPORT = process.env.ROLE_REPORT ?? `scratchpad/role-report-${ROLE}.txt`;
const MAX_PAGES = Number(process.env.MAX_PAGES ?? 170);   // trần số đích khác nhau được mở ở phần A
const MAX_BTN = Number(process.env.MAX_BTN ?? 28);        // trần số nút được bấm thử trên mỗi kiểu trang ở phần B
const MAX_PER_PATTERN = 4;
const [VW, VH] = (process.env.VIEWPORT ?? "1280x900").split("x").map(Number);
const SHELL_STUDENT = "Module của học sinh";

const isId = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(s) || /^c[a-z0-9]{20,}$/i.test(s) || /^\d{3,}$/.test(s) || /^(lop|u|kh|exam|les|sec|chap)-[a-z0-9-]{6,}$/i.test(s) || (/^[a-z0-9_-]{16,}$/i.test(s) && /\d/.test(s));
const pattern = (u: URL) => u.pathname.split("/").map(s => (s && isId(s) ? ":id" : s)).join("/");
const norm = (p: string) => (p.length > 1 ? p.replace(/\/+$/, "") : p);
const abs = (u: URL) => `${u.protocol}//${u.host}${u.pathname}${u.search}`;
// Trang chỉ người đăng nhập mở được. Câu hỏi Hỏi đáp cũng vậy (API /api/questions/[id] trả 401 cho khách): khách phải được đưa sang đăng nhập rồi quay lại ĐÚNG câu hỏi.
const PROTECTED = [/^\/student(\/|$)/, /^\/lop-cua-toi(\/|$)/, /^\/admin(\/|$)/, /^\/cai-dat(\/|$)/, /^\/cong-dong\/hoi-dap\/[^/]+$/];
const isProtected = (p: string) => PROTECTED.some(r => r.test(p));

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

// Vỏ đang hiện: aria-label của thanh module ("Module của học sinh" / "Module của gia sư" / "Module quản trị"); rỗng nếu trang không có vỏ.
const SHELL_OF = `(document.querySelector('nav[aria-label^="Module"]') || {getAttribute: () => ''}).getAttribute('aria-label') || ''`;
const GUEST_NAV = `!!document.querySelector('header nav[aria-label="Điều hướng chính"]')`;
type Opened = { status: number | null; final: URL; text: string; shell: string; guestNav: boolean };
async function open(p: Page, url: string): Promise<Opened> {
  at = url;
  const resp = await p.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => null);
  const status = resp ? resp.status() : null;
  await settle(p);
  const text = await p.evaluate(`document.body ? document.body.innerText.slice(0, 6000) : ''`).catch(() => "") as string;
  const shell = await p.evaluate(SHELL_OF).catch(() => "") as string;
  const guestNav = await p.evaluate(GUEST_NAV).catch(() => false) as boolean;
  return { status, final: new URL(p.url()), text, shell, guestNav };
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
    const SEL = 'header button[aria-expanded="false"], aside button[aria-expanded="false"], nav button[aria-expanded="false"], button[aria-haspopup], button[aria-label="Mở menu"], button[aria-label*="menu" i]';
    const n = await p.locator(SEL).count().catch(() => 0);
    for (let i = 0; i < Math.min(n, 14); i++) {
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

// Chuyển hướng CÓ CHỦ ĐÍCH. Học sinh: trang chủ / đăng nhập / đăng ký / cửa /student → "Việc của tôi"; bí danh cũ của vỏ học sinh trỏ sang trang công khai tương ứng
// (mở TRONG khung thanh bên). Khách: không có chuyển hướng nào ngoài cổng đăng nhập (xử lý riêng ở `judge`).
const STUDENT_ALIASES: Record<string, string> = { "/student/thi-thu": "/thi-thu", "/student/bang-xep-hang": "/bang-xep-hang", "/student/cong-dong": "/cong-dong", "/student/hoi-dap": "/cong-dong", "/student/tin-tuc": "/tin-tuc", "/student/tra-cuu": "/tra-cuu" };
const HOME = "/student/viec-cua-toi";
const TUTOR_PAGES = /^\/lop-cua-toi\/(lich|lop|tong-quan|ho-so|cai-dat|kiem-duyet|bao-cao-thang|ke-hoach-buoi|bai-dang)(\/|$)/;   // trang của gia sư: học sinh được đưa về "Lớp của tôi"
const TUTOR_MONEY = /^\/lop-cua-toi\/(hoc-phi|doanh-thu)$/;                                                                             // học phí / doanh thu của gia sư: học sinh được đưa sang Học phí của mình
// BU-00 (31/10/2026): bí danh NỘI DUNG của gia sư (/lop-cua-toi/de-thi*, /lop-cua-toi/quan-lop* — thay /admin/thi-thu*, /admin/khoa-hoc*). Học sinh mở thẳng,
// hoặc đi qua /dang-nhap?redirect=<bí danh> (vd "Quản khoá" ở /ban-do, trước trỏ /admin/khoa-hoc), đều được layout (noi-dung) đưa về "Lớp của tôi".
const TUTOR_CONTENT = /^\/lop-cua-toi\/(de-thi|quan-lop)(\/|$)/;
const notes = new Map<string, string>();   // đổi đích CÓ CHỦ ĐÍCH đã xem xét (in ra cuối phần A để người đọc soát lại, không nuốt im lặng)
// Trả về lý do nếu việc đổi đích reqPath → finPath là CÓ CHỦ ĐÍCH, ngược lại null.
function expected(reqPath: string, finPath: string, redir = ""): string | null {
  if (ROLE === "guest") return null;
  if (TUTOR_CONTENT.test(reqPath) && finPath === "/lop-cua-toi") return "bí danh nội dung của GIA SƯ (de-thi / quan-lop): học sinh được đưa về danh sách lớp của mình";
  if (reqPath === "/dang-nhap" && TUTOR_CONTENT.test(redir) && finPath === "/lop-cua-toi") return "liên kết của GIA SƯ trỏ /dang-nhap?redirect=<bí danh de-thi / quan-lop> (vd 'Quản khoá' ở /ban-do): học sinh được đưa về danh sách lớp của mình";
  if (STUDENT_ALIASES[reqPath] === finPath) return "bí danh của vỏ học sinh trỏ sang trang công khai (mở trong khung thanh bên)";
  let m = reqPath.match(/^\/student\/cong-dong\/([^/]+)$/);
  if (m && finPath === `/cong-dong/${m[1]}`) return "bí danh chi tiết bài viết của vỏ học sinh";
  m = reqPath.match(/^\/student\/hoi-dap\/([^/]+)$/);
  if (m && finPath === `/cong-dong/hoi-dap/${m[1]}`) return "bí danh chi tiết câu hỏi của vỏ học sinh";
  if (["/", "/dang-nhap", "/dang-ky", "/student"].includes(reqPath) && finPath === HOME) return "người đã đăng nhập đi thẳng vào 'Việc của tôi'";
  if (TUTOR_PAGES.test(reqPath) && finPath === "/lop-cua-toi") return "trang của GIA SƯ: học sinh được đưa về danh sách lớp của mình";
  if (TUTOR_MONEY.test(reqPath) && finPath === "/student/hoc-phi") return "trang tiền của GIA SƯ: học sinh được đưa sang Học phí của mình";
  return null;
}
const GATE = "cổng đăng nhập (trang cần đăng nhập — đúng thiết kế với khách)";
// ?redirect= đúng nghĩa: bằng đường dẫn (có hoặc không kèm tham số) của trang đang định vào
const redirectOk = (requested: URL, fin: URL) => { const r = fin.searchParams.get("redirect"); return !!r && (r === requested.pathname + requested.search || r === requested.pathname); };
function judge(requested: URL, r: { status: number | null; final: URL; text: string }): string | null {
  if (r.status !== null && r.status >= 400) return `HTTP ${r.status}`;
  if (NOT_FOUND.test(r.text)) return "giao diện 404";
  if (APP_ERROR.test(r.text)) return "trang báo lỗi";
  const reqP = norm(requested.pathname), finP = norm(r.final.pathname);
  if (r.final.origin !== requested.origin) {
    // Học sinh bấm liên kết dành cho GIA SƯ trỏ /admin/… (vd "Quản khoá" ở /ban-do): bị đưa sang cửa quản trị. Đúng thiết kế (học sinh không có quyền ở đó) — ghi nhận, không tính lỗi.
    const redir = requested.searchParams.get("redirect") ?? "";
    if (ROLE === "student" && /^\/admin(\/|$)/.test(reqP === "/dang-nhap" ? redir : reqP) && r.final.host.startsWith("admin.")) { notes.set(`${reqP}${requested.search}`, "liên kết của GIA SƯ trỏ /admin: học sinh bị đưa sang cửa quản trị (không có quyền ở đó)"); return null; }
    return `sang tên miền khác: ${r.final.host}${finP}`;
  }
  if (finP === "/dang-nhap" && reqP !== "/dang-nhap") {
    if (ROLE === "student") return "bị đẩy về trang đăng nhập dù đã đăng nhập";
    if (!isProtected(reqP)) return "bị đẩy về trang đăng nhập";
    return redirectOk(requested, r.final) ? GATE : "về trang đăng nhập nhưng KHÔNG giữ ?redirect= đúng trang đang định vào";
  }
  if (reqP !== finP) {
    const why = expected(reqP, finP, requested.searchParams.get("redirect") ?? "");
    if (why) { notes.set(`${reqP}${reqP === "/dang-nhap" ? requested.search : ""} → ${finP}`, why); return null; }
    return `đổi đích: ${reqP} → ${finP}`;
  }
  return null;
}

// ── B. nút ─────────────────────────────────────────────────────────────────────────────────────────────────────
const BTN_SEL = 'button, [role="button"], [role="tab"], [role="menuitem"], summary';
// Mỗi nút đủ điều kiện được gắn data-audit-i = số thứ tự rồi bấm theo thẻ ấy (bộ chọn của Playwright còn xuyên vào shadow DOM của thanh công cụ dev nên chỉ số trong danh sách lệch).
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
    const text = (own ? own + (title && title !== own ? ' (' + title + ')' : '') : title || '⟨không tên ' + (typeof el.className === 'string' ? el.className.split(' ').filter(Boolean).slice(0, 2).join('.') : '') + '⟩').slice(0, 70);
    el.setAttribute('data-audit-i', String(n));
    seen[text] = (seen[text] || 0) + 1;
    out.push({ idx: n, occ: seen[text], text, named, type: el.getAttribute('type') || '', role: el.getAttribute('role') || '', expanded: el.getAttribute('aria-expanded') });
    n++;
  });
  return out;
})()`;
const DIAG = (idx: number) => `(() => {
  const el = document.querySelector('[data-audit-i="${idx}"]'); if (!el) return 'thẻ không còn';
  const r = el.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  const inView = r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth;
  const who = top && top !== el && !el.contains(top) ? top.tagName.toLowerCase() + (typeof top.className === 'string' && top.className ? '.' + top.className.split(' ').filter(Boolean).slice(0, 3).join('.') : '') + ' «' + (top.innerText || '').replace(/\\s+/g, ' ').slice(0, 30) + '»' : 'không bị che';
  return 'vị trí ' + Math.round(r.left) + ',' + Math.round(r.top) + ' cỡ ' + Math.round(r.width) + 'x' + Math.round(r.height) + ', trong khung nhìn=' + inView + ', ở trên cùng giữa nút: ' + who;
})()`;
// Nút KHÔNG bấm thử: nộp / gửi / xoá / lưu / đăng xuất / bắt đầu làm bài / đồng ý của phụ huynh… (làm bẩn dữ liệu thử hoặc đăng xuất cả bài rà, không điều hướng).
// «Báo cáo», «Báo nghỉ», «Theo dõi lớp», «Đăng ký»… vẫn bấm: chúng mở hộp thoại hoặc dẫn tới trang đăng nhập.
const SKIP_BTN = /thu gọn thanh bên|mở rộng thanh bên|mở thanh bên|xóa|xoá|delete|đăng xuất|logout|nộp|gửi|lưu|cập nhật|sao chép|copy|tải|xuất|in phiếu|bắt đầu làm|kết thúc|tôi đã chuyển|đồng ý|từ chối|thanh toán|nạp|rút|đặt lại mật khẩu|huỷ yêu cầu|thu hồi|tham gia lớp|vào lớp ngay|chọn ảnh|đăng bài|đăng câu hỏi|trả lời|bình luận|thích|đánh dấu|bookmark/i;

type Click = { page: string; label: string; kind: "đổi trang" | "tab mới" | "hộp thoại" | "không điều hướng" | "không bấm được"; dest?: string; why?: string | null; issuesAfter: number };
type Cand = { idx: number; occ: number; text: string; named: boolean; type: string; role: string; expanded: string | null };
const sig = (cs: Cand[]) => cs.map(x => x.text).join("\u0001");
const lastLog = (e: unknown) => String((e as Error)?.message ?? e).replace(/\u001b\[[0-9;]*m/g, "").split("\n").map(x => x.trim()).filter(Boolean).slice(-3).join(" | ").slice(0, 260);
const unnamed = new Map<string, number>();   // trang -> số nút không có tên truy cập được

// Mỗi nút được thử trong trạng thái trang "sạch" (xem ui-tutor-everything): sau lần bấm làm đổi hình dạng trang thì nạp lại rồi mới bấm nút kế.
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
    if (!now) continue;
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
      out.push({ page: url, label: c.text, kind: "đổi trang", dest: abs(fin), why: why === GATE ? null : why, issuesAfter: issues.length - nIssues });
      cands = await load(); fresh = true; continue;
    }
    const dlg = await p.locator('[role="dialog"], [role="alertdialog"]').first().isVisible().catch(() => false);
    out.push({ page: url, label: c.text, kind: dlg ? "hộp thoại" : "không điều hướng", issuesAfter: issues.length - nIssues });
    await p.keyboard.press("Escape").catch(() => {});
    await p.waitForTimeout(200);
    cands = await p.evaluate(CANDIDATES) as Cand[];
    const stillDlg = await p.locator('[role="dialog"], [role="alertdialog"]').first().isVisible().catch(() => false);
    if (dlg && stillDlg || sig(cands) !== sigBefore) { cands = await load(); fresh = true; } else fresh = false;
  }
}

(async () => {
  mkdirSync("scratchpad", { recursive: true });
  await wipe();
  const w = await seedStudentWorld({ empty: EMPTY });
  console.log(`  vai: ${ROLE === "guest" ? "KHÁCH (chưa đăng nhập)" : EMPTY ? "HỌC SINH mới tinh (chưa vào lớp)" : "HỌC SINH có dữ liệu đầy đủ"}; khung nhìn ${VW}x${VH}`);
  const browser = await launch();
  // x-forwarded-proto: Vercel luôn đặt; không có thì trang /mentor/[id] (tự gọi lại API của chính nó theo https) hỏng ở `next dev` chạy http.
  const ctx: BrowserContext = await browser.newContext({ viewport: { width: VW, height: VH }, locale: "vi-VN", extraHTTPHeaders: { "x-forwarded-proto": "http" } });
  // Thanh công cụ góp ý `agentation` chỉ có ở `next dev` nhưng đè góc phải-dưới, che nút ở khung điện thoại → ẩn đi (đợi DOMContentLoaded vì script chạy trước cả khi có <html>).
  await ctx.addInitScript(`(() => { const add = () => { const css = document.createElement("style"); css.textContent = "[data-agentation-root]{display:none !important}"; (document.head || document.documentElement).appendChild(css); }; if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", add); else add(); })()`);
  const externalNavs: { from: string; url: string }[] = [];
  await ctx.route(u => u.origin !== MAIN_ORIGIN && /^https?:$/.test(u.protocol), route => {
    const r = route.request();
    if (!r.isNavigationRequest()) return route.continue();
    externalNavs.push({ from: at, url: r.url() });
    return route.fulfill({ status: 200, contentType: "text/html", body: "<title>trang ngoài (đã chặn lúc thử)</title>" });
  });
  if (ROLE === "student") {
    const [cookieName, ...cookieRest] = (await cookieFor(w.S)).split("=");
    await ctx.addCookies([{ name: cookieName, value: cookieRest.join("="), url: MAIN }]);   // phiên CHỈ ở tên miền chính, như thật
  }
  const p = await ctx.newPage();
  p.on("dialog", d => { void (d.type() === "beforeunload" ? d.accept() : d.dismiss()); });
  watch(p);

  const L = w.lessons;
  const seeds = ROLE === "student" ? [
    "/student/viec-cua-toi", "/student/hoc-tap", `/student/hoc-tap?course=${w.C1.id}`, `/student/hoc-tap?course=${w.C3.id}`, "/student/lich-hoc", "/student/hoc-phi", "/student/ho-so", "/student/vi",
    "/student/nhap-ma-lop", `/student/nhap-ma-lop?code=${w.invite.code}`,
    `/student/bai-giang/${L.rec.id}`, `/student/bai-giang/${L.paid.id}`, `/student/bai-giang/${L.live.id}`, `/student/bai-giang/${L.doc.id}`,
    "/student", "/student/thi-thu", `/student/thi-thu/${w.E1.id}`, `/student/thi-thu/${w.E2.id}`, "/student/bang-xep-hang", "/student/cong-dong", `/student/cong-dong/${w.th1.id}`, "/student/hoi-dap", `/student/hoi-dap/${w.qA.id}`, "/student/tin-tuc", "/student/tra-cuu",
    "/lop-cua-toi", "/cai-dat/chu-de", "/thu-vien", "/khoa-hoc", `/khoa-hoc/${w.C1.id}`, "/khoa-hoc-da-luu", "/giang-vien", `/mentor/${w.T.id}`, "/thi-thu", "/cong-dong", `/cong-dong/${w.th1.id}`, `/cong-dong/hoi-dap/${w.qA.id}`,
    "/tin-tuc", `/tin-tuc/${w.article.slug}`, "/diem-chuan", "/bang-xep-hang", "/ban-do", "/chinh-sach", "/tra-cuu", "/phu-huynh", "/",
    `/phieu/${TOKENS.invoice}`, `/so-cua-con/${TOKENS.portal}`,
  ] : [
    "/", "/khoa-hoc", `/khoa-hoc/${w.C1.id}`, "/khoa-hoc-da-luu", "/giang-vien", `/mentor/${w.T.id}`, "/thi-thu", "/cong-dong", `/cong-dong/${w.th1.id}`, `/cong-dong/hoi-dap/${w.qA.id}`, "/tin-tuc", `/tin-tuc/${w.article.slug}`,
    "/diem-chuan", "/bang-xep-hang", "/ban-do", "/chinh-sach", "/thu-vien", "/tra-cuu", "/phu-huynh",
    "/dang-nhap", "/dang-ky", "/dang-ky?vai=gia-su", "/quen-mat-khau", `/dat-lai-mat-khau?token=${"0".repeat(64)}`, "/xac-thuc-email",
    `/xac-nhan-phu-huynh?token=${TOKENS.consent}`,
    `/phieu/${TOKENS.invoice}`, `/phieu/${TOKENS.invoiceExpired}`, `/so-cua-con/${TOKENS.portal}`,
    "/student/viec-cua-toi", `/student/nhap-ma-lop?code=${w.invite.code}`, "/lop-cua-toi", "/cai-dat/chu-de",
  ];
  const queue = seeds.map(s => ({ url: MAIN + s, menus: true }));

  // ── A. liên kết ──
  section(`A. Liên kết: mở thật từng đích của mọi <a> (${ROLE === "guest" ? "khách" : "học sinh"})`);
  const seen = new Set<string>(), perPattern = new Map<string, number>();
  const pageLinks = new Map<string, Rec[]>();
  const visited: { requested: string; final: string; why: string | null; shell: string; guestNav: boolean }[] = [];
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
    visited.push({ requested: key, final: abs(r.final), why, shell: r.shell, guestNav: r.guestNav });
    if (r.final.origin !== MAIN_ORIGIN || r.final.pathname.startsWith("/api") || r.final.pathname === "/dang-nhap" && u.pathname !== "/dang-nhap") continue;
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
  const gates = visited.filter(v => v.why === GATE);
  const badLinks = visited.filter(v => v.why && v.why !== GATE);
  console.log(`  đã mở ${visited.length} đích khác nhau, ${badLinks.length} sai${gates.length ? `, ${gates.length} trang cần đăng nhập (khách được đưa tới /dang-nhap kèm ?redirect= đúng): ${gates.slice(0, 5).map(g => new URL(g.requested).pathname).join(", ")}${gates.length > 5 ? " …" : ""}` : ""}`);
  for (const b of badLinks.slice(0, 40)) console.log(`   ✗ ${new URL(b.requested).pathname}${new URL(b.requested).search} → ${b.final.replace(MAIN, "")}  (${b.why})`);
  if (notes.size) { console.log(`  ℹ ${notes.size} đổi đích CÓ CHỦ ĐÍCH (đã xem xét, không tính lỗi):`); for (const [k, v] of [...notes].slice(0, 30)) console.log(`      ${k.replace(/[0-9a-z]{20,}/gi, ":id")}  — ${v}`); }
  check(`mọi liên kết ${ROLE === "guest" ? "của khách" : "của học sinh"} mở ra đúng mục (không 404 / không sai đích${ROLE === "guest" ? " / cổng đăng nhập luôn giữ ?redirect=" : " / không về đăng nhập"})`, badLinks.length === 0, badLinks.slice(0, 6));

  // ── Vỏ ──
  if (ROLE === "student") {
    section("Vỏ: học sinh luôn ở trong khung thanh bên HỌC SINH (trừ phòng thi, trang phụ huynh, trang gửi qua thư)");
    const NO_SHELL_OK = /^\/(phieu|so-cua-con|xac-nhan-phu-huynh|xac-thuc-email|dat-lai-mat-khau|quen-mat-khau|xem-tai-lieu)(\/|$)|^\/student\/thi-thu\/[^/]+$/;
    const final = visited.filter(v => !v.why && new URL(v.final).origin === MAIN_ORIGIN);
    const wrongShell = final.filter(v => v.shell && v.shell !== SHELL_STUDENT);
    for (const x of wrongShell.slice(0, 20)) console.log(`   ✗ ${new URL(x.final).pathname} hiện khung "${x.shell}"`);
    check("không trang nào hiện khung của vai khác (gia sư / quản trị)", wrongShell.length === 0, wrongShell.slice(0, 5).map(x => [new URL(x.final).pathname, x.shell]));
    const noShell = final.filter(v => !v.shell && !NO_SHELL_OK.test(new URL(v.final).pathname));
    for (const x of noShell.slice(0, 20)) console.log(`   ✗ ${new URL(x.final).pathname} KHÔNG có khung học sinh (rơi ra kiểu trang khách)`);
    check("mọi trang (kể cả trang công khai) mở trong khung HỌC SINH — không rơi ra trang kiểu khách", noShell.length === 0, noShell.slice(0, 5).map(x => new URL(x.final).pathname));
    // Phòng thi KHÔNG có thanh module (toàn màn hình, khoá cứng khi đang làm bài) — nhưng màn kết quả và màn chuẩn bị vào thi phải có lối rời đi: trước 16/10 học viên nộp bài
    // xong chỉ còn nút Back của trình duyệt (trang không có liên kết nào).
    for (const [what, examId] of [["màn kết quả (đã thi)", w.E1.id], ["màn chuẩn bị vào thi", w.E2.id]] as const) {
      const r = await open(p, `${MAIN}/student/thi-thu/${examId}`);
      const exit = await p.locator('a[href="/student/thi-thu"]:visible').count();
      check(`phòng thi — ${what}: không có thanh module (đúng thiết kế) nhưng có lối "← Về danh sách đề thi"`, !r.shell && exit > 0, { shell: r.shell, exit });
      if (exit > 0) {
        await p.locator('a[href="/student/thi-thu"]:visible').first().click(); await settle(p);
        check(`bấm lối đó → danh sách đề thi, trong khung học sinh`, new URL(p.url()).pathname === "/thi-thu" && (await p.evaluate(SHELL_OF).catch(() => "")) === SHELL_STUDENT, p.url());
      }
    }
    check("đã thực sự nhìn thấy khung học sinh ở nhiều trang (bài rà không rỗng)", final.filter(v => v.shell === SHELL_STUDENT).length >= 20, [...new Set(visited.map(v => v.shell))]);
  } else {
    section("Vỏ: khách không bao giờ thấy thanh module của vai nào; trang công khai có thanh trên của khách");
    const anyShell = visited.filter(v => v.shell);
    check("không trang nào của khách hiện thanh module (học sinh / gia sư / quản trị)", anyShell.length === 0, anyShell.slice(0, 5).map(x => [new URL(x.final).pathname, x.shell]));
    const MAIN_PUBLIC = ["/", "/khoa-hoc", "/thi-thu", "/cong-dong", "/tin-tuc", "/giang-vien", "/diem-chuan", "/bang-xep-hang"];
    const lacking = MAIN_PUBLIC.filter(path => { const v = visited.find(x => new URL(x.final).pathname === path); return v && !v.guestNav; });
    check("các trang công khai chính đều có thanh trên 'Điều hướng chính' của khách", lacking.length === 0, lacking);
  }

  // ── Quyền ──
  section(ROLE === "student" ? "Quyền: trang của vai khác → xử lý gọn (không trắng, không lỗi, không lộ dữ liệu)" : "Quyền: trang cần đăng nhập → cổng đăng nhập GIỮ ?redirect= đúng trang");
  const issuesBeforePerm = issues.length;
  const touched = new Set<string>();   // đường dẫn đã chạm tới ngoài phần A (cho độ phủ)
  if (ROLE === "student") {
    for (const path of ["/admin", "/admin/hoc-sinh", "/admin/khoa-hoc", "/admin/thi-thu", "/admin/kiem-duyet", "/admin/doanh-thu", "/admin/quan-tri-vien"]) {
      const r = await open(p, MAIN + path);
      // tên miền admin có cookie riêng (học sinh không có) → thấy cửa đăng nhập quản trị, KÈM ?redirect= đúng trang
      check(`học sinh mở ${path} → sang cửa đăng nhập quản trị (tên miền admin), giữ ?redirect=`, r.final.origin === ADMIN && norm(r.final.pathname) === "/dang-nhap" && r.final.searchParams.get("redirect") === path, abs(r.final));
    }
    const TUTOR_ONLY = ["/lop-cua-toi/lich", "/lop-cua-toi/lop", "/lop-cua-toi/hoc-phi", "/lop-cua-toi/tong-quan", "/lop-cua-toi/ho-so", "/lop-cua-toi/doanh-thu", "/lop-cua-toi/cai-dat", "/lop-cua-toi/kiem-duyet", "/lop-cua-toi/bao-cao-thang", "/lop-cua-toi/ke-hoach-buoi", "/lop-cua-toi/ke-hoach-buoi/khong-co", "/lop-cua-toi/bai-dang"];
    for (const path of TUTOR_ONLY) {
      const r = await open(p, MAIN + path);
      touched.add(path);
      const toMoney = TUTOR_MONEY.test(path);
      const want = toMoney ? "/student/hoc-phi" : "/lop-cua-toi";
      check(`học sinh mở trang của gia sư ${path} → về ${want} (${toMoney ? "Học phí của chính mình" : "danh sách lớp của mình"}), trong khung học sinh`, r.final.origin === MAIN_ORIGIN && norm(r.final.pathname) === want && r.shell === SHELL_STUDENT, [abs(r.final), r.shell]);
    }
  } else {
    const GATED = ["/student/viec-cua-toi", "/student/hoc-tap", `/student/hoc-tap?course=${w.C1.id}`, "/student/ho-so", "/student/vi", "/student/lich-hoc", "/student/hoc-phi", "/student/nhap-ma-lop", `/student/nhap-ma-lop?code=${w.invite.code}`,
      `/student/bai-giang/${w.lessons.rec.id}`, `/student/thi-thu/${w.E1.id}`, "/lop-cua-toi", "/lop-cua-toi/lich", "/cai-dat/chu-de"];
    for (const path of GATED) {
      const r = await open(p, MAIN + path);
      check(`khách mở ${path} → /dang-nhap kèm ?redirect= đúng trang`, r.final.origin === MAIN_ORIGIN && norm(r.final.pathname) === "/dang-nhap" && redirectOk(new URL(MAIN + path), r.final), abs(r.final));
    }
    const ra = await open(p, MAIN + "/admin");
    check("khách mở /admin ở tên miền chính → cửa đăng nhập quản trị (tên miền admin), giữ ?redirect=%2Fadmin", ra.final.origin === ADMIN && norm(ra.final.pathname) === "/dang-nhap" && ra.final.searchParams.get("redirect") === "/admin", abs(ra.final));
  }
  // Mở trang của vai khác làm trang gọi API trước khi bộ chặn kịp đẩy đi → 401/403 là KỲ VỌNG, không tính vào mục C.
  const expectedAuth = issues.splice(issuesBeforePerm).filter(i => /^HTTP (401|403)$/.test(i.kind));
  console.log(`  ℹ ${expectedAuth.length} phản hồi 401/403 kỳ vọng khi mở trang cần quyền (đã loại khỏi mục C)`);

  // ── Khách → đăng nhập → quay lại đúng trang ──
  if (ROLE === "guest") {
    section("Khách bấm trang cần đăng nhập → đăng nhập xong về ĐÚNG trang đang định vào");
    for (const path of [`/student/nhap-ma-lop?code=${w.invite.code}`, "/student/hoc-tap"]) {
      const c2 = await browser.newContext({ viewport: { width: VW, height: VH }, locale: "vi-VN", extraHTTPHeaders: { "x-forwarded-proto": "http" } });
      const pg = await c2.newPage();
      await pg.goto(MAIN + path, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
      await settle(pg);
      await pg.locator('input[type="email"], input[autocomplete="username"], input[name="email"]').first().fill(w.S.email).catch(() => {});
      await pg.locator('input[type="password"]').first().fill("Passw0rd!").catch(() => {});
      await pg.locator('form button[type="submit"]').first().click().catch(() => {});
      const want = new URL(MAIN + path);
      const t0 = Date.now(); let ok = false;
      while (Date.now() - t0 < 60000) { const cu = new URL(pg.url()); if (cu.origin === MAIN_ORIGIN && cu.pathname === want.pathname) { ok = true; break; } await pg.waitForTimeout(400); }
      check(`đăng nhập từ ${path} → về đúng ${want.pathname}`, ok, pg.url());
      await c2.close();
    }
  }

  // ── Cô lập giữa các học sinh ──
  if (ROLE === "student") {
    section("Cô lập: dữ liệu RIÊNG của lớp / gia sư khác không lọt vào trang của học sinh này");
    const before = issues.length;
    // Dấu hiệu RIÊNG (không công khai): bài viết trong lớp khác, tên tệp + mã video của bài TRẢ PHÍ của lớp khác.
    // KHÔNG dùng tên học sinh khác / tên lớp / bài miễn phí / tên đề: đó là dữ liệu CÔNG KHAI (cộng đồng chung, danh mục lớp, bài miễn phí, danh sách đề có nhãn
    // "Thuộc khóa … — chưa ghi danh") nên xuất hiện là đúng thiết kế — lần chạy đầu của bài rà này đã báo giả vì dùng nhầm các dấu hiệu đó.
    const privateMarks = [OTHER_S.classThread, OTHER_S.doc, OTHER_S.video];
    const leaks: string[] = [];
    for (const path of ["/student/viec-cua-toi", "/student/hoc-tap", "/student/lich-hoc", "/student/hoc-phi", "/student/ho-so", "/student/vi", "/lop-cua-toi", "/student/cong-dong", "/thu-vien", "/thi-thu", "/cong-dong", "/khoa-hoc", "/giang-vien"]) {
      const r = await open(p, MAIN + path);
      const html = await p.content().catch(() => "");
      for (const m of privateMarks) if (r.text.includes(m) || html.includes(m)) leaks.push(`${path} có «${m}»`);
    }
    check("các trang của học sinh không hiện bài viết trong lớp khác / tài liệu / video của bài trả phí của lớp khác", leaks.length === 0, leaks);
    const direct = [`/student/bai-giang/${w.lessons.other.id}`, `/student/hoc-tap?course=${w.C2.id}`, `/cong-dong/${w.th3.id}`, `/khoa-hoc/${w.C2.id}`];
    const seenOther: string[] = [];
    for (const path of direct) {
      const r = await open(p, MAIN + path);
      const html = await p.content().catch(() => "");
      const hit = privateMarks.filter(m => r.text.includes(m) || html.includes(m));
      console.log(`   ${path.replace(/[0-9a-z]{20,}/gi, ":id").padEnd(52)} → ${abs(r.final).replace(MAIN, "").replace(/[0-9a-z]{20,}/gi, ":id")}${hit.length ? "  (HIỆN RIÊNG TƯ: " + hit.join(", ") + ")" : ""}`);
      if (hit.length) seenOther.push(`${path} hiện «${hit.join(", ")}»`);
    }
    check("mở thẳng địa chỉ bài trả phí / lớp / bài viết trong lớp của người khác → không thấy dữ liệu riêng của họ", seenOther.length === 0, seenOther);
    // Đề của lớp khác: vào thi bị từ chối (403), không vào được phòng thi.
    const startOther = await fetch(`${BASE}/api/exams/${w.E3.id}/start`, { method: "POST", headers: { cookie: await cookieFor(w.S), "content-type": "application/json" }, body: "{}" });
    check("bắt đầu thi đề của lớp KHÁC (chưa ghi danh) → bị từ chối 403", startOther.status === 403, startOther.status);
    if (EMPTY) {
      // Học sinh mới (chưa vào lớp) bấm một bài TRẢ PHÍ của lớp: API từ chối 403; trang phải nói rõ và chỉ đường vào lớp. Học sinh học miễn phí (quyết định D01) nên không được nói "mua khóa học".
      const r = await open(p, `${MAIN}/student/bai-giang/${w.lessons.paid.id}`);
      const cta = await p.locator('a[href="/student/nhap-ma-lop"]:visible').count();
      check("bài trả phí khi CHƯA vào lớp → 'dành cho học sinh của lớp', không còn nói 'mua khóa học', có lối 'Nhập mã mời'", /dành cho học sinh của lớp/i.test(r.text) && !/mua khóa học/i.test(r.text) && cta > 0, r.text.replace(/\s+/g, " ").slice(0, 220));
    }
    if (!EMPTY) {
      const fee = await open(p, MAIN + "/student/hoc-phi");
      check("trang Học phí chỉ có phiếu của chính học sinh (có phiếu của mình, không có số tiền / tên của người khác)", /1\.200\.000/.test(fee.text) && !fee.text.includes(OTHER_S.student), fee.text.slice(0, 200));
    }
    const dropped = issues.splice(before).filter(i => /^HTTP (401|403|404)$/.test(i.kind));
    console.log(`  ℹ ${dropped.length} phản hồi 401/403/404 kỳ vọng khi mở địa chỉ của người khác (đã loại khỏi mục C)`);

    // ── Chuông thông báo ──
    section("Chuông thông báo: bấm từng thông báo → đúng trang đích");
    const base = MAIN + "/student/viec-cua-toi";
    await open(p, base);
    const bell = () => p.locator('button[aria-label^="Thông báo"]').first();
    if (EMPTY) {
      await bell().click({ timeout: 8000 }).catch(() => {});
      check("học sinh mới: chuông báo 'Chưa có thông báo nào'", await p.getByText("Chưa có thông báo nào").first().isVisible().catch(() => false));
    } else {
      await bell().click({ timeout: 8000 }).catch(() => {});
      await p.waitForTimeout(500);
      const n = await p.locator(".kin-notif-btn").count();
      check(`chuông hiện đủ ${w.notifs.length} thông báo`, n === w.notifs.length, n);
      const wrongDest: string[] = [];
      for (let i = 0; i < n; i++) {
        await open(p, base);
        await bell().click({ timeout: 8000 }).catch(() => {});
        await p.waitForTimeout(400);
        const btn = p.locator(".kin-notif-btn").nth(i);
        const lines = ((await btn.innerText().catch(() => "")) || "").split("\n").map(x => x.trim()).filter(Boolean);   // dòng đầu thường là biểu tượng (🔔 🎓 💬)
        const spec = w.notifs.find(x => lines.includes(x.title));
        const title = spec?.title ?? lines.find(l => l.length > 3) ?? "?";
        // Bấm; nếu lần đầu không ra khỏi trang (hộp chuông còn đang mở animation) thì chờ rồi bấm lại MỘT lần — và ghi rõ nguyên nhân thay vì nuốt lỗi.
        let clickErr = "";
        await btn.click({ timeout: 4000 }).catch(e => { clickErr = lastLog(e); });
        await settle(p);
        if (p.url() === base) {
          await p.waitForTimeout(900);
          clickErr = "";
          await btn.click({ timeout: 4000 }).catch(e => { clickErr = lastLog(e); });
          await settle(p);
        }
        const fin = new URL(p.url());
        const text = await p.evaluate(`document.body ? document.body.innerText.slice(0, 4000) : ''`).catch(() => "") as string;
        const want = spec ? new URL(spec.link, MAIN) : null;
        const bad = judge(fin, { status: null, final: fin, text });
        // Thông báo lưu địa chỉ bí danh (/student/hoi-dap/<id>) mà trang thật là /cong-dong/hoi-dap/<id>: cùng đích (xem expected()).
        const sameDest = !!want && (fin.pathname === want.pathname || !!expected(want.pathname, fin.pathname)) && fin.search === (want.pathname === fin.pathname ? want.search : fin.search);
        const okDest = sameDest && !bad;
        console.log(`   «${title}» → ${fin.pathname}${fin.search}${okDest ? "" : `  ✗ mong ${want ? want.pathname + want.search : "?"}${bad ? " (" + bad + ")" : ""}${clickErr ? " — không bấm được: " + clickErr : ""}`}`);
        if (!okDest) wrongDest.push(`${title} → ${fin.pathname}${fin.search}`);
      }
      check("mọi thông báo dẫn đúng trang đã ghi (không 404 / không sai đích)", wrongDest.length === 0, wrongDest);
    }
  }

  // ── Địa chỉ sai / đã xoá ──
  // Liên kết cũ, bookmark, tin nhắn cắt dở: mở một địa chỉ có dạng đúng nhưng đích không còn → phải có lời giải thích (hoặc chuyển sang đăng nhập), không sập, không trang trắng.
  // Phản hồi 400/401/403/404 của API ở đây là KỲ VỌNG (loại khỏi mục C); lỗi JS / console.error của trang thì KHÔNG được có, và 5xx vẫn tính vào mục C.
  section("Địa chỉ sai hoặc đã bị xoá → có lời giải thích, không sập, không trang trắng");
  {
    const FRIENDLY = /không tìm thấy|không tồn tại|không hợp lệ|hết hạn|đã bị gỡ|đã bị xoá|đã bị xóa|không có quyền|chưa vào lớp|chưa đăng ký|404|đã được dùng|không đúng|không còn|sai/i;
    const probes: { path: string; what: string; login?: boolean }[] = [
      { path: "/khoa-hoc/khong-co-lop-nay", what: "lớp không có" },
      { path: "/mentor/khong-co-gia-su", what: "gia sư không có" },
      { path: "/cong-dong/khong-co-bai-nay", what: "bài viết không có" },
      { path: "/cong-dong/hoi-dap/khong-co-cau-hoi", what: "câu hỏi không có", login: true },
      { path: "/tin-tuc/khong-co-bai-nay", what: "tin không có" },
      // Mã giả KHÁC các mã có thật trong thế giới thử (c3 d4 a1 b2 e5 f6 — xem TOKENS và phiếu ở student-world.ts): lần đầu em dùng e5/f6 và đụng đúng hai phiếu thật.
      { path: `/phieu/${"9d".repeat(16)}`, what: "phiếu học phí không có" },
      { path: `/so-cua-con/${"8c".repeat(16)}`, what: "sổ phụ huynh không có" },
      { path: "/xac-nhan-phu-huynh?token=khong-hop-le", what: "mã xác nhận phụ huynh sai" },
      { path: "/xac-thuc-email?token=khong-hop-le", what: "mã xác thực email sai" },
      { path: "/khong-co-trang-nay", what: "đường dẫn không tồn tại" },
      ...(ROLE === "student" ? [
        { path: "/student/bai-giang/khong-co", what: "bài giảng không có" },
        { path: "/student/thi-thu/khong-co", what: "đề thi không có" },
        { path: "/student/hoc-tap?course=khong-co", what: "lớp (học tập) không có" },
        { path: "/lop-cua-toi/khong-co-lop", what: "trang lớp không có" },
        { path: "/student/nhap-ma-lop?code=SAIMA999", what: "mã mời sai" },
      ] : []),
    ];
    const bad: string[] = [];
    // Cảnh báo "Encountered a script tag while rendering React component" chỉ có ở next dev, khi trang trong nhóm (parent) trả 404 thật (notFound() trong máy chủ):
    // dựng lại riêng ở /phieu/<mã sai> và /so-cua-con/<mã sai>, KHÔNG ở 404 gốc. Là cảnh báo kiểm tra của React bản phát triển (bản production không có), giao diện 404 vẫn
    // hiện đủ — ghi nhận riêng ở dưới, chưa kiểm được ở bản dựng production (next build không chạy được ở máy này).
    const DEV_NOISE = /Encountered a script tag while rendering React component/;
    let devNoise = 0;
    for (const pr of probes) {
      const n0 = issues.length;
      const r = await open(p, MAIN + pr.path);
      const mine = issues.splice(n0);
      const js = mine.filter(i => (i.kind === "lỗi JS" || i.kind === "console.error") && !(r.status === 404 && DEV_NOISE.test(i.msg)));
      devNoise += mine.filter(i => r.status === 404 && DEV_NOISE.test(i.msg)).length;
      const other = mine.filter(i => !js.includes(i) && !/^HTTP (400|401|403|404)$/.test(i.kind) && !(r.status === 404 && DEV_NOISE.test(i.msg)));
      issues.push(...other);   // 5xx và lỗi lạ vẫn tính vào mục C
      const toLogin = pr.login && ROLE === "guest" && norm(r.final.pathname) === "/dang-nhap" && redirectOk(new URL(MAIN + pr.path), r.final);
      const blank = r.text.trim().length < 15;
      const crashed = APP_ERROR.test(r.text);
      // Ngõ cụt: trang lỗi mà không có LIÊN KẾT nào để đi tiếp (phòng thi không có vỏ nên "Không tìm thấy đề thi" từng chỉ là một dòng chữ).
      const exits = toLogin ? 1 : await p.locator("a[href]:visible").count().catch(() => 0);
      const friendly = toLogin || r.status === 404 || FRIENDLY.test(r.text);
      const line = r.text.replace(/\s+/g, " ").trim().slice(0, 70);
      console.log(`   ${pr.path.replace(/[0-9a-f]{32}/g, ":token").padEnd(46)} → ${abs(r.final).replace(MAIN, "").replace(/[0-9a-f]{32}/g, ":token").slice(0, 44).padEnd(44)} [${r.status ?? "?"}] ${toLogin ? "(sang đăng nhập, giữ ?redirect=)" : "«" + line + "»"}`);
      if (js.length || blank || crashed || !friendly || exits === 0) bad.push(`${pr.path} (${pr.what}): ${js.length ? "lỗi JS: " + js[0].msg.slice(0, 90) : blank ? "trang trắng" : crashed ? "trang báo lỗi" : !friendly ? "không có lời giải thích" : "ngõ cụt (không có liên kết nào để đi tiếp)"}`);
      touched.add(new URL(MAIN + pr.path).pathname);
    }
    if (devNoise) console.log(`  ℹ ${devNoise} cảnh báo React của next dev ("Encountered a script tag…") ở trang 404 trong nhóm (parent) — không tính lỗi (xem chú thích trong mã), chưa kiểm được ở bản dựng production`);
    check(`${probes.length} địa chỉ sai / đã xoá đều có lời giải thích (hoặc sang đăng nhập), không sập, không trắng`, bad.length === 0, bad);
  }

  // ── B. nút ──
  section("B. Nút: bấm thử từng nút / tab / mục menu trên mỗi kiểu trang");
  const patternsDone = new Set<string>(), clickTargets: string[] = [];
  for (const v of visited) {
    if (v.why) continue;
    const fu = new URL(v.final);
    if (fu.origin !== MAIN_ORIGIN) continue;
    const pt = pattern(fu) + (fu.searchParams.get("tab") ? `?tab=${fu.searchParams.get("tab")}` : "") + (fu.pathname.endsWith("/nhap-ma-lop") && fu.searchParams.get("code") ? "?code" : "") + (fu.pathname.endsWith("/hoc-tap") && fu.searchParams.get("course") ? "?course" : "");
    if (patternsDone.has(pt)) continue;
    patternsDone.add(pt); clickTargets.push(v.final);
  }
  console.log(`  ${clickTargets.length} kiểu trang sẽ được bấm thử (tối đa ${MAX_BTN} nút mỗi trang)`);
  const clicks: Click[] = [];
  for (const url of clickTargets) {
    const n0 = clicks.length;
    await clickAudit(ctx, p, url, clicks).catch(e => console.log(`   (bỏ qua ${url}: ${String(e).slice(0, 100)})`));
    const mine = clicks.slice(n0);
    console.log(`  ${(new URL(url).pathname + new URL(url).search).slice(0, 56).padEnd(56)} ${String(mine.length).padStart(3)} nút: ${mine.filter(c => c.kind === "đổi trang").length} đổi trang, ${mine.filter(c => c.kind === "tab mới").length} tab mới, ${mine.filter(c => c.kind === "hộp thoại").length} hộp thoại`);
  }
  const badClicks = clicks.filter(c => c.why);
  for (const b of badClicks.slice(0, 40)) console.log(`   ✗ [${new URL(b.page).pathname}] «${b.label}» → ${b.dest?.replace(MAIN, "")}  (${b.why})`);
  check("mọi nút điều hướng đưa tới trang đúng (không 404 / không sai đích)", badClicks.length === 0, badClicks.slice(0, 6));
  const gateClicks = clicks.filter(c => c.kind === "đổi trang" && c.dest && new URL(c.dest).pathname === "/dang-nhap" && ROLE === "guest");
  if (gateClicks.length) console.log(`  ℹ ${gateClicks.length} nút của khách dẫn tới cổng đăng nhập (đúng thiết kế): ${gateClicks.slice(0, 5).map(c => `«${c.label}»@${new URL(c.page).pathname}`).join(", ")}`);
  const stuck = clicks.filter(c => c.kind === "không bấm được");
  for (const b of stuck.slice(0, 25)) console.log(`   ⚠ không bấm được [${new URL(b.page).pathname}] «${b.label}» — ${b.why}`);
  console.log(`  ℹ ${stuck.length} nút không bấm được trong trạng thái trang sạch — xem báo cáo`);
  const unnamedTotal = [...unnamed.values()].reduce((a, b) => a + b, 0);
  console.log(`  ℹ ${unnamedTotal} nút chỉ có biểu tượng, không có tên truy cập được, trên ${unnamed.size} kiểu trang (xem báo cáo)`);
  console.log(`  ℹ địa chỉ ngoài đã mở bằng nút: ${[...new Set(externalNavs.map(x => x.url))].slice(0, 6).join(" · ") || "không có"}`);

  // ── C. lỗi ──
  section("C. Lỗi: JS chưa bắt, console.error của ứng dụng, phản hồi HTTP ≥ 400");
  // Phản hồi 4xx KỲ VỌNG vì chính trang dùng nó để biết người xem chưa đăng nhập (rồi đưa sang /dang-nhap?redirect= — đã kiểm ở mục "Quyền" và "Địa chỉ sai"). Ghi rõ, không nuốt im lặng.
  const EXPECTED_HTTP: { role: "guest" | "student"; kind: RegExp; msg: RegExp; why: string }[] = [
    { role: "guest", kind: /^HTTP 401$/, msg: /^GET \/api\/questions\/[^/?]+$/, why: "trang câu hỏi Hỏi đáp dùng 401 để nhận ra khách chưa đăng nhập, rồi chuyển sang đăng nhập (ghi lại câu hỏi để quay về)" },
    { role: "student", kind: /^HTTP 403$/, msg: /^GET \/api\/lessons\/[^/?]+\/context$/, why: "học sinh CHƯA vào lớp mở bài trả phí → API từ chối 403, trang hiện 'Bài học này dành cho học sinh của lớp' (đã kiểm ở mục Cô lập, thế giới WORLD=empty)" },
  ];
  {
    const hits = issues.filter(i => EXPECTED_HTTP.some(e => e.role === ROLE && e.kind.test(i.kind) && e.msg.test(i.msg)));
    if (hits.length) {
      for (const h of hits) issues.splice(issues.indexOf(h), 1);
      console.log(`  ℹ ${hits.length} phản hồi 4xx KỲ VỌNG (đã loại khỏi kết quả): ${[...new Set(EXPECTED_HTTP.filter(e => e.role === ROLE).map(e => e.why))].join(" · ")}`);
    }
  }
  const byKind = new Map<string, Issue[]>();
  for (const i of issues) byKind.set(i.kind.startsWith("HTTP") ? "HTTP ≥ 400" : i.kind, [...(byKind.get(i.kind.startsWith("HTTP") ? "HTTP ≥ 400" : i.kind) ?? []), i]);
  for (const [k, list] of byKind) {
    const uniq = new Map<string, Issue>();
    for (const i of list) { const id = `${i.kind}|${i.msg}`; if (!uniq.has(id)) uniq.set(id, i); }
    console.log(`  ✗ ${k}: ${list.length} lần (${uniq.size} khác nhau)`);
    for (const i of [...uniq.values()].slice(0, 14)) console.log(`      [${i.at.replace(MAIN, "").slice(0, 60)}] ${i.kind} ${i.msg}`);
  }
  const who = ROLE === "guest" ? "của khách" : "của học sinh";
  check(`không có lỗi JS chưa bắt ở bất kỳ trang nào ${who}`, !issues.some(i => i.kind === "lỗi JS"), issues.filter(i => i.kind === "lỗi JS").slice(0, 3));
  check("không có console.error của ứng dụng", !issues.some(i => i.kind === "console.error"), issues.filter(i => i.kind === "console.error").slice(0, 3));
  check(`không có phản hồi HTTP ≥ 400 ở các trang / API ${who}`, !issues.some(i => i.kind.startsWith("HTTP")), issues.filter(i => i.kind.startsWith("HTTP")).slice(0, 5));

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
    try { const lu = new URL(x.href); lu.hash = ""; const v = vmap.get(abs(lu)); if (v) res = v.why === GATE ? "🔒 cần đăng nhập" : v.why ? `✗ ${v.why}` : v.requested === v.final ? "✓" : `✓→ ${v.final.replace(MAIN, "")}`; } catch { /* */ }
    lines.push(`  [${x.region}] «${x.text}» → ${x.href.replace(MAIN, "")}${x.blank ? " (tab mới)" : ""}   ${res}   (trên ${x.pages.size} trang)`);
  }
  lines.push("\n=== NÚT: mỗi nút đã bấm thử ===");
  for (const c of clicks) lines.push(`  [${new URL(c.page).pathname}${new URL(c.page).search}] «${c.label}» → ${c.kind}${c.dest ? " " + c.dest.replace(MAIN, "") : ""}${c.why ? "  ✗ " + c.why : ""}${c.issuesAfter ? `  (+${c.issuesAfter} lỗi)` : ""}`);
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

  // ── độ phủ: các kiểu trang của vai đã được mở ──
  const walk = (d: string, out: string[] = []) => { for (const n of readdirSync(join(process.cwd(), d))) { const q = join(d, n); if (statSync(join(process.cwd(), q)).isDirectory()) { if (n !== "generated" && n !== "node_modules") walk(q, out); } else out.push(q); } return out; };
  const pages = walk("src/app").filter(f => /\/page\.tsx?$/.test(f)).map(f => {
    const segs = f.replace(/^src\/app\//, "").replace(/\/page\.\w+$/, "").split("/").filter(Boolean);
    const group = segs.find(s => /^\(.*\)$/.test(s)) ?? "";
    return { group, path: "/" + segs.filter(s => !/^\(.*\)$/.test(s)).join("/") };
  });
  const mine = pages.filter(x => x.path !== "/kin-mau" && !x.path.startsWith("/admin") && (ROLE === "student" ? (x.group !== "" || x.path === "/page.tsx" || x.path === "/" || x.path === "/lop-cua-toi" || x.path === "/cai-dat/chu-de") : (x.group === "(guest)" || x.group === "(parent)" || x.path === "/page.tsx" || x.path === "/"))
    && !(ROLE === "student" && x.group === "(admin)") && !(ROLE === "guest" && x.path.startsWith("/student"))
    // Học sinh đã đăng nhập không có việc với các trang xác thực (quên / đặt lại mật khẩu, xác thực email, xác nhận phụ huynh): bỏ khỏi độ phủ của vai học sinh.
    && !(ROLE === "student" && /^\/(quen-mat-khau|dat-lai-mat-khau|xac-thuc-email|xac-nhan-phu-huynh)$/.test(x.path)));
  const vis = new Set(visited.map(v => new URL(v.final).pathname).concat(visited.map(v => new URL(v.requested).pathname), [...touched]));
  const match = (pt: string, path: string) => { const a = (pt === "/page.tsx" ? "/" : pt).split("/").filter(Boolean), b = path.split("/").filter(Boolean); return a.length === b.length && a.every((s, i) => /^\[.+\]$/.test(s) || s === b[i]); };
  const missing = mine.filter(x => ![...vis].some(v => match(x.path, v)));
  console.log(`Độ phủ trang của vai ${ROLE === "guest" ? "khách" : "học sinh"}: ${mine.length - missing.length}/${mine.length}${missing.length ? " — chưa mở: " + missing.map(x => x.path).join(", ") : ""}`);

  await closeAll();
  await prisma.$disconnect();
  done();
})().catch(async e => { console.error("CRASH", e); await closeAll(); process.exit(1); });
