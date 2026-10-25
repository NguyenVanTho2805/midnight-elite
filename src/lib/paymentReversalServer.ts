// HP-21 — thao tác DB cho hoàn tác khoản đã thu. Mọi thay đổi tiền đi qua MỘT hàm (executeReversal) trong một transaction,
// khoá theo phiếu như resolve/record_payment, "nhận" khoản bằng updateMany có điều kiện trạng thái để hai lần bấm chỉ một lần thắng.
// Không xoá dòng nào: BankTransaction đổi trạng thái, TuitionCredit bị thu hồi tại chỗ (amount = usedAmount = 0), phiếu trừ lại paidAmount,
// và LUÔN thêm một dòng PaymentReversal (ai, lúc nào, lý do, trước/sau).
import { prisma } from "@/lib/prisma";
import { lockInvoice, type Tx } from "@/lib/invoiceServer";
import { UNPAID_STATUSES, suggestInvoices } from "@/lib/tuitionInvoice";
import { planReversal, REVERSIBLE_TX_STATUSES, type ReversalPlan } from "@/lib/tuitionPayment";

export interface ReversalPreview {
  tx: { id: string; provider: string; method: string | null; amount: number; appliedAmount: number; content: string; occurredAt: string; status: string; resolution: string | null };
  invoice: { id: string; code: string; studentName: string; yearMonth: string; amountDue: number; paidAmount: number; status: string } | null;
  plan: ReversalPlan;
}

type Db = Tx | typeof prisma;

async function load(db: Db, tutorId: string, txId: string) {
  const tx = await db.bankTransaction.findUnique({ where: { id: txId } });
  if (!tx || tx.tutorId !== tutorId) return null;
  const invoice = tx.invoiceId
    ? await db.tuitionInvoice.findUnique({ where: { id: tx.invoiceId }, include: { student: { select: { name: true } } } })
    : null;
  const credits = await db.tuitionCredit.findMany({ where: { tutorId, sourceTxId: tx.id }, select: { id: true, amount: true, usedAmount: true } });
  return { tx, invoice, credits };
}

/** Xem trước (không ghi gì). null = không có khoản này của gia sư này (→ 404). */
export async function previewReversal(tutorId: string, txId: string): Promise<ReversalPreview | null> {
  const ctx = await load(prisma, tutorId, txId);
  if (!ctx) return null;
  const { tx, invoice, credits } = ctx;
  return {
    tx: { id: tx.id, provider: tx.provider, method: tx.method, amount: tx.amount, appliedAmount: tx.appliedAmount, content: tx.content, occurredAt: tx.occurredAt.toISOString(), status: tx.status, resolution: tx.resolution },
    invoice: invoice ? { id: invoice.id, code: invoice.code, studentName: invoice.student.name, yearMonth: invoice.yearMonth, amountDue: invoice.amountDue, paidAmount: invoice.paidAmount, status: invoice.status } : null,
    plan: planReversal({ tx, invoice, credits }),
  };
}

export class ReversalError extends Error { constructor(public http: number, public msg: string) { super(msg); } }

export async function executeReversal(tutorId: string, txId: string, reason: string): Promise<{ plan: Extract<ReversalPlan, { ok: true }>; invoiceCode: string; invoiceId: string }> {
  return prisma.$transaction(async db => {
    const first = await db.bankTransaction.findUnique({ where: { id: txId }, select: { tutorId: true, invoiceId: true } });
    if (!first || first.tutorId !== tutorId) throw new ReversalError(404, "Không tìm thấy khoản tiền");
    if (!first.invoiceId) throw new ReversalError(409, "Khoản này chưa được gạch vào phiếu nào nên không có gì để hoàn tác");
    await lockInvoice(db, first.invoiceId); // cùng khoá với record_payment / resolve / webhook
    const ctx = await load(db, tutorId, txId);
    if (!ctx || !ctx.invoice) throw new ReversalError(404, "Không tìm thấy phiếu");
    const { tx, invoice, credits } = ctx;
    const plan = planReversal({ tx, invoice, credits });
    if (!plan.ok) throw new ReversalError(409, plan.blocker);

    // "Nhận" khoản: chỉ một lần bấm thắng.
    const claim = await db.bankTransaction.updateMany({
      where: { id: tx.id, tutorId, status: { in: [...REVERSIBLE_TX_STATUSES] }, invoiceId: invoice.id },
      data: plan.outcome === "voided"
        ? { status: "reversed" } // giữ nguyên appliedAmount/resolution để tra cứu; trạng thái "reversed" bị loại khỏi doanh thu
        : { status: "pending", resolution: null, resolvedBy: null, resolvedAt: null, invoiceId: null, appliedAmount: 0, matchedCode: null, kind: "no_code" },
    });
    if (claim.count !== 1) throw new ReversalError(409, "Khoản này vừa được xử lý ở nơi khác, hãy tải lại trang");

    await db.tuitionInvoice.update({
      where: { id: invoice.id },
      data: { paidAmount: plan.paidAfter, status: plan.invoiceStatusTo, ...(plan.clearPaidAt ? { paidAt: null } : {}) },
    });
    for (const c of plan.creditsToVoid) {
      // Thu hồi tại chỗ: số dư tín dụng = amount − usedAmount = 0. Dòng giữ nguyên để tra cứu (chi tiết ở PaymentReversal).
      await db.tuitionCredit.update({ where: { id: c.id }, data: { amount: 0 } });
    }
    if (plan.outcome === "requeued") {
      const open = await db.tuitionInvoice.findMany({ where: { tutorId, status: { in: UNPAID_STATUSES } }, select: { id: true, status: true, amountDue: true, paidAmount: true } });
      await db.bankTransaction.update({ where: { id: tx.id }, data: { suggestedInvoiceIds: suggestInvoices(tx.amount, open).map(i => i.id).slice(0, 10) } });
    }
    await db.paymentReversal.create({
      data: {
        tutorId, bankTransactionId: tx.id, invoiceId: invoice.id, reversedAmount: plan.reversedAmount, reason, outcome: plan.outcome,
        invoiceStatusFrom: plan.invoiceStatusFrom, invoiceStatusTo: plan.invoiceStatusTo, creditsVoided: plan.creditsVoidedTotal, reversedBy: tutorId,
      },
    });
    return { plan, invoiceCode: invoice.code, invoiceId: invoice.id };
  });
}
