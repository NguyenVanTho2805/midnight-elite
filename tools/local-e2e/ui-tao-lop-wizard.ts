// Wizard tạo lớp 3 bước (LO-03) + Thêm học sinh trong chi tiết lớp (LO-09) + tổng hợp link báo cáo cả lớp (LO-13), trình duyệt thật.
// Chạy (máy chủ dev bật): source tools/local-e2e/env.sh && npx tsx tools/local-e2e/ui-tao-lop-wizard.ts
import { BASE, mkTutor, mkUser, mkCourse, wipe, check, section, done, eventually } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), O = await mkTutor("Cô Khác");
  for (const u of [T, O]) await prisma.user.update({ where: { id: u.id }, data: { preferences: { modules: ["hop-viec", "lop", "bai-kt", "thu-vien"] } } });
  const old = await mkCourse(T.id, { name: "Lớp cũ của cô Lan" }), cO = await mkCourse(O.id, { name: "Lớp của cô khác" });
  const A = await mkUser({ name: "Em An Cũ" }), B = await mkUser({ name: "Em Bình Cũ" }), X = await mkUser({ name: "Em Của Cô Khác" }), PAR = await mkUser({ name: "Phụ huynh An" });
  for (const u of [A, B]) await prisma.enrollment.create({ data: { userId: u.id, courseId: old.id, status: "active" } });
  await prisma.enrollment.create({ data: { userId: X.id, courseId: cO.id, status: "active" } });
  const link = await prisma.parentLink.create({ data: { parentId: PAR.id, studentId: A.id, status: "verified", verifiedAt: new Date() } });

  await launch();
  const errors: string[] = [];
  const watch = (p: any) => { p.on("pageerror", (e: unknown) => errors.push(String(e))); p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of [45]/i.test(m.text())) errors.push(m.text()); }); };

  section("Wizard 3 bước");
  const p = await (await ctxFor(T, { width: 1280, height: 900 })).newPage(); watch(p);
  await p.goto(`${BASE}/lop-cua-toi/lop/tao`, { waitUntil: "networkidle", timeout: 120000 });
  await p.getByRole("heading", { name: "Tạo lớp học", level: 1 }).waitFor({ timeout: 90000 });
  const stepOf = async () => p.locator("[data-wizard-step][aria-current=step]").getAttribute("data-wizard-step");
  check("3 bước hiện đủ; đang ở bước 1 'Thông tin', có 'Cách tính học phí'", await p.locator("[data-wizard-step]").count() === 3 && await stepOf() === "1" && await p.getByText("Cách tính học phí").first().isVisible());
  check("bước 1 chưa có nút tạo lớp (chỉ 'Tiếp tục')", await p.getByRole("button", { name: /^Tạo lớp/ }).count() === 0 && await p.getByRole("button", { name: "Tiếp tục" }).isVisible());
  await p.getByRole("button", { name: "Tiếp tục" }).click();
  check("tên trống → ở lại bước 1, có lỗi", await stepOf() === "1" && await p.locator("p[role=alert]").filter({ hasText: "tên lớp" }).isVisible());
  await p.getByLabel(/Tên lớp/).fill("Toán 9 wizard");
  await p.getByLabel(/Hình thức|Theo buổi/).first().isVisible().catch(() => false);
  await p.getByLabel(/Theo giờ/).check();
  await p.getByRole("button", { name: "Tiếp tục" }).click();
  check("theo giờ mà thiếu đơn giá → lỗi, ở lại bước 1 (học phí kiểu mới được kiểm)", await stepOf() === "1" && await p.locator("p[role=alert]").isVisible());
  await p.getByLabel(/^Đơn giá/).fill("150000");
  await p.getByRole("button", { name: "Tiếp tục" }).click();
  check("sang bước 2 'Học sinh'", await stepOf() === "2" && await p.getByText("Chọn em đã học một lớp khác của cô").isVisible());
  const rows = p.locator("[data-picker-row]");
  await rows.first().waitFor({ timeout: 30000 });
  check("danh sách chỉ có em của cô Lan (An, Bình); KHÔNG có em của cô khác", await rows.count() === 2 && await p.getByText("Em Của Cô Khác").count() === 0);
  await p.getByLabel("Tìm trong học sinh của cô").fill("an cũ");
  check("tìm 'an cũ' → 1 em", await rows.count() === 1);
  await p.getByLabel("Tìm trong học sinh của cô").fill("");
  await rows.filter({ hasText: "Em An Cũ" }).getByRole("checkbox").check();
  await rows.filter({ hasText: "Em Bình Cũ" }).getByRole("checkbox").check();
  check("đã chọn 2 em", await p.getByText("Đã chọn 2 em.").isVisible());
  await p.getByLabel("Tìm trong học sinh của cô").press("Enter");
  check("Enter trong ô tìm không tạo lớp mà sang bước 3", await stepOf() === "3" && await prisma.course.count({ where: { ownerId: T.id } }) === 1);
  check("bước 3: chưa có khung giờ → nút ghi 'Tạo lớp' (0 buổi)", await p.getByRole("button", { name: "Tạo lớp", exact: true }).isVisible());
  await p.getByRole("button", { name: "Thêm khung giờ" }).click();
  await p.getByLabel("Ngày trong tuần").selectOption("2");
  await p.getByLabel("Buổi đầu từ ngày").fill("2026-10-26");
  await p.getByLabel("Xem trước số tuần").selectOption("4");
  check("thứ Ba × 4 tuần từ 26/10 → nút 'Tạo lớp + 4 buổi', có câu giải thích buổi ra từ lịch tuần", await p.getByRole("button", { name: "Tạo lớp + 4 buổi" }).isVisible() && await p.getByText(/có 4 buổi\. Buổi học sinh ra từ lịch tuần/).isVisible());
  await p.getByRole("button", { name: "Thêm khung giờ" }).click();
  check("thêm khung thứ hai (cùng giờ, cùng ngày) → báo trùng khi tạo", await p.locator("[data-wizard-slot]").count() === 2);
  await p.getByRole("button", { name: /^Tạo lớp \+ \d+ buổi$/ }).click();
  check("hai khung trùng nhau → lỗi, KHÔNG tạo lớp", await p.locator("p[role=alert]").filter({ hasText: "trùng" }).isVisible() && await prisma.course.count({ where: { ownerId: T.id } }) === 1);
  await p.getByRole("button", { name: "Bỏ khung giờ 2" }).click();
  await shot(p, "tao-lop-wizard");
  await p.getByRole("button", { name: "Quay lại" }).click();
  await p.getByText("Đã chọn 2 em.").waitFor({ timeout: 30000 });
  check("Quay lại → bước 2, lựa chọn 2 em còn nguyên (giữ trong wizard)", await stepOf() === "2" && await rows.filter({ hasText: "Em An Cũ" }).getByRole("checkbox").isChecked());
  await p.getByRole("button", { name: "Tiếp tục" }).click();
  await p.getByRole("button", { name: "Tạo lớp + 4 buổi" }).click();
  await p.waitForURL(/\/lop-cua-toi\/toan-9-wizard/, { timeout: 90000 });
  const made = await prisma.course.findFirstOrThrow({ where: { ownerId: T.id, name: "Toán 9 wizard" } });
  const rate = await prisma.courseFeeRate.findFirst({ where: { courseId: made.id } });
  check("DB: lớp của cô Lan, học phí theo giờ 150.000 (đơn giá lưu ở CourseFeeRate, một buổi 90 phút)", made.ownerId === T.id && made.feeMode === "per_hour" && rate?.rate === 150000 && rate?.sessionMinutes === 90, { m: made.feeMode, r: rate });
  await eventually("DB: khung giờ T3 19:00–20:30 (đúng 1 khung)", async () => (await prisma.classSchedule.count({ where: { courseId: made.id, dayOfWeek: 2, startTime: "19:00", endTime: "20:30" } })) === 1);
  await eventually("DB: 2 em ghi danh vào lớp mới (active)", async () => (await prisma.enrollment.count({ where: { courseId: made.id, status: "active", userId: { in: [A.id, B.id] } } })) === 2);
  check("tới trang lớp, tab Mã mời mở sẵn + thông báo 'Đã thêm 2 học sinh'", (await p.getByRole("tab", { name: "Mã mời" }).getAttribute("aria-selected")) === "true" && await p.getByText("Đã thêm 2 học sinh vào lớp").isVisible());
  check("em của cô khác KHÔNG bị ghi danh", await prisma.enrollment.count({ where: { courseId: made.id, userId: X.id } }) === 0);

  section("LO-09: nút 'Thêm học sinh' trong chi tiết lớp");
  const cNew = await mkCourse(T.id, { name: "Lớp trống" });
  const q = await (await ctxFor(T, { width: 1280, height: 900 })).newPage(); watch(q);
  await q.goto(`${BASE}/lop-cua-toi/${cNew.id}`, { waitUntil: "networkidle", timeout: 120000 });
  await q.getByRole("button", { name: "Thêm học sinh", exact: true }).first().click();
  check("bấm → sang tab Học sinh, mở khung chọn em", (await q.getByRole("tab", { name: /^Học sinh/ }).getAttribute("aria-selected")) === "true" && await q.locator("[data-lop-them]").isVisible());
  await q.locator("[data-picker-row]").first().waitFor({ timeout: 30000 });
  check("danh sách em có thể thêm: An, Bình (đã học lớp của cô), không có em cô khác", await q.locator("[data-picker-row]").count() === 2 && await q.getByText("Em Của Cô Khác").count() === 0, await q.locator("[data-picker-row]").count());
  await q.locator("[data-picker-row]").filter({ hasText: "Em Bình Cũ" }).getByRole("checkbox").check();
  await q.getByRole("button", { name: "Thêm 1 em vào lớp" }).click();
  await eventually("DB: Bình vào lớp trống", async () => (await prisma.enrollment.count({ where: { courseId: cNew.id, userId: B.id, status: "active" } })) === 1);
  await q.getByText("Đã thêm 1 em vào lớp.").waitFor({ timeout: 30000 });
  await eventually("sau khi thêm: Bình hiện trong danh sách lớp", async () => q.getByRole("list", { name: "Học sinh của lớp" }).getByText("Em Bình Cũ").isVisible());

  section("LO-13: tổng hợp link báo cáo của cả lớp");
  const r = await (await ctxFor(T, { width: 1280, height: 900 })).newPage(); watch(r);
  await r.goto(`${BASE}/lop-cua-toi/${old.id}`, { waitUntil: "networkidle", timeout: 120000 });
  await r.getByRole("tab", { name: /^Học sinh/ }).click();
  const brows = r.locator("[data-lop-bao-cao]");
  await brows.first().waitFor({ timeout: 30000 });
  check("2 em; An có phụ huynh liên kết (có nút 'Bật link'), Bình chưa có phụ huynh (nói rõ, không có nút bật)", await brows.count() === 2 && await brows.filter({ hasText: "Em An Cũ" }).getByText("Chưa bật").isVisible() && await brows.filter({ hasText: "Em An Cũ" }).getByRole("button", { name: /^Bật link báo cáo của/ }).isVisible()
    && await brows.filter({ hasText: "Em Bình Cũ" }).getByText("Chưa có phụ huynh liên kết").isVisible() && await brows.filter({ hasText: "Em Bình Cũ" }).getByRole("button", { name: /^Bật link/ }).count() === 0);
  await brows.filter({ hasText: "Em An Cũ" }).getByRole("checkbox").check();
  await r.getByRole("button", { name: "Bật link cho 1 em đã chọn" }).click();
  await r.getByText("Đã bật 1 link báo cáo riêng.").waitFor({ timeout: 30000 });
  const tok = (await prisma.parentLink.findUnique({ where: { id: link.id } }))?.portalToken ?? "";
  check("bật xong: token ngẫu nhiên 32 hex trong DB; dòng An có Copy link, Xem thử (đúng đường dẫn), Thu hồi ngay", /^[0-9a-f]{32}$/.test(tok) && await brows.filter({ hasText: "Em An Cũ" }).getByRole("link", { name: /^Xem thử báo cáo của/ }).getAttribute("href") === `/so-cua-con/${tok}` && await brows.filter({ hasText: "Em An Cũ" }).getByRole("button", { name: /^Thu hồi link báo cáo của/ }).isVisible());
  await brows.filter({ hasText: "Em An Cũ" }).getByRole("button", { name: /^Thu hồi link báo cáo của/ }).click();
  await r.getByRole("button", { name: "Thu hồi ngay" }).last().click();
  await eventually("sau thu hồi: DB token = null", async () => (await prisma.parentLink.findUnique({ where: { id: link.id } }))?.portalToken === null);

  section("Điện thoại 390px");
  const m = await (await ctxFor(T, { width: 390, height: 844 })).newPage(); watch(m);
  for (const path of ["/lop-cua-toi/lop/tao", `/lop-cua-toi/${old.id}?tab=hoc-sinh`]) {
    await m.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 120000 });
    await m.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), undefined, { timeout: 90000 });
    if (path.includes("tao")) { await m.getByLabel(/Tên lớp/).fill("Lớp thử 390"); await m.getByRole("button", { name: "Tiếp tục" }).click(); await m.locator("[data-picker-row]").first().waitFor({ timeout: 30000 }); }
    else await m.locator("[data-lop-bao-cao]").first().waitFor({ timeout: 30000 });
    const small = await m.evaluate(`[...document.querySelectorAll('main a, main button, main select, main input, [role=tab]')].filter(e => e.offsetParent && e.getBoundingClientRect().height < 43.5 && e.type !== 'checkbox' && !e.closest('nav') && !e.closest('label')).map(e => e.textContent.trim().slice(0,30) + ':' + Math.round(e.getBoundingClientRect().height))`) as string[];
    check(`${path}: không tràn ngang, nút ≥ 44px`, (await m.evaluate("document.documentElement.scrollWidth")) as number <= 390 && small.length === 0, small);
  }
  await shot(m, "tao-lop-wizard-mobile");
  check("không lỗi trang", errors.length === 0, errors.slice(0, 4));
  await closeAll();
  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
