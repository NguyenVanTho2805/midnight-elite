// ADM D1 — tab "Lịch học" của /admin/khoa-hoc/[id] dùng lưới LichKhung (1280 + 390, không tràn), drawer tạo khoá có dòng nhắc lịch,
// và toast nhân bản có số khung chép. Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/ui-admin-lich-khung.ts
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
    await pg.locator("[data-grid-area]").waitFor({ timeout: 30000 });
    check("lưới khung giờ hiện (LichKhung), admin không bị 403", await pg.locator("[data-grid-area]").isVisible());
    check("còn khối màu lớp và link chung", await pg.locator("[data-lop-lich-cai-dat]").isVisible());
    check("form khung giờ cũ đã bỏ", (await pg.locator("#lich-mode").count()) === 0 && (await pg.getByRole("button", { name: "+ Thêm khung giờ" }).count()) === 0);
    check("không tràn ngang", await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    check("không lỗi JS", errs.length === 0, errs);
    await ctx.close();
  }

  section("Drawer tạo khoá + nhân bản");
  const ctx = await ctxFor(S, { width: 1280, height: 800 });
  const pg = await ctx.newPage();
  await pg.goto(`${BASE}/admin/khoa-hoc`, { waitUntil: "networkidle", timeout: 150000 });
  await pg.getByRole("button", { name: /Tạo khoá học|Thêm khoá học|Tạo khóa học/ }).first().click();
  await pg.locator("[data-nhac-lich]").waitFor({ timeout: 15000 });
  check("drawer nhắc đặt khung giờ ở tab Lịch học", /tab Lịch học.*khung giờ hằng tuần/.test(await pg.locator("[data-nhac-lich]").innerText()));
  await pg.keyboard.press("Escape");
  await pg.getByRole("button", { name: "Huỷ" }).first().click().catch(() => {});

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
