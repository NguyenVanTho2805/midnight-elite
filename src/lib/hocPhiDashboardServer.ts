// HOCPHI-THEO-BUOI 3.4 — truy vấn CHỈ ĐỌC cho bảng học phí tháng, rồi gọi hàm thuần buildMonthTable. KHÔNG ghi gì.
// Tên tệp cố ý không khớp mẫu khóa `feeCharge*` / `invoiceServer*`. `scope`: {tutorId} = lớp của một gia sư (trang gia sư); "all" = mọi lớp (trang quản trị dùng lại).
import { prisma } from "@/lib/prisma";
import { buildMonthTable, prevYearMonth, type LegacyInvoiceRow, type MonthTable } from "@/lib/hocPhiDashboard";

export type DashboardScope = { tutorId: string } | "all";

function monthStartUtc(ym: string): Date { return new Date(`${ym}-01T00:00:00.000Z`); }
function nextMonthStartUtc(ym: string): Date {
  const y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7));
  return new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1));
}

/** Bảng học phí của `ym` (đã kiểm định dạng ở nơi gọi). `courseId` thu hẹp về một lớp (nơi gọi tự kiểm quyền). Gia sư chưa có lớp → rows rỗng. */
export async function loadMonthTable(scope: DashboardScope, ym: string, opts: { courseId?: string; hideInactive?: boolean } = {}): Promise<MonthTable> {
  const prev = prevYearMonth(ym);
  const courses = await prisma.course.findMany({
    where: { ...(scope === "all" ? {} : { ownerId: scope.tutorId }), ...(opts.courseId ? { id: opts.courseId } : {}) },
    select: { id: true, name: true, feeMode: true, ownerId: true, feeRates: { select: { effectiveFrom: true } } },
    orderBy: { name: "asc" },
  });
  const ids = courses.map(c => c.id);
  if (ids.length === 0) return buildMonthTable({ ym, courses: [], charges: [], closedSessions: [], legacyInvoices: [], hideInactive: opts.hideInactive });

  const [charges, closedSessions] = await Promise.all([
    prisma.feeCharge.findMany({
      where: { courseId: { in: ids }, yearMonth: { in: [ym, prev] } },
      select: { courseId: true, studentId: true, kind: true, yearMonth: true, amount: true, invoiceId: true },
    }),
    prisma.attendanceSession.findMany({
      where: { courseId: { in: ids }, state: "closed", date: { gte: monthStartUtc(ym), lt: nextMonthStartUtc(ym) } },
      select: { courseId: true, date: true },
    }),
  ]);

  // Một truy vấn phiếu: (a) phiếu hai tháng cho lớp cũ, (b) phiếu mà dòng phí đang nằm trong (để biết cái nào đã huỷ).
  const chargeInvoiceIds = Array.from(new Set(charges.map(c => c.invoiceId).filter((x): x is string => !!x)));
  const invoices = await prisma.tuitionInvoice.findMany({
    where: {
      OR: [
        { yearMonth: { in: [ym, prev] }, ...(scope === "all" ? {} : { tutorId: scope.tutorId }) },
        ...(chargeInvoiceIds.length ? [{ id: { in: chargeInvoiceIds } }] : []),
      ],
    },
    select: { id: true, yearMonth: true, status: true, breakdown: true },
  });
  const cancelledInvoiceIds = new Set(invoices.filter(v => v.status === "cancelled").map(v => v.id));
  const legacyInvoices: LegacyInvoiceRow[] = invoices
    .filter(v => v.status !== "cancelled" && (v.yearMonth === ym || v.yearMonth === prev))
    .map(v => {
      const bd = v.breakdown as { perSubject?: Array<{ courseId?: string; subtotal?: number }> } | null;
      return { id: v.id, yearMonth: v.yearMonth, perSubject: Array.isArray(bd?.perSubject) ? bd!.perSubject! : [] };
    });

  return buildMonthTable({
    ym,
    courses: courses.map(c => ({ id: c.id, name: c.name, feeMode: c.feeMode, classRates: c.feeRates, tutorId: c.ownerId })),
    charges, closedSessions, legacyInvoices, cancelledInvoiceIds, hideInactive: opts.hideInactive,
  });
}
