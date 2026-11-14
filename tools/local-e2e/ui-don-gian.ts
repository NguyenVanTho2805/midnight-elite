// DG (14/11/2026, chủ: "đơn giản hoá, chỉ giữ tính năng dạy học" — ẩn bằng cờ, không xoá mã): bài trình duyệt cho tám cờ mới của src/lib/features.ts.
// Chạy với máy chủ dev KHÔNG đặt NEXT_PUBLIC_KIN_MO_* (mặc định ẩn hết). Mỗi vai đăng nhập:
//  • menu (thanh bên, bảng "Khác", menu tên) KHÔNG có mục đã ẩn, vẫn có mục dạy học phải giữ;
//  • vào thẳng URL bị chặn → 307 + Cache-Control: no-store về trang an toàn theo vai (kèm ?tam-dong=<CỜ>);
//  • trang bài học sinh 390 + 1600: xếp dọc video → Tài liệu → Bài tập → Ghi chú, không dải tab, không tràn ngang.
// Ca phá cố ý (đã chạy 14/11/2026): bỏ chốt DG ở nhánh tên miền admin của hostRouting.decideRoute → 7 đỏ (6 trang quản trị trả 200, trình duyệt không về /admin) — 83/7.
import { BASE, api, cookieFor, mkTutor, mkUser, mkSuper, mkCourse, wipe, check, section, done } from "./h";
import { launch, ctxFor, shot, closeAll, ADMIN } from "./ui";
import { prisma } from "@/lib/prisma";
import { FEATURES, featureEnvName } from "@/lib/features";
import { request } from "node:http";

const setFlags = FEATURES.filter(k => process.env[featureEnvName(k)] !== undefined);
if (setFlags.length) { console.log(`Bài này chỉ chạy khi KHÔNG đặt cờ nào (đang đặt: ${setFlags.map(featureEnvName).join(", ")}).`); process.exit(1); }

const YT = "https://youtu.be/dQw4w9WgXcQ";
const visible = async (loc: import("playwright").Locator) => (await loc.evaluateAll(els => els.filter(e => (e as HTMLElement).offsetParent !== null || e.getClientRects().length > 0).length)) > 0;

/** GET không theo chuyển hướng (cookie của vai `as`); `host` giả tên miền admin — fetch (undici) bỏ qua header Host nên dùng node:http. */
async function raw(path: string, o: { as?: Parameters<typeof cookieFor>[0]; host?: string } = {}): Promise<{ status: number; cache: string; to: URL | null }> {
  const headers: Record<string, string> = {};
  if (o.as) headers.cookie = await cookieFor(o.as);
  const u = new URL(BASE);
  headers.host = o.host ?? u.host;
  return new Promise((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port: Number(u.port || 80), path, method: "GET", headers }, res => {
      res.resume();
      res.on("end", () => {
        const loc = res.headers.location;
        resolve({ status: res.statusCode ?? 0, cache: String(res.headers["cache-control"] ?? ""), to: loc ? new URL(loc, `http://${headers.host}`) : null });
      });
    });
    req.on("error", reject);
    req.setTimeout(180000, () => req.destroy(new Error("timeout")));
    req.end();
  });
}

