import { BASE, mkUser, mkTutor, mkCourse, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, shot, ADMIN, kinPick, kinValue } from "./ui";
import { prisma } from "@/lib/prisma";

(async () => {
  await wipe();
  const tutor = await mkTutor("Cô Lan");
  const course = await mkCourse(tutor.id, { name: "Toán 9" });
  const s1 = await mkUser({ name: "Em Một" }), s2 = await mkUser({ name: "Em Hai" });
  await prisma.enrollment.create({ data: { userId: s1.id, courseId: course.id, status: "active" } });
  await prisma.enrollment.create({ data: { userId: s2.id, courseId: course.id, status: "pending_consent" } });
  await launch();

  const ctx = await ctxFor(tutor);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  const dialogs: string[] = [];
  page.on("dialog", d => { dialogs.push(d.message()); d.dismiss().catch(() => {}); });

  section("Tab Cài đặt: Vận hành lớp");
  await page.goto(`${BASE}/admin/khoa-hoc/${course.id}?tab=cai-dat`, { waitUntil: "networkidle" });
  const cap = page.getByLabel("Sức chứa (số học viên tối đa)");
  await cap.waitFor({ timeout: 60000 });
  check("sức chứa trống khi không giới hạn", (await cap.inputValue()) === "");
  // LOI-02: "Trạng thái nhận học viên" nay là KinSelect (nút combobox, không có <select>/inputValue) ⇒ đọc nhãn đang hiện, chọn bằng mở-rồi-bấm.
  const status = page.getByRole("combobox", { name: "Trạng thái nhận học viên" });
  check("trạng thái mặc định 'open' (nút hiện 'Đang nhận học viên')", (await kinValue(status)) === "Đang nhận học viên", await kinValue(status));

  await cap.fill("abc");
  await page.getByRole("button", { name: /Lưu thay đổi/ }).click();
  await page.waitForTimeout(500);
  check("nhập chữ → báo lỗi, không gọi lưu", dialogs.some(d => /số nguyên không âm/.test(d)), dialogs);

  await cap.fill("1");
  await page.getByRole("button", { name: /Lưu thay đổi/ }).click();
  await eventually("đặt 1 khi chỉ có 1 học viên active (pending không tính) → lưu được", async () => (await prisma.course.findUnique({ where: { id: course.id } }))?.capacity === 1);

  await cap.fill("5");
  await kinPick(status, "Tạm dừng nhận (có thể mở lại)");
  await page.getByRole("button", { name: /Lưu thay đổi/ }).click();
  await eventually("DB: capacity=5, classStatus=paused", async () => {
    const db = await prisma.course.findUnique({ where: { id: course.id } });
    return db?.capacity === 5 && db?.classStatus === "paused";
  });
  await shot(page, "course-ops-settings");

  await page.reload({ waitUntil: "networkidle" });
  await cap.waitFor();
  check("tải lại: giữ giá trị 5 / paused", (await cap.inputValue()) === "5" && (await kinValue(status)) === "Tạm dừng nhận (có thể mở lại)");

  await cap.fill("");
  await page.getByRole("button", { name: /Lưu thay đổi/ }).click();
  await eventually("xoá trống → null (không giới hạn)", async () => (await prisma.course.findUnique({ where: { id: course.id } }))?.capacity === null);

  // LOI-07: bảng học viên nay là DanhBaLop (GS-LOP-GON) — KHÔNG còn cột "Trạng thái"; cột cuối "Hồ sơ" nói trạng thái bằng CHỮ: em đang học có liên kết "Hồ sơ",
  // em chờ phụ huynh đồng ý hiện "Chờ đồng ý" (DanhBaLop.tsx:126, :154-159). Kiểm theo bảng đang có thật, không thêm lại cột cũ.
  section("Tab Học viên (danh bạ lớp): cột Hồ sơ nói trạng thái bằng chữ");
  await page.goto(`${BASE}/admin/khoa-hoc/${course.id}?tab=hoc-vien`, { waitUntil: "networkidle" });
  await page.waitForURL(u => u.pathname === `/lop-cua-toi/quan-lop/${course.id}/hoc-vien`, { timeout: 60000 });
  await page.getByRole("table").getByText("Em Một", { exact: true }).waitFor({ timeout: 60000 }); // trang nay còn khối link báo cáo ("Mỗi em một link…", tên em) ⇒ chỉ đợi trong bảng
  const heads = await page.getByRole("table").getByRole("columnheader").allInnerTexts();
  check("cột bảng: Học sinh · Email · SĐT · Trường · Tiến độ · Ghi danh · Hồ sơ (không còn cột 'Trạng thái')", heads.map(h => h.trim().toLowerCase()).join("|") === "học sinh|email|sđt|trường|tiến độ|ghi danh|hồ sơ", heads);
  check("Em Một (đang học) → liên kết 'Hồ sơ' tới /lop-cua-toi/hoc-sinh/em/<id>", (await page.getByRole("row", { name: /Em Một/ }).getByRole("link", { name: "Hồ sơ của Em Một" }).getAttribute("href")) === `/lop-cua-toi/hoc-sinh/em/${s1.id}`);
  check("Em Hai (chờ phụ huynh) → chữ 'Chờ đồng ý', KHÔNG có liên kết hồ sơ", await page.getByRole("row", { name: /Em Hai/ }).getByText("Chờ đồng ý").isVisible() && (await page.getByRole("row", { name: /Em Hai/ }).getByRole("link", { name: /Hồ sơ/ }).count()) === 0);
  await shot(page, "course-ops-students");

  check("không lỗi console", errors.length === 0, errors.slice(0, 3));
  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
