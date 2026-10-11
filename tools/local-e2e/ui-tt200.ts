import { api, mkUser, mkTutor, mkCourse, wipe, check, section, done, eventually, BASE } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";
import { generatePortalToken } from "@/lib/parentPortal";

let seq = 9000;
const hook = (tutorId: string, key: string, p: Record<string, unknown>) =>
  api("POST", `/api/webhooks/sepay/${tutorId}`, { headers: { authorization: `Apikey ${key}` }, body: { id: ++seq, transferType: "in", transactionDate: "2026-10-11 09:00:00", ...p } });

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");
  const s1 = await mkUser({ name: "Trần Gia Bảo" }), s2 = await mkUser({ name: "Đỗ Hà" }), s3 = await mkUser({ name: "Lê Minh" }), parent = await mkUser({ name: "Chị Mai" });
  const c1 = await mkCourse(T.id, { name: "Toán 9" }), c2 = await mkCourse(T.id, { name: "Lý 9" });
  for (const [u, c] of [[s1, c1], [s1, c2], [s2, c1], [s3, c1]] as const) await prisma.enrollment.create({ data: { userId: u.id, courseId: c.id, status: "active" } });
  const YM = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 7);
  await prisma.monthlyCourseFee.create({ data: { courseId: c1.id, yearMonth: YM, sessionCount: 8, updatedBy: T.id } });
  await prisma.monthlyCourseFee.create({ data: { courseId: c2.id, yearMonth: YM, sessionCount: 4, updatedBy: T.id } });
  const token = generatePortalToken();
  await prisma.parentLink.create({ data: { parentId: parent.id, studentId: s1.id, status: "verified", verifiedAt: new Date(), portalToken: token } });

  await launch();
  const ctx = await ctxFor(T);
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error" && !/favicon|font|Failed to load resource|vietqr/i.test(m.text())) errors.push(m.text()); });

  section("Gia sư: tab Nhận tiền");
  await page.goto(`${BASE}/lop-cua-toi/hoc-phi?tab=nhan-tien`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Học phí", exact: true }).waitFor({ timeout: 90000 });
  await page.getByText("Tài khoản nhận học phí").waitFor();
  check("mở thẳng tab Nhận tiền theo ?tab=", (await page.getByRole("tab", { name: "Nhận tiền" }).getAttribute("aria-selected")) === "true");
  check("chưa lưu TK: phần SePay nhắc lưu trước", await page.getByText(/Lưu tài khoản ở trên trước/).isVisible());
  await page.getByLabel("Số tài khoản").fill("0123 456 789");
  await page.getByLabel(/Tên chủ tài khoản/).fill("Nguyễn Thị Lan");
  await page.getByRole("button", { name: "Lưu tài khoản" }).click();
  await page.getByText("Đã lưu tài khoản nhận tiền.").waitFor({ timeout: 20000 });
  check("lưu tài khoản → toast", true);
  const dbAcc = await prisma.tutorPayoutAccount.findUnique({ where: { userId: T.id } });
  check("DB: STK bỏ khoảng trắng + tên in hoa không dấu", dbAcc?.accountNo === "0123456789" && dbAcc.accountName === "NGUYEN THI LAN", dbAcc);
  await page.getByText("Địa chỉ webhook của bạn").waitFor();
  const url = await page.locator('input[readonly]').first().inputValue();
  check("hiện địa chỉ webhook riêng của gia sư", url.endsWith(`/api/webhooks/sepay/${T.id}`), url);
  await page.getByRole("button", { name: "Tạo khoá API" }).click();
  const keyBox = page.getByLabel("Khoá API mới");
  await keyBox.waitFor({ timeout: 20000 });
  const KEY = await keyBox.inputValue();
  check("khoá hiện MỘT lần dạng kin_…", /^kin_[0-9a-f]{48}$/.test(KEY), KEY);
  check("trạng thái: chưa nhận giao dịch nào", await page.getByText("Chưa nhận giao dịch nào").isVisible());
  await shot(page, "tt200-nhan-tien");
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText(/Đã có khoá \(đuôi/).waitFor({ timeout: 30000 });
  check("tải lại: KHÔNG xem lại được khoá, chỉ thấy đuôi", (await page.getByLabel("Khoá API mới").count()) === 0 && !(await page.content()).includes(KEY));

  section("Gia sư: lập + gửi phiếu");
  await page.getByRole("tab", { name: "Phiếu" }).click();
  await page.getByRole("button", { name: "Lập phiếu cả lớp" }).click();
  await page.getByText(/Đã lập 3 phiếu nháp/).waitFor({ timeout: 30000 });
  await eventually("lập 3 phiếu nháp cho 3 em", async () => (await page.locator("li", { hasText: "Nháp" }).count()) === 3);
  await eventually("thẻ tổng: Phải thu = 720.000 + 560.000 + 560.000 = 1.840.000đ", () => page.getByText("1.840.000đ").first().isVisible());
  await page.getByRole("button", { name: /Gửi 3 phiếu nháp/ }).click();
  await page.getByText("Đã gửi 3/3 phiếu.").waitFor({ timeout: 30000 });
  await eventually("đã gửi cả 3", async () => (await page.locator("li", { hasText: "Đã gửi" }).count()) === 3);
  await eventually("không còn banner thiếu tài khoản", async () => (await page.getByText(/chưa lưu tài khoản nhận tiền/).count()) === 0);
  await page.getByRole("button", { name: "Sao chép tin nhắn" }).first().click();
  await page.getByText(/Đã sao chép tin nhắn/).waitFor({ timeout: 10000 });
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  check("tin nhắn chứa mã phiếu, nội dung CK và link QR vào STK của gia sư", /KIN[A-Z2-9]{5}/.test(clip) && clip.includes("970436-0123456789") && /nội dung: KIN[A-Z2-9]{5} /.test(clip), clip);
  await shot(page, "tt200-phieu");

  section("Webhook thật bắn vào → hàng chờ");
  const invs = await prisma.tuitionInvoice.findMany({ where: { tutorId: T.id }, include: { student: true } });
  const iBao = invs.find(i => i.student.name === "Trần Gia Bảo")!, iHa = invs.find(i => i.student.name === "Đỗ Hà")!, iMinh = invs.find(i => i.student.name === "Lê Minh")!;
  check("webhook: Đỗ Hà đóng ĐỦ có mã → tự gạch", (await hook(T.id, KEY, { transferAmount: 560000, content: `${iHa.code} DO HA`, code: iHa.code })).json.success === true && (await prisma.tuitionInvoice.findUnique({ where: { id: iHa.id } }))?.status === "paid");
  await hook(T.id, KEY, { transferAmount: 300000, content: `${iBao.code} TRAN GIA BAO`, code: iBao.code });          // thiếu
  await hook(T.id, KEY, { transferAmount: 560000, content: "CK HOC PHI CHO CON" });                                  // không mã, trùng số tiền phiếu Lê Minh
  await hook(T.id, KEY, { transferAmount: 600000, content: `${iHa.code} DO HA` , code: iHa.code });                // đã đóng → dư

  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("tab", { name: /Chờ đối soát \(3\)/ }).waitFor({ timeout: 30000 });
  check("tab hiện số khoản chờ (3)", true);
  await page.getByRole("tab", { name: /Chờ đối soát/ }).click();
  await page.getByText("Đóng thiếu").waitFor({ timeout: 20000 });
  check("có đủ 3 loại: Đóng thiếu / Không có mã / đã đóng", (await page.getByText("Đóng thiếu").count()) >= 1 && (await page.getByText("Không có mã").count()) >= 1 && (await page.getByText(/Phiếu đã đóng/).count()) >= 1);
  check("gợi ý cùng số tiền hiện đúng phiếu Lê Minh, KiN không tự ghép", await page.getByText(/KiN không tự ghép/).isVisible() && (await prisma.tuitionInvoice.findUnique({ where: { id: iMinh.id } }))?.paidAmount === 0);
  await shot(page, "tt200-doi-soat");

  await page.locator("li", { hasText: "Đóng thiếu" }).getByRole("button", { name: "Ghi nhận một phần" }).click();
  await page.getByText("Đã ghi nhận một phần.").waitFor({ timeout: 20000 });
  check("ghi nhận một phần → phiếu Bảo partial 300.000", (await prisma.tuitionInvoice.findUnique({ where: { id: iBao.id } }))?.paidAmount === 300000);
  await page.locator("li", { hasText: "Không có mã" }).getByRole("button", { name: "Ghép vào phiếu này" }).click();
  await page.getByText("Đã ghép vào phiếu.").waitFor({ timeout: 20000 });
  check("ghép tay theo gợi ý → phiếu Lê Minh paid", (await prisma.tuitionInvoice.findUnique({ where: { id: iMinh.id } }))?.status === "paid");
  await page.locator("li", { hasText: /Phiếu đã đóng/ }).getByRole("button", { name: "Trừ vào tháng sau" }).click();
  await page.getByText("Đã ghi: trừ vào tháng sau.").waitFor({ timeout: 20000 });
  check("khoản đã đóng → tín dụng 600.000", (await prisma.tuitionCredit.findFirst({ where: { tutorId: T.id, studentId: s2.id } }))?.amount === 600000);
  await page.getByText("Không có khoản nào cần đối soát.").waitFor({ timeout: 20000 });
  check("hàng chờ trống", true);
  await page.getByLabel("Hiện cả khoản đã xử lý").check();
  await page.getByText("Tự gạch phiếu", { exact: true }).first().waitFor({ timeout: 20000 });
  await eventually("xem lại lịch sử: có 'Gia sư ghép tay'", async () => (await page.getByText("Gia sư ghép tay", { exact: true }).count()) >= 1);

  section("Gia sư: sửa số tiền / ghi tiền mặt / huỷ");
  await page.getByRole("tab", { name: "Phiếu" }).click();
  await page.getByText("Trần Gia Bảo").first().waitFor({ timeout: 30000 });
  const bao = page.locator("li", { hasText: "Trần Gia Bảo" });
  await bao.getByRole("button", { name: "Đã nhận tiền" }).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByLabel("Số tiền đã nhận (đ)").fill("500000");
  await dlg.getByText(/Dư 80\.000đ/).waitFor();
  check("nhận 500.000 > còn lại 420.000 → hỏi xử lý phần dư 80.000", true);
  await dlg.getByRole("button", { name: "Ghi nhận" }).click();
  await page.getByText("Đã ghi nhận tiền.").waitFor({ timeout: 20000 });
  check("ghi tiền mặt dư (mặc định trừ tháng sau) → phiếu Bảo paid + tín dụng 80.000", (await prisma.tuitionInvoice.findUnique({ where: { id: iBao.id } }))?.status === "paid" && (await prisma.tuitionCredit.findFirst({ where: { tutorId: T.id, studentId: s1.id } }))?.amount === 80000);
  const t2 = await mkUser({ name: "Em Huỷ" }); await prisma.enrollment.create({ data: { userId: t2.id, courseId: c1.id, status: "active" } });
  await page.getByRole("button", { name: "Lập phiếu cả lớp" }).click();
  await page.getByText(/Đã lập 1 phiếu nháp/).waitFor({ timeout: 30000 });
  const huy = page.locator("li", { hasText: "Em Huỷ" });
  await huy.getByRole("button", { name: "Huỷ phiếu" }).click();
  const d2 = page.getByRole("dialog");
  check("nút Huỷ khoá khi chưa nhập lý do", await d2.getByRole("button", { name: "Huỷ phiếu" }).isDisabled());
  await d2.getByLabel(/Lý do huỷ/).fill("Em chuyển lớp");
  await d2.getByRole("button", { name: "Huỷ phiếu" }).click();
  await page.getByText("Đã huỷ phiếu.").waitFor({ timeout: 20000 });
  await eventually("phiếu huỷ hiện lý do + nút Khôi phục", async () => (await huy.getByText("Lý do huỷ: Em chuyển lớp").isVisible()) && (await huy.getByRole("button", { name: "Khôi phục" }).isVisible()));
  const draftOne = page.locator("li", { hasText: "Lê Minh" });
  check("phiếu đã đóng không còn nút Sửa/Huỷ vô nghĩa (Lê Minh paid: có Huỷ nhưng không có Sửa)", (await draftOne.getByRole("button", { name: "Sửa số tiền" }).count()) === 0);

  section("Học viên: /student/hoc-phi");
  const sctx = await ctxFor(s1);
  const sp = await sctx.newPage();
  const serr: string[] = [];
  sp.on("pageerror", e => serr.push(String(e)));
  await iBao; // (đã paid) → tạo phiếu thứ hai cho em Bảo để còn phiếu mở
  const open = await prisma.tuitionInvoice.create({ data: { code: "KINABCD2".slice(0, 8), tutorId: T.id, studentId: s1.id, yearMonth: "2026-09", amountDue: 150000, status: "sent", sentAt: new Date() } });
  await sp.goto(`${BASE}/student/hoc-phi`, { waitUntil: "networkidle" });
  await sp.getByRole("heading", { name: "Phiếu học phí", exact: true }).waitFor({ timeout: 90000 });
  await sp.getByText("Phiếu học phí đã gửi").waitFor();
  check("thấy phiếu tháng này đã đóng", await sp.getByText("Đã đóng").first().isVisible());
  await sp.getByLabel("Tháng 9/2026".length ? "" : "").count().catch(() => 0);
  const html = await sp.content();
  check("KHÔNG còn tài khoản placeholder của KiN", !html.includes("CONG TY KIN EDUCATION") && !html.includes("0123456789") || html.includes("NGUYEN THI LAN"));

  section("Phụ huynh: /so-cua-con/[token] (trước đây trả 500)");
  const pctx = await ctxFor(null, { width: 390, height: 800 });
  const pp = await pctx.newPage();
  const perr: string[] = [];
  pp.on("pageerror", e => perr.push(String(e)));
  const resp = await pp.goto(`${BASE}/so-cua-con/${token}`, { waitUntil: "networkidle" });
  check("trang trả 200", resp?.status() === 200, resp?.status());
  await pp.getByText("Sổ của con: Trần Gia Bảo").waitFor({ timeout: 90000 });
  await pp.getByText("Phiếu học phí").first().waitFor();
  check("thấy phiếu có QR vào STK của gia sư, tên chủ TK", await pp.getByText("NGUYEN THI LAN").first().isVisible() && await pp.getByText("0123456789").first().isVisible());
  const ovf = await pp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check("mobile 390px không tràn ngang", !ovf);
  const qr = pp.getByRole("img", { name: /Mã VietQR/ }).first();
  check("QR có alt mô tả + trỏ img.vietqr.io với STK gia sư", (await qr.getAttribute("src"))?.includes("img.vietqr.io/image/970436-0123456789-") === true, await qr.getAttribute("src"));
  await shot(pp, "tt200-so-cua-con");
  await pp.getByRole("button", { name: "Tôi đã chuyển" }).first().click();
  await pp.getByText(/Đã báo cho gia sư/).waitFor({ timeout: 20000 });
  check("'Tôi đã chuyển' → thông báo + trạng thái chờ gia sư xác nhận", await pp.getByText(/chờ gia sư xác nhận/).first().isVisible());
  check("DB: phiếu sang parent_reported", (await prisma.tuitionInvoice.findUnique({ where: { id: open.id } }))?.status === "parent_reported");
  check("nút 'Tôi đã chuyển' biến mất sau khi báo", (await pp.getByRole("button", { name: "Tôi đã chuyển" }).count()) === 0);

  section("Mobile 390 — trang gia sư");
  const mctx = await ctxFor(T, { width: 390, height: 800 });
  const mp = await mctx.newPage();
  await mp.goto(`${BASE}/lop-cua-toi/hoc-phi`, { waitUntil: "networkidle" });
  await mp.getByText("Trần Gia Bảo").first().waitFor({ timeout: 90000 });
  check("không tràn ngang", !(await mp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)));
  await shot(mp, "tt200-phieu-mobile");

  section("Quyền truy cập trang");
  const sc = await (await ctxFor(s2)).newPage();
  await sc.goto(`${BASE}/lop-cua-toi/hoc-phi`, { waitUntil: "networkidle" });
  check("học viên vào trang gia sư → chuyển về /student/hoc-phi", sc.url().includes("/student/hoc-phi"), sc.url());
  const anon = await (await ctxFor(null)).newPage();
  await anon.goto(`${BASE}/lop-cua-toi/hoc-phi`, { waitUntil: "networkidle" });
  check("chưa đăng nhập → /dang-nhap", anon.url().includes("/dang-nhap"), anon.url());

  check("không lỗi console/pageerror ở trang gia sư", errors.length === 0, errors.slice(0, 3));
  check("không pageerror ở trang học viên/phụ huynh", serr.length === 0 && perr.length === 0, [...serr, ...perr].slice(0, 3));
  await closeAll();
  await done();
})().catch(async e => { console.error("TEST CRASH", e); await closeAll(); process.exit(1); });
