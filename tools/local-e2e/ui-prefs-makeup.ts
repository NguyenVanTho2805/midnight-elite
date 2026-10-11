import { mkUser, mkTutor, mkCourse, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, shot, ADMIN } from "./ui";
import { prisma } from "@/lib/prisma";

const MAIN = "http://localhost:3100";
const todayLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

(async () => {
  await wipe();
  const tutor = await mkTutor("Cô Lan");
  const A = await mkUser({ name: "Em An" }), B = await mkUser({ name: "Em Bình" });
  const course = await mkCourse(tutor.id, { name: "Toán 9" });
  for (const u of [A, B]) await prisma.enrollment.create({ data: { userId: u.id, courseId: course.id, status: "active" } });
  const abs = await prisma.classAbsence.create({ data: { courseId: course.id, scheduleId: "s", dateKey: "2026-09-20", startAt: new Date(), studentId: A.id, reportedBy: "parent", leadMinutes: 600, status: "excused_auto" } });
  const credit = await prisma.makeupCredit.create({ data: { studentId: A.id, courseId: course.id, absenceId: abs.id, expiresAt: new Date(Date.now() + 9 * 86400_000) } });
  await launch();

  section("Điểm danh: dùng buổi bù");
  const ctx = await ctxFor(tutor);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(String(e)));
  await page.goto(`${ADMIN}/admin/khoa-hoc/${course.id}/diem-danh`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Điểm danh" }).waitFor({ timeout: 90000 });
  await page.getByRole("button", { name: "Tạo buổi điểm danh" }).click();
  await page.getByText("Em An").waitFor({ timeout: 30000 });
  const rowA = page.locator("div.flex.items-center.gap-3", { hasText: "Em An" }).last();
  const rowB = page.locator("div.flex.items-center.gap-3", { hasText: "Em Bình" }).last();
  const tick = rowA.getByLabel(/Dùng 1 buổi bù cho buổi này/);
  check("Em An (đang giữ 1 buổi bù) có ô tick, kèm số buổi + hạn", await tick.count() === 1 && /đang giữ 1, gần nhất hết hạn/.test(await rowA.innerText()));
  check("Em Bình (không có buổi bù) không có ô tick", (await rowB.getByLabel(/Dùng 1 buổi bù/).count()) === 0);
  check("chưa chọn trạng thái: ô tick bị khoá, có chú thích", await tick.isDisabled() && /chỉ dùng khi học viên có mặt\/muộn/.test(await rowA.innerText()));
  await rowA.getByRole("button", { name: /^Vắng/ }).click();
  check("chọn Vắng: vẫn khoá", await tick.isDisabled());
  await rowA.getByRole("button", { name: /^Có mặt/ }).click();
  check("chọn Có mặt: ô tick mở", !(await tick.isDisabled()));
  await tick.check();
  await shot(page, "attendance-makeup");
  await page.getByRole("button", { name: "Lưu điểm danh" }).click();
  await page.getByText(/Đã lưu 1 học viên/).waitFor({ timeout: 15000 });
  await eventually("DB: buổi bù chuyển 'used' và gắn đúng buổi", async () => { const c = await prisma.makeupCredit.findUnique({ where: { id: credit.id } }); return c?.status === "used" && !!c.usedSessionId; });
  await eventually("tải lại: ô tick đang chọn, ghi '(đã dùng ở buổi này)'", async () => await tick.isChecked() && /đã dùng ở buổi này/.test(await rowA.innerText()));

  section("Đổi sang Vắng → buổi bù được trả lại");
  await rowA.getByRole("button", { name: /^Vắng/ }).click();
  await page.getByRole("button", { name: "Lưu điểm danh" }).click();
  await page.getByText(/Đã lưu 1 học viên/).waitFor({ timeout: 15000 });
  await eventually("DB: buổi bù active lại", async () => (await prisma.makeupCredit.findUnique({ where: { id: credit.id } }))?.status === "active");
  await eventually("giao diện: lại thấy 'đang giữ 1'", async () => /đang giữ 1/.test(await rowA.innerText()));

  section("Lịch học của lớp: link vào lớp");
  await page.goto(`${ADMIN}/admin/khoa-hoc/${course.id}?tab=lich-hoc`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "+ Thêm khung giờ" }).click();
  await page.getByLabel(/Link vào lớp/).fill("https://meet.google.com/xyz-abcd-efg");
  await page.getByRole("button", { name: "Lưu khung giờ" }).click();
  await page.getByRole("link", { name: "Link vào lớp" }).waitFor({ timeout: 15000 });
  check("lưu link, hiện 'Link vào lớp' trên khung giờ", (await prisma.classSchedule.findFirst({ where: { courseId: course.id } }))?.joinUrl === "https://meet.google.com/xyz-abcd-efg");
  await page.getByRole("button", { name: "+ Thêm khung giờ" }).click();
  await page.getByLabel(/Link vào lớp/).fill("javascript:alert(1)");
  await page.getByRole("button", { name: "Lưu khung giờ" }).click();
  await page.getByText(/Link vào lớp phải là địa chỉ http\(s\) hợp lệ|URL|link/i).first().waitFor({ timeout: 15000 }).catch(() => {});
  check("link không hợp lệ bị từ chối, không lưu", (await prisma.classSchedule.count({ where: { courseId: course.id } })) === 1);

  section("TK-167: chủ đề lưu theo tài khoản");
  const sctx = await ctxFor(A);
  const sp = await sctx.newPage();
  await sp.goto(`${MAIN}/cai-dat/chu-de`, { waitUntil: "networkidle" });
  await sp.getByRole("button", { name: "Mận" }).click();
  await eventually("DB: theme = man", async () => ((await prisma.user.findUnique({ where: { id: A.id }, select: { preferences: true } }))?.preferences as any)?.theme === "man");
  await sp.getByRole("button", { name: "Tối", exact: true }).click();
  await eventually("DB: mode = toi (không mất theme)", async () => { const p = (await prisma.user.findUnique({ where: { id: A.id }, select: { preferences: true } }))?.preferences as any; return p?.mode === "toi" && p?.theme === "man"; });
  const fresh = await ctxFor(A); // trình duyệt sạch = máy khác
  const fp = await fresh.newPage();
  await fp.goto(`${MAIN}/cai-dat/chu-de`, { waitUntil: "domcontentloaded" });
  await eventually("máy khác: chủ đề Mận + chế độ tối được áp từ tài khoản", async () => (await fp.locator("html").getAttribute("data-chu-de")) === "man" && (await fp.locator("html").getAttribute("data-che-do")) === "toi");
  await eventually("trang chọn chủ đề hiện đúng lựa chọn đã lưu", async () => (await fp.getByRole("button", { name: "Mận" }).getAttribute("aria-pressed")) === "true");
  const gctx = await ctxFor(null);
  const gp = await gctx.newPage();
  const prefReq: string[] = [];
  gp.on("request", r => { if (r.url().includes("/api/users/me/preferences")) prefReq.push(r.url()); });
  await gp.goto(`${MAIN}/`, { waitUntil: "networkidle" });
  check("khách: không gọi API tuỳ chọn, giữ chủ đề mặc định Navy", prefReq.length === 0 && (await gp.locator("html").getAttribute("data-chu-de")) === "navy", prefReq);

  check("không lỗi trang", errors.length === 0, errors.slice(0, 3));
  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
