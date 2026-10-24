// BE-076 + FE-154 — doanh thu của GIA SƯ = học phí đã THU (tiền vào tài khoản của
// chính gia sư, ghi nhận qua phiếu TT-200). KiN không giữ tiền nên đây không phải
// doanh thu của KiN (cái đó ở /api/admin/analytics).
//
// BE-076/FE-153 gốc viết theo "CoinTransaction class_subscription" của mô hình học
// viên mua gói lớp; D01 (05/10) đã bỏ mô hình đó. Nguồn đúng là sổ BankTransaction
// của gia sư: chỉ phần ĐÃ ÁP VÀO PHIẾU (appliedAmount) — phần dư đã trả lại hoặc
// chuyển thành tín dụng không phải doanh thu.
//
// GET ?from=YYYY-MM-DD&to=YYYY-MM-DD[&format=csv]  (giờ VN, gồm cả hai đầu)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { OPEN_STATUSES } from "@/lib/tuitionInvoice";
import { invoiceKpi } from "@/lib/revenueKpi";
import { manualMethodLabel } from "@/lib/tuitionPayment";
import { allocateByWeights, parseDateRange, rangeWhere, toCsv, vnDateKey, vnMonthKey } from "@/lib/revenue";

type Subject = { courseId?: string; courseName?: string; subtotal?: number };

function methodOf(provider: string, resolution: string | null, method: string | null): string {
  if (provider === "manual") return manualMethodLabel(method); // HP-20: bản ghi cũ method=null → chữ cũ
  return resolution === "matched_manual" ? "Chuyển khoản (gia sư ghép tay)" : "Chuyển khoản (SePay)";
}

export async function GET(req: NextRequest) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;

  const sp = new URL(req.url).searchParams;
  const range = parseDateRange(sp);
  if ("error" in range) return NextResponse.json({ error: range.error }, { status: 400 });
  const occurredAt = rangeWhere(range);

  const [rows, open, allInv] = await Promise.all([
    prisma.bankTransaction.findMany({
      where: { tutorId: auth.userId, status: { in: ["matched", "resolved"] }, appliedAmount: { gt: 0 }, ...(occurredAt ? { occurredAt } : {}) },
      orderBy: { occurredAt: "desc" },
      include: { invoice: { select: { code: true, yearMonth: true, breakdown: true, student: { select: { name: true } } } } },
    }),
    // Còn phải thu: phần còn lại của các phiếu ĐÃ GỬI chưa đóng đủ (không tính nháp/đã huỷ).
    prisma.tuitionInvoice.findMany({
      where: { tutorId: auth.userId, status: { in: OPEN_STATUSES } },
      select: { amountDue: true, paidAmount: true },
    }),
    // PT-01: chỉ để dựng thẻ "Tiềm năng" (phiếu nháp) và "Tỷ lệ thu" (đã đóng / phải thu trên phiếu đã gửi).
    prisma.tuitionInvoice.findMany({ where: { tutorId: auth.userId, status: { not: "cancelled" } }, select: { status: true, amountDue: true, paidAmount: true } }),
  ]);

  const monthMap = new Map<string, { month: string; collected: number; count: number }>();
  const classMap = new Map<string, { courseId: string; name: string; collected: number }>();
  let collected = 0;
  for (const r of rows) {
    collected += r.appliedAmount;
    const mk = vnMonthKey(r.occurredAt);
    const m = monthMap.get(mk) ?? { month: mk, collected: 0, count: 0 };
    m.collected += r.appliedAmount; m.count++;
    monthMap.set(mk, m);

    // Quy về lớp theo tỉ lệ tiền từng môn trên phiếu (chính xác từng đồng).
    // HP-14: phiếu có dòng phí kiểu mới (chargeLines) thì tính cả vào tỉ lệ theo lớp. Phiếu cũ không có chargeLines → đúng như trước.
    const bd = r.invoice?.breakdown as { perSubject?: Subject[]; chargeLines?: Array<{ courseId?: string; courseName?: string; amount?: number }> } | null;
    const subjects = [
      ...(bd?.perSubject ?? []),
      ...(bd?.chargeLines ?? []).map(l => ({ courseId: l.courseId, courseName: l.courseName, subtotal: l.amount })),
    ].filter(s => s.courseId);
    if (subjects.length === 0) {
      const c = classMap.get("?") ?? { courseId: "?", name: "Không rõ lớp", collected: 0 };
      c.collected += r.appliedAmount; classMap.set("?", c);
    } else {
      const parts = allocateByWeights(r.appliedAmount, subjects.map(s => s.subtotal ?? 0));
      subjects.forEach((s, i) => {
        const c = classMap.get(s.courseId!) ?? { courseId: s.courseId!, name: s.courseName ?? "Lớp", collected: 0 };
        c.collected += parts[i]; classMap.set(s.courseId!, c);
      });
    }
  }

  const transactions = rows.map(r => ({
    id: r.id, date: r.occurredAt.toISOString(), studentName: r.invoice?.student.name ?? "—",
    code: r.invoice?.code ?? r.matchedCode ?? "", yearMonth: r.invoice?.yearMonth ?? "",
    method: methodOf(r.provider, r.resolution, r.method), amount: r.appliedAmount,
  }));

  if (sp.get("format") === "csv") {
    const csv = toCsv([
      ["Ngày (giờ VN)", "Học sinh", "Mã phiếu", "Tháng học phí", "Hình thức", "Số tiền (đ)"],
      ...transactions.map(t => [vnDateKey(new Date(t.date)), t.studentName, t.code, t.yearMonth, t.method, t.amount]),
    ]);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="hoc-phi-da-thu-${vnDateKey(new Date())}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return NextResponse.json({
    range: { from: range.from?.toISOString() ?? null, toExclusive: range.toExclusive?.toISOString() ?? null },
    totals: {
      collected, txCount: rows.length,
      receivable: open.reduce((s, i) => s + Math.max(0, i.amountDue - i.paidAmount), 0), openInvoices: open.length,
      ...(() => { const k = invoiceKpi(allInv); return { draftAmount: k.draftAmount, draftCount: k.draftCount, sentDue: k.sentDue, sentPaid: k.sentPaid, sentCount: k.sentCount, collectionRatePct: k.collectionRatePct }; })(),
    },
    byMonth: [...monthMap.values()].sort((a, b) => a.month.localeCompare(b.month)),
    byClass: [...classMap.values()].sort((a, b) => b.collected - a.collected),
    transactions,
  });
}
