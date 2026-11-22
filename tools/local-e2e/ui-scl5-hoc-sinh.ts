// SCL đợt 5 — màn học sinh theo phương án C + ghép B (docs/kin/thiet-ke/scl5/QUYET-DINH-HOI-DONG.md, docs/kin/rd/HOC-THU-VA-DANG-KY.md D15–D18) trên trình duyệt thật:
// (1) Hôm nay: ngày đầy đủ, "Hôm nay còn N việc cần làm" = số thẻ = badge, Lớp của bạn (tiến độ thật), Nhật ký đêm học (điểm danh thật, nghỉ có báo giữ nhịp);
//     trạng thái rỗng có buổi kế tiếp + Học tiếp; (2) danh sách lớp: dải màu lớp + tiến độ + buổi tới; (3) trang lớp: Các chương › bài, trạng thái, điểm ở lề,
//     "N bài đã học · xem lại", Buổi tới, Nhóm Zalo; (4) trang bài: lối về lớp › chương, Tài liệu kèm, bài trước/sau; (5) học thử còn 3 ngày (băng ở Hôm nay + lớp,
//     mốc hết hạn tuyệt đối) và hết hạn (D16: hiện đã học / đã nộp / điểm từng bài, KHÔNG có bài, KHÔNG mở được trang bài).
// Mọi màn ở 390/1280 (+ 320): không tràn ngang, nút/link ≥ 44px, ngày ghi "Thứ Ba" (không "T3"/"Thứ 3"), không chữ "Vinh danh" trong vỏ (D17).
// Ảnh: docs/kin/thiet-ke/scl5/da-lam/<màn>-<rộng>.png. Next 16 giữ trang ẩn trong DOM ⇒ locator :visible.
// Chạy: source tools/local-e2e/env.sh && TZ=Asia/Ho_Chi_Minh npx tsx tools/local-e2e/ui-scl5-hoc-sinh.ts
import { mkdirSync } from "node:fs";
import { prisma } from "@/lib/prisma";
import { addDaysKey, dayOfWeekOfKey, vnDateKeyOf } from "@/lib/classSessions";
import { BASE, api, mkTutor, mkUser, mkCourse, wipe, check, section, done, eventually } from "./h";
import { launch, ctxFor, closeAll, type Page } from "./ui";

const OUT = "docs/kin/thiet-ke/scl5/da-lam";
mkdirSync(OUT, { recursive: true });
const H = 3_600_000, D = 24 * H;
const errors: string[] = [];

async function layoutOk(p: Page, tag: string) {
  const w = p.viewportSize()?.width ?? 0;
  check(`${tag} ${w}px: không tràn ngang`, await p.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), await p.evaluate("[document.documentElement.scrollWidth, innerWidth]"));
  const small = await p.evaluate(`[...document.querySelectorAll("main a, main button")].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.closest("[data-nop-dock]") && !e.closest("[data-kin-skip]") && !e.classList.contains("sr-only"); })
    .map(e => [(e.innerText || e.getAttribute("aria-label") || "").trim().slice(0, 30), Math.round(e.getBoundingClientRect().height)]).filter(x => x[1] < 44)`);
  check(`${tag} ${w}px: nút / liên kết ≥ 44px`, (small as unknown[]).length === 0, small);
  const txt = await p.locator("body").innerText();
  check(`${tag} ${w}px: ngày ghi đầy đủ ("Thứ Ba"), không "T3" / "Thứ 3"`, !/\bT[2-7]\b|Thứ [2-7]\b/.test(txt), txt.match(/\bT[2-7]\b|Thứ [2-7]\b/g));
  check(`${tag} ${w}px: không có chữ "Vinh danh" trong vỏ (D17)`, !/vinh danh/i.test(txt));
}
async function shoot(p: Page, name: string) {
  await p.addStyleTag({ content: "[data-agentation-root]{display:none!important}" }).catch(() => {});
  await p.screenshot({ path: `${OUT}/${name}-${p.viewportSize()?.width}.png`, fullPage: true });
}

