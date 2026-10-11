// TT-200 — cấp khoá cho SePay gửi kèm webhook (Authorization: Apikey <khoá>).
// Khoá chỉ hiện bản rõ ĐÚNG MỘT LẦN trong phản hồi này; DB chỉ lưu băm sha256.
// Cấp lại = khoá cũ chết ngay (gia sư phải dán khoá mới vào SePay).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { logAction } from "@/lib/auditLog";
import { requireTutor } from "@/lib/invoiceServer";
import { generateWebhookKey, hashWebhookKey } from "@/lib/tuitionInvoice";

export async function POST() {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;

  const acc = await prisma.tutorPayoutAccount.findUnique({ where: { userId: auth.userId }, select: { userId: true, webhookKeyHash: true } });
  if (!acc) return NextResponse.json({ error: "Hãy lưu tài khoản nhận tiền trước khi lấy khoá" }, { status: 409 });

  const key = generateWebhookKey();
  await prisma.tutorPayoutAccount.update({
    where: { userId: auth.userId },
    data: { webhookKeyHash: hashWebhookKey(key), webhookKeyHint: key.slice(-4), webhookSeenAt: null },
  });
  await logAction(auth.userId, "payout_account.webhook_key_rotate", "TutorPayoutAccount", auth.userId, { hadPrevious: !!acc.webhookKeyHash });

  return NextResponse.json({ key, hint: key.slice(-4) }, { headers: { "Cache-Control": "no-store" } });
}
