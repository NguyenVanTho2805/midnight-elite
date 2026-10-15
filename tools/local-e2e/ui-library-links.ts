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

  section("Lớp → Thư viện");
  const ctx = await ctxFor(S, { width: 1280, height: 800 });
  const p = await ctx.newPage(); watch(p);
  await p.goto(`${BASE}/student/hoc-tap?course=${A.id}`, { waitUntil: "networkidle", timeout: 120000 });
  const link = p.locator("[data-thu-vien-link]");
  await link.waitFor({ timeout: 90000 });
  check("học viên đã vào lớp thấy 'Tài liệu & bản ghi của lớp này →'", (await link.innerText()).includes("Tài liệu") && (await link.innerText()).includes("bản ghi"));
  check("trỏ đúng khối của lớp: /thu-vien#c-<lớp>", (await link.getAttribute("href")) === `/thu-vien#c-${A.id}`);
  check("vùng chạm ≥ 44px", ((await link.boundingBox())?.height ?? 0) >= 44);
  await link.click();
  await p.waitForURL(u => u.pathname === "/thu-vien" && u.hash === `#c-${A.id}`, { timeout: 60000 });
  await p.getByRole("heading", { name: "Toán 9 nối lối" }).waitFor({ timeout: 90000 });
  check("bấm vào → mở Thư viện, thấy khối của lớp với tài liệu của bài", await p.getByText("TL-NOI.pdf").first().isVisible());

  section("Thư viện → Lớp");
  const back = p.locator("[data-lop-link]");
  check("khối của lớp có 'Học tiếp trong lớp →'", (await back.count()) === 1 && (await back.innerText()).includes("Học tiếp trong lớp"));
  check("trỏ đúng /student/hoc-tap?course=<lớp>", (await back.getAttribute("href")) === `/student/hoc-tap?course=${A.id}`);
  check("vùng chạm ≥ 44px", ((await back.boundingBox())?.height ?? 0) >= 44);
  await back.click();
  await p.waitForURL(u => u.pathname === "/student/hoc-tap" && u.searchParams.get("course") === A.id, { timeout: 60000 });
  await p.locator("[data-thu-vien-link]").waitFor({ timeout: 90000 });
  check("quay về trang Lớp của đúng khoá (lại thấy lối sang Thư viện)", await p.locator("[data-thu-vien-link]").isVisible());

  section("Người chưa vào lớp không thấy lối này");
  const octx = await ctxFor(O, { width: 1280, height: 800 });
  const op = await octx.newPage(); watch(op);
  await op.goto(`${BASE}/student/hoc-tap?course=${A.id}`, { waitUntil: "networkidle", timeout: 120000 });
  await eventually("trang Lớp của người chưa đăng ký đã tải xong (có nút 'Mua khóa học ngay')", async () => (await op.getByText("Mua khóa học ngay").count()) > 0, 90000);
  check("KHÔNG có 'Tài liệu & bản ghi của lớp này' (chưa có quyền học)", (await op.locator("[data-thu-vien-link]").count()) === 0);

  check("không có lỗi trang / console", errors.length === 0, errors.slice(0, 3));
  await closeAll();
  await done();
})().catch(async e => { console.error("TEST CRASH", e); await closeAll(); process.exit(1); });
