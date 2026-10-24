// HP-20 + HP-21 (23/10/2026) — logic THUẦN cho "ngày thu + hình thức" và "hoàn tác khoản đã thu".
// Không import Prisma / node:* để test được và dùng chung máy chủ + giao diện (giao diện chỉ HIỂN THỊ kết quả
// planReversal, không tự tính tiền). Mọi số là số nguyên đồng.
//
// Nguyên tắc (cờ TIỀN):
//   - Không bao giờ sửa/xoá dòng tiền đã ghi: hoàn tác là một thao tác có LÝ DO và có dòng nhật ký (PaymentReversal).
//   - Khoản đã dùng (tiền dư đã trừ vào phiếu tháng sau) thì CHẶN, không tự đảo dây chuyền.
//   - Phiếu đã huỷ giữ nguyên trạng thái huỷ.
import { addDaysKey, instantOf, isValidDateKey, vnDateKeyOf } from "@/lib/classSessions";

// ─── HP-20: ngày thu + hình thức ─────────────────────────────────────────────
export const PAYMENT_METHODS = ["cash", "bank_transfer"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = { cash: "Tiền mặt", bank_transfer: "Chuyển khoản" };
export function isPaymentMethod(v: unknown): v is PaymentMethod {
  return typeof v === "string" && (PAYMENT_METHODS as readonly string[]).includes(v);
}
/** Nội dung ghi trên dòng tiền ghi tay. `cash` giữ đúng chữ cũ để dữ liệu và báo cáo cũ không đổi. */
export function manualPaymentContent(method: PaymentMethod): string {
  return method === "bank_transfer" ? "Chuyển khoản / ghi tay" : "Tiền mặt / ghi tay";
}
/** Hình thức hiển thị cho báo cáo doanh thu. method null = bản ghi cũ → "Tiền mặt / ghi tay" như trước. */
export function manualMethodLabel(method: string | null | undefined): string {
  return method === "bank_transfer" ? "Chuyển khoản (gia sư ghi tay)" : "Tiền mặt / ghi tay";
}

/** Ngày thu ghi bù tối đa bao nhiêu ngày về trước (chặn gõ nhầm năm). */
export const PAID_ON_MAX_BACK_DAYS = 400;

export type PaidOnResult =
  | { ok: true; occurredAt: Date; dateKey: string; isToday: boolean }
  | { ok: false; error: string };

/**
 * Ngày thu do gia sư chọn (YYYY-MM-DD, giờ Việt Nam). Không gửi → hành vi cũ: thời điểm hiện tại.
 * Hôm nay → thời điểm hiện tại. Ngày khác → 12:00 giờ VN của ngày đó (giữa ngày, không lệch sang ngày kề dù đổi múi giờ hiển thị).
 * Không cho ngày tương lai (tiền chưa thu), không cho quá PAID_ON_MAX_BACK_DAYS ngày về trước.
 */
export function resolvePaidOn(input: unknown, now: Date = new Date()): PaidOnResult {
  const today = vnDateKeyOf(now);
  if (input === undefined || input === null || input === "") return { ok: true, occurredAt: now, dateKey: today, isToday: true };
  if (typeof input !== "string" || !isValidDateKey(input)) return { ok: false, error: "Ngày thu phải có dạng năm-tháng-ngày (YYYY-MM-DD)" };
  if (input > today) return { ok: false, error: "Ngày thu không được ở tương lai" };
  if (input < addDaysKey(today, -PAID_ON_MAX_BACK_DAYS)) return { ok: false, error: `Ngày thu quá xa (tối đa ${PAID_ON_MAX_BACK_DAYS} ngày trước)` };
  if (input === today) return { ok: true, occurredAt: now, dateKey: today, isToday: true };
  return { ok: true, occurredAt: instantOf(input, 12 * 60), dateKey: input, isToday: false };
}

// ─── HP-21: hoàn tác khoản đã thu ────────────────────────────────────────────
export const REVERSAL_REASON_MAX = 300;
/** Trạng thái dòng tiền mà gia sư có thể hoàn tác (đã gạch vào phiếu). */
export const REVERSIBLE_TX_STATUSES = ["matched", "resolved"] as const;

export interface ReversalTx { status: string; provider: string; amount: number; appliedAmount: number; invoiceId: string | null }
export interface ReversalInvoice { amountDue: number; paidAmount: number; status: string; sentAt: Date | string | null }
export interface ReversalCredit { id: string; amount: number; usedAmount: number }

export type ReversalPlan =
  | {
      ok: true;
      /** "requeued": tiền thật vào TK gia sư → quay lại hàng chờ đối soát. "voided": gia sư tự ghi tay → ghi nhầm, loại khỏi doanh thu. */
      outcome: "requeued" | "voided";
      reversedAmount: number;
      invoiceStatusFrom: string;
      invoiceStatusTo: string;
      paidBefore: number;
      paidAfter: number;
      remainingAfter: number;
      clearPaidAt: boolean;
      creditsToVoid: Array<{ id: string; amount: number }>;
      creditsVoidedTotal: number;
      /** Phần dư của khoản tiền KHÔNG thành tín dụng (vd đã ghi "trả lại" ngoài hệ thống): KiN không hoàn tác được việc đó. */
      untrackedExcess: number;
    }
  | { ok: false; code: "not_reversible" | "no_invoice" | "credit_used"; blocker: string };

/** Trạng thái phiếu sau khi trừ một khoản ra. Không bao giờ "lên" trạng thái cao hơn; phiếu huỷ giữ huỷ. */
export function statusAfterReversal(inv: ReversalInvoice, paidAfter: number): string {
  if (inv.status === "cancelled") return "cancelled";
  if (paidAfter >= inv.amountDue && inv.amountDue > 0) return "paid";
  if (paidAfter > 0) return "partial";
  return inv.sentAt ? "sent" : "draft";
}

export function planReversal(i: { tx: ReversalTx; invoice: ReversalInvoice | null; credits: ReversalCredit[] }): ReversalPlan {
  const { tx, invoice, credits } = i;
  if (!(REVERSIBLE_TX_STATUSES as readonly string[]).includes(tx.status)) {
    return { ok: false, code: "not_reversible", blocker: tx.status === "reversed" ? "Khoản này đã được hoàn tác rồi" : "Khoản này chưa được gạch vào phiếu nào nên không có gì để hoàn tác" };
  }
  if (!tx.invoiceId || !invoice) return { ok: false, code: "no_invoice", blocker: "Không tìm thấy phiếu mà khoản này đã gạch vào" };
  const used = credits.reduce((s, c) => s + c.usedAmount, 0);
  if (used > 0) {
    return { ok: false, code: "credit_used", blocker: `Phần dư của khoản này đã được trừ ${used.toLocaleString("vi-VN")}đ vào phiếu tháng sau. Hãy xử lý phiếu đó trước rồi mới hoàn tác khoản này.` };
  }
  const reversedAmount = Math.max(0, tx.appliedAmount);
  const paidAfter = Math.max(0, invoice.paidAmount - reversedAmount);
  const creditsToVoid = credits.filter(c => c.amount > 0).map(c => ({ id: c.id, amount: c.amount }));
  const creditsVoidedTotal = creditsToVoid.reduce((s, c) => s + c.amount, 0);
  const excess = Math.max(0, tx.amount - tx.appliedAmount);
  return {
    ok: true,
    outcome: tx.provider === "manual" ? "voided" : "requeued",
    reversedAmount,
    invoiceStatusFrom: invoice.status,
    invoiceStatusTo: statusAfterReversal(invoice, paidAfter),
    paidBefore: invoice.paidAmount,
    paidAfter,
    remainingAfter: Math.max(0, invoice.amountDue - paidAfter),
    clearPaidAt: statusAfterReversal(invoice, paidAfter) !== "paid",
    creditsToVoid,
    creditsVoidedTotal,
    untrackedExcess: Math.max(0, excess - creditsVoidedTotal),
  };
}

/** Lý do hoàn tác: bắt buộc, cắt khoảng trắng, tối đa REVERSAL_REASON_MAX ký tự. */
export function validateReversalReason(v: unknown): { ok: true; reason: string } | { ok: false; error: string } {
  const reason = typeof v === "string" ? v.trim() : "";
  if (!reason) return { ok: false, error: "Vui lòng ghi lý do hoàn tác" };
  if (reason.length > REVERSAL_REASON_MAX) return { ok: false, error: `Lý do tối đa ${REVERSAL_REASON_MAX} ký tự` };
  return { ok: true, reason };
}
