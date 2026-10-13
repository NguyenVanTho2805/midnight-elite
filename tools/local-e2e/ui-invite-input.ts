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
  const join = page.getByRole("button", { name: "Vào lớp này" });
  check("ban đầu nút Tham gia bị khoá", await join.isDisabled());

  await box.fill("ab");
  check("dưới 4 ký tự: hiện gợi ý", await page.getByText("Mã có ít nhất 4 ký tự.").isVisible());

  await box.fill("zz-zz yy99");
  check("tự lọc ký tự lạ + in hoa", (await box.inputValue()) === "ZZZZYY99");
  await page.getByText("Mã mời không tồn tại").waitFor({ timeout: 8000 });
  check("mã sai → thông báo lỗi cụ thể từ server", await page.getByText("Mã mời không tồn tại").isVisible());
  check("mã sai: nút vẫn khoá", await join.isDisabled());

  await box.fill(code.toLowerCase());
  await page.getByText("Bạn sắp vào lớp").waitFor({ timeout: 8000 });
  check("mã đúng: hiện tên lớp + gia sư", await page.getByText("Toán 9 Cô Lan").isVisible() && await page.locator("dt", { hasText: "Gia sư" }).locator("xpath=following-sibling::dd[1]").innerText() === "Cô Lan");
  check("hiện số lượt còn lại 3/3", await page.getByText(/Còn 3 \/ 3 lượt/).isVisible());
  check("nút Tham gia mở", !(await join.isDisabled()));
  check("thông báo lỗi cũ đã biến mất", (await page.getByText("Mã mời không tồn tại").count()) === 0);

  section("Xoá bớt ký tự: bỏ thẻ xác nhận, không dùng kết quả cũ");
  await box.fill("AB");
  await eventually("thẻ xem trước biến mất", async () => (await page.getByText("Bạn sắp vào lớp").count()) === 0);
  check("nút lại khoá", await join.isDisabled());

  section("Gõ nhanh đổi mã: kết quả mã cũ không đè mã mới");
  await box.fill("ZZZZYY99");
  await box.fill(code);
  await page.getByText("Bạn sắp vào lớp").waitFor({ timeout: 8000 });
  await page.waitForTimeout(1200);
  check("cuối cùng vẫn là mã đúng (không bị lỗi mã sai ghi đè)", await page.getByText("Bạn sắp vào lớp").isVisible() && (await page.getByText("Mã mời không tồn tại").count()) === 0);

  section("Theo Figma 32:54: xem trước đủ, đồng ý ba điều, hai nút");
  await box.fill(code);
  await page.getByText("Bạn sắp vào lớp").waitFor({ timeout: 8000 });
  const rows = await page.locator("dl > div").evaluateAll(els => els.map(e => [e.querySelector("dt")!.textContent, e.querySelector("dd")!.textContent]));
  check("thẻ xem trước có đúng các dòng: Gia sư · Lịch · Học phí · Đã học", rows.map(r => r[0]).join("|") === "Gia sư|Lịch|Học phí|Đã học", rows);
  check("'Đã học: Chưa học buổi nào' (lớp mới) và 'Lịch' nói rõ chưa có lịch cố định", rows[3][1] === "Chưa học buổi nào" && rows[1][1] === "Gia sư chưa đặt lịch cố định", rows);
  check("học phí hiện ngay trước khi bấm vào lớp: 70.000đ một buổi khi học 1 môn · tính theo tháng", rows[2][1] === "70.000đ một buổi khi học 1 môn · tính theo tháng", rows[2]);
  check("khung 'Vào lớp là đồng ý ba điều' + câu KiN không giữ tiền", await page.getByText("Vào lớp là đồng ý ba điều").isVisible() && await page.getByText(/KiN không giữ tiền, gia sư thu trực tiếp/).isVisible());
  check("chân trang 'Xem trước rồi mới vào' + lý do (gõ nhầm một ký tự)", await page.getByText("Xem trước rồi mới vào").isVisible() && await page.getByText(/gõ nhầm một ký tự là vào nhầm lớp người khác/).isVisible());
  const notMine = page.getByRole("button", { name: "Không phải lớp của tôi" });
  const hs = [await join.boundingBox(), await notMine.boundingBox()].map(b => Math.round(b?.height ?? 0));
  check("hai nút cao ≥ 44px, rộng hết khung", hs.every(h => h >= 44) && Math.round((await join.boundingBox())!.width) === Math.round((await notMine.boundingBox())!.width), hs);
  check("không có vòng xoay (khung xương, không spinner)", await page.locator(".animate-spin").count() === 0);
  await shot(page, "invite-figma-preview");
  await notMine.click();
  check("'Không phải lớp của tôi' → xoá mã, ẩn thẻ xem trước, ô nhập được focus lại", (await box.inputValue()) === "" && (await page.getByText("Bạn sắp vào lớp").count()) === 0 && await box.evaluate(e => document.activeElement === e));
  check("sau khi xoá: nút 'Vào lớp này' khoá, không còn 'Không phải lớp của tôi'", await join.isDisabled() && (await page.getByRole("button", { name: "Không phải lớp của tôi" }).count()) === 0);
  check("chưa hề tham gia lớp nào (không gọi redeem)", (await prisma.enrollment.count({ where: { userId: stu.id } })) === 0);
  const mctx = await ctxFor(stu, { width: 390, height: 800 });
  const mp = await mctx.newPage();
  await mp.goto(`${MAIN}/student/nhap-ma-lop?code=${code}`, { waitUntil: "networkidle" });
  await mp.getByText("Bạn sắp vào lớp").waitFor({ timeout: 20000 });
  check("điện thoại 390px: không tràn ngang; thẻ + hai nút nằm gọn", await mp.evaluate(`document.documentElement.scrollWidth <= window.innerWidth`) as boolean);
  await shot(mp, "invite-figma-mobile");
  await mctx.close();

  section("Prefill ?code= và tham gia");
  await page.goto(`${MAIN}/student/nhap-ma-lop?code=${code}`, { waitUntil: "networkidle" });
  await page.getByText("Bạn sắp vào lớp").waitFor({ timeout: 15000 });
  check("?code= điền sẵn và kiểm tra luôn", (await page.getByLabel("Mã mời lớp").inputValue()) === code);
  await shot(page, "invite-input-ok");
  await page.getByRole("button", { name: "Vào lớp này" }).click();
  await page.waitForURL(/\/student\/hoc-tap/, { timeout: 20000 });
  await eventually("DB: có Enrollment active", async () => (await prisma.enrollment.findUnique({ where: { userId_courseId: { userId: stu.id, courseId: course.id } } }))?.status === "active");

  check("không lỗi trang", errors.length === 0, errors.slice(0, 2));
  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
