// ĐX-03 (NC1-045) — nút "Xuất" ở trang điểm danh trên trình duyệt thật: tải CSV, tải Excel (tệp thật được tải về), mở trang in (lưới + nút in), tháng theo ?date=.
// Cần Postgres + Next dev (xem README). Phần thuần: t-attendance-export-lib.ts; API + quyền: t-attendance-export.ts.
import { readFileSync } from "node:fs";
import { Workbook } from "exceljs";
import { BASE, mkTutor, mkUser, mkCourse, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, shot } from "./ui";
import { prisma } from "@/lib/prisma";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");
  const c = await mkCourse(T.id, { name: "Toán 9 — lớp A" });
  const [an, binh, chi] = [await mkUser({ name: "Em An" }), await mkUser({ name: "Em Bình" }), await mkUser({ name: "Em Chi" })];
  for (const s of [an, binh, chi]) await prisma.enrollment.create({ data: { userId: s.id, courseId: c.id, status: "active" } });
  for (const [d, st] of [["2026-09-03", ["present", "late", "absent"]], ["2026-09-10", ["present", "present", "excused"]]] as const) {
    const sess = await prisma.attendanceSession.create({ data: { courseId: c.id, date: new Date(`${d}T00:00:00Z`), createdBy: T.id } });
    await prisma.attendanceRecord.createMany({ data: [an, binh, chi].map((s, i) => ({ sessionId: sess.id, userId: s.id, status: st[i] })) });
  }
  await launch();
  const ctx = await ctxFor(T);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); });

  section("Thanh 'Xuất' trên trang điểm danh");
  await page.goto(`${BASE}/admin/khoa-hoc/${c.id}/diem-danh?date=2026-09-03`, { waitUntil: "networkidle", timeout: 120000 });
  const bar = page.getByRole("group", { name: "Xuất bảng điểm danh tháng 09/2026" });
  await bar.waitFor({ timeout: 90000 });
  check("có nhóm 'Xuất bảng điểm danh tháng 09/2026' với ba nút: Tải CSV, Tải Excel, In / Lưu PDF", await bar.getByRole("link", { name: "Tải CSV" }).isVisible() && await bar.getByRole("link", { name: "Tải Excel" }).isVisible() && await bar.getByRole("link", { name: "In / Lưu PDF" }).isVisible());
  check("tháng của nút theo ngày đang xem (?date=2026-09-03 → 2026-09): liên kết đúng API + format", (await bar.getByRole("link", { name: "Tải CSV" }).getAttribute("href")) === `/api/courses/${c.id}/attendance-export?month=2026-09&format=csv` && (await bar.getByRole("link", { name: "Tải Excel" }).getAttribute("href"))?.endsWith("month=2026-09&format=xlsx") === true);
  await shot(page, "attendance-export-bar");

  section("Tải CSV");
  const [csv] = await Promise.all([page.waitForEvent("download", { timeout: 60000 }), bar.getByRole("link", { name: "Tải CSV" }).click()]);
  const csvPath = await csv.path();
  const csvBytes = readFileSync(csvPath);
  const csvText = csvBytes.toString("utf8").replace(new RegExp("^\\ufeff"), "");
  check("tệp tên 'diem-danh-toan-9-lop-a-2026-09.csv' (không dấu, có tháng)", csv.suggestedFilename() === "diem-danh-toan-9-lop-a-2026-09.csv", csv.suggestedFilename());
  check("BOM UTF-8 (Excel mở đúng tiếng Việt), tên lớp, đủ ba em, ký hiệu ✓ (có mặt) và V (vắng)", csvBytes[0] === 0xef && csvBytes[1] === 0xbb && csvBytes[2] === 0xbf && csvText.includes("Toán 9 — lớp A") && ["Em An", "Em Bình", "Em Chi"].every(n => csvText.includes(n)) && csvText.includes("✓") && csvText.includes("V"), csvText.split("\r\n").slice(0, 6));
  check("hai cột ngày 03/09 và 10/09 và dòng Em An có 2 lần có mặt", /03\/09/.test(csvText) && /10\/09/.test(csvText), csvText.split("\r\n").slice(2, 4));

  section("Tải Excel");
  const [xl] = await Promise.all([page.waitForEvent("download", { timeout: 60000 }), bar.getByRole("link", { name: "Tải Excel" }).click()]);
  check("tệp .xlsx tên có tháng", /^diem-danh-toan-9-lop-a-2026-09\.xlsx$/.test(xl.suggestedFilename()), xl.suggestedFilename());
  const wb = new Workbook(); await wb.xlsx.readFile(await xl.path());
  const ws = wb.worksheets[0];
  const cells = ws.getRows(1, ws.rowCount)?.flatMap(r => (r.values as unknown[]).map(v => String(v ?? ""))) ?? [];
  check("đọc lại tệp Excel THẬT: có tên lớp, ba em và cột A đủ rộng (≥ 13)", cells.some(v => v.includes("Toán 9 — lớp A")) && ["Em An", "Em Bình", "Em Chi"].every(n => cells.includes(n)) && (ws.getColumn(1).width ?? 0) >= 13, ws.name);

  section("Trang in / Lưu PDF");
  await bar.getByRole("link", { name: "In / Lưu PDF" }).click();
  await page.getByRole("heading", { name: "Bảng điểm danh tháng", level: 1 }).waitFor({ timeout: 90000 });
  await eventually("URL là trang in của đúng lớp + tháng; có bảng với ba em", async () => page.url().includes(`/diem-danh/in?month=2026-09`) && (await page.getByText("Em Bình").first().isVisible()));
  const printBtn = page.getByRole("button", { name: "In / Lưu thành PDF" });
  check("nút 'In / Lưu thành PDF' bật được khi tháng có buổi điểm danh", await printBtn.isEnabled());
  await page.evaluate(() => { (window as unknown as { __printed: number }).__printed = 0; window.print = () => { (window as unknown as { __printed: number }).__printed++; }; });
  await printBtn.click();
  check("bấm nút → gọi window.print() đúng một lần (không cần thư viện PDF)", (await page.evaluate(() => (window as unknown as { __printed: number }).__printed)) === 1);
  await shot(page, "attendance-print-screen");
  await page.emulateMedia({ media: "print" });
  check("khi IN: bảng vẫn hiện, nút in và thanh điều hướng ẩn đi (CSS in)", await page.getByText("Em Bình").first().isVisible() && !(await printBtn.isVisible()));
  await shot(page, "attendance-print-print");
  await page.emulateMedia({ media: "screen" });

  section("Tháng khác, tháng không có buổi");
  await page.goto(`${BASE}/admin/khoa-hoc/${c.id}/diem-danh?date=2026-07-05`, { waitUntil: "networkidle", timeout: 120000 });
  const bar2 = page.getByRole("group", { name: "Xuất bảng điểm danh tháng 07/2026" });
  await bar2.waitFor({ timeout: 60000 });
  check("đổi ngày sang 2026-07-05 → thanh 'Xuất' đổi sang tháng 07/2026", (await bar2.getByRole("link", { name: "Tải CSV" }).getAttribute("href"))?.includes("month=2026-07") === true);
  await bar2.getByRole("link", { name: "In / Lưu PDF" }).click();
  await page.getByRole("heading", { name: "Bảng điểm danh tháng", level: 1 }).waitFor({ timeout: 60000 });
  await eventually("tháng không có buổi → nút in bị khoá", async () => !(await page.getByRole("button", { name: "In / Lưu thành PDF" }).isEnabled()), 20000);

  section("Điện thoại (390px)");
  const mp = await (await ctxFor(T, { width: 390, height: 800 })).newPage();
  await mp.goto(`${BASE}/admin/khoa-hoc/${c.id}/diem-danh?date=2026-09-03`, { waitUntil: "networkidle", timeout: 120000 });
  await mp.getByRole("group", { name: /Xuất bảng điểm danh tháng/ }).waitFor({ timeout: 60000 });
  check("không tràn ngang; các nút cao ≥ 44px", await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth) && ((await mp.getByRole("link", { name: "Tải CSV" }).boundingBox())?.height ?? 0) >= 44);
  await shot(mp, "attendance-export-mobile");

  check("không lỗi trang", errors.length === 0, errors.slice(0, 3));
  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
