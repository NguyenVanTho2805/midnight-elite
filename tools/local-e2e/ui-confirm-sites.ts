// 8 chỗ từng dùng window.confirm nay đi qua KinConfirm (useKinConfirm). Test chạy thật ở 3 trang quản trị:
//   - không còn hộp thoại gốc của trình duyệt (đếm sự kiện "dialog" của Playwright = 0)
//   - hộp KiN mở đúng tiêu đề, tiêu điểm ở nút an toàn (Huỷ), Huỷ / Esc không xoá gì, Xác nhận mới xoá thật (kiểm DB)
import { mkTutor, mkUser, mkCourse, mkSuper, wipe, check, section, done, eventually } from "./h";
import { launch, ctxFor, closeAll, ADMIN } from "./ui";
import { prisma } from "@/lib/prisma";

(async () => {
  await wipe();
  const SA = await mkSuper("Quản trị cấp 1"), T = await mkTutor("Cô Lan"), S = await mkUser({ name: "Học viên" });
  const C = await mkCourse(T.id, { name: "Toán 9" });
  await prisma.courseReview.create({ data: { userId: S.id, courseId: C.id, rating: 4, comment: "Khóa học rất tốt", status: "pending" } });
  await prisma.examFileFolder.create({ data: { name: "Thư mục thử", ownerId: SA.id } });
  await prisma.exam.create({ data: { id: "ex-xoa", code: "ex-xoa", title: "Đề xoá thử", category: "Toán", date: "01/01/2030", time: "08:00", duration: "45 phút", questions: 0, status: "available", createdAt: "2020", ownerId: SA.id } });

  await launch();
  const errors: string[] = [];
  let nativeDialogs = 0;
  const ctx = await ctxFor(SA, { width: 1280, height: 900 });
  const pg = await ctx.newPage();
  pg.on("dialog", d => { nativeDialogs++; void d.dismiss(); });
  pg.on("pageerror", e => errors.push(String(e)));
  pg.on("console", m => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of (4|5)/i.test(m.text())) errors.push(m.text()); });

  const flow = async (name: string, open: () => Promise<void>, title: string, gone: () => Promise<boolean>, confirmLabel = "Xoá") => {
    section(name);
    await open();
    const dlg = pg.getByRole("dialog", { name: title });
    await dlg.waitFor({ timeout: 20000 });
    check(`mở hộp KiN '${title}' (role=dialog, aria-modal)`, await dlg.getAttribute("aria-modal") === "true");
    check("tiêu điểm rơi vào 'Huỷ' (Enter nhầm không xoá được gì)", await dlg.getByRole("button", { name: "Huỷ" }).evaluate(e => e === document.activeElement));
    check("không có hộp thoại gốc của trình duyệt", nativeDialogs === 0, nativeDialogs);
    await dlg.getByRole("button", { name: "Huỷ" }).click();
    check("Huỷ: hộp đóng, dữ liệu còn nguyên", await dlg.count() === 0 && !(await gone()));
    await open();
    await dlg.waitFor({ timeout: 20000 });
    await pg.keyboard.press("Escape");
    check("Esc: hộp đóng, dữ liệu còn nguyên", await dlg.count() === 0 && !(await gone()));
    await open();
    await dlg.waitFor({ timeout: 20000 });
    await dlg.getByRole("button", { name: confirmLabel, exact: true }).click();
    await eventually("Xác nhận: dữ liệu bị xoá thật (DB)", gone, 20000);
    check("vẫn không có hộp thoại gốc", nativeDialogs === 0, nativeDialogs);
  };

  await pg.goto(`${ADMIN}/admin/danh-gia`, { waitUntil: "networkidle", timeout: 120000 });
  await pg.getByText("Khóa học rất tốt").waitFor({ timeout: 90000 });
  await flow("Đánh giá khoá học: Xóa đánh giá", async () => { await pg.getByRole("button", { name: "Xóa", exact: true }).click(); }, "Xóa đánh giá này?", async () => (await prisma.courseReview.count()) === 0);

  await pg.goto(`${ADMIN}/admin/thi-thu/ngan-hang-de-thi`, { waitUntil: "networkidle", timeout: 120000 });
  await pg.getByText("Thư mục thử").waitFor({ timeout: 90000 });
  await flow("Ngân hàng đề: Xoá thư mục", async () => { await pg.getByRole("button", { name: "Xoá", exact: true }).first().click(); }, "Xoá thư mục này?", async () => (await prisma.examFileFolder.count()) === 0);

  await pg.goto(`${ADMIN}/admin/thi-thu`, { waitUntil: "networkidle", timeout: 120000 });
  await pg.getByText("Đề xoá thử").first().waitFor({ timeout: 90000 });
  await flow("Quản lý đề thi: Xóa đề", async () => {
    await pg.locator("tr", { hasText: "Đề xoá thử" }).getByRole("button", { name: "···" }).click();
    await pg.getByRole("button", { name: "Xóa đề thi", exact: true }).click();
  }, "Xóa đề thi này?", async () => (await prisma.exam.count({ where: { id: "ex-xoa" } })) === 0);

  section("Không lỗi trình duyệt");
  check("không pageerror / console.error", errors.length === 0, errors.slice(0, 3));
  await closeAll();
  await done();
})().catch(async e => { console.error("TEST CRASH", e); await closeAll().catch(() => {}); process.exit(1); });
