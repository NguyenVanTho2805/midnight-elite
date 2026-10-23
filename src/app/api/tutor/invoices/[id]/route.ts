// TT-200 — thao tác trên 1 phiếu của gia sư.
//   GET   → chi tiết + các khoản tiền đã ghi.
//   PATCH { action, ... }:
//     send                     nháp → đã gửi (phụ huynh/học viên thấy phiếu)
//     cancel { reason }        huỷ (lưu lý do), bất kỳ lúc nào trừ khi đã huỷ
//     restore                  huỷ → nháp
//     set_amount { amountDue, reason }  sửa số tiền; MÃ PHIẾU KHÔNG ĐỔI (GD-19)
//     attach_charges { preview?, chargeIds? }  HP-24: gộp khoản phí rời (chưa vào phiếu nào) vào PHIẾU NHÁP; preview:true chỉ tính
//     record_payment { amount, excess?, paidOn?, method? } ghi tiền mặt / tiền không qua SePay
//                              — cùng luật đủ/thiếu/dư; dư phải chọn
//                              excess: "credit" (trừ tháng sau) | "refunded"
//                              HP-20: paidOn "YYYY-MM-DD" (ngày thu, giờ VN; bỏ trống = bây giờ),
//                              method "cash" | "bank_transfer" (bỏ trống = "cash", đúng hành vi cũ)
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { logAction } from "@/lib/auditLog";
import { addCredit, applyToInvoice, lockInvoice, requireTutor } from "@/lib/invoiceServer";
import { INVOICE_STATUS_LABEL, remainingOf, statusAfterPayment, type InvoiceStatus } from "@/lib/tuitionInvoice";
import { isPaymentMethod, manualPaymentContent, resolvePaidOn } from "@/lib/tuitionPayment";
import { attachLooseCharges, listLooseCharges, linesForAttach } from "@/lib/looseChargeServer";

const MAX_VND = 1_000_000_000;

