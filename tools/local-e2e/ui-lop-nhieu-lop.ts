// NC2-040 / 041 / 042 / 048 — góp ý người dùng thử 28/10/2026, trình duyệt thật:
//  041  Học sinh học NHIỀU lớp (Sử + Địa…) chỉ thấy lớp đầu tiên: nay có danh mục lớp, đổi lớp được, đếm bài theo ID lớp (không theo tên lớp);
//  042  Bản ghi buổi học gom theo THÁNG, thu gọn / mở được;
//  040  Thi thử xếp theo ngày thi, gom theo tháng (học sinh và khách);
//  048  Thanh bên chỉ còn MỘT mục "Cộng đồng" (bỏ mục "Hỏi đáp" xung đột), liên kết cũ /student/hoi-dap vẫn sống.
import { BASE, mkTutor, mkUser, mkCourse, mkAttendanceSession, api, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, closeAll, shot, type Page } from "./ui";
import { prisma } from "@/lib/prisma";

const YT = "https://youtu.be/dQw4w9WgXcQ";
const H = 3_600_000;

(async () => {
  await wipe();
  const now = Date.now();
  const T = await mkTutor("Cô Hạnh");
  const S = await mkUser({ name: "Minh Anh" }), S1 = await mkUser({ name: "Chỉ Một Lớp" }), LONE = await mkUser({ name: "Chưa Có Lớp" });
  const A = await mkCourse(T.id, { name: "Sử 12" }), B = await mkCourse(T.id, { name: "Địa 12" }), C = await mkCourse(T.id, { name: "Sử 12 nâng cao" });
  for (const c of [A, B, C]) await prisma.course.update({ where: { id: c.id }, data: { status: true, instructor: "Cô Hạnh" } });
  // Vào lớp theo thứ tự Địa → Sử nâng cao → Sử: danh mục phải theo đúng thứ tự này (không phụ thuộc thứ tự lưu trong DB).
  for (const [i, c] of [B, C, A].entries()) await prisma.enrollment.create({ data: { userId: S.id, courseId: c.id, status: "active", createdAt: new Date(now - (10 - i) * 60_000) } });
  await prisma.enrollment.create({ data: { userId: S1.id, courseId: A.id, status: "active" } });
  // Ca biên (rà soát độc lập 28/10): học sinh có lớp "tạm dừng", học sinh có lớp tạo bằng wizard (gia sư = "KiN").
  const SU = await mkUser({ name: "Có Lớp Tạm Dừng" }), KS = await mkUser({ name: "Có Lớp KiN" });
  const D = await mkCourse(T.id, { name: "Lịch sử địa phương" }), E = await mkCourse(T.id, { name: "Văn 12" });
  await prisma.course.update({ where: { id: D.id }, data: { status: true, instructor: "KiN" } });
  await prisma.course.update({ where: { id: E.id }, data: { status: true, instructor: "Cô Hạnh" } });
  await prisma.enrollment.create({ data: { userId: SU.id, courseId: A.id, status: "active" } });
  await prisma.enrollment.create({ data: { userId: SU.id, courseId: B.id, status: "suspended" } });
  await prisma.enrollment.create({ data: { userId: KS.id, courseId: D.id, status: "active", createdAt: new Date(now - 120_000) } });
  await prisma.enrollment.create({ data: { userId: KS.id, courseId: E.id, status: "active", createdAt: new Date(now - 60_000) } });

  // Mỗi lớp một chương + bài; Địa 12 có 2 bài (em xong 1). Bài tập: Sử 12 → 1 bài chưa nộp, Sử 12 nâng cao → 2 bài chưa nộp.
  const mkTree = async (c: { id: string }, n: number) => {
    await prisma.section.create({ data: { id: `s-${c.id}`, title: "Phần 1", order: 1, courseId: c.id } });
    await prisma.chapter.create({ data: { id: `ch-${c.id}`, title: "Chương 1", order: 1, sectionId: `s-${c.id}` } });
    for (let i = 1; i <= n; i++) await prisma.lesson.create({ data: { id: `l-${c.id}-${i}`, code: `l-${c.id}-${i}`, title: `Bài ${i} của ${c.id.slice(-2)}`, type: i === 1 ? "quiz" : "record", order: i, chapterId: `ch-${c.id}` } });
  };
  await mkTree(A, 1); await mkTree(B, 2); await mkTree(C, 1);
  await prisma.lessonProgress.create({ data: { userId: S.id, lessonId: `l-${B.id}-1`, completed: true, watchedSeconds: 60 } });
  const hw = (c: { id: string }, title: string, due: number) => prisma.assignment.create({ data: { lessonId: `l-${c.id}-1`, title, dueDate: new Date(now + due), instructions: "Làm bài" } });
  await hw(A, "Sử: bài A1", 5 * H);
  await hw(C, "Nâng cao: bài C1", 6 * H); await hw(C, "Nâng cao: bài C2", 7 * H);

  // Bản ghi của Sử 12: tháng 10 (2 bản ghi), tháng 9 (1 bản ghi), 1 bản ghi chưa gắn buổi.
  const s10 = await mkAttendanceSession(A.id, T.id, new Date("2026-10-16T00:00:00Z"));
  const s09 = await mkAttendanceSession(A.id, T.id, new Date("2026-09-20T00:00:00Z"));
  const rec = (title: string, sessionId: string | null, at: string) => prisma.classRecording.create({ data: { courseId: A.id, sessionId, title, url: YT, kind: "youtube", createdBy: T.id, createdAt: new Date(at) } });
  await rec("Bản ghi 16/10 phần 1", s10.id, "2026-10-17T01:00:00Z"); await rec("Bản ghi 16/10 phần 2", s10.id, "2026-10-18T01:00:00Z");
  await rec("Bản ghi 20/09", s09.id, "2026-09-21T01:00:00Z"); await rec("Bản ghi chưa gắn buổi", null, "2026-10-19T01:00:00Z");

  // Đề thi: ngày TẠO ngược với ngày THI để chứng minh đang xếp theo ngày thi.
  const ex = (id: string, title: string, date: string, time: string, createdAt: string) => prisma.exam.create({ data: { id, code: id, title, category: "Toán", date, time, duration: "15 phút", questions: 10, status: "available", createdAt } });
  await ex("ex-9", "Đề tháng chín", "20/09/2026", "19:00", "2026-10-20T00:00:00Z");
  await ex("ex-10a", "Đề mười sớm", "05/10/2026", "19:00", "2026-10-10T00:00:00Z");
  await ex("ex-10b", "Đề mười muộn", "25/10/2026", "21:00", "2026-10-01T00:00:00Z");
  await ex("ex-11", "Đề mười một", "15/11/2026", "19:00", "2026-09-01T00:00:00Z");
  await ex("ex-x", "Đề chưa rõ ngày", "sớm thôi", "19:00", "2026-08-01T00:00:00Z");

  await launch();
  const errors: string[] = [];
  const watch = (p: Page) => { p.on("pageerror", e => errors.push(String(e))); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|favicon|font|net::ERR|status of (4|5)|Hydration/i.test(m.text())) errors.push(`${p.url()} :: ${m.text().slice(0, 600)}`); }); };
  const overflow = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  const smallTargets = (p: Page) => p.evaluate(`[...document.querySelectorAll('main a, main button, main [role=tab]')].filter(e => e.offsetParent && !e.closest('[data-kin-tab-ink]') && e.getBoundingClientRect().width > 0).map(e => [Math.round(e.getBoundingClientRect().height), (e.textContent || '').trim().slice(0, 30)]).filter(([h]) => h < 44)`) as Promise<[number, string][]>;
  const go = (p: Page, path: string) => p.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 150000 });
  const courseParam = (p: Page) => new URL(p.url()).searchParams.get("course");

  section("API /api/enrollments: dạng cũ không đổi, ?detail=1 thêm tên lớp, thứ tự theo lúc vào lớp");
  const plain = await api("GET", "/api/enrollments", { as: S });
  check("không có ?detail: chỉ courseIds, đúng thứ tự vào lớp (Địa, Sử nâng cao, Sử)", Object.keys(plain.json).join() === "courseIds" && plain.json.courseIds.join() === [B.id, C.id, A.id].join(), plain.json);
  const det = await api("GET", "/api/enrollments?detail=1", { as: S });
  check("?detail=1: courses có tên, gia sư, số bài thật (Địa 12 = 2 bài)", det.json.courses.map((x: { name: string; instructor: string; lessonCount: number }) => `${x.name}|${x.instructor}|${x.lessonCount}`).join() === "Địa 12|Cô Hạnh|2,Sử 12 nâng cao|Cô Hạnh|1,Sử 12|Cô Hạnh|1", det.json.courses);
  check("khách (chưa đăng nhập) chỉ nhận danh sách rỗng", (await api("GET", "/api/enrollments?detail=1")).json.courseIds.length === 0);
  check("học sinh khác không thấy lớp của Minh Anh", (await api("GET", "/api/enrollments?detail=1", { as: LONE })).json.courses === undefined || (await api("GET", "/api/enrollments?detail=1", { as: LONE })).json.courses.length === 0);

  section("NC2-041 — học sinh nhiều lớp: danh mục lớp, không tự chọn hộ lớp đầu tiên (1280px)");
  const ctx = await ctxFor(S, { width: 1280, height: 900 });
  const pg = await ctx.newPage(); watch(pg);
  await go(pg, "/student/hoc-tap");
  await pg.locator("[data-class-catalog]").waitFor({ timeout: 120000 });
  await pg.waitForTimeout(2500); // nếu mã còn tự chuyển lớp thì đã chuyển xong
  check("vẫn ở /student/hoc-tap, KHÔNG có ?course= (không tự nhảy vào lớp đầu)", new URL(pg.url()).pathname === "/student/hoc-tap" && courseParam(pg) === null, pg.url());
  const cards = pg.locator("[data-class-card]");
  check("danh mục liệt kê đủ 3 lớp theo thứ tự vào lớp: Địa 12, Sử 12 nâng cao, Sử 12", (await cards.count()) === 3 && (await cards.evaluateAll(els => els.map(e => e.getAttribute("data-class-card")))).join() === [B.id, C.id, A.id].join());
  const catText = await pg.locator("[data-class-catalog]").innerText();
  check("mỗi lớp có tên, 'Gia sư: Cô Hạnh', tiến độ ('1/2 bài đã hoàn thành' cho Địa 12)", /Địa 12/.test(catText) && /Sử 12 nâng cao/.test(catText) && (catText.match(/Gia sư: Cô Hạnh/g) ?? []).length === 3 && /1\/2 bài đã hoàn thành/.test(catText), catText);
  check("lời dẫn nói rõ đang học 3 lớp và cách chọn", await pg.getByText(/Bạn đang học 3 lớp/).isVisible());
  check("có lối 'Nhập mã lớp khác' → /student/nhap-ma-lop", (await pg.getByRole("link", { name: "Nhập mã lớp khác" }).getAttribute("href")) === "/student/nhap-ma-lop");
  await shot(pg, "lop-nhieu-lop-danh-muc");

  await cards.nth(0).getByRole("link").click();
  await pg.waitForURL(u => u.searchParams.get("course") === B.id, { timeout: 90000 });
  await pg.locator("[data-course-hero]").waitFor({ timeout: 90000 });
  check("bấm 'Địa 12' → vào đúng lớp Địa 12 (không phải lớp đầu tiên khác)", (await pg.locator("[data-course-hero]").innerText()).includes("Địa 12") && (await pg.locator("[data-course-hero]").innerText()).includes("1/2 bài đã hoàn thành"));
  check("trong lớp có 'Các lớp của bạn' đủ 3 lớp, lớp đang xem có aria-current=page", (await pg.locator("[data-my-classes] a").count()) === 3 && (await pg.locator(`[data-my-classes] a[aria-current="page"]`).innerText()).includes("Địa 12"));
  await pg.locator("[data-my-classes]").getByRole("link", { name: /^Sử 12$/ }).click();
  await pg.waitForURL(u => u.searchParams.get("course") === A.id, { timeout: 90000 });
  await pg.locator("[data-course-hero]").waitFor({ timeout: 90000 });
  check("đổi lớp bằng 'Các lớp của bạn' → sang Sử 12", (await pg.locator("[data-course-hero]").innerText()).includes("Sử 12") && !(await pg.locator("[data-course-hero]").innerText()).includes("nâng cao"));
  await pg.getByRole("link", { name: "← Tất cả lớp" }).click();
  await pg.locator("[data-class-catalog]").waitFor({ timeout: 90000 });
  check("'← Tất cả lớp' quay lại danh mục (không bị đẩy vào lớp)", new URL(pg.url()).pathname === "/student/hoc-tap" && courseParam(pg) === null);

  section("NC2-041 — đếm bài theo ID lớp: 'Sử 12' không đếm lẫn bài của 'Sử 12 nâng cao'");
  const need = async (id: string) => {
    await go(pg, `/student/hoc-tap?course=${id}`);
    await pg.locator("[data-course-hero]").waitFor({ timeout: 120000 });
    await eventually("khối 'Thông tin lớp' đã có số bài", async () => /Bài cần làm: \d/.test(await pg.getByRole("complementary", { name: "Thông tin lớp" }).innerText()), 30000);
    return (await pg.getByRole("complementary", { name: "Thông tin lớp" }).innerText());
  };
  const tA = await need(A.id), tC = await need(C.id), tB = await need(B.id);
  check("Sử 12: 'Bài cần làm: 1' (chỉ bài của Sử 12)", /Bài cần làm: 1\b/.test(tA), tA);
  check("Sử 12 nâng cao: 'Bài cần làm: 2'", /Bài cần làm: 2\b/.test(tC), tC);
  check("Địa 12: 'Bài cần làm: 0'", /Bài cần làm: 0\b/.test(tB), tB);

  section("NC2-042 — bản ghi theo tháng, thu gọn / mở được");
  await go(pg, `/student/hoc-tap?course=${A.id}`);
  await pg.getByRole("tab", { name: /Tài liệu & bản ghi/ }).click({ timeout: 120000 });
  await pg.locator("[data-recording-months]").waitFor({ timeout: 90000 });
  const months = pg.locator("[data-recording-month]");
  check("3 nhóm theo thứ tự: Tháng 10/2026, Tháng 9/2026, Chưa gắn buổi", (await months.evaluateAll(els => els.map(e => e.getAttribute("data-recording-month")))).join() === "2026-10,2026-09,chua-gan-buoi");
  const btn = (key: string) => pg.locator(`[data-recording-month="${key}"] button`);
  const inert = (key: string) => pg.locator(`#rec-thang-${key}`).evaluate((e: HTMLElement) => e.inert);
  check("tháng mới nhất mở sẵn (aria-expanded=true), các tháng cũ gập", (await btn("2026-10").getAttribute("aria-expanded")) === "true" && (await btn("2026-09").getAttribute("aria-expanded")) === "false" && (await btn("chua-gan-buoi").getAttribute("aria-expanded")) === "false");
  check("nhóm đang gập bị 'inert' (Tab không chui vào phần ẩn), nhóm đang mở thì không", (await inert("2026-09")) === true && (await inert("2026-10")) === false);
  check("tiêu đề tháng ghi số bản ghi ('· 2 bản ghi', '· 1 bản ghi')", /Tháng 10\/2026\s*·\s*2 bản ghi/.test(await btn("2026-10").innerText()) && /Tháng 9\/2026\s*·\s*1 bản ghi/.test(await btn("2026-09").innerText()));
  check("nút tiêu đề cao ≥ 44px", ((await btn("2026-09").boundingBox())?.height ?? 0) >= 44);
  check("không mất bản ghi nào: 4 dòng, vẫn ghi 'Buổi 16/10/2026' và 'Chưa gắn buổi'", (await pg.locator("[data-recording-row]").count()) === 4 && /Buổi 16\/10\/2026/.test(await pg.locator("[data-recording-months]").innerText()) && /Buổi 20\/09\/2026/.test(await pg.locator("[data-recording-months]").innerText()));
  await btn("2026-09").click();
  await eventually("bấm 'Tháng 9/2026' → mở: aria-expanded=true, hết inert, thấy bản ghi 20/09", async () => (await btn("2026-09").getAttribute("aria-expanded")) === "true" && (await inert("2026-09")) === false && await pg.getByText("Bản ghi 20/09").isVisible(), 8000);
  await btn("2026-09").focus(); await pg.keyboard.press("Enter");
  await eventually("Enter trên tiêu đề → gập lại", async () => (await btn("2026-09").getAttribute("aria-expanded")) === "false" && (await inert("2026-09")) === true, 8000);
  await btn("2026-10").click();
  await eventually("bấm tháng đang mở → gập; tháng khác không bị ảnh hưởng", async () => (await btn("2026-10").getAttribute("aria-expanded")) === "false" && (await btn("2026-09").getAttribute("aria-expanded")) === "false", 8000);
  await shot(pg, "lop-nhieu-lop-ban-ghi");

  section("Học sinh chỉ MỘT lớp: vào thẳng lớp, không có lối đổi lớp thừa");
  const c1 = await ctxFor(S1, { width: 1280, height: 900 });
  const p1 = await c1.newPage(); watch(p1);
  await go(p1, "/student/hoc-tap");
  await p1.waitForURL(u => u.searchParams.get("course") === A.id, { timeout: 90000 });
  await p1.locator("[data-course-hero]").waitFor({ timeout: 90000 });
  check("1 lớp → /student/hoc-tap tự vào lớp đó (như trước)", courseParam(p1) === A.id);
  check("không có '← Tất cả lớp' và 'Các lớp của bạn' khi chỉ có 1 lớp", (await p1.locator("[data-all-classes]").count()) === 0 && (await p1.locator("[data-my-classes]").count()) === 0);
  await c1.close();
  const cl = await ctxFor(LONE, { width: 1280, height: 900 });
  const pl = await cl.newPage(); watch(pl);
  await go(pl, "/student/hoc-tap");
  await pl.getByText("Bạn chưa vào lớp nào").waitFor({ timeout: 120000 });
  check("chưa có lớp: vẫn giải thích + 'Nhập mã lớp'", (await pl.getByRole("link", { name: "Nhập mã lớp" }).getAttribute("href")) === "/student/nhap-ma-lop" && (await pl.locator("[data-class-catalog]").count()) === 0);
  await cl.close();

  section("NC2-040 — Thi thử xếp theo ngày thi, gom theo tháng (học sinh)");
  await go(pg, "/thi-thu");
  await pg.locator("[data-exam-month]").first().waitFor({ timeout: 120000 });
  const keys = () => pg.locator("[data-exam-month]").evaluateAll(els => els.map(e => e.getAttribute("data-exam-month")));
  const titles = (key: string) => pg.locator(`[data-exam-month="${key}"] [data-exam-row]`).evaluateAll(els => els.map(e => (e.querySelector("p")?.textContent ?? "").trim()));
  check("tháng mới nhất trước: 11/2026, 10/2026, 09/2026, rồi 'Chưa có ngày thi' (ngày tạo đề ngược hẳn)", (await keys()).join() === "2026-11,2026-10,2026-09,chua-co-ngay", await keys());
  check("trong tháng 10: đề 25/10 đứng trước đề 05/10", (await titles("2026-10")).join() === "Đề mười muộn,Đề mười sớm", await titles("2026-10"));
  check("đề không đọc được ngày KHÔNG bị ẩn: nằm nhóm 'Chưa có ngày thi'", (await titles("chua-co-ngay")).join() === "Đề chưa rõ ngày");
  check("tiêu đề tháng ghi số đề ('Tháng 10/2026 · 2 đề') và là tiêu đề (heading)", await pg.getByRole("heading", { name: /Tháng 10\/2026\s*·\s*2 đề/ }).isVisible());
  check("đủ 5 đề, không mất không trùng", (await pg.locator("[data-exam-row]").count()) === 5);
  await pg.getByRole("searchbox", { name: "Tìm đề thi" }).fill("mười một");
  await eventually("ô tìm 'mười một' → chỉ còn tháng 11 (không để tiêu đề tháng rỗng)", async () => (await keys()).join() === "2026-11" && (await pg.locator("[data-exam-row]").count()) === 1, 8000);
  await pg.getByRole("searchbox", { name: "Tìm đề thi" }).fill("");
  await pg.getByRole("button", { name: "Chưa làm", exact: true }).click();
  check("lọc 'Chưa làm' vẫn giữ nhóm tháng (5 đề chưa làm)", (await keys()).length === 4 && (await pg.locator("[data-exam-row]").count()) === 5);
  await shot(pg, "lop-nhieu-lop-thi-thu");

  section("NC2-040 — khách cũng thấy đề theo tháng");
  const cg = await ctxFor(null, { width: 1280, height: 900 });
  const pgst = await cg.newPage(); watch(pgst);
  await go(pgst, "/thi-thu");
  await pgst.locator("[data-exam-month]").first().waitFor({ timeout: 120000 });
  check("khách: cùng thứ tự tháng 11, 10, 09, 'chưa có ngày'", (await pgst.locator("[data-exam-month]").evaluateAll(els => els.map(e => e.getAttribute("data-exam-month")))).join() === "2026-11,2026-10,2026-09,chua-co-ngay");
  check("khách: đủ 5 đề, đề 25/10 đứng trước đề 05/10", /Đề mười muộn[\s\S]*Đề mười sớm/.test(await pgst.locator("body").innerText()) && /Đề mười một[\s\S]*Đề mười muộn[\s\S]*Đề mười sớm[\s\S]*Đề tháng chín[\s\S]*Đề chưa rõ ngày/.test(await pgst.locator("body").innerText()));
  await cg.close();

  section("NC2-048 — thanh bên chỉ còn MỘT mục 'Cộng đồng'; liên kết cũ vẫn sống");
  const cw = await ctxFor(S, { width: 1440, height: 900, rail: "mac-dinh" });
  const pw = await cw.newPage(); watch(pw);
  await go(pw, "/student/hoi-dap");
  await pw.waitForURL(u => u.pathname === "/cong-dong", { timeout: 120000 });
  check("/student/hoi-dap (liên kết / thông báo cũ) vẫn dẫn tới Cộng đồng, tab Hỏi đáp", new URL(pw.url()).searchParams.get("tab") === "hoi-dap-qa", pw.url());
  const rail = pw.getByRole("navigation", { name: "Module của học sinh" }).first();
  await rail.waitFor({ timeout: 90000 });
  check("thanh bên KHÔNG còn mục 'Hỏi đáp'", (await rail.getByRole("link", { name: "Hỏi đáp", exact: true }).count()) === 0);
  check("đứng ở Cộng đồng (tab Hỏi đáp) → chỉ mục 'Cộng đồng' sáng, không xung đột", (await rail.getByRole("link", { name: "Cộng đồng", exact: true }).getAttribute("aria-current")) === "page" && (await rail.locator('a[aria-current="page"]').count()) === 1);
  check("trang vẫn có tab 'Hỏi đáp' bên trong Cộng đồng", await pw.getByRole("button", { name: /Hỏi đáp/ }).first().isVisible());
  await cw.close();
  // Thanh HẸP (mặc định của các bài ui-*): mục nằm trong bảng "Khác". ui-student-shell kiểm chỗ này nhưng đang hỏng sẵn ở bản gốc (strict mode 'HỌC SINH' khớp 2 phần tử), nên kiểm lại ở đây.
  const cn = await ctxFor(S, { width: 1280, height: 800 });
  const pn = await cn.newPage(); watch(pn);
  await go(pn, "/student/viec-cua-toi");
  const railN = pn.getByRole("navigation", { name: "Module của học sinh" }).first();
  await railN.getByRole("button", { name: /^Khác/ }).click({ timeout: 120000 });
  const dlg = pn.getByRole("dialog", { name: "Các mục khác" });
  await dlg.waitFor({ timeout: 60000 });
  check("bảng 'Khác' (thanh hẹp): có 'Cộng đồng', 'Thi thử', 'Thư viện' và KHÔNG có 'Hỏi đáp'", (await dlg.getByRole("link", { name: "Cộng đồng", exact: true }).count()) === 1 && (await dlg.getByRole("link", { name: "Thi thử", exact: true }).count()) === 1 && (await dlg.getByRole("link", { name: "Thư viện", exact: true }).count()) === 1 && (await dlg.getByRole("link", { name: "Hỏi đáp", exact: true }).count()) === 0);
  await cn.close();

  section("Rà soát độc lập 28/10 — ca biên: đổi lớp khi mạng chậm, API lỗi, ?course= lạ, cô lập, tạm dừng, gia sư 'KiN'");
  // P2-1: phản hồi CHẬM của lớp trước không được ghi đè lớp đang xem (bấm sang Địa 12 rồi Quay lại ngay về Sử 12).
  const cr = await ctxFor(S, { width: 1280, height: 900 });
  const pr = await cr.newPage(); watch(pr);
  await pr.route(`**/api/courses/${B.id}`, async r => { await new Promise(res => setTimeout(res, 4500)); await r.continue().catch(() => {}); });
  // Bản ghi trễ LÂU HƠN trang lớp (12 giây so với 4,5 giây): hero hiện ra khi bản ghi còn đang tải — đúng khoảng mà lỗi cũ để lộ bản ghi của lớp trước.
  await pr.route(`**/api/courses/${B.id}/recordings`, async r => { await new Promise(res => setTimeout(res, 12000)); await r.continue().catch(() => {}); });
  await go(pr, `/student/hoc-tap?course=${A.id}`);
  await pr.locator("[data-my-classes]").waitFor({ timeout: 120000 });
  await pr.locator("[data-my-classes]").getByRole("link", { name: /^Địa 12$/ }).click();
  await pr.waitForURL(u => courseParam(pr) === B.id && u.pathname === "/student/hoc-tap", { timeout: 30000 });
  await pr.goBack();
  await pr.waitForURL(() => courseParam(pr) === A.id, { timeout: 30000 });
  await pr.locator("[data-course-hero]").waitFor({ timeout: 60000 });
  await pr.waitForTimeout(6500); // đợi phản hồi chậm của Địa 12 về tới nơi
  check("P2-1: đã quay về Sử 12, phản hồi muộn của Địa 12 KHÔNG ghi đè (hero vẫn 'Sử 12', URL vẫn Sử 12)", courseParam(pr) === A.id && (await pr.locator("[data-course-hero]").innerText()).includes("Sử 12") && !(await pr.locator("[data-course-hero]").innerText()).includes("Địa 12"), await pr.locator("[data-course-hero]").innerText());
  // P2-2: bản ghi của Sử 12 không được hiện sang Địa 12 trong lúc bản ghi Địa 12 còn đang tải.
  await pr.getByRole("tab", { name: /Tài liệu & bản ghi/ }).click();
  await pr.locator("[data-recording-months]").waitFor({ timeout: 60000 });
  await pr.locator("[data-my-classes]").getByRole("link", { name: /^Địa 12$/ }).click();
  await pr.waitForURL(() => courseParam(pr) === B.id, { timeout: 30000 });
  await pr.locator("[data-course-hero]").waitFor({ timeout: 60000 });
  check("P2-2: sang lớp khác thì về tab 'Tổng quan' (không mang tab của lớp trước)", (await pr.getByRole("tab", { name: "Tổng quan" }).getAttribute("aria-selected")) === "true");
  await pr.getByRole("tab", { name: /Tài liệu & bản ghi/ }).click();
  await pr.waitForTimeout(800);
  const midText = await pr.locator("main").innerText();
  check("P2-2: trong lúc bản ghi Địa 12 còn tải, KHÔNG thấy bản ghi của Sử 12 ('Bản ghi 16/10', 'Tháng 10/2026')", !/Bản ghi 16\/10|Bản ghi 20\/09|Tháng 10\/2026/.test(midText) && /Đang tải bản ghi/.test(midText), midText.slice(0, 300));
  await eventually("P2-2: tải xong → Địa 12 'Chưa có bản ghi nào' (không dính bản ghi Sử 12)", async () => (await pr.getByText("Chưa có bản ghi nào").count()) === 1 && !/Bản ghi 16\/10/.test(await pr.locator("main").innerText()), 30000);
  await cr.close();
  // P2-3: API danh sách lớp lỗi thì nói là LỖI, không hiện 'Bạn chưa vào lớp nào'; thử lại được.
  const ce = await ctxFor(S, { width: 1280, height: 900 });
  const pe = await ce.newPage(); watch(pe);
  let enrollFail = true;
  await pe.route(u => u.pathname === "/api/enrollments" && u.searchParams.get("detail") === "1", r => (enrollFail ? r.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "x" }) }) : r.continue()));
  await go(pe, "/student/hoc-tap");
  const strip = pe.locator('[role="alert"]:not(#__next-route-announcer__)');
  await strip.waitFor({ timeout: 120000 });
  check("P2-3: lỗi API → dải 'Không tải được danh sách lớp của bạn.' + 'Thử lại'; KHÔNG hiện 'Bạn chưa vào lớp nào'", await strip.getByText("Không tải được danh sách lớp của bạn.").isVisible() && await strip.getByRole("button", { name: "Thử lại" }).isVisible() && (await pe.getByText("Bạn chưa vào lớp nào").count()) === 0);
  enrollFail = false;
  await strip.getByRole("button", { name: "Thử lại" }).click();
  await pe.locator("[data-class-catalog]").waitFor({ timeout: 60000 });
  check("P2-3: bấm 'Thử lại' → thấy danh mục 3 lớp", (await pe.locator("[data-class-card]").count()) === 3 && (await strip.count()) === 0);
  enrollFail = true;
  await go(pe, `/student/hoc-tap?course=${A.id}`);
  await strip.waitFor({ timeout: 120000 });
  check("P2-3: đang ở trong một lớp mà API lỗi → vẫn là dải lỗi, không phải 'Bạn chưa vào lớp này'", await strip.getByText("Không tải được danh sách lớp của bạn.").isVisible() && (await pe.getByText("Bạn chưa vào lớp này").count()) === 0);
  await ce.close();
  // P3-1: ?course= không tồn tại → có lời giải thích và lối '← Tất cả lớp'.
  const cx = await ctxFor(S, { width: 1280, height: 900 });
  const px = await cx.newPage(); watch(px);
  await go(px, "/student/hoc-tap?course=lop-khong-ton-tai");
  await px.locator('[role="alert"]:not(#__next-route-announcer__)').waitFor({ timeout: 120000 });
  check("P3-1: lớp không tồn tại → dải lỗi + vẫn có '← Tất cả lớp' (học sinh nhiều lớp không bị ngõ cụt)", await px.getByText(/Không tìm thấy khóa học/).first().isVisible() && await px.locator("[data-all-classes]").isVisible());
  await px.locator("[data-all-classes]").click();
  await px.locator("[data-class-catalog]").waitFor({ timeout: 60000 });
  check("P3-1: bấm '← Tất cả lớp' → danh mục", (await px.locator("[data-class-card]").count()) === 3);
  await cx.close();
  // Cô lập: học sinh chỉ có Sử 12 không thấy lớp khác của bạn học (API và trang).
  const iso = await api("GET", "/api/enrollments?detail=1", { as: S1 });
  check("cô lập: học sinh chỉ học Sử 12 chỉ nhận đúng 1 lớp (không có Địa 12 / Sử 12 nâng cao)", iso.json.courses.length === 1 && iso.json.courses[0].id === A.id && !JSON.stringify(iso.json).includes(B.id) && !JSON.stringify(iso.json).includes(C.id), iso.json);
  const ci = await ctxFor(S1, { width: 1280, height: 900 });
  const pi = await ci.newPage(); watch(pi);
  await go(pi, `/student/hoc-tap?course=${B.id}`);
  await pi.getByText("Bạn chưa vào lớp này").waitFor({ timeout: 120000 });
  const isoText = await pi.locator("main").innerText();
  check("cô lập: mở lớp mình KHÔNG học → 'Bạn chưa vào lớp này', không có 'Các lớp của bạn', không lộ tên lớp khác", (await pi.locator("[data-my-classes]").count()) === 0 && !/Sử 12 nâng cao/.test(isoText), isoText.slice(0, 200));
  await ci.close();
  // Lớp 'tạm dừng' không vào danh sách (đồng nhất với quyền học: chỉ 'active').
  const sus = await api("GET", "/api/enrollments?detail=1", { as: SU });
  check("lớp 'suspended' không nằm trong danh sách (API)", sus.json.courseIds.join() === A.id && sus.json.courses.length === 1, sus.json);
  const cs = await ctxFor(SU, { width: 1280, height: 900 });
  const ps = await cs.newPage(); watch(ps);
  await go(ps, "/student/hoc-tap");
  await ps.waitForURL(() => courseParam(ps) === A.id, { timeout: 90000 });
  check("chỉ còn 1 lớp đang học (lớp kia tạm dừng) → vào thẳng lớp đó, không hiện danh mục", courseParam(ps) === A.id && (await ps.locator("[data-class-catalog]").count()) === 0);
  await cs.close();
  // Lớp tạo bằng wizard có gia sư = "KiN": không hiện 'Gia sư: KiN'.
  const ck = await ctxFor(KS, { width: 1280, height: 900 });
  const pk = await ck.newPage(); watch(pk);
  await go(pk, "/student/hoc-tap");
  await pk.locator("[data-class-catalog]").waitFor({ timeout: 120000 });
  const kinText = await pk.locator("[data-class-catalog]").innerText();
  check("gia sư 'KiN' (tên giữ chỗ) không hiện 'Gia sư: KiN'; lớp có tên thật vẫn hiện 'Gia sư: Cô Hạnh'", !/Gia sư: KiN/.test(kinText) && (kinText.match(/Gia sư: Cô Hạnh/g) ?? []).length === 1 && /Lịch sử địa phương/.test(kinText) && /Văn 12/.test(kinText), kinText);
  check("không gắn nhãn 'Môn:' cho nhóm lớp (có thể là nhóm kỳ thi)", !/Môn:/.test(kinText));
  await ck.close();

  section("Điện thoại 390px");
  const cm = await ctxFor(S, { width: 390, height: 844 });
  const pm = await cm.newPage(); watch(pm);
  await pm.addStyleTag({ content: "[data-agentation-root]{display:none!important}" }).catch(() => {});
  for (const [name, path, ready] of [["Danh mục lớp", "/student/hoc-tap", "[data-class-catalog]"], ["Trong lớp (có 'Các lớp của bạn')", `/student/hoc-tap?course=${A.id}`, "[data-my-classes]"], ["Thi thử theo tháng", "/thi-thu", "[data-exam-month]"]] as const) {
    await go(pm, path);
    await pm.locator(ready).first().waitFor({ timeout: 120000 });
    await pm.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => {});
    check(`${name}: không tràn ngang ở 390px`, (await overflow(pm)) <= 0, await overflow(pm));
    const small = await smallTargets(pm);
    check(`${name}: mọi nút / liên kết trong trang cao ≥ 44px`, small.length === 0, small.slice(0, 5));
    await shot(pm, `lop-nhieu-lop-${name.split(" ")[0].toLowerCase()}-390`);
  }
  await go(pm, `/student/hoc-tap?course=${A.id}`);
  await pm.getByRole("tab", { name: /Tài liệu & bản ghi/ }).click({ timeout: 120000 });
  await pm.locator("[data-recording-months]").waitFor({ timeout: 90000 });
  check("bản ghi theo tháng ở 390px: không tràn ngang, tiêu đề tháng ≥ 44px", (await overflow(pm)) <= 0 && ((await pm.locator('[data-recording-month="2026-09"] button').boundingBox())?.height ?? 0) >= 44);
  await cm.close();

  section("Không lỗi trình duyệt");
  check("không có pageerror / console.error", errors.length === 0, errors.slice(0, 4));
  await closeAll();
  await done();
})().catch(async e => { console.error("TEST CRASH", e); await closeAll().catch(() => {}); process.exit(1); });
