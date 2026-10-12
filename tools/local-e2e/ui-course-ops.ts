import { mkUser, mkTutor, mkCourse, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, shot, ADMIN } from "./ui";
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
  await page.goto(`${ADMIN}/admin/khoa-hoc/${course.id}?tab=cai-dat`, { waitUntil: "networkidle" });
  const cap = page.getByLabel("Sức chứa (số học viên tối đa)");
  await cap.waitFor({ timeout: 60000 });
  check("sức chứa trống khi không giới hạn", (await cap.inputValue()) === "");
  const status = page.getByLabel("Trạng thái nhận học viên");
  check("trạng thái mặc định 'open'", (await status.inputValue()) === "open");

  await cap.fill("abc");
  await page.getByRole("button", { name: /Lưu thay đổi/ }).click();
  await page.waitForTimeout(500);
  check("nhập chữ → báo lỗi, không gọi lưu", dialogs.some(d => /số nguyên không âm/.test(d)), dialogs);

  await cap.fill("1");
  await page.getByRole("button", { name: /Lưu thay đổi/ }).click();
  await eventually("đặt 1 khi chỉ có 1 học viên active (pending không tính) → lưu được", async () => (await prisma.course.findUnique({ where: { id: course.id } }))?.capacity === 1);

  await cap.fill("5");
  await status.selectOption("paused");
  await page.getByRole("button", { name: /Lưu thay đổi/ }).click();
  await eventually("DB: capacity=5, classStatus=paused", async () => {
    const db = await prisma.course.findUnique({ where: { id: course.id } });
    return db?.capacity === 5 && db?.classStatus === "paused";
  });
  await shot(page, "course-ops-settings");

  await page.reload({ waitUntil: "networkidle" });
  await cap.waitFor();
  check("tải lại: giữ giá trị 5 / paused", (await cap.inputValue()) === "5" && (await status.inputValue()) === "paused");

  await cap.fill("");
  await page.getByRole("button", { name: /Lưu thay đổi/ }).click();
  await eventually("xoá trống → null (không giới hạn)", async () => (await prisma.course.findUnique({ where: { id: course.id } }))?.capacity === null);

  section("Tab Học viên: cột Trạng thái");
  await page.goto(`${ADMIN}/admin/khoa-hoc/${course.id}?tab=hoc-vien`, { waitUntil: "networkidle" });
  await page.getByText("Em Một").waitFor({ timeout: 60000 });
  check("có cột 'Trạng thái'", await page.getByRole("columnheader", { name: "Trạng thái" }).isVisible());
  check("Em Một → Đang học", await page.getByRole("row", { name: /Em Một/ }).getByText("Đang học").isVisible());
  check("Em Hai → Chờ phụ huynh xác nhận (kèm chữ)", await page.getByRole("row", { name: /Em Hai/ }).getByText("Chờ phụ huynh xác nhận").isVisible());
  await shot(page, "course-ops-students");

  check("không lỗi console", errors.length === 0, errors.slice(0, 3));
  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
