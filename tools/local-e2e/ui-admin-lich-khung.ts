// ADM D1, viết lại theo SCL-F2 (P2-27): tab "Màu và link học" của /admin/khoa-hoc/[id] chỉ còn khối màu + link chung và liên kết sang
// /lop-cua-toi/quan-lop/<id>/lich-hoc, nơi Chủ nhiệm thấy lưới LichKhung (1280 + 390, không tràn); toast nhân bản có số khung chép. Ngăn kéo tạo khoá đã bỏ (không còn ca). Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/ui-admin-lich-khung.ts
import { BASE, mkSuper, mkTutor, mkCourse, wipe, check, section, done } from "./h";
import { launch, ctxFor, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";

(async () => {
  await wipe();
  const S = await mkSuper("Admin Lịch");
  const T = await mkTutor("Cô Lan");
  const c = await mkCourse(T.id, { name: "Toán 9 khung" });
  await prisma.classSchedule.create({ data: { courseId: c.id, dayOfWeek: 2, startTime: "19:00", endTime: "20:30" } });
  const c0 = await mkCourse(T.id, { name: "Lý 8 chưa lịch" });
  await launch();

  for (const vp of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    section(`Tab Lịch học admin ${vp.width}px`);
    const ctx = await ctxFor(S, vp);
    const pg = await ctx.newPage();
    const errs: string[] = [];
    pg.on("pageerror", e => errs.push(String(e)));
    await pg.goto(`${BASE}/admin/khoa-hoc/${c.id}?tab=lich-hoc`, { waitUntil: "networkidle", timeout: 150000 });
    await pg.locator("[data-lop-lich-cai-dat]").waitFor({ timeout: 30000 });
    check("tab admin còn khối màu lớp và link chung", await pg.locator("[data-lop-lich-cai-dat]").isVisible());
    check("tab admin không còn lưới khung giờ", (await pg.locator("[data-grid-area]").count()) === 0);
    const href = await pg.getByRole("link", { name: /Lịch học của lớp trong vỏ gia sư/ }).getAttribute("href");
    check("có liên kết sang lịch học trong vỏ gia sư", href === `/lop-cua-toi/quan-lop/${c.id}/lich-hoc`, href);
    check("không tràn ngang (admin)", await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    await pg.goto(`${BASE}/lop-cua-toi/quan-lop/${c.id}/lich-hoc`, { waitUntil: "networkidle", timeout: 150000 });
    await pg.locator("[data-grid-area]").waitFor({ timeout: 30000 });
    check("Chủ nhiệm thấy lưới khung giờ (LichKhung) ở vỏ gia sư, không bị 403", await pg.locator("[data-grid-area]").isVisible());
    check("không tràn ngang (lịch học)", await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    check("không lỗi JS", errs.length === 0, errs);
    await ctx.close();
  }

  section("Nhân bản khoá");
  const ctx = await ctxFor(S, { width: 1280, height: 800 });
  const pg = await ctx.newPage();
  await pg.goto(`${BASE}/admin/khoa-hoc?q=${encodeURIComponent("Toán 9 khung")}`, { waitUntil: "networkidle" });
  // Có `?q=` thì chữ "Toán 9 khung" xuất hiện nhiều nơi (nhãn lọc, dòng) ⇒ getByText().first() bấm trượt, bảng bên không mở: mở bảng bằng nút "Sửa nhanh" của dòng.
  await pg.getByRole("button", { name: "Sửa nhanh: Toán 9 khung" }).click();
  await pg.getByRole("button", { name: "Sao chép khoá" }).click();
  await pg.getByText("Đã sao chép khoá học, chép 1 khung giờ").waitFor({ timeout: 20000 });
  check("DB: bản sao có 1 khung", (await prisma.classSchedule.count({ where: { course: { name: { contains: "Toán 9 khung" }, id: { not: c.id } } } })) === 1);
  void c0;
  await closeAll();
  await done();
})();
