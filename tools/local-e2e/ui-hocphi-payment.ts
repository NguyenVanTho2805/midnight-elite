// HP-20 + HP-21 — giao diện gia sư: hộp "Ghi nhận tiền" có ngày thu + hình thức; "Khoản đã thu" → màn rà soát hoàn tác
// (Giữ nguyên / Xác nhận hoàn tác, bắt lý do); khoản SePay hoàn tác quay lại tab Chờ đối soát. 390px không tràn ngang.
import { api, mkUser, mkTutor, mkCourse, wipe, check, section, done, BASE } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";
import { vnDateKeyOf } from "@/lib/classSessions";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");
  const s1 = await mkUser({ name: "Trần Gia Bảo" }), s2 = await mkUser({ name: "Đỗ Hà" });
  const c1 = await mkCourse(T.id, { name: "Toán 9" });
  for (const s of [s1, s2]) await prisma.enrollment.create({ data: { userId: s.id, courseId: c1.id, status: "active" } });
  const YM = vnDateKeyOf(new Date()).slice(0, 7);
  await prisma.monthlyCourseFee.create({ data: { courseId: c1.id, yearMonth: YM, sessionCount: 8, updatedBy: T.id } });
  await api("PUT", "/api/tutor/payout-account", { as: T, body: { bankBin: "970436", accountNo: "0123456789", accountName: "Nguyen Thi Lan" } });
  const KEY = (await api("POST", "/api/tutor/payout-account/webhook-key", { as: T })).json.key as string;
  const iss = await api("POST", "/api/tutor/invoices", { as: T, body: { yearMonth: YM } });
  const iBao = iss.json.created.find((c: any) => c.studentId === s1.id), iHa = iss.json.created.find((c: any) => c.studentId === s2.id);
  for (const i of [iBao, iHa]) await api("PATCH", `/api/tutor/invoices/${i.id}`, { as: T, body: { action: "send" } });
  // Phiếu Hà: SePay tự gạch NHẦM (để thử hoàn tác ghép sai).
  await api("POST", `/api/webhooks/sepay/${T.id}`, { headers: { authorization: `Apikey ${KEY}` }, body: { id: 77001, transferType: "in", transferAmount: 560000, content: `${iHa.code} DO HA`, code: iHa.code, transactionDate: `${vnDateKeyOf(new Date())} 09:00:00` } });
  check("nền: phiếu Hà tự gạch đủ", (await prisma.tuitionInvoice.findUnique({ where: { id: iHa.id } }))?.status === "paid");

  await launch();
  const ctx = await ctxFor(T, { width: 390, height: 844 });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error" && !/favicon|font|Failed to load resource|vietqr/i.test(m.text())) errors.push(m.text()); });

  section("Ghi nhận tiền: ngày thu + hình thức");
  await page.goto(`${BASE}/lop-cua-toi/hoc-phi`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Học phí", exact: true }).waitFor({ timeout: 90000 });
  const bao = page.locator("li", { hasText: "Trần Gia Bảo" });
  await bao.getByRole("button", { name: "Đã nhận tiền" }).waitFor({ timeout: 60000 });
  await bao.getByRole("button", { name: "Đã nhận tiền" }).click();
  const dlg = page.getByRole("dialog");
  check("hộp có ô Ngày thu (mặc định hôm nay, không cho chọn ngày mai) và 2 hình thức", (await dlg.getByLabel("Ngày thu").inputValue()) === vnDateKeyOf(new Date()) && (await dlg.getByLabel("Ngày thu").getAttribute("max")) === vnDateKeyOf(new Date()) && await dlg.getByRole("radio", { name: "Tiền mặt" }).isChecked() && await dlg.getByRole("radio", { name: "Chuyển khoản" }).isVisible());
  const firstOfMonth = `${YM}-01`;
  await dlg.getByLabel("Số tiền đã nhận (đ)").fill("200000");
  await dlg.getByLabel("Ngày thu").fill(firstOfMonth);
  await dlg.getByRole("radio", { name: "Chuyển khoản" }).check();
  await shot(page, "hocphi-ghi-nhan-390");
  await dlg.getByRole("button", { name: "Ghi nhận" }).click();
  await page.getByText("Đã ghi nhận tiền.").waitFor({ timeout: 20000 });
  const tx = await prisma.bankTransaction.findFirstOrThrow({ where: { invoiceId: iBao.id } });
  check("DB: ngày thu = ngày đầu tháng (12:00 VN), hình thức chuyển khoản", tx.method === "bank_transfer" && vnDateKeyOf(tx.occurredAt) === firstOfMonth && tx.amount === 200000, tx);

  section("Khoản đã thu → màn rà soát hoàn tác");
  await bao.getByRole("button", { name: "Khoản đã thu" }).click();
  const list = page.getByRole("dialog").first();
  await list.getByText("Chuyển khoản (ghi tay)").waitFor({ timeout: 20000 });
  check("danh sách khoản đã thu nêu hình thức + số tiền", await list.getByText("200.000đ").first().isVisible());
  await list.getByRole("button", { name: "Hoàn tác…" }).click();
  const rv = page.getByRole("dialog", { name: "Rà soát hoàn tác khoản đã thu" });
  await rv.getByText("Điều sẽ đổi nếu xác nhận", { exact: false }).waitFor({ timeout: 20000 }).catch(() => {});
  await rv.getByText("Còn lại").waitFor({ timeout: 20000 });
  check("rà soát nêu: đã nhận 200.000đ → 0đ, còn lại 560.000đ", await rv.getByText(/200\.000đ → 0đ/).isVisible() && await rv.getByText("560.000đ").first().isVisible());
  check("[phá] nút Xác nhận khoá khi chưa nhập lý do", await rv.getByRole("button", { name: "Xác nhận hoàn tác" }).isDisabled());
  await rv.getByRole("button", { name: "Giữ nguyên" }).click();
  check("'Giữ nguyên' không đổi gì", (await prisma.tuitionInvoice.findUnique({ where: { id: iBao.id } }))?.paidAmount === 200000 && (await prisma.paymentReversal.count()) === 0);
  await list.getByRole("button", { name: "Hoàn tác…" }).click();
  await rv.getByLabel(/Lý do hoàn tác/).fill("Ghi nhầm hình thức");
  await rv.getByRole("button", { name: "Xác nhận hoàn tác" }).click();
  await page.getByText("Đã hoàn tác khoản ghi tay.").waitFor({ timeout: 20000 });
  check("hoàn tác xong: phiếu Bảo về 0đ đã nhận + 1 dòng nhật ký có lý do", (await prisma.tuitionInvoice.findUnique({ where: { id: iBao.id } }))?.paidAmount === 0 && (await prisma.paymentReversal.findFirst({ where: { invoiceId: iBao.id } }))?.reason === "Ghi nhầm hình thức");

  section("Hoàn tác ghép sai (SePay) từ tab Chờ đối soát");
  await page.goto(`${BASE}/lop-cua-toi/hoc-phi?tab=doi-soat`, { waitUntil: "networkidle" });
  await page.getByLabel("Hiện cả khoản đã xử lý").check();
  const row = page.locator("li", { hasText: "560.000đ" }).first();
  await row.getByRole("button", { name: "Hoàn tác khoản này…" }).click();
  const rv2 = page.getByRole("dialog", { name: "Rà soát hoàn tác khoản đã thu" });
  await rv2.getByText(/quay lại hàng chờ đối soát/).waitFor({ timeout: 20000 });
  check("nói rõ tiền thật quay lại hàng chờ, không bị xoá", true);
  await rv2.getByLabel(/Lý do hoàn tác/).fill("Phụ huynh chuyển nhầm mã");
  await rv2.getByRole("button", { name: "Xác nhận hoàn tác" }).click();
  await page.getByText(/Đã hoàn tác\. Khoản tiền quay lại hàng chờ/).waitFor({ timeout: 20000 });
  const back = await prisma.bankTransaction.findFirstOrThrow({ where: { providerTxId: "77001" } });
  check("khoản về pending, phiếu Hà về 'sent'", back.status === "pending" && (await prisma.tuitionInvoice.findUnique({ where: { id: iHa.id } }))?.status === "sent");
  await page.getByLabel("Hiện cả khoản đã xử lý").uncheck();
  await page.getByText("Ghép vào phiếu…").first().waitFor({ timeout: 20000 });
  check("khoản xuất hiện trong hàng chờ với nút ghép lại", true);
  check("390px: không tràn ngang", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await shot(page, "hocphi-cho-doi-soat-390");
  check("không lỗi console / pageerror", errors.length === 0, errors.slice(0, 3));
  await closeAll();
  await done();
})();
