// Mọi nút / liên kết phải đến ĐÚNG mục — duyệt bằng trình duyệt THẬT trên cả hai tên miền, theo từng vai (15/10/2026).
//
// Vì sao có bài này: Thọ mở https://admin.midnightelite-edu.com/dang-nhap?redirect=%2Fadmin và các nút ở đó (thanh trên, chân trang, "Quên mật khẩu?"…)
// đều quay lại chính trang đăng nhập. Bài `t-links` chỉ kiểm TĨNH rằng đường dẫn có trang thật, không biết tên miền: một liên kết hợp lệ ở tên miền chính
// vẫn có thể bị `src/proxy.ts` đẩy về /admin khi người dùng đang ở tên miền admin. Bài này mở thật từng đích, đúng tên miền, đúng cookie của vai đó.
//
// Cách làm, với mỗi kịch bản (vai × tên miền):
//   1. Duyệt (crawl) từ trang xuất phát: mở trang, bấm mở các menu thu gọn (menu tài khoản, "Thêm"…), gom mọi <a href>.
//   2. Mở thật TỪNG đích khác nhau (kể cả đích ở tên miền kia — cookie phiên là của riêng từng tên miền, như thật) rồi so điểm đến cuối với địa chỉ liên kết.
//   3. Sai nếu: HTTP ≥ 400, giao diện 404, bị đẩy về /dang-nhap (khi đã đăng nhập), hoặc điểm đến cuối KHÁC đường dẫn của liên kết mà không thuộc
//      danh sách chuyển hướng CÓ CHỦ ĐÍCH (EXPECTED_REDIRECT) bên dưới.
// Báo cáo đầy đủ (mọi cặp "nhãn → đích") ghi ra scratchpad/links-report.txt để đọc bằng mắt: đích có thể "đúng đường dẫn" nhưng sai ý nghĩa nhãn.
import { writeFileSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { launch, closeAll } from "./ui";
import { mkUser, mkTutor, mkSuper, mkCourse, wipe, check, section, done, cookieFor, type TUser } from "./h";
import { prisma } from "@/lib/prisma";
import type { BrowserContext, Page } from "playwright";

const PORT = Number(process.env.PORT ?? 3100);
const MAIN = `http://midnightelite-edu.com:${PORT}`;
const ADMIN = `http://admin.midnightelite-edu.com:${PORT}`;
const REPORT = process.env.LINK_REPORT ?? "scratchpad/links-report.txt";
const MAX_TARGETS = Number(process.env.MAX_TARGETS ?? 260); // trần số đích khác nhau cho mỗi kịch bản
const MAX_PER_PATTERN = 3; // một mẫu (/khoa-hoc/:id) chỉ mở tối đa chừng này mẫu cụ thể

type Rec = { from: string; href: string; text: string; region: string };
type Scenario = { name: string; origin: string; user: TUser | null; seeds: string[]; role: "guest" | "student" | "tutor" | "super" | "content" };
type Outcome = { sc: string; requested: string; final: string; status: number | null; why: string | null; links: Rec[] };

const isId = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(s) || /^c[a-z0-9]{20,}$/i.test(s) || /^\d{3,}$/.test(s) || /^(lop|u|kh)-[a-z0-9-]{6,}$/i.test(s) || (/^[a-z0-9_-]{16,}$/i.test(s) && /\d/.test(s));
const pattern = (u: URL) => u.pathname.split("/").map(s => (s && isId(s) ? ":id" : s)).join("/");
const norm = (p: string) => (p.length > 1 ? p.replace(/\/+$/, "") : p);
const abs = (u: URL) => `${u.protocol}//${u.host}${u.pathname}${u.search}`;

const PROTECTED = [/^\/student(\/|$)/, /^\/lop-cua-toi(\/|$)/, /^\/admin(\/|$)/, /^\/cai-dat(\/|$)/]; // khu cần đăng nhập: (student), lop-cua-toi, (admin)
const isProtected = (p: string) => PROTECTED.some(r => r.test(p));

// Chuyển hướng CÓ CHỦ ĐÍCH: (kịch bản, đường dẫn yêu cầu) → đường dẫn cuối được chấp nhận.
//   - Người đã đăng nhập mở trang chủ / đăng nhập / đăng ký thì vào thẳng dashboard (hostRouting.ts).
//   - Gia sư mở bảng tổng quan quản trị /admin thì về Hộp việc.
// Bí danh cũ trong vỏ học viên (Quyết định S 15/10): thanh bên trỏ /student/thi-thu… rồi các trang này chuyển tới trang công khai tương ứng, mở TRONG khung thanh bên.
const STUDENT_ALIASES: Record<string, string> = {
  "/student/thi-thu": "/thi-thu", "/student/bang-xep-hang": "/bang-xep-hang", "/student/cong-dong": "/cong-dong", "/student/hoi-dap": "/cong-dong",
  "/student/tin-tuc": "/tin-tuc", "/student/tra-cuu": "/tra-cuu",
};
// Trang CHỈ để chuyển hướng (page.tsx gọi redirect()): không phải liên kết sai mà là cửa vào cũ / ngắn gọn.
const PAGE_REDIRECTS: Record<string, string> = { "/student": "/student/viec-cua-toi", "/admin/khoa-hoc/tao-moi": "/admin/khoa-hoc", "/admin/thi-thu/tao-moi": "/admin/thi-thu" };
function expectedRedirect(sc: Scenario, reqPath: string, finPath: string): boolean {
  if (STUDENT_ALIASES[reqPath] === finPath) return true;
  if (PAGE_REDIRECTS[reqPath] === finPath) return true;
  // /ban-do là bản đồ cho MỌI người, có mục "Gia sư" (Lịch / Lớp / Học phí): quản trị không có vỏ gia sư nên các trang này đưa họ về danh sách lớp /lop-cua-toi.
  if ((sc.role === "super" || sc.role === "content") && /^\/lop-cua-toi\/(lich|lop|hoc-phi)$/.test(reqPath)) return finPath === "/lop-cua-toi";
  if ((sc.role === "student" || sc.role === "tutor") && ["/", "/dang-nhap", "/dang-ky"].includes(reqPath)) {
    return finPath === (sc.role === "student" ? "/student/viec-cua-toi" : "/lop-cua-toi");
  }
  if (sc.role === "tutor" && reqPath === "/admin") return finPath === "/lop-cua-toi";
  return false;
}

async function settle(p: Page) {
  await p.waitForLoadState("domcontentloaded").catch(() => {});
  await p.waitForLoadState("networkidle", { timeout: 7000 }).catch(() => {});
  // điều hướng phía trình duyệt (AuthGuard, router.replace) có thể đến muộn: chờ tới khi URL đứng yên ~700 ms
  let last = p.url(), still = 0;
  for (let i = 0; i < 24 && still < 4; i++) {
    await p.waitForTimeout(180);
    const now = p.url();
    if (now === last) still++; else { last = now; still = 0; await p.waitForLoadState("networkidle", { timeout: 4000 }).catch(() => {}); }
  }
}

const COLLECT = `(() => {
  const out = [];
  for (const a of document.querySelectorAll('a[href]')) {
    const raw = a.getAttribute('href') || '';
    if (!raw || raw.startsWith('#') || raw.startsWith('javascript:')) continue;
    const reg = a.closest('header,footer,nav,aside,[role=dialog],[role=menu],main');
    const region = reg ? reg.tagName.toLowerCase() + (reg.getAttribute('aria-label') ? '[' + reg.getAttribute('aria-label') + ']' : '') : 'body';
    out.push({ href: a.href, text: (a.getAttribute('aria-label') || a.innerText || a.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 70), region, download: a.hasAttribute('download') });
  }
  return out;
})()`;

async function collect(p: Page, from: string, openMenus: boolean): Promise<Rec[]> {
  const grab = async () => (await p.evaluate(COLLECT) as { href: string; text: string; region: string; download: boolean }[]).filter(l => !l.download).map(l => ({ from, href: l.href, text: l.text, region: l.region }));
  const all: Rec[] = await grab();
  if (openMenus) {
    // Menu thu gọn (menu tài khoản, "Thêm", chuông…): bấm từng nút mở rồi gom thêm liên kết. Chỉ đọc, không bấm nút nào có chữ nguy hiểm.
    const n = await p.locator('header button[aria-expanded="false"], aside button[aria-expanded="false"], nav button[aria-expanded="false"], button[aria-haspopup]').count().catch(() => 0);
    for (let i = 0; i < Math.min(n, 12); i++) {
      const b = p.locator('header button[aria-expanded="false"], aside button[aria-expanded="false"], nav button[aria-expanded="false"], button[aria-haspopup]').nth(i);
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

async function open(p: Page, url: string): Promise<{ status: number | null; final: URL; text: string }> {
  let status: number | null = null;
  const onResp = (r: import("playwright").Response) => { if (r.request().isNavigationRequest() && r.request().frame() === p.mainFrame() && status === null) status = r.status(); };
  p.on("response", onResp);
  try {
    // mọi chuyển hướng 3xx của máy chủ được trình duyệt tự theo; status ở đây là của yêu cầu điều hướng đầu tiên → ghi lại phản hồi CUỐI bằng response của goto
    const resp = await p.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => null);
    status = resp ? resp.status() : status;
    await settle(p);
  } finally { p.off("response", onResp); }
  const text = await p.evaluate(`document.body ? document.body.innerText.slice(0, 4000) : ''`).catch(() => "") as string;
  return { status, final: new URL(p.url()), text };
}

const GATE = "cổng đăng nhập (trang cần đăng nhập — đúng thiết kế với khách)";
// Quản trị đang đăng nhập ở tên miền CHÍNH bấm liên kết /admin/...: sang tên miền admin, nơi cookie phiên là của RIÊNG tên miền đó nên phải đăng nhập lại (giới hạn đã biết,
// xem docs/kin/tien-do-dang-do.md mục V). Chỉ chấp nhận khi trang đăng nhập đó GIỮ ?redirect= đúng trang đã bấm — đăng nhập xong về đúng chỗ.
const HOSTGATE = "sang tên miền admin, phải đăng nhập lại (cookie mỗi tên miền một phiên — giới hạn đã biết)";
function judge(sc: Scenario, requested: URL, r: { status: number | null; final: URL; text: string }): string | null {
  if (r.status !== null && r.status >= 400) return `HTTP ${r.status}`;
  if (/Trang không tồn tại|This page could not be found|Đường dẫn bạn truy cập không tồn tại/i.test(r.text)) return "giao diện 404";
  const reqP = norm(requested.pathname), finP = norm(r.final.pathname);
  if (finP === "/dang-nhap" && reqP !== "/dang-nhap") {
    const gated = isProtected(reqP) || (requested.host === new URL(ADMIN).host && reqP === "/"); // '/' của tên miền admin = dashboard quản trị
    const crossHost = sc.user && requested.host !== r.final.host && r.final.host === new URL(ADMIN).host && /^\/admin(\/|$)/.test(reqP);
    if (crossHost && r.final.searchParams.get("redirect") === requested.pathname + requested.search) return HOSTGATE;
    return sc.user ? "bị đẩy về trang đăng nhập dù đã đăng nhập" : gated ? GATE : "bị đẩy về trang đăng nhập";
  }
  if (reqP !== finP) return expectedRedirect(sc, reqP, finP) ? null : `đổi đích: ${requested.host}${reqP} → ${r.final.host}${finP}`;
  return null;
}

async function runScenario(browser: import("playwright").Browser, sc: Scenario, outcomes: Outcome[], allLinks: Map<string, Rec[]>) {
  const ctx: BrowserContext = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "vi-VN" });
  if (sc.user) {
    const [name, ...rest] = (await cookieFor(sc.user)).split("=");
    await ctx.addCookies([{ name, value: rest.join("="), url: sc.origin }]); // cookie phiên CHỈ của tên miền này, như thật
  }
  const p = await ctx.newPage();
  p.on("dialog", d => { void d.dismiss(); });
  const seen = new Set<string>(); // địa chỉ đã mở
  const perPattern = new Map<string, number>();
  const queue: { url: string; menus: boolean }[] = sc.seeds.map(s => ({ url: s.startsWith("http") ? s : sc.origin + s, menus: true }));
  const external = new Map<string, string>();
  let opened = 0;
  while (queue.length && opened < MAX_TARGETS) {
    const { url, menus } = queue.shift()!;
    const u = new URL(url); u.hash = "";
    const key = abs(u);
    if (seen.has(key)) continue;
    const pat = u.origin + pattern(u);
    if ((perPattern.get(pat) ?? 0) >= MAX_PER_PATTERN) continue;
    perPattern.set(pat, (perPattern.get(pat) ?? 0) + 1);
    seen.add(key);
    opened++;
    const r = await open(p, key);
    const why = judge(sc, u, r);
    // gom liên kết trên trang đích (kể cả khi bị đẩy sang trang khác: gom trên trang CUỐI, ghi theo trang cuối)
    const finalKey = abs(r.final);
    const links = (r.final.pathname.startsWith("/api") ? [] : await collect(p, finalKey, menus).catch(() => [])) as Rec[];
    outcomes.push({ sc: sc.name, requested: key, final: finalKey, status: r.status, why, links: [] });
    if (!allLinks.has(sc.name + "|" + finalKey)) allLinks.set(sc.name + "|" + finalKey, links);
    if (r.final.origin !== new URL(sc.origin).origin) continue; // bị đẩy sang tên miền khác: ghi nhận kết quả, không duyệt tiếp từ đó
    for (const l of links) {
      let lu: URL; try { lu = new URL(l.href); } catch { continue; }
      if (!/^https?:$/.test(lu.protocol)) { external.set(l.href, l.text); continue; }
      const internal = lu.host === new URL(MAIN).host || lu.host === new URL(ADMIN).host;
      if (!internal) { if (!/agentation\./.test(lu.host)) external.set(l.href, l.text); continue; } // agentation.*: thanh công cụ dev, không phải của KiN
      if (lu.pathname.startsWith("/api") || /\.(pdf|csv|xlsx?|docx?|zip|png|jpe?g|svg|webp|mp4)$/i.test(lu.pathname)) { external.set(l.href, l.text + " [tệp/API]"); continue; }
      lu.hash = "";
      queue.push({ url: abs(lu), menus: false });
    }
  }
  if (queue.length) console.log(`  (kịch bản ${sc.name}: còn ${queue.length} đích chưa mở do trần ${MAX_TARGETS})`);
  await ctx.close();
  return external;
}

(async () => {
  mkdirSync("scratchpad", { recursive: true });
  await wipe();
  const T = await mkTutor("Gia sư Link");
  const S = await mkUser({ name: "Học viên Link" });
  const SA = await mkSuper("Quản trị cấp 1");
  const CA = await mkUser({ name: "Quản trị nội dung", role: "admin", adminRole: "admin_content" });
  const C = await mkCourse(T.id, { name: "Toán 9 Link" });
  await prisma.user.update({ where: { id: T.id }, data: { preferences: { modules: ["hop-viec", "lop", "bai-kt", "thu-vien"] } } });
  await prisma.enrollment.create({ data: { userId: S.id, courseId: C.id, status: "active" } });
  // Dữ liệu mẫu để các danh sách có liên kết tới trang chi tiết (tin, bài cộng đồng, hỏi đáp, bài giảng, đề thi)
  await prisma.article.create({ data: { slug: "tin-thu-nghiem", title: "Tin thử nghiệm", excerpt: "Tóm tắt", content: "Nội dung", category: "tuyen-sinh", author: "KiN", authorId: SA.id, published: true, publishedAt: new Date() } });
  await prisma.thread.create({ data: { content: "Bài cộng đồng thử nghiệm", authorId: S.id, category: "hoi-dap" } });
  await prisma.question.create({ data: { authorId: S.id, title: "Câu hỏi thử nghiệm", content: "Nội dung câu hỏi", bountyPaid: 0 } });
  const sec = await prisma.section.create({ data: { id: "sec-link", title: "Phần 1", courseId: C.id } });
  const chap = await prisma.chapter.create({ data: { id: "chap-link", title: "Chương 1", sectionId: sec.id } });
  await prisma.lesson.create({ data: { id: "les-link", code: "B1", title: "Bài 1", type: "record", chapterId: chap.id, isLocked: false } });
  await prisma.exam.create({ data: { id: "exam-link", code: "DE-LINK", title: "Đề thử nghiệm", category: "toan", date: "2026-10-20", time: "08:00", duration: "60", questions: 0, status: "available", createdAt: new Date().toISOString(), ownerId: T.id, courseId: C.id } });

  const PUBLIC_SEEDS = ["/", "/khoa-hoc", "/thi-thu", "/cong-dong", "/tin-tuc", "/giang-vien", "/diem-chuan", "/bang-xep-hang", "/phu-huynh", "/chinh-sach", "/dang-nhap", "/dang-ky", "/dang-ky?vai=gia-su", "/quen-mat-khau", "/dat-lai-mat-khau?token=" + "0".repeat(64), "/thu-vien"];
  const scenarios: Scenario[] = [
    { name: "khách@chính", origin: MAIN, user: null, role: "guest", seeds: PUBLIC_SEEDS },
    { name: "khách@admin", origin: ADMIN, user: null, role: "guest", seeds: ["/dang-nhap?redirect=%2Fadmin", "/dang-nhap", "/admin", "/"] },
    { name: "học viên@chính", origin: MAIN, user: S, role: "student", seeds: ["/student/viec-cua-toi", "/khoa-hoc", "/thi-thu"] },
    { name: "gia sư@chính", origin: MAIN, user: T, role: "tutor", seeds: ["/lop-cua-toi", "/khoa-hoc"] },
    { name: "quản trị cấp 1@admin", origin: ADMIN, user: SA, role: "super", seeds: ["/admin"] },
    { name: "quản trị nội dung@admin", origin: ADMIN, user: CA, role: "content", seeds: ["/admin"] },
    // quản trị đăng nhập ở tên miền chính để xem thử như học viên (AuthGuard cho phép) — khung học viên của họ
    { name: "quản trị cấp 1@chính", origin: MAIN, user: SA, role: "super", seeds: ["/student/viec-cua-toi", "/khoa-hoc"] },
  ];
  const only = process.env.ONLY?.split(",");
  const browser = await launch();
  const outcomes: Outcome[] = [];
  const allLinks = new Map<string, Rec[]>();
  const externals = new Map<string, string>();
  const lines: string[] = [];
  for (const sc of scenarios) {
    if (only && !only.includes(sc.name)) continue;
    section(`Kịch bản: ${sc.name}`);
    const t0 = Date.now();
    const before = outcomes.length;
    const ext = await runScenario(browser, sc, outcomes, allLinks);
    for (const [k, v] of ext) externals.set(`${sc.name} ${k}`, v);
    const mine = outcomes.slice(before);
    const bad = mine.filter(o => o.why && o.why !== GATE && o.why !== HOSTGATE);
    const gates = mine.filter(o => o.why === GATE);
    const hostGates = mine.filter(o => o.why === HOSTGATE);
    if (hostGates.length) console.log(`  ℹ ${hostGates.length} đích /admin/... mở từ tên miền chính phải đăng nhập lại ở tên miền admin (giới hạn đã biết, ?redirect= giữ đúng trang): ${hostGates.slice(0, 4).map(g => new URL(g.requested).pathname).join(", ")}${hostGates.length > 4 ? " …" : ""}`);
    if (gates.length) console.log(`  ℹ ${gates.length} đích cần đăng nhập (khách bị đưa tới /dang-nhap): ${gates.slice(0, 4).map(g => new URL(g.requested).pathname).join(", ")}${gates.length > 4 ? " …" : ""}`);
    console.log(`  đã mở ${mine.length} đích trong ${Math.round((Date.now() - t0) / 1000)} giây`);
    const grouped = new Map<string, string[]>();
    for (const o of bad) { const k = o.why!; grouped.set(k, [...(grouped.get(k) ?? []), `${o.requested}  →  ${o.final}`]); }
    for (const [why, list] of grouped) { console.log(`  ✗ [${list.length}] ${why}`); for (const x of list.slice(0, 6)) console.log(`      ${x}`); if (list.length > 6) console.log(`      … và ${list.length - 6} nữa`); }
    check(`${sc.name}: mọi đích mở ra đúng mục (không quay vòng / 404 / sai đích)`, bad.length === 0, bad.slice(0, 5).map(b => `${b.requested} → ${b.final} (${b.why})`));
  }

  // Báo cáo đầy đủ: mỗi liên kết khác nhau (vùng · nhãn → đích) một dòng cho cả kịch bản, kèm số trang có nó và kết quả mở thật.
  const byTarget = new Map<string, Outcome>();
  for (const o of outcomes) byTarget.set(o.sc + "|" + o.requested, o);
  const uniq = new Map<string, { sc: string; region: string; text: string; href: string; pages: Set<string>; res: string }>();
  for (const [k, links] of allLinks) {
    const sc = k.split("|")[0];
    for (const l of links) {
      let lu: URL; try { lu = new URL(l.href); } catch { continue; }
      lu.hash = "";
      const o = byTarget.get(sc + "|" + abs(lu));
      const res = o ? (o.why === GATE ? "🔒 cần đăng nhập" : o.why === HOSTGATE ? "↪ đăng nhập lại ở tên miền admin" : o.why ? `✗ ${o.why}` : o.requested === o.final ? "✓" : `✓→ ${o.final}`) : "·";
      const id = `${sc}|${l.region}|${l.text}|${l.href}`;
      const cur = uniq.get(id) ?? { sc, region: l.region, text: l.text, href: l.href, pages: new Set<string>(), res };
      cur.pages.add(new URL(l.from).pathname);
      uniq.set(id, cur);
    }
  }
  let lastSc = "";
  for (const u2 of [...uniq.values()].sort((a, b) => a.sc.localeCompare(b.sc) || a.region.localeCompare(b.region) || a.href.localeCompare(b.href))) {
    if (u2.sc !== lastSc) { lines.push(`\n=== ${u2.sc} ===`); lastSc = u2.sc; }
    lines.push(`  [${u2.region}] «${u2.text}» → ${u2.href}   ${u2.res}   (trên ${u2.pages.size} trang${u2.pages.size <= 2 ? ": " + [...u2.pages].join(", ") : ""})`);
  }
  lines.push("\n=== Liên kết ra ngoài / mailto / tel / tệp ===");
  for (const [k, v] of externals) lines.push(`  ${k}   «${v}»`);
  writeFileSync(REPORT, lines.join("\n"), "utf-8");
  console.log(`\nBáo cáo đầy đủ: ${REPORT} (${lines.length} dòng)`);

  // Độ phủ: đã mở bao nhiêu KIỂU trang trong tổng số trang của ứng dụng
  const ROOT = process.cwd();
  const walk = (d: string, out: string[] = []) => { for (const n of readdirSync(join(ROOT, d))) { const q = join(d, n); if (statSync(join(ROOT, q)).isDirectory()) { if (n !== "generated" && n !== "node_modules") walk(q, out); } else out.push(q); } return out; };
  const patterns = walk("src/app").filter(f => /\/page\.tsx?$/.test(f)).map(f => "/" + f.replace(/^src\/app\//, "").replace(/\/page\.\w+$/, "").split("/").filter(s => s && !/^\(.*\)$/.test(s)).join("/")).map(s => (s === "/" ? "/" : s));
  const visited = new Set(outcomes.map(o => new URL(o.final).pathname));
  const matches = (pat: string, p: string) => { const a = pat.split("/").filter(Boolean), b = p.split("/").filter(Boolean); return a.length === b.length && a.every((s, i) => /^\[.+\]$/.test(s) || s === b[i]); };
  const covered = patterns.filter(pt => [...visited].some(v => matches(pt, v)));
  console.log(`Độ phủ: đã mở ${covered.length}/${patterns.length} kiểu trang của ứng dụng (kiểu chưa mở: ${patterns.filter(pt => !covered.includes(pt)).length})`);
  writeFileSync("scratchpad/links-uncovered.txt", patterns.filter(pt => !covered.includes(pt)).join("\n"), "utf-8");
  void readFileSync;

  await closeAll();
  await prisma.$disconnect();
  done();
})().catch(async e => { console.error("CRASH", e); await closeAll(); process.exit(1); });
