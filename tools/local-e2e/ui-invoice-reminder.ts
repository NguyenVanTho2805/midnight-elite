// F2 — giao diện tab Phiếu: hạn đóng, quá hạn, nhắc bước 2–3 (KiN Pro), lịch sử nhắc; Free thấy khung mờ + 'Có trong KiN Pro', không bị che công nợ/bước 1.
// Chạy với EXPECT_ENFORCE=0 (máy chủ mặc định) hoặc EXPECT_ENFORCE=1 (KIN_PLAN_ENFORCE=1 cho cả máy chủ và bài).
import { BASE, mkTutor, mkUser, mkCourse, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";
import { generateInvoiceCode } from "@/lib/tuitionInvoice";

const ENF = process.env.EXPECT_ENFORCE === "1";
const DAY = 24 * 3600_000;
const vnKey = (n: number) => new Date(Date.now() + n * DAY + 7 * 3600_000).toISOString().slice(0, 10);

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");
  const A = await mkUser({ name: "Minh Anh" }), B = await mkUser({ name: "Bảo Bình" });
  const course = await mkCourse(T.id, { name: "Toán 9" });
  for (const u of [A, B]) await prisma.enrollment.create({ data: { userId: u.id, courseId: course.id, status: "active" } });
  await prisma.tutorPayoutAccount.create({ data: { userId: T.id, bankBin: "970436", accountNo: "0123456789", accountName: "NGUYEN VAN LAN" } });
  if (!ENF || process.env.AS_PRO === "1") {
    await prisma.proOrder.create({ data: { userId: T.id, period: "month", durationDays: 30, priceVnd: 0, listPriceVnd: 0, source: "admin_grant", memoCode: `KINPRO-UI${Date.now().toString(36)}`, status: "active", startDate: new Date(Date.now() - 5 * DAY), endDate: new Date(Date.now() + 25 * DAY) } });
  }
  const YM = vnKey(0).slice(0, 7);
  const mk = (studentId: string, o: { dueDate?: string; zaloDaysAgo?: number } = {}) => prisma.tuitionInvoice.create({ data: {
    code: generateInvoiceCode(), tutorId: T.id, studentId, yearMonth: YM, amountDue: 1_200_000, status: "sent", sentAt: new Date(), dueDate: o.dueDate ?? null,
    zaloOpenedAt: o.zaloDaysAgo !== undefined ? new Date(Date.now() - o.zaloDaysAgo * DAY) : null,
  } });
  const ia = await mk(A.id, { dueDate: vnKey(-5), zaloDaysAgo: 4 });
  await mk(B.id);

  await launch();
  const ctx = await ctxFor(T);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|zalo/i.test(m.text())) errors.push(m.text()); });
  await page.goto(`${BASE}/lop-cua-toi/hoc-phi`, { waitUntil: "networkidle", timeout: 120000 });
  await page.getByRole("tab", { name: "Phiếu" }).click();
  const cardA = page.getByRole("listitem").filter({ hasText: "Minh Anh" });
  const cardB = page.getByRole("listitem").filter({ hasText: "Bảo Bình" });
  await cardA.waitFor({ timeout: 60000 });

  section("Công nợ và quá hạn luôn hiện (kể cả Free); bước 1 không bị che");
  check("thẻ phiếu hiện 'Hạn đóng dd/mm/yyyy · quá hạn 5 ngày'", await cardA.getByText(`Hạn đóng ${vnKey(-5).split("-").reverse().join("/")} · quá hạn 5 ngày`).isVisible());
  check("có ô 'Quá hạn' trong số liệu và hộp chọn 'Chỉ xem phiếu quá hạn'", await page.getByText("1 phiếu", { exact: true }).isVisible() && await page.getByLabel(/Chỉ xem phiếu quá hạn/).isVisible());
  check("vẫn thấy Phải đóng / Còn lại và nút 'Gửi lại qua Zalo' (bước 1)", await cardA.getByText("1.200.000đ").first().isVisible() && await cardA.getByRole("button", { name: "Gửi lại qua Zalo" }).isVisible());
  await page.getByLabel(/Chỉ xem phiếu quá hạn/).check();
  check("lọc quá hạn: chỉ còn phiếu của Minh Anh", await cardA.isVisible() && (await cardB.count()) === 0);
  await page.getByLabel(/Chỉ xem phiếu quá hạn/).uncheck();

  if (ENF) {
    section("Free (cổng bật): khung mờ 'Có trong KiN Pro', không có nút Pro, KHÔNG che công nợ");
    check("có chữ 'Có trong KiN Pro' và nút 'Xem gói' tới /lop-cua-toi/goi", await cardA.getByText("Có trong KiN Pro").isVisible() && (await cardA.getByRole("link", { name: "Xem gói" }).getAttribute("href")) === "/lop-cua-toi/goi");
    check("ghi chú đầu trang nói rõ bước 1 + công nợ miễn phí", await page.getByText(/luôn miễn phí/).first().isVisible());
    check("không có 'Nhắc bước 2', 'Đặt hạn đóng', 'Lịch sử nhắc' để bấm", (await cardA.getByRole("button", { name: /Nhắc bước|Đặt hạn đóng|Đổi hạn đóng|Lịch sử nhắc/ }).count()) === 0);
    check("phiếu chưa nhắc bước 1 không bị nhắc Pro (không rối mắt)", (await cardB.getByText("Có trong KiN Pro").count()) === 0);
    await shot(page, "invoice-reminder-free");
  } else {
    section("Pro: Nhắc bước 2 (đến lúc), đặt hạn, lịch sử");
    const btn2 = cardA.getByRole("button", { name: "Nhắc bước 2 (đến lúc)" });
    check("nút 'Nhắc bước 2 (đến lúc)' hiện cho phiếu đã nhắc bước 1 cách 4 ngày", await btn2.isVisible());
    check("phiếu chưa nhắc không có nút bước 2", (await cardB.getByRole("button", { name: /Nhắc bước/ }).count()) === 0);
    check("không khung Pro mờ khi đã là Pro", (await page.getByText("Có trong KiN Pro").count()) === 0);
    await btn2.click();
    const dlg = page.getByRole("dialog");
    await dlg.waitFor();
    const ta = dlg.getByLabel("Tin nhắn (sửa được trước khi gửi)");
    await eventually("tin bước 2 xuất hiện", async () => (await ta.inputValue()).length > 20);
    const txt = await ta.inputValue();
    check("tin bước 2: nhẹ nhàng, có hạn thật, link, mời bấm 'Tôi đã chuyển'; không doạ/'đã gửi'", txt.includes(`hạn đóng ${vnKey(-5).split("-").reverse().join("/")}`) && txt.includes("/phieu/") && txt.includes("Tôi đã chuyển") && !/đã gửi|phạt|kiện|cắt|ngừng/.test(txt), txt);
    check("không có lựa chọn 'Nhóm Zalo lớp' ở bước 2", (await dlg.getByRole("radio").count()) === 0);
    check("nói rõ KiN không gửi giúp", await dlg.getByText(/KiN không gửi giúp/).isVisible());
    await shot(page, "invoice-reminder-step2");
    await dlg.getByRole("button", { name: "Đóng" }).first().click();

    await cardA.getByRole("button", { name: "Đổi hạn đóng" }).click();
    const dd = page.getByRole("dialog");
    await dd.getByLabel("Hạn đóng").fill(vnKey(7));
    await dd.getByRole("button", { name: "Lưu hạn" }).click();
    await eventually("hạn mới được lưu và hết quá hạn", async () => (await prisma.tuitionInvoice.findUnique({ where: { id: ia.id } }))?.dueDate === vnKey(7));
    await eventually("thẻ phiếu hiện hạn mới, không còn 'quá hạn'", async () => (await cardA.getByText(`Hạn đóng ${vnKey(7).split("-").reverse().join("/")}`).count()) === 1 && (await cardA.getByText(/quá hạn \d+ ngày/).count()) === 0);
    check("số tiền phiếu không đổi sau khi đặt hạn", (await prisma.tuitionInvoice.findUnique({ where: { id: ia.id } }))?.amountDue === 1_200_000);

    await cardA.getByRole("button", { name: "Lịch sử nhắc" }).click();
    const hd = page.getByRole("dialog");
    await eventually("lịch sử hiện 'Đã mở Zalo · bước 1' và câu giải thích không biết tin đi thật hay không", async () => (await hd.getByText(/Đã mở Zalo · bước 1/).count()) === 1 && (await hd.getByText(/không biết tin có đi thật hay không/).count()) === 1);
    check("lịch sử ghi 'Chưa có tiền ghi vào phiếu' khi chưa khớp", await hd.getByText("Chưa có tiền ghi vào phiếu.").isVisible());
    check("lịch sử không dùng chữ 'đã gửi'", !/đã gửi/i.test(await hd.innerText()));
    await shot(page, "invoice-reminder-history");
  }
  check("không lỗi trên console / trang", errors.length === 0, errors);
  await closeAll();
  await done();
})();
