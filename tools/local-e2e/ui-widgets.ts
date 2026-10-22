import { mkUser, mkTutor, mkCourse, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, shot } from "./ui";
import { prisma } from "@/lib/prisma";

const MAIN = process.env.BASE ?? "http://localhost:3100"; // NC2: cổng theo BASE để chạy song song nhiều máy chủ thử

(async () => {
  await wipe();
  const parent = await mkUser({ name: "Phụ Huynh An" });
  const child = await mkUser({ name: "Bé An" });
  const tutor = await mkTutor("Cô Lan");
  const course = await mkCourse(tutor.id, { name: "Toán 9 Cô Lan" });
  await prisma.enrollment.create({ data: { userId: child.id, courseId: course.id, status: "active" } });
  await prisma.thread.create({ data: { authorId: tutor.id, content: "Bài của lớp: chỉ lớp thấy", category: "kinh-nghiem", courseId: course.id } });
  await prisma.thread.create({ data: { authorId: tutor.id, content: "Bài chung: ai cũng thấy", category: "kinh-nghiem" } });
  await launch();

  section("FE-162: ParentLinkWidget trong student/ho-so (phụ huynh gửi yêu cầu)");
  const pctx = await ctxFor(parent);
  const pp = await pctx.newPage();
  const errors: string[] = [];
  pp.on("pageerror", e => errors.push(String(e)));
  pp.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  await pp.goto(`${MAIN}/student/ho-so`, { waitUntil: "networkidle" });
  await pp.getByRole("heading", { name: "Liên kết phụ huynh" }).waitFor({ timeout: 60000 });
  check("trống: 'Chưa gửi yêu cầu liên kết nào.'", await pp.getByText("Chưa gửi yêu cầu liên kết nào.").isVisible());
  await pp.getByRole("button", { name: "Gửi yêu cầu" }).click();
  await pp.getByText("Nhập email học viên cần liên kết").waitFor({ timeout: 5000 });
  check("email trống → toast lỗi của trang cha (onNotify)", true);
  await pp.getByLabel("Email tài khoản của con").fill("khong-ton-tai@test.local");
  await pp.getByRole("button", { name: "Gửi yêu cầu" }).click();
  await pp.getByText("Không tìm thấy tài khoản học viên với email này").waitFor({ timeout: 8000 });
  check("email lạ → hiện lỗi API", true);
  await pp.getByLabel("Email tài khoản của con").fill(child.email);
  await pp.getByRole("button", { name: "Gửi yêu cầu" }).click();
  await pp.getByText("Đã gửi yêu cầu liên kết, chờ học viên xác nhận").waitFor({ timeout: 8000 });
  await pp.getByText("Chờ xác nhận").first().waitFor({ timeout: 8000 });
  check("danh sách con hiện 'Chờ xác nhận' kèm email", await pp.getByText(child.email).isVisible());
  check("ô email được xoá sau khi gửi", (await pp.getByLabel("Email tài khoản của con").inputValue()) === "");
  await shot(pp, "widget-parent-pending");

  section("Học viên xác nhận / từ chối");
  const cctx = await ctxFor(child);
  const cp = await cctx.newPage();
  cp.on("pageerror", e => errors.push(String(e)));
  await cp.goto(`${MAIN}/student/ho-so`, { waitUntil: "networkidle" });
  await cp.getByText("Yêu cầu gửi tới bạn (với vai trò học viên)").waitFor({ timeout: 60000 });
  check("thấy tên phụ huynh + 2 nút", await cp.getByText("Phụ Huynh An").isVisible() && await cp.getByRole("button", { name: "Xác nhận", exact: true }).isVisible());
  await cp.getByRole("button", { name: "Xác nhận", exact: true }).click();
  await cp.getByText("Đã xác nhận liên kết phụ huynh").waitFor({ timeout: 8000 });
  await cp.getByText("Đã xác nhận", { exact: true }).waitFor({ timeout: 8000 });
  check("sau xác nhận: nút biến mất, hiện nhãn 'Đã xác nhận'", (await cp.getByRole("button", { name: "Từ chối" }).count()) === 0);
  await eventually("DB: verified", async () => (await prisma.parentLink.findFirst({ where: { studentId: child.id } }))?.status === "verified");
  await shot(cp, "widget-student-verified");

  section("FE-163: CommunityScopeSwitcher ở /cong-dong");
  const gctx = await ctxFor(null);
  const gp = await gctx.newPage();
  await gp.goto(`${MAIN}/cong-dong`, { waitUntil: "networkidle" });
  await gp.getByRole("heading", { name: "Cộng đồng" }).waitFor({ timeout: 60000 });
  check("khách: không có bộ chọn phạm vi", (await gp.locator("#community-scope").count()) === 0);

  const pp2 = await pctx.newPage();
  await pp2.goto(`${MAIN}/cong-dong`, { waitUntil: "networkidle" });
  await pp2.getByRole("heading", { name: "Cộng đồng" }).waitFor({ timeout: 60000 });
  await pp2.waitForTimeout(800);
  check("phụ huynh chưa có lớp: không có bộ chọn", (await pp2.locator("#community-scope").count()) === 0);

  const cp2 = await cctx.newPage();
  cp2.on("pageerror", e => errors.push(String(e)));
  await cp2.goto(`${MAIN}/cong-dong`, { waitUntil: "networkidle" });
  const sel = cp2.locator("#community-scope");
  await sel.waitFor({ timeout: 60000 });
  check("học viên có lớp: thấy bộ chọn, mặc định 'all'", (await sel.inputValue()) === "all");
  check("có lựa chọn 'Chỉ cộng đồng chung' và tên lớp", (await sel.locator("option").allInnerTexts()).some(t => t.includes("Toán 9 Cô Lan")));
  await cp2.getByText("Bài của lớp: chỉ lớp thấy").waitFor({ timeout: 15000 });
  check("'all' thấy cả bài lớp và bài chung", await cp2.getByText("Bài chung: ai cũng thấy").isVisible());
  await sel.selectOption("common");
  await eventually("URL có scope=common", () => cp2.url().includes("scope=common"));
  await cp2.getByText("Bài của lớp: chỉ lớp thấy").waitFor({ state: "detached", timeout: 15000 });
  check("'common' chỉ còn bài chung", await cp2.getByText("Bài chung: ai cũng thấy").isVisible());
  await sel.selectOption(course.id);
  await cp2.getByText("Bài của lớp: chỉ lớp thấy").waitFor({ timeout: 15000 });
  check("chọn lớp: chỉ bài của lớp", (await cp2.getByText("Bài chung: ai cũng thấy").count()) === 0);
  await shot(cp2, "widget-scope-class");
  await cp2.goto(`${MAIN}/cong-dong?scope=${course.id}`, { waitUntil: "networkidle" });
  await cp2.locator("#community-scope").waitFor({ timeout: 60000 });
  check("mở thẳng bằng ?scope= vẫn đúng lựa chọn", (await cp2.locator("#community-scope").inputValue()) === course.id);

  check("không lỗi trang", errors.filter(e => !/favicon|Failed to load resource/.test(e)).length === 0, errors.slice(0, 3));
  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
