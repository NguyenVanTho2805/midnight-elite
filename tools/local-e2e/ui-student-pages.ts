// Ba màn học sinh dựng theo Figma (Việc của tôi 299:114360, Lịch học 299:114537, Lớp của tôi 299:114766; "Bài tập và đề thi" 299:114951 đã gộp vào Việc của tôi ở B1 08/11/2026,
// điện thoại 299:116497 / 299:116644): tiêu đề, khu từng trạng thái, tab, chuyển tuần, trạng thái rỗng/lỗi, liên kết còn sống, 390px không tràn ngang.
// LOI-03 (11/11/2026) sửa kỳ vọng phần "Lớp của tôi" theo đặc tả LOI-03 mục 4.2: h1 = tên lớp; thẻ tiến độ "Bạn đã hoàn thành x/y bài" + "Bắt đầu học →";
// hai tab Tổng quan · Nội dung (mặc định Nội dung, cây CourseOutline [data-outline-lesson]); bài tập quiz ở "Bài tập của lớp" trong Tổng quan; "Nhập mã lớp" nay ở thư viện lớp
// (không còn trong trang lớp) — trang lớp có chữ "Phiếu học phí của bạn →" (không số tiền).
// SCL-G-HS (21/11/2026) sửa theo bản chốt: "Việc của tôi" thành "Cần làm" (thẻ việc, Đã nộp chờ chấm, Buổi học sắp tới, đề không lặp); trang lớp không tab / thẻ tiến độ
// (Cần làm trên cùng, Buổi gần đây, Tất cả bài học, đầu trang có tên cô + lịch); kết quả đã chấm sang mục Điểm (đủ bài, có ngày chấm). Lịch học chỉ kiểm khi cờ LICH bật.
import { BASE, mkTutor, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";
import { addDaysKey, dayOfWeekOfKey, vnDateKeyOf } from "@/lib/classSessions";
import { featureOn, isLinkHidden } from "@/lib/features";

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

  section("Cần làm (SCL-G-HS, khung 2): thẻ việc, chờ chấm, buổi học sắp tới, đề không lặp");
  await pg.goto(`${BASE}/student/viec-cua-toi`, { waitUntil: "networkidle", timeout: 120000 });
  await h1("Cần làm").waitFor({ timeout: 90000 });
  await pg.locator("[data-can-lam-the]").first().waitFor({ timeout: 60000 });
  const card = (t: string) => pg.locator("[data-can-lam-the]").filter({ hasText: t });
  check("bài làm trên web có thẻ + nút 'Làm bài'", await card("Phương trình bậc hai").getByRole("link", { name: "Làm bài" }).count() === 1);
  check("bài nộp tệp có thẻ + nút 'Nộp bài'", await card("Hệ hai phương trình").getByRole("button", { name: /^Nộp bài/ }).count() === 1);
  check("thẻ kiểm tra 'Kiểm tra 15 phút': 'Xem thông tin đề' → màn chuẩn bị thi", (await card("Kiểm tra 15 phút").getByRole("link", { name: "Xem thông tin đề" }).getAttribute("href")) === `/student/thi-thu/${exam.id}`);
  check("bài đã chấm / đã nộp KHÔNG có thẻ", await card("Ôn tập căn bậc hai").count() === 0 && await card("Hàm số").count() === 0);
  check("bài đã nộp (Hàm số) ở 'Đã nộp, chờ chấm', hàng là link tới bài", await pg.getByRole("list", { name: "Đã nộp, đang chờ chấm" }).getByRole("link", { name: /Hàm số/ }).isVisible());
  const ns = pg.locator("[data-buoi-sap-toi]").first();
  check("'Buổi học sắp tới': giờ 19:00–20:30, lớp Toán 9", (await ns.innerText()).includes("19:00–20:30") && (await ns.innerText()).includes("Toán 9"), await ns.innerText());
  check("'Đề thi được giao' không lặp đề đã có thẻ kiểm tra", await pg.locator("[data-de-thi-hang]").filter({ hasText: "Kiểm tra 15 phút" }).count() === 0);

  if (featureOn("LICH")) {
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
  }

  section("Lớp của tôi (SCL-G-HS, khung 1)");
  await pg.goto(`${BASE}/student/hoc-tap?course=${A.id}`, { waitUntil: "networkidle", timeout: 120000 });
  await h1("Toán 9").waitFor({ timeout: 90000 });
  await pg.locator("[data-lop-can-lam] [data-can-lam-the]").first().waitFor({ timeout: 60000 });
  const head = await pg.locator("[data-dau-lop]").innerText();
  check("đầu trang: tên cô + lịch học trên một dòng ('GV · <thứ>, 19:00')", /GV · (Thứ \S+|Chủ nhật), 19:00/.test(head), head);
  check("không còn tab, không thẻ tiến độ cũ", await pg.getByRole("tab").count() === 0 && await pg.locator("[data-course-hero]").count() === 0);
  check("'Buổi gần đây' liệt kê 3 bài, hàng là link tới bài", await pg.locator("[data-lop-gan-day] [data-lesson-row]").count() === 3 && /^\/student\/bai-giang\/l-sp-\d$/.test((await pg.locator("[data-lop-gan-day] [data-lesson-row] a").first().getAttribute("href")) ?? ""));
  check("liên kết 'Tất cả bài học (3)'", (await pg.locator("[data-tat-ca-bai]").innerText()).includes("Tất cả bài học (3)"));
  check("không có khối link lẻ cuối trang ('Xem điểm của lớp này')", await pg.locator("[data-lop-diem]").count() === 0);
  check("Phiếu học phí theo cờ HOC_PHI, chỉ chữ KHÔNG số tiền", isLinkHidden("/student/hoc-phi") ? await pg.locator("[data-lop-hoc-phi]").count() === 0 : (await pg.locator("[data-lop-hoc-phi]").getAttribute("href")) === "/student/hoc-phi" && !/\d\s*(đ|₫|VND)/i.test(head));
  await shot(pg, "student-pages-lop");

  // Nợ P3 số 1 của #135 (không ai bị cắt cụt lặng lẽ): kết quả đã chấm nay ở mục Điểm — đủ 7 bài, mỗi bài có ngày chấm và link tới bài.
  const G = await mkUser({ name: "Em Nhiều Điểm" });
  await prisma.enrollment.create({ data: { userId: G.id, courseId: A.id, status: "active" } });
  for (let i = 1; i <= 7; i++) {
    const a = await mk(`Bài chấm số ${i}`, D);
    await prisma.assignmentSubmission.create({ data: { assignmentId: a.id, userId: G.id, fileUrl: `/u/g${i}.pdf`, score: i, gradedAt: new Date(now - i * H) } });
  }
  const cG = await ctxFor(G, { width: 1280, height: 900 });
  const pG = await cG.newPage(); watch(pG);
  await pG.goto(`${BASE}/student/diem`, { waitUntil: "networkidle", timeout: 120000 });
  const results = pG.locator("[data-ket-qua-hang='da-cham']");
  await results.first().waitFor({ timeout: 60000 });
  check("Điểm: đủ 7 bài đã chấm", await results.count() === 7, await results.count());
  check("mỗi bài ghi 'Chấm <thứ dd/mm>' và là link tới bài", (await results.allInnerTexts()).every(t => /Chấm (thứ \S+|Chủ nhật) \d\d\/\d\d/.test(t)) && (await pG.locator("[data-ket-qua-hang='da-cham'] a").count()) === 7);
  await cG.close();

  section("Trạng thái lỗi và rỗng");
  const c2 = await ctxFor(S, { width: 1280, height: 900 });
  const p2 = await c2.newPage(); watch(p2);
  let fail = true;
  await p2.route("**/api/student/viec-cua-toi", r => (fail ? r.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "x" }) }) : r.continue()));
  await p2.goto(`${BASE}/student/viec-cua-toi`, { waitUntil: "networkidle", timeout: 120000 });
  const strip = p2.locator('[role="alert"]:not(#__next-route-announcer__)');
  await strip.waitFor({ timeout: 60000 });
  check("lỗi tải: dải 'Không tải được danh sách.' + nút 'Thử lại', không phải trang trắng", await strip.getByText("Không tải được danh sách.").isVisible() && await strip.getByRole("button", { name: "Thử lại" }).isVisible());
  fail = false;
  await strip.getByRole("button", { name: "Thử lại" }).click();
  await strip.waitFor({ state: "detached", timeout: 30000 });
  check("'Thử lại' thành công → thấy bài", await p2.getByText("Phương trình bậc hai").first().isVisible());
  await c2.close();
  const c3 = await ctxFor(LONE, { width: 1280, height: 900 });
  const p3 = await c3.newPage(); watch(p3);
  await p3.goto(`${BASE}/student/viec-cua-toi`, { waitUntil: "networkidle", timeout: 120000 });
  await p3.getByText("Chưa có việc nào cho bạn").waitFor({ timeout: 60000 });
  check("rỗng: có lời giải thích, không trắng, không khối 'Đề thi được giao' rỗng", await p3.getByText(/thầy cô giao bài/).isVisible() && await p3.getByRole("heading", { name: "Đề thi được giao" }).count() === 0);
  await p3.goto(`${BASE}/student/hoc-tap`, { waitUntil: "networkidle", timeout: 120000 });
  await p3.getByText("Bạn chưa vào lớp nào").waitFor({ timeout: 60000 });
  check("Lớp của tôi khi chưa có lớp: giải thích + 'Nhập mã lớp'", (await p3.getByRole("link", { name: "Nhập mã lớp" }).getAttribute("href")) === "/student/nhap-ma-lop");
  if (featureOn("LICH")) {
    await p3.goto(`${BASE}/student/lich-hoc`, { waitUntil: "networkidle", timeout: 120000 });
    await p3.getByText("Tuần này chưa có lịch").first().waitFor({ timeout: 60000 }).catch(() => {});
    check("Lịch học của học sinh chưa có lớp vẫn dùng được: có tiêu đề, không rơi vào trang lỗi", await p3.getByRole("heading", { level: 1, name: "Lịch học" }).isVisible() && await p3.getByText("Có lỗi xảy ra").count() === 0);
  }
  await c3.close();

  section("Điện thoại 390px");
  const cm = await ctxFor(S, { width: 390, height: 844 });
  const pm = await cm.newPage(); watch(pm);
  await pm.addStyleTag({ content: "[data-agentation-root]{display:none!important}" }).catch(() => {});
  for (const [name, path, ready] of [["Cần làm", "/student/viec-cua-toi", "[data-can-lam-the]"], ...(featureOn("LICH") ? [["Lịch học", "/student/lich-hoc", "[data-week-item]"] as const] : []), ["Lớp của tôi", `/student/hoc-tap?course=${A.id}`, "[data-lop-can-lam]"], ["Điểm", "/student/diem", "[data-diem-lop]"]] as const) {
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
