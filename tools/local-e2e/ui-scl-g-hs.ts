// SCL-G-HS (21/11/2026) — các màn học sinh theo bản chốt (docs/kin/thiet-ke/scl/QUYET-DINH-GIAO-DIEN.md §2.1, §3.3–3.6, §3.9; ban-chot.html khung 1–4)
// trên trình duyệt thật: trang lớp (một dòng đầu trang + vạch 4px, Cần làm trên cùng, thẻ có viền trái / hạn đủ thứ-ngày-giờ / nút Nộp bài ≥ 48px, MỘT nút chính,
// không còn 3 viên tab, Buổi gần đây hàng 56px mới nhất trước, dock chỉ hiện khi thẻ đã cuộn khỏi màn và không che hàng cuối, phản hồi sau khi nộp),
// Tất cả bài học (nhóm theo chương, chương mới nhất trên, ô tìm không dấu, bản ghi buổi học), Cần làm gom mọi lớp (nhóm Quá hạn / Tuần này…),
// Điểm (x/10, Trung bình, "Chờ gia sư duyệt" KHÔNG có số — kể cả trong JSON), thanh dưới 64px (Cần làm có badge · Lớp · [Lịch] · Điểm, aria-current),
// link Zalo ?course=…&bai=… mở thẳng bài, POST nộp bài có `ve` quay về đúng màn. 360/390/1280 không tràn ngang. Chụp ảnh vào SHOTS_DIR nếu có.
// Sửa theo rà soát: badge = đúng số thẻ của Cần làm (cả bài hạn > 3 ngày), đầu trang có lịch, Điểm có ngày + link và không liệt kê bài chưa nộp, đề không lặp,
// thông báo trống chỉ một dòng, thanh dưới chỉ mục chọn có nền + badge navy, nộp THẬT ảnh → PDF → tải lên → /nop, chọn lại bỏ tệp tải dở.
import { BASE, api, mkTutor, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { launch, ctxFor, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";
import { featureOn } from "@/lib/features";
import { addDaysKey, dayOfWeekOfKey, vnDateKeyOf } from "@/lib/classSessions";
import type { Page } from "playwright";

const SHOTS = process.env.SHOTS_DIR;
const snap = async (pg: Page, name: string) => { if (SHOTS) await pg.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }); };
const overflowX = (pg: Page) => pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const H = 3_600_000, D = 24 * H;
const RAIL = "Module của học sinh";
// Nút chính (navy) ĐANG HIỆN trong nội dung trang, KHÔNG tính dock (bản sao của nút chính) và thanh bên.
const primaries = (pg: Page) => pg.evaluate(`[...document.querySelectorAll("main a, main button")].filter(e => e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height > 0
  && !e.closest("[data-nop-dock]") && (e.getAttribute("class") || "").includes("bg-[var(--kin-nhan-nen)]")).map(e => e.innerText.trim())`) as Promise<string[]>;
const statusesOk = (pg: Page) => pg.locator("main [data-kin-status]:visible").evaluateAll(els => els.map(e => ({ t: (e as HTMLElement).innerText.trim(), svg: !!e.querySelector("svg[aria-hidden=true]") })));

