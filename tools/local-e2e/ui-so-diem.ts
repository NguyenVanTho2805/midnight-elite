// SCL-C — trình duyệt: (1) gia sư giao bài trong ≤ 4 lần bấm từ trang Bài tập, rồi nhập điểm một bài nộp ngay trong sổ điểm (ô điểm 16px ở 390px);
// (2) duyệt điểm tự khai; (3) học sinh mở tab "Kết quả" của lớp ở 390px: thấy "Chờ gia sư duyệt", không tràn ngang.
// Chạy (máy chủ dev đang chạy): source tools/local-e2e/env.sh && TZ=Asia/Ho_Chi_Minh npx tsx tools/local-e2e/ui-so-diem.ts
import { mkUser, mkTutor, mkCourse, wipe, check, section, done, BASE } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");
  const s1 = await mkUser({ name: "Em Gia Bảo" });
  const c1 = await mkCourse(T.id, { name: "Toán 9" });
  await prisma.enrollment.create({ data: { userId: s1.id, courseId: c1.id, status: "active" } });
  await prisma.exam.create({ data: { id: "az-ui", code: "AZUI", title: "Đề Azota tuần 1", category: "toan", date: "01/01/2030", time: "08:00", duration: "45 phút", questions: 0, status: "available", createdAt: "2026-11-21", azotaUrl: "https://azota.vn/x", totalPoints: 10, courseId: c1.id, ownerId: T.id } });
  await prisma.examResult.create({ data: { userId: s1.id, examId: "az-ui", score: 7, totalPoints: 10, pendingReview: true } });

  await launch();
  const errors: string[] = [];

  section("Gia sư — giao bài ≤ 4 bấm (máy tính)");
  const ctx = await ctxFor(T, { width: 1280, height: 900 });
  const page = await ctx.newPage();
  page.on("pageerror", x => errors.push(String(x)));
  await page.goto(`${BASE}/lop-cua-toi/bai-tap`, { waitUntil: "networkidle", timeout: 120000 });
  let clicks = 0;
  await page.getByRole("link", { name: "+ Giao bài" }).click(); clicks++;
  const title = page.getByLabel("Tiêu đề");
  await title.waitFor({ timeout: 90000 });
  await title.click(); clicks++;
  await title.fill("Bài về nhà tuần 3");
  await page.getByRole("button", { name: "Giao bài", exact: true }).click(); clicks++;
  await page.waitForURL(/\/lop-cua-toi\/so-diem\?lop=.*ghi=da-giao/, { timeout: 90000 });
  const okGiao = await page.locator("[data-so-diem-ghi='da-giao']").waitFor({ timeout: 60000 }).then(() => true, () => false);
  check(`giao bài xong sau ${clicks} lần bấm (≤ 4), về sổ điểm kèm lời xác nhận`, clicks <= 4 && okGiao);
  check("cột bài mới có trong sổ điểm", await page.getByRole("columnheader", { name: /Bài về nhà tuần 3/ }).waitFor({ timeout: 30000 }).then(() => true, () => false));
  await ctx.close();

  // Học sinh nộp bài (dữ liệu) để gia sư nhập điểm.
  const a = await prisma.assignment.findFirstOrThrow({ where: { title: "Bài về nhà tuần 3" } });
  await prisma.assignmentSubmission.create({ data: { assignmentId: a.id, userId: s1.id, fileUrl: "/api/media/nop-bai/x" } });

  section("Gia sư — nhập điểm + duyệt điểm tự khai (điện thoại 390px)");
  const mctx = await ctxFor(T, { width: 390, height: 844 });
  const m = await mctx.newPage();
  m.on("pageerror", x => errors.push(String(x)));
  await m.goto(`${BASE}/lop-cua-toi/so-diem?lop=${c1.id}`, { waitUntil: "networkidle", timeout: 120000 });
  const score = m.locator("[data-cham] input[name=score]");
  await score.waitFor({ timeout: 90000 });
  const fs = await score.evaluate(el => parseFloat(getComputedStyle(el).fontSize));
  check("ô nhập điểm cỡ chữ ≥ 16px trên điện thoại", fs >= 16, fs);
  const small = await m.evaluate(() => [...document.querySelectorAll("[data-so-diem] button, [data-so-diem] input:not([type=hidden])")].filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height < 44; }).length);
  check("nút / ô trong sổ điểm cao ≥ 44px", small === 0, small);
  check("trang không tràn ngang (bảng cuộn trong khung)", await m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await score.fill("8,5");
  await m.locator("[data-cham] button[type=submit]").click();
  await m.waitForURL(/ghi=da-cham/, { timeout: 60000 });
  // Máy dev biên dịch lần đầu: React stream có lúc giữ bản trang ẩn trong DOM ⇒ chỉ đếm phần tử ĐANG HIỆN (:visible) và chờ, không đọc ngay một lần.
  const okCham = await m.locator("[data-so-diem-ghi='da-cham']:visible").waitFor({ timeout: 60000 }).then(() => true, () => false);
  const o85 = await m.getByText("8,5/10").locator("visible=true").first().waitFor({ timeout: 30000 }).then(() => true, () => false);
  check("nhập điểm → 'Đã lưu điểm', ô thành 8,5/10", okCham && o85);
  const azRow = () => prisma.examResult.findFirst({ where: { userId: s1.id, examId: "az-ui" } });
  await m.locator("[data-tu-choi]:visible").click();
  const dlg = m.getByRole("dialog");
  const dlgOpen = await dlg.waitFor({ timeout: 30000 }).then(() => true, () => false);
  await dlg.getByRole("button", { name: "Huỷ" }).click();
  check("Từ chối mở hộp xác nhận; Huỷ ⇒ điểm còn nguyên, vẫn chờ duyệt", dlgOpen && (await azRow())?.pendingReview === true);
  await m.locator("[data-duyet-sua] input[name=score]:visible").fill("9");
  await m.locator("[data-duyet-sua] input[name=score]:visible").press("Enter");
  await m.waitForURL(/ghi=da-sua/, { timeout: 60000 });
  const sua = await azRow();
  check("gõ điểm sửa rồi Enter ⇒ gửi Sửa điểm (9), không phải Duyệt điểm cũ", sua?.score === 9 && sua.pendingReview === false, sua);
  await prisma.examResult.updateMany({ where: { userId: s1.id, examId: "az-ui" }, data: { score: 7, pendingReview: true } });
  await m.goto(`${BASE}/lop-cua-toi/so-diem?lop=${c1.id}`, { waitUntil: "networkidle", timeout: 120000 });
  await m.locator("[data-duyet] button[value=duyet]:visible").click();
  await m.waitForURL(/ghi=da-duyet/, { timeout: 60000 });
  check("Duyệt điểm tự khai → ô Đã chấm, hết nút Duyệt", (await m.locator("[data-duyet]").count()) === 0 && (await prisma.examResult.findFirst({ where: { userId: s1.id, examId: "az-ui" } }))?.pendingReview === false);
  await shot(m, "so-diem-390");
  await prisma.examResult.updateMany({ where: { userId: s1.id, examId: "az-ui" }, data: { pendingReview: true } });
  await m.goto(`${BASE}/lop-cua-toi/so-diem?lop=${c1.id}`, { waitUntil: "networkidle", timeout: 120000 });
  await m.locator("[data-tu-choi]:visible").click();
  await m.getByRole("dialog").getByRole("button", { name: "Từ chối" }).click();
  await m.waitForURL(/ghi=da-tu-choi/, { timeout: 60000 });
  check("Từ chối → xác nhận ⇒ xoá dòng điểm tự khai", (await azRow()) === null);
  await mctx.close();
  await prisma.examResult.create({ data: { userId: s1.id, examId: "az-ui", score: 7, totalPoints: 10, pendingReview: true } });

  section("Học sinh — tab Kết quả (390px)");
  const sctx = await ctxFor(s1, { width: 390, height: 844 });
  const sp = await sctx.newPage();
  sp.on("pageerror", x => errors.push(String(x)));
  await sp.goto(`${BASE}/student/hoc-tap?course=${c1.id}`, { waitUntil: "networkidle", timeout: 120000 });
  await sp.getByRole("tab", { name: "Kết quả" }).click({ timeout: 90000 });
  await sp.locator("[data-ket-qua]").waitFor({ timeout: 60000 });
  check("thấy bài tập 8,5/10 'Đã chấm' và đề Azota 'Chờ gia sư duyệt'", (await sp.getByText("8,5/10").isVisible()) && (await sp.getByText("Chờ gia sư duyệt").isVisible()));
  check("không tràn ngang ở 390px", await sp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await shot(sp, "ket-qua-hs-390");
  await sp.goto(`${BASE}/student/diem`, { waitUntil: "networkidle", timeout: 120000 });
  await sp.locator("[data-ket-qua]").waitFor({ timeout: 60000 });
  check("/student/diem mở được, có lớp Toán 9", await sp.getByText("Toán 9").first().isVisible());
  await sctx.close();

  check("không lỗi trang", errors.length === 0, errors);
  await closeAll();
  await done();
})().catch(async e => { console.error("TEST CRASH", e); await closeAll(); process.exit(1); });