async function loadOwned(id: string, tutorId: string) {
  const inv = await prisma.tuitionInvoice.findUnique({ where: { id }, include: { student: { select: { id: true, name: true } } } });
  return inv && inv.tutorId === tutorId ? inv : null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  const { id } = await params;
  const inv = await loadOwned(id, auth.userId);
  if (!inv) return NextResponse.json({ error: "Không tìm thấy phiếu" }, { status: 404 });
  const txs = await prisma.bankTransaction.findMany({ where: { invoiceId: id }, orderBy: { occurredAt: "desc" }, take: 50 });
  const loose = inv.status === "draft" ? await listLooseCharges(auth.userId, inv.studentId, inv.yearMonth) : [];
  return NextResponse.json({
    invoice: { ...inv, remaining: remainingOf(inv), statusLabel: INVOICE_STATUS_LABEL[inv.status as InvoiceStatus] },
    looseCharges: loose.map(l => ({ id: l.id, courseName: l.courseName, kind: l.kind, label: l.label, amount: l.amount, dateKey: l.dateKey })),
    looseLines: linesForAttach(loose, inv.yearMonth),
    transactions: txs.map(t => ({ id: t.id, provider: t.provider, method: t.method, amount: t.amount, appliedAmount: t.appliedAmount, status: t.status, resolution: t.resolution, occurredAt: t.occurredAt.toISOString() })),
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  const { id } = await params;
  const inv = await loadOwned(id, auth.userId);
  if (!inv) return NextResponse.json({ error: "Không tìm thấy phiếu" }, { status: 404 });

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const action = body?.action;

  switch (action) {
    case "send": {
      if (inv.status === "sent" || inv.status === "parent_reported" || inv.status === "partial") return NextResponse.json({ ok: true, alreadySent: true });
      if (inv.status !== "draft") return NextResponse.json({ error: inv.status === "paid" ? "Phiếu đã đóng đủ" : "Phiếu đã huỷ — khôi phục trước khi gửi" }, { status: 409 });
      const r = await prisma.tuitionInvoice.updateMany({ where: { id, status: "draft" }, data: { status: "sent", sentAt: new Date() } });
      if (r.count === 0) return NextResponse.json({ error: "Phiếu vừa đổi trạng thái, tải lại trang" }, { status: 409 });
      await logAction(auth.userId, "invoice.send", "TuitionInvoice", id, { code: inv.code });
      return NextResponse.json({ ok: true });
    }

    case "cancel": {
      const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
      if (!reason) return NextResponse.json({ error: "Vui lòng ghi lý do huỷ phiếu" }, { status: 400 });
      if (reason.length > 300) return NextResponse.json({ error: "Lý do tối đa 300 ký tự" }, { status: 400 });
      const r = await prisma.tuitionInvoice.updateMany({ where: { id, status: { not: "cancelled" } }, data: { status: "cancelled", cancelReason: reason } });
      if (r.count === 0) return NextResponse.json({ ok: true, alreadyCancelled: true });
      await logAction(auth.userId, "invoice.cancel", "TuitionInvoice", id, { code: inv.code, reason, paidAmount: inv.paidAmount });
      return NextResponse.json({ ok: true });
    }

    case "restore": {
      const r = await prisma.tuitionInvoice.updateMany({ where: { id, status: "cancelled" }, data: { status: "draft", cancelReason: null } });
      if (r.count === 0) return NextResponse.json({ error: "Phiếu không ở trạng thái đã huỷ" }, { status: 409 });
      await logAction(auth.userId, "invoice.restore", "TuitionInvoice", id, { code: inv.code });
      return NextResponse.json({ ok: true });
    }

    case "set_amount": {
      const due = body?.amountDue;
      const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
      if (typeof due !== "number" || !Number.isInteger(due) || due < 0 || due > MAX_VND) return NextResponse.json({ error: "Số tiền phải là số nguyên từ 0" }, { status: 400 });
      if (!reason) return NextResponse.json({ error: "Vui lòng ghi lý do điều chỉnh" }, { status: 400 });
      if (reason.length > 300) return NextResponse.json({ error: "Lý do tối đa 300 ký tự" }, { status: 400 });
      try {
        const out = await prisma.$transaction(async tx => {
          await lockInvoice(tx, id);
          const cur = await tx.tuitionInvoice.findUniqueOrThrow({ where: { id } });
          if (cur.status === "paid" || cur.status === "cancelled") throw Object.assign(new Error("closed"), { http: 409, msg: cur.status === "paid" ? "Phiếu đã đóng đủ, không sửa được số tiền" : "Phiếu đã huỷ" });
          const status = statusAfterPayment(due, cur.paidAmount, cur.status as InvoiceStatus);
          return tx.tuitionInvoice.update({
            where: { id },
            data: { amountDue: due, status, ...(status === "paid" ? { paidAt: new Date() } : {}) },
          });
        });
        await logAction(auth.userId, "invoice.set_amount", "TuitionInvoice", id, { code: inv.code, from: inv.amountDue, to: due, reason });
        return NextResponse.json({ ok: true, invoice: { id, amountDue: out.amountDue, status: out.status, remaining: remainingOf(out) } });
      } catch (e) {
        const h = e as { http?: number; msg?: string };
        if (h.http) return NextResponse.json({ error: h.msg }, { status: h.http });
        throw e;
      }
    }

    case "attach_charges": {
      const ids = body?.chargeIds;
      if (ids !== undefined && (!Array.isArray(ids) || ids.length === 0 || ids.some(x => typeof x !== "string"))) return NextResponse.json({ error: "chargeIds không hợp lệ" }, { status: 400 });
      const preview = body?.preview === true;
      const out = await attachLooseCharges({ invoiceId: id, tutorId: auth.userId, chargeIds: (ids as string[] | undefined) ?? null, preview });
      if (!out.ok) return NextResponse.json({ error: out.error }, { status: out.status });
      if (!preview) await logAction(auth.userId, "invoice.attach_charges", "TuitionInvoice", id, { code: inv.code, count: out.count, total: out.total, net: out.net, from: out.amountDueFrom, to: out.amountDueTo });
      return NextResponse.json(out);
    }

    case "record_payment": {
      const amount = body?.amount;
      const excess = body?.excess;
      if (typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0 || amount > MAX_VND) return NextResponse.json({ error: "Số tiền phải là số nguyên dương" }, { status: 400 });
      if (excess !== undefined && excess !== "credit" && excess !== "refunded") return NextResponse.json({ error: "excess phải là credit hoặc refunded" }, { status: 400 });
      // HP-20: ngày thu + hình thức. Không gửi = hành vi cũ (bây giờ, tiền mặt).
      if (body?.method !== undefined && !isPaymentMethod(body.method)) return NextResponse.json({ error: "Hình thức phải là tiền mặt hoặc chuyển khoản" }, { status: 400 });
      const method = isPaymentMethod(body?.method) ? body.method : "cash";
      const paidOn = resolvePaidOn(body?.paidOn);
      if (!paidOn.ok) return NextResponse.json({ error: paidOn.error }, { status: 400 });
      try {
        const out = await prisma.$transaction(async tx => {
          await lockInvoice(tx, id);
          const cur = await tx.tuitionInvoice.findUniqueOrThrow({ where: { id } });
          if (cur.status === "cancelled") throw Object.assign(new Error("x"), { http: 409, msg: "Phiếu đã huỷ" });
          const rem = remainingOf(cur);
          if (cur.status === "paid" || rem === 0) throw Object.assign(new Error("x"), { http: 409, msg: "Phiếu đã đóng đủ" });
          if (amount > rem && !excess) throw Object.assign(new Error("x"), { http: 400, msg: `Số tiền vượt phần còn lại ${rem.toLocaleString("vi-VN")}đ — chọn trừ vào tháng sau hoặc ghi đã trả lại`, needExcess: true, excess: amount - rem });
          const btx = await tx.bankTransaction.create({
            data: {
              tutorId: auth.userId, provider: "manual", providerTxId: `manual-${randomUUID()}`, occurredAt: paidOn.occurredAt,
              amount, content: manualPaymentContent(method), method, matchedCode: cur.code, invoiceId: id,
              kind: amount === rem ? "exact" : amount < rem ? "short" : "over", status: "resolved", resolution: "manual_cash",
              resolvedBy: auth.userId, resolvedAt: new Date(),
            },
          });
          const { applied, excess: extra, invoice } = await applyToInvoice(tx, id, amount);
          await tx.bankTransaction.update({ where: { id: btx.id }, data: { appliedAmount: applied } });
          if (extra > 0 && excess === "credit") await addCredit(tx, auth.userId, cur.studentId, extra, btx.id);
          return { invoice, applied, extra };
        });
        await logAction(auth.userId, "invoice.record_payment", "TuitionInvoice", id, { code: inv.code, amount, applied: out.applied, excess: out.extra, excessHandling: out.extra > 0 ? excess : null, method, paidOn: paidOn.dateKey });
        return NextResponse.json({ ok: true, applied: out.applied, excess: out.extra, invoice: { id, status: out.invoice.status, paidAmount: out.invoice.paidAmount, remaining: remainingOf(out.invoice) } });
      } catch (e) {
        const h = e as { http?: number; msg?: string; needExcess?: boolean; excess?: number };
        if (h.http) return NextResponse.json({ error: h.msg, ...(h.needExcess ? { needExcess: true, excess: h.excess } : {}) }, { status: h.http });
        throw e;
      }
    }

    default:
      return NextResponse.json({ error: "action không hợp lệ" }, { status: 400 });
  }
}