(async () => {
  await wipe();
  const now = Date.now();
  const T = await mkTutor("Cô Lan (thử)");
  const S = await mkUser({ name: "Minh Anh (thử)" });
  const A = await mkCourse(T.id, { name: "Toán 9 · Lớp thử A" });
  const B = await mkCourse(T.id, { name: "Vật lý 9 · Lớp thử B" });
  await prisma.course.update({ where: { id: A.id }, data: { instructor: "Cô Lan (thử)" } });
  for (const c of [A, B]) await prisma.enrollment.create({ data: { userId: S.id, courseId: c.id, status: "active" } });
  await prisma.section.create({ data: { id: "s-a", title: "Phần 1", courseId: A.id } });
  await prisma.chapter.create({ data: { id: "c-a1", title: "Chương 1 · Căn bậc hai", sectionId: "s-a", order: 1 } });
  await prisma.chapter.create({ data: { id: "c-a2", title: "Chương 2 · Hệ phương trình", sectionId: "s-a", order: 2 } });
  const L = (id: string, chapterId: string, title: string, daysAgo: number, order: number, extra: Record<string, unknown> = {}) =>
    prisma.lesson.create({ data: { id, code: id, title, type: "record", chapterId, order, scheduledAt: new Date(now - daysAgo * D), ...extra } });
  await L("l-1", "c-a1", "Căn bậc hai và rút gọn", 16, 1, { duration: "40 phút", videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" });
  await L("l-2", "c-a1", "Phương trình chứa căn", 11, 2, { documents: JSON.stringify([{ name: "Đề cương.pdf", url: "https://example.com/a.pdf" }]) });
  await L("l-3", "c-a2", "Giải hệ bằng phương pháp thế", 9, 1, { duration: "38 phút", videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" });
  await L("l-4", "c-a2", "Hệ phương trình bậc nhất", 4, 2, { duration: "42 phút", videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    documents: JSON.stringify([{ name: "Phiếu 1.pdf", url: "https://example.com/1.pdf" }, { name: "Phiếu 2.pdf", url: "https://example.com/2.pdf" }]) });
  await L("l-nhap", "c-a2", "Bài nháp không được thấy", 1, 3, { status: "draft" });
  await prisma.section.create({ data: { id: "s-b", title: "P", courseId: B.id } });
  await prisma.chapter.create({ data: { id: "c-b", title: "C", sectionId: "s-b" } });
  await L("l-b", "c-b", "Chuyển động đều", 2, 1);
  const as = (id: string, lessonId: string, title: string, due: number) => prisma.assignment.create({ data: { id, lessonId, title, dueDate: new Date(now + due), maxPoints: 10 } });
  await as("bt-5", "l-4", "Bài tập buổi 5", 3 * D + 2 * H);
  await as("bt-4", "l-2", "Bài tập buổi 4", -2 * D);
  await as("bt-b", "l-b", "Bài tập chương 1", 4 * D);
  await as("bt-cham", "l-3", "Bài tập phép thế", -5 * D);
  await prisma.assignmentSubmission.create({ data: { assignmentId: "bt-cham", userId: S.id, fileUrl: "/u/x.pdf", score: 8.5, gradedAt: new Date(now - D) } });
  await as("bt-cho", "l-1", "Bài tập căn bậc hai", 6 * D);
  await prisma.assignmentSubmission.create({ data: { assignmentId: "bt-cho", userId: S.id, fileUrl: "/u/z.pdf", submittedAt: new Date(now - H) } }); // "Đã nộp, chờ chấm"
  // Lịch tuần của lớp A ⇒ đầu trang lớp ghi "Cô Lan (thử) · <thứ>, 19:00" (§2.1, §4.1 #19).
  await prisma.classSchedule.create({ data: { courseId: A.id, dayOfWeek: dayOfWeekOfKey(addDaysKey(vnDateKeyOf(new Date()), 1)), startTime: "19:00", endTime: "20:30" } });
  const ed = new Date(now + 5 * D + 7 * H);
  const examDate = `${String(ed.getUTCDate()).padStart(2, "0")}/${String(ed.getUTCMonth() + 1).padStart(2, "0")}/${ed.getUTCFullYear()}`;
  await prisma.exam.create({ data: { id: "ex-15", code: "ex-15", title: "Kiểm tra 15 phút · Chương 2", category: "Toán", date: examDate, time: "19:00", duration: "15 phút", questions: 0, status: "available", createdAt: "2020", courseId: A.id } });
  // Đề Azota em tự khai điểm ⇒ "Chờ duyệt": điểm 7 KHÔNG được tới học sinh.
  await prisma.exam.create({ data: { id: "az-a", code: "az-a", title: "Đề Azota chương 1", category: "Toán", date: "01/11/2026", time: "08:00", duration: "45 phút", questions: 0, status: "available", createdAt: "2020", courseId: A.id } });
  await prisma.classRecording.create({ data: { courseId: A.id, title: "Bản ghi buổi ôn tập", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", kind: "youtube", createdBy: T.id } });

  section("API: nộp bài có `ve` quay về đúng màn; điểm Chờ duyệt không rời máy chủ");
  const form = (ve?: string) => ({ as: S, raw: new URLSearchParams(ve ? { ve } : {}).toString(), headers: { "content-type": "application/x-www-form-urlencoded", accept: "text/html" } });
  const r1 = await api("POST", "/api/student/nop-bai/bt-5/nop", form("lop"));
  const loc1 = r1.headers.get("location") ?? "";
  check("ve=lop ⇒ 303 về trang lớp kèm ?nop=…&bt=bt-5", r1.status === 303 && loc1.includes(`/student/hoc-tap?course=${A.id}&nop=`) && loc1.includes("bt=bt-5"), { s: r1.status, loc1 });
  const r2 = await api("POST", "/api/student/nop-bai/bt-5/nop", form("can-lam"));
  check("ve=can-lam ⇒ 303 về /student/viec-cua-toi?nop=…&bt=bt-5", r2.status === 303 && (r2.headers.get("location") ?? "").includes("/student/viec-cua-toi?nop=") && (r2.headers.get("location") ?? "").includes("bt=bt-5"), r2.headers.get("location"));
  const r3 = await api("POST", "/api/student/nop-bai/bt-5/nop", form());
  check("không `ve` ⇒ về trang bài như cũ", r3.status === 303 && (r3.headers.get("location") ?? "").includes("/student/bai-giang/l-4?nop="), r3.headers.get("location"));
  await api("POST", "/api/exam-results", { as: S, body: { examId: "az-a", score: 7 } });
  const kq = await api("GET", `/api/student/ket-qua?courseId=${A.id}`, { as: S });
  const az = (kq.json?.classes?.[0]?.items ?? []).find((i: { id: string }) => i.id === "az-a");
  check("R4: đề tự khai ở trạng thái cho-duyet, score = null trong JSON gửi học sinh", az?.state === "cho-duyet" && az.score === null, az);

  await launch();
  const errors: string[] = [];
  const watch = (p: Page) => { p.on("pageerror", e => errors.push(String(e))); };
  const open = async (path: string, width: number, height = 820) => {
    const pg = await (await ctxFor(S, { width, height })).newPage(); watch(pg);
    await pg.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 170000 });
    await pg.addStyleTag({ content: "[data-agentation-root]{display:none!important}" });
    return pg;
  };

  section("Trang lớp 390px (khung 1)");
  const pg = await open(`/student/hoc-tap?course=${A.id}`, 390);
  await pg.locator("[data-can-lam-the]:visible").first().waitFor({ timeout: 120000 });
  const dau = await pg.locator("[data-dau-lop]:visible").innerText();
  check("h1 = tên lớp; dòng đầu trang có tên cô + lịch học trên MỘT dòng ('Cô Lan (thử) · <thứ>, 19:00')", await pg.getByRole("heading", { level: 1, name: "Toán 9 · Lớp thử A" }).isVisible() && /Cô Lan \(thử\) · (Thứ \S+|Chủ nhật), 19:00/.test(dau), dau);
  check("h1 đậm 700 (thứ bậc theo bản chốt)", (await pg.locator("main h1:visible").first().evaluate(e => getComputedStyle(e).fontWeight)) === "700");
  check("vạch màu lớp cao 4px", Math.round((await pg.locator("[data-vach-lop]:visible").boundingBox())?.height ?? 0) === 4);
  check("không còn dải tab Nội dung / Video / Kết quả", await pg.getByRole("tab").count() === 0 && await pg.getByRole("tablist").count() === 0);
  const order = await pg.evaluate(`({ canLam: document.querySelector("[data-lop-can-lam]")?.getBoundingClientRect().top ?? -1, ganDay: document.querySelector("[data-lop-gan-day]")?.getBoundingClientRect().top ?? -1 })`) as { canLam: number; ganDay: number };
  check("'Cần làm' nằm TRÊN 'Buổi gần đây'", order.canLam >= 0 && order.canLam < order.ganDay, order);
  const cards = pg.locator("[data-lop-can-lam] [data-can-lam-the]:visible");
  check("Cần làm có 3 thẻ của lớp này (2 bài tập + 1 kiểm tra), không lẫn bài lớp Vật lý", await cards.count() === 3 && !(await pg.locator("[data-lop-can-lam]").innerText()).includes("Bài tập chương 1"), await cards.count());
  check("số đếm cạnh 'Cần làm' = 3", (await pg.locator("[data-dem-can-lam]:visible").innerText()).trim() === "3");
  const first = cards.first();
  check("thẻ đầu là bài quá hạn: 'Quá hạn từ …' và viền trái màu quá hạn", (await first.getAttribute("data-tone")) === "qua-han" && /Quá hạn từ (thứ|Chủ)/.test(await first.innerText()));
  const due = await cards.nth(1).locator("[data-can-lam-han]").innerText();
  check("hạn ghi đủ thứ, ngày, giờ + 'còn N ngày' (vd 'Hạn thứ Ba 24/11, 21:00 · còn 3 ngày')", /^Hạn (thứ \S+|Chủ nhật) \d\d\/\d\d, \d\d:\d\d · còn \d+ ngày$/.test(due.trim()), due);
  check("thẻ kiểm tra: 'Mở lúc …' và nút phụ, không nút Nộp", /Mở lúc \d\d:\d\d/.test(await cards.nth(2).innerText()) && (await cards.nth(2).getAttribute("data-can-lam-the")) === "kiem-tra");
  check("câu phụ 'Chụp ảnh vở hoặc chọn tệp PDF' + ô chọn tệp nhận ảnh / camera / PDF", await first.getByText("Chụp ảnh vở hoặc chọn tệp PDF").isVisible() && (await first.locator("input[type=file]").getAttribute("accept")) === "image/*,application/pdf");
  const nb = await first.getByRole("button", { name: /^Nộp bài/ }).boundingBox();
  const cb = await first.boundingBox();
  check("nút 'Nộp bài' cao ≥ 48px, rộng gần hết thẻ", !!nb && !!cb && nb.height >= 48 && nb.width >= cb.width - 48, { nb, cb });
  check("đúng MỘT nút chính trên màn (bài hạn gần nhất), dock không tính", (await primaries(pg)).length === 1, await primaries(pg));
  const rows = pg.locator("[data-lop-gan-day] [data-kin-list-row]:visible");
  const rowH = await rows.evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().height)));
  check("Buổi gần đây: hàng mảnh ≥ 56px, tối đa 5 hàng", rowH.length >= 4 && rowH.length <= 5 && rowH.every(h => h >= 56), rowH);
  const firstRow = await pg.locator("[data-lop-gan-day] [data-lesson-row]:visible").first().innerText(); // bản ghi tạo "hôm nay" nên đứng trên mọi bài
  check("bài đầu = bài mới nhất ('Hệ phương trình bậc nhất'), dòng phụ có ngày, 'Video 42 phút', '2 tài liệu', 'Bài tập'", /Hệ phương trình bậc nhất/.test(firstRow) && /Video 42 phút/.test(firstRow) && /2 tài liệu/.test(firstRow) && /Bài tập/.test(firstRow) && /(Thứ \S+|Chủ nhật) \d\d\/\d\d/.test(firstRow), firstRow);
  check("bài đã chấm ghi 'Đã chấm 8,5/10' ngay trong hàng", /Đã chấm 8,5\/10/.test(await pg.locator("[data-lesson-row='l-3']:visible").innerText()));
  check("bản ghi buổi học nằm trong Buổi gần đây", await pg.locator("[data-lop-gan-day] [data-recording-row-ngan]:visible").count() === 1);
  check("bài nháp không hiện; hàng là liên kết thật tới trang bài", await pg.getByText("Bài nháp không được thấy").count() === 0 && (await pg.locator("[data-lesson-row='l-4'] a").getAttribute("href")) === "/student/bai-giang/l-4");
  check("liên kết 'Tất cả bài học (4)'", (await pg.locator("[data-tat-ca-bai]:visible").innerText()).includes("Tất cả bài học (4)"));
  check("mọi trạng thái có chữ + hình", (await statusesOk(pg)).every(s => s.t && s.svg), await statusesOk(pg));
  await pg.locator("[data-tb-trong]:visible").waitFor({ timeout: 30000 }).catch(() => {});
  check("lớp chưa có thông báo: chỉ MỘT dòng chữ mờ, không tiêu đề + khối trống; không link lẻ 'Xem điểm của lớp này'", await pg.locator("[data-tb-trong]:visible").count() === 1 && await pg.getByRole("heading", { name: "Thông báo của lớp" }).count() === 0 && await pg.locator("[data-lop-diem]").count() === 0);
  check("390: không tràn ngang", await overflowX(pg) <= 0, await overflowX(pg));
  const ins = await pg.evaluate(() => [...document.querySelectorAll("main a, main button")].filter(e => e.getBoundingClientRect().width > 0 && !e.closest("[data-nop-dock]") && !e.closest("[data-kin-skip]")).map(e => ({ t: (e as HTMLElement).innerText.trim().slice(0, 30), h: Math.round(e.getBoundingClientRect().height) })).filter(x => x.h < 44));
  check("mọi nút / liên kết trong trang cao ≥ 44px", ins.length === 0, ins);

  section("Dock nộp bài ghim đáy");
  check("chưa cuộn: dock ẩn (inert)", (await pg.locator("[data-nop-dock]").getAttribute("data-nop-dock")) === "an");
  await snap(pg, "hs-trang-lop-390");
  await pg.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await pg.waitForFunction(() => document.querySelector("[data-nop-dock]")?.getAttribute("data-nop-dock") === "hien", null, { timeout: 10000 }).catch(() => {});
  const dock = pg.locator("[data-nop-dock]");
  check("cuộn qua thẻ: dock hiện, ghi tên bài hạn gần nhất", (await dock.getAttribute("data-nop-dock")) === "hien" && /Nộp Bài tập buổi 4/.test(await dock.innerText()));
  const geo = await pg.evaluate(`(() => {
    const d = document.querySelector("[data-nop-dock] > div").getBoundingClientRect(), bar = [...document.querySelectorAll("nav")].find(n => n.getBoundingClientRect().top > innerHeight - 80 && n.getBoundingClientRect().height > 0).getBoundingClientRect();
    const last = [...document.querySelectorAll("main a, main button, main p, main li")].filter(e => !e.closest("[data-nop-dock]") && e.getBoundingClientRect().height > 0).map(e => e.getBoundingClientRect().bottom);
    return { gap: Math.round(bar.top - d.bottom), lastBottom: Math.round(Math.max(...last)), dockTop: Math.round(d.top), barH: Math.round(bar.height), btn: Math.round(document.querySelector("[data-nop-dock] button").getBoundingClientRect().height) };
  })()`) as { gap: number; lastBottom: number; dockTop: number; barH: number; btn: number };
  check("dock cách thanh dưới ≥ 12px, không che hàng cuối (trang chừa padding), nút ≥ 48px", geo.gap >= 12 && geo.lastBottom <= geo.dockTop && geo.btn >= 48, geo);
  check("thanh dưới cao 64px", geo.barH === 64, geo);
  await snap(pg, "hs-trang-lop-390-dock");
  await pg.evaluate(() => window.scrollTo(0, 0));
  await pg.waitForFunction(() => document.querySelector("[data-nop-dock]")?.getAttribute("data-nop-dock") === "an", null, { timeout: 10000 }).catch(() => {});
  check("cuộn lại lên: dock ẩn", (await dock.getAttribute("data-nop-dock")) === "an");

  section("Thanh dưới điện thoại (§3.4)");
  const bar = pg.getByRole("navigation", { name: RAIL });
  const cells = await bar.evaluate(n => [...n.querySelectorAll("a, button")].filter(e => (e as HTMLElement).offsetParent).map(e => ({ t: (e.querySelector(".kin-rail-lab") as HTMLElement)?.innerText.trim(), cur: e.getAttribute("aria-current"), h: Math.round(e.getBoundingClientRect().height) })));
  const want = ["Cần làm", "Lớp", ...(featureOn("LICH") ? ["Lịch"] : []), "Điểm"];
  check(`thanh dưới: ${want.join(" · ")}, mỗi ô ≥ 44px`, JSON.stringify(cells.map(c => c.t)) === JSON.stringify(want) && cells.every(c => c.h >= 44), cells);
  check("trang lớp: 'Lớp' mang aria-current=page", cells.find(c => c.t === "Lớp")?.cur === "page" && cells.filter(c => c.cur === "page").length === 1, cells);
  const look = await bar.evaluate(n => [...n.querySelectorAll("a, button")].filter(e => (e as HTMLElement).offsetParent).map(e => ({ cur: e.getAttribute("aria-current"), bg: getComputedStyle(e).backgroundColor, fs: parseFloat(getComputedStyle(e.querySelector(".kin-rail-lab")!).fontSize) })));
  check("chỉ mục đang chọn có viên nền (mục khác trong suốt), nhãn ≥ 13px", look.filter(x => x.cur !== "page").every(x => x.bg === "rgba(0, 0, 0, 0)") && look.every(x => x.fs >= 13), look);
  const badge = bar.locator(".kin-badge-dem");
  const before = Number((await badge.innerText()).trim());
  check("badge 'Cần làm' có số + nhãn chữ", before >= 1 && /việc cần xử lý/.test((await badge.getAttribute("aria-label")) ?? ""), before);
  check("badge màu navy (đếm việc, không phải lỗi)", await badge.evaluate(e => getComputedStyle(e).backgroundColor === getComputedStyle(document.documentElement).getPropertyValue("--kin-nhan-nen").trim() || getComputedStyle(e).backgroundColor === "rgb(30, 58, 138)"), await badge.evaluate(e => getComputedStyle(e).backgroundColor));
  const acc = pg.getByRole("button", { name: /^Tài khoản của Minh Anh/ });
  check("nút tài khoản ở đầu trang: tên truy cập chứa đúng chữ hiển thị (WCAG 2.5.3)", (await acc.innerText()).trim().length > 0 && ((await acc.getAttribute("aria-label")) ?? "").includes((await acc.innerText()).trim()));

  section("Phản hồi sau khi nộp (§3.9)");
  await prisma.assignmentSubmission.create({ data: { assignmentId: "bt-4", userId: S.id, fileUrl: "/u/y.pdf" } });
  await pg.goto(`${BASE}/student/hoc-tap?course=${A.id}&nop=ok&bt=bt-4`, { waitUntil: "networkidle", timeout: 120000 });
  await pg.locator("[data-nop-xong]:visible").waitFor({ timeout: 60000 });
  check("thông báo role=status 'Đã nộp Bài tập buổi 4'", (await pg.locator("[role=status][data-nop-xong]:visible").innerText()).startsWith("Đã nộp Bài tập buổi 4"));
  const sentCard = pg.locator("[data-can-lam-the='da-nop']:visible");
  check("thẻ đổi thành 'Đã nộp lúc …' + Chờ chấm (hình nửa tô)", await sentCard.count() === 1 && /Đã nộp/.test(await sentCard.innerText()) && await sentCard.locator("[data-kin-hinh='nua']").count() === 1);
  check("bài vừa nộp rời Cần làm (còn 2 thẻ), dock không hiện", await pg.locator("[data-lop-can-lam] [data-can-lam-the]:not([data-can-lam-the='da-nop']):visible").count() === 2 && await pg.locator("[data-nop-dock]").count() === 0);
  await pg.locator(".kin-badge-dem").first().waitFor({ timeout: 5000 }).catch(() => {});
  const after = Number((await bar.locator(".kin-badge-dem").innerText().catch(() => "0")).trim());
  check("badge 'Cần làm' giảm đi một", after === before - 1, { before, after });

  section("Tất cả bài học (khung 4)");
  await pg.goto(`${BASE}/student/hoc-tap?course=${A.id}`, { waitUntil: "networkidle", timeout: 120000 });
  await pg.locator("[data-tat-ca-bai]:visible").click();
  await pg.getByRole("heading", { level: 1, name: "Tất cả bài học" }).waitFor({ timeout: 60000 });
  check("có lối về lớp, dòng '4 bài, mới nhất ở trên'", (await pg.locator("[data-ve-lop]:visible").innerText()).includes("Toán 9 · Lớp thử A") && await pg.getByText("4 bài, mới nhất ở trên").isVisible());
  const chap = await pg.locator("[data-chuong]:visible h2").allInnerTexts();
  check("nhóm theo chương, chương mới nhất trên; KHÔNG hiện tầng Phần", JSON.stringify(chap) === JSON.stringify(["Chương 2 · Hệ phương trình", "Chương 1 · Căn bậc hai"]) && await pg.getByText("Phần 1").count() === 0, chap);
  const search = pg.getByRole("searchbox", { name: "Tìm bài học theo tên" });
  check("ô tìm có nhãn, chữ 16px trên điện thoại", await search.isVisible() && (await search.evaluate(e => getComputedStyle(e).fontSize)) === "16px");
  await search.fill("he phuong");
  check("gõ không dấu 'he phuong' ⇒ chỉ còn 'Hệ phương trình bậc nhất'", JSON.stringify(await pg.locator("[data-chuong]:visible [data-kin-list-title]").allInnerTexts()) === JSON.stringify(["Hệ phương trình bậc nhất"]));
  await search.fill("zzz");
  check("không khớp ⇒ câu báo (role=status)", /Không có bài nào/.test(await pg.locator("main [role=status]:visible").first().innerText()));
  await search.fill("");
  check("bản ghi các buổi học ở cuối màn (record tới được)", await pg.locator("[data-ban-ghi]:visible").getByText("Bản ghi buổi ôn tập").isVisible());
  check("390: không tràn ngang", await overflowX(pg) <= 0);
  await snap(pg, "hs-tat-ca-bai-390");

  section("Cần làm gom mọi lớp (khung 2)");
  await prisma.assignmentSubmission.deleteMany({ where: { assignmentId: "bt-4" } });
  await pg.goto(`${BASE}/student/viec-cua-toi`, { waitUntil: "networkidle", timeout: 120000 });
  await pg.getByRole("heading", { level: 1, name: "Cần làm" }).waitFor({ timeout: 60000 });
  await pg.locator("[data-can-lam-the]:visible").first().waitFor({ timeout: 60000 });
  const groups = await pg.locator("[data-can-lam-nhom]:visible").evaluateAll(els => els.map(e => e.getAttribute("data-can-lam-nhom")));
  check("nhóm theo hạn, Quá hạn đầu tiên", groups[0] === "qua-han" && groups.length >= 2, groups);
  check("'Quá hạn' kèm 'vẫn còn nhận bài'", /vẫn còn nhận bài/.test(await pg.locator("[data-can-lam-nhom='qua-han'] h2").innerText()));
  check("thẻ của cả hai lớp (Toán + Vật lý), mỗi thẻ ghi tên lớp", /Toán 9 · Lớp thử A/.test(await pg.locator("main").innerText()) && /Vật lý 9 · Lớp thử B/.test(await pg.locator("main").innerText()));
  const tomTat = (await pg.locator("[data-can-lam-tom-tat]:visible").innerText()).trim();
  check("dòng tóm tắt 'N việc ở 2 lớp, xếp theo hạn'", /^\d+ việc ở 2 lớp, xếp theo hạn$/.test(tomTat));
  await pg.locator(".kin-badge-dem").first().waitFor({ timeout: 5000 }).catch(() => {});
  const badgeNow = Number((await bar.locator(".kin-badge-dem").innerText().catch(() => "0")).trim());
  check("badge 'Cần làm' = đúng số 'N việc' của màn (kể cả bài hạn > 3 ngày và kiểm tra)", badgeNow === parseInt(tomTat, 10) && badgeNow === 4, { badgeNow, tomTat });
  check("'Đã nộp, chờ chấm': hàng 'Bài tập căn bậc hai' có Chờ chấm", /Chờ chấm/.test(await pg.locator("[data-cho-cham='bai-tap:bt-cho']:visible").innerText()));
  check("'Đề thi được giao' không lặp đề đã có thẻ ('Kiểm tra 15 phút · Chương 2'), hàng không có nút", await pg.locator("[data-de-thi-hang]").filter({ hasText: "Kiểm tra 15 phút" }).count() === 0 && await pg.locator("[data-de-thi-hang] button, [data-de-thi-hang] [data-kin-nut]").count() === 0);
  check("đúng MỘT nút chính (bài quá hạn)", (await primaries(pg)).length === 1, await primaries(pg));
  check("thanh dưới: 'Cần làm' mang aria-current", (await bar.getByRole("link", { name: /^Cần làm/ }).getAttribute("aria-current")) === "page");
  check("mọi trạng thái có chữ + hình; 390 không tràn", (await statusesOk(pg)).every(s => s.t && s.svg) && await overflowX(pg) <= 0);
  await snap(pg, "hs-can-lam-390");

  section("Điểm theo lớp (khung 3)");
  await pg.goto(`${BASE}/student/diem`, { waitUntil: "networkidle", timeout: 120000 });
  await pg.locator("[data-diem-lop]:visible").first().waitFor({ timeout: 60000 });
  const lopA = pg.locator(`[data-diem-lop='${A.id}']:visible`);
  check("nhóm lớp Toán: 'Trung bình 8,5/10' (chỉ tính bài đã chấm)", /Trung bình\s*8,5\s*\/10/.test(await lopA.locator("[data-trung-binh]").innerText()), await lopA.locator("[data-trung-binh]").innerText());
  const graded = lopA.locator("[data-ket-qua-hang='da-cham']");
  check("bài đã chấm: '8,5/10', dòng 2 'Chấm <thứ dd/mm>', cả hàng là link tới bài (chevron)", /8,5\s*\/10/.test(await graded.innerText()) && /Chấm (thứ \S+|Chủ nhật) \d\d\/\d\d/.test(await graded.innerText()) && (await graded.locator("a").getAttribute("href")) === "/student/bai-giang/l-3" && await graded.locator("svg").count() >= 1);
  check("bài chờ chấm: 'Nộp <thứ dd/mm>' + Chờ chấm", /Nộp (thứ \S+|Chủ nhật) \d\d\/\d\d/.test(await lopA.locator("[data-ket-qua-hang='cho-cham']").innerText()));
  check("bài CHƯA NỘP không liệt kê (có ở Cần làm, đúng trạng thái Quá hạn) — chỉ một dòng 'Còn 3 bài chưa nộp · Xem ở Cần làm'", await lopA.locator("[data-ket-qua-hang='chua-nop']").count() === 0 && !/Bài tập buổi 4/.test(await lopA.innerText()) && /Còn 3 bài chưa nộp/.test(await lopA.locator("[data-chua-nop]").innerText()) && (await lopA.locator("[data-chua-nop] a").getAttribute("href")) === "/student/viec-cua-toi");
  check("cùng lề với các màn khác: h1 cách mép trái 16px ở 390", Math.round((await pg.locator("main h1:visible").first().boundingBox())?.x ?? -1) === 16 + Math.round((await pg.locator("main").boundingBox())?.x ?? 0), { h1: await pg.locator("main h1:visible").first().boundingBox(), main: await pg.locator("main").boundingBox(), mains: await pg.locator("main").count() });
  const pending = await lopA.locator("[data-ket-qua-hang='cho-duyet']").innerText();
  check("'Chờ gia sư duyệt' có chữ + hình, KHÔNG hiện số 7", /Chờ gia sư duyệt/.test(pending) && !/\b7\b/.test(pending), pending);
  check("mọi trạng thái có chữ + hình; 390 không tràn", (await statusesOk(pg)).every(s => s.t && s.svg) && await overflowX(pg) <= 0);
  check("thanh dưới: 'Điểm' mang aria-current", (await bar.getByRole("link", { name: /^Điểm/ }).getAttribute("aria-current")) === "page");
  await snap(pg, "hs-diem-390");

  section("Link Zalo ?course=…&bai=… mở thẳng bài");
  await pg.goto(`${BASE}/student/hoc-tap?course=${A.id}&bai=l-4`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await pg.waitForURL(/\/student\/bai-giang\/l-4/, { timeout: 60000 });
  check("chuyển thẳng tới /student/bai-giang/l-4 (không qua trang chọn lớp)", new URL(pg.url()).pathname === "/student/bai-giang/l-4", pg.url());
  {
    const g = await (await ctxFor(null)).newPage();
    await g.goto(`${BASE}/student/hoc-tap?course=${A.id}&bai=l-4`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await g.waitForURL(/\/dang-nhap/, { timeout: 60000 });
    check("chưa đăng nhập: đi đăng nhập rồi quay lại ĐÚNG bài (không trang quảng cáo / Đăng ký)", /redirect=%2Fstudent%2F(bai-giang%2Fl-4|hoc-tap%3Fcourse%3D[^&]+%26bai%3Dl-4)/.test(g.url()), g.url());
  }

  section("Nộp thật trên trình duyệt: ảnh → PDF → tải lên → /nop (303), chọn lại bỏ tệp tải dở của lần trước");
  {
    // Tệp "ready" chưa gắn của lần tải trước bị lỗi giữa chừng (học sinh định bỏ): /nop KHÔNG được gắn nó vào bài.
    const stale = await prisma.submissionFile.create({ data: { kind: "student", assignmentId: "bt-5", studentUserId: S.id, ownerUserId: S.id, courseId: A.id, driver: "local", storageKey: `test/stale-${now}`, originalName: "cu-dinh-bo.pdf", ext: "pdf", mimeType: "application/pdf", sizeBytes: 10, status: "ready", readyAt: new Date(), expiresAt: new Date(now + 60 * D) } });
    const up = await open(`/student/hoc-tap?course=${A.id}`, 390);
    await up.locator("[data-nop-nhanh='bt-5']").waitFor({ timeout: 120000 });
    const img = await up.evaluate(() => { const c = document.createElement("canvas"); c.width = 600; c.height = 800; const x = c.getContext("2d")!; x.fillStyle = "white"; x.fillRect(0, 0, 600, 800); x.fillStyle = "black"; x.font = "40px sans-serif"; x.fillText("Bai lam", 60, 120); return c.toDataURL("image/png").split(",")[1]; });
    await Promise.all([
      up.waitForURL(/[?&]nop=ok&bt=bt-5/, { timeout: 120000 }),
      up.locator("[data-nop-nhanh='bt-5'] input[type=file]").setInputFiles({ name: "vo.png", mimeType: "image/png", buffer: Buffer.from(img, "base64") }),
    ]);
    await up.locator("[data-nop-xong]:visible").waitFor({ timeout: 60000 });
    check("chọn một ảnh ⇒ về trang lớp ?nop=ok&bt=bt-5, 'Đã nộp Bài tập buổi 5'", /Đã nộp Bài tập buổi 5/.test(await up.locator("[data-nop-xong]:visible").innerText()));
    const sub = await prisma.assignmentSubmission.findUnique({ where: { assignmentId_userId: { assignmentId: "bt-5", userId: S.id } }, select: { id: true, kind: true } });
    const att = sub ? await prisma.submissionFile.findMany({ where: { submissionId: sub.id, status: "ready" }, select: { id: true, ext: true } }) : [];
    check("bài nộp có đúng MỘT tệp PDF gắn (ảnh gộp thành PDF)", !!sub && att.length === 1 && att[0].ext === "pdf", { sub, att });
    const old = await prisma.submissionFile.findUnique({ where: { id: stale.id }, select: { status: true, submissionId: true } });
    check("tệp tải dở của lần trước KHÔNG bị gắn vào bài (đã gỡ: removed)", old?.status === "removed" && old.submissionId === null, old);
  }

  section("360px và 1280px");
  for (const [path, name] of [[`/student/hoc-tap?course=${A.id}`, "hs-trang-lop"], ["/student/viec-cua-toi", "hs-can-lam"], ["/student/diem", "hs-diem"], [`/student/hoc-tap?course=${A.id}&xem=bai-hoc`, "hs-tat-ca-bai"]] as const) {
    for (const w of [360, 1280]) {
      const p = await open(path, w);
      await p.locator("main h1:visible").first().waitFor({ timeout: 90000 });
      await p.waitForTimeout(800);
      check(`${w}px ${name}: không tràn ngang`, await overflowX(p) <= 0, await overflowX(p));
      if (w === 1280) await snap(p, `${name}-1280`);
    }
  }

  section("Không lỗi trình duyệt");
  check("không có pageerror", errors.length === 0, errors.slice(0, 3));
  await closeAll();
  await done();
})().catch(async e => { console.error("TEST CRASH", e); await closeAll().catch(() => {}); process.exit(1); });
