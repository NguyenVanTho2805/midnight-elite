// Lối nối giữa "Lớp" (/student/hoc-tap?course=…) và "Thư viện" (/thu-vien) — 15/10/2026. Trình duyệt thật.
//   Lớp = đường học theo thứ tự; Thư viện = nơi tìm lại tệp / bản ghi / điểm. Hai nơi trỏ sang nhau để học viên khỏi hỏi "khác gì?".
import { BASE, mkTutor, mkUser, mkCourse, wipe, check, eventually, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { launch, ctxFor, closeAll } from "./ui";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");
  const S = await mkUser({ name: "Minh Anh" }), O = await mkUser({ name: "Người Ngoài" });
  const A = await mkCourse(T.id, { name: "Toán 9 nối lối" });
  await prisma.course.update({ where: { id: A.id }, data: { status: true } });
  const sec = await prisma.section.create({ data: { id: "sN", title: "Phần Đại số", order: 1, courseId: A.id } });
  const ch = await prisma.chapter.create({ data: { id: "cN", title: "Chương 1", order: 1, sectionId: sec.id } });
  await prisma.lesson.create({ data: { id: "lN1", code: "lN1", title: "Bài nối 1", type: "record", order: 1, chapterId: ch.id, isFree: false, isLocked: false, videoUrl: "https://youtu.be/x", documents: JSON.stringify([{ name: "TL-NOI.pdf", url: "https://files.example/n.pdf", type: "pdf" }]) } as any });
  await prisma.enrollment.create({ data: { userId: S.id, courseId: A.id, status: "active" } });

  await launch();
  const errors: string[] = [];
  const watch = (p: any) => { p.on("pageerror", (e: unknown) => errors.push(String(e))); p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|favicon|font/i.test(m.text())) errors.push(m.text()); }); };

  // SCL-G-HS (21/11/2026): trang lớp theo bản chốt bỏ lối "Tài liệu & bản ghi của lớp này →" sang /thu-vien (phần Thư viện đang ẩn theo cờ THU_VIEN);
  // tài liệu + bản ghi của lớp nay ở NGAY trong lớp: màn "Tất cả bài học" (hàng bài ghi số tài liệu, cuối màn là bản ghi). Chiều Thư viện → Lớp giữ nguyên.
  section("Lớp → tài liệu & bản ghi (màn Tất cả bài học)");
  const ctx = await ctxFor(S, { width: 1280, height: 800 });
  const p = await ctx.newPage(); watch(p);
  await p.goto(`${BASE}/student/hoc-tap?course=${A.id}`, { waitUntil: "networkidle", timeout: 120000 });
  const link = p.locator("[data-tat-ca-bai]:visible");
  await link.waitFor({ timeout: 90000 });
  check("học viên đã vào lớp thấy 'Tất cả bài học (1)', vùng chạm ≥ 44px", (await link.innerText()).includes("Tất cả bài học (1)") && ((await link.boundingBox())?.height ?? 0) >= 44);
  await link.click();
  await p.waitForURL(u => u.pathname === "/student/hoc-tap" && u.searchParams.get("course") === A.id && u.searchParams.get("xem") === "bai-hoc", { timeout: 60000 });
  await p.locator("[data-ban-ghi]:visible").waitFor({ timeout: 90000 });
  check("bấm vào → hàng 'Bài nối 1' ghi '1 tài liệu', có mục bản ghi của lớp", /1 tài liệu/.test(await p.locator("[data-lesson-row='lN1']:visible").innerText()) && await p.locator("[data-ban-ghi]:visible").isVisible());

  section("Thư viện → Lớp");
  await p.goto(`${BASE}/thu-vien#c-${A.id}`, { waitUntil: "networkidle", timeout: 120000 });
  const back = p.locator("[data-lop-link]");
  if (new URL(p.url()).pathname === "/thu-vien" && await back.count() > 0) {
    await p.getByRole("heading", { name: "Toán 9 nối lối" }).waitFor({ timeout: 90000 });
    check("Thư viện: thấy khối của lớp với tài liệu của bài", await p.getByText("TL-NOI.pdf").first().isVisible());
    check("khối của lớp có 'Học tiếp trong lớp →'", (await back.count()) === 1 && (await back.innerText()).includes("Học tiếp trong lớp"));
    check("trỏ đúng /student/hoc-tap?course=<lớp>", (await back.getAttribute("href")) === `/student/hoc-tap?course=${A.id}`);
    check("vùng chạm ≥ 44px", ((await back.boundingBox())?.height ?? 0) >= 44);
    await back.click();
    await p.waitForURL(u => u.pathname === "/student/hoc-tap" && u.searchParams.get("course") === A.id, { timeout: 60000 });
    await p.locator("[data-tat-ca-bai]:visible").waitFor({ timeout: 90000 });
    check("quay về trang Lớp của đúng khoá", await p.getByRole("heading", { level: 1, name: "Toán 9 nối lối" }).isVisible());
  } else check("Thư viện đang ẩn theo cờ THU_VIEN: /thu-vien không mở cho học sinh (bỏ qua chiều Thư viện → Lớp)", true, p.url());

  section("Người chưa vào lớp không thấy tài liệu / bản ghi của lớp");
  const octx = await ctxFor(O, { width: 1280, height: 800 });
  const op = await octx.newPage(); watch(op);
  await op.goto(`${BASE}/student/hoc-tap?course=${A.id}`, { waitUntil: "networkidle", timeout: 120000 });
  await eventually("trang Lớp của người chưa vào lớp đã tải xong (có nút 'Xem lớp học')", async () => (await op.getByText("Xem lớp học").count()) > 0, 90000);
  check("không còn nút 'Mua khóa học ngay' (quyết định D01: không có bước mua)", (await op.getByText("Mua khóa học ngay").count()) === 0);
  check("KHÔNG có lối Thư viện, không hàng bài là link (chưa có quyền học)", (await op.locator("[data-thu-vien-link]").count()) === 0 && (await op.locator("[data-lesson-row] a").count()) === 0);
  await op.goto(`${BASE}/student/hoc-tap?course=${A.id}&xem=bai-hoc`, { waitUntil: "networkidle", timeout: 120000 });
  await op.getByRole("heading", { level: 1, name: "Tất cả bài học" }).waitFor({ timeout: 90000 });
  check("màn Tất cả bài học của người chưa vào lớp: KHÔNG có mục bản ghi", (await op.locator("[data-ban-ghi]").count()) === 0);

  check("không có lỗi trang / console", errors.length === 0, errors.slice(0, 3));
  await closeAll();
  await done();
})().catch(async e => { console.error("TEST CRASH", e); await closeAll(); process.exit(1); });
