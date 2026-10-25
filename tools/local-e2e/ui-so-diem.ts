import { mkUser, mkTutor, mkCourse, wipe, check, section, done } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");
  const s1 = await mkUser({ name: "Bé Gia Bảo" });
  const c1 = await mkCourse(T.id, { name: "Toán 9" });
  await prisma.enrollment.create({ data: { userId: s1.id, courseId: c1.id, status: "active" } });
  const e = await prisma.exam.create({ data: { id: `ex-ui-sd`, code: "UISD1", title: "KT", category: "toan", date: "2026-10-01", time: "08:00", duration: "45", questions: 1, status: "completed", createdAt: "2026-01-01", courseId: c1.id, ownerId: T.id } });
  await prisma.examResult.create({ data: { userId: s1.id, examId: e.id, score: 9, totalPoints: 10, completedAt: new Date() } });

  await launch();
  const errors: string[] = [];
  for (const [label, w, h] of [["máy tính", 1280, 800], ["điện thoại 390px", 390, 800]] as const) {
    section(`Sổ điểm — ${label}`);
    const ctx = await ctxFor(T, { width: w, height: h });
    const page = await ctx.newPage();
    page.on("pageerror", x => errors.push(String(x)));
    await page.goto(`${process.env.BASE}/lop-cua-toi/so-diem`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Sổ điểm và tiến bộ" }).waitFor({ timeout: 90000 });
    await page.getByText("Bé Gia Bảo").waitFor({ timeout: 60000 });
    check("thấy tên học sinh của lớp mình + điểm 9,0", await page.getByText("9,0").first().isVisible());
    check("không tràn ngang", (await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)) as boolean);
    const small = await page.evaluate(() => [...document.querySelectorAll("[data-kin-page] button, [data-kin-page] select")].filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 40 && getComputedStyle(el).display !== "inline"; }).length);
    check("nút/ô chọn chính cao ≥ 40px (không tính liên kết trong dòng)", small === 0, small);
    await shot(page, `so-diem-${w}`);
    await ctx.close();
  }
  check("không lỗi trang", errors.length === 0, errors);
  await closeAll();
  await done();
})().catch(async e => { console.error("TEST CRASH", e); await closeAll(); process.exit(1); });
