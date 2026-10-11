import { mkUser, mkTutor, mkCourse, wipe, api, check, eventually, section, done } from "./h";
import { launch, ctxFor, shot } from "./ui";
import { prisma } from "@/lib/prisma";

const MAIN = "http://localhost:3100";

(async () => {
  await wipe();
  const tutor = await mkTutor("Cô Lan");
  const course = await mkCourse(tutor.id, { name: "Toán 9 Cô Lan" });
  const inv = await api("POST", `/api/courses/${course.id}/invites`, { as: tutor, body: { maxUses: 3 } });
  const code: string = inv.json.code;
  const stu = await mkUser({ name: "Em Học" });
  await launch();
  const ctx = await ctxFor(stu);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(String(e)));

  section("InviteCodeInput (FE-161) trên /student/nhap-ma-lop");
  await page.goto(`${MAIN}/student/nhap-ma-lop`, { waitUntil: "networkidle" });
  const box = page.getByLabel("Mã mời lớp");
  await box.waitFor({ timeout: 60000 });
  const join = page.getByRole("button", { name: "Tham gia lớp" });
  check("ban đầu nút Tham gia bị khoá", await join.isDisabled());

  await box.fill("ab");
  check("dưới 4 ký tự: hiện gợi ý", await page.getByText("Mã có ít nhất 4 ký tự.").isVisible());

  await box.fill("zz-zz yy99");
  check("tự lọc ký tự lạ + in hoa", (await box.inputValue()) === "ZZZZYY99");
  await page.getByText("Mã mời không tồn tại").waitFor({ timeout: 8000 });
  check("mã sai → thông báo lỗi cụ thể từ server", await page.getByText("Mã mời không tồn tại").isVisible());
  check("mã sai: nút vẫn khoá", await join.isDisabled());

  await box.fill(code.toLowerCase());
  await page.getByText("Mã hợp lệ").waitFor({ timeout: 8000 });
  check("mã đúng: hiện tên lớp + gia sư", await page.getByText("Toán 9 Cô Lan").isVisible() && await page.getByText("Gia sư: Cô Lan").isVisible());
  check("hiện số lượt còn lại 3/3", await page.getByText(/Còn 3 \/ 3 lượt/).isVisible());
  check("nút Tham gia mở", !(await join.isDisabled()));
  check("thông báo lỗi cũ đã biến mất", (await page.getByText("Mã mời không tồn tại").count()) === 0);

  section("Xoá bớt ký tự: bỏ thẻ xác nhận, không dùng kết quả cũ");
  await box.fill("AB");
  await eventually("thẻ hợp lệ biến mất", async () => (await page.getByText("Mã hợp lệ").count()) === 0);
  check("nút lại khoá", await join.isDisabled());

  section("Gõ nhanh đổi mã: kết quả mã cũ không đè mã mới");
  await box.fill("ZZZZYY99");
  await box.fill(code);
  await page.getByText("Mã hợp lệ").waitFor({ timeout: 8000 });
  await page.waitForTimeout(1200);
  check("cuối cùng vẫn là mã đúng (không bị lỗi mã sai ghi đè)", await page.getByText("Mã hợp lệ").isVisible() && (await page.getByText("Mã mời không tồn tại").count()) === 0);

  section("Prefill ?code= và tham gia");
  await page.goto(`${MAIN}/student/nhap-ma-lop?code=${code}`, { waitUntil: "networkidle" });
  await page.getByText("Mã hợp lệ").waitFor({ timeout: 15000 });
  check("?code= điền sẵn và kiểm tra luôn", (await page.getByLabel("Mã mời lớp").inputValue()) === code);
  await shot(page, "invite-input-ok");
  await page.getByRole("button", { name: "Tham gia lớp" }).click();
  await page.waitForURL(/\/student\/hoc-tap/, { timeout: 20000 });
  await eventually("DB: có Enrollment active", async () => (await prisma.enrollment.findUnique({ where: { userId_courseId: { userId: stu.id, courseId: course.id } } }))?.status === "active");

  check("không lỗi trang", errors.length === 0, errors.slice(0, 2));
  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
