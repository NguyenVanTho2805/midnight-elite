// HP-21 — hoàn tác một khoản đã thu (và hoàn tác ghép sai).
//   GET  → màn rà soát: khoản tiền, phiếu, và CHÍNH XÁC điều gì sẽ đổi nếu xác nhận (không ghi gì).
//   POST { reason, confirm: true } → thực hiện. Phải có lý do; thiếu confirm:true thì từ chối (không hoàn tác "lỡ tay").
// Khoản tiền thật (SePay / đã ghép tay) quay lại HÀNG CHỜ đối soát để ghép lại đúng phiếu; khoản tự ghi tay coi là ghi nhầm.
// Ai bấm, lúc nào, lý do: bảng PaymentReversal + nhật ký hệ thống.
import { NextRequest, NextResponse } from "next/server";
import { isNextResponse } from "@/lib/auth-guard";
import { logAction } from "@/lib/auditLog";
import { requireTutor } from "@/lib/invoiceServer";
import { ReversalError, executeReversal, previewReversal } from "@/lib/paymentReversalServer";
import { validateReversalReason } from "@/lib/tuitionPayment";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  const { id } = await params;
  const out = await previewReversal(auth.userId, id);
  if (!out) return NextResponse.json({ error: "Không tìm thấy khoản tiền" }, { status: 404 });
  return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  const { id } = await params;
  const body = await req.json().catch(() => null) as { reason?: unknown; confirm?: unknown } | null;
  if (body?.confirm !== true) return NextResponse.json({ error: "Cần xác nhận hoàn tác" }, { status: 400 });
  const reason = validateReversalReason(body?.reason);
  if (!reason.ok) return NextResponse.json({ error: reason.error }, { status: 400 });
  try {
    const r = await executeReversal(auth.userId, id, reason.reason);
    await logAction(auth.userId, "bank_tx.reverse", "BankTransaction", id, {
      invoiceId: r.invoiceId, code: r.invoiceCode, reversed: r.plan.reversedAmount, outcome: r.plan.outcome,
      from: r.plan.invoiceStatusFrom, to: r.plan.invoiceStatusTo, creditsVoided: r.plan.creditsVoidedTotal, reason: reason.reason,
    });
    return NextResponse.json({ ok: true, outcome: r.plan.outcome, reversed: r.plan.reversedAmount, invoice: { id: r.invoiceId, code: r.invoiceCode, status: r.plan.invoiceStatusTo, paidAmount: r.plan.paidAfter, remaining: r.plan.remainingAfter } });
  } catch (e) {
    if (e instanceof ReversalError) return NextResponse.json({ error: e.msg }, { status: e.http });
    console.error("[POST /api/tutor/bank-transactions/reverse]", e);
    return NextResponse.json({ error: "Hoàn tác thất bại" }, { status: 500 });
  }
}
