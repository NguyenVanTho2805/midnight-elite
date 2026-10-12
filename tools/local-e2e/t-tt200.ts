import { api, mkUser, mkTutor, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { generatePortalToken } from "@/lib/parentPortal";

let seq = 5000;
async function hook(tutorId: string, key: string | null, p: Record<string, unknown>) {
  return api("POST", `/api/webhooks/sepay/${tutorId}`, {
    headers: key ? { authorization: `Apikey ${key}` } : {},
    body: { id: ++seq, gateway: "MBBank", transactionDate: "2026-10-01 20:14:00", accountNumber: "0123456789", transferType: "in", accumulated: 19077000, referenceCode: "FT26", ...p },
  });
}
const bt = (id: string) => prisma.bankTransaction.findUnique({ where: { id } });

(async () => {
  await wipe();
  const T1 = await mkTutor("Cô Lan"), T2 = await mkTutor("Thầy Minh");
  const s1 = await mkUser({ name: "Trần Gia Bảo" }), s2 = await mkUser({ name: "Đỗ Hà" }), parent = await mkUser({ name: "Phụ Huynh" }), stranger = await mkUser({ name: "Người Lạ" });
  const c1 = await mkCourse(T1.id, { name: "Toán 9" }), c2 = await mkCourse(T1.id, { name: "Lý 9" }), c3 = await mkCourse(T2.id, { name: "Hoá 9" });
  for (const [u, c] of [[s1, c1], [s1, c2], [s2, c1], [s1, c3]] as const) await prisma.enrollment.create({ data: { userId: u.id, courseId: c.id, status: "active" } });
  for (const ym of ["2026-10", "2026-11", "2026-12"]) {
    await prisma.monthlyCourseFee.create({ data: { courseId: c1.id, yearMonth: ym, sessionCount: 8, updatedBy: T1.id } });
    await prisma.monthlyCourseFee.create({ data: { courseId: c2.id, yearMonth: ym, sessionCount: 4, updatedBy: T1.id } });
    await prisma.monthlyCourseFee.create({ data: { courseId: c3.id, yearMonth: ym, sessionCount: 5, updatedBy: T2.id } });
  }
  const token = generatePortalToken();
  await prisma.parentLink.create({ data: { parentId: parent.id, studentId: s1.id, status: "verified", verifiedAt: new Date(), portalToken: token } });

  section("A. Tài khoản nhận tiền + khoá webhook");
  check("ẩn danh → 401", (await api("GET", "/api/tutor/payout-account")).status === 401);
  check("học viên → 403", (await api("GET", "/api/tutor/payout-account", { as: s1 })).status === 403);
  const g0 = await api("GET", "/api/tutor/payout-account", { as: T1 });
  check("chưa có tài khoản; có địa chỉ webhook riêng", g0.status === 200 && g0.json.account === null && g0.json.webhookUrl.endsWith(`/api/webhooks/sepay/${T1.id}`), g0.json);
  check("BIN sai → 400", (await api("PUT", "/api/tutor/payout-account", { as: T1, body: { bankBin: "123", accountNo: "123456", accountName: "AB" } })).status === 400);
  check("lấy khoá khi chưa lưu tài khoản → 409", (await api("POST", "/api/tutor/payout-account/webhook-key", { as: T1 })).status === 409);
  const put = await api("PUT", "/api/tutor/payout-account", { as: T1, body: { bankBin: "970436", accountNo: " 0123 456 789 ", accountName: "Nguyễn Thị Lan" } });
  check("lưu tài khoản 200, tên in hoa không dấu", put.status === 200 && put.json.account.accountName === "NGUYEN THI LAN" && put.json.account.accountNo === "0123456789", put.json);
  const k1 = await api("POST", "/api/webhooks/../tutor/payout-account/webhook-key".replace("/api/webhooks/..", "/api"), { as: T1 });
  check("cấp khoá: kin_ + 48 hex, no-store", k1.status === 200 && /^kin_[0-9a-f]{48}$/.test(k1.json.key) && k1.headers.get("cache-control") === "no-store", k1.json);
  const KEY1 = k1.json.key;
  const dbAcc = await prisma.tutorPayoutAccount.findUnique({ where: { userId: T1.id } });
  check("DB chỉ lưu BĂM, không có khoá rõ", !!dbAcc?.webhookKeyHash && !JSON.stringify(dbAcc).includes(KEY1) && dbAcc.webhookKeyHint === KEY1.slice(-4), dbAcc);
  const g1 = await api("GET", "/api/tutor/payout-account", { as: T1 });
  check("GET không trả khoá, báo hasKey + chưa nhận giao dịch", g1.json.account.hasKey === true && g1.json.account.seenAt === null && !JSON.stringify(g1.json).includes(KEY1), g1.json);
  const k2 = await api("POST", "/api/tutor/payout-account/webhook-key", { as: T1 });
  const KEY2 = k2.json.key;
  check("cấp lại khoá → khoá mới khác khoá cũ", KEY2 !== KEY1);
  check("khoá cũ chết ngay (401)", (await hook(T1.id, KEY1, { transferAmount: 1000, content: "x" })).status === 401);
  await api("PUT", "/api/tutor/payout-account", { as: T2, body: { bankBin: "970422", accountNo: "999888777", accountName: "Minh" } });
  const KEY_T2 = (await api("POST", "/api/tutor/payout-account/webhook-key", { as: T2 })).json.key;

  section("B. Lập phiếu");
  check("thiếu yearMonth → 400", (await api("POST", "/api/tutor/invoices", { as: T1, body: {} })).status === 400);
  check("học viên không lập được → 403", (await api("POST", "/api/tutor/invoices", { as: s1, body: { yearMonth: "2026-10" } })).status === 403);
  const iss = await api("POST", "/api/tutor/invoices", { as: T1, body: { yearMonth: "2026-10" } });
  check("lập cho cả lớp: 2 phiếu", iss.status === 201 && iss.json.created.length === 2, iss.json);
  const inv1 = iss.json.created.find((c: any) => c.studentId === s1.id), inv2 = iss.json.created.find((c: any) => c.studentId === s2.id);
  check("em 2 môn × 60k: 8 buổi Toán + 4 buổi Lý = 720.000", inv1.amountDue === 720_000, inv1);
  check("em 1 môn × 70k × 8 buổi = 560.000", inv2.amountDue === 560_000, inv2);
  check("mã đúng dạng KIN + 5 ký tự, khác nhau", /^KIN[A-HJKMNP-Z2-9]{5}$/.test(inv1.code) && /^KIN[A-HJKMNP-Z2-9]{5}$/.test(inv2.code) && inv1.code !== inv2.code);
  check("chỉ môn của GIA SƯ NÀY: em 1 còn học Hoá (T2) nhưng không tính vào phiếu T1", inv1.amountDue === 720_000);
  const again = await api("POST", "/api/tutor/invoices", { as: T1, body: { yearMonth: "2026-10" } });
  check("lập lại: bỏ qua, không trùng phiếu", again.json.created.length === 0 && again.json.skipped.length === 2 && /Đã có phiếu/.test(again.json.skipped[0].reason), again.json);
  check("DB: đúng 2 phiếu tháng 10 của T1", (await prisma.tuitionInvoice.count({ where: { tutorId: T1.id, yearMonth: "2026-10" } })) === 2);
  const iss2 = await api("POST", "/api/tutor/invoices", { as: T2, body: { yearMonth: "2026-10" } });
  check("T2 lập phiếu Hoá cho em 1 (5 buổi × 70k = 350.000) — tách biệt T1", iss2.json.created.length === 1 && iss2.json.created[0].amountDue === 350_000, iss2.json);
  const invT2 = iss2.json.created[0];
  check("gia sư không có lớp ở tháng chưa nhập số buổi → bỏ qua", (await api("POST", "/api/tutor/invoices", { as: T1, body: { yearMonth: "2027-01" } })).json.skipped.every((x: any) => /số buổi/.test(x.reason)));
  check("học bổng cho nhiều em → 400", (await api("POST", "/api/tutor/invoices", { as: T1, body: { yearMonth: "2026-11", scholarship: 1000 } })).status === 400);
  check("T2 không thấy phiếu của T1", (await api("GET", "/api/tutor/invoices?yearMonth=2026-10", { as: T2 })).json.items.length === 1);
  check("T2 không sửa được phiếu của T1 → 404", (await api("PATCH", `/api/tutor/invoices/${inv1.id}`, { as: T2, body: { action: "send" } })).status === 404);
  check("phiếu nháp ẩn với học viên", (await api("GET", "/api/users/me/invoices", { as: s1 })).json.invoices.length === 0);

  section("C. Gửi phiếu + học viên/phụ huynh xem (QR vào tài khoản GIA SƯ)");
  check("gửi phiếu 200", (await api("PATCH", `/api/tutor/invoices/${inv1.id}`, { as: T1, body: { action: "send" } })).status === 200);
  check("gửi lại idempotent", (await api("PATCH", `/api/tutor/invoices/${inv1.id}`, { as: T1, body: { action: "send" } })).json.alreadySent === true);
  await api("PATCH", `/api/tutor/invoices/${inv2.id}`, { as: T1, body: { action: "send" } });
  await api("PATCH", `/api/tutor/invoices/${invT2.id}`, { as: T2, body: { action: "send" } });
  const mine = await api("GET", "/api/users/me/invoices?yearMonth=2026-10", { as: s1 });
  check("em 1 thấy 2 phiếu (T1 và T2)", mine.json.invoices.length === 2, mine.json);
  const v1 = mine.json.invoices.find((i: any) => i.code === inv1.code);
  check("QR của phiếu T1 dùng STK của T1 (970436-0123456789), đúng 720000", v1.qrUrl.includes("/970436-0123456789-") && v1.qrUrl.includes("amount=720000") && v1.qrUrl.includes(`addInfo=${inv1.code}`), v1.qrUrl);
  check("nội dung CK = mã + tên không dấu hoa", v1.transferContent === `${inv1.code} TRAN GIA BAO`, v1.transferContent);
  check("không có số TK placeholder cũ của KiN (0123456789 ≠ KIN EDUCATION)", !JSON.stringify(mine.json).includes("CONG TY KIN EDUCATION"));
  const vT2 = mine.json.invoices.find((i: any) => i.code === invT2.code);
  check("phiếu T2 dùng STK của T2 (970422-999888777)", vT2.qrUrl.includes("/970422-999888777-"), vT2.qrUrl);
  check("người lạ không thấy phiếu của em", (await api("GET", "/api/users/me/invoices", { as: stranger })).json.invoices.length === 0);
  const portal = await api("GET", `/api/parent-portal/${token}?yearMonth=2026-10`);
  check("cổng phụ huynh có phiếu + QR", portal.status === 200 && portal.json.invoices.length === 2 && portal.json.invoices.every((i: any) => i.qrUrl), portal.json.invoices);
  check("cổng KHÔNG lộ id phiếu của gia sư khác/ email", !JSON.stringify(portal.json).includes("@test.local"));
  const rep = await api("POST", `/api/parent-portal/${token}/invoices/${inv1.code}/reported`);
  check("'Tôi đã chuyển' qua cổng → 200", rep.status === 200 && rep.json.alreadyReported === false, rep);
  check("phiếu sang parent_reported", (await prisma.tuitionInvoice.findUnique({ where: { id: inv1.id } }))?.status === "parent_reported");
  check("bấm lại → alreadyReported", (await api("POST", `/api/parent-portal/${token}/invoices/${inv1.code}/reported`)).json.alreadyReported === true);
  check("token rác → 404", (await api("POST", `/api/parent-portal/${"z".repeat(32)}/invoices/${inv1.code}/reported`)).status === 404);
  check("báo phiếu CỦA EM KHÁC bằng token này → 404", (await api("POST", `/api/parent-portal/${token}/invoices/${inv2.code}/reported`)).status === 404);
  check("mã phiếu sai định dạng → 404", (await api("POST", `/api/parent-portal/${token}/invoices/KIN00000/reported`)).status === 404);
  check("học viên báo phiếu của người khác → 404", (await api("POST", `/api/users/me/invoices/${inv2.code}/reported`, { as: s1 })).status === 404);

  section("D. Webhook SePay — xác thực");
  check("không có Authorization → 401", (await hook(T1.id, null, { transferAmount: 1, content: "x" })).status === 401);
  check("khoá sai → 401", (await hook(T1.id, "kin_sai", { transferAmount: 1, content: "x" })).status === 401);
  check("khoá của T2 dùng cho T1 → 401", (await hook(T1.id, KEY_T2, { transferAmount: 1, content: "x" })).status === 401);
  check("gia sư không tồn tại → 401 (không lộ)", (await hook("khongtontai123", KEY2, { transferAmount: 1, content: "x" })).status === 401);
  check("tutorId lạ ký tự → 401", (await hook("a b", KEY2, { transferAmount: 1, content: "x" })).status === 401);
  const out = await hook(T1.id, KEY2, { transferType: "out", transferAmount: 5000, content: "rut tien" });
  check("tiền RA → 200 bỏ qua, không lưu", out.status === 200 && out.json.ignored === true && (await prisma.bankTransaction.count({ where: { tutorId: T1.id } })) === 0, out.json);
  check("payload thiếu số tiền → 400", (await hook(T1.id, KEY2, { transferAmount: undefined, content: "x" })).status === 400);
  check("số tiền lẻ → 400", (await hook(T1.id, KEY2, { transferAmount: 100.5, content: "x" })).status === 400);
  check("chưa nhận giao dịch hợp lệ nào → seenAt vẫn null", (await prisma.tutorPayoutAccount.findUnique({ where: { userId: T1.id } }))?.webhookSeenAt === null);

  section("E. Khớp đủ → tự gạch");
  const idExact = ++seq;
  const e1 = await api("POST", `/api/webhooks/sepay/${T1.id}`, { headers: { authorization: `Apikey ${KEY2}` }, body: { id: idExact, transferType: "in", transferAmount: 720000, content: `${inv1.code} TRAN GIA BAO`, code: inv1.code, accumulated: 19077000, transactionDate: "2026-10-01 20:14:00" } });
  check("200 success", e1.status === 200 && e1.json.success === true, e1);
  const afterE = await prisma.tuitionInvoice.findUnique({ where: { id: inv1.id } });
  check("phiếu 'Đã đóng', paid=720.000, có paidAt", afterE?.status === "paid" && afterE.paidAmount === 720000 && !!afterE.paidAt, afterE);
  const txE = await prisma.bankTransaction.findFirst({ where: { tutorId: T1.id, providerTxId: String(idExact) } });
  check("giao dịch matched/auto_matched, applied 720.000, gắn phiếu", txE?.status === "matched" && txE.resolution === "auto_matched" && txE.appliedAmount === 720000 && txE.invoiceId === inv1.id, txE);
  check("giờ SePay lưu đúng (20:14 VN = 13:14 UTC)", txE?.occurredAt.toISOString() === "2026-10-01T13:14:00.000Z", txE?.occurredAt);
  check("KHÔNG lưu số dư tài khoản (accumulated) ở đâu cả", !JSON.stringify(txE).includes("19077000"));
  check("webhookSeenAt đã set → 'Đang nối SePay'", !!(await prisma.tutorPayoutAccount.findUnique({ where: { userId: T1.id } }))?.webhookSeenAt);
  check("gia sư được thông báo đã gạch phiếu", (await prisma.notification.count({ where: { userId: T1.id, type: "invoice_paid" } })) === 1);
  check("phụ huynh thấy phiếu 'Đã đóng' ngay", (await api("GET", `/api/parent-portal/${token}?yearMonth=2026-10`)).json.invoices.find((i: any) => i.code === inv1.code).status === "paid");

  section("F. Trùng (SePay gửi lại) — không cộng đôi");
  const d1 = await api("POST", `/api/webhooks/sepay/${T1.id}`, { headers: { authorization: `Apikey ${KEY2}` }, body: { id: idExact, transferType: "in", transferAmount: 720000, content: `${inv1.code}`, code: inv1.code } });
  check("gửi lại cùng id → success + duplicate", d1.status === 200 && d1.json.duplicate === true, d1.json);
  check("vẫn đúng 1 giao dịch, phiếu vẫn paid=720.000", (await prisma.bankTransaction.count({ where: { tutorId: T1.id, providerTxId: String(idExact) } })) === 1 && (await prisma.tuitionInvoice.findUnique({ where: { id: inv1.id } }))?.paidAmount === 720000);
  const idRace = ++seq;
  const racePayload = { id: idRace, transferType: "in", transferAmount: 560000, content: `${inv2.code} DO HA`, code: inv2.code };
  const race = await Promise.all(Array.from({ length: 6 }, () => api("POST", `/api/webhooks/sepay/${T1.id}`, { headers: { authorization: `Apikey ${KEY2}` }, body: racePayload })));
  check("6 webhook SONG SONG cùng id: tất cả 200", race.every(r => r.status === 200 && r.json.success === true), race.map(r => r.status));
  const raceTx = await prisma.bankTransaction.count({ where: { tutorId: T1.id, providerTxId: String(idRace) } });
  const inv2db = await prisma.tuitionInvoice.findUnique({ where: { id: inv2.id } });
  check("đúng 1 giao dịch, phiếu paid ĐÚNG 1 lần (560.000, không 3.360.000)", raceTx === 1 && inv2db?.paidAmount === 560000 && inv2db.status === "paid", { raceTx, inv2db });
  const noteCount = await prisma.notification.count({ where: { userId: T1.id, type: "invoice_paid" } });
  check("thông báo gạch phiếu: 2 (1 mỗi phiếu), không nhân theo số lần gửi", noteCount === 2, noteCount);

  section("G. Đóng thiếu / đóng dư / đã đóng (hàng chờ — không tự gạch)");
  const iss11 = await api("POST", "/api/tutor/invoices", { as: T1, body: { yearMonth: "2026-11" } });
  const n1 = iss11.json.created.find((c: any) => c.studentId === s1.id), n2 = iss11.json.created.find((c: any) => c.studentId === s2.id);
  for (const i of [n1, n2]) await api("PATCH", `/api/tutor/invoices/${i.id}`, { as: T1, body: { action: "send" } });
  const short = await hook(T1.id, KEY2, { transferAmount: 300000, content: `${n1.code} TRAN GIA BAO`, code: n1.code });
  const shortTx = await prisma.bankTransaction.findFirst({ where: { tutorId: T1.id, providerTxId: String(seq) } });
  check("thiếu 300.000/720.000 → pending, kind=short, phiếu CHƯA đổi", short.status === 200 && shortTx?.status === "pending" && shortTx.kind === "short" && (await prisma.tuitionInvoice.findUnique({ where: { id: n1.id } }))?.paidAmount === 0, shortTx);
  const list = await api("GET", "/api/tutor/bank-transactions", { as: T1 });
  check("hàng chờ có khoản này + đếm chờ", list.status === 200 && list.json.pendingCount === 1 && list.json.items[0].kind === "short" && list.json.items[0].invoice.code === n1.code && list.json.items[0].invoice.remaining === 720000, list.json);
  check("gia sư khác không thấy hàng chờ của T1", (await api("GET", "/api/tutor/bank-transactions", { as: T2 })).json.pendingCount === 0);
  check("T2 không xử lý được khoản của T1 → 404", (await api("POST", `/api/tutor/bank-transactions/${shortTx!.id}/resolve`, { as: T2, body: { action: "apply" } })).status === 404);
  check("học viên không xử lý được → 403", (await api("POST", `/api/tutor/bank-transactions/${shortTx!.id}/resolve`, { as: s1, body: { action: "apply" } })).status === 403);
  check("action lạ → 400", (await api("POST", `/api/tutor/bank-transactions/${shortTx!.id}/resolve`, { as: T1, body: { action: "hack" } })).status === 400);
  const rr = await Promise.all([1, 2].map(() => api("POST", `/api/tutor/bank-transactions/${shortTx!.id}/resolve`, { as: T1, body: { action: "apply" } })));
  check("2 lần bấm 'Ghi nhận' CÙNG LÚC: đúng 1 thành công, 1 bị 409", rr.filter(r => r.status === 200).length === 1 && rr.filter(r => r.status === 409).length === 1, rr.map(r => r.status));
  const n1db = await prisma.tuitionInvoice.findUnique({ where: { id: n1.id } });
  check("phiếu 'Đóng một phần': paid=300.000 (cộng ĐÚNG 1 lần), còn 420.000", n1db?.status === "partial" && n1db.paidAmount === 300000, n1db);
  const pv = (await api("GET", "/api/users/me/invoices?yearMonth=2026-11", { as: s1 })).json.invoices.find((i: any) => i.code === n1.code);
  check("phụ huynh thấy 'Còn lại 420.000đ' (không phải 'Đóng một phần'); QR mang 420.000, cùng mã", pv.statusLabel.startsWith("Còn lại 420.000") && pv.qrUrl.includes("amount=420000") && pv.qrUrl.includes(`addInfo=${n1.code}`), pv);
  await hook(T1.id, KEY2, { transferAmount: 420000, content: n1.code, code: n1.code });
  check("chuyển nốt 420.000 → khớp phần còn lại → tự gạch, phiếu paid", (await prisma.tuitionInvoice.findUnique({ where: { id: n1.id } }))?.status === "paid");

  await hook(T1.id, KEY2, { transferAmount: 600000, content: `${n2.code} DO HA`, code: n2.code });
  const overTx = await prisma.bankTransaction.findFirst({ where: { tutorId: T1.id, providerTxId: String(seq) } });
  check("dư 600.000 > 560.000 → pending kind=over, KHÔNG tự cộng", overTx?.kind === "over" && overTx.status === "pending" && (await prisma.tuitionInvoice.findUnique({ where: { id: n2.id } }))?.paidAmount === 0, overTx);
  check("'apply' trên khoản dư → 409 (phải chọn cách xử lý phần dư)", (await api("POST", `/api/tutor/bank-transactions/${overTx!.id}/resolve`, { as: T1, body: { action: "apply" } })).status === 409);
  const cr = await api("POST", `/api/tutor/bank-transactions/${overTx!.id}/resolve`, { as: T1, body: { action: "credit_next_month" } });
  check("'Trừ vào tháng sau': phiếu paid 560.000, dư 40.000 thành tín dụng", cr.status === 200 && cr.json.applied === 560000 && cr.json.excess === 40000, cr.json);
  check("DB: phiếu paid + 1 tín dụng 40.000 của em 2", (await prisma.tuitionInvoice.findUnique({ where: { id: n2.id } }))?.status === "paid" && (await prisma.tuitionCredit.findFirst({ where: { tutorId: T1.id, studentId: s2.id } }))?.amount === 40000);
  const iss12 = await api("POST", "/api/tutor/invoices", { as: T1, body: { yearMonth: "2026-12", studentIds: [s2.id] } });
  check("phiếu tháng sau tự trừ tín dụng: 560.000 − 40.000 = 520.000", iss12.json.created[0]?.amountDue === 520000 && iss12.json.created[0].creditApplied === 40000, iss12.json);
  const credRow = await prisma.tuitionCredit.findFirst({ where: { tutorId: T1.id, studentId: s2.id } });
  check("tín dụng đã dùng hết (usedAmount=40.000)", credRow?.usedAmount === 40000);
  const iss12b = await api("POST", "/api/tutor/invoices", { as: T1, body: { yearMonth: "2026-12", studentIds: [s1.id] } });
  check("em không có tín dụng → không bị trừ", iss12b.json.created[0]?.amountDue === 720000 && iss12b.json.created[0].creditApplied === 0, iss12b.json);

  await hook(T1.id, KEY2, { transferAmount: 560000, content: `${n2.code} DO HA`, code: n2.code });
  const paidTx = await prisma.bankTransaction.findFirst({ where: { tutorId: T1.id, providerTxId: String(seq) } });
  check("chuyển tiếp vào phiếu ĐÃ ĐÓNG → pending kind=already_paid, không cộng", paidTx?.kind === "already_paid" && paidTx.status === "pending" && (await prisma.tuitionInvoice.findUnique({ where: { id: n2.id } }))?.paidAmount === 560000, paidTx);
  const rf = await api("POST", `/api/tutor/bank-transactions/${paidTx!.id}/resolve`, { as: T1, body: { action: "refunded" } });
  check("'Ghi đã trả lại': resolved, không tạo tín dụng, phiếu không đổi", rf.status === 200 && rf.json.applied === 0 && rf.json.excess === 560000 && (await prisma.tuitionCredit.count({ where: { tutorId: T1.id, studentId: s2.id } })) === 1, rf.json);

  section("H. Không mã / mã lạ / phiếu huỷ / phiếu nháp — KHÔNG BAO GIỜ tự ghép");
  const noCode = await hook(T1.id, KEY2, { transferAmount: 520000, content: "CK HOC PHI CHO CON" });
  const ncTx = await prisma.bankTransaction.findFirst({ where: { tutorId: T1.id, providerTxId: String(seq) } });
  check("không có mã → pending kind=no_code, gợi ý phiếu CÙNG số tiền (520.000) nhưng KHÔNG tự ghép", ncTx?.kind === "no_code" && ncTx.status === "pending" && ncTx.suggestedInvoiceIds.includes(iss12.json.created[0].id) && ncTx.invoiceId === null && (await prisma.tuitionInvoice.findUnique({ where: { id: iss12.json.created[0].id } }))?.paidAmount === 0, ncTx);
  const hq = await api("GET", "/api/tutor/bank-transactions", { as: T1 });
  const ncView = hq.json.items.find((x: any) => x.id === ncTx!.id);
  check("API trả gợi ý kèm tên em + còn lại", ncView.suggestions.length === 1 && ncView.suggestions[0].studentName === "Đỗ Hà" && ncView.suggestions[0].remaining === 520000, ncView);
  const sentD12 = await api("PATCH", `/api/tutor/invoices/${iss12.json.created[0].id}`, { as: T1, body: { action: "send" } });
  check("ghép tay vào phiếu đã chọn (phiếu chưa gửi vẫn ghép được vì gia sư là người quyết)", sentD12.status === 200);
  const mt = await api("POST", `/api/tutor/bank-transactions/${ncTx!.id}/resolve`, { as: T1, body: { action: "match_invoice", invoiceId: iss12.json.created[0].id } });
  check("match_invoice: cộng 520.000, phiếu paid", mt.status === 200 && mt.json.applied === 520000 && (await prisma.tuitionInvoice.findUnique({ where: { id: iss12.json.created[0].id } }))?.status === "paid", mt.json);
  check("ghép vào phiếu của GIA SƯ KHÁC → 404", (await (async () => {
    const x = await hook(T1.id, KEY2, { transferAmount: 777000, content: "khong ma" });
    const id = (await prisma.bankTransaction.findFirst({ where: { tutorId: T1.id, providerTxId: String(seq) } }))!.id;
    return api("POST", `/api/tutor/bank-transactions/${id}/resolve`, { as: T1, body: { action: "match_invoice", invoiceId: invT2.id } });
  })()).status === 404);
  const unk = await hook(T1.id, KEY2, { transferAmount: 350000, content: `${invT2.code} TRAN GIA BAO`, code: invT2.code });
  const unkTx = await prisma.bankTransaction.findFirst({ where: { tutorId: T1.id, providerTxId: String(seq) } });
  check("mã phiếu của GIA SƯ KHÁC (T2) gửi vào webhook T1 → unknown_code pending; phiếu T2 KHÔNG bị đụng", unkTx?.kind === "unknown_code" && unkTx.invoiceId === null && (await prisma.tuitionInvoice.findUnique({ where: { id: invT2.id } }))?.paidAmount === 0, unkTx);
  const ex = await hook(T1.id, KEY2, { transferAmount: 5, content: "x" });
  const itx = await prisma.bankTransaction.findFirst({ where: { tutorId: T1.id, providerTxId: String(seq) } });
  const nt = await api("POST", `/api/tutor/bank-transactions/${itx!.id}/resolve`, { as: T1, body: { action: "not_tuition" } });
  check("'Không phải tiền học': ẩn khỏi hàng chờ, KHÔNG xoá", nt.status === 200 && (await bt(itx!.id))?.status === "ignored", nt.json);
  check("xử lý lại khoản đã ẩn → 409", (await api("POST", `/api/tutor/bank-transactions/${itx!.id}/resolve`, { as: T1, body: { action: "not_tuition" } })).status === 409);

  const issC = await api("POST", "/api/tutor/invoices", { as: T1, body: { yearMonth: "2026-10", studentIds: [s1.id] } });
  const draftOnly = await mkUser({ name: "Em Nháp" });
  await prisma.enrollment.create({ data: { userId: draftOnly.id, courseId: c1.id, status: "active" } });
  const issD = await api("POST", "/api/tutor/invoices", { as: T1, body: { yearMonth: "2026-10", studentIds: [draftOnly.id] } });
  const dInv = issD.json.created[0];
  await hook(T1.id, KEY2, { transferAmount: dInv.amountDue, content: dInv.code, code: dInv.code });
  const dTx = await prisma.bankTransaction.findFirst({ where: { tutorId: T1.id, providerTxId: String(seq) } });
  check("phiếu NHÁP nhận đúng số tiền → vẫn vào hàng chờ, KHÔNG tự gạch", dTx?.status === "pending" && dTx.kind === "exact" && (await prisma.tuitionInvoice.findUnique({ where: { id: dInv.id } }))?.paidAmount === 0, dTx);
  const ap = await api("POST", `/api/tutor/bank-transactions/${dTx!.id}/resolve`, { as: T1, body: { action: "apply" } });
  check("gia sư bấm 'Ghi nhận' → phiếu nháp thành paid", ap.status === 200 && (await prisma.tuitionInvoice.findUnique({ where: { id: dInv.id } }))?.status === "paid", ap.json);

  const issE = await api("POST", "/api/tutor/invoices", { as: T1, body: { yearMonth: "2026-10", studentIds: [(await (async () => { const u = await mkUser({ name: "Em Huỷ" }); await prisma.enrollment.create({ data: { userId: u.id, courseId: c1.id, status: "active" } }); return u; })()).id] } });
  const cInv = issE.json.created[0];
  check("huỷ phiếu cần lý do", (await api("PATCH", `/api/tutor/invoices/${cInv.id}`, { as: T1, body: { action: "cancel" } })).status === 400);
  check("huỷ phiếu OK", (await api("PATCH", `/api/tutor/invoices/${cInv.id}`, { as: T1, body: { action: "cancel", reason: "Phiếu sai số buổi" } })).status === 200);
  await hook(T1.id, KEY2, { transferAmount: cInv.amountDue, content: cInv.code, code: cInv.code });
  const cTx = await prisma.bankTransaction.findFirst({ where: { tutorId: T1.id, providerTxId: String(seq) } });
  check("tiền vào phiếu ĐÃ HUỶ → pending kind=cancelled, không cộng", cTx?.kind === "cancelled" && cTx.status === "pending" && (await prisma.tuitionInvoice.findUnique({ where: { id: cInv.id } }))?.paidAmount === 0, cTx);
  check("phiếu huỷ ẩn với học viên", (await api("GET", "/api/users/me/invoices", { as: s1 })).json.invoices.every((i: any) => i.code !== cInv.code));
  check("khôi phục phiếu huỷ → nháp", (await api("PATCH", `/api/tutor/invoices/${cInv.id}`, { as: T1, body: { action: "restore" } })).status === 200);

  section("I. Sửa số tiền + ghi tiền mặt");
  const issF = await api("POST", "/api/tutor/invoices", { as: T1, body: { yearMonth: "2027-02" } });
  check("không có số buổi 2027-02 → không phiếu", issF.json.created.length === 0);
  await prisma.monthlyCourseFee.create({ data: { courseId: c2.id, yearMonth: "2027-02", sessionCount: 4, updatedBy: T1.id } });
  const issG = await api("POST", "/api/tutor/invoices", { as: T1, body: { yearMonth: "2027-02", studentIds: [s1.id] } });
  const gInv = issG.json.created[0];
  check("em 1 chỉ có Lý 4 buổi (Toán 0 buổi): 2 môn × 60k × 4 = 240.000", gInv.amountDue === 240000, gInv);
  await api("PATCH", `/api/tutor/invoices/${gInv.id}`, { as: T1, body: { action: "send" } });
  const codeBefore = (await prisma.tuitionInvoice.findUnique({ where: { id: gInv.id } }))!.code;
  check("sửa số tiền thiếu lý do → 400", (await api("PATCH", `/api/tutor/invoices/${gInv.id}`, { as: T1, body: { action: "set_amount", amountDue: 200000 } })).status === 400);
  check("số tiền âm → 400", (await api("PATCH", `/api/tutor/invoices/${gInv.id}`, { as: T1, body: { action: "set_amount", amountDue: -5, reason: "x" } })).status === 400);
  const sa = await api("PATCH", `/api/tutor/invoices/${gInv.id}`, { as: T1, body: { action: "set_amount", amountDue: 200000, reason: "Em vào lớp giữa tháng" } });
  const gAfter = await prisma.tuitionInvoice.findUnique({ where: { id: gInv.id } });
  check("sửa 240k→200k: số tiền đổi, MÃ KHÔNG ĐỔI (GD-19)", sa.status === 200 && gAfter?.amountDue === 200000 && gAfter.code === codeBefore, gAfter);
  check("sửa số tiền ghi audit (từ → đến, lý do)", (await prisma.auditLog.count({ where: { action: "invoice.set_amount", resourceId: gInv.id } })) === 1);
  const over = await api("POST", `/api/tutor/invoices/${gInv.id}`.replace("/invoices/", "/invoices/"), { as: T1 });
  const cash0 = await api("PATCH", `/api/tutor/invoices/${gInv.id}`, { as: T1, body: { action: "record_payment", amount: 250000 } });
  check("tiền mặt dư mà không chọn cách xử lý → 400 needExcess", cash0.status === 400 && cash0.json.needExcess === true && cash0.json.excess === 50000, cash0.json);
  check("excess lạ → 400", (await api("PATCH", `/api/tutor/invoices/${gInv.id}`, { as: T1, body: { action: "record_payment", amount: 250000, excess: "xx" } })).status === 400);
  const cash1 = await api("PATCH", `/api/tutor/invoices/${gInv.id}`, { as: T1, body: { action: "record_payment", amount: 100000 } });
  check("tiền mặt thiếu 100.000 → partial", cash1.status === 200 && cash1.json.invoice.status === "partial" && cash1.json.invoice.remaining === 100000, cash1.json);
  const cash2 = await api("PATCH", `/api/tutor/invoices/${gInv.id}`, { as: T1, body: { action: "record_payment", amount: 150000, excess: "credit" } });
  check("tiền mặt dư 50.000 + 'trừ tháng sau' → phiếu paid + tín dụng 50.000", cash2.status === 200 && cash2.json.invoice.status === "paid" && cash2.json.excess === 50000 && (await prisma.tuitionCredit.count({ where: { tutorId: T1.id, studentId: s1.id, amount: 50000 } })) === 1, cash2.json);
  check("ghi thêm vào phiếu đã đóng → 409", (await api("PATCH", `/api/tutor/invoices/${gInv.id}`, { as: T1, body: { action: "record_payment", amount: 1000 } })).status === 409);
  check("sửa số tiền phiếu đã đóng → 409", (await api("PATCH", `/api/tutor/invoices/${gInv.id}`, { as: T1, body: { action: "set_amount", amountDue: 300000, reason: "x" } })).status === 409);
  const manualTx = await prisma.bankTransaction.findMany({ where: { invoiceId: gInv.id, provider: "manual" } });
  check("mỗi khoản tiền mặt có dòng sổ riêng (2 dòng, có ai bấm)", manualTx.length === 2 && manualTx.every(t => t.resolvedBy === T1.id && t.status === "resolved"), manualTx.length);
  const sumApplied = manualTx.reduce((s, t) => s + t.appliedAmount, 0);
  check("tổng đã áp dụng = paidAmount của phiếu (200.000)", sumApplied === 200000 && (await prisma.tuitionInvoice.findUnique({ where: { id: gInv.id } }))?.paidAmount === 200000, sumApplied);

  section("J. Đối chiếu sổ — mọi phiếu: paidAmount = Σ appliedAmount của các khoản đã gắn");
  const invs = await prisma.tuitionInvoice.findMany({ where: { tutorId: T1.id } });
  let bad = 0;
  for (const i of invs) {
    const s = await prisma.bankTransaction.aggregate({ where: { invoiceId: i.id, status: { in: ["matched", "resolved"] } }, _sum: { appliedAmount: true } });
    if ((s._sum.appliedAmount ?? 0) !== i.paidAmount) { bad++; console.log("   lệch:", i.code, i.paidAmount, s._sum.appliedAmount); }
  }
  check(`${invs.length} phiếu của T1: không phiếu nào lệch sổ`, bad === 0, bad);
  check("không phiếu nào bị cộng quá số phải đóng", invs.every(i => i.paidAmount <= i.amountDue), invs.map(i => [i.code, i.paidAmount, i.amountDue]));
  const sepayCount = (await api("GET", "/api/tutor/payout-account", { as: T1 })).json.sepay;
  check("đếm giao dịch SePay tháng này (không tính tiền mặt)", sepayCount.monthCount > 0 && sepayCount.freeLimit === 50, sepayCount);

  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
