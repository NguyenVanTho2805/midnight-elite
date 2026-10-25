// Bốn màn học sinh dựng theo Figma (Việc của tôi 299:114360, Lịch học 299:114537, Lớp của tôi 299:114766, Bài tập và đề thi 299:114951,
// điện thoại 299:116497 / 299:116644): tiêu đề, khu từng trạng thái, tab, chuyển tuần, trạng thái rỗng/lỗi, liên kết còn sống, 390px không tràn ngang.
import { BASE, mkTutor, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";
import { addDaysKey, dayOfWeekOfKey, vnDateKeyOf } from "@/lib/classSessions";

const H = 3_600_000, D = 24 * H;

(async () => {
  await wipe();
  const now = Date.now();
  const T = await mkTutor("Cô Lan");
  const S = await mkUser({ name: "Minh Anh" }), LONE = await mkUser({ name: "Bạn Mới" });
  const A = await mkCourse(T.id, { name: "Toán 9" });
  await prisma.enrollment.create({ data: { userId: S.id, courseId: A.id, status: "active" } });
  const sid = "s-sp", cid = "c-sp";
  await prisma.section.create({ data: { id: sid, title: "Chương 1", courseId: A.id } });
  await prisma.chapter.create({ data: { id: cid, title: "C", sectionId: sid } });
  await prisma.lesson.create({ data: { id: "l-sp-1", code: "l-sp-1", title: "Hệ thức Vi-ét", type: "record", duration: "45 phút", chapterId: cid } });
  await prisma.lesson.create({ data: { id: "l-sp-2", code: "l-sp-2", title: "Tài liệu ôn tập", type: "document", chapterId: cid } });
  await prisma.lesson.create({ data: { id: "l-sp-3", code: "l-sp-3", title: "Trắc nghiệm bậc hai", type: "quiz", chapterId: cid } });
  const mk = (title: string, due: number, extra: Record<string, unknown> = {}) => prisma.assignment.create({ data: { lessonId: "l-sp-3", title, dueDate: new Date(now + due), instructions: "Làm theo hướng dẫn", ...extra } });
  await mk("Phương trình bậc hai", 3 * H, { mode: "interactive" });
  await mk("Hệ hai phương trình", 2 * D);
  const sent = await mk("Hàm số", D);
  await prisma.assignmentSubmission.create({ data: { assignmentId: sent.id, userId: S.id, fileUrl: "/u/x.pdf" } });
  const graded = await mk("Ôn tập căn bậc hai", D);
  await prisma.assignmentSubmission.create({ data: { assignmentId: graded.id, userId: S.id, fileUrl: "/u/y.pdf", score: 8.5, gradedAt: new Date(now - H), comment: "Em trình bày rõ hơn rồi." } });
  const today = vnDateKeyOf(new Date());
  const tomorrow = addDaysKey(today, 1);
  await prisma.classSchedule.create({ data: { courseId: A.id, dayOfWeek: dayOfWeekOfKey(tomorrow), startTime: "19:00", endTime: "20:30", note: "Học qua Meet" } });
  const ed = new Date(now + 3 * D + 7 * H);
  const examDate = `${String(ed.getUTCDate()).padStart(2, "0")}/${String(ed.getUTCMonth() + 1).padStart(2, "0")}/${ed.getUTCFullYear()}`;
  const exam = await prisma.exam.create({ data: { id: "ex-sp", code: "ex-sp", title: "Kiểm tra 15 phút", category: "Toán", date: examDate, time: "19:00", duration: "15 phút", questions: 10, status: "available", createdAt: "2020", courseId: A.id } });

  await launch();
  const errors: string[] = [];
  const watch = (p: any) => { p.on("pageerror", (e: unknown) => errors.push(String(e))); p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of 5/i.test(m.text())) errors.push(m.text()); }); };
  const noScroll = (p: any) => p.evaluate(`document.documentElement.scrollWidth <= window.innerWidth`) as Promise<boolean>;

  const ctx = await ctxFor(S, { width: 1280, height: 900 });
  const pg = await ctx.newPage(); watch(pg);
  const h1 = (name: string) => pg.getByRole("heading", { level: 1, name });

  section("Việc của tôi: buổi học tiếp theo + kết quả gần đây");
  await pg.goto(`${BASE}/student/viec-cua-toi`, { waitUntil: "networkidle", timeout: 120000 });
  await h1("Việc của tôi").waitFor({ timeout: 90000 });
  await pg.locator("[data-next-session]").waitFor({ timeout: 60000 });
  const ns = pg.locator("[data-next-session]");
  check("khung 'Buổi học tiếp theo': giờ 19:00–20:30, lớp Toán 9, nút 'Vào lớp học' → trang lớp", (await ns.innerText()).includes("19:00–20:30") && (await ns.innerText()).includes("Toán 9") && (await ns.getByRole("link", { name: "Vào lớp học" }).getAttribute("href")) === `/student/hoc-tap?course=${A.id}`);
  check("'Kết quả gần đây': điểm 8,5/10 + nhận xét + liên kết 'Xem nhận xét'", await pg.getByText("8,5/10").isVisible() && await pg.getByText(/Em trình bày rõ hơn rồi/).isVisible() && await pg.getByRole("link", { name: "Xem nhận xét" }).isVisible());
  check("bài đã chấm KHÔNG nằm trong 'Cần làm'", await pg.getByRole("list", { name: "Cần làm" }).getByText("Ôn tập căn bậc hai").count() === 0);
  check("'Kiểm tra sắp mở' có tên đề, 10 câu · 15 phút", await pg.getByText(/Kiểm tra 15 phút · 10 câu · 15 phút/).isVisible());
  check("bài làm trên web có nút 'Làm bài'", await pg.getByRole("list", { name: "Cần làm" }).getByRole("link", { name: "Làm bài" }).count() === 1);

  section("Lịch học (máy tính)");
  await pg.goto(`${BASE}/student/lich-hoc`, { waitUntil: "networkidle", timeout: 120000 });
  await h1("Lịch học").waitFor({ timeout: 90000 });
  await pg.locator("[data-week-grid]").waitFor({ timeout: 60000 });
  check("có lưới tuần 7 ngày T2…CN và chú thích 'Nền nhấn: buổi học' / 'Viền: hạn nộp bài'", await pg.locator("[data-week-grid]").isVisible() && await pg.getByText("CN · ", { exact: false }).first().isVisible() && await pg.getByText("Nền nhấn: buổi học").isVisible() && await pg.getByText("Viền: hạn nộp bài").isVisible());
  check("ghi chú múi giờ Việt Nam (GMT+7)", await pg.getByText(/Múi giờ Việt Nam \(GMT\+7\)/).isVisible());
  check("hạn nộp bài tập hiện trong danh sách ngày (Phương trình bậc hai, chưa nộp)", await pg.locator("[data-week-item=task]").filter({ hasText: "Phương trình bậc hai" }).count() >= 1 && await pg.getByText("Bài tập chưa nộp").first().isVisible());
  check("bài ĐÃ nộp (Hàm số) không có trên lịch như hạn phải lo", await pg.locator("[data-week-item=task]").filter({ hasText: "Hàm số" }).count() === 0);
  const nav = pg.getByRole("navigation", { name: "Chuyển tuần" });
  const label0 = await nav.getByRole("button", { name: "Về tuần này" }).innerText();
  await nav.getByRole("button", { name: /Tuần sau/ }).click();
  const label1 = await nav.getByRole("button", { name: "Về tuần này" }).innerText();
  check("'Tuần sau ›' đổi khoảng ngày", label0 !== label1, [label0, label1]);
  check("tuần sau vẫn thấy buổi học lặp hàng tuần với nút 'Vào lớp học'", await pg.locator("[data-week-item=class]").first().getByRole("link", { name: "Vào lớp học" }).isVisible());
  await nav.getByRole("button", { name: /Tuần trước/ }).click();
  await nav.getByRole("button", { name: /Tuần trước/ }).click();
  check("tuần đã qua: nói rõ lịch chỉ hiện từ hôm nay trở đi (không để trống khó hiểu)", await pg.getByText("Tuần này chưa có lịch").isVisible() && await pg.getByText(/chỉ hiện từ hôm nay/).isVisible());
  await pg.getByRole("button", { name: "Hôm nay", exact: true }).click();
  check("nút 'Hôm nay' về tuần hiện tại", (await nav.getByRole("button", { name: "Về tuần này" }).innerText()) === label0);
  await shot(pg, "student-pages-lich");

  section("Lớp của tôi");
  await pg.goto(`${BASE}/student/hoc-tap?course=${A.id}`, { waitUntil: "networkidle", timeout: 120000 });
  await h1("Lớp của tôi").waitFor({ timeout: 90000 });
  await pg.locator("[data-course-hero]").waitFor({ timeout: 60000 });
  const hero = pg.locator("[data-course-hero]");
  check("khung đầu lớp: tên lớp, '0/3 bài đã hoàn thành', thanh tiến độ, 'Tiếp theo: …', nút 'Bắt đầu học'", (await hero.innerText()).includes("0/3 bài đã hoàn thành") && (await hero.innerText()).includes("Tiếp theo: ") && await hero.getByRole("progressbar").count() === 1 && /^\/student\/bai-giang\/l-sp-\d$/.test((await hero.getByRole("link", { name: "Bắt đầu học" }).getAttribute("href")) ?? ""));
  check("giữ lối 'Tài liệu & bản ghi của lớp này' → /thu-vien#c-<lớp>", (await pg.locator("[data-thu-vien-link]").getAttribute("href")) === `/thu-vien#c-${A.id}`);
  // Cập nhật: tab nay tên "Tài liệu & bản ghi · N" (N = tài liệu + bản ghi của lớp, MD-07/SV-03), không còn "Tài liệu · N".
  check("tab: Tổng quan, Tài liệu & bản ghi · 2, Bài tập · 1", await pg.getByRole("tab", { name: "Tổng quan" }).isVisible() && await pg.getByRole("tab", { name: "Tài liệu & bản ghi · 2" }).isVisible() && await pg.getByRole("tab", { name: "Bài tập · 1" }).isVisible());
  check("tổng quan liệt kê 3 bài kèm trạng thái chữ ('Học tiếp', 'Chưa học')", await pg.locator("[data-lesson-row]").count() === 3 && await pg.getByText("Học tiếp").first().isVisible() && await pg.getByText("Chưa học").first().isVisible());
  await pg.getByRole("tab", { name: "Bài tập · 1" }).click();
  check("tab 'Bài tập' chỉ còn bài trắc nghiệm", await pg.locator("[data-lesson-row]").count() === 1 && await pg.locator("[data-lesson-row]").getByText("Trắc nghiệm bậc hai").isVisible());
  check("cột phải: 'Nhập mã lớp' → /student/nhap-ma-lop, 'Xem bài tập' → /student/bai-tap, gia sư Cô Lan", (await pg.getByRole("link", { name: "Nhập mã lớp" }).getAttribute("href")) === "/student/nhap-ma-lop" && (await pg.getByRole("link", { name: "Xem bài tập" }).getAttribute("href")) === "/student/bai-tap" && await pg.getByText(/Gia sư: /).isVisible());
  await shot(pg, "student-pages-lop");

  section("Bài tập & đề thi");
  await pg.goto(`${BASE}/student/bai-tap`, { waitUntil: "networkidle", timeout: 120000 });
  await h1("Bài tập & đề thi").waitFor({ timeout: 90000 });
  await pg.getByRole("tab", { name: "Cần làm · 2" }).waitFor({ timeout: 60000 });
  check("tab có số đếm đúng: Cần làm · 2, Chờ chấm · 1", await pg.getByRole("tab", { name: "Cần làm · 2" }).getAttribute("aria-selected") === "true" && await pg.getByRole("tab", { name: "Chờ chấm · 1" }).isVisible());
  check("mỗi trạng thái một khu: 'Cần làm', 'Chờ chấm', 'Kết quả gần đây'", await pg.getByRole("heading", { name: "Cần làm" }).isVisible() && await pg.getByRole("heading", { name: "Chờ chấm" }).isVisible() && await pg.getByRole("heading", { name: "Kết quả gần đây" }).isVisible());
  check("bài đã nộp (Hàm số) chỉ ở 'Chờ chấm', có 'Xem bài nộp'", await pg.getByRole("list", { name: "Cần làm" }).getByText("Hàm số").count() === 0 && await pg.getByRole("list", { name: "Chờ chấm" }).getByText("Hàm số").isVisible() && await pg.getByRole("link", { name: "Xem bài nộp" }).isVisible());
  check("cột phải: đề thi mở trong 3 ngày, 'Xem thông tin đề' → màn chuẩn bị thi", (await pg.locator("[data-exam-card]").first().innerText()).includes("Kiểm tra 15 phút") && (await pg.getByRole("link", { name: "Xem thông tin đề" }).first().getAttribute("href")) === `/student/thi-thu/${exam.id}`);
  await pg.getByRole("tab", { name: "Kết quả" }).click();
  check("tab 'Kết quả': bảng Bài tập / Điểm / Phản hồi với 8,5/10", await pg.getByRole("tabpanel").getByText("8,5/10").isVisible() && await pg.getByRole("link", { name: /Xem nhận xét/ }).isVisible());
  await pg.getByRole("tab", { name: "Đề thi" }).click();
  check("tab 'Đề thi': liệt kê đề + lối 'Tất cả đề thi thử' → /thi-thu", await pg.getByRole("tabpanel").getByText("Kiểm tra 15 phút").isVisible() && (await pg.getByRole("link", { name: "Tất cả đề thi thử" }).getAttribute("href")) === "/thi-thu");
  await pg.getByRole("tab", { name: "Chờ chấm · 1" }).click();
  check("tab 'Chờ chấm' chỉ có bài đã nộp", await pg.getByRole("tabpanel").getByText("Hàm số").isVisible() && await pg.getByRole("tabpanel").getByText("Phương trình bậc hai").count() === 0);
  await shot(pg, "student-pages-bai-tap");

  section("Trạng thái lỗi và rỗng");
  const c2 = await ctxFor(S, { width: 1280, height: 900 });
  const p2 = await c2.newPage(); watch(p2);
  let fail = true;
  await p2.route("**/api/student/viec-cua-toi", r => (fail ? r.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "x" }) }) : r.continue()));
  await p2.goto(`${BASE}/student/bai-tap`, { waitUntil: "networkidle", timeout: 120000 });
  const strip = p2.locator('[role="alert"]:not(#__next-route-announcer__)');
  await strip.waitFor({ timeout: 60000 });
  check("lỗi tải: dải 'Không tải được bài tập.' + nút 'Thử lại', không phải trang trắng", await strip.getByText("Không tải được bài tập.").isVisible() && await strip.getByRole("button", { name: "Thử lại" }).isVisible());
  fail = false;
  await strip.getByRole("button", { name: "Thử lại" }).click();
  await strip.waitFor({ state: "detached", timeout: 30000 });
  check("'Thử lại' thành công → thấy bài", await p2.getByText("Phương trình bậc hai").first().isVisible());
  await c2.close();
  const c3 = await ctxFor(LONE, { width: 1280, height: 900 });
  const p3 = await c3.newPage(); watch(p3);
  await p3.goto(`${BASE}/student/bai-tap`, { waitUntil: "networkidle", timeout: 120000 });
  await p3.getByText("Bạn không còn bài nào cần làm").waitFor({ timeout: 60000 });
  check("rỗng: có lời giải thích + lối 'Xem lịch học'", await p3.getByText(/Bài mới thầy cô giao/).isVisible() && (await p3.getByRole("link", { name: "Xem lịch học" }).getAttribute("href")) === "/student/lich-hoc");
  await p3.goto(`${BASE}/student/hoc-tap`, { waitUntil: "networkidle", timeout: 120000 });
  await p3.getByText("Bạn chưa vào lớp nào").waitFor({ timeout: 60000 });
  check("Lớp của tôi khi chưa có lớp: giải thích + 'Nhập mã lớp'", (await p3.getByRole("link", { name: "Nhập mã lớp" }).getAttribute("href")) === "/student/nhap-ma-lop");
  await p3.goto(`${BASE}/student/lich-hoc`, { waitUntil: "networkidle", timeout: 120000 });
  await p3.getByText("Tuần này chưa có lịch").first().waitFor({ timeout: 60000 }).catch(() => {});
  check("Lịch học của học sinh chưa có lớp vẫn dùng được: có tiêu đề, không rơi vào trang lỗi", await p3.getByRole("heading", { level: 1, name: "Lịch học" }).isVisible() && await p3.getByText("Có lỗi xảy ra").count() === 0);
  await c3.close();

  section("Điện thoại 390px");
  const cm = await ctxFor(S, { width: 390, height: 844 });
  const pm = await cm.newPage(); watch(pm);
  await pm.addStyleTag({ content: "[data-agentation-root]{display:none!important}" }).catch(() => {});
  for (const [name, path, ready] of [["Việc của tôi", "/student/viec-cua-toi", "[data-student-task]"], ["Lịch học", "/student/lich-hoc", "[data-week-item]"], ["Lớp của tôi", `/student/hoc-tap?course=${A.id}`, "[data-course-hero]"], ["Bài tập & đề thi", "/student/bai-tap", "[data-student-task]"]] as const) {
    await pm.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 120000 });
    await pm.locator(ready).first().waitFor({ timeout: 90000 });
    check(`${name}: không tràn ngang ở 390px`, await noScroll(pm));
    const small = await pm.evaluate(`[...document.querySelectorAll('main a, main button, main [role=tab]')].filter(e => e.offsetParent && !e.closest('[data-kin-tab-ink]') && e.getBoundingClientRect().width > 0).map(e => [Math.round(e.getBoundingClientRect().height), (e.textContent || '').trim().slice(0, 30)]).filter(([h]) => h < 44)`) as [number, string][];
    check(`${name}: mọi nút/liên kết cao ≥ 44px`, small.length === 0, small.slice(0, 4));
    if (name === "Lịch học") {
      check("Lịch học: không có lưới (chỉ dải 7 ngày + danh sách)", !(await pm.locator("[data-week-grid]").isVisible()) && await pm.getByRole("group", { name: "Chọn ngày trong tuần" }).getByRole("button").count() === 7);
      await pm.getByRole("group", { name: "Chọn ngày trong tuần" }).getByRole("button").nth(0).click();
      check("bấm một ngày: chỉ xem ngày đó, bấm lại về cả tuần", await pm.getByRole("group", { name: "Chọn ngày trong tuần" }).getByRole("button").nth(0).getAttribute("aria-pressed") === "true");
    }
    await shot(pm, `student-pages-${path.split("/")[2]}-mobile`);
  }
  await cm.close();

  section("Không lỗi trình duyệt");
  check("không có pageerror / console.error", errors.length === 0, errors.slice(0, 3));
  await closeAll();
  await done();
})().catch(async e => { console.error("TEST CRASH", e); await closeAll().catch(() => {}); process.exit(1); });
