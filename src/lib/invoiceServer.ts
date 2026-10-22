// TT-200 — thao tác DB cho phiếu học phí & đối soát. Mọi thao tác ĐỘNG VÀO TIỀN
// (cộng tiền vào phiếu, tín dụng, huỷ/sửa phiếu) đi qua đây để API tutor, webhook
// SePay và test dùng cùng một đường, và để khoá ở một chỗ.
//
// Khoá: pg_advisory_xact_lock theo phiếu (`invoice:<id>`) — webhook trùng và hai
// lần bấm cùng lúc xếp hàng thay vì cùng cộng tiền. Chống trùng tuyệt đối vẫn là
// khoá duy nhất (tutorId, provider, providerTxId) của BankTransaction.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import type { SessionPayload } from "@/lib/session";
import { ENROLLMENT_STATUS } from "@/lib/enrollment";
import { notify } from "@/lib/notify";
import { computeMonthlyFee, type SubjectFeeInput } from "@/lib/tuition";
import {
  INVOICE_STATUS, INVOICE_STATUS_LABEL, PARENT_VISIBLE_STATUSES, OPEN_STATUSES, buildInvoiceQrUrl, buildTransferContent,
  bankName, generateInvoiceCode, remainingOf, statusAfterPayment, type InvoiceStatus,
} from "@/lib/tuitionInvoice";

export type Tx = Prisma.TransactionClient;

// Chỉ gia sư (role admin + adminRole teacher) thao tác phiếu của chính mình.
// admin_super/admin_content vận hành nền tảng, không đứng tên nhận học phí.
export async function requireTutor(): Promise<SessionPayload | NextResponse> {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;
  if (auth.role !== "admin" || auth.adminRole !== "teacher") {
    return NextResponse.json({ error: "Chỉ gia sư mới dùng chức năng này" }, { status: 403 });
  }
  return auth;
}

export async function lockInvoice(tx: Tx, invoiceId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`invoice:${invoiceId}`}))`;
}
async function lockCredits(tx: Tx, tutorId: string, studentId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`credit:${tutorId}:${studentId}`}))`;
}

// Cộng `amount` vào phiếu (gọi SAU khi đã lockInvoice). Chỉ cộng tối đa phần còn
// lại; phần thừa trả về `excess` để người gọi xử lý (tín dụng / đã trả lại).
export async function applyToInvoice(tx: Tx, invoiceId: string, amount: number) {
  const inv = await tx.tuitionInvoice.findUniqueOrThrow({ where: { id: invoiceId } });
  const applied = Math.min(amount, remainingOf(inv));
  const paidAmount = inv.paidAmount + applied;
  const status = statusAfterPayment(inv.amountDue, paidAmount, inv.status as InvoiceStatus);
  const invoice = await tx.tuitionInvoice.update({
    where: { id: invoiceId },
    data: { paidAmount, status, ...(status === "paid" && inv.status !== "paid" ? { paidAt: new Date() } : {}) },
  });
  return { applied, excess: amount - applied, invoice };
}

export async function addCredit(tx: Tx, tutorId: string, studentId: string, amount: number, sourceTxId: string | null) {
  if (amount <= 0) return null;
  return tx.tuitionCredit.create({ data: { tutorId, studentId, amount, sourceTxId } });
}

// Trừ tín dụng theo thứ tự cũ → mới, tối đa `wanted`. Gọi trong transaction.
export async function consumeCredits(tx: Tx, tutorId: string, studentId: string, wanted: number) {
  if (wanted <= 0) return { used: 0, parts: [] as { id: string; take: number }[] };
  await lockCredits(tx, tutorId, studentId);
  const rows = await tx.tuitionCredit.findMany({ where: { tutorId, studentId }, orderBy: { createdAt: "asc" } });
  let left = wanted;
  const parts: { id: string; take: number }[] = [];
  for (const r of rows) {
    if (left <= 0) break;
    const avail = r.amount - r.usedAmount;
    if (avail <= 0) continue;
    const take = Math.min(avail, left);
    await tx.tuitionCredit.update({ where: { id: r.id }, data: { usedAmount: { increment: take } } });
    parts.push({ id: r.id, take });
    left -= take;
  }
  return { used: wanted - left, parts };
}

export async function creditBalance(tutorId: string, studentId: string): Promise<number> {
  const rows = await prisma.tuitionCredit.findMany({ where: { tutorId, studentId }, select: { amount: true, usedAmount: true } });
  return rows.reduce((s, r) => s + (r.amount - r.usedAmount), 0);
}

export type IssueResult =
  | { ok: true; invoice: { id: string; code: string; studentId: string; amountDue: number; status: string; creditApplied: number } }
  | { ok: false; reason: string };

