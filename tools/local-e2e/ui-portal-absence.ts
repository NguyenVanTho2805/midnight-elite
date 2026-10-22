import { mkUser, mkTutor, mkCourse, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, shot } from "./ui";
import { prisma } from "@/lib/prisma";
import { vnDateKeyOf, vnMinutesOfDay, dayOfWeekOfKey, hmOf } from "@/lib/classSessions";

const MAIN = process.env.BASE ?? "http://localhost:3100"; // NC2: cổng theo BASE để chạy song song nhiều máy chủ thử
const RUN = Date.now().toString(16).padStart(16, "0").slice(-16);
const tok = (n: number) => (RUN + n.toString(16).padStart(16, "0")).slice(-32);

async function slot(courseId: string, min: number) {
  const t = new Date(Date.now() + min * 60_000);
  const dateKey = vnDateKeyOf(t), m = vnMinutesOfDay(t);
  const sched = await prisma.classSchedule.create({ data: { courseId, dayOfWeek: dayOfWeekOfKey(dateKey), startTime: hmOf(m), endTime: hmOf(Math.min(m + 60, 1439)) } });
  return { sched, dateKey, m };
}

(async () => {
  await wipe();
  const tutor = await mkTutor("Cô Lan");
  const stu = await mkUser({ name: "Bé An" });
  const parent = await mkUser({ name: "Chị Hoa" });
  const c1 = await mkCourse(tutor.id, { name: "Toán 9" });
  const c2 = await mkCourse(tutor.id, { name: "Văn 9" });
  for (const c of [c1, c2]) await prisma.enrollment.create({ data: { userId: stu.id, courseId: c.id, status: "active" } });
  const T = tok(0xa1);
  await prisma.parentLink.create({ data: { parentId: parent.id, studentId: stu.id, status: "verified", verifiedAt: new Date(), portalToken: T } });
  const far = await slot(c1.id, 300), near = await slot(c2.id, 50);
  await launch();
  const ctx = await ctxFor(null); // phụ huynh không đăng nhập
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });

  section("Sổ của con: buổi sắp tới");
  await page.goto(`${MAIN}/so-cua-con/${T}`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Buổi học sắp tới" }).waitFor({ timeout: 60000 });
  check("báo 'Con chưa có buổi bù nào'", await page.getByText("Con chưa có buổi bù nào.").isVisible());
  check("liệt kê buổi 14 ngày tới của cả hai lớp, mỗi buổi có nút Báo nghỉ", await page.getByRole("button", { name: "Báo nghỉ" }).count() >= 2 && await page.getByText("Toán 9").first().isVisible() && await page.getByText("Văn 9").first().isVisible());
  await shot(page, "portal-upcoming");

  section("Báo nghỉ trước ≥ 2 giờ: giữ buổi bù ngay");
  const farItem = page.locator("li", { hasText: "Toán 9" }).first();
  await farItem.getByRole("button", { name: "Báo nghỉ" }).click();
  check("giải thích rõ: báo trước hạn nên được giữ buổi bù, không tính phí", await farItem.getByText(/giữ 1 buổi bù, không tính phí/).isVisible());
  check("có ô lý do không bắt buộc", await farItem.getByLabel("Lý do (không bắt buộc)").isVisible());
  await farItem.getByRole("button", { name: "Không nghỉ nữa" }).click();
  check("'Không nghỉ nữa': đóng lại, chưa ghi gì", (await prisma.classAbsence.count()) === 0 && await farItem.getByRole("button", { name: "Báo nghỉ" }).isVisible());
  await farItem.getByRole("button", { name: "Báo nghỉ" }).click();
  await farItem.getByLabel("Lý do (không bắt buộc)").fill("Con đi khám");
  await farItem.getByRole("button", { name: "Xác nhận báo nghỉ" }).click();
  await page.getByText(/Buổi này không tính phí và con được giữ 1 buổi bù/).waitFor({ timeout: 15000 });
  check("hiện xác nhận + trạng thái 'con được giữ 1 buổi bù'", await farItem.getByText("Đã báo nghỉ — con được giữ 1 buổi bù").isVisible());
  check("nút Báo nghỉ của buổi đó biến mất", (await farItem.getByRole("button", { name: "Báo nghỉ" }).count()) === 0);
  check("số buổi bù đang giữ cập nhật: 1 buổi, kèm ngày hết hạn", await page.getByText(/Con đang giữ/).isVisible() && /1 buổi bù/.test(await page.getByLabel("Buổi bù đang giữ").innerText()) && /hết hạn ngày \d\d\/\d\d/.test(await page.getByLabel("Buổi bù đang giữ").innerText()));
  await eventually("DB: excused_auto + buổi bù + điểm danh Có phép + lý do", async () => {
    const a = await prisma.classAbsence.findFirst({ where: { scheduleId: far.sched.id } });
    return a?.status === "excused_auto" && a.reason === "Con đi khám" && a.reportedBy === "parent" && (await prisma.makeupCredit.count({ where: { absenceId: a.id } })) === 1;
  });

  section("Báo nghỉ dưới 2 giờ: chờ gia sư");
  const nearItem = page.locator("li", { hasText: "Văn 9" }).first();
  await nearItem.getByRole("button", { name: "Báo nghỉ" }).click();
  check("giải thích: dưới 2 giờ, gia sư sẽ quyết định", await nearItem.getByText(/Còn dưới 2 giờ nữa là tới buổi học/).isVisible());
  await nearItem.getByRole("button", { name: "Xác nhận báo nghỉ" }).click();
  await page.getByText(/Vì còn dưới 2 giờ nữa là tới buổi học, gia sư sẽ xem và nhắn lại/).waitFor({ timeout: 15000 });
  check("trạng thái 'chờ gia sư xác nhận', số buổi bù vẫn 1", await nearItem.getByText("Đã báo nghỉ — chờ gia sư xác nhận").isVisible() && /1 buổi bù/.test(await page.getByLabel("Buổi bù đang giữ").innerText()));
  await shot(page, "portal-after");

  section("Gia sư xử lý → phụ huynh thấy kết quả khi tải lại");
  const abs = await prisma.classAbsence.findFirst({ where: { scheduleId: near.sched.id } });
  check("DB: pending", abs?.status === "pending");
  const tctx = await ctxFor(tutor);
  const tp = await tctx.newPage();
  const res = await tp.request.patch(`${MAIN}/api/tutor/absences/${abs!.id}`, { data: { action: "free_makeup" }, headers: { "content-type": "application/json" } });
  check("gia sư bấm 'Không tính phí, giữ 1 buổi bù' → 200", res.status() === 200);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Buổi học sắp tới" }).waitFor();
  check("phụ huynh thấy 'không tính phí, con được giữ 1 buổi bù'", await page.getByText("Đã báo nghỉ — không tính phí, con được giữ 1 buổi bù").isVisible());
  check("số buổi bù = 2, hai bên cùng một con số", /2 buổi bù/.test(await page.getByLabel("Buổi bù đang giữ").innerText()));

  section("Điện thoại");
  const mctx = await ctxFor(null, { width: 390, height: 800 });
  const mp = await mctx.newPage();
  await mp.goto(`${MAIN}/so-cua-con/${T}`, { waitUntil: "networkidle" });
  await mp.getByRole("heading", { name: "Buổi học sắp tới" }).waitFor({ timeout: 60000 });
  check("không tràn ngang", await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  check("nút Báo nghỉ đủ 44px", await mp.getByRole("button", { name: "Báo nghỉ" }).evaluateAll(els => els.length === 0 || els.every(e => e.getBoundingClientRect().height >= 44)));

  check("không lỗi trang", errors.length === 0, errors.slice(0, 3));
  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