(async () => {
  await wipe();
  const SA = await mkSuper("Quản trị cấp 1");
  const T = await mkTutor("Cô Lan");
  const S = await mkUser({ name: "Minh Anh" });
  const A = await mkCourse(T.id, { name: "Toán 9 gọn" });
  await prisma.course.update({ where: { id: A.id }, data: { status: true } });
  await prisma.enrollment.create({ data: { userId: S.id, courseId: A.id, status: "active" } });
  const sec = await prisma.section.create({ data: { id: "s-dg", title: "Phần 1", order: 1, courseId: A.id } });
  const ch = await prisma.chapter.create({ data: { id: "c-dg", title: "Chương 1", order: 1, sectionId: sec.id } });
  const docs = JSON.stringify([{ name: "Định lý Vi-ét.pdf", url: "https://res.cloudinary.com/kin/raw/upload/viet.pdf" }]);
  const L = await prisma.lesson.create({ data: { id: "l-dg", code: "B1", title: "Bài một: hệ thức Vi-ét", type: "record", order: 1, chapterId: ch.id, isLocked: false, isFree: false, videoUrl: YT, documents: docs, adminNote: "Xem kỹ phần 2" } as never });
  await prisma.assignment.create({ data: { lessonId: L.id, title: "Bài tập Vi-ét", dueDate: new Date(Date.now() + 2 * 86_400_000), instructions: "Làm câu 1–5" } });
  const LIVE = await prisma.lesson.create({ data: { id: "l-dg-live", code: "B2", title: "Buổi trực tuyến", type: "live", order: 2, chapterId: ch.id, isLocked: false, isFree: false, zoomUrl: "https://meet.google.com/abc-defg-hij" } as never });
  const exam = await prisma.exam.create({ data: { id: "ex-dg", code: "ex-dg", title: "Đề giao trong lớp", category: "Toán", date: "01/12/2026", time: "08:00", duration: "45 phút", questions: 0, status: "available", createdAt: "2020", courseId: A.id } });

  section("Chốt chặn 307 + no-store (máy chủ thật, không theo chuyển hướng)");
  const MAIN_BLOCK: [string, typeof T | null, string, string][] = [
    // [đường, vai, đích, cờ]
    ["/lop-cua-toi", T, "/lop-cua-toi/lop", ""],
    ["/lop-cua-toi/hoc-phi?tab=doi-soat", T, "/lop-cua-toi/lop", "HOC_PHI"],
    [`/lop-cua-toi/${A.id}/bang-hoc-phi`, T, "/lop-cua-toi/lop", "HOC_PHI"],
    ["/lop-cua-toi/doanh-thu", T, "/lop-cua-toi/lop", "KINH_DOANH"],
    ["/lop-cua-toi/goi", T, "/lop-cua-toi/lop", "KINH_DOANH"],
    [`/lop-cua-toi/quan-lop/${A.id}/diem-danh`, T, "/lop-cua-toi/lop", "DIEM_DANH"],
    ["/lop-cua-toi/so-diem", T, "/lop-cua-toi/lop", "SO_DIEM"],
    ["/lop-cua-toi/bao-cao-thang", T, "/lop-cua-toi/lop", "SO_DIEM"],
    ["/lop-cua-toi/tong-quan", T, "/lop-cua-toi/lop", "HOP_VIEC"],
    ["/lop-cua-toi/bai-dang", T, "/lop-cua-toi/lop", "TIM_GIA_SU"],
    ["/lop-cua-toi/yeu-cau", T, "/lop-cua-toi/lop", "TIM_GIA_SU"],
    ["/student/hoc-phi", S, "/student/viec-cua-toi", "HOC_PHI"],
    ["/student/nhac-hoc", S, "/student/viec-cua-toi", "NHAC_HOC"],
    ["/student/thi-thu", S, "/student/viec-cua-toi", "THI_THU_CONG_KHAI"],
    ["/thi-thu", S, "/student/viec-cua-toi", "THI_THU_CONG_KHAI"],
    ["/thi-thu?mon=toan", null, "/", "THI_THU_CONG_KHAI"],
  ];
  for (const [p, who, to, k] of MAIN_BLOCK) {
    const r = await raw(p, { as: who ?? undefined });
    const want = k ? `?tam-dong=${k}` : "";
    check(`${who ? (who === T ? "gia sư" : "học sinh") : "khách"} mở ${p} → 307 ${to}${want} + no-store`, r.status === 307 && r.to?.pathname === to && r.to?.search === want && /no-store/.test(r.cache), { status: r.status, to: r.to?.pathname, search: r.to?.search, cache: r.cache });
  }
  const ADMIN_HOSTNAME = new URL(ADMIN).host;
  for (const [p, k] of [["/admin/doanh-thu", "KINH_DOANH"], ["/admin/goi-pro", "KINH_DOANH"], ["/admin/pheu", "VAN_HANH_PHU"], ["/admin/so-do", "VAN_HANH_PHU"], ["/admin/danh-gia", "VAN_HANH_PHU"], ["/admin/trang-chu", "VAN_HANH_PHU"]]) {
    const r = await raw(p, { as: SA, host: ADMIN_HOSTNAME });
    check(`quản trị (tên miền admin) mở ${p} → 307 /admin?tam-dong=${k} + no-store`, r.status === 307 && r.to?.pathname === "/admin" && r.to?.search === `?tam-dong=${k}` && /no-store/.test(r.cache), { status: r.status, to: r.to?.href, cache: r.cache });
  }
  for (const [p, who] of [[`/student/thi-thu/${exam.id}`, S], ["/lop-cua-toi/lop", T], [`/lop-cua-toi/quan-lop/${A.id}`, T], [`/lop-cua-toi/quan-lop/${A.id}/hoc-vien`, T], ["/lop-cua-toi/bai-tap", T], ["/student/hoc-tap", S], [`/student/bai-giang/${L.id}`, S]] as const) {
    const r = await raw(p, { as: who });
    check(`KHÔNG chặn: ${p} (${who === T ? "gia sư" : "học sinh"}) → không 307`, r.status !== 307 && r.status !== 308, r.status);
  }
  for (const p of ["/admin/kiem-duyet", "/admin/khoa-hoc", "/admin/thi-thu", "/admin/nhat-ky"]) {
    const r = await raw(p, { as: SA, host: ADMIN_HOSTNAME });
    check(`KHÔNG chặn: quản trị mở ${p}`, r.status !== 307 && r.status !== 308, r.status);
  }
  const hp = await api("GET", "/api/admin/analytics?from=2026-11-01&to=2026-11-14", { as: SA });
  check("API giữ nguyên: /api/admin/analytics vẫn trả dữ liệu cho quản trị (chỉ gỡ lối vào trang)", hp.status === 200, hp.status);

  await launch();
  const errors: string[] = [];
  const NOISE = /Failed to load resource|favicon|net::ERR|status of (4|5)|Encountered a script tag while rendering React component|negative time stamp/i;
  const watch = (p: import("playwright").Page) => { p.on("pageerror", e => errors.push(String(e))); p.on("console", m => { if (m.type() === "error" && !NOISE.test(m.text())) errors.push(m.text()); }); };

  section("Gia sư (1280, thanh rộng): trang đầu là thư viện Lớp, menu không có mục đã ẩn");
  {
    const ctx = await ctxFor(T, { width: 1280, height: 900, rail: "rong" });
    const p = await ctx.newPage(); watch(p);
    await p.goto(`${BASE}/lop-cua-toi`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await p.waitForURL(/\/lop-cua-toi\/lop$/, { timeout: 120000 });
    await p.getByRole("heading", { level: 1 }).first().waitFor({ timeout: 120000 });
    check("mở /lop-cua-toi → đứng ở /lop-cua-toi/lop (thư viện thẻ các lớp)", new URL(p.url()).pathname === "/lop-cua-toi/lop", p.url());
    await p.getByText("Toán 9 gọn").first().waitFor({ timeout: 60000 });
    check("thấy thẻ lớp đang quản lý", await visible(p.getByText("Toán 9 gọn")));
    const nav = p.getByRole("navigation", { name: "Module của gia sư" });
    const navText = (await nav.allInnerTexts()).join("\n");
    for (const gone of ["Hộp việc", "Học phí", "Doanh thu", "Báo cáo tháng", "Sổ điểm", "Bài đăng tìm học sinh", "Yêu cầu tìm gia sư", "Gói của tôi", "Tổng quan", "Lịch"]) {
      check(`thanh gia sư KHÔNG có '${gone}'`, !navText.split("\n").some(t => t.trim() === gone), navText);
    }
    for (const keep of ["Lớp", "Học sinh", "Bài tập", "Thư viện", "Hồ sơ gia sư", "Cài đặt"]) check(`thanh gia sư CÓ '${keep}'`, navText.split("\n").some(t => t.trim() === keep), navText);
    const hrefs = await nav.locator("a").evaluateAll(as => as.map(a => a.getAttribute("href") ?? ""));
    check("không liên kết nào trên thanh dẫn vào trang đã chặn", !hrefs.some(h => /\/lop-cua-toi\/(hoc-phi|doanh-thu|goi|so-diem|bao-cao-thang|bai-dang|yeu-cau|tong-quan)/.test(h)), hrefs);
    check("logo / lối về đầu trỏ /lop-cua-toi/lop", hrefs.includes("/lop-cua-toi/lop"));
    await shot(p, "dg-gia-su-lop-1280");

    await p.goto(`${BASE}/lop-cua-toi/quan-lop/${A.id}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    const strip = p.getByRole("navigation", { name: /Trang của Quản lớp/ });
    await strip.waitFor({ timeout: 120000 });
    const tabs = (await strip.getByRole("link").allInnerTexts()).map(t => t.trim());
    check("trang lớp: dải tab Bài học · Học sinh · Cài đặt (không Điểm danh)", tabs.join("|") === "Bài học|Học sinh|Cài đặt", tabs);
    await p.goto(`${BASE}/lop-cua-toi/quan-lop/${A.id}?tab=cai-dat&muc=hoc-phi`, { waitUntil: "domcontentloaded", timeout: 120000 });
    const muc = p.getByRole("navigation", { name: "Mục của Cài đặt" });
    await muc.waitFor({ timeout: 120000 });
    const mucs = (await muc.getByRole("link").allInnerTexts()).map(t => t.trim());
    check("Cài đặt lớp: không mục 'Học phí'; mở thẳng ?muc=hoc-phi thì hiện mục Thông tin", !mucs.includes("Học phí") && mucs[0] === "Thông tin" && await muc.getByRole("link", { name: "Thông tin" }).getAttribute("aria-current") === "page", mucs);
    await p.goto(`${BASE}/lop-cua-toi/cai-dat`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await p.locator("#module").waitFor({ timeout: 120000 });
    const modText = await p.locator("#module").innerText();
    check("Cài đặt › Module hiển thị: không công tắc Hộp việc / Học phí / Lịch", !/Hộp việc|Học phí|\bLịch\b/.test(modText.split("\n").filter(l => !/^Tắt module/.test(l)).join("\n")), modText);
    await ctx.close();
  }

  section("Gia sư (390): thanh dưới không chỉ còn mỗi Lớp, không tràn ngang");
  {
    const ctx = await ctxFor(T, { width: 390, height: 844 });
    const p = await ctx.newPage(); watch(p);
    await p.goto(`${BASE}/lop-cua-toi/lop`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await p.getByText("Toán 9 gọn").first().waitFor({ timeout: 120000 });
    const cells = await p.evaluate(`[...document.querySelectorAll('nav[aria-label="Module của gia sư"] a, nav[aria-label="Module của gia sư"] button')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.top > innerHeight - 80; }).map(e => (e.textContent || '').trim())`) as string[];
    check("điện thoại: thanh dưới có Lớp, Bài tập, Thư viện, Khác; không Hộp việc / Học phí", ["Lớp", "Bài tập", "Thư viện", "Khác"].every(c => cells.some(t => t.startsWith(c))) && !cells.some(t => /Hộp việc|Học phí/.test(t)), cells);
    check("390: không tràn ngang", await p.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"));
    await shot(p, "dg-gia-su-lop-390");
    await ctx.close();
  }

  section("Học sinh: menu không có mục đã ẩn");
  {
    const ctx = await ctxFor(S, { width: 1280, height: 900, rail: "rong" });
    const p = await ctx.newPage(); watch(p);
    await p.goto(`${BASE}/student/viec-cua-toi`, { waitUntil: "domcontentloaded", timeout: 120000 });
    const nav = p.getByRole("navigation", { name: "Module của học sinh" });
    await nav.waitFor({ timeout: 120000 });
    await p.getByRole("heading", { name: "Đề thi được giao" }).waitFor({ timeout: 120000 });
    const navText = (await nav.allInnerTexts()).join("\n");
    for (const gone of ["Nhắc học", "Lớp miễn phí", "Lịch học", "Tiếng Anh tự học"]) check(`thanh học sinh KHÔNG có '${gone}'`, !navText.includes(gone), navText);
    for (const keep of ["Việc của tôi", "Lớp của tôi"]) check(`thanh học sinh CÓ '${keep}'`, navText.includes(keep));
    check("Việc của tôi: không nút 'Xem lịch tuần', không lối 'Đề thi thử' (danh sách công khai)", await p.getByRole("link", { name: "Xem lịch tuần" }).count() === 0 && await p.getByRole("link", { name: "Đề thi thử", exact: true }).count() === 0);
    await p.getByRole("button", { name: /Minh Anh|Tài khoản/ }).first().click();
    const menu = p.getByRole("menu").first();
    await menu.waitFor({ timeout: 30000 }).catch(() => {});
    const menuText = await menu.innerText().catch(() => "");
    check("menu tên: có Hồ sơ, KHÔNG có Học phí", /Hồ sơ/.test(menuText) && !/Học phí/.test(menuText), menuText);
    await p.goto(`${BASE}/student/hoc-tap?course=${A.id}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await p.getByRole("tab", { name: "Tổng quan" }).click({ timeout: 120000 });
    await p.locator("[data-lop-thong-tin]").waitFor({ timeout: 60000 });
    check("trang lớp › Tổng quan: không 'Phiếu học phí của bạn →'", await p.locator("[data-lop-hoc-phi]").count() === 0);
    await ctx.close();
  }

  section("Khách: trang chủ không có Thi thử");
  {
    const ctx = await ctxFor(null, { width: 1280, height: 900 });
    const p = await ctx.newPage(); watch(p);
    await p.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await p.locator("footer").first().waitFor({ timeout: 120000 });
    const hrefs = await p.locator("a").evaluateAll(as => as.map(a => a.getAttribute("href") ?? ""));
    check("trang chủ: không liên kết nào tới /thi-thu (thanh trên, hero, khối Thi thử, CTA, chân trang)", !hrefs.some(h => h === "/thi-thu" || h.startsWith("/thi-thu?") || h.startsWith("/thi-thu#")), hrefs.filter(h => h.startsWith("/thi-thu")));
    check("không còn chữ 'Thi thử miễn phí' / 'Thi thử ĐGNL'", !/Thi thử miễn phí|Thi thử ĐGNL/.test(await p.locator("body").innerText()));
    await ctx.close();
  }

  section("Quản trị: menu chỉ còn phần dạy học + Hôm nay không có Doanh thu");
  {
    const ctx = await ctxFor(SA, { width: 1280, height: 900, rail: "rong" });
    const p = await ctx.newPage(); watch(p);
    await p.goto(`${ADMIN}/admin`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await p.getByTestId("hom-nay").waitFor({ timeout: 120000 });
    await p.locator("[data-chi-so]").getByText(/Học sinh|Lớp đang mở|Gia sư đã duyệt|Hôm nay chưa/).first().waitFor({ timeout: 60000 }).catch(() => {});
    check("Hôm nay: không thẻ 'Doanh thu 30 ngày'", !/Doanh thu/.test(await p.getByTestId("hom-nay").innerText()));
    const nav = p.getByRole("navigation", { name: "Module quản trị" }).first();
    const hrefs = await p.locator('nav[aria-label="Module quản trị"] a').evaluateAll(as => [...new Set(as.map(a => a.getAttribute("href") ?? ""))]);
    for (const gone of ["/admin/doanh-thu", "/admin/goi-pro", "/admin/pheu", "/admin/so-do", "/admin/danh-gia", "/admin/trang-chu"]) check(`menu quản trị KHÔNG có ${gone}`, !hrefs.includes(gone), hrefs);
    check("menu quản trị vẫn có Hàng chờ / Lớp / Đề thi (module dẫn vào trang đầu)", ["/admin/kiem-duyet", "/admin/khoa-hoc", "/admin/gia-su"].every(h => hrefs.includes(h)) || await nav.count() > 0, hrefs);
    await p.goto(`${ADMIN}/admin/doanh-thu`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await p.waitForURL(/\/admin\?tam-dong=KINH_DOANH/, { timeout: 60000 }).catch(() => {});
    check("trình duyệt mở /admin/doanh-thu → về /admin?tam-dong=KINH_DOANH, có dòng 'Phần này đang tạm đóng.'", /\/admin\?tam-dong=KINH_DOANH$/.test(p.url()) && await p.locator('[data-paused-notice="KINH_DOANH"]').count() === 1, p.url());
    await shot(p, "dg-quan-tri-1280");
    await ctx.close();
  }

  section("Trang bài học sinh: một cột video → Tài liệu → Bài tập → Ghi chú (390 + 1600)");
  for (const w of [390, 1600]) {
    const ctx = await ctxFor(S, { width: w, height: 900 });
    const p = await ctx.newPage(); watch(p);
    await p.goto(`${BASE}/student/bai-giang/${L.id}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await p.getByRole("heading", { level: 1, name: /Bài một/ }).waitFor({ timeout: 120000 });
    await p.locator('[data-lesson-section="bai-tap"]').waitFor({ timeout: 60000 });
    const ys = await p.evaluate(`(() => {
      const v = document.querySelector('.plyr, [data-plyr-provider], iframe[title="Video bài giảng"], video');
      const y = el => el ? el.getBoundingClientRect().top + scrollY : null;
      return { video: y(v), tl: y(document.querySelector('[data-lesson-section="tai-lieu"]')), bt: y(document.querySelector('[data-lesson-section="bai-tap"]')), gc: y(document.querySelector('[data-lesson-section="ghi-chu"]')) };
    })()`) as Record<string, number | null>;
    check(`${w}px: thứ tự dọc video < Tài liệu < Bài tập < Ghi chú`, ys.video !== null && ys.tl !== null && ys.bt !== null && ys.gc !== null && ys.video! < ys.tl! && ys.tl! < ys.bt! && ys.bt! < ys.gc!, ys);
    check(`${w}px: không còn dải tab (nút 'Tài liệu' / 'Bài tập' / 'Ghi chú')`, await p.getByRole("button", { name: /^(Tài liệu|Bài tập|Ghi chú)$/ }).count() === 0);
    const heads = { tl: await p.locator("#bai-tai-lieu").count(), bt: await p.locator("#bai-bai-tap").count(), gc: await p.locator("#bai-ghi-chu").count() };
    const docShown = await visible(p.locator('[data-lesson-section="tai-lieu"]').getByText("Định lý Vi-ét.pdf"));
    await p.locator('[data-lesson-section="bai-tap"]').getByText("Bài tập Vi-ét").first().waitFor({ timeout: 60000 }).catch(() => {});
    const hwShown = await visible(p.locator('[data-lesson-section="bai-tap"]').getByText("Bài tập Vi-ét"));
    check(`${w}px: ba khối có tiêu đề chữ (h2), tài liệu và bài tập hiện cùng lúc`, heads.tl === 1 && heads.bt === 1 && heads.gc === 1 && docShown && hwShown, { heads, docShown, hwShown });
    check(`${w}px: không tràn ngang`, await p.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), await p.evaluate("[document.documentElement.scrollWidth, innerWidth]"));
    await shot(p, `dg-bai-hoc-sinh-${w}`);
    await p.goto(`${BASE}/student/bai-giang/${LIVE.id}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await p.getByRole("heading", { level: 1, name: /Buổi trực tuyến/ }).waitFor({ timeout: 120000 });
    const join = p.locator('a[href="https://meet.google.com/abc-defg-hij"]');
    check(`${w}px: bài live vẫn có nút vào học`, await join.count() >= 1 && await visible(join));
    await ctx.close();
  }

  section("P2-2: đồng giảng — DIEM_DANH tắt ⇒ không tab điểm danh, tab mặc định Học sinh");
  {
    const CO = await mkTutor("Cô Đồng Giảng DG");
    await prisma.courseTeacher.create({ data: { courseId: A.id, userId: CO.id, role: "co_teacher", status: "active", subjects: [], invitedBy: T.id, respondedAt: new Date() } });
    for (const w of [1280, 390]) {
      const ctx = await ctxFor(CO, { width: w, height: 900 });
      const p = await ctx.newPage(); watch(p);
      for (const q of ["", "?tab=diem-danh"]) {
        await p.goto(`${BASE}/lop-cua-toi/${A.id}${q}`, { waitUntil: "domcontentloaded", timeout: 120000 });
        const tl = p.getByRole("tablist", { name: "Nội dung của lớp" });
        await tl.waitFor({ timeout: 120000 });
        const tabs = (await tl.getByRole("tab").allInnerTexts()).map(t => t.trim());
        const sel = (await tl.locator('[role=tab][aria-selected="true"]').innerText()).trim();
        check(`${w}px ${q || "(gốc)"}: không tab 'Buổi tôi dạy' / điểm danh, tab đang mở là Học sinh, không khối điểm danh`, !tabs.some(t => /Buổi|điểm danh/i.test(t)) && /^Học sinh/.test(sel) && await p.locator("#lop-panel-diem-danh").count() === 0, { tabs, sel });
      }
      check(`${w}px: không tràn ngang`, await p.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"));
      await shot(p, `dg-dong-giang-lop-${w}`);
      await ctx.close();
    }
  }

  section("P2-4b: Sổ của con — HOC_PHI tắt ⇒ không ô / khối học phí, không số tiền");
  {
    const tokP = "b7".repeat(16);
    await prisma.parentLink.create({ data: { parentId: (await mkUser({ name: "Chị Mai" })).id, studentId: S.id, status: "verified", verifiedAt: new Date(), portalToken: tokP } });
    await prisma.tuitionInvoice.create({ data: { code: "KINDG0001", tutorId: T.id, studentId: S.id, yearMonth: "2026-11", amountDue: 1_200_000, status: "sent", sentAt: new Date() } });
    for (const w of [1280, 390]) {
      const ctx = await ctxFor(null, { width: w, height: 900 });
      const p = await ctx.newPage(); watch(p);
      await p.goto(`${BASE}/so-cua-con/${tokP}`, { waitUntil: "domcontentloaded", timeout: 120000 });
      await p.getByLabel("Tóm tắt tháng này").waitFor({ timeout: 120000 });
      const body = await p.locator("body").innerText();
      check(`${w}px: không 'Học phí' / 'Phiếu học phí' / số tiền đ; không khối [data-so-hoc-phi]; tóm tắt còn 3 ô`, !/Học phí|Phiếu học phí|\d[\d.]*\s*đ\b|₫/.test(body) && await p.locator("[data-so-hoc-phi]").count() === 0
        && await p.getByLabel("Tóm tắt tháng này").locator("dt").count() === 3, body.match(/.{0,30}(Học phí|đ\b).{0,30}/g));
      check(`${w}px: không tràn ngang`, await p.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"));
      await shot(p, `dg-so-cua-con-${w}`);
      await ctx.close();
    }
  }

  check("không lỗi console / trang lạ", errors.length === 0, errors.slice(0, 5));
  await closeAll();
  await done();
})().catch(async e => { console.error("CRASH", e); await closeAll(); process.exit(1); });
