// TT-200 — webhook SePay (docs/kin/nghiep-vu/doi-soat-vietqr.md mục 2). Mỗi gia sư
// có địa chỉ + khoá riêng; gia sư tự mở SePay và dán vào. KiN chỉ ĐỌC tiền vào.
//
// Mỗi lần nhận (SePay có thể gửi 1 giao dịch nhiều lần):
//   1. Kiểm khoá API (Authorization: Apikey …) với băm đã lưu. Sai → 401.
//   2. Chỉ nhận transferType = "in".
//   3. Chống trùng: id SePay là khoá duy nhất → đã có thì trả thành công.
//   4. Lưu giao dịch (KHÔNG lưu `accumulated` — GD-22).
//   5. Tìm mã phiếu trong `code` / `content`, chỉ trong phạm vi phiếu CỦA gia sư
//      này (mã của gia sư khác = "mã không có").
//   6. Phân loại; chỉ TỰ GẠCH khi đúng mã + đúng số tiền còn lại + phiếu đang mở.
//      Còn lại vào hàng chờ cho gia sư quyết. Không bao giờ ghép theo số tiền.
//   7. Trả 200 {"success": true}.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientIp, limitOrBlock, rateLimit } from "@/lib/rate-limit";
import { notify } from "@/lib/notify";
import { applyToInvoice, lockInvoice } from "@/lib/invoiceServer";
import {
  UNPAID_STATUSES, canAutoApply, classifyPayment, extractApiKey, extractInvoiceCode, parseSepayPayload,
  suggestInvoices, verifyWebhookKey, TX_KIND_LABEL,
} from "@/lib/tuitionInvoice";

export async function POST(req: NextRequest, { params }: { params: Promise<{ tutorId: string }> }) {
  const { tutorId } = await params;
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(tutorId)) return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });

  const blocked = limitOrBlock(tutorId, "sepay-webhook", 300, 60_000);
  if (blocked) return blocked;

  const acc = await prisma.tutorPayoutAccount.findUnique({ where: { userId: tutorId }, select: { webhookKeyHash: true, webhookSeenAt: true } });
  const key = extractApiKey(req.headers.get("authorization"));
  if (!verifyWebhookKey(key, acc?.webhookKeyHash)) {
    // Đoán khoá: mỗi IP tối đa 30 lần sai/phút. Không phân biệt "không có tài khoản" với "sai khoá".
    if (!rateLimit(`sepay-fail:${getClientIp(req)}`, 30, 60_000)) {
      return NextResponse.json({ success: false, error: "too many requests" }, { status: 429 });
    }
    return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = parseSepayPayload(body);
  if ("ignore" in parsed) return NextResponse.json({ success: true, ignored: true });
  if ("error" in parsed) return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
  const tx = parsed.tx;

  const dupWhere = { tutorId_provider_providerTxId: { tutorId, provider: "sepay", providerTxId: tx.id } };
  if (await prisma.bankTransaction.findUnique({ where: dupWhere, select: { id: true } })) {
    return NextResponse.json({ success: true, duplicate: true });
  }

  const code = extractInvoiceCode(tx.code, tx.content);
  try {
    const out = await prisma.$transaction(async db => {
      let invoice = null;
      if (code) {
        const found = await db.tuitionInvoice.findFirst({ where: { code, tutorId }, select: { id: true } });
        if (found) {
          await lockInvoice(db, found.id); // 2 webhook trùng cùng lúc xếp hàng ở đây
          invoice = await db.tuitionInvoice.findUnique({ where: { id: found.id }, include: { student: { select: { name: true } } } });
        }
      }
      const kind = classifyPayment({ amount: tx.amount, code, invoice });
      const auto = !!invoice && canAutoApply(kind, invoice.status);

      let suggested: string[] = [];
      if (!invoice) {
        const open = await db.tuitionInvoice.findMany({ where: { tutorId, status: { in: UNPAID_STATUSES } }, select: { id: true, status: true, amountDue: true, paidAmount: true } });
        suggested = suggestInvoices(tx.amount, open).map(i => i.id).slice(0, 10); // chỉ gợi ý, KHÔNG tự ghép
      }

      const row = await db.bankTransaction.create({
        data: {
          tutorId, provider: "sepay", providerTxId: tx.id, occurredAt: tx.occurredAt, amount: tx.amount,
          content: tx.content, providerCode: tx.code, referenceCode: tx.referenceCode, gateway: tx.gateway,
          matchedCode: code, invoiceId: invoice?.id ?? null, kind,
          status: auto ? "matched" : "pending", resolution: auto ? "auto_matched" : null, suggestedInvoiceIds: suggested,
        },
      });
      if (auto && invoice) {
        const { applied } = await applyToInvoice(db, invoice.id, tx.amount);
        await db.bankTransaction.update({ where: { id: row.id }, data: { appliedAmount: applied } });
      }
      return { kind, auto, invoiceCode: invoice?.code ?? null, studentName: invoice?.student.name ?? null };
    });

    if (!acc?.webhookSeenAt) {
      await prisma.tutorPayoutAccount.updateMany({ where: { userId: tutorId, webhookSeenAt: null }, data: { webhookSeenAt: new Date() } });
    }
    const money = `${tx.amount.toLocaleString("vi-VN")}đ`;
    await notify(tutorId, out.auto
      ? { type: "invoice_paid", title: "Đã gạch phiếu học phí", message: `${out.studentName ?? "Học sinh"} đóng ${money} (${out.invoiceCode}).`, link: "/lop-cua-toi/hoc-phi" }
      : { type: "bank_tx_pending", title: "Có khoản tiền cần đối soát", message: `${money} — ${TX_KIND_LABEL[out.kind]}. Mở hàng chờ để xử lý.`, link: "/lop-cua-toi/hoc-phi?tab=doi-soat" });
    return NextResponse.json({ success: true });
  } catch (e) {
    if ((e as { code?: string })?.code === "P2002") return NextResponse.json({ success: true, duplicate: true }); // trùng đồng thời
    console.error("[POST /api/webhooks/sepay]", e);
    return NextResponse.json({ success: false, error: "internal" }, { status: 500 }); // SePay sẽ gửi lại
  }
}
