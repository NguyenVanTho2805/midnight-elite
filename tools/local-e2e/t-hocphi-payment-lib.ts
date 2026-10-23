// HP-20 + HP-21 — bài THUẦN (không DB, không mạng) cho src/lib/tuitionPayment.ts: ngày thu + hình thức, kế hoạch hoàn tác.
// Có ca phá cố ý: mỗi ca "phải bị chặn" kiểm đúng điều kiện chặn, không chỉ "không ném lỗi".
import {
  PAID_ON_MAX_BACK_DAYS, isPaymentMethod, manualMethodLabel, manualPaymentContent, planReversal, resolvePaidOn, statusAfterReversal, validateReversalReason,
  type ReversalCredit, type ReversalInvoice, type ReversalTx,
} from "@/lib/tuitionPayment";
import { check, section, done } from "./h";

(async () => {
// 23/10/2026 10:30 giờ VN = 03:30 UTC
const NOW = new Date("2026-10-23T03:30:00Z");

section("HP-20 · hình thức");
check("chỉ nhận cash / bank_transfer", isPaymentMethod("cash") && isPaymentMethod("bank_transfer") && !isPaymentMethod("momo") && !isPaymentMethod(undefined) && !isPaymentMethod(1));
check("chữ ghi tay: tiền mặt GIỮ NGUYÊN chữ cũ", manualPaymentContent("cash") === "Tiền mặt / ghi tay");
check("chữ ghi tay: chuyển khoản", manualPaymentContent("bank_transfer") === "Chuyển khoản / ghi tay");
check("nhãn báo cáo: method null (bản ghi cũ) = chữ cũ", manualMethodLabel(null) === "Tiền mặt / ghi tay" && manualMethodLabel(undefined) === "Tiền mặt / ghi tay" && manualMethodLabel("cash") === "Tiền mặt / ghi tay");
check("nhãn báo cáo: chuyển khoản ghi tay", manualMethodLabel("bank_transfer") === "Chuyển khoản (gia sư ghi tay)");

section("HP-20 · ngày thu (giờ VN)");
const none = resolvePaidOn(undefined, NOW);
check("không gửi → bây giờ (hành vi cũ), hôm nay VN", none.ok && none.occurredAt.getTime() === NOW.getTime() && none.dateKey === "2026-10-23" && none.isToday);
check("chuỗi rỗng / null cũng = bây giờ", resolvePaidOn("", NOW).ok && resolvePaidOn(null, NOW).ok);
const today = resolvePaidOn("2026-10-23", NOW);
check("gửi đúng hôm nay → vẫn là thời điểm hiện tại", today.ok && today.occurredAt.getTime() === NOW.getTime());
const past = resolvePaidOn("2026-10-20", NOW);
check("ngày quá khứ → 12:00 giờ VN (05:00 UTC) của ngày đó", past.ok && past.occurredAt.toISOString() === "2026-10-20T05:00:00.000Z" && !past.isToday, past.ok && past.occurredAt.toISOString());
// Ca giờ VN: 00:30 ngày 24/10 VN = 17:30 UTC ngày 23 → "hôm nay" VN là 24, không phải 23.
const lateNight = new Date("2026-10-23T17:30:00Z");
check("[giờ VN] 00:30 ngày 24 VN: hôm nay là 24, không phải 23 (new Date thô sẽ sai)", resolvePaidOn("2026-10-24", lateNight).ok && !resolvePaidOn("2026-10-25", lateNight).ok);
check("[phá] ngày tương lai bị từ chối", (() => { const r = resolvePaidOn("2026-10-24", NOW); return !r.ok && /tương lai/.test(r.error); })());
check("[phá] ngày không có thật (30/02) bị từ chối", !resolvePaidOn("2026-02-30", NOW).ok);
check("[phá] sai định dạng bị từ chối", !resolvePaidOn("23/10/2026", NOW).ok && !resolvePaidOn(20261023 as unknown, NOW).ok && !resolvePaidOn("2026-1-5", NOW).ok);
check(`[phá] quá ${PAID_ON_MAX_BACK_DAYS} ngày về trước bị từ chối, đúng ${PAID_ON_MAX_BACK_DAYS} ngày thì được`, !resolvePaidOn("2025-01-01", NOW).ok && resolvePaidOn("2025-09-18", NOW).ok);

section("HP-21 · trạng thái phiếu sau khi trừ khoản ra");
const inv = (o: Partial<ReversalInvoice> = {}): ReversalInvoice => ({ amountDue: 720_000, paidAmount: 720_000, status: "paid", sentAt: new Date(), ...o });
check("đã đóng đủ, trừ hết → quay về 'sent' (đã gửi)", statusAfterReversal(inv(), 0) === "sent");
check("trừ một phần còn dư → 'partial'", statusAfterReversal(inv(), 200_000) === "partial");
check("chưa từng gửi → về 'draft'", statusAfterReversal(inv({ sentAt: null }), 0) === "draft");
check("[phá] phiếu đã huỷ giữ nguyên huỷ dù trừ về 0", statusAfterReversal(inv({ status: "cancelled" }), 0) === "cancelled");
check("còn >= phải đóng (đã hạ số tiền) → vẫn 'paid'", statusAfterReversal(inv({ amountDue: 100_000, paidAmount: 300_000 }), 150_000) === "paid");

section("HP-21 · kế hoạch hoàn tác");
const tx = (o: Partial<ReversalTx> = {}): ReversalTx => ({ status: "matched", provider: "sepay", amount: 720_000, appliedAmount: 720_000, invoiceId: "inv1", ...o });
const p1 = planReversal({ tx: tx(), invoice: inv(), credits: [] });
check("SePay tự gạch đủ: về hàng chờ (requeued), phiếu còn 720.000, trạng thái sent", p1.ok && p1.outcome === "requeued" && p1.paidAfter === 0 && p1.remainingAfter === 720_000 && p1.invoiceStatusTo === "sent" && p1.invoiceStatusFrom === "paid" && p1.clearPaidAt, p1);
const p2 = planReversal({ tx: tx({ provider: "manual" }), invoice: inv(), credits: [] });
check("ghi tay: coi là ghi nhầm (voided)", p2.ok && p2.outcome === "voided");
const p3 = planReversal({ tx: tx({ amount: 500_000, appliedAmount: 500_000 }), invoice: inv({ paidAmount: 500_000, status: "partial" }), credits: [] });
check("đóng một phần 500k hoàn tác → trả về đúng 0 đã nhận", p3.ok && p3.paidBefore === 500_000 && p3.paidAfter === 0 && p3.remainingAfter === 720_000);
const p4 = planReversal({ tx: tx({ amount: 400_000, appliedAmount: 400_000 }), invoice: inv({ paidAmount: 700_000, status: "partial" }), credits: [] });
check("phiếu có 2 khoản (400k + 300k): hoàn tác 400k còn 300k, vẫn 'partial'", p4.ok && p4.paidAfter === 300_000 && p4.remainingAfter === 420_000 && p4.invoiceStatusTo === "partial");
const p5 = planReversal({ tx: tx({ amount: 1_000_000, appliedAmount: 720_000 }), invoice: inv(), credits: [{ id: "c1", amount: 280_000, usedAmount: 0 }] });
check("khoản dư 280k đã thành tín dụng chưa dùng: thu hồi 280k, không còn dư vô chủ", p5.ok && p5.creditsVoidedTotal === 280_000 && p5.creditsToVoid.length === 1 && p5.untrackedExcess === 0, p5);
const p6 = planReversal({ tx: tx({ amount: 1_000_000, appliedAmount: 720_000 }), invoice: inv(), credits: [] });
check("dư 280k đã ghi 'trả lại' ngoài hệ thống: báo KiN không đảo được (untrackedExcess)", p6.ok && p6.untrackedExcess === 280_000 && p6.creditsVoidedTotal === 0);
check("[phá] tín dụng đã dùng một phần → CHẶN (credit_used), nêu số tiền", (() => {
  const r = planReversal({ tx: tx({ amount: 1_000_000, appliedAmount: 720_000 }), invoice: inv(), credits: [{ id: "c1", amount: 280_000, usedAmount: 100_000 }] });
  return !r.ok && r.code === "credit_used" && /100\.000/.test(r.blocker);
})());
check("[phá] khoản đang chờ đối soát → không có gì để hoàn tác", (() => { const r = planReversal({ tx: tx({ status: "pending" }), invoice: inv(), credits: [] }); return !r.ok && r.code === "not_reversible"; })());
check("[phá] khoản đã hoàn tác → không hoàn tác lần hai", (() => { const r = planReversal({ tx: tx({ status: "reversed" }), invoice: inv(), credits: [] }); return !r.ok && r.code === "not_reversible" && /đã được hoàn tác/.test(r.blocker); })());
check("[phá] khoản 'ignored' (không phải tiền học) không thuộc phạm vi", !planReversal({ tx: tx({ status: "ignored" }), invoice: inv(), credits: [] }).ok);
check("[phá] không có phiếu → no_invoice", (() => { const r = planReversal({ tx: tx({ invoiceId: null }), invoice: null, credits: [] }); return !r.ok && r.code === "no_invoice"; })());
const p7 = planReversal({ tx: tx(), invoice: inv({ status: "cancelled" }), credits: [] });
check("phiếu đã huỷ vẫn hoàn tác được tiền, trạng thái giữ 'cancelled'", p7.ok && p7.invoiceStatusTo === "cancelled");
const p8 = planReversal({ tx: tx({ appliedAmount: 900_000 }), invoice: inv({ paidAmount: 100_000 }), credits: [] });
check("[phá] dữ liệu lệch (khoản lớn hơn đã nhận trên phiếu) → không bao giờ âm", p8.ok && p8.paidAfter === 0);

section("HP-21 · lý do");
check("thiếu lý do → lỗi", !validateReversalReason("   ").ok && !validateReversalReason(undefined).ok && !validateReversalReason(5).ok);
check("lý do hợp lệ được cắt khoảng trắng", (() => { const r = validateReversalReason("  ghép nhầm em khác "); return r.ok && r.reason === "ghép nhầm em khác"; })());
check("[phá] quá 300 ký tự bị từ chối, đúng 300 thì được", !validateReversalReason("x".repeat(301)).ok && validateReversalReason("x".repeat(300)).ok);
await done();
})();
