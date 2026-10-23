// TT-200 — phiếu học phí của gia sư.
//   GET  ?yearMonth=YYYY-MM&status=… → danh sách phiếu của MÌNH + tổng hợp.
//   POST { yearMonth, studentIds?, scholarship?, discount? } → lập phiếu NHÁP
//        cho cả lớp (hoặc vài em). Số tiền CHỐT ngay lúc lập (tiền chốt vào sự
//        kiện): sau này đổi giá lớp thì phiếu cũ giữ nguyên.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { logAction } from "@/lib/auditLog";
import { ENROLLMENT_STATUS } from "@/lib/enrollment";
import { parseYearMonth } from "@/lib/tuition";
import { INVOICE_STATUS_LABEL, UNPAID_STATUSES, buildInvoiceQrUrl, buildTransferContent, remainingOf, type InvoiceStatus } from "@/lib/tuitionInvoice";
import { issueInvoice, requireTutor } from "@/lib/invoiceServer";

const REPORT_CHECK_MS = 24 * 60 * 60 * 1000; // GD-23: quá 24h chưa thấy tiền → nhắc kiểm sao kê

export async function GET(req: NextRequest) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;

  const sp = new URL(req.url).searchParams;
  const ymRaw = sp.get("yearMonth");
  const ym = ymRaw ? parseYearMonth(ymRaw) : null;
  if (ymRaw && !ym) return NextResponse.json({ error: "yearMonth phải định dạng YYYY-MM" }, { status: 400 });
  const status = sp.get("status");
  if (status && !(status in INVOICE_STATUS_LABEL)) return NextResponse.json({ error: "status không hợp lệ" }, { status: 400 });

  const account = await prisma.tutorPayoutAccount.findUnique({ where: { userId: auth.userId }, select: { bankBin: true, accountNo: true, accountName: true } });
  const rows = await prisma.tuitionInvoice.findMany({
    where: { tutorId: auth.userId, ...(ym ? { yearMonth: ym.yearMonth } : {}), ...(status ? { status } : {}) },
    orderBy: [{ yearMonth: "desc" }, { student: { name: "asc" } }],
    include: { student: { select: { id: true, name: true } } },
    take: 500,
  });
  const now = Date.now();
  // HP-24: phiếu NHÁP còn khoản phí rời (chưa vào phiếu nào) có thể gộp thêm.
  const draftRows = rows.filter(r => r.status === "draft");
  const looseAll = draftRows.length
    ? await prisma.feeCharge.findMany({ where: { tutorId: auth.userId, invoiceId: null, studentId: { in: draftRows.map(r => r.studentId) } }, select: { studentId: true, yearMonth: true, amount: true } })
    : [];
  const looseOf = (r: { status: string; studentId: string; yearMonth: string }) => (r.status === "draft" ? looseAll.filter(l => l.studentId === r.studentId && l.yearMonth <= r.yearMonth) : []);
  const items = rows.map(r => ({
    looseCount: looseOf(r).length, looseTotal: looseOf(r).reduce((s, l) => s + l.amount, 0),
    id: r.id, code: r.code, yearMonth: r.yearMonth, studentId: r.student.id, studentName: r.student.name,
    amountDue: r.amountDue, paidAmount: r.paidAmount, remaining: remainingOf(r),
    status: r.status as InvoiceStatus, statusLabel: INVOICE_STATUS_LABEL[r.status as InvoiceStatus] ?? r.status,
    sentAt: r.sentAt?.toISOString() ?? null, paidAt: r.paidAt?.toISOString() ?? null,
    parentReportedAt: r.parentReportedAt?.toISOString() ?? null, cancelReason: r.cancelReason,
    // TT-199: "Đã mở Zalo lúc …" (không phải "đã gửi") và "Phụ huynh đã xem".
    zaloOpenedAt: r.zaloOpenedAt?.toISOString() ?? null, parentViewedAt: r.parentViewedAt?.toISOString() ?? null,
    needsBankCheck: r.status === "parent_reported" && !!r.parentReportedAt && now - r.parentReportedAt.getTime() > REPORT_CHECK_MS,
    creditApplied: (r.breakdown as { creditApplied?: number } | null)?.creditApplied ?? 0,
    // Để gia sư sao chép tin nhắn/QR gửi phụ huynh (Zalo) — dựng từ tài khoản CỦA GIA SƯ.
    transferContent: buildTransferContent(r.code, r.student.name),
    qrUrl: account && remainingOf(r) > 0 && (UNPAID_STATUSES as string[]).includes(r.status)
      ? buildInvoiceQrUrl(account, { amount: remainingOf(r), addInfo: buildTransferContent(r.code, r.student.name) }) : null,
  }));
  const live = items.filter(i => i.status !== "cancelled");
  return NextResponse.json({
    items,
    hasPayoutAccount: !!account,
    summary: {
      count: live.length,
      totalDue: live.reduce((s, i) => s + i.amountDue, 0),
      totalPaid: live.reduce((s, i) => s + i.paidAmount, 0),
      totalRemaining: live.reduce((s, i) => s + i.remaining, 0),
    },
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;

  const body = await req.json().catch(() => null) as { yearMonth?: unknown; studentIds?: unknown; scholarship?: unknown; discount?: unknown } | null;
  const ym = parseYearMonth(body?.yearMonth);
  if (!ym) return NextResponse.json({ error: "yearMonth phải định dạng YYYY-MM" }, { status: 400 });

  let studentIds: string[];
  if (body?.studentIds !== undefined) {
    if (!Array.isArray(body.studentIds) || body.studentIds.some(x => typeof x !== "string") || body.studentIds.length === 0 || body.studentIds.length > 300) {
      return NextResponse.json({ error: "studentIds phải là danh sách 1–300 id" }, { status: 400 });
    }
    studentIds = [...new Set(body.studentIds as string[])];
  } else {
    const enr = await prisma.enrollment.findMany({
      where: { status: ENROLLMENT_STATUS.ACTIVE, course: { ownerId: auth.userId } },
      select: { userId: true }, distinct: ["userId"], take: 300,
    });
    studentIds = enr.map(e => e.userId);
  }

  const num = (v: unknown) => (v === undefined || v === null ? 0 : typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 1_000_000_000 ? v : NaN);
  const scholarship = num(body?.scholarship), discount = num(body?.discount);
  if (Number.isNaN(scholarship) || Number.isNaN(discount)) return NextResponse.json({ error: "Học bổng/giảm trừ phải là số nguyên không âm" }, { status: 400 });
  if ((scholarship || discount) && studentIds.length !== 1) {
    return NextResponse.json({ error: "Học bổng/giảm trừ chỉ áp khi lập phiếu cho đúng 1 em" }, { status: 400 });
  }

  const names = new Map((await prisma.user.findMany({ where: { id: { in: studentIds } }, select: { id: true, name: true } })).map(u => [u.id, u.name]));
  const created: Array<{ id: string; code: string; studentId: string; studentName: string; amountDue: number; status: string; creditApplied: number }> = [];
  const skipped: Array<{ studentId: string; studentName: string; reason: string }> = [];
  for (const studentId of studentIds) {
    const r = await issueInvoice({ tutorId: auth.userId, studentId, yearMonth: ym.yearMonth, scholarship, discount });
    const studentName = names.get(studentId) ?? "—";
    if (r.ok) created.push({ ...r.invoice, studentName });
    else skipped.push({ studentId, studentName, reason: r.reason });
  }
  if (created.length) {
    await logAction(auth.userId, "invoice.issue", "TuitionInvoice", created[0].id, { yearMonth: ym.yearMonth, count: created.length, codes: created.map(c => c.code).slice(0, 50) });
  }
  return NextResponse.json({ created, skipped }, { status: created.length ? 201 : 200 });
}
