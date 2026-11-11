// QT-01/02/03/04/06/07 + TK-07/GO-08 trên trình duyệt thật: Triển khai và hạn mức, Nhật ký, Hôm nay cần làm gì, bảng vai, lối vào Duyệt nạp Coin,
// lọc học sinh theo lớp, nhắc theo lớp, Cài đặt gia sư (Kết nối trung thực + thẻ hạn mức). 1280px và 390px (không tràn ngang).
import { BASE, mkTutor, mkUser, mkCourse, mkSuper, wipe, check, section, done } from "./h";
import { launch, ctxFor, shot, closeAll, ADMIN } from "./ui";
import { prisma } from "@/lib/prisma";
import { COIN_VISIBLE, COIN_LOGIC_ON } from "@/lib/features"; // LOI-01: hàng chờ nạp Coin theo LOGIC Coin (hằng COIN_LOGIC_ON), không theo cờ hiển thị

(async () => {
  await wipe();
  const SA = await mkSuper("Quản trị Hà");
  const CA = await mkUser({ name: "Quản trị nội dung", role: "admin", adminRole: "admin_content" });
  const T = await mkTutor("Cô Lan");
  const kidName = "Nguyễn Bé Bí Mật";
  const kid = await mkUser({ name: kidName });
  const c1 = await mkCourse(T.id, { name: "Toán 9 Lan" }), c2 = await mkCourse(T.id, { name: "Lý 9 Lan" });
  const s1 = await mkUser({ name: "Em Một" }), s2 = await mkUser({ name: "Em Hai" }), s3 = await mkUser({ name: "Em Ba" });
  for (const [u, c] of [[s1, c1], [s2, c1], [s3, c2]] as const) await prisma.enrollment.create({ data: { userId: u.id, courseId: c.id, status: "active" } });
  await prisma.auditLog.create({ data: { actorId: kid.id, action: "student_profile.update", resourceType: "StudentProfile", resourceId: "cmhoso0000000000000abcdef", metadata: { studentName: kidName, phone: "0912345678" } } });
  await prisma.auditLog.create({ data: { actorId: SA.id, action: "tutor.approve", resourceType: "User", resourceId: "u-gia-su-1" } });
  await prisma.coinTopupRequest.create({ data: { userId: kid.id, amountVnd: 100000, coinAmount: 100, status: "pending" } as never });
  const ap = await mkUser({ name: "Gia sư xin duyệt", emailVerified: true });
  await prisma.user.update({ where: { id: ap.id }, data: { tutorAppliedAt: new Date(Date.now() - 86_400_000), subjects: ["Toán"] } });
  await prisma.settingKV.create({ data: { key: "cron.remind-class.lastCall", value: new Date().toISOString() } });

  await launch();
  const errors: string[] = [];
  const watch = (p: any) => { p.on("pageerror", (e: unknown) => errors.push(String(e))); p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of (4|5)/i.test(m.text())) errors.push(m.text()); }); };
  const noOverflow = async (p: any) => (await p.evaluate(`document.documentElement.scrollWidth <= window.innerWidth`)) as boolean;

  const ctx = await ctxFor(SA, { width: 1280, height: 900 });
  const pg = await ctx.newPage(); watch(pg);

  section("Menu quản trị: lối vào mới");
  await pg.goto(`${ADMIN}/admin/trien-khai`, { waitUntil: "networkidle", timeout: 120000 });
  await pg.getByRole("heading", { name: "Triển khai và hạn mức" }).waitFor({ timeout: 90000 });
  // BU-08: module "Cài đặt" gộp vào "Vận hành"; "Duyệt nạp Coin" thành "Lịch sử nạp Coin" (chỉ đọc; duyệt ở Hàng chờ).
  const strip = pg.getByRole("navigation", { name: /^Trang của / });
  check("dải tab 'Vận hành' có 'Lịch sử nạp Coin' và 'Triển khai và hạn mức' (QT-06, QT-03)", (await strip.getByRole("link", { name: "Lịch sử nạp Coin" }).isVisible()) === COIN_VISIBLE && await strip.getByRole("link", { name: "Triển khai và hạn mức" }).getAttribute("aria-current") === "page");

  section("Triển khai và hạn mức (QT-03)");
  const flags = pg.getByTestId("co-trien-khai");
  await flags.waitFor({ timeout: 60000 });
  check("5 cờ (BU-08 thêm KIN_GUEST_QUESTIONS), mỗi cờ có chữ Đang bật/Đang tắt/Đã đặt/Chưa đặt", await flags.locator("li").count() === 5 && (await flags.locator('[data-flag="KIN_GUEST_QUESTIONS"]').count()) === 1 && /Đang tắt|Đang bật/.test(await flags.locator('[data-flag="KIN_TRIAL_MODE"]').innerText()) && /Đã đặt/.test(await flags.locator('[data-flag="CRON_SECRET"]').innerText()));
  check("KHÔNG có nút/ô để đổi cờ (chỉ xem)", await flags.locator("button, input, select, [role=switch]").count() === 0);
  check("không lộ giá trị CRON_SECRET trong trang", !(await pg.content()).includes(process.env.CRON_SECRET!));
  const crons = pg.getByTestId("cron-gan-nhat");
  let cronOthers = true;
  for (const k of ["remind-exam", "expire-tutor-subscriptions", "pro-renewal-reminders", "article-publish"]) cronOthers = cronOthers && /Chưa ghi nhận/.test(await crons.locator(`[data-cron="${k}"]`).innerText());
  check("cron: remind-class 'Đúng lịch', bốn tác vụ kia (kể cả article-publish) 'Chưa ghi nhận'", /Đúng lịch/.test(await crons.locator('[data-cron="remind-class"]').innerText()) && cronOthers);
  const hm = await pg.getByTestId("han-muc").innerText();
  check("hạn mức: học sinh + lượt AI có số; mẫu phiếu / dung lượng / Drive ghi 'Chưa có'", /Học sinh đang học\s+\d+\s+\d+/.test(hm) && /Mẫu phiếu[\s\S]*Chưa có hạn mức/.test(hm) && /Dung lượng[\s\S]*Chưa có hạn mức/.test(hm) && /Drive[\s\S]*Chưa có tích hợp/.test(hm), hm);
  check("chống spam lấy số thật từ mã (3 yêu cầu / ngày, 5 / giờ)", /3 yêu cầu \/ ngày/.test(await pg.content()) && /5 yêu cầu \/ giờ/.test(await pg.content()));
  check("không có chữ cấm: 'đã xác minh', 'miễn thuế', 'đúng luật'", !/đã xác minh|miễn thuế|đúng luật/i.test(await pg.innerText("body")));
  await shot(pg, "qt-trien-khai");

  section("Nhật ký (QT-02)");
  await pg.goto(`${ADMIN}/admin/nhat-ky`, { waitUntil: "networkidle", timeout: 120000 });
  const list = pg.getByTestId("nhat-ky");
  await list.waitFor({ timeout: 60000 });
  const body = await pg.innerText("body");
  check("có dòng 'Duyệt hồ sơ gia sư' do 'Quản trị cấp 1 · Quản trị Hà' và dòng học sinh chỉ hiện vai", /Duyệt hồ sơ gia sư/.test(body) && /Quản trị cấp 1 · Quản trị Hà/.test(body) && /Học sinh hoặc phụ huynh/.test(body));
  check("KHÔNG thấy tên trẻ, SĐT trẻ ở bất cứ đâu trong trang", !(await pg.content()).includes(kidName) && !(await pg.content()).includes("0912345678"));
  const tab = pg.getByRole("navigation", { name: /^Trang của / });
  check("dải tab (Vận hành) có 'Nhật ký' đang ở", await tab.getByRole("link", { name: "Nhật ký" }).getAttribute("aria-current") === "page");
  await pg.getByLabel("Loại việc").selectOption("tutor.approve");
  await pg.waitForFunction(`document.querySelectorAll('[data-testid=nhat-ky] tr').length === 1`, null, { timeout: 30000 });
  check("lọc 'Duyệt hồ sơ gia sư' → còn đúng 1 dòng (nay là bảng: <tr>)", await list.locator("tr").count() === 1);
  await pg.getByLabel("Loại việc").selectOption("user.role_change");
  await pg.getByText("Chưa có dòng nhật ký nào khớp").waitFor({ timeout: 30000 });
  check("lọc ra rỗng → câu giải thích, không bảng trống", await pg.getByText("Chưa có dòng nhật ký nào khớp").isVisible());
  // BU-08: chip nhóm + dải "Đang lọc" + Xoá lọc
  await pg.getByLabel("Loại việc").selectOption("");
  await pg.getByRole("button", { name: "Duyệt", exact: true }).click();
  await pg.waitForFunction(`document.querySelectorAll('[data-testid=nhat-ky] tr').length === 1`, null, { timeout: 30000 });
  check("chip nhóm 'Duyệt' → còn dòng duyệt gia sư, có dải 'Đang lọc: Nhóm: Duyệt' và nút Xoá lọc", await pg.locator("[data-dang-loc]").isVisible() && /Nhóm: Duyệt/.test(await pg.locator("[data-dang-loc]").innerText()) && await pg.getByRole("button", { name: /Xoá lọc/ }).isVisible());
  await pg.getByRole("button", { name: /Xoá lọc/ }).click();
  await pg.waitForFunction(`document.querySelectorAll('[data-testid=nhat-ky] tr').length === 2`, null, { timeout: 30000 });
  check("Xoá lọc → trở lại đủ 2 dòng nhật ký, dải 'Đang lọc' biến mất", (await pg.locator("[data-dang-loc]").count()) === 0);
  await shot(pg, "qt-nhat-ky");

  section("Hôm nay cần làm gì (QT-04)");
  await pg.goto(`${ADMIN}/admin`, { waitUntil: "domcontentloaded", timeout: 120000 });
  const hn = pg.getByTestId("hom-nay");
  await hn.locator("[data-todo]").first().waitFor({ timeout: 90000 });
  const keys = await hn.locator("[data-todo]").evaluateAll(els => els.map(e => e.getAttribute("data-todo")).sort().join());
  check("danh sách có đúng MỘT dòng tổng 'hang-cho' (gia sư xin duyệt" + (COIN_LOGIC_ON ? " + nạp Coin" : "") + " gộp lại)", keys === "hang-cho", keys); // 05/11/2026: Coin ẩn → không có việc nạp Coin; điều hướng B1: gộp thành một dòng
  check("dòng tổng là liên kết tới Hàng chờ (/admin/kiem-duyet)", await hn.locator('[data-todo="hang-cho"] a').getAttribute("href") === "/admin/kiem-duyet");
  check("dòng tổng có chữ giải thích số theo loại (không chỉ số)", /hồ sơ gia sư chờ duyệt/.test(await hn.innerText()) && (!COIN_LOGIC_ON || /yêu cầu nạp Coin/.test(await hn.innerText())));
  check("khối 'Nhắc nhở theo lớp' đã rời khỏi Hôm nay (BU-08 Q7)", (await pg.getByRole("button", { name: "Nhắc nhở theo lớp" }).count()) === 0 && (await pg.getByTestId("nhac-chon-lop").count()) === 0);

  section("Nhắc cả lớp (QT-07) — nay ở trang Học viên của lớp");
  await pg.goto(`${ADMIN}/admin/khoa-hoc/${c1.id}/hoc-vien`, { waitUntil: "domcontentloaded", timeout: 120000 });
  const nhac = pg.getByRole("button", { name: "Nhắc cả lớp" });
  await nhac.waitFor({ timeout: 90000 });
  await nhac.click();
  await pg.getByRole("button", { name: "Gửi cho cả lớp" }).click();
  check("bước xác nhận nói rõ số người nhận của lớp này (2), không phải toàn nền tảng", /khoảng 2 học viên/.test(await pg.innerText("body")));
  await pg.getByRole("button", { name: "Xác nhận gửi" }).click();
  await pg.getByText("Đã gửi nhắc nhở tới 2/2 học viên").waitFor({ timeout: 60000 });
  check("gửi xong báo đúng '2/2 học viên'", true);

  section("Học sinh theo lớp (QT-07)");
  await pg.goto(`${ADMIN}/admin/hoc-sinh`, { waitUntil: "networkidle", timeout: 120000 });
  const lop = pg.getByTestId("loc-lop");
  await lop.waitFor({ timeout: 60000 });
  const opts = await lop.locator("option").allInnerTexts();
  check("bộ lọc lớp liệt kê từng lớp kèm số học sinh", opts.includes("Mọi lớp") && opts.includes("Toán 9 Lan · 2 học sinh") && opts.includes("Lý 9 Lan · 1 học sinh"), opts);
  await lop.selectOption({ label: "Lý 9 Lan · 1 học sinh" });
  await pg.waitForFunction(`document.body.innerText.includes("1/") && document.body.innerText.includes("học sinh ·")`, null, { timeout: 30000 });
  const txt = await pg.innerText("body");
  check("chọn lớp Lý → chỉ thấy Em Ba, không thấy Em Một / Em Hai", /Em Ba/.test(txt) && !/Em Một/.test(txt) && !/Em Hai/.test(txt));

  section("Người dùng và vai (QT-01) + một cửa duyệt gia sư (QT-02)");
  await pg.goto(`${ADMIN}/admin/quan-tri-vien`, { waitUntil: "networkidle", timeout: 120000 });
  await pg.getByText("Mỗi vai làm được gì").waitFor({ timeout: 60000 });
  await pg.getByText("Mỗi vai làm được gì").click();
  const vai = pg.getByTestId("bang-vai");
  check("bảng vai: 3 vai, mô tả + quyền; nói thẳng chưa có vai trợ giảng", await vai.locator("li").count() === 3 && /Chưa có vai trợ giảng riêng/.test(await pg.innerText("body")));
  check("không còn tab 'Hồ sơ gia sư chờ duyệt' ở đây, có liên kết sang hàng chờ", await pg.getByRole("tab", { name: /Hồ sơ gia sư chờ duyệt/ }).count() === 0 && await pg.getByRole("link", { name: "hàng chờ kiểm duyệt" }).getAttribute("href") === "/admin/kiem-duyet");
  await pg.goto(`${ADMIN}/admin/ho-so-gia-su`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await pg.waitForURL(/\/admin\/kiem-duyet\?loai=gia-su/, { timeout: 60000 }).catch(() => {});
  check("đường cũ /admin/ho-so-gia-su → Hàng chờ lọc gia sư (BU-08)", /\/admin\/kiem-duyet\?loai=gia-su/.test(pg.url()), pg.url());
  await pg.goto(`${ADMIN}/admin/topups`, { waitUntil: "domcontentloaded", timeout: 120000 });
  if (!COIN_VISIBLE) {
    await pg.waitForURL(u => new URL(u).pathname === "/admin", { timeout: 60000 }).catch(() => {});
    check("Coin ẩn: /admin/topups chuyển về /admin (không còn trang Lịch sử nạp Coin)", new URL(pg.url()).pathname === "/admin", pg.url());
  } else {
  await pg.getByRole("heading", { name: "Lịch sử nạp Coin" }).waitFor({ timeout: 90000 });
  check("Lịch sử nạp Coin (chỉ đọc) mở được từ menu cấp 1; không có nút Duyệt/Từ chối; có chỉ dẫn sang Hàng chờ", await pg.getByRole("heading", { name: "Lịch sử nạp Coin" }).isVisible() && (await pg.getByRole("button", { name: /^(Duyệt|Từ chối)/ }).count()) === 0 && /Việc chờ duyệt ở Hàng chờ/.test(await pg.innerText("body")));
  }
  await ctx.close();

  section("Quyền: quản trị nội dung không thấy Nhật ký / Triển khai / Lịch sử nạp Coin");
  const cc = await ctxFor(CA, { width: 1280, height: 900 });
  const pc = await cc.newPage(); watch(pc);
  await pc.goto(`${ADMIN}/admin/kiem-duyet`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await pc.getByRole("navigation", { name: "Module quản trị" }).first().waitFor({ timeout: 90000 });
  const links = await pc.getByRole("link").allInnerTexts();
  check("không có lối vào Nhật ký, Triển khai và hạn mức, Lịch sử nạp Coin", !links.some(l => /^Nhật ký$|Triển khai và hạn mức|Lịch sử nạp Coin/.test(l.trim())), links.filter(Boolean).slice(0, 30));
  await pc.goto(`${ADMIN}/admin/nhat-ky`, { waitUntil: "networkidle", timeout: 120000 });
  await pc.waitForURL(/\/admin$/, { timeout: 30000 });
  await pc.getByRole("heading", { name: "Hôm nay cần làm gì" }).waitFor({ timeout: 60000 }); // getByText trúng cả #__next-route-announcer__
  check("gõ thẳng /admin/nhat-ky → bị đẩy về Tổng quan (thấy 'Hôm nay cần làm gì'), không có dòng nhật ký", !(await pc.getByTestId("nhat-ky").count()));
  await cc.close();

  section("Cài đặt gia sư: Kết nối và hạn mức (TK-07, GO-08)");
  const ct = await ctxFor(T, { width: 1280, height: 900 });
  const pt = await ct.newPage(); watch(pt);
  await pt.goto(`${BASE}/lop-cua-toi/cai-dat`, { waitUntil: "networkidle", timeout: 120000 });
  const gg = pt.getByTestId("ket-noi-google");
  await gg.waitFor({ timeout: 90000 });
  check("Calendar / Meet / Drive: mỗi mục ghi 'Chưa có…', KHÔNG có nút 'Kết nối Google'", await gg.locator("li").count() === 3 && !(await pt.getByRole("button", { name: /Kết nối Google|Cấp quyền/ }).count()) && /Chưa có/.test(await gg.locator('[data-conn="calendar"]').innerText()) && /Chưa có tích hợp/.test(await gg.locator('[data-conn="meet"]').innerText()));
  const cards = pt.getByTestId("the-han-muc");
  check("4 thẻ hạn mức; học sinh 3 / 10 (3 học sinh khác nhau ở 2 lớp) có thanh và chữ; các thẻ còn lại không thanh", await cards.locator("[data-quota]").count() === 4 && /3 \/ 10/.test(await cards.locator('[data-quota="hoc-sinh"]').innerText()) && await cards.locator('[data-quota="hoc-sinh"] [role=progressbar]').count() === 1 && await cards.locator('[role=progressbar]').count() === 1);
  await shot(pt, "tk-ket-noi-luu-tru");
  await ct.close();

  section("Điện thoại 390px: không tràn ngang");
  const cm = await ctxFor(SA, { width: 390, height: 800 });
  const pm = await cm.newPage(); watch(pm);
  for (const path of ["/admin/trien-khai", "/admin/nhat-ky", "/admin", "/admin/quan-tri-vien"]) {
    await pm.goto(`${ADMIN}${path}`, { waitUntil: "networkidle", timeout: 120000 });
    await pm.getByRole("navigation", { name: "Module quản trị" }).waitFor({ timeout: 90000 });
    await pm.waitForTimeout(800);
    check(`${path} ở 390px không tràn ngang`, await noOverflow(pm));
  }
  const cmt = await ctxFor(T, { width: 390, height: 800 });
  const pmt = await cmt.newPage(); watch(pmt);
  await pmt.goto(`${BASE}/lop-cua-toi/cai-dat`, { waitUntil: "networkidle", timeout: 120000 });
  await pmt.getByTestId("the-han-muc").waitFor({ timeout: 90000 });
  check("/lop-cua-toi/cai-dat ở 390px không tràn ngang", await noOverflow(pmt));
  await shot(pmt, "tk-ket-noi-luu-tru-390");
  await cm.close(); await cmt.close();

  check("không có lỗi console / pageerror", errors.length === 0, errors.slice(0, 5));
  await closeAll();
  await done();
})().catch(async e => { console.error("CRASH", e); await closeAll(); process.exit(1); });
