import { BASE, mkTutor, mkUser, mkCourse, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, shot } from "./ui";
import { prisma } from "@/lib/prisma";
import { generateInvoiceCode } from "@/lib/tuitionInvoice";

const mk = (tutorId: string, studentId: string, ym: string, status: string, amountDue = 1_200_000) =>
  prisma.tuitionInvoice.create({ data: { code: generateInvoiceCode(), tutorId, studentId, yearMonth: ym, amountDue, status, sentAt: status === "draft" ? null : new Date() } });

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");
  const A = await mkUser({ name: "Minh Anh" }), B = await mkUser({ name: "Bảo Bình" });
  await prisma.user.update({ where: { id: A.id }, data: { parentName: "Hoa", parentPhone: "0901234567" } });
  const course = await mkCourse(T.id, { name: "Toán 9" });
  for (const u of [A, B]) await prisma.enrollment.create({ data: { userId: u.id, courseId: course.id, status: "active" } });
  await prisma.tutorPayoutAccount.create({ data: { userId: T.id, bankBin: "970436", accountNo: "0123456789", accountName: "NGUYEN VAN LAN" } });
  const sentA = await mk(T.id, A.id, "2026-10", "sent");
  await mk(T.id, B.id, "2026-10", "draft");

  await launch();
  const ctx = await ctxFor(T);
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE }).catch(() => {});
  const opened: string[] = [];
  await ctx.route(/\/\/(zalo\.me|chat\.zalo\.me)\//, route => { opened.push(route.request().url()); void route.fulfill({ status: 200, contentType: "text/html", body: "<title>zalo</title>" }); });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|zalo/i.test(m.text())) errors.push(m.text()); });

  section("Tab Phiếu: nút theo trạng thái");
  await page.goto(`${BASE}/lop-cua-toi/hoc-phi`, { waitUntil: "networkidle", timeout: 120000 });
  await page.getByRole("tab", { name: "Phiếu" }).click();
  const cardA = page.getByRole("listitem").filter({ hasText: "Minh Anh" });
  const cardB = page.getByRole("listitem").filter({ hasText: "Bảo Bình" });
  await cardA.waitFor({ timeout: 60000 });
  check("phiếu đã gửi có 'Gửi phiếu qua Zalo'", await cardA.getByRole("button", { name: "Gửi phiếu qua Zalo" }).isVisible());
  check("phiếu nháp KHÔNG có nút Zalo (phải bấm 'Gửi phiếu' trước)", (await cardB.getByRole("button", { name: /Zalo/ }).count()) === 0 && await cardB.getByRole("button", { name: "Gửi phiếu", exact: true }).isVisible());
  check("chưa mở Zalo: không có dòng 'Đã mở Zalo lúc'", (await cardA.getByText(/Đã mở Zalo lúc/).count()) === 0);

  section("Hộp thoại: chat riêng");
  await cardA.getByRole("button", { name: "Gửi phiếu qua Zalo" }).click();
  const dlg = page.getByRole("dialog");
  await dlg.waitFor();
  const ta = dlg.getByLabel("Tin nhắn (sửa được trước khi gửi)");
  await eventually("tin soạn sẵn xuất hiện", async () => (await ta.inputValue()).length > 20);
  const draft = await ta.inputValue();
  check("mặc định 'Chat riêng'", await dlg.getByRole("radio", { name: "Chat riêng với phụ huynh" }).isChecked());
  check("tin đúng mẫu: tháng 10, tên con, 1.200.000đ, hạn trước ngày 20, link /phieu/<32 hex>", /^Dạ em gửi anh\/chị phiếu học phí tháng 10 của con Minh Anh: 1\.200\.000đ, hạn trước ngày 20\. Anh\/chị bấm vào đây để xem phiếu và quét mã chuyển khoản: http:\/\/localhost:3100\/phieu\/[0-9a-f]{32}$/.test(draft), draft);
  check("nói rõ: SĐT phụ huynh, link còn 60 ngày, KiN không gửi giúp", await dlg.getByText(/Sẽ mở Zalo của 0901234567/).isVisible() && await dlg.getByText(/Link phiếu dùng được 60 ngày nữa/).isVisible() && await dlg.getByText(/KiN không gửi giúp/).isVisible());
  const link = draft.match(/http\S+$/)![0];

  section("Sửa tin rồi mở Zalo");
  await ta.fill(draft + "\nCảm ơn anh/chị.");
  await dlg.getByRole("button", { name: "Mở Zalo" }).click();
  await dlg.waitFor({ state: "detached", timeout: 20000 });
  await eventually("đã chép đúng tin ĐÃ SỬA", async () => (await page.evaluate(() => navigator.clipboard.readText()).catch(() => "")).endsWith("Cảm ơn anh/chị."));
  await eventually("mở Zalo đúng số phụ huynh", () => opened.some(u => u.startsWith("https://zalo.me/0901234567")), 15000);
  await eventually("DB: ghi 'đã mở Zalo'", async () => !!(await prisma.tuitionInvoice.findUnique({ where: { id: sentA.id } }))?.zaloOpenedAt);
  await eventually("danh sách: 'Đã mở Zalo lúc HH:MM ngày dd/mm'", async () => await cardA.getByText(/Đã mở Zalo lúc \d{2}:\d{2} ngày \d{2}\/\d{2}/).isVisible());
  check("không bao giờ ghi 'đã gửi qua Zalo' (nhãn 'Đã gửi' của phiếu là trạng thái phiếu, khác chuyện Zalo)", !/(đã gửi[^.\n]*Zalo|Zalo[^.\n]*đã gửi)/i.test(await cardA.innerText()), await cardA.innerText());
  check("nút đổi thành 'Gửi lại qua Zalo'", await cardA.getByRole("button", { name: "Gửi lại qua Zalo" }).isVisible());
  check("chưa ai mở link: chưa có 'Phụ huynh đã xem'", (await page.getByText(/Phụ huynh đã xem/).count()) === 0);

  section("Mở lại: dùng đúng link cũ");
  await cardA.getByRole("button", { name: "Gửi lại qua Zalo" }).click();
  await dlg.waitFor();
  await eventually("link trong tin mới = link cũ", async () => (await dlg.getByLabel("Tin nhắn (sửa được trước khi gửi)").inputValue()).endsWith(link));

  section("Nhóm Zalo lớp: tin chung, không ghi vào phiếu");
  const before = (await prisma.tuitionInvoice.findUnique({ where: { id: sentA.id } }))!.zaloOpenedAt!.getTime();
  await dlg.getByRole("radio", { name: "Nhóm Zalo lớp" }).check();
  await eventually("tin nhóm hiện ra", async () => (await dlg.getByLabel("Tin nhắn (sửa được trước khi gửi)").inputValue()).startsWith("Phiếu học phí tháng 10 đã gửi riêng"));
  const g = await dlg.getByLabel("Tin nhắn (sửa được trước khi gửi)").inputValue();
  check("tin nhóm: KHÔNG số tiền, link, tên con", !/\d\.\d{3}đ|http|Minh Anh/.test(g), g);
  check("giải thích vì sao nhóm không kèm tiền/link", await dlg.getByText(/không có số tiền, link hay tên con/).isVisible());
  const nOpened = opened.length;
  await dlg.getByRole("button", { name: "Mở Zalo" }).click();
  await dlg.waitFor({ state: "detached", timeout: 20000 });
  await eventually("mở chat.zalo.me (không theo số điện thoại)", () => opened.length > nOpened && opened[opened.length - 1].startsWith("https://chat.zalo.me/"), 15000);
  check("tin nhóm KHÔNG đổi mốc 'đã mở Zalo' của phiếu", (await prisma.tuitionInvoice.findUnique({ where: { id: sentA.id } }))!.zaloOpenedAt!.getTime() === before);

  section("Phụ huynh mở link (không đăng nhập)");
  const pctx = await ctxFor(null);
  const pp = await pctx.newPage();
  const perrors: string[] = [];
  pp.on("pageerror", e => perrors.push(String(e)));
  await pp.goto(link, { waitUntil: "networkidle", timeout: 120000 });
  const art = pp.getByRole("article", { name: "Phiếu học phí Tháng 10/2026" });
  await art.waitFor({ timeout: 60000 });
  check("thấy phiếu: tên con, mã, 1.200.000đ, tài khoản của gia sư", await pp.getByRole("heading", { name: /Minh Anh/ }).isVisible() && await art.getByText(`Mã phiếu ${sentA.code}`).isVisible() && await art.getByText("0123456789").isVisible() && await art.getByText("NGUYEN VAN LAN").isVisible());
  check("có mã QR (img)", await art.getByRole("img", { name: /Mã VietQR/ }).count() === 1);
  await eventually("DB: parentViewedAt được ghi từ trình duyệt", async () => !!(await prisma.tuitionInvoice.findUnique({ where: { id: sentA.id } }))?.parentViewedAt);
  await art.getByRole("button", { name: "Tôi đã chuyển" }).click();
  await pp.getByText(/Đã báo cho gia sư/).waitFor({ timeout: 15000 });
  check("báo chuyển khoản thành công, phiếu sang 'parent_reported'", (await prisma.tuitionInvoice.findUnique({ where: { id: sentA.id } }))?.status === "parent_reported");
  check("không lỗi trang phụ huynh", perrors.length === 0, perrors);
  await shot(pp, "invoice-zalo-parent");

  section("Gia sư thấy 'Phụ huynh đã xem' và 'Phụ huynh báo đã chuyển'");
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "Phiếu" }).click();
  await cardA.waitFor({ timeout: 60000 });
  check("'Phụ huynh đã xem lúc …' + vẫn 'Đã mở Zalo lúc …'", await cardA.getByText(/Phụ huynh đã xem lúc \d{2}:\d{2} ngày \d{2}\/\d{2}/).isVisible() && await cardA.getByText(/Đã mở Zalo lúc/).isVisible());
  check("trạng thái phiếu đổi theo phụ huynh báo", await cardA.getByText(/báo đã chuyển|Chờ|Đã báo/i).first().isVisible());
  await shot(page, "invoice-zalo-tutor");

  section("Link hết hạn");
  await prisma.tuitionInvoice.update({ where: { id: sentA.id }, data: { viewTokenExpiresAt: new Date(Date.now() - 1000) } });
  await pp.goto(link, { waitUntil: "networkidle" });
  check("phụ huynh thấy 'Link đã hết hạn', không thấy tên con / số tiền", await pp.getByRole("heading", { name: "Link đã hết hạn" }).isVisible() && (await pp.getByText("Minh Anh").count()) === 0 && (await pp.getByText(/1\.200\.000/).count()) === 0);
  await cardA.getByRole("button", { name: "Gửi lại qua Zalo" }).click();
  await dlg.waitFor();
  await eventually("gia sư gửi lại → link MỚI", async () => { const v = await dlg.getByLabel("Tin nhắn (sửa được trước khi gửi)").inputValue(); return /\/phieu\/[0-9a-f]{32}$/.test(v) && !v.endsWith(link); });
  await dlg.getByRole("button", { name: "Đóng", exact: true }).click();

  section("Điện thoại 390px");
  const mctx = await ctxFor(T, { width: 390, height: 800 });
  const mp = await mctx.newPage();
  await mp.goto(`${BASE}/lop-cua-toi/hoc-phi`, { waitUntil: "networkidle" });
  await mp.getByRole("tab", { name: "Phiếu" }).click();
  await mp.getByRole("button", { name: "Gửi lại qua Zalo" }).waitFor({ timeout: 60000 });
  check("tab Phiếu không tràn ngang", await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await mp.getByRole("button", { name: "Gửi lại qua Zalo" }).click();
  const md = mp.getByRole("dialog");
  await md.waitFor();
  check("hộp thoại vừa màn hình, nút Mở Zalo bấm được (≥44px)", await md.getByRole("button", { name: "Mở Zalo" }).boundingBox().then(b => !!b && b.height >= 44 && b.x >= 0 && b.x + b.width <= 390));
  const mpp = await (await ctxFor(null, { width: 390, height: 800 })).newPage();
  await mpp.goto(link.replace(/phieu\/.*/, "phieu/") + (await prisma.tuitionInvoice.findUnique({ where: { id: sentA.id } }))!.viewToken, { waitUntil: "networkidle" });
  await mpp.getByRole("article").waitFor({ timeout: 60000 });
  check("trang phiếu của phụ huynh không tràn ngang", await mpp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));

  check("không lỗi trang gia sư", errors.length === 0, errors.slice(0, 3));
  done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
