// HP-24 — gộp các khoản phí RỜI (chưa vào phiếu nào) vào một phiếu NHÁP của em. Ví dụ: phí khác thêm sau khi đã lập phiếu tháng đó,
// buổi điểm danh bù sau khi lập phiếu, hoặc khoản của tháng trước chưa vào phiếu nào.
// Chỉ phiếu NHÁP (chưa gửi cho phụ huynh): phiếu đã gửi/đã chốt KHÔNG đổi. Khoản gộp thêm dùng cùng phần trăm giảm giá đã ghi trên phiếu
// lúc lập; không dùng thêm tín dụng tháng sau (tín dụng đã trừ lúc lập phiếu).
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { lockInvoice } from "@/lib/invoiceServer";
import { groupChargeLines, percentAmount, type ChargeLine } from "@/lib/tuitionFee";
import { PREVIEW_BLOCKED_MESSAGE, moneyPathsBlocked, type InvoiceChargeRow } from "@/lib/feeChargeServer";

export interface LooseRow extends InvoiceChargeRow { yearMonth: string }

export async function listLooseCharges(tutorId: string, studentId: string, upToYearMonth: string): Promise<LooseRow[]> {
  const rows = await prisma.feeCharge.findMany({
    where: { tutorId, studentId, invoiceId: null, yearMonth: { lte: upToYearMonth } },
    include: { course: { select: { name: true } } },
    orderBy: [{ dateKey: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(r => ({ id: r.id, courseId: r.courseId, courseName: r.course.name, kind: r.kind, label: r.label, amount: r.amount, units: r.units, rate: r.rate, mode: r.mode, dateKey: r.dateKey, yearMonth: r.yearMonth }));
}

const mLabel = (ym: string) => `tháng ${Number(ym.slice(5, 7))}/${ym.slice(0, 4)}`;
/** Gom dòng; khoản của tháng KHÁC tháng phiếu ghi rõ "(tháng M/YYYY)". */
export function linesForAttach(rows: readonly LooseRow[], invoiceYearMonth: string): ChargeLine[] {
  const months = [...new Set(rows.map(r => r.yearMonth))].sort();
  return months.flatMap(m => groupChargeLines(rows.filter(r => r.yearMonth === m)).map(l => (m === invoiceYearMonth ? l : { ...l, description: `${l.description} (${mLabel(m)})` })));
}

export type AttachResult =
  | { ok: true; applied: boolean; count: number; total: number; net: number; amountDueFrom: number; amountDueTo: number; lines: ChargeLine[] }
  | { ok: false; status: number; error: string };

/** preview=true: chỉ tính, không ghi. Cùng một đường tính cho xem trước và áp dụng. */
export async function attachLooseCharges(a: { invoiceId: string; tutorId: string; chargeIds?: string[] | null; preview: boolean }): Promise<AttachResult> {
  if (moneyPathsBlocked()) return { ok: false, status: 503, error: PREVIEW_BLOCKED_MESSAGE };
  return prisma.$transaction(async tx => {
    const first = await tx.tuitionInvoice.findUnique({ where: { id: a.invoiceId }, select: { tutorId: true } });
    if (!first || first.tutorId !== a.tutorId) return { ok: false, status: 404, error: "Không tìm thấy phiếu" } as AttachResult;
    await lockInvoice(tx, a.invoiceId);
    const inv = await tx.tuitionInvoice.findUniqueOrThrow({ where: { id: a.invoiceId } });
    if (inv.status !== "draft") return { ok: false, status: 409, error: "Chỉ gộp thêm vào phiếu nháp. Phiếu đã gửi hoặc đã đóng không đổi." } as AttachResult;
    await tx.$queryRaw`SELECT id FROM fee_charges WHERE "tutorId" = ${a.tutorId} AND "studentId" = ${inv.studentId} AND "invoiceId" IS NULL AND "yearMonth" <= ${inv.yearMonth} FOR UPDATE`;
    const all = await tx.feeCharge.findMany({
      where: { tutorId: a.tutorId, studentId: inv.studentId, invoiceId: null, yearMonth: { lte: inv.yearMonth }, ...(a.chargeIds ? { id: { in: a.chargeIds } } : {}) },
      include: { course: { select: { name: true } } }, orderBy: [{ dateKey: "asc" }, { createdAt: "asc" }],
    });
    if (a.chargeIds && all.length !== new Set(a.chargeIds).size) return { ok: false, status: 409, error: "Có khoản đã vào phiếu khác hoặc không còn, hãy tải lại" } as AttachResult;
    if (all.length === 0) return { ok: false, status: 409, error: "Không có khoản nào đang chờ gộp" } as AttachResult;
    const rows: LooseRow[] = all.map(r => ({ id: r.id, courseId: r.courseId, courseName: r.course.name, kind: r.kind, label: r.label, amount: r.amount, units: r.units, rate: r.rate, mode: r.mode, dateKey: r.dateKey, yearMonth: r.yearMonth }));
    const total = rows.reduce((s, r) => s + r.amount, 0);
    const bd = (inv.breakdown ?? {}) as Record<string, unknown>;
    const pct = typeof bd.percentOff === "number" ? bd.percentOff : 0;
    const pctAmt = pct > 0 ? percentAmount(total, pct) : 0;
    const net = total - pctAmt;
    const lines = linesForAttach(rows, inv.yearMonth);
    const out = { ok: true, applied: !a.preview, count: rows.length, total, net, amountDueFrom: inv.amountDue, amountDueTo: inv.amountDue + net, lines } as AttachResult;
    if (a.preview) return out;

    const num = (v: unknown) => (typeof v === "number" ? v : 0);
    const next = {
      ...bd,
      chargeLines: [...(Array.isArray(bd.chargeLines) ? bd.chargeLines : []), ...lines],
      chargesTotal: num(bd.chargesTotal) + total,
      finalAmount: num(bd.finalAmount) + net,
      grossDue: num(bd.grossDue) + net,
      ...(pct > 0 ? { percentAmount: num(bd.percentAmount) + pctAmt } : {}),
      attached: [...(Array.isArray(bd.attached) ? bd.attached : []), { at: new Date().toISOString(), count: rows.length, total, net }],
    };
    await tx.tuitionInvoice.update({ where: { id: inv.id }, data: { amountDue: inv.amountDue + net, breakdown: next as unknown as Prisma.InputJsonValue } });
    const frozen = await tx.feeCharge.updateMany({ where: { id: { in: rows.map(r => r.id) }, invoiceId: null }, data: { invoiceId: inv.id } });
    if (frozen.count !== rows.length) throw new Error("Dòng phí đổi trong lúc gộp");
    return out;
  });
}
