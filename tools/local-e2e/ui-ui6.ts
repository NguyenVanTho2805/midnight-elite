// UI6 — "Ghi chú buổi trước" (trang buổi học) và "Xem ảnh hưởng khi xoá" (hồ sơ học sinh), chỉ đọc; 1440 và 390 không tràn ngang.
import { BASE, mkUser, mkTutor, mkCourse, wipe, check, section, done } from "./h";
import { launch, ctxFor } from "./ui";
import { prisma } from "@/lib/prisma";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");
  const A = await mkUser({ name: "Gia Bảo" });
  const c = await mkCourse(T.id, { name: "Toán 9" });
  await prisma.enrollment.create({ data: { userId: A.id, courseId: c.id, status: "active" } });
  const s1 = await prisma.attendanceSession.create({ data: { courseId: c.id, date: new Date("2026-10-16T00:00:00Z"), createdBy: T.id, taught: "Định lý Vi-ét", summary: "Cả lớp cần ôn dấu của hệ số b." } });
  await prisma.attendanceRecord.create({ data: { sessionId: s1.id, userId: A.id, status: "present" } });
  await launch();
  for (const [w, h] of [[1440, 900], [390, 800]] as const) {
    const ctx = await ctxFor(T, { width: w, height: h });
    const page = await ctx.newPage();
    section(`Buổi học ${w}px`);
    await page.goto(`${BASE}/lop-cua-toi/buoi/${c.id}/2026-10-23`, { waitUntil: "networkidle", timeout: 120000 });
    await page.getByRole("heading", { name: "Ghi chú buổi trước" }).waitFor({ timeout: 90000 });
    check("hiện buổi 16/10, nội dung đã dạy và nhận xét chung", await page.getByText(/16\/10\/2026 · Định lý Vi-ét/).isVisible() && await page.getByText("Cả lớp cần ôn dấu của hệ số b.").isVisible());
    const bt = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check("không tràn ngang", bt <= 0, String(bt));
    await page.goto(`${BASE}/lop-cua-toi/buoi/${c.id}/2026-10-16`, { waitUntil: "networkidle", timeout: 120000 });
    await page.getByRole("heading", { name: "Ghi chú buổi trước" }).waitFor({ timeout: 90000 });
    check("buổi đầu tiên: nói rõ chưa có ghi chép trước", await page.getByText(/chưa có ghi chép chung của buổi nào trước/).isVisible());

    section(`Hồ sơ học sinh ${w}px`);
    await page.goto(`${BASE}/lop-cua-toi/hoc-sinh/em/${A.id}`, { waitUntil: "networkidle", timeout: 120000 });
    await page.getByRole("heading", { name: "Lưu trữ khác với xoá" }).waitFor({ timeout: 90000 });
    check("chưa bấm thì chưa hiện số ảnh hưởng", (await page.locator("[data-em-anh-huong]").count()) === 0);
    const btn = page.getByRole("button", { name: "Xem ảnh hưởng khi xoá" });
    const box = await btn.boundingBox();
    check("nút cao ≥ 44px", !!box && box.height >= 44, JSON.stringify(box));
    await btn.click();
    const panel = page.locator("[data-em-anh-huong]");
    await panel.waitFor({ timeout: 15000 });
    const txt = (await panel.innerText()).replace(/\s+/g, " ");
    check("số đếm thật: 1 buổi có ghi điểm danh, 0 phiếu, điểm chưa đếm vì chưa đồng ý", /1 buổi có ghi điểm danh/.test(txt) && /0 phiếu học phí/.test(txt) && /chưa có đồng ý ghi điểm/.test(txt), txt);
    check("có lời nói rõ không xoá gì", /KiN không xoá gì ở đây/.test(txt));
    const hp = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check("không tràn ngang", hp <= 0, String(hp));
    await ctx.close();
  }
  done();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
