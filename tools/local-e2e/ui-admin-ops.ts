// QT-01/02/03/04/06/07 + TK-07/GO-08 trên trình duyệt thật: Triển khai và hạn mức, Nhật ký, Hôm nay cần làm gì, bảng vai, lối vào Duyệt nạp Coin,
// lọc học sinh theo lớp, nhắc theo lớp, Cài đặt gia sư (Kết nối trung thực + thẻ hạn mức). 1280px và 390px (không tràn ngang).
import { BASE, mkTutor, mkUser, mkCourse, mkSuper, wipe, check, section, done } from "./h";
import { launch, ctxFor, shot, closeAll, ADMIN } from "./ui";
import { prisma } from "@/lib/prisma";

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
  const strip = pg.getByRole("navigation", { name: "Trang của Cài đặt" });
  check("dải tab Cài đặt có 'Duyệt nạp Coin' và 'Triển khai và hạn mức' (QT-06, QT-03)", await strip.getByRole("link", { name: "Duyệt nạp Coin" }).isVisible() && await strip.getByRole("link", { name: "Triển khai và hạn mức" }).getAttribute("aria-current") === "page");

  section("Triển khai và hạn mức (QT-03)");
  const flags = pg.getByTestId("co-trien-khai");
  await flags.waitFor({ timeout: 60000 });
  check("4 cờ, mỗi cờ có chữ Đang bật/Đang tắt/Đã đặt/Chưa đặt", await flags.locator("li").count() === 4 && /Đang tắt|Đang bật/.test(await flags.locator('[data-flag="KIN_TRIAL_MODE"]').innerText()) && /Đã đặt/.test(await flags.locator('[data-flag="CRON_SECRET"]').innerText()));
  check("KHÔNG có nút/ô để đổi cờ (chỉ xem)", await flags.locator("button, input, select, [role=switch]").count() === 0);
  check("không lộ giá trị CRON_SECRET trong trang", !(await pg.content()).includes(process.env.CRON_SECRET!));
  const crons = pg.getByTestId("cron-gan-nhat");
  check("cron: remind-class 'Đúng lịch', hai tác vụ kia 'Chưa ghi nhận'", /Đúng lịch/.test(await crons.locator('[data-cron="remind-class"]').innerText()) && /Chưa ghi nhận/.test(await crons.locator('[data-cron="remind-exam"]').innerText()) && /Chưa ghi nhận/.test(await crons.locator('[data-cron="expire-tutor-subscriptions"]').innerText()));
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
  const tab = pg.getByRole("navigation", { name: "Trang của Kiểm duyệt" });
  check("tab Kiểm duyệt có 'Nhật ký' đang ở", await tab.getByRole("link", { name: "Nhật ký" }).getAttribute("aria-current") === "page");
  await pg.getByLabel("Loại việc").selectOption("tutor.approve");
  await pg.waitForFunction(`document.querySelectorAll('[data-testid=nhat-ky] li').length === 1`, null, { timeout: 30000 });
  check("lọc 'Duyệt hồ sơ gia sư' → còn đúng 1 dòng", await list.locator("li").count() === 1);
  await pg.getByLabel("Loại việc").selectOption("user.role_change");
  await pg.getByText("Chưa có dòng nhật ký nào khớp").waitFor({ timeout: 30000 });
  check("lọc ra rỗng → câu giải thích, không bảng trống", await pg.getByText("Chưa có dòng nhật ký nào khớp").isVisible());
  await shot(pg, "qt-nhat-ky");

  section("Hôm nay cần làm gì (QT-04) + nhắc theo lớp (QT-07)");
  await pg.goto(`${ADMIN}/admin`, { waitUntil: "networkidle", timeout: 120000 });
  const hn = pg.getByTestId("hom-nay");
  await hn.locator("[data-todo]").first().waitFor({ timeout: 60000 });
  const keys = await hn.locator("[data-todo]").evaluateAll(els => els.map(e => e.getAttribute("data-todo")).sort().join());
  check("danh sách có đúng việc đang chờ: gia sư xin duyệt + nạp Coin", keys === "gia-su,nap-coin", keys);
  check("mỗi việc là liên kết bấm được tới trang xử lý", await hn.locator('[data-todo="nap-coin"] a').getAttribute("href") === "/admin/topups" && await hn.locator('[data-todo="gia-su"] a').getAttribute("href") === "/admin/kiem-duyet");
  check("mục chờ lâu nhất vẫn có chữ giải thích (không chỉ số)", /Đối chiếu sao kê rồi duyệt/.test(await hn.innerText()));
  await pg.getByRole("button", { name: "Nhắc nhở theo lớp" }).click();
  const sel = pg.getByTestId("nhac-chon-lop");
  await sel.waitFor({ timeout: 30000 });
  const send = pg.getByRole("button", { name: /Chọn lớp để gửi/ });
  check("chưa chọn lớp → nút gửi bị khoá, ghi 'Chọn lớp để gửi'", await send.isDisabled());
  await sel.selectOption({ label: "Toán 9 Lan · 2 học sinh" });
  check("chọn lớp → nút nói rõ số học sinh của lớp đó (2), không phải toàn nền tảng", await pg.getByRole("button", { name: "Gửi tới lớp này (2 học sinh)" }).isEnabled());
  await pg.getByRole("button", { name: "Gửi tới lớp này (2 học sinh)" }).click();
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
  await pg.goto(`${ADMIN}/admin/ho-so-gia-su`, { waitUntil: "networkidle", timeout: 120000 });
  check("trang Duyệt gia sư dẫn về Hàng chờ", await pg.getByRole("link", { name: "Hàng chờ" }).first().getAttribute("href") === "/admin/kiem-duyet");
  await pg.goto(`${ADMIN}/admin/topups`, { waitUntil: "networkidle", timeout: 120000 });
  await pg.getByRole("heading", { name: "Yêu cầu nạp Coin" }).waitFor({ timeout: 60000 });
  check("Duyệt nạp Coin mở được từ menu (cấp 1): thấy trang và 1 yêu cầu đang chờ", await pg.getByRole("heading", { name: "Yêu cầu nạp Coin" }).isVisible() && /100\.000/.test(await pg.innerText("body")));
  await ctx.close();

  section("Quyền: quản trị nội dung không thấy Nhật ký / Triển khai / Duyệt nạp Coin");
  const cc = await ctxFor(CA, { width: 1280, height: 900 });
  const pc = await cc.newPage(); watch(pc);
  await pc.goto(`${ADMIN}/admin/kiem-duyet`, { waitUntil: "networkidle", timeout: 120000 });
  await pc.getByRole("navigation", { name: "Trang của Kiểm duyệt" }).waitFor({ timeout: 90000 });
  const links = await pc.getByRole("link").allInnerTexts();
  check("không có lối vào Nhật ký, Triển khai và hạn mức, Duyệt nạp Coin", !links.some(l => /^Nhật ký$|Triển khai và hạn mức|Duyệt nạp Coin/.test(l.trim())), links.filter(Boolean).slice(0, 30));
  await pc.goto(`${ADMIN}/admin/nhat-ky`, { waitUntil: "networkidle", timeout: 120000 });
  await pc.waitForURL(/\/admin$/, { timeout: 30000 });
  await pc.getByText("Hôm nay cần làm gì").waitFor({ timeout: 60000 });
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
