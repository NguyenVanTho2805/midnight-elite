// Hai màn gia sư theo Figma: "Bài tập và kiểm tra" (299:113312, /lop-cua-toi/bai-tap) và "Thư viện" (299:113561, /thu-vien). Trình duyệt thật, 1280 và 390px.
// Dữ liệu dựng riêng: lớp Toán 9 (1 bài chờ chấm, 1 đang nhận bài, 1 đã hết hạn + chấm xong, 1 bài làm trực tiếp) + một đề thi sắp tới; thư viện có PDF, Google Docs, video.
import { BASE, mkTutor, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";

const D = 24 * 3_600_000;
const dmy = (t: number) => { const v = new Date(t + 7 * 3_600_000); return `${String(v.getUTCDate()).padStart(2, "0")}/${String(v.getUTCMonth() + 1).padStart(2, "0")}/${v.getUTCFullYear()}`; };

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), NEW = await mkTutor("Cô Mới");
  const S1 = await mkUser({ name: "Trần Gia Bảo" }), S2 = await mkUser({ name: "Lê Minh Anh" });
  const A = await mkCourse(T.id, { name: "Toán 9" }), B = await mkCourse(T.id, { name: "Văn 8" });
  await prisma.course.update({ where: { id: A.id }, data: { category: "Tốt nghiệp THPT" } });
  await prisma.course.update({ where: { id: B.id }, data: { category: "ĐGNL HSA" } });
  for (const u of [S1, S2]) await prisma.enrollment.create({ data: { userId: u.id, courseId: A.id, status: "active" } });
  const sec = await prisma.section.create({ data: { id: "bt-s", title: "Phần Đại số", order: 1, courseId: A.id } });
  const ch = await prisma.chapter.create({ data: { id: "bt-c", title: "Chương Hàm số", order: 1, sectionId: sec.id } });
  const secB = await prisma.section.create({ data: { id: "bt-sb", title: "Phần Làm văn", order: 1, courseId: B.id } });
  const chB = await prisma.chapter.create({ data: { id: "bt-cb", title: "Chương Nghị luận", order: 1, sectionId: secB.id } });
  const docs = JSON.stringify([{ name: "Chuyên đề phương trình bậc hai.pdf", url: "https://files.example/pt2.pdf", type: "pdf" }, { name: "Đồ thị hàm số", url: "https://docs.google.com/document/d/abc/edit", type: "doc" }]);
  const les = (id: string, title: string, order: number, o: Record<string, unknown>, chapterId = ch.id) =>
    prisma.lesson.create({ data: { id, code: id, title, type: "record", order, chapterId, ...o } as any });
  await les("bt-l1", "Hàm số", 1, { documents: docs, videoUrl: "https://youtu.be/x", duration: "45 phút" });
  await les("bt-l2", "Phương trình bậc hai", 2, {});
  await les("bt-l3", "Nghị luận xã hội", 1, { documents: JSON.stringify([{ name: "Đề cương Văn 8.pdf", url: "https://files.example/van.pdf", type: "pdf" }]) }, chB.id);
  const wait = await prisma.assignment.create({ data: { id: "bt-a1", lessonId: "bt-l1", title: "Hàm số", maxPoints: 10, dueDate: new Date(Date.now() + 2 * D), ownerId: T.id } });
  await prisma.assignment.create({ data: { id: "bt-a2", lessonId: "bt-l2", title: "Phương trình bậc hai", maxPoints: 10, dueDate: new Date(Date.now() + 1 * D), ownerId: T.id } });
  await prisma.assignment.create({ data: { id: "bt-a3", lessonId: "bt-l2", title: "Bài làm trực tiếp", maxPoints: 10, mode: "interactive", dueDate: new Date(Date.now() + 3 * D), ownerId: T.id } });
  const done1 = await prisma.assignment.create({ data: { id: "bt-a4", lessonId: "bt-l1", title: "Ôn tập chương 1", maxPoints: 10, dueDate: new Date(Date.now() - 4 * D), ownerId: T.id } });
  await prisma.assignment.create({ data: { id: "bt-a5", lessonId: "bt-l3", title: "Viết đoạn văn nghị luận", maxPoints: 10, dueDate: new Date(Date.now() + 4 * D), ownerId: T.id } });
  await prisma.assignmentSubmission.create({ data: { assignmentId: wait.id, userId: S1.id, fileUrl: "https://files.example/ham-so.jpg", fileName: "ham-so-gia-bao.jpg", submittedAt: new Date(Date.now() - 3_600_000) } });
  await prisma.assignmentSubmission.create({ data: { assignmentId: done1.id, userId: S2.id, fileUrl: "https://files.example/on-tap.jpg", fileName: "on-tap.jpg", score: 8, gradedAt: new Date() } });
  const stamp = Date.now();
  await prisma.exam.create({ data: { id: `bt-e-${stamp}`, code: `BT-${stamp.toString(36).toUpperCase().slice(-5)}`, title: "Kiểm tra 15 phút · Toán 9", category: "toan", date: dmy(Date.now() + 2 * D), time: "19:00", duration: "15", questions: 10, status: "upcoming", createdAt: new Date().toISOString(), ownerId: T.id, courseId: A.id } });

  await launch();
  const errors: string[] = [];
  const watch = (p: any) => { p.on("pageerror", (e: unknown) => errors.push(String(e))); p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); }); };
  const noOverflow = (p: any) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

  section("Bài tập và kiểm tra — máy tính 1280px");
  const dctx = await ctxFor(T, { width: 1280, height: 900 });
  const pg = await dctx.newPage(); watch(pg);
  await pg.goto(`${BASE}/lop-cua-toi/bai-tap`, { waitUntil: "networkidle", timeout: 120000 });
  await pg.getByRole("heading", { name: "Bài tập & kiểm tra", level: 1 }).waitFor({ timeout: 90000 });
  await pg.getByRole("list", { name: "Bài của Toán 9" }).waitFor({ timeout: 60000 });
  check("một h1; nút '+ Giao bài' → tab Chương và bài khi có nhiều lớp thì về danh sách Lớp", await pg.getByRole("heading", { level: 1 }).count() === 1 && (await pg.getByRole("link", { name: "+ Giao bài" }).getAttribute("href")) === "/lop-cua-toi/lop");
  check("có 'Quản lý đề thi' → /admin/thi-thu (chức năng cũ vẫn tới được)", (await pg.getByRole("link", { name: "Quản lý đề thi" }).getAttribute("href")) === "/admin/thi-thu");
  const tabTxt = (await pg.getByRole("tablist", { name: "Lọc theo tình trạng" }).innerText()).replace(/\s+/g, " ");
  check("tab: Tất cả · Chờ chấm · 1 · Đang giao · 4 · Đã hoàn tất (5 bài + 1 đề = 6 mục, chia không trùng nhau)", /Tất cả/.test(tabTxt) && /Chờ chấm · 1/.test(tabTxt) && /Đang giao · 4/.test(tabTxt) && /Đã hoàn tất/.test(tabTxt), tabTxt);
  const rows = pg.locator("[data-bai-tap-row]");
  check("gom theo lớp: Toán 9 và Văn 8; dòng bài chờ chấm có tên học sinh và nhãn chữ '1 bài chờ chấm'", (await rows.count()) === 6 && await pg.getByRole("heading", { name: "Văn 8" }).isVisible() && await rows.first().getByText("1 bài chờ chấm").isVisible() && (await rows.first().innerText()).includes("Trần Gia Bảo"), await rows.first().innerText());
  check("mở sẵn bài chờ chấm ở cột phải: tên file, nút 'Mở bài nộp gốc', điểm / 10, 'Gửi điểm & phản hồi'", await pg.getByText("ham-so-gia-bao.jpg").isVisible() && await pg.getByRole("link", { name: /Mở bài nộp gốc/ }).isVisible() && await pg.getByLabel("Điểm / 10").isVisible() && await pg.getByRole("button", { name: "Gửi điểm & phản hồi" }).isVisible());
  check("không tràn ngang", await noOverflow(pg));
  await shot(pg, "bai-tap-1280");

  await pg.getByLabel("Điểm / 10").fill("11");
  await pg.getByRole("button", { name: "Gửi điểm & phản hồi" }).click();
  await pg.getByText("Điểm phải từ 0 đến 10.").waitFor({ timeout: 20000 });
  check("điểm vượt tối đa → báo lỗi bằng chữ, không lưu", (await prisma.assignmentSubmission.findFirst({ where: { assignmentId: "bt-a1" } }))?.gradedAt == null);
  await pg.getByLabel("Điểm / 10").fill("8,5");
  await pg.getByLabel("Phản hồi cho học sinh").fill("Em trình bày đồ thị rõ hơn nhé.");
  await pg.getByRole("button", { name: "Gửi điểm & phản hồi" }).click();
  await pg.getByText("Đã gửi điểm và phản hồi cho học sinh.").waitFor({ timeout: 30000 });
  const sub = await prisma.assignmentSubmission.findFirst({ where: { assignmentId: "bt-a1" } });
  check("chấm xong: DB có điểm 8,5 + phản hồi + gradedAt", sub?.score === 8.5 && sub.comment === "Em trình bày đồ thị rõ hơn nhé." && !!sub.gradedAt, sub);
  await eventually2(pg, async () => /Chờ chấm · 0/.test((await pg.getByRole("tablist", { name: "Lọc theo tình trạng" }).innerText()).replace(/\s+/g, " ")), "danh sách tải lại: Chờ chấm · 0");
  check("sau khi danh sách tải lại, lời xác nhận vẫn còn và khung chấm không bị gỡ", await pg.getByText("Đã gửi điểm và phản hồi cho học sinh.").isVisible());

  await pg.getByRole("tab", { name: /Đã hoàn tất/ }).click();
  check("tab Đã hoàn tất: bài hết hạn đã chấm hiện, bài đang giao thì không", await pg.getByText("Ôn tập chương 1").isVisible() && await pg.getByText("Viết đoạn văn nghị luận").count() === 0);
  await pg.getByRole("tab", { name: "Tất cả" }).click();
  await pg.getByLabel("Lọc lớp").selectOption({ label: "Văn 8" });
  check("lọc lớp Văn 8: chỉ còn bài của Văn 8; '+ Giao bài' → tab Chương và bài của lớp đó", await pg.locator("[data-bai-tap-row]").count() === 1 && (await pg.getByRole("link", { name: "+ Giao bài" }).getAttribute("href")) === `/admin/khoa-hoc/${B.id}?tab=chuong-bai`);
  await pg.getByLabel("Lọc lớp").selectOption({ label: "Tất cả lớp" });
  await pg.locator("[data-bai-tap-row]", { hasText: "Bài làm trực tiếp" }).click();
  check("bài làm trực tiếp: chuyển sang chấm ở trang lớp (không chấm điểm tổng ở đây)", await pg.getByRole("link", { name: "Chấm ở trang lớp" }).isVisible());
  await pg.locator("[data-bai-tap-row]", { hasText: "Kiểm tra 15 phút" }).click();
  check("đề thi: có 'Đã lên lịch' và nút 'Mở đề thi' dẫn sang trang đề", await pg.getByRole("link", { name: "Mở đề thi" }).isVisible() && (await pg.getByRole("link", { name: "Mở đề thi" }).getAttribute("href"))!.startsWith("/lop-cua-toi/bai-tap/quiz/"));

  section("Bài tập và kiểm tra — điện thoại 390px");
  const mctx = await ctxFor(T, { width: 390, height: 800 });
  const mp = await mctx.newPage(); watch(mp);
  await mp.goto(`${BASE}/lop-cua-toi/bai-tap`, { waitUntil: "networkidle", timeout: 120000 });
  await mp.getByRole("list", { name: "Bài của Toán 9" }).waitFor({ timeout: 90000 });
  check("không tràn ngang ở 390px", await noOverflow(mp));
  check("nút 'Giao bài' cao ≥ 44px", ((await mp.getByRole("link", { name: "+ Giao bài" }).boundingBox())?.height ?? 0) >= 44);
  await shot(mp, "bai-tap-390");

  section("Bài tập: gia sư chưa có gì");
  const nctx = await ctxFor(NEW, { width: 1280, height: 800 });
  const np = await nctx.newPage(); watch(np);
  await np.goto(`${BASE}/lop-cua-toi/bai-tap`, { waitUntil: "networkidle", timeout: 120000 });
  await np.getByText("Chưa có bài tập hay đề thi nào").waitFor({ timeout: 90000 });
  check("rỗng có lời giải thích + lối 'Tạo lớp trước' (không ngõ cụt)", await np.getByRole("link", { name: "Tạo lớp trước" }).isVisible());

  section("Bài tập: lỗi tải có 'Thử lại'");
  const ectx = await ctxFor(T, { width: 1280, height: 800 });
  const ep = await ectx.newPage();
  await ep.route("**/api/tutor/bai-tap", r => r.fulfill({ status: 500, body: "{}" }));
  await ep.goto(`${BASE}/lop-cua-toi/bai-tap`, { waitUntil: "networkidle", timeout: 120000 });
  await ep.getByText("Không tải được danh sách bài.").waitFor({ timeout: 90000 });
  await ep.unroute("**/api/tutor/bai-tap");
  await ep.getByRole("button", { name: "Thử lại" }).click();
  await ep.getByRole("list", { name: "Bài của Toán 9" }).waitFor({ timeout: 60000 });
  check("bấm 'Thử lại' → danh sách hiện", true);

  section("Thư viện — máy tính 1280px");
  const lp = await dctx.newPage(); watch(lp);
  await lp.goto(`${BASE}/thu-vien`, { waitUntil: "networkidle", timeout: 120000 });
  await lp.getByRole("heading", { name: "Thư viện", level: 1 }).waitFor({ timeout: 90000 });
  const table = lp.getByRole("list", { name: "Tài liệu" });
  check("bảng liệt kê tài liệu và bản ghi của cả hai lớp (4 dòng: PDF, Docs, Video, PDF Văn)", await table.locator("li").count() === 4, await table.innerText());
  const t0 = (await table.innerText()).replace(/\s+/g, " ");
  check("mỗi dòng có tên, loại (PDF/DOC/Video) và lớp chia sẻ", /Chuyên đề phương trình bậc hai\.pdf/.test(t0) && /PDF/.test(t0) && /DOC/.test(t0) && /Video/.test(t0) && /Toán 9/.test(t0) && /Văn 8/.test(t0), t0);
  check("'Xem' mở trang xem trước; 'Sửa bài' tới tab Chương và bài của lớp", (await lp.getByRole("link", { name: "Xem" }).first().getAttribute("href"))!.startsWith("/xem-tai-lieu?url=") && await lp.locator(`a[href="/admin/khoa-hoc/${A.id}?tab=chuong-bai"]`, { hasText: "Sửa bài" }).count() >= 1);
  check("không có nút chết: không 'Tạo thư mục', không 'Chia sẻ tới lớp'", await lp.getByText("Tạo thư mục").count() === 0 && await lp.getByText("Chia sẻ tới lớp").count() === 0);
  await lp.getByRole("button", { name: /^Tốt nghiệp THPT/ }).click();
  check("chọn nhóm lớp 'Tốt nghiệp THPT': chỉ còn tài liệu lớp Toán 9", await table.locator("li").count() === 3 && !(await table.innerText()).includes("Văn 8"));
  await lp.getByRole("button", { name: /^Tất cả tài liệu/ }).click();
  await lp.getByLabel("Tìm tài liệu").fill("đề cương");
  check("tìm 'đề cương' → còn 1 dòng của Văn 8", await table.locator("li").count() === 1 && (await table.innerText()).includes("Văn 8"));
  await lp.getByLabel("Tìm tài liệu").fill("không có gì khớp");
  check("tìm không thấy → câu giải thích + nút 'Xoá bộ lọc'", await lp.getByText("Không có tài liệu nào khớp").isVisible() && await lp.getByRole("button", { name: "Xoá bộ lọc" }).isVisible());
  await lp.getByRole("button", { name: "Xoá bộ lọc" }).click();
  check("không tràn ngang", await noOverflow(lp));
  await shot(lp, "thu-vien-1280");

  section("Thư viện — điện thoại 390px và gia sư chưa có lớp");
  const ml = await mctx.newPage(); watch(ml);
  await ml.goto(`${BASE}/thu-vien`, { waitUntil: "networkidle", timeout: 120000 });
  await ml.getByRole("list", { name: "Tài liệu" }).waitFor({ timeout: 90000 });
  check("không tràn ngang ở 390px", await noOverflow(ml));
  check("lối 'Xem' cao ≥ 44px", ((await ml.getByRole("link", { name: "Xem" }).first().boundingBox())?.height ?? 0) >= 44);
  await shot(ml, "thu-vien-390");
  const nl = await nctx.newPage();
  await nl.goto(`${BASE}/thu-vien`, { waitUntil: "networkidle", timeout: 120000 });
  await nl.getByText("Bạn chưa mở lớp nào").waitFor({ timeout: 90000 });
  check("chưa có lớp → câu giải thích + lối 'Tạo lớp' (/admin/khoa-hoc?tao=1)", (await nl.getByRole("link", { name: "Tạo lớp", exact: true }).first().getAttribute("href")) === "/admin/khoa-hoc?tao=1");

  check("không có lỗi JS/console", errors.length === 0, errors);
  await closeAll();
  done();
})().catch(async e => { console.error(e); await closeAll(); process.exit(1); });

async function eventually2(_p: unknown, fn: () => Promise<boolean>, name: string) {
  const end = Date.now() + 15000; let ok = false;
  while (Date.now() < end && !ok) { ok = await fn(); if (!ok) await new Promise(r => setTimeout(r, 300)); }
  check(name, ok);
}
