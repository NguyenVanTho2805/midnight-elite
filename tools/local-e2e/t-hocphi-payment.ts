// HP-20 + HP-21 — API: ghi tiền có ngày thu + hình thức, doanh thu theo ngày thu, hoàn tác khoản đã thu (rà soát, lý do, audit,
// hoàn tác ghép sai, thu hồi tín dụng, chặn khi tín dụng đã dùng, hai lần bấm cùng lúc). Cần máy chủ dev đang chạy (BASE).
import { api, mkUser, mkTutor, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { vnDateKeyOf } from "@/lib/classSessions";

let seq = 9000;
async function hook(tutorId: string, key: string, p: Record<string, unknown>) {
  return api("POST", `/api/webhooks/sepay/${tutorId}`, { headers: { authorization: `Apikey ${key}` }, body: { id: ++seq, gateway: "MBBank", transactionDate: "2026-10-01 20:14:00", transferType: "in", ...p } });
}
const inv = (id: string) => prisma.tuitionInvoice.findUniqueOrThrow({ where: { id } });
const bt = (id: string) => prisma.bankTransaction.findUniqueOrThrow({ where: { id } });
const lastTx = (tutorId: string) => prisma.bankTransaction.findFirstOrThrow({ where: { tutorId, providerTxId: String(seq) } });

(async () => {
  await wipe();
  const T1 = await mkTutor("Cô Lan"), T2 = await mkTutor("Thầy Minh");
  const sA = await mkUser({ name: "Trần Gia Bảo" }), sB = await mkUser({ name: "Đỗ Hà" }), sC = await mkUser({ name: "Lê Minh" });
  const c1 = await mkCourse(T1.id, { name: "Toán 9" });
  for (const s of [sA, sB, sC]) await prisma.enrollment.create({ data: { userId: s.id, courseId: c1.id, status: "active" } });
  for (const ym of ["2026-10", "2026-11", "2026-12"]) await prisma.monthlyCourseFee.create({ data: { courseId: c1.id, yearMonth: ym, sessionCount: 8, updatedBy: T1.id } });
  await api("PUT", "/api/tutor/payout-account", { as: T1, body: { bankBin: "970436", accountNo: "0123456789", accountName: "Nguyen Thi Lan" } });
  const KEY = (await api("POST", "/api/tutor/payout-account/webhook-key", { as: T1 })).json.key as string;

  const iss = await api("POST", "/api/tutor/invoices", { as: T1, body: { yearMonth: "2026-10" } });
  const byS = (s: { id: string }) => iss.json.created.find((c: any) => c.studentId === s.id);
  const iA = byS(sA), iB = byS(sB), iC = byS(sC);
  check("nền: 3 phiếu 560.000 (1 môn × 70k × 8 buổi)", [iA, iB, iC].every(i => i.amountDue === 560_000), iss.json);
  for (const i of [iA, iB, iC]) await api("PATCH", `/api/tutor/invoices/${i.id}`, { as: T1, body: { action: "send" } });

  const today = vnDateKeyOf(new Date());
  const pastKey = "2026-10-05";
  const pay = (i: any, body: Record<string, unknown>, as = T1) => api("PATCH", `/api/tutor/invoices/${i.id}`, { as, body: { action: "record_payment", ...body } });

  section("A. HP-20 · ghi tiền có ngày thu + hình thức");
  const a0 = await pay(iA, { amount: 100_000 });
  const a0tx = await prisma.bankTransaction.findFirstOrThrow({ where: { invoiceId: iA.id, provider: "manual" } });
  check("không gửi paidOn/method = hành vi CŨ: tiền mặt, chữ cũ, thời điểm hiện tại", a0.status === 200 && a0tx.method === "cash" && a0tx.content === "Tiền mặt / ghi tay" && Math.abs(Date.now() - a0tx.occurredAt.getTime()) < 60_000, a0tx);
  const a1 = await pay(iA, { amount: 200_000, paidOn: pastKey, method: "bank_transfer" });
  const a1tx = await prisma.bankTransaction.findFirstOrThrow({ where: { invoiceId: iA.id, amount: 200_000 } });
  check("ngày thu 05/10 + chuyển khoản: occurredAt = 12:00 VN ngày đó, method=bank_transfer", a1.status === 200 && a1tx.method === "bank_transfer" && a1tx.occurredAt.toISOString() === "2026-10-05T05:00:00.000Z" && a1tx.content === "Chuyển khoản / ghi tay", a1tx);
  check("phiếu cộng đúng 300.000, partial", (await inv(iA.id)).paidAmount === 300_000 && (await inv(iA.id)).status === "partial");
  check("[phá] ngày tương lai → 400, không ghi gì", (await pay(iA, { amount: 1000, paidOn: "2999-01-01" })).status === 400 && (await inv(iA.id)).paidAmount === 300_000);
  check("[phá] ngày sai định dạng → 400", (await pay(iA, { amount: 1000, paidOn: "05/10/2026" })).status === 400);
  check("[phá] hình thức lạ → 400", (await pay(iA, { amount: 1000, method: "momo" })).status === 400);
  check("người khác (T2) ghi vào phiếu của T1 → 404", (await pay(iA, { amount: 1000 }, T2)).status === 404);
  check("audit ghi ngày thu + hình thức", !!(await prisma.auditLog.findFirst({ where: { action: "invoice.record_payment", resourceId: iA.id, metadata: { path: ["paidOn"], equals: pastKey } } })));

  section("B. HP-20 · doanh thu theo NGÀY THU");
  const rev = (q: string) => api("GET", `/api/users/me/revenue?${q}`, { as: T1 });
  const rPast = await rev(`from=${pastKey}&to=${pastKey}`);
  check("lọc đúng ngày 05/10: có khoản 200.000 chuyển khoản ghi tay, KHÔNG có khoản hôm nay", rPast.status === 200 && rPast.json.totals.collected === 200_000 && rPast.json.transactions[0].method === "Chuyển khoản (gia sư ghi tay)" && rPast.json.transactions[0].amount === 200_000, rPast.json);
  const rToday = await rev(`from=${today}&to=${today}`);
  check("lọc hôm nay: có khoản 100.000 tiền mặt, nhãn CŨ giữ nguyên", rToday.json.totals.collected === 100_000 && rToday.json.transactions[0].method === "Tiền mặt / ghi tay", rToday.json);
  const csv = await api("GET", `/api/users/me/revenue?from=${pastKey}&to=${pastKey}&format=csv`, { as: T1 });
  check("CSV: ngày thu 2026-10-05 và nhãn hình thức", csv.text.includes("2026-10-05") && csv.text.includes("Chuyển khoản (gia sư ghi tay)"), csv.text.slice(0, 300));

  section("C. HP-21 · quyền + điều kiện");
  check("ẩn danh xem rà soát → 401", (await api("GET", `/api/tutor/bank-transactions/${a1tx.id}/reverse`)).status === 401);
  check("học viên → 403", (await api("GET", `/api/tutor/bank-transactions/${a1tx.id}/reverse`, { as: sA })).status === 403);
  check("gia sư khác (T2) → 404 (GET và POST)", (await api("GET", `/api/tutor/bank-transactions/${a1tx.id}/reverse`, { as: T2 })).status === 404 && (await api("POST", `/api/tutor/bank-transactions/${a1tx.id}/reverse`, { as: T2, body: { reason: "x", confirm: true } })).status === 404);
  check("khoản không tồn tại → 404", (await api("GET", `/api/tutor/bank-transactions/khongco/reverse`, { as: T1 })).status === 404);
  const pv = await api("GET", `/api/tutor/bank-transactions/${a1tx.id}/reverse`, { as: T1 });
  check("rà soát (GET) nói đúng điều sẽ đổi: 300.000 → 100.000, partial → partial, voided", pv.status === 200 && pv.json.plan.ok && pv.json.plan.paidBefore === 300_000 && pv.json.plan.paidAfter === 100_000 && pv.json.plan.outcome === "voided" && pv.json.plan.remainingAfter === 460_000, pv.json);
  check("GET KHÔNG ghi gì: phiếu & khoản y nguyên", (await inv(iA.id)).paidAmount === 300_000 && (await bt(a1tx.id)).status === "resolved" && (await prisma.paymentReversal.count()) === 0);
  check("[phá] POST thiếu confirm:true → 400, không hoàn tác", (await api("POST", `/api/tutor/bank-transactions/${a1tx.id}/reverse`, { as: T1, body: { reason: "nhập nhầm" } })).status === 400 && (await bt(a1tx.id)).status === "resolved");
  check("[phá] POST thiếu lý do → 400", (await api("POST", `/api/tutor/bank-transactions/${a1tx.id}/reverse`, { as: T1, body: { confirm: true, reason: "  " } })).status === 400 && (await inv(iA.id)).paidAmount === 300_000);

  section("D. HP-21 · hoàn tác khoản GHI TAY");
  const d1 = await api("POST", `/api/tutor/bank-transactions/${a1tx.id}/reverse`, { as: T1, body: { confirm: true, reason: "Nhập nhầm số tiền" } });
  check("hoàn tác OK: outcome voided, reversed 200.000", d1.status === 200 && d1.json.outcome === "voided" && d1.json.reversed === 200_000, d1.json);
  const iAdb = await inv(iA.id);
  check("phiếu về 100.000 đã nhận, còn 460.000, vẫn partial", iAdb.paidAmount === 100_000 && iAdb.status === "partial");
  check("khoản ghi tay: status=reversed, dòng GIỮ LẠI (không xoá)", (await bt(a1tx.id)).status === "reversed" && (await bt(a1tx.id)).appliedAmount === 200_000);
  const rv = await prisma.paymentReversal.findFirstOrThrow({ where: { bankTransactionId: a1tx.id } });
  check("nhật ký: lý do, ai bấm, trước/sau", rv.reason === "Nhập nhầm số tiền" && rv.reversedBy === T1.id && rv.invoiceStatusFrom === "partial" && rv.invoiceStatusTo === "partial" && rv.reversedAmount === 200_000 && rv.outcome === "voided", rv);
  check("audit hệ thống có bank_tx.reverse", !!(await prisma.auditLog.findFirst({ where: { action: "bank_tx.reverse", resourceId: a1tx.id } })));
  check("doanh thu ngày 05/10 giờ KHÔNG còn khoản đã hoàn tác", (await rev(`from=${pastKey}&to=${pastKey}`)).json.totals.collected === 0);
  check("[phá] hoàn tác lần hai → 409, phiếu không bị trừ thêm", (await api("POST", `/api/tutor/bank-transactions/${a1tx.id}/reverse`, { as: T1, body: { confirm: true, reason: "lần 2" } })).status === 409 && (await inv(iA.id)).paidAmount === 100_000);
  check("khoản đã hoàn tác không còn ghép lại được bằng resolve (409)", (await api("POST", `/api/tutor/bank-transactions/${a1tx.id}/resolve`, { as: T1, body: { action: "apply" } })).status === 409);

  section("E. HP-21 · ghép sai: khoản SePay tự gạch nhầm phiếu → hoàn tác → ghép lại đúng phiếu");
  await hook(T1.id, KEY, { transferAmount: 560_000, content: `${iB.code} DO HA`, code: iB.code });
  const e1 = await lastTx(T1.id);
  check("nền: SePay tự gạch phiếu B đủ 560.000", e1.status === "matched" && (await inv(iB.id)).status === "paid");
  const e2 = await api("POST", `/api/tutor/bank-transactions/${e1.id}/reverse`, { as: T1, body: { confirm: true, reason: "Phụ huynh em C chuyển nhầm mã của B" } });
  check("hoàn tác: outcome requeued", e2.status === 200 && e2.json.outcome === "requeued", e2.json);
  const e1db = await bt(e1.id), iBdb = await inv(iB.id);
  check("khoản quay lại HÀNG CHỜ (pending, chưa gắn phiếu, kind no_code, applied 0)", e1db.status === "pending" && e1db.invoiceId === null && e1db.appliedAmount === 0 && e1db.kind === "no_code" && e1db.matchedCode === null && e1db.resolution === null, e1db);
  check("phiếu B về 'sent', paid 0, paidAt rỗng", iBdb.status === "sent" && iBdb.paidAmount === 0 && iBdb.paidAt === null, iBdb);
  check("gợi ý phiếu cùng số tiền (B, C đều 560.000) — chỉ gợi ý", e1db.suggestedInvoiceIds.includes(iB.id) && e1db.suggestedInvoiceIds.includes(iC.id));
  check("doanh thu không tính khoản đang chờ", (await rev("from=2026-10-01&to=2026-10-02")).json.totals.collected === 0);
  const e3 = await api("POST", `/api/tutor/bank-transactions/${e1.id}/resolve`, { as: T1, body: { action: "match_invoice", invoiceId: iC.id } });
  check("ghép lại đúng phiếu C → C đã đóng, B vẫn chưa đóng", e3.status === 200 && (await inv(iC.id)).status === "paid" && (await inv(iB.id)).status === "sent");
  const e4 = await api("POST", `/api/tutor/bank-transactions/${e1.id}/reverse`, { as: T1, body: { confirm: true, reason: "Thử hoàn tác lần nữa" } });
  check("hoàn tác được LẦN HAI sau khi ghép lại (2 dòng nhật ký cho cùng khoản)", e4.status === 200 && (await prisma.paymentReversal.count({ where: { bankTransactionId: e1.id } })) === 2 && (await inv(iC.id)).status === "sent");
  await api("POST", `/api/tutor/bank-transactions/${e1.id}/resolve`, { as: T1, body: { action: "match_invoice", invoiceId: iB.id } });
  check("rồi ghép vào B: B đã đóng đủ (không trùng tiền)", (await inv(iB.id)).status === "paid" && (await inv(iB.id)).paidAmount === 560_000 && (await inv(iC.id)).paidAmount === 0);

  section("F. HP-21 · tiền dư thành tín dụng tháng sau");
  const f0 = await api("POST", "/api/tutor/invoices", { as: T1, body: { yearMonth: "2026-11", studentIds: [sA.id] } });
  const nA = f0.json.created[0];
  await api("PATCH", `/api/tutor/invoices/${nA.id}`, { as: T1, body: { action: "send" } });
  const fPay = await pay(nA, { amount: 600_000, excess: "credit" });
  const fTx = await prisma.bankTransaction.findFirstOrThrow({ where: { invoiceId: nA.id } });
  check("nền: ghi 600.000 vào phiếu 560.000, dư 40.000 → tín dụng", fPay.status === 200 && fPay.json.excess === 40_000 && (await prisma.tuitionCredit.findFirstOrThrow({ where: { sourceTxId: fTx.id } })).amount === 40_000);
  const fPv = await api("GET", `/api/tutor/bank-transactions/${fTx.id}/reverse`, { as: T1 });
  check("rà soát báo sẽ thu hồi 40.000 tiền dư", fPv.json.plan.creditsVoidedTotal === 40_000 && fPv.json.plan.paidAfter === 0, fPv.json.plan);
  const fRev = await api("POST", `/api/tutor/bank-transactions/${fTx.id}/reverse`, { as: T1, body: { confirm: true, reason: "Ghi nhầm 600.000, thực nhận 560.000" } });
  const cr = await prisma.tuitionCredit.findFirstOrThrow({ where: { sourceTxId: fTx.id } });
  check("tín dụng bị thu hồi tại chỗ: số dư còn lại = 0, dòng vẫn còn", fRev.status === 200 && cr.amount - cr.usedAmount === 0, cr);
  check("nhật ký ghi creditsVoided=40.000", (await prisma.paymentReversal.findFirstOrThrow({ where: { bankTransactionId: fTx.id } })).creditsVoided === 40_000);
  const f2 = await api("POST", "/api/tutor/invoices", { as: T1, body: { yearMonth: "2026-12", studentIds: [sA.id] } });
  check("phiếu tháng 12 KHÔNG còn bị trừ 40.000 tín dụng đã thu hồi (560.000 nguyên)", f2.json.created[0].amountDue === 560_000 && f2.json.created[0].creditApplied === 0, f2.json);

  section("G. HP-21 · tín dụng ĐÃ DÙNG → chặn");
  const g0 = await api("POST", "/api/tutor/invoices", { as: T1, body: { yearMonth: "2026-11", studentIds: [sB.id] } });
  const nB = g0.json.created[0];
  await api("PATCH", `/api/tutor/invoices/${nB.id}`, { as: T1, body: { action: "send" } });
  await pay(nB, { amount: 600_000, excess: "credit" });
  const gTx = await prisma.bankTransaction.findFirstOrThrow({ where: { invoiceId: nB.id } });
  const g1 = await api("POST", "/api/tutor/invoices", { as: T1, body: { yearMonth: "2026-12", studentIds: [sB.id] } });
  check("nền: phiếu tháng 12 của B đã trừ 40.000 tín dụng → 520.000", g1.json.created[0].amountDue === 520_000 && g1.json.created[0].creditApplied === 40_000, g1.json);
  const gPv = await api("GET", `/api/tutor/bank-transactions/${gTx.id}/reverse`, { as: T1 });
  check("rà soát báo CHẶN (credit_used) và nêu số tiền", gPv.json.plan.ok === false && gPv.json.plan.code === "credit_used" && /40\.000/.test(gPv.json.plan.blocker), gPv.json.plan);
  const gRev = await api("POST", `/api/tutor/bank-transactions/${gTx.id}/reverse`, { as: T1, body: { confirm: true, reason: "thử" } });
  check("[phá] POST bị chặn 409; phiếu và khoản KHÔNG đổi", gRev.status === 409 && (await bt(gTx.id)).status === "resolved" && (await inv(nB.id)).status === "paid" && (await prisma.paymentReversal.count({ where: { bankTransactionId: gTx.id } })) === 0, gRev.json);

  section("H. HP-21 · hai lần bấm CÙNG LÚC");
  const h0 = await api("POST", "/api/tutor/invoices", { as: T1, body: { yearMonth: "2026-11", studentIds: [sC.id] } });
  const nC = h0.json.created[0];
  await api("PATCH", `/api/tutor/invoices/${nC.id}`, { as: T1, body: { action: "send" } });
  await pay(nC, { amount: 300_000 });
  await pay(nC, { amount: 260_000 });
  const hTx = await prisma.bankTransaction.findFirstOrThrow({ where: { invoiceId: nC.id, amount: 300_000 } });
  const race = await Promise.all([1, 2, 3].map(() => api("POST", `/api/tutor/bank-transactions/${hTx.id}/reverse`, { as: T1, body: { confirm: true, reason: "bấm đúp" } })));
  check("3 lần bấm đồng thời: đúng 1 thành công, 2 bị 409", race.filter(r => r.status === 200).length === 1 && race.filter(r => r.status === 409).length === 2, race.map(r => r.status));
  check("phiếu bị trừ ĐÚNG 1 lần: 560.000 − 300.000 = 260.000, partial", (await inv(nC.id)).paidAmount === 260_000 && (await inv(nC.id)).status === "partial");
  check("chỉ 1 dòng nhật ký", (await prisma.paymentReversal.count({ where: { bankTransactionId: hTx.id } })) === 1);

  section("I. Bất biến tiền: mọi phiếu paidAmount = Σ khoản đang hiệu lực");
  const invoices = await prisma.tuitionInvoice.findMany({ where: { tutorId: T1.id } });
  const bad: unknown[] = [];
  for (const i of invoices) {
    const sum = (await prisma.bankTransaction.findMany({ where: { invoiceId: i.id, status: { in: ["matched", "resolved"] } } })).reduce((s, t) => s + t.appliedAmount, 0);
    if (sum !== i.paidAmount) bad.push({ code: i.code, paid: i.paidAmount, sum });
  }
  check(`không phiếu nào lệch (${invoices.length} phiếu)`, bad.length === 0, bad);
  check("không phiếu nào paid > amountDue", invoices.every(i => i.paidAmount <= i.amountDue));
  check("không còn tín dụng có số dư âm", (await prisma.tuitionCredit.findMany()).every(c => c.amount - c.usedAmount >= 0));
  await done();
})();