// Lập phiếu nháp cho 1 em/1 tháng: gom MÔN của gia sư này mà em đang học, tính
// bằng computeMonthlyFee (AS-192/193), trừ tín dụng, CHỐT số tiền vào phiếu.
export async function issueInvoice(opts: {
  tutorId: string; studentId: string; yearMonth: string; scholarship?: number; discount?: number;
}): Promise<IssueResult> {
  const { tutorId, studentId, yearMonth } = opts;
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`invoice-issue:${tutorId}:${studentId}:${yearMonth}`}))`;

      const exists = await tx.tuitionInvoice.findUnique({
        where: { tutorId_studentId_yearMonth: { tutorId, studentId, yearMonth } },
        select: { code: true, status: true },
      });
      if (exists) {
        return { ok: false, reason: exists.status === "cancelled" ? `Đã có phiếu ${exists.code} (đã huỷ) — khôi phục thay vì lập mới` : `Đã có phiếu ${exists.code}` } as IssueResult;
      }

      const enrollments = await tx.enrollment.findMany({
        where: { userId: studentId, status: ENROLLMENT_STATUS.ACTIVE, course: { ownerId: tutorId } },
        include: { course: { select: { id: true, name: true } } },
      });
      if (enrollments.length === 0) return { ok: false, reason: "Em chưa học lớp nào của bạn" } as IssueResult;

      const [fees, override] = await Promise.all([
        tx.monthlyCourseFee.findMany({ where: { yearMonth, courseId: { in: enrollments.map(e => e.courseId) } } }),
        tx.tuitionOverride.findUnique({ where: { userId: studentId } }),
      ]);
      const feeByCourse = new Map(fees.map(f => [f.courseId, f]));
      const subjects: SubjectFeeInput[] = enrollments.map(e => ({
        courseId: e.course.id, courseName: e.course.name,
        sessionCount: feeByCourse.get(e.courseId)?.sessionCount ?? 0,
        freeCount: feeByCourse.get(e.courseId)?.freeCount ?? 0,
      }));
      if (subjects.every(s => s.sessionCount === 0)) return { ok: false, reason: "Chưa nhập số buổi của tháng này" } as IssueResult;

      const b = computeMonthlyFee({ subjects, override: override?.pricePerSession ?? null, scholarship: opts.scholarship, discount: opts.discount });
      if (b.finalAmount <= 0) return { ok: false, reason: "Số phải đóng bằng 0đ" } as IssueResult;

      const credit = await consumeCredits(tx, tutorId, studentId, b.finalAmount);
      const amountDue = b.finalAmount - credit.used;
      const paidByCredit = amountDue === 0;

      for (let attempt = 0; attempt < 6; attempt++) {
        const code = generateInvoiceCode();
        const clash = await tx.tuitionInvoice.findUnique({ where: { code }, select: { id: true } });
        if (clash) continue; // mã trùng: bốc lại (xác suất ~ 1/28 triệu)
        const inv = await tx.tuitionInvoice.create({
          data: {
            code, tutorId, studentId, yearMonth, amountDue,
            paidAmount: 0,
            status: paidByCredit ? INVOICE_STATUS.PAID : INVOICE_STATUS.DRAFT,
            paidAt: paidByCredit ? new Date() : null,
            breakdown: { ...b, creditApplied: credit.used, creditParts: credit.parts, grossDue: b.finalAmount } as unknown as Prisma.InputJsonValue,
          },
        });
        return { ok: true, invoice: { id: inv.id, code: inv.code, studentId, amountDue, status: inv.status, creditApplied: credit.used } } as IssueResult;
      }
      throw new Error("Không sinh được mã phiếu");
    });
  } catch (e) {
    console.error("[issueInvoice]", e);
    return { ok: false, reason: "Lỗi hệ thống khi lập phiếu" };
  }
}

// ─── Trình bày cho phụ huynh/học viên ───────────────────────────────────────
export interface PartyInvoiceView {
  id: string; code: string; yearMonth: string; tutorName: string;
  amountDue: number; paidAmount: number; remaining: number;
  status: InvoiceStatus; statusLabel: string; // gia sư thấy "Đóng một phần"; phụ huynh thấy "Còn lại X" (spec mục 5.2)
  transferContent: string; qrUrl: string | null;
  bank: { name: string; accountNo: string; accountName: string } | null;
  canReport: boolean; // nút "Tôi đã chuyển"
  paidAt: string | null;
}

export function presentInvoiceForParty(
  inv: { id: string; code: string; yearMonth: string; amountDue: number; paidAmount: number; status: string; paidAt: Date | null },
  ctx: { tutorName: string; studentName: string; account: { bankBin: string; accountNo: string; accountName: string } | null },
): PartyInvoiceView {
  const remaining = remainingOf(inv);
  const open = (OPEN_STATUSES as string[]).includes(inv.status) && remaining > 0;
  const transferContent = buildTransferContent(inv.code, ctx.studentName);
  const label = inv.status === "partial"
    ? `Còn lại ${remaining.toLocaleString("vi-VN")}đ`
    : INVOICE_STATUS_LABEL[inv.status as InvoiceStatus] ?? inv.status;
  return {
    id: inv.id, code: inv.code, yearMonth: inv.yearMonth, tutorName: ctx.tutorName,
    amountDue: inv.amountDue, paidAmount: inv.paidAmount, remaining,
    status: inv.status as InvoiceStatus, statusLabel: label, transferContent,
    qrUrl: open && ctx.account ? buildInvoiceQrUrl(ctx.account, { amount: remaining, addInfo: transferContent }) : null,
    bank: ctx.account ? { name: bankName(ctx.account.bankBin), accountNo: ctx.account.accountNo, accountName: ctx.account.accountName } : null,
    canReport: inv.status === "sent" || inv.status === "partial",
    paidAt: inv.paidAt?.toISOString() ?? null,
  };
}

// Phiếu của 1 em mà phụ huynh/học viên được xem (nháp & đã huỷ ẩn).
export async function loadPartyInvoices(studentId: string, yearMonth?: string): Promise<PartyInvoiceView[]> {
  const invoices = await prisma.tuitionInvoice.findMany({
    where: { studentId, status: { in: PARENT_VISIBLE_STATUSES }, ...(yearMonth ? { yearMonth } : {}) },
    orderBy: [{ yearMonth: "desc" }, { createdAt: "desc" }],
    include: { tutor: { select: { id: true, name: true, payoutAccount: true } }, student: { select: { name: true } } },
    take: 60,
  });
  return invoices.map(i => presentInvoiceForParty(i, {
    tutorName: i.tutor.name, studentName: i.student.name, account: i.tutor.payoutAccount,
  }));
}

// "Tôi đã chuyển": chỉ ghi nhận phụ huynh BÁO đã chuyển — chưa phải đã nhận tiền.
// Trả null nếu phiếu không thuộc em này / không ở trạng thái cho phép.
export async function markParentReported(studentId: string, code: string): Promise<{ ok: true; alreadyReported: boolean } | { ok: false; status: number; error: string }> {
  const inv = await prisma.tuitionInvoice.findUnique({ where: { code }, select: { id: true, tutorId: true, studentId: true, status: true } });
  if (!inv || inv.studentId !== studentId) return { ok: false, status: 404, error: "Không tìm thấy phiếu" };
  if (inv.status === "parent_reported") return { ok: true, alreadyReported: true };
  if (inv.status !== "sent" && inv.status !== "partial") {
    return { ok: false, status: 409, error: inv.status === "paid" ? "Phiếu đã đóng đủ" : "Phiếu này không thể báo đã chuyển" };
  }
  const r = await prisma.tuitionInvoice.updateMany({
    where: { id: inv.id, status: { in: ["sent", "partial"] } },
    data: { status: "parent_reported", parentReportedAt: new Date() },
  });
  if (r.count !== 1) return { ok: false, status: 409, error: "Phiếu vừa đổi trạng thái, tải lại trang" };
  await notifyTutorParentReported(inv.tutorId, inv.id); // NC2-010: chỉ báo tin, không đổi cách ghi nhận ở trên
  return { ok: true, alreadyReported: false };
}

/** Khoảng chống dội của thông báo `parent_reported`: một phiếu tối đa một thông báo mỗi 24 giờ. */
export const PARENT_REPORTED_DEDUPE_MS = 24 * 3600_000;
/** Đích của thông báo: khoá phiếu (id nội bộ, không phải mã phiếu in cho phụ huynh) nằm ở tham số `phieu` để tra chống dội; trang bỏ qua tham số này. */
export const parentReportedLink = (invoiceId: string) => `/lop-cua-toi/hoc-phi?phieu=${invoiceId}`;

/**
 * NC2-010 — báo GIA SƯ chủ phiếu rằng có phụ huynh bấm "Tôi đã chuyển". Chữ trong ứng dụng dựng từ LOẠI: không tên em / phụ huynh, không số tiền, không mã phiếu.
 * Chống dội: đã có thông báo `parent_reported` cho đúng phiếu này trong 24 giờ qua thì không tạo thêm (tra bảng Notification, không thêm cột).
 * Cố ý nuốt lỗi như notify(): báo tin không bao giờ làm hỏng việc ghi nhận chính.
 */
export async function notifyTutorParentReported(tutorId: string, invoiceId: string, now: Date = new Date()): Promise<boolean> {
  try {
    const link = parentReportedLink(invoiceId);
    const recent = await prisma.notification.findFirst({
      where: { userId: tutorId, type: "parent_reported", link, createdAt: { gt: new Date(now.getTime() - PARENT_REPORTED_DEDUPE_MS) } },
      select: { id: true },
    });
    if (recent) return false;
    await notify(tutorId, { type: "parent_reported", title: "Phụ huynh báo đã chuyển khoản", message: "Có phụ huynh báo đã chuyển khoản, cần đối soát. Mở phiếu học phí để xem.", link });
    return true;
  } catch (e) {
    console.error("[parent_reported] Không báo được gia sư:", e);
    return false;
  }
}
