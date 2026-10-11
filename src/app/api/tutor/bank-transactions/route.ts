// TT-200 — hàng chờ đối soát của gia sư (Figma 205:76).
// GET ?status=pending|matched|resolved|ignored|all (mặc định pending)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { TX_KIND_LABEL, remainingOf, type TxKind } from "@/lib/tuitionInvoice";

const STATUSES = ["pending", "matched", "resolved", "ignored"];

export async function GET(req: NextRequest) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;

  const status = new URL(req.url).searchParams.get("status") ?? "pending";
  if (status !== "all" && !STATUSES.includes(status)) return NextResponse.json({ error: "status không hợp lệ" }, { status: 400 });

  const [rows, pendingCount] = await Promise.all([
    prisma.bankTransaction.findMany({
      where: { tutorId: auth.userId, ...(status === "all" ? {} : { status }) },
      orderBy: { occurredAt: "desc" }, take: 200,
      include: { invoice: { select: { id: true, code: true, yearMonth: true, amountDue: true, paidAmount: true, status: true, student: { select: { name: true } } } } },
    }),
    prisma.bankTransaction.count({ where: { tutorId: auth.userId, status: "pending" } }),
  ]);

  const sugIds = [...new Set(rows.flatMap(r => r.suggestedInvoiceIds))];
  const sugRows = sugIds.length
    ? await prisma.tuitionInvoice.findMany({ where: { id: { in: sugIds }, tutorId: auth.userId }, select: { id: true, code: true, yearMonth: true, amountDue: true, paidAmount: true, status: true, student: { select: { name: true } } } })
    : [];
  const sugById = new Map(sugRows.map(s => [s.id, s]));
  const view = (i: { id: string; code: string; yearMonth: string; amountDue: number; paidAmount: number; status: string; student: { name: string } }) =>
    ({ id: i.id, code: i.code, yearMonth: i.yearMonth, studentName: i.student.name, amountDue: i.amountDue, paidAmount: i.paidAmount, remaining: remainingOf(i), status: i.status });

  return NextResponse.json({
    pendingCount,
    items: rows.map(r => ({
      id: r.id, provider: r.provider, occurredAt: r.occurredAt.toISOString(), amount: r.amount, content: r.content,
      matchedCode: r.matchedCode, kind: r.kind as TxKind, kindLabel: TX_KIND_LABEL[r.kind as TxKind] ?? r.kind,
      status: r.status, resolution: r.resolution, appliedAmount: r.appliedAmount,
      invoice: r.invoice ? view(r.invoice) : null,
      suggestions: r.suggestedInvoiceIds.map(id => sugById.get(id)).filter((x): x is NonNullable<typeof x> => !!x).map(view),
    })),
  });
}
