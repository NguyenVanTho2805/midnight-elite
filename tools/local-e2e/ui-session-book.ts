// BU-01..BU-07, BU-14, LI-02/03/05/06/09/10/11/16, DD-03 — TRÌNH DUYỆT thật: Lịch → bấm buổi → điểm danh ngay từ Lịch → trang buổi học (breadcrumb, ghi chép 3 phần,
// Đã dạy xong / mở lại, chia sẻ, nhận xét riêng từng em) → ngăn kéo Thêm buổi nhanh có kiểm xung đột → lọc buổi huỷ → màn Dời buổi và học bù; 390px không tràn ngang.
// Chạy (máy chủ dev bật): source tools/local-e2e/env.sh && npx tsx tools/local-e2e/ui-session-book.ts
import { prisma } from "@/lib/prisma";
import { addDaysKey, dayOfWeekOfKey, vnDateKeyOf } from "@/lib/classSessions";
import { check, mkCourse, mkTutor, mkUser, section, wipe, done } from "./h";
import { closeAll, ctxFor, launch } from "./ui";

const MAIN = process.env.BASE ?? "http://localhost:3100";
const day = (k: string) => new Date(`${k}T00:00:00Z`);

(async () => {
  await wipe();
  const tutor = await mkTutor("Cô Lan");
  const an = await mkUser({ name: "Em An" }), binh = await mkUser({ name: "Em Bình" });
  const toan = await mkCourse(tutor.id, { name: "Toán 9" }), ly = await mkCourse(tutor.id, { name: "Lý 9" });
  for (const u of [an, binh]) await prisma.enrollment.create({ data: { userId: u.id, courseId: toan.id, status: "active" } });
  await prisma.enrollment.create({ data: { userId: an.id, courseId: ly.id, status: "active" } });
  const today = vnDateKeyOf(new Date());
  // Buổi Toán 9 hôm nay 00:05–00:35 (đã qua gần như cả ngày); buổi Lý 9 ngày mai 10:00–11:00 (chưa bắt đầu, để thử dời).
  await prisma.classSchedule.create({ data: { courseId: toan.id, dayOfWeek: dayOfWeekOfKey(today), startTime: "00:05", endTime: "00:35", mode: "offline", location: "Nhà cô Lan" } });
  const tomorrow = addDaysKey(today, 1);
  const schLy = await prisma.classSchedule.create({ data: { courseId: ly.id, dayOfWeek: dayOfWeekOfKey(tomorrow), startTime: "10:00", endTime: "11:00" } });
  await prisma.course.update({ where: { id: toan.id }, data: { calendarColor: "lop-05" } });
  const near = new Date(); // nếu đang chạy lúc 00:05–00:35 thì buổi chưa kết thúc: vẫn đủ cho kiểm tra (không dựa vào "đã qua")
  void near;

  await launch();
  const ctx = await ctxFor(tutor, { width: 1280, height: 900 });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|zalo|hydrat/i.test(m.text())) errors.push(m.text()); });
  const goto = async (p: string) => { await page.goto(`${MAIN}${p}`, { waitUntil: "domcontentloaded", timeout: 120000 }); await page.waitForLoadState("networkidle").catch(() => {}); };

  section("Lịch: buổi có màu đã chọn, hình thức, bấm mở chi tiết và 5 thao tác nhanh (LI-02, LI-05, LI-06, LI-16)");
  await goto("/lop-cua-toi/lich");
  await page.getByRole("heading", { name: "Lịch dạy", exact: true }).waitFor({ timeout: 60000 });
  const block = page.locator("[data-lich-block]", { hasText: "Toán 9" }).first();
  await block.waitFor({ timeout: 30000 });
  check("khối buổi dùng màu lớp gia sư chọn (token --kin-lop-05, không mã hex)", ((await block.getAttribute("style")) ?? "").includes("--kin-lop-05"), await block.getAttribute("style"));
  check("khối buổi nói rõ Offline và 'Chưa chốt' bằng CHỮ", ((await block.innerText()).includes("Offline")) && (await block.innerText()).includes("Chưa chốt"), await block.innerText());
  await block.click();
  const quick = page.locator("[data-quick-actions]");
  await quick.waitFor();
  const names = (await quick.locator("a, button").allInnerTexts()).map(t => t.trim());
  check("thao tác nhanh có Mở buổi, Điểm danh, Nhân bản (Dời/Báo nghỉ ẩn vì buổi đã bắt đầu)", names.includes("Mở buổi") && names.includes("Điểm danh") && names.includes("Nhân bản") && !names.includes("Dời") && !names.includes("Báo nghỉ"), names);
  check("chi tiết ghi Offline + địa chỉ", (await page.getByText("Offline · Nhà cô Lan").count()) >= 1);

  section("Điểm danh ngay từ Lịch (LI-05) + bộ đếm cố định (DD-03)");
  await quick.getByRole("button", { name: "Điểm danh" }).click();
  const dlg = page.getByRole("dialog", { name: /Điểm danh — Toán 9/ });
  await dlg.waitFor();
  await dlg.getByRole("button", { name: "Tạo buổi điểm danh" }).click();
  await dlg.getByRole("button", { name: "Tất cả có mặt" }).first().waitFor();
  await dlg.getByRole("button", { name: "Tất cả có mặt" }).first().click();
  const bar = dlg.locator("[data-dd-bar]");
  check("bộ đếm: Có mặt 2 · Vắng 0 · Có phép 0 (trước khi lưu)", (await bar.locator('[data-dd-count="Có mặt"]').innerText()) === "2" && (await bar.locator('[data-dd-count="Vắng"]').innerText()) === "0" && (await bar.locator('[data-dd-count="Có phép"]').innerText()) === "0");
  await dlg.getByRole("button", { name: "Lưu điểm danh" }).click();
  await dlg.getByText("Đã lưu tất cả.").waitFor({ timeout: 15000 });
  const sessionRow = await prisma.attendanceSession.findFirstOrThrow({ where: { courseId: toan.id, date: day(today) }, include: { records: true } });
  check("đã lưu 2 bản ghi có mặt", sessionRow.records.length === 2 && sessionRow.records.every(r => r.status === "present"));
  check("chưa chốt: lưu điểm danh KHÔNG đổi trạng thái buổi", sessionRow.state === null);
  await dlg.getByRole("link", { name: "Mở trang buổi học" }).click();

  section("Trang buổi học: breadcrumb, ghi chép 3 phần, Online/Offline (BU-01, BU-04)");
  await page.waitForURL(new RegExp(`/lop-cua-toi/buoi/${toan.id}/${today}`), { timeout: 60000 });
  const crumb = page.locator("[data-bu-breadcrumb]");
  await crumb.waitFor({ timeout: 60000 });
  const crumbText = (await crumb.innerText()).replace(/\s+/g, " ");
  check("breadcrumb: Lớp › Toán 9 › ngày › trạng thái bằng chữ", crumbText.includes("Lớp") && crumbText.includes("Toán 9") && crumbText.includes(`${today.slice(8, 10)}/${today.slice(5, 7)}/${today.slice(0, 4)}`) && /chưa chốt|Sắp diễn ra/.test(crumbText), crumbText);
  check("tiêu đề + dòng phụ có Offline và giờ 00:05–00:35", (await page.getByRole("heading", { level: 1 }).innerText()).includes("Toán 9") && (await page.getByText("00:05–00:35").count()) >= 1 && (await page.getByText("Offline").count()) >= 1);
  await page.getByLabel("Đã dạy").fill("Phương trình bậc hai");
  await page.getByLabel("Bài tập về nhà").fill("Bài 1-6 trang 40");
  await page.getByLabel("Nhận xét chung").fill("Cả lớp theo kịp");
  await page.getByLabel("Hình thức buổi này").selectOption("online");
  await page.getByLabel("Link học online riêng buổi này (không bắt buộc)").fill("https://meet.example/rieng");
  await page.getByRole("button", { name: "Lưu ghi chép" }).click();
  await page.getByText("Đã lưu.", { exact: true }).waitFor({ timeout: 15000 });
  const saved = await prisma.attendanceSession.findFirstOrThrow({ where: { id: sessionRow.id } });
  check("DB: 3 phần ghi chép + online + link riêng buổi", saved.taught === "Phương trình bậc hai" && saved.homework === "Bài 1-6 trang 40" && saved.summary === "Cả lớp theo kịp" && saved.mode === "online" && saved.joinUrl === "https://meet.example/rieng");
  check("nút 'Mở link học online' trỏ đúng link riêng buổi", (await page.getByRole("link", { name: "Mở link học online" }).getAttribute("href")) === "https://meet.example/rieng");

  section("Nhận xét riêng từng em + cho đúng phụ huynh xem (BU-07)");
  await page.getByRole("button", { name: "Thêm nhận xét riêng" }).first().click();
  const box = page.getByLabel(/^Nhận xét riêng cho Em/).first();
  await box.fill("Em làm đúng dạng cơ bản");
  const share = page.getByLabel("Cho phụ huynh của em này xem nhận xét (qua link Sổ của con)").first();
  await share.check();
  await page.getByRole("button", { name: "Lưu điểm danh" }).click();
  await page.getByText("Đã lưu tất cả.").waitFor({ timeout: 15000 });
  const recs = await prisma.attendanceRecord.findMany({ where: { sessionId: sessionRow.id }, orderBy: { student: { name: "asc" } } });
  check("DB: đúng MỘT em có nhận xét chia sẻ; em kia không", recs.filter(r => r.parentVisible).length === 1 && recs.filter(r => r.note).length === 1 && recs[0].parentVisible === true && recs[0].note === "Em làm đúng dạng cơ bản");

  section("Đã dạy xong / mở lại (BU-02, BU-03) và chia sẻ (BU-14)");
  const feeBefore = await prisma.feeCharge.count();
  await page.getByRole("button", { name: "Đã dạy xong" }).click();
  await page.getByRole("button", { name: "Mở lại buổi" }).waitFor({ timeout: 15000 });
  const closedRow = await prisma.attendanceSession.findFirstOrThrow({ where: { id: sessionRow.id } });
  check("DB: state 'closed' + closedAt; trang hiện 'Đã dạy xong' và 'Đã chốt lúc'", closedRow.state === "closed" && !!closedRow.closedAt && (await page.getByText("Đã chốt lúc").count()) === 1 && (await page.locator("[data-bu-close]").getByText("Đã dạy xong").count()) >= 1);
  check("chốt buổi lớp CŨ không tạo dòng phí (số dòng không đổi)", (await prisma.feeCharge.count()) === feeBefore);
  // Sửa 24/10/2026: chữ khung đổi theo sự thật mới (lớp kiểu mới có học phí khi chốt; lớp cũ không đổi). Lớp trong bài này là lớp CŨ nên số dòng phí vẫn không đổi.
  check("khung chốt nói thật: chốt buổi và học phí (kiểu mới tính khi chốt, cách cũ không đổi)", (await page.getByText("Chốt buổi và học phí").count()) === 1 && (await page.getByText(/cách cũ\) không đổi/).count()) === 1);
  await page.getByRole("button", { name: "Chia sẻ báo cáo buổi" }).click();
  const shareText = await page.locator("#tin-bao-cao-buoi").inputValue();
  check("tin chia sẻ: có ba phần, KHÔNG tên em, KHÔNG tiền", shareText.includes("Đã dạy: Phương trình bậc hai") && shareText.includes("Bài tập về nhà: Bài 1-6") && shareText.includes("Nhận xét chung: Cả lớp theo kịp") && !/Em An|Em Bình|học phí|đồng/.test(shareText), shareText);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Mở lại buổi" }).click();
  await page.getByRole("button", { name: "Đã dạy xong" }).waitFor({ timeout: 15000 });
  check("mở lại (chưa có phiếu): về 'open', không hỏi xác nhận", (await prisma.attendanceSession.findFirstOrThrow({ where: { id: sessionRow.id } })).state === "open");
  // Có phiếu tháng đã lập → hộp xác nhận KinConfirm nêu cảnh báo.
  await page.getByRole("button", { name: "Đã dạy xong" }).click();
  await page.getByRole("button", { name: "Mở lại buổi" }).waitFor({ timeout: 15000 });
  await prisma.tuitionInvoice.create({ data: { code: `KINT${Date.now().toString(36).slice(-5).toUpperCase()}`, tutorId: tutor.id, studentId: an.id, yearMonth: today.slice(0, 7), amountDue: 100000, status: "sent" } });
  await page.getByRole("button", { name: "Mở lại buổi" }).click();
  const confirm = page.getByRole("alertdialog").or(page.getByRole("dialog", { name: "Mở lại buổi đã chốt?" }));
  await confirm.first().waitFor({ timeout: 15000 });
  check("hộp xác nhận nêu phiếu tháng đã lập và 'KHÔNG tự sửa phiếu'", ((await confirm.first().innerText()).includes("KHÔNG tự sửa")) && (await confirm.first().innerText()).includes("phiếu"), await confirm.first().innerText());
  await confirm.first().getByRole("button", { name: "Giữ nguyên" }).click();
  check("chọn 'Giữ nguyên' → buổi VẪN chốt, phiếu không đổi", (await prisma.attendanceSession.findFirstOrThrow({ where: { id: sessionRow.id } })).state === "closed" && (await prisma.tuitionInvoice.findFirstOrThrow({ where: { studentId: an.id } })).amountDue === 100000);
  await page.getByRole("button", { name: "Mở lại buổi" }).click();
  await confirm.first().getByRole("button", { name: "Vẫn mở lại" }).click();
  await page.getByRole("button", { name: "Đã dạy xong" }).waitFor({ timeout: 15000 });
  check("chọn 'Vẫn mở lại' → buổi mở lại, phiếu vẫn 100.000 (không tự sửa)", (await prisma.attendanceSession.findFirstOrThrow({ where: { id: sessionRow.id } })).state === "open" && (await prisma.tuitionInvoice.findFirstOrThrow({ where: { studentId: an.id } })).amountDue === 100000);

  section("Điện thoại 390px: thanh thao tác cố định + bộ đếm, không tràn ngang, nút ≥ 44px (DD-03)");
  const mctx = await ctxFor(tutor, { width: 390, height: 800 });
  const mp = await mctx.newPage();
  await mp.goto(`${MAIN}/lop-cua-toi/buoi/${toan.id}/${today}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await mp.locator("[data-dd-bar]").waitFor({ timeout: 60000 });
  await mp.waitForLoadState("networkidle").catch(() => {});
  check("không tràn ngang ở 390px", await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), await mp.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]));
  const small = await mp.evaluate(() => [...document.querySelectorAll<HTMLElement>("main button, main a[class*=kin], [data-dd-bar] button")].filter(e => e.offsetParent && e.getBoundingClientRect().height > 0 && e.getBoundingClientRect().height < 43).map(e => `${e.tagName}:${(e.innerText || "").slice(0, 25)}:${Math.round(e.getBoundingClientRect().height)}`));
  check("nút/liên kết chính cao ≥ 44px", small.length === 0, small.slice(0, 6));
  const stick = await mp.evaluate(() => { const b = document.querySelector<HTMLElement>("[data-dd-bar]")!; b.scrollIntoView({ block: "end" }); window.scrollTo(0, 0); const r = b.getBoundingClientRect(); return { top: r.top, inView: r.top < window.innerHeight && r.bottom > 0, pos: getComputedStyle(b).position }; });
  check("thanh bộ đếm dính (position sticky) và còn thấy khi ở đầu trang", stick.pos === "sticky" && stick.inView, stick);
  await mctx.close();

  section("Thêm buổi nhanh bằng ngăn kéo, kiểm xung đột (LI-11, LI-10)");
  await goto("/lop-cua-toi/lich");
  await page.getByRole("button", { name: "+ Thêm buổi" }).click();
  const drawer = page.getByRole("dialog", { name: "Thêm buổi nhanh" });
  await drawer.waitFor();
  // Đặt buổi lẻ Lý 9 vào đúng ngày + giờ của buổi Lý 9 ngày mai (10:30–11:30 chồng 10:00–11:00).
  await drawer.getByRole("radio", { name: "Dạy bù" }).click();
  await drawer.getByLabel("Lớp").selectOption({ label: "Lý 9" });
  await drawer.getByLabel("Ngày").fill(tomorrow);
  await drawer.getByLabel("Bắt đầu").fill("10:30");
  await drawer.getByLabel("Kết thúc").fill("11:30");
  await drawer.getByRole("button", { name: "Thêm buổi", exact: true }).click();
  const conflictBox = drawer.locator("[data-conflicts]");
  await conflictBox.waitFor({ timeout: 15000 });
  check("báo xung đột bằng chữ, nêu lớp và giờ trùng; CHƯA ghi buổi nào", (await conflictBox.innerText()).includes("Lý 9") && (await prisma.attendanceSession.count({ where: { courseId: ly.id, date: day(tomorrow) } })) === 0, await conflictBox.innerText());
  await drawer.getByLabel("Bắt đầu").fill("15:00"); await drawer.getByLabel("Kết thúc").fill("16:00");
  await drawer.getByRole("button", { name: "Thêm buổi", exact: true }).click();
  await drawer.waitFor({ state: "hidden", timeout: 15000 });
  const made = await prisma.attendanceSession.findFirstOrThrow({ where: { courseId: ly.id, date: day(tomorrow) } });
  check("đổi giờ cho khỏi trùng → thêm được: kind 'makeup' 15:00–16:00", made.kind === "makeup" && made.startTime === "15:00" && made.endTime === "16:00");
  const madeBlock = page.locator("[data-lich-block]", { hasText: "15:00–16:00" }).first();
  await madeBlock.waitFor({ timeout: 20000 }).catch(() => {});
  check("buổi bù hiện ngay trên Lịch (khối 15:00–16:00 của Lý 9)", (await madeBlock.count()) === 1 && (await madeBlock.innerText()).includes("Lý 9"));

  section("Ẩn buổi đã huỷ — nhớ ở tài khoản (LI-03)");
  await prisma.classSessionChange.create({ data: { courseId: ly.id, scheduleId: schLy.id, dateKey: tomorrow, kind: "cancel", changedBy: tutor.id } });
  await goto("/lop-cua-toi/lich");
  const cancelledBlock = page.locator("[data-lich-block]", { hasText: "Đã huỷ" });
  await cancelledBlock.first().waitFor({ timeout: 20000 });
  await page.getByLabel("Ẩn buổi đã huỷ").check();
  await page.waitForFunction(() => document.querySelectorAll("[data-lich-block]").length >= 0);
  await page.waitForTimeout(600);
  check("tick 'Ẩn buổi đã huỷ' → khối đã huỷ biến mất, buổi khác còn", (await cancelledBlock.count()) === 0 && (await page.locator("[data-lich-block]").count()) >= 1);
  await goto("/lop-cua-toi/lich");
  await page.getByLabel("Ẩn buổi đã huỷ").waitFor();
  check("tải lại trang vẫn nhớ lựa chọn (đã lưu ở tài khoản)", await page.getByLabel("Ẩn buổi đã huỷ").isChecked() && (await prisma.user.findUniqueOrThrow({ where: { id: tutor.id } })).preferences !== null);
  await page.getByLabel("Ẩn buổi đã huỷ").uncheck();
  await prisma.classSessionChange.deleteMany({ where: { scheduleId: schLy.id } });

  section("Màn Dời buổi và học bù gom một chỗ (LI-09)");
  // Buổi Lý 9 ngày mai 10:00–11:00 chưa bắt đầu → dời/huỷ/học bù một màn. Buổi bù Lý 9 15:00–16:00 ngày mai đã có (LI-11) nên chọn giờ 15:30 để thấy xung đột.
  await goto(`/lop-cua-toi/lich/doi-buoi?scheduleId=${schLy.id}&dateKey=${tomorrow}`);
  await page.getByRole("heading", { name: "Dời buổi và học bù", level: 1 }).waitFor({ timeout: 60000 });
  check("có ba lựa chọn: dời, thêm buổi dạy bù, huỷ", (await page.getByRole("radio").allInnerTexts()).join("|") === "Dời sang lúc khác|Thêm buổi dạy bù|Huỷ buổi");
  check("KHÔNG có ô chọn phí (miễn phí / thu phí) — chưa làm vì là quyết định tiền", (await page.getByText("Miễn phí ngoại lệ").count()) === 0 && (await page.getByText("Thu theo chính sách").count()) === 0 && (await page.getByText("Không đổi tiền ở màn này").count()) === 1);
  await page.getByRole("radio", { name: "Thêm buổi dạy bù" }).click();
  await page.getByLabel("Ngày", { exact: true }).fill(tomorrow);
  await page.getByLabel("Bắt đầu").fill("15:30"); await page.getByLabel("Kết thúc").fill("16:30");
  await page.locator("[data-conflicts]").waitFor({ timeout: 15000 });
  check("xung đột hiện NGAY khi chọn giờ (kèm tên lớp)", (await page.locator("[data-conflicts]").innerText()).includes("Lý 9"));
  await page.getByLabel("Ngày", { exact: true }).fill(addDaysKey(tomorrow, 1)); // ngày khác (mỗi lớp mỗi ngày một bản ghi buổi)
  await page.getByLabel("Bắt đầu").fill("18:00"); await page.getByLabel("Kết thúc").fill("19:00");
  await page.getByText("Giờ này còn trống, không trùng lịch nào").waitFor({ timeout: 15000 });
  check("đổi sang giờ trống → báo 'còn trống'", true);
  await page.getByRole("button", { name: "Thêm buổi bù", exact: true }).click();
  await page.locator("[data-doi-buoi-done]").waitFor({ timeout: 15000 });
  const doneText = await page.locator("#tin-doi-buoi").inputValue();
  check("tin báo lớp soạn sẵn, không tên em, không tiền; có lưu buổi bù mới", doneText.includes("dạy bù") && !/Em An|học phí/.test(doneText) && (await prisma.attendanceSession.count({ where: { courseId: ly.id, kind: "makeup" } })) === 2, doneText);

  check("không có lỗi JS trong cả phiên", errors.length === 0, errors.slice(0, 3));
  await closeAll();
  await done();
})();
