// NC2-021 — ĐO onboarding của gia sư MỚI TINH ("lớp đầu tiên trong 2 phút", báo cáo research 8.4A + mục 1 #6).
// Đây là bài ĐO, không phải cổng chặn: các ngưỡng chỉ in "VƯỢT NGƯỠNG", không làm bài đỏ. `check()` chỉ kiểm ĐÚNG/SAI CHỨC NĂNG
// (lớp có trong DB, lịch lưu, mã mời tạo ra, Hộp việc mở được, không lỗi JS/HTTP ≥ 400 ngoài danh sách chấp nhận có lý do).
//
// Hành trình (người thật dùng chuột + bàn phím, không gọi API tắt):
//   G1  Trang chủ → "Đăng ký" → form gia sư 2 bước → "Kiểm tra hộp thư" → thư trong EMAIL_SINK_DIR → liên kết xác thực
//   --  (NGOÀI người dùng) quản trị bấm duyệt hồ sơ (qua API, như các bài khác) — KHÔNG tính vào số đo
//   G2  Đăng xuất phiên "học viên" cũ + Đăng nhập lại (phiên mới mang quyền gia sư) → vào app gia sư → "Tạo lớp đầu tiên" → drawer → lưu
//   G3  Khung giờ học hằng tuần (trang quản khoá → tab Lịch học)
//   G4  "Mời cả lớp một lần" (ĐX-07, tab Mã mời của lớp)
//   G5  Hộp việc (mặc định TẮT ở chế độ gọn → bật ở Cài đặt rồi mở)
//
// THỜI GIAN là thời gian MÁY đo trên máy dev (có cả thời gian biên dịch lần đầu của Next dev), KHÔNG phải thời gian người.
// Để khách quan: chạy bài HAI lần liên tiếp và lấy số lần hai (máy ấm). Mỗi lần chạy xoá sạch DB riêng (wipe) rồi tự dựng dữ liệu.
import { mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { BASE, mkSuper, api, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, closeAll } from "./ui";
import type { Page, Locator } from "./ui";
import { prisma } from "@/lib/prisma";
import { vnDateKeyOf, dayOfWeekOfKey } from "@/lib/classSessions";

const SINK = process.env.EMAIL_SINK_DIR;
if (!SINK) { console.error("Cần EMAIL_SINK_DIR (xem env.example.sh) và server dev chạy với cùng biến này."); process.exit(2); }
type Mail = { to: string; subject: string; html?: string; text?: string };
const mails = (to: string): Mail[] => readdirSync(SINK).sort().map(f => JSON.parse(readFileSync(join(SINK, f), "utf8")) as Mail).filter(m => m.to === to);

// ─── ngưỡng MỀM (chỉ in, không làm đỏ) ───
const T_SCREENS = 3, T_MS = 120_000, T_REQ_CREATE = 3;

// ─── bộ đo ───
type Stage = { id: string; name: string; clicks: number; types: number; ms: number; t0: number; subs: string[] };
const stages: Stage[] = [];
let cur: Stage | null = null;
const begin = (id: string, name: string) => { cur = { id, name, clicks: 0, types: 0, ms: 0, t0: Date.now(), subs: [] }; stages.push(cur); };
const end = () => { if (cur) cur.ms = Date.now() - cur.t0; cur = null; };
// Thao tác như người dùng: mỗi lần bấm / mỗi lần gõ một chuỗi được đếm vào giai đoạn đang chạy.
const click = async (l: Locator, timeout = 60000) => { if (cur) cur.clicks++; await l.click({ timeout }); };
const typeIn = async (l: Locator, text: string, timeout = 60000) => { if (cur) cur.types++; await l.fill(text, { timeout }); };
// 'Màn con' = bước giao diện KHÔNG đổi đường dẫn (mở drawer, đổi tab, mở form) — ghi lại để so với 'màn' (đổi trang).
const sub = (label: string) => { cur?.subs.push(label); };
const pick = async (l: Locator, v: string | number, timeout = 60000) => { if (cur) cur.clicks++; await l.selectOption(String(v), { timeout }); };   // chọn trong ô xổ = 1 lần bấm (đã tính)

// Màn = lần đổi đường dẫn (pathname) khác nhau mà gia sư đi qua. Ghi mọi lần chuyển trang (cả chuyển kiểu SPA), sau bỏ chặng đệm
// (xem collapse) và gộp liên tiếp cùng đường dẫn (khác ?query như ?tao=1, ?tab=… vẫn là một màn; tab/drawer ghi riêng ở 'màn con').
type Nav = { t: number; stage: string; path: string; full: string };
const navs: Nav[] = [];

// Ô bắt buộc trên màn đang hiện: ô có thuộc tính required/aria-required VÀ ô có nhãn gắn dấu * (hợp lại, không đếm trùng).
async function requiredOn(p: Page, rootSel?: string): Promise<{ attr: number; star: number; n: number; texts: string[] }> {
  // Chạy dạng CHUỖI (không phải hàm): tsx/esbuild chèn __name() vào hàm lồng nhau, không có trong trang → ReferenceError.
  const script = `(() => {
    var sel = ${JSON.stringify(rootSel ?? null)};
    var root = (sel ? document.querySelector(sel) : null) || document;
    function vis(el) { var r = el.getBoundingClientRect(); var s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; }
    function ok(el) { return !el.closest("[data-agentation], [id*='agentation'], [class*='agentation']"); }
    var ctrls = Array.prototype.slice.call(root.querySelectorAll("input, select, textarea")).filter(function (e) { return e.type !== "hidden" && vis(e) && ok(e); });
    var reqCtl = ctrls.filter(function (e) { return e.required || e.getAttribute("aria-required") === "true"; });
    var labels = Array.prototype.slice.call(root.querySelectorAll("label")).filter(function (l) { return vis(l) && ok(l) && (l.textContent || "").indexOf("*") >= 0; });
    var ids = {}; var n = 0;
    reqCtl.forEach(function (e, i) { var k = "c" + (e.id || i); if (!ids[k]) { ids[k] = 1; n++; } });
    labels.forEach(function (l, i) { var f = l.htmlFor; if (!(f && ids["c" + f])) { ids["l" + i] = 1; n++; } });
    return { attr: reqCtl.length, star: labels.length, n: n, texts: labels.map(function (l) { return (l.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 40); }) };
  })()`;
  return await p.evaluate(script) as { attr: number; star: number; n: number; texts: string[] };
}
const screensReq: { stage: string; screen: string; attr: number; star: number; n: number; note?: string; texts: string[] }[] = [];
async function req(p: Page, screen: string, note?: string, rootSel?: string, extra = 0) {
  const r = await requiredOn(p, rootSel);
  screensReq.push({ stage: cur?.id ?? "-", screen, attr: r.attr, star: r.star, n: r.n + extra, note, texts: r.texts });
  return r.n + extra;
}

(async () => {
  rmSync(SINK, { recursive: true, force: true }); mkdirSync(SINK, { recursive: true });
  await wipe();
  const stamp = Date.now().toString(36);
  const email = `gs-moi-${stamp}@test.local`;
  const PASS = "Passw0rd!";
  const NAME = "Cô Mai Mới";
  const root = await mkSuper("Quản trị duyệt hồ sơ");   // chỉ để bấm duyệt (bước ngoài của người dùng)

  await launch();
  const errors: string[] = [];
  const bad: { status: number; method: string; url: string }[] = [];
  const ctx = await ctxFor(null, { width: 1280, height: 900 });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await ctx.setExtraHTTPHeaders({ "x-forwarded-for": `10.93.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` });
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE }).catch(() => {});
  const zalo: string[] = [];
  await ctx.route(/\/\/(zalo\.me|chat\.zalo\.me)\//, route => { zalo.push(route.request().url()); void route.fulfill({ status: 200, contentType: "text/html", body: "<title>zalo</title>" }); });
  const p = await ctx.newPage();
  p.on("pageerror", e => errors.push(String(e)));
  p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|favicon|font|status of 4\d\d/i.test(m.text())) errors.push(m.text()); });
  p.on("response", r => { if (r.status() >= 400 && r.url().startsWith(BASE)) bad.push({ status: r.status(), method: r.request().method(), url: r.url().replace(BASE, "") }); });
  p.on("framenavigated", f => { if (f === p.mainFrame()) { const u = new URL(f.url()); navs.push({ t: Date.now(), stage: cur?.id ?? "-", path: u.pathname, full: u.pathname + u.search }); } });
  const at = () => new URL(p.url());
  const body = async () => await p.locator("body").innerText();
  const GOTO = { waitUntil: "domcontentloaded" as const, timeout: 180000 };

  // ───────────────────────── G1: đăng ký gia sư → xác thực email ─────────────────────────
  begin("G1", "đăng ký → xác thực email");
  section("G1. Trang chủ → 'Đăng ký' → form gia sư");
  await p.goto(`${BASE}/`, GOTO);   // mở trang chủ (người dùng gõ địa chỉ/bấm liên kết: không tính là bấm)
  await click(p.locator('header a[href="/dang-ky"]').first());
  await eventually("tới /dang-ky", () => at().pathname === "/dang-ky", 90000);
  await p.getByRole("button", { name: /^Gia sư/ }).waitFor({ timeout: 90000 });
  await click(p.getByRole("button", { name: /^Gia sư/ }));
  await p.getByText("Giới thiệu bản thân").first().waitFor({ timeout: 30000 });
  // Bước 1: họ tên *, số điện thoại *, giới thiệu (≥ 30 ký tự, máy chủ đòi — nhãn không có dấu *) , môn dạy *
  const r1 = await req(p, "đăng ký gia sư — bước 1", "gồm cả 'Giới thiệu bản thân *' (≥ 30 ký tự)");
  await typeIn(p.getByPlaceholder("Nguyễn Văn A"), NAME);
  await typeIn(p.getByPlaceholder("0901 234 567"), "0912345678");
  await typeIn(p.getByPlaceholder(/Mình là sinh viên năm 3/), "Cử nhân Toán, 3 năm dạy kèm lớp 9 và ôn thi vào 10 cho học sinh ở Hà Nội.");
  await click(p.getByRole("button", { name: "Toán", exact: true }));
  await click(p.getByRole("button", { name: /Tiếp theo/ }));
  sub("đăng ký: bước 2 (email, mật khẩu)");
  await p.getByPlaceholder("ten@gmail.com").waitFor({ timeout: 30000 });
  const r2 = await req(p, "đăng ký gia sư — bước 2", "email, mật khẩu, nhập lại mật khẩu, ô đồng ý điều khoản (ô tích không có dấu *)", undefined, 1);
  await typeIn(p.getByPlaceholder("ten@gmail.com"), email);
  await typeIn(p.getByPlaceholder("Tối thiểu 8 ký tự"), PASS);
  await typeIn(p.getByPlaceholder("Nhập lại mật khẩu"), PASS);
  await click(p.locator('form input[type="checkbox"]'));
  await click(p.getByRole("button", { name: "Tạo tài khoản miễn phí" }));
  sub("đăng ký: trang 'Kiểm tra hộp thư'");
  await eventually("hiện 'Kiểm tra hộp thư' đúng email", async () => { const b = await body(); return b.includes("Kiểm tra hộp thư") && b.includes(email); }, 60000);
  section("G1b. Thư xác thực (ghi ra EMAIL_SINK_DIR, KHÔNG gửi đi) → liên kết → xác thực");
  await eventually("thư xác thực đã ghi ra thư mục", () => mails(email).some(m => /xác thực/i.test(m.subject)), 30000);
  const mail = mails(email).find(m => /xác thực/i.test(m.subject))!;
  const link = `${mail.html ?? ""}\n${mail.text ?? ""}`.match(/https?:\/\/[^"'\s<>]*xac-thuc-email\?token=[A-Za-z0-9_\-%.]+/)?.[0];
  check("thư có liên kết xác thực", !!link, (mail.html ?? mail.text ?? "").slice(0, 200));
  if (cur) cur.clicks++;   // người dùng mở thư và bấm liên kết = 1 lần bấm
  await p.goto(`${BASE}${new URL(link!).pathname}${new URL(link!).search}`, GOTO);
  await eventually("trang báo 'Xác thực thành công'", async () => (await body()).includes("Xác thực thành công"), 60000);
  await eventually("tự chuyển sang trang đầu của vai (hồ sơ gia sư còn chờ duyệt nên vẫn là học viên)", () => at().pathname.startsWith("/student/"), 30000);
  const landedAfterVerify = at().pathname;
  await p.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  const pendingText = await body();
  end();
  const u0 = await prisma.user.findUnique({ where: { email } });
  check("DB: tài khoản có đơn gia sư đang chờ, email đã xác thực", !!u0 && u0.emailVerified === true && !!u0.tutorAppliedAt && u0.role === "student", u0 && { v: u0.emailVerified, r: u0.role });
  check("DB: giới thiệu + môn dạy đã lưu", !!u0 && (u0.bio ?? "").includes("Cử nhân Toán") && JSON.stringify(u0.subjects) === JSON.stringify(["Toán"]));

  console.log(`    (sau xác thực gia sư thấy trang ${landedAfterVerify}; có nhắc "hồ sơ chờ duyệt"? ${/chờ.*duyệt|duyệt/i.test(pendingText) ? "CÓ" : "KHÔNG"})`);

  // ───────────────────── Bước NGOÀI người dùng: quản trị duyệt hồ sơ (không tính vào số đo) ─────────────────────
  section("(ngoài người dùng) Quản trị bấm duyệt hồ sơ qua API");
  const ap = await api("POST", `/api/admin/tutor-applications/${u0!.id}/approve`, { as: root });
  check("quản trị duyệt hồ sơ → 200", ap.status === 200, ap);
  const u1 = await prisma.user.findUnique({ where: { id: u0!.id } });
  check("DB: đã thành gia sư (role admin / adminRole teacher / tutorVerified)", u1?.role === "admin" && u1?.adminRole === "teacher" && u1?.tutorVerified === true);
  const note = await prisma.notification.findFirst({ where: { userId: u0!.id, type: "tutor_approved" } });
  check("gia sư nhận thông báo 'đã được duyệt' có liên kết vào khung gia sư", !!note && note.link === "/lop-cua-toi", note && { msg: note.message, link: note.link });

  // ───────────────────── G2: vào app gia sư → tạo lớp đầu tiên ─────────────────────
  begin("G2", "xác thực → lớp đầu tiên đã tạo");
  section("G2a. Phiên cũ còn là học viên → đăng xuất, đăng nhập lại (thông báo duyệt dặn 'Đăng nhập lại')");
  await p.goto(`${BASE}/student/viec-cua-toi`, GOTO);
  await click(p.getByRole("button", { name: /^Tài khoản của/ }));
  sub("menu tài khoản");
  await click(p.getByRole("menuitem", { name: "Đăng xuất" }));
  await eventually("về trang chủ khách", () => at().pathname === "/", 60000);
  await click(p.locator('header a[href="/dang-nhap"]').first());
  await eventually("tới /dang-nhap", () => at().pathname === "/dang-nhap", 60000);
  const rLogin = await req(p, "đăng nhập", "email + mật khẩu: 2 ô cần điền nhưng nhãn không có dấu * (tính +2)", undefined, 2);
  await typeIn(p.locator('input[type="email"], input[autocomplete="username"], input[name="email"]').first(), email);
  await typeIn(p.locator('input[type="password"]').first(), PASS);
  await click(p.locator('form button[type="submit"]').first());
  await eventually("vào khung gia sư (thanh module GIA SƯ) — Hộp việc tắt nên màn đầu là Lịch", async () => at().pathname.startsWith("/lop-cua-toi") && (await p.locator('nav[aria-label="Module của gia sư"]').count()) > 0, 120000);
  const loginDone = Date.now() - cur!.t0;
  await eventually("sau đăng nhập gia sư rơi vào /lop-cua-toi/lich (chế độ gọn: Hộp việc tắt nên /lop-cua-toi chuyển sang Lịch)", () => at().pathname === "/lop-cua-toi/lich", 60000);
  const landingTutor = at().pathname;
  await p.getByText("Tuần này chưa có buổi học nào").waitFor({ timeout: 60000 });
  check("Lịch trống nói ĐÚNG chỗ đặt khung giờ (tab 'Lịch học' của trang quản khoá — trang lớp /lop-cua-toi/<lớp> không có tab này) — sửa chữ của NC2-021", (await body()).includes("trang quản khoá") && !(await body()).includes("trong trang lớp"));
  check("Lịch trống chỉ đường: có nút 'Xem các lớp của tôi'", await p.getByRole("link", { name: "Xem các lớp của tôi" }).isVisible());

  section("G2b. Lịch → 'Xem các lớp của tôi' → 'Tạo lớp đầu tiên' → drawer");
  await click(p.getByRole("link", { name: "Xem các lớp của tôi" }));
  await eventually("tới /lop-cua-toi/lop", () => at().pathname === "/lop-cua-toi/lop", 90000);
  await p.getByText("Bạn chưa mở lớp nào").waitFor({ timeout: 60000 });
  await click(p.getByRole("link", { name: "Tạo lớp đầu tiên" }));
  sub("drawer 'Tạo khoá học mới' (trượt ra trên trang danh sách khoá)");
  await eventually("tới /admin/khoa-hoc?tao=1 (drawer)", () => at().pathname === "/admin/khoa-hoc", 120000);
  const drawerTitle = p.getByRole("heading", { name: "Tạo khoá học mới" });
  await drawerTitle.waitFor({ timeout: 60000 });
  await p.waitForTimeout(400);   // chờ drawer trượt vào xong rồi mới đếm ô
  const rCreate = await req(p, "tạo lớp (drawer 'Tạo khoá học mới')", undefined, "div.fixed.right-0");
  const drawerText = await p.locator("div.fixed.right-0").innerText();
  const askedPublic = ["Giá bán", "Số bài học", "Ngày khai giảng", "Ảnh nền", "Danh mục", "Slug"].filter(k => drawerText.includes(k));
  console.log(`    (ô trên drawer liên quan khoá học CÔNG KHAI/bán: ${askedPublic.join(", ")})`);
  const courseName = `Toán 9 — lớp đầu tiên ${stamp.slice(-3)}`;
  const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  const dr = p.locator("div.fixed.right-0");
  await typeIn(dr.getByPlaceholder("VD: ĐGNL HSA — Trọn gói lộ trình"), courseName);
  await typeIn(dr.locator('input[type="date"]'), today);
  await typeIn(dr.getByPlaceholder("2990000"), "500000");
  await typeIn(dr.getByPlaceholder("96"), "24");
  await click(dr.getByRole("button", { name: "Tạo khoá học" }));
  await eventually("DB: lớp có chủ là gia sư vừa đăng ký", async () => !!(await prisma.course.findFirst({ where: { name: courseName, ownerId: u0!.id } })), 90000);
  const course = (await prisma.course.findFirst({ where: { name: courseName, ownerId: u0!.id } }))!;
  await eventually("drawer đóng, lớp hiện trong danh sách", async () => (await drawerTitle.isHidden().catch(() => false)) && (await body()).includes(courseName), 60000);
  end();
  check("DB: lớp tạo ra thuộc gia sư (ownerId) và đang mở", course.ownerId === u0!.id && course.status === true, { ownerId: course.ownerId, status: course.status });
  check("DB: ô 'Gia sư' của lớp tự điền TÊN gia sư (không còn mặc định 'KiN' — sửa chặn nhỏ của NC2-021)", course.instructor === NAME && course.teacherAvatar === NAME[0], { instructor: course.instructor, avatar: course.teacherAvatar });

  // ───────────────────── G3: khung giờ học ở trang quản khoá (tab Lịch học) ─────────────────────
  begin("G3", "lớp → khung giờ học");
  section("G3. Danh sách khoá → ··· → Cài đặt → tab 'Lịch học' → '+ Thêm khung giờ'");
  const row = p.locator("tr", { hasText: courseName });
  await click(row.getByRole("button", { name: "···" }));
  sub("menu ··· của dòng khoá");
  await click(p.getByRole("link", { name: "Cài đặt", exact: true }));
  await eventually("tới trang quản khoá của lớp", () => at().pathname === `/admin/khoa-hoc/${course.id}`, 120000);
  await click(p.getByRole("button", { name: "Lịch học", exact: true }));
  sub("tab 'Lịch học' của trang quản khoá");
  await click(p.getByRole("button", { name: "+ Thêm khung giờ" }));
  sub("form thêm khung giờ");
  const rSched = await req(p, "khung giờ học (form thêm)", "Thứ / giờ bắt đầu / giờ kết thúc đều CÓ SẴN giá trị mặc định (Thứ 2, 19:00–21:00); không ô nào có dấu *");
  const dow = dayOfWeekOfKey(vnDateKeyOf(new Date()));
  const form = p.locator("div.rounded-xl", { hasText: "Giờ bắt đầu" }).filter({ hasText: "Link vào lớp" }).last();
  await pick(form.locator("select").first(), dow);
  await typeIn(form.locator('input[type="time"]').nth(0), "19:00");
  await typeIn(form.locator('input[type="time"]').nth(1), "20:30");
  await click(p.getByRole("button", { name: "Lưu khung giờ" }));
  await eventually("DB: khung giờ đã lưu cho lớp", async () => (await prisma.classSchedule.count({ where: { courseId: course.id, startTime: "19:00", endTime: "20:30", dayOfWeek: dow } })) === 1, 60000);
  await eventually("khung giờ hiện trên trang", async () => (await body()).includes("19:00"), 30000);
  end();

  // ───────────────────── G4: Mời cả lớp một lần (tab Mã mời của lớp) ─────────────────────
  begin("G4", "khung giờ → mời cả lớp");
  section("G4. Tới trang lớp /lop-cua-toi/<lớp> → tab 'Mã mời' → 'Mời cả lớp một lần'");
  // Đường bấm thật từ trang quản khoá tới trang lớp: thanh bên chỉ có Lịch / Học phí / Khác (chế độ gọn, module 'Lớp' tắt).
  const railLop = p.locator('nav[aria-label="Module của gia sư"]').getByRole("link", { name: /^Lớp/ });
  let how = "";
  if (await railLop.count()) { how = "thanh bên → Lớp → thẻ lớp"; await click(railLop.first()); await click(p.getByRole("link", { name: new RegExp(courseName.slice(0, 12)) }).first()); }
  else {
    // thử: thanh bên → Lịch (đã có buổi) → thẻ buổi có liên kết tới lớp?
    await click(p.locator('nav[aria-label="Module của gia sư"]').getByRole("link", { name: /^Lịch/ }).first());
    await eventually("tới Lịch", () => at().pathname === "/lop-cua-toi/lich", 90000);
    await p.getByText(courseName.slice(0, 14)).first().waitFor({ timeout: 60000 });
    const direct = p.locator(`a[href="/lop-cua-toi/${course.id}"]`);
    if (await direct.count()) { how = "Lịch → liên kết tới lớp"; await click(direct.first()); }
    else {
      await click(p.getByRole("button", { name: new RegExp(courseName.slice(0, 14)) }).first());   // mở thẻ buổi
      const direct2 = p.locator(`a[href="/lop-cua-toi/${course.id}"]`);
      if (await direct2.count()) { how = "Lịch → mở thẻ buổi → liên kết tới lớp"; await click(direct2.first()); }
      else {
        how = "KHÔNG CÓ LỐI BẤM tới trang lớp ở chế độ gọn: phải mở 'Khác' → Cài đặt → bật module 'Lớp' → Lớp → thẻ lớp";
        await click(p.locator('nav[aria-label="Module của gia sư"]').getByRole("button", { name: "Khác" }));
        await click(p.getByRole("dialog", { name: "Các mục khác" }).getByRole("link", { name: "Cài đặt", exact: true }));
        await eventually("tới Cài đặt", () => at().pathname === "/lop-cua-toi/cai-dat", 90000);
        await click(p.locator("#m-lop"));
        await eventually("module Lớp bật", async () => (await p.locator('nav[aria-label="Module của gia sư"]').getByRole("link", { name: /^Lớp/ }).count()) > 0, 30000);
        await click(p.locator('nav[aria-label="Module của gia sư"]').getByRole("link", { name: /^Lớp/ }).first());
        await eventually("tới /lop-cua-toi/lop", () => at().pathname === "/lop-cua-toi/lop", 90000);
        await click(p.getByRole("link", { name: new RegExp(courseName.slice(0, 12)) }).first());
      }
    }
  }
  console.log(`    (đường tới trang lớp: ${how})`);
  await eventually("tới /lop-cua-toi/<lớp>", () => at().pathname === `/lop-cua-toi/${course.id}`, 120000);
  await click(p.getByRole("button", { name: "Mã mời", exact: true }));
  sub("tab 'Mã mời' (có sẵn khối 'Mời cả lớp một lần')");
  const box = p.getByLabel("Danh sách em và số phụ huynh");
  await box.waitFor({ timeout: 90000 });
  const rInvite = await req(p, "mời cả lớp (ô dán danh sách)", "một ô dán 'tên em, số Zalo phụ huynh' (không có dấu *, nút tạo khoá tới khi có dòng hợp lệ)", undefined, 1);
  await typeIn(box, "Bảo Châu, 0933 111 222\nGia Huy, 0944 333 444\nMinh Khôi, 0955 666 777");
  const create = p.getByRole("button", { name: "Tạo mã mời và soạn tin" });
  await eventually("báo 3 em hợp lệ, nút tạo mở", async () => (await p.locator("[id$='-sum']").innerText()).includes("3 em hợp lệ") && await create.isEnabled(), 30000);
  await click(create);
  const codeEl = p.getByTestId("bulk-code");
  await codeEl.waitFor({ timeout: 60000 });
  const code = (await codeEl.innerText()).trim();
  end();
  const inv = await prisma.classInvite.findFirst({ where: { courseId: course.id } });
  check("DB: đúng MỘT mã mời cho lớp, đúng mã trên màn hình, 3 lượt", (await prisma.classInvite.count({ where: { courseId: course.id } })) === 1 && inv?.code === code && inv?.maxUses === 3, { code, inv });
  check("3 dòng phụ huynh hiện ra, chưa mở Zalo", (await p.getByRole("list", { name: "Phụ huynh cần nhắn" }).getByRole("listitem").count()) === 3);

  // ───────────────────── G5: Hộp việc ─────────────────────
  begin("G5", "mời cả lớp → Hộp việc");
  section("G5. Hộp việc: mặc định tắt (chế độ gọn) → Khác → Cài đặt → bật → mở");
  const rail = p.locator('nav[aria-label="Module của gia sư"]');
  const hasInbox = (await rail.getByRole("link", { name: /^Hộp việc/ }).count()) > 0;
  if (!hasInbox) {
    await click(rail.getByRole("button", { name: "Khác" }));
  sub("bảng 'Khác'");
    await click(p.getByRole("dialog", { name: "Các mục khác" }).getByRole("link", { name: "Cài đặt", exact: true }));
    await eventually("tới Cài đặt", () => at().pathname === "/lop-cua-toi/cai-dat", 90000);
    await click(p.locator("#m-hop-viec"));
    await eventually("Hộp việc hiện trên thanh bên", async () => (await rail.getByRole("link", { name: /^Hộp việc/ }).count()) > 0, 30000);
  }
  await click(rail.getByRole("link", { name: /^Hộp việc/ }).first());
  await eventually("tới /lop-cua-toi (Hộp việc)", () => at().pathname === "/lop-cua-toi", 90000);
  await p.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  const inboxText = await body();
  end();
  check("Hộp việc mở được, không rơi vào trang lỗi", !/Application error|Lỗi|Không tìm thấy/i.test(inboxText.slice(0, 600)) && at().pathname === "/lop-cua-toi", inboxText.slice(0, 300));
  check("Hộp việc đang trống việc hoặc liệt kê việc — có chữ giải thích, không trắng", inboxText.replace(/\s+/g, "").length > 200);

  // ───────────────────── Kiểm chung ─────────────────────
  section("Kiểm chung toàn hành trình");
  // HTTP ≥ 400 chấp nhận: /api/auth/me khi chưa đăng nhập (khách mở trang chủ / đăng ký / đăng nhập) trả 401 — là cách trang hỏi "đã đăng nhập chưa".
  const accepted = (b: { status: number; method: string; url: string }) => b.status === 401 && b.method === "GET" && b.url.startsWith("/api/auth/me");
  const unexpected = bad.filter(b => !accepted(b));
  check("không có HTTP ≥ 400 ngoài danh sách chấp nhận (GET /api/auth/me 401 lúc chưa đăng nhập)", unexpected.length === 0, unexpected.slice(0, 6));
  check("không lỗi JS / console.error trong cả hành trình", errors.length === 0, errors.slice(0, 3));
  check("KiN không gửi thư đi thật: thư chỉ nằm trong EMAIL_SINK_DIR", readdirSync(SINK).length >= 1);

  // ───────────────────── BẢNG ĐO ─────────────────────
  // Chặng đệm = chuyển hướng phía máy chủ mà người dùng không dừng lại ở đó (Hộp việc tắt: /lop-cua-toi → /lop-cua-toi/lich; đường cũ /admin/khoa-hoc/tao-moi → ?tao=1).
  // KHÔNG dùng thời gian lưu lại để loại: bài chạy máy nhanh hơn người nên màn thật cũng có thể chỉ hiện vài trăm ms.
  const collapse = (list: Nav[]) => {
    const out: Nav[] = [];
    list.forEach((n, i) => {
      const next = list[i + 1];
      if (n.path === "/lop-cua-toi" && next?.path === "/lop-cua-toi/lich") return;
      if (n.path === "/admin/khoa-hoc/tao-moi") return;
      if (out.length && out[out.length - 1].path === n.path) return;
      out.push(n);
    });
    return out;
  };
  const byStage = (id: string) => collapse(navs.filter(n => n.stage === id));
  const stageDefs = [
    { id: "G1", label: "đăng ký → xác thực" },
    { id: "G2", label: "xác thực → lớp đầu tiên đã tạo" },
    { id: "G3", label: "lớp → khung giờ" },
    { id: "G4", label: "khung giờ → mời cả lớp" },
    { id: "G5", label: "mời cả lớp → Hộp việc" },
  ];
  // Màn của mỗi giai đoạn = số đường dẫn khác nhau trong giai đoạn đó (gồm màn đang đứng lúc bắt đầu thì KHÔNG đếm; đếm màn đến).
  const rows = stageDefs.map(d => {
    const s = stages.find(x => x.id === d.id)!;
    const path = byStage(d.id).map(n => n.path);
    const rq = screensReq.filter(x => x.stage === d.id);
    return { ...d, screens: path.length, path, clicks: s.clicks, types: s.types, ms: s.ms, req: rq, subs: s.subs };
  });
  const sum = (ids: string[], k: "screens" | "clicks" | "types" | "ms") => rows.filter(r => ids.includes(r.id)).reduce((a, r) => a + (r[k] as number), 0);
  const distinct = (ids: string[]) => new Set(ids.flatMap(i => byStage(i).map(n => n.path))).size;
  const reqSum = (ids: string[]) => screensReq.filter(x => ids.includes(x.stage)).reduce((a, x) => a + x.n, 0);
  const ALL = ["G1", "G2", "G3", "G4", "G5"], FIRST_CLASS = ["G2", "G3", "G4"];

  const secf = (ms: number) => (ms / 1000).toFixed(1) + " s";
  console.log("\n════════ NC2-021 — ĐO ONBOARDING GIA SƯ MỚI (thời gian MÁY trên máy dev, gồm biên dịch lần đầu — KHÔNG phải thời gian người) ════════");
  console.log("| Giai đoạn | Màn (đường dẫn khác nhau) | Ô bắt buộc (cộng các màn) | Lần bấm | Lần gõ chuỗi | Thời gian máy |");
  console.log("|---|---|---|---|---|---|");
  for (const r of rows) console.log(`| ${r.id} ${r.label} | ${r.screens} (${r.path.join(" → ")}) | ${r.req.reduce((a, x) => a + x.n, 0)} | ${r.clicks} | ${r.types} | ${secf(r.ms)} |`);
  console.log(`| TỔNG cả hành trình (G1–G5, không tính bước duyệt của quản trị) | ${distinct(ALL)} đường dẫn khác nhau | ${reqSum(ALL)} | ${sum(ALL, "clicks")} | ${sum(ALL, "types")} | ${secf(sum(ALL, "ms"))} |`);
  console.log(`| TỔNG "lớp đầu tiên" (G2–G4: từ lúc gia sư vào app đến khi mời xong cả lớp) | ${distinct(FIRST_CLASS)} đường dẫn khác nhau | ${reqSum(FIRST_CLASS)} | ${sum(FIRST_CLASS, "clicks")} | ${sum(FIRST_CLASS, "types")} | ${secf(sum(FIRST_CLASS, "ms"))} |`);
  console.log(`(G2 gồm đăng xuất + đăng nhập lại vì phiên cũ còn quyền học viên: mất ${secf(loginDone)} máy cho đoạn đó; sau xác thực gia sư rơi vào ${landedAfterVerify}, sau đăng nhập vào ${landingTutor})`);
  console.log("\nÔ bắt buộc theo từng màn (đo: ô có required/aria-required hợp với ô có nhãn *; + = ô bắt buộc nhưng nhãn không có dấu *):");
  for (const x of screensReq) console.log(`  - [${x.stage}] ${x.screen}: ${x.n} ô (thuộc tính required: ${x.attr}, nhãn *: ${x.star}${x.texts.length ? ` [${x.texts.join(" | ")}]` : ""})${x.note ? ` — ${x.note}` : ""}`);
  console.log("\nMàn con (không đổi đường dẫn) theo giai đoạn:");
  for (const r of rows) console.log(`  ${r.id}: ${r.subs.length} — ${r.subs.join("; ") || "(không)"}`);
  console.log("\nĐường đi màn theo giai đoạn (đã bỏ chặng chuyển hướng tức thời):");
  for (const r of rows) console.log(`  ${r.id}: ${r.path.join(" → ") || "(không đổi trang)"}`);

  // Ngưỡng MỀM: chỉ in, không làm đỏ.
  console.log("\nNgưỡng mềm (báo cáo, KHÔNG làm bài đỏ):");
  const soft = (name: string, ok: boolean, got: string) => console.log(ok ? `  OK        ${name} — ${got}` : `  VƯỢT NGƯỠNG  ${name} — ${got}`);
  soft(`"lớp đầu tiên" (G2–G4) ≤ ${T_SCREENS} màn`, distinct(FIRST_CLASS) <= T_SCREENS, `${distinct(FIRST_CLASS)} đường dẫn khác nhau`);
  soft(`"lớp đầu tiên" (G2–G4) ≤ ${T_MS / 1000} s máy`, sum(FIRST_CLASS, "ms") <= T_MS, secf(sum(FIRST_CLASS, "ms")));
  soft(`cả hành trình ≤ ${T_MS / 1000} s máy`, sum(ALL, "ms") <= T_MS, secf(sum(ALL, "ms")));
  soft(`màn tạo lớp ≤ ${T_REQ_CREATE} ô bắt buộc`, rCreate <= T_REQ_CREATE, `${rCreate} ô`);
  console.log(`  (tham chiếu bước 1+2 đăng ký: ${r1} + ${r2} ô bắt buộc; đăng nhập ${rLogin}; khung giờ ${rSched}; mời cả lớp ${rInvite})`);

  await closeAll();
  await prisma.$disconnect();
  done();
})().catch(async e => { console.error("CRASH", e); await closeAll(); process.exit(1); });