(async () => {
  await wipe();
  const now = Date.now();
  const todayKey = vnDateKeyOf(new Date());
  const T = await mkTutor("Anh Thanh");
  const S = await mkUser({ name: "Minh Anh (thử)" });
  const E = await mkUser({ name: "Bảo (thử, không việc)" });
  const TR = await mkUser({ name: "Gia Hân (học thử)" });
  const X = await mkUser({ name: "Quang (hết hạn)" });
  const A = await mkCourse(T.id, { name: "Toán 12" });
  const B = await mkCourse(T.id, { name: "Lịch sử 12" });
  await prisma.course.update({ where: { id: A.id }, data: { instructor: "Anh Thanh", calendarColor: null, zaloGroupUrl: "https://zalo.me/g/lop-toan-thu" } });
  await prisma.enrollment.createMany({ data: [
    { userId: S.id, courseId: A.id, status: "active" }, { userId: S.id, courseId: B.id, status: "active" },
    { userId: E.id, courseId: B.id, status: "active" },
    { userId: TR.id, courseId: A.id, status: "active", trialDays: 14, trialStartedAt: new Date(now - 11 * D - H) },
    { userId: X.id, courseId: A.id, status: "active", trialDays: 14, trialStartedAt: new Date(now - 15 * D) },
  ] });
  await prisma.section.create({ data: { id: "s5-a", title: "Phần 1", courseId: A.id } });
  await prisma.chapter.create({ data: { id: "c5-1", title: "Chương 1 · Ứng dụng đạo hàm", sectionId: "s5-a", order: 1 } });
  await prisma.chapter.create({ data: { id: "c5-2", title: "Chương 2 · Hàm số mũ và logarit", sectionId: "s5-a", order: 2 } });
  const L = (id: string, chapterId: string, title: string, daysAgo: number, order: number, extra: Record<string, unknown> = {}) =>
    prisma.lesson.create({ data: { id, code: id, title, type: "record", chapterId, order, scheduledAt: new Date(now - daysAgo * D), videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", duration: "45 phút", ...extra } });
  await L("l5-1", "c5-1", "Tính đơn điệu của hàm số", 12, 1, { documents: JSON.stringify([{ name: "Phiếu lý thuyết.pdf", url: "https://example.com/a.pdf" }]) });
  await L("l5-2", "c5-1", "Cực trị hàm số – hàm hợp", 8, 2, { documents: JSON.stringify([{ name: "Phiếu cực trị.pdf", url: "https://example.com/b.pdf" }]) });
  await L("l5-3", "c5-1", "Giá trị lớn nhất – nhỏ nhất", 4, 3);
  await L("l5-4", "c5-2", "Luỹ thừa và mũ", 2, 1);
  await L("l5-5", "c5-2", "Bài nháp không được thấy", 1, 2, { status: "draft" });
  await prisma.assignment.create({ data: { id: "bt5-1", lessonId: "l5-1", title: "Bài tập buổi 1", dueDate: new Date(now - 6 * D), maxPoints: 10 } });
  await prisma.assignment.create({ data: { id: "bt5-3", lessonId: "l5-3", title: "Bài tập buổi 3", dueDate: new Date(now + 2 * D + 3 * H), maxPoints: 10 } });
  await prisma.assignmentSubmission.create({ data: { assignmentId: "bt5-1", userId: S.id, fileUrl: "/u/s.pdf", score: 8.5, gradedAt: new Date(now - 2 * D) } });
  await prisma.assignmentSubmission.create({ data: { assignmentId: "bt5-1", userId: X.id, fileUrl: "/u/x.pdf", score: 9, gradedAt: new Date(now - 5 * D) } });
  await prisma.lessonProgress.create({ data: { userId: S.id, lessonId: "l5-1", completed: true, watchedSeconds: 2700 } });
  await prisma.lessonProgress.create({ data: { userId: S.id, lessonId: "l5-2", completed: false, watchedSeconds: 600 } });
  await prisma.lessonProgress.create({ data: { userId: X.id, lessonId: "l5-1", completed: true, watchedSeconds: 2700 } });
  // Lịch: buổi ngày mai 22:15 (Buổi tới) cho cả hai lớp.
  const tomorrowDow = dayOfWeekOfKey(addDaysKey(todayKey, 1));
  await prisma.classSchedule.createMany({ data: [
    { courseId: A.id, dayOfWeek: tomorrowDow, startTime: "22:15", endTime: "23:45", joinUrl: "https://meet.google.com/abc-defg-hij", mode: "online" },
    { courseId: B.id, dayOfWeek: tomorrowDow, startTime: "21:00", endTime: "22:00" },
  ] });
  // Nhật ký: 4 buổi điểm danh thật của S (vắng → có mặt → nghỉ có báo → có mặt) ⇒ giữ nhịp 3 buổi liền.
  for (const [i, st] of (["absent", "present", "excused", "present"] as const).entries()) {
    const ss = await prisma.attendanceSession.create({ data: { courseId: A.id, date: new Date(`${addDaysKey(todayKey, -14 + i * 3)}T00:00:00Z`), createdBy: T.id } });
    await prisma.attendanceRecord.create({ data: { sessionId: ss.id, userId: S.id, status: st } });
  }

  await launch();
  const open = async (u: typeof S, path: string, width: number) => {
    const ctx = await ctxFor(u, { width, height: 900 });
    const p = await ctx.newPage();
    p.on("pageerror", e => errors.push(String(e)));
    await p.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 170000 });
    return p;
  };

  for (const w of [390, 1280]) {
    section(`(1) Hôm nay ${w}px`);
    let p = await open(S, "/student/viec-cua-toi", w);
    await p.locator("[data-can-lam-the]:visible").first().waitFor({ timeout: 120000 });
    const h1 = (await p.locator("main h1:visible").first().innerText()).trim();
    const nCards = await p.locator("[data-can-lam-nhom] [data-can-lam-the]:visible").count();
    check("tiêu đề 'Hôm nay còn N việc cần làm', N = số thẻ việc", h1 === `Hôm nay còn ${nCards} việc cần làm` && nCards === 1, { h1, nCards });
    check("dòng ngày đầy đủ ('Thứ …, dd/mm' hoặc 'Chủ Nhật, dd/mm')", /^(Thứ (Hai|Ba|Tư|Năm|Sáu|Bảy)|Chủ Nhật), \d\d\/\d\d$/.test((await p.locator("[data-hn-ngay]:visible").innerText()).trim()));
    if (w === 390) {
      const badge = Number((await p.locator(".kin-badge-dem:visible").first().innerText().catch(() => "0")).trim());
      check("P1-2: badge 'Cần làm' = số ở tiêu đề", badge === nCards, { badge, nCards });
      const top = await p.locator("[data-can-lam-the]:visible button:has-text('Nộp bài')").first().boundingBox().catch(() => null);
      check("P1-6: nút Nộp bài đầu tiên nằm trong 700px đầu (điện thoại)", !!top && top.y + top.height <= 700, top);
    }
    await p.locator("[data-hn-lop]:visible").waitFor({ timeout: 60000 });
    const lopA = await p.locator(`[data-hn-lop-the='${A.id}']:visible`).innerText();
    check("Lớp của bạn: thẻ Toán 12 có tiến độ thật '1/4 bài' (bài nháp không đếm)", /1\/4 bài/.test(lopA), lopA);
    await p.locator("[data-nhat-ky]:visible").waitFor({ timeout: 60000 });
    const nk = await p.locator("[data-nhat-ky]:visible").innerText();
    check("Nhật ký đêm học: 4 ô, đếm Có mặt 2 · Nghỉ có báo 1 · Vắng 1, giữ nhịp 3 buổi (nghỉ có báo vẫn giữ)",
      await p.locator("[data-nhat-ky-o]:visible").count() === 4 && /Có mặt\s*2/.test(nk) && /Nghỉ có báo\s*1/.test(nk) && /Vắng\s*1/.test(nk) && /Giữ nhịp 3 buổi liền/.test(nk), nk);
    check("không bảng xếp hạng / so sánh", !/hạng \d|xếp hạng của bạn/i.test(nk));
    await layoutOk(p, "Hôm nay");
    await shoot(p, "1-hom-nay");
    await p.context().close();

    section(`(1b) Hôm nay — trạng thái rỗng ${w}px`);
    p = await open(E, "/student/viec-cua-toi", w);
    await p.locator("[data-hn-rong]:visible").waitFor({ timeout: 120000 });
    check("tiêu đề 'Hôm nay không còn việc cần làm'", (await p.locator("main h1:visible").first().innerText()).trim() === "Hôm nay không còn việc cần làm");
    await eventually("rỗng: câu ghi nhận + buổi kế tiếp 'Thứ … dd/mm 21:00'", async () => /Bạn đã xong mọi việc hôm nay/.test(await p.locator("[data-hn-rong]").innerText()) && /^(Thứ (Hai|Ba|Tư|Năm|Sáu|Bảy)|Chủ nhật) \d\d\/\d\d 21:00$/.test((await p.locator("[data-hn-buoi-ke]:visible").innerText()).trim()), 30000);
    check("rỗng: không nhật ký (không có điểm danh thật ⇒ ẩn)", await p.locator("[data-nhat-ky]").count() === 0);
    await layoutOk(p, "Hôm nay rỗng");
    await shoot(p, "1b-hom-nay-rong");
    await p.context().close();

    section(`(2) Danh sách lớp ${w}px`);
    p = await open(S, "/student/hoc-tap", w);
    await p.locator(`[data-class-card='${A.id}']:visible`).waitFor({ timeout: 120000 });
    const card = p.locator(`[data-class-card='${A.id}']:visible`);
    check("thẻ lớp có dải màu lớp 4px", Math.round((await card.locator("[data-lop-mau]").boundingBox())?.height ?? 0) === 4);
    check("tiến độ thật 'Đã hoàn thành 1/4 bài'", /Đã hoàn thành 1\/4 bài/.test(await card.innerText()));
    await eventually("buổi tới 'Buổi tới: Thứ … dd/mm · 22:15'", async () => /Buổi tới: (Thứ (Hai|Ba|Tư|Năm|Sáu|Bảy)|Chủ nhật) \d\d\/\d\d · 22:15/.test(await card.innerText()), 30000);
    await layoutOk(p, "Danh sách lớp");
    await shoot(p, "2-danh-sach-lop");
    await p.context().close();

    section(`(3) Trang lớp ${w}px`);
    p = await open(S, `/student/hoc-tap?course=${A.id}`, w);
    await p.locator("[data-chuong-muc]:visible").first().waitFor({ timeout: 120000 });
    const muc = await p.locator("[data-chuong-muc]:visible").evaluateAll(els => els.map(e => [e.getAttribute("data-chuong-muc"), e.querySelector("button[aria-expanded]")?.getAttribute("aria-expanded")]));
    check("chương theo giáo trình, chương đang học (chương 1) mở sẵn", JSON.stringify(muc) === JSON.stringify([["c5-1", "true"], ["c5-2", "false"]]), muc);
    check("bài đang xem dở 'Đang học' + bài chưa học 'Chưa học'", /Đang học/.test(await p.locator("[data-lesson-row='l5-2']:visible").innerText()) && /Chưa học/.test(await p.locator("[data-lesson-row='l5-3']:visible").innerText()));
    check("bài đã học gom thành '1 bài đã học · xem lại', kèm '1 bài đã có điểm'", /1 bài đã học · xem lại/.test(await p.locator("[data-xem-lai='c5-1']:visible").innerText()) && /1 bài đã có điểm/.test(await p.locator("[data-xem-lai='c5-1']:visible").innerText()) && await p.locator("[data-lesson-row='l5-1']:visible").count() === 0);
    await p.locator("[data-xem-lai='c5-1'] button").click();
    await eventually("mở 'xem lại' một chạm: điểm 'Đã chấm 8,5/10' ở lề phải", async () => /Đã chấm 8,5\/10/.test(await p.locator("[data-lesson-row='l5-1']:visible [data-kin-list-aside]").innerText()), 10000);
    check("bài nháp không hiện", await p.getByText("Bài nháp không được thấy").count() === 0);
    check("Học tiếp: bài đang xem dở, nút phụ (nút chính là Nộp bài)", (await p.locator("[data-hoc-tiep-lop]:visible").getAttribute("data-hoc-tiep-lop")) === "l5-2");
    check("Buổi tới: 'Thứ … dd/mm · 22:15–23:45', chưa tới ngày ⇒ chưa hiện nút vào phòng", /(Thứ (Hai|Ba|Tư|Năm|Sáu|Bảy)|Chủ nhật) \d\d\/\d\d · 22:15–23:45/.test(await p.locator("[data-buoi-toi]:visible").innerText()) && await p.locator("[data-vao-phong]").count() === 0);
    check("Nhóm Zalo của lớp là nút thật", (await p.locator("[data-nhom-zalo] a:visible").getAttribute("href")) === "https://zalo.me/g/lop-toan-thu");
    check("tìm bài trong 1 chạm: 'Tìm bài · Tất cả bài học (4)'", /Tất cả bài học \(4\)/.test(await p.locator("[data-tat-ca-bai]:visible").innerText()));
    await layoutOk(p, "Trang lớp");
    await shoot(p, "3-trang-lop");
    await p.context().close();

    section(`(4) Trang bài ${w}px`);
    p = await open(S, "/student/bai-giang/l5-2", w);
    await p.locator("[data-bai-vi-tri]:visible").waitFor({ timeout: 120000 });
    check("lối về: 'Toán 12 › Chương 1 · Ứng dụng đạo hàm'", /Toán 12\s*›\s*Chương 1 · Ứng dụng đạo hàm/.test(await p.locator("[data-bai-vi-tri]:visible").innerText()));
    check("khu 'Tài liệu kèm' cố định có tệp của bài", /Tài liệu kèm/.test(await p.locator("[data-lesson-section='tai-lieu']:visible").innerText()) && /Phiếu cực trị/.test(await p.locator("[data-lesson-section='tai-lieu']:visible").innerText()));
    check("có khối Bài tập và bài trước / bài sau", await p.locator("[data-lesson-section='bai-tap']:visible").count() === 1 && await p.locator("[data-bai-truoc]:visible").count() === 1 && await p.locator("[data-bai-sau]:visible").count() === 1);
    check("video YouTube nhúng qua youtube-nocookie (nếu đã nhúng)", (await p.locator("iframe[src*='youtube']").evaluateAll(els => els.map(e => e.getAttribute("src") ?? ""))).every(s => s.includes("youtube-nocookie.com")));
    await layoutOk(p, "Trang bài");
    await shoot(p, "4-trang-bai");
    await p.context().close();

    section(`(5a) Học thử còn 3 ngày ${w}px`);
    p = await open(TR, "/student/viec-cua-toi", w);
    await p.locator("[data-trial-bang]:visible").waitFor({ timeout: 120000 });
    const bang = await p.locator("[data-trial-bang]:visible").innerText();
    check("Hôm nay: băng 'Học thử · còn 3 ngày', môn đang thử, mốc hết hạn tuyệt đối (giờ + Thứ đầy đủ)", (await p.locator("[data-trial-bang]:visible").getAttribute("data-trial-bang")) === "sap-het" && /còn 3 ngày/.test(bang) && /Toán 12/.test(bang)
      && /\d\d:\d\d (Thứ (Hai|Ba|Tư|Năm|Sáu|Bảy)|Chủ nhật) \d\d\/\d\d/.test(await p.locator("[data-trial-het]:visible").innerText()), bang);
    check("băng giọng trung tính (panel nhấn, không nền cảnh báo), có Đăng ký chính thức + Zalo", (await p.locator("[data-trial-bang]:visible").getAttribute("data-kin-panel")) === "nhan" && /Đăng ký chính thức/.test(bang) && /Zalo/.test(bang));
    await layoutOk(p, "Học thử (Hôm nay)");
    await shoot(p, "5a-hoc-thu-con-3-ngay-hom-nay");
    await p.goto(`${BASE}/student/hoc-tap?course=${A.id}`, { waitUntil: "networkidle", timeout: 120000 });
    await p.locator("[data-trial-bang]:visible").waitFor({ timeout: 60000 });
    check("trang lớp: cùng băng còn 3 ngày, nội dung mở như học sinh chính thức", /còn 3 ngày/.test(await p.locator("[data-trial-bang]:visible").innerText()) && await p.locator("[data-chuong-muc]:visible").count() === 2);
    await layoutOk(p, "Học thử (lớp)");
    await shoot(p, "5a-hoc-thu-con-3-ngay-lop");
    await p.context().close();

    section(`(5b) Học thử hết hạn ${w}px`);
    p = await open(X, `/student/hoc-tap?course=${A.id}`, w);
    await p.locator("[data-trial-khoa]:visible").waitFor({ timeout: 120000 });
    const khoa = p.locator("[data-trial-khoa]:visible");
    await eventually("D16: hiện đã học 1, đã nộp 1, điểm từng bài '9/10' (chỉ chữ)", async () => (await khoa.locator("[data-kq-da-hoc]").innerText()).trim() === "1" && (await khoa.locator("[data-kq-da-nop]").innerText()).trim() === "1" && /Bài tập buổi 1\s*9\/10/.test(await khoa.locator("[data-kq-bai]").innerText()), 30000);
    check("điểm không mở được nội dung: không có link tới bài trong khối kết quả", await khoa.locator("[data-kq-bai] a").count() === 0);
    check("KHÔNG lộ bài học trong lớp khoá; nút chính Đăng ký chính thức + Zalo anh Thanh", await p.locator("[data-lesson-row]").count() === 0 && await p.locator("[data-chuong-muc]").count() === 0 && (await p.locator("[data-dang-ky-chinh-thuc]:visible").count()) === 1 && (await khoa.locator("a[href='https://zalo.me/0384409051']").count()) === 1);
    await layoutOk(p, "Hết hạn (lớp)");
    await shoot(p, "5b-het-han-lop");
    await p.goto(`${BASE}/student/bai-giang/l5-1`, { waitUntil: "networkidle", timeout: 120000 });
    await p.locator("[data-bai-khoa-thu]:visible").waitFor({ timeout: 60000 });
    check("trang bài khi hết hạn: thẻ khoá (không lỗi 403 chung), không video, không tài liệu", await p.getByText("Bài học này dành cho học sinh của lớp").count() === 0 && await p.locator("iframe, video, [data-lesson-section]").count() === 0);
    await layoutOk(p, "Hết hạn (bài)");
    await shoot(p, "5b-het-han-bai");
    await p.context().close();
  }

  section("320px: không tràn ở mọi màn");
  for (const [u, path] of [[S, "/student/viec-cua-toi"], [E, "/student/viec-cua-toi"], [S, "/student/hoc-tap"], [S, `/student/hoc-tap?course=${A.id}`], [S, "/student/bai-giang/l5-2"], [TR, "/student/viec-cua-toi"], [X, `/student/hoc-tap?course=${A.id}`]] as const) {
    const p = await open(u, path, 320);
    await p.locator("main h1:visible, [data-trial-khoa]:visible, [data-bai-vi-tri]:visible").first().waitFor({ timeout: 120000 });
    await p.waitForTimeout(1500);
    check(`320px ${path}: không tràn ngang`, await p.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), await p.evaluate("[document.documentElement.scrollWidth, innerWidth]"));
    await p.context().close();
  }

  section("Máy chủ vẫn chặn học thử hết hạn");
  check("ghi danh hết hạn đã lật trial_expired", (await prisma.enrollment.findFirst({ where: { userId: X.id } }))?.status === "trial_expired");
  const ctxR = await api("GET", "/api/lessons/l5-1/context", { as: X });
  check("bài khi hết hạn: VẪN 403, chỉ kèm mã trial_expired (không nội dung)", ctxR.status === 403 && ctxR.json?.code === "trial_expired" && !ctxR.json?.lesson, { s: ctxR.status, j: ctxR.json });
  const cR = await api("GET", `/api/courses/${A.id}`, { as: X });
  check("lớp khi hết hạn: không cây bài, không link", cR.json?.trialExpired === true && (cR.json?.sections ?? []).length === 0 && !cR.json?.zaloGroupUrl);
  const kqR = await api("GET", `/api/student/ket-qua?courseId=${A.id}`, { as: X });
  check("kết quả khi hết hạn: có điểm, link tới bài bỏ trống", (kqR.json?.classes?.[0]?.items ?? []).every((i: { href: string | null }) => i.href === null) && (kqR.json?.classes?.[0]?.items ?? []).length >= 1);
  check("không có pageerror", errors.length === 0, errors.slice(0, 3));
  await closeAll();
  await done();
})();
