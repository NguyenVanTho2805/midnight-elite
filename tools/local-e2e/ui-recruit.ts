import { BASE, mkTutor, mkUser, mkCourse, mkAttendanceSession, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, shot } from "./ui";
import { prisma } from "@/lib/prisma";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), N = await mkTutor("Thầy Chờ Duyệt");
  await prisma.user.update({ where: { id: T.id }, data: { tutorVerified: true, subjects: ["Toán 9"] } });
  await prisma.user.update({ where: { id: N.id }, data: { tutorVerified: false } });
  const c1 = await mkCourse(T.id, { name: "Toán 9", capacity: 5 });
  for (let i = 0; i < 2; i++) await prisma.enrollment.create({ data: { userId: (await mkUser({ name: `HS ${i}` })).id, courseId: c1.id, status: "active" } });
  for (const d of ["2026-09-03", "2026-09-10"]) await mkAttendanceSession(c1.id, T.id, new Date(`${d}T00:00:00Z`));
  // một lượt mở link cũ để bảng "Link nào mang người về" có dữ liệu
  await prisma.profileVisit.createMany({ data: [{ tutorId: T.id, channel: "fb-gia-su-toan-ha-noi", kind: "open", visitorKey: "seed-visitor-1" }, { tutorId: T.id, channel: "fb-gia-su-toan-ha-noi", kind: "full", visitorKey: "seed-visitor-1" }, { tutorId: T.id, channel: "fb-gia-su-toan-ha-noi", kind: "open", visitorKey: "seed-visitor-2" }] });

  await launch();
  const ctx = await ctxFor(T);
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE }).catch(() => {});
  const opened: string[] = [];
  await ctx.route(/\/\/(zalo\.me|chat\.zalo\.me|www\.facebook\.com)\//, route => { opened.push(route.request().url()); void route.fulfill({ status: 200, contentType: "text/html", body: "<title>ext</title>" }); });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|facebook|zalo/i.test(m.text())) errors.push(m.text()); });
  const clip = () => page.evaluate(() => navigator.clipboard.readText()).catch(() => "");

  section("Mở trang soạn bài");
  await page.goto(`${BASE}/lop-cua-toi/bai-dang`, { waitUntil: "networkidle", timeout: 120000 });
  await page.getByRole("heading", { name: "Bài đăng tìm học sinh" }).waitFor({ timeout: 90000 });
  check("nói rõ KiN KHÔNG tự đăng vào nhóm Facebook", await page.getByText(/không tự đăng/).isVisible());
  const ta = page.getByLabel(/^Bài đăng \(sửa được/);
  await eventually("bài soạn sẵn từ hồ sơ + sổ lớp", async () => (await ta.inputValue()).includes("TÌM HỌC SINH — Toán 9"));
  let t = await ta.inputValue();
  check("tên, lớp còn 3 chỗ (5 − 2), 2 buổi đã dạy, link đuôi chung ?n=fb khi chưa đặt tên nhóm, dòng an toàn cuối bài", t.includes("Cô Lan đang nhận thêm học sinh.") && t.includes("• Lớp: Toán 9 (còn 3 chỗ)") && t.includes("• Đã dạy 2 buổi") && t.includes(`Xem hồ sơ và đăng ký học thử: ${BASE}/mentor/${T.id}?n=fb\n`) && t.trimEnd().endsWith("Cô không nhận chuyển khoản trước buổi học thử."), t);
  check("chưa đặt tên nhóm: có lời nhắc đặt tên", await page.getByText(/Chưa đặt tên nhóm nên link dùng đuôi chung/).isVisible());
  check("xưng hô mặc định 'Cô' theo tên", (await page.locator("label", { hasText: "Xưng hô" }).locator("select").inputValue()) === "Cô");
  check("bảng 'Link nào mang người về': fb-gia-su-toan-ha-noi 2 mở / 1 xem hết; ghi rõ không đếm được bài đăng", await page.getByRole("row", { name: /fb-gia-su-toan-ha-noi/ }).innerText().then(x => /2\s+1/.test(x.replace(/\s+/g, " "))) && await page.getByText(/không đếm được bài đăng trong nhóm/).isVisible());

  section("Mỗi nhóm một link riêng; đổi thì soạn lại");
  await page.getByLabel("Nhóm Facebook sẽ đăng").fill("Gia sư Toán Hà Nội");
  await eventually("link đổi sang ?n=fb-gia-su-toan-ha-noi trong bài và ở dòng 'Link riêng'", async () => (await ta.inputValue()).includes(`/mentor/${T.id}?n=fb-gia-su-toan-ha-noi`) && await page.getByText(/Link riêng của nhóm này/).locator("b").innerText().then(x => x.endsWith("?n=fb-gia-su-toan-ha-noi")));
  await page.getByLabel("Giờ còn trống", { exact: true }).fill("T3, T5 19h–20h30");
  await page.getByLabel("Học phí", { exact: true }).fill("200.000đ/buổi");
  await eventually("giờ và học phí vào bài", async () => { const x = await ta.inputValue(); return x.includes("• Giờ còn trống: T3, T5 19h–20h30") && x.includes("• Học phí: 200.000đ/buổi"); });
  await page.locator("label", { hasText: "Xưng hô" }).locator("select").selectOption("Thầy");
  await eventually("đổi xưng hô → dòng an toàn đổi theo", async () => (await ta.inputValue()).trimEnd().endsWith("Thầy không nhận chuyển khoản trước buổi học thử."));
  await page.locator("label", { hasText: "Xưng hô" }).locator("select").selectOption("Cô");
  await page.getByRole("checkbox", { name: /Toán 9/ }).uncheck();
  await eventually("bỏ chọn lớp → bài không còn dòng Lớp", async () => !(await ta.inputValue()).includes("• Lớp:"));
  await page.getByRole("checkbox", { name: /Toán 9/ }).check();

  section("Lưu nhóm để dùng lại");
  await page.getByRole("button", { name: "Lưu nhóm này" }).click();
  await eventually("nhóm hiện thành thẻ, nút Lưu biến mất, DB có preferences.connections.groups", async () => (await page.getByRole("button", { name: "Xoá nhóm Gia sư Toán Hà Nội" }).count()) === 1 && (await page.getByRole("button", { name: "Lưu nhóm này" }).count()) === 0 && JSON.stringify((await prisma.user.findUnique({ where: { id: T.id } }))?.preferences).includes("Gia sư Toán Hà Nội"));
  await page.getByLabel("Nhóm Facebook sẽ đăng").fill("Lớp 9 ôn thi");
  await page.getByRole("button", { name: "Lưu nhóm này" }).click();
  await eventually("lưu thêm nhóm 2", async () => (await page.getByRole("button", { name: "Xoá nhóm Lớp 9 ôn thi" }).count()) === 1);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Xoá nhóm Gia sư Toán Hà Nội" }).waitFor({ timeout: 60000 });
  check("tải lại: 2 nhóm vẫn còn (lưu theo tài khoản)", (await page.getByRole("button", { name: /Xoá nhóm/ }).count()) === 2);
  await page.getByRole("button", { name: "Gia sư Toán Hà Nội", exact: true }).click();
  await eventually("bấm tên nhóm đã lưu → chọn lại nhóm đó", async () => (await page.getByLabel("Nhóm Facebook sẽ đăng").inputValue()) === "Gia sư Toán Hà Nội");

  section("Sao chép / Facebook / Zalo");
  const ta2 = page.getByLabel(/^Bài đăng \(sửa được/);
  await eventually("bài soạn lại cho nhóm đã chọn", async () => (await ta2.inputValue()).includes("?n=fb-gia-su-toan-ha-noi"));
  await ta2.fill((await ta2.inputValue()).replace("\nCô không nhận chuyển khoản trước buổi học thử.", "") + "\nNhắn mình để được tư vấn."); // gia sư lỡ xoá dòng an toàn và thêm câu riêng
  await page.getByRole("button", { name: "Sao chép bài đăng" }).click();
  await eventually("sao chép: giữ câu riêng của gia sư VÀ tự thêm lại dòng an toàn ở cuối", async () => { const c = await clip(); return c.includes("Nhắn mình để được tư vấn.") && c.trimEnd().endsWith("Cô không nhận chuyển khoản trước buổi học thử."); });
  await page.getByRole("button", { name: "Chia sẻ lên Facebook" }).click();
  await eventually("mở hộp chia sẻ Facebook với đúng link (đã mã hoá), bài được chép sẵn để dán", () => opened.some(u => u.startsWith("https://www.facebook.com/sharer/sharer.php?u=") && decodeURIComponent(u).includes(`/mentor/${T.id}?n=fb-gia-su-toan-ha-noi`)), 15000);
  check("bài đã chép có dòng an toàn", (await clip()).trimEnd().endsWith("Cô không nhận chuyển khoản trước buổi học thử."));
  await page.getByRole("button", { name: "Gửi qua Zalo" }).click();
  await eventually("Zalo mở (chat.zalo.me — không SĐT vì đăng vào nhóm)", () => opened.some(u => u.startsWith("https://chat.zalo.me/")), 15000);

  section("Hồ sơ chưa duyệt: không cho sao chép link chết");
  const nctx = await ctxFor(N);
  const np = await nctx.newPage();
  await np.goto(`${BASE}/lop-cua-toi/bai-dang`, { waitUntil: "networkidle", timeout: 120000 });
  await np.getByRole("heading", { name: "Bài đăng tìm học sinh" }).waitFor({ timeout: 60000 });
  check("cảnh báo 'chưa được duyệt nên link chưa mở được'", await np.getByRole("alert").filter({ hasText: /chưa được duyệt/ }).isVisible());
  check("3 nút sao chép / Facebook / Zalo bị khoá", await np.getByRole("button", { name: "Sao chép bài đăng" }).isDisabled() && await np.getByRole("button", { name: "Chia sẻ lên Facebook" }).isDisabled() && await np.getByRole("button", { name: "Gửi qua Zalo" }).isDisabled());
  check("xưng hô mặc định 'Thầy' theo tên", (await np.locator("label", { hasText: "Xưng hô" }).locator("select").inputValue()) === "Thầy");

  section("Lối tắt ở Tổng quan + học sinh không vào được");
  await prisma.user.update({ where: { id: T.id }, data: { preferences: { modules: ["hop-viec", "lop"] } } });
  await page.goto(`${BASE}/lop-cua-toi/tong-quan`, { waitUntil: "networkidle" });
  await page.getByRole("navigation", { name: /Lối tắt/ }).getByRole("link", { name: "Bài đăng tìm HS" }).waitFor({ timeout: 60000 });
  check("Tổng quan có lối tắt 'Bài đăng tìm HS'", true);
  const S = await mkUser({ name: "Học sinh" });
  const sp = await (await ctxFor(S)).newPage();
  await sp.goto(`${BASE}/lop-cua-toi/bai-dang`, { waitUntil: "networkidle", timeout: 90000 });
  await sp.waitForURL(u => !u.pathname.includes("/bai-dang"), { timeout: 60000 }).catch(() => {}); // NC2-004: đọc URL ngay sau goto là chập chờn
  check("học sinh vào /bai-dang bị chuyển đi", !sp.url().includes("/bai-dang"), sp.url());

  section("Điện thoại 390px");
  const mp = await (await ctxFor(T, { width: 390, height: 800 })).newPage();
  await mp.goto(`${BASE}/lop-cua-toi/bai-dang`, { waitUntil: "networkidle", timeout: 120000 });
  await mp.getByRole("button", { name: "Sao chép bài đăng" }).waitFor({ timeout: 60000 });
  check("không tràn ngang", await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  const bb = await mp.getByRole("button", { name: "Sao chép bài đăng" }).boundingBox();
  check("nút cao ≥ 44px", !!bb && bb.height >= 44, bb);
  await shot(mp, "recruit-mobile");
  await shot(page, "recruit-desktop");

  check("không lỗi trang", errors.length === 0, errors.slice(0, 3));
  done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
