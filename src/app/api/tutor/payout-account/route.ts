// TT-200 — tài khoản nhận học phí của gia sư (Cài đặt → Nhận tiền).
//   GET → thông tin + địa chỉ webhook riêng + số giao dịch SePay tháng này.
//   PUT → lưu ngân hàng/số TK/tên chủ TK (không đụng khoá webhook).
// KiN không nhận tên đăng nhập ngân hàng của ai; chỉ lưu số TK để dựng mã VietQR.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { logAction } from "@/lib/auditLog";
import { requireTutor } from "@/lib/invoiceServer";
import { bankName, validatePayoutAccount, SEPAY_FREE_LIMIT, SEPAY_WARN_AT } from "@/lib/tuitionInvoice";
import { vnMonthKey } from "@/lib/revenue";

function webhookUrlFor(req: NextRequest, tutorId: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin).replace(/\/+$/, "");
  return `${base}/api/webhooks/sepay/${tutorId}`;
}

export async function GET(req: NextRequest) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;

  const acc = await prisma.tutorPayoutAccount.findUnique({ where: { userId: auth.userId } });

  // Số giao dịch SePay đã nhận trong THÁNG này (giờ VN) để báo khi gần hết gói miễn phí.
  const monthStart = new Date(`${vnMonthKey(new Date())}-01T00:00:00+07:00`);
  const sepayMonthCount = await prisma.bankTransaction.count({
    where: { tutorId: auth.userId, provider: "sepay", createdAt: { gte: monthStart } },
  });

  return NextResponse.json({
    account: acc && {
      bankBin: acc.bankBin, bankName: bankName(acc.bankBin), accountNo: acc.accountNo, accountName: acc.accountName,
      hasKey: !!acc.webhookKeyHash, keyHint: acc.webhookKeyHint, seenAt: acc.webhookSeenAt?.toISOString() ?? null,
    },
    webhookUrl: webhookUrlFor(req, auth.userId),
    sepay: { monthCount: sepayMonthCount, freeLimit: SEPAY_FREE_LIMIT, warn: sepayMonthCount >= SEPAY_WARN_AT },
  });
}

export async function PUT(req: NextRequest) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;

  const body = await req.json().catch(() => null);
  const v = validatePayoutAccount(body ?? {});
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  const acc = await prisma.tutorPayoutAccount.upsert({
    where: { userId: auth.userId },
    create: { userId: auth.userId, ...v.value },
    update: v.value,
  });
  await logAction(auth.userId, "payout_account.update", "TutorPayoutAccount", auth.userId, { bankBin: acc.bankBin, last4: acc.accountNo.slice(-4) });
  return NextResponse.json({ ok: true, account: { bankBin: acc.bankBin, bankName: bankName(acc.bankBin), accountNo: acc.accountNo, accountName: acc.accountName } });
}
