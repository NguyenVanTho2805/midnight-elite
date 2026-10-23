// F2 — lịch sử nhắc của MỘT phiếu: đã mở Zalo ngày nào (bước mấy), phụ huynh bấm “Tôi đã chuyển” lúc nào, đã có tiền ghi vào phiếu chưa.
// Chỉ đọc. Chỉ gia sư chủ phiếu (phiếu của gia sư khác → 404). KiN Pro; hết hạn Pro vẫn đọc được nếu phiếu từng có nhắc bước 2–3.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { canUse } from "@/lib/planServer";
import { PRO_REQUIRED_CODE, buildHistory, reminderDue } from "@/lib/invoiceReminder";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  const { id } = await params;
  const inv = await prisma.tuitionInvoice.findUnique({
    where: { id },
    select: {
      tutorId: true, code: true, yearMonth: true, status: true, amountDue: true, paidAmount: true, dueDate: true, zaloOpenedAt: true, parentReportedAt: true,
      reminders: { select: { step: true, openedAt: true }, orderBy: { openedAt: "asc" } },
    },
  });
  if (!inv || inv.tutorId !== auth.userId) return NextResponse.json({ error: "Không tìm thấy phiếu" }, { status: 404 });

  const hadProSteps = inv.reminders.some(r => r.step >= 2);
  if (!hadProSteps && !(await canUse(auth.userId, "reminder_steps"))) {
    return NextResponse.json({ error: "Lịch sử nhắc có trong KiN Pro.", code: PRO_REQUIRED_CODE }, { status: 403 });
  }
  // Tiền đã ghi vào phiếu này (SePay tự khớp hoặc gia sư ghi tay): chỉ những khoản đã cộng thật vào phiếu.
  const pays = await prisma.bankTransaction.findMany({
    where: { invoiceId: id, tutorId: auth.userId, appliedAmount: { gt: 0 }, status: { in: ["matched", "resolved"] } },
    select: { appliedAmount: true, resolvedAt: true, occurredAt: true }, orderBy: { occurredAt: "asc" }, take: 50,
  });
  const events = buildHistory({
    reminders: inv.reminders, zaloOpenedAt: inv.zaloOpenedAt, parentReportedAt: inv.parentReportedAt,
    payments: pays.map(p => ({ at: p.resolvedAt ?? p.occurredAt, amount: p.appliedAmount })),
  });
  const d = reminderDue(inv, new Date());
  return NextResponse.json({
    code: inv.code, yearMonth: inv.yearMonth, status: inv.status, dueDate: inv.dueDate, overdueDays: d.overdueDays, nextStep: d.step,
    matched: inv.status === "paid" || pays.length > 0, events,
  }, { headers: { "Cache-Control": "no-store" } });
}
