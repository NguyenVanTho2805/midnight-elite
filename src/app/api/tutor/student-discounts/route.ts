// HP-32 — giảm giá phần trăm của gia sư cho từng học sinh. Áp khi LẬP PHIẾU MỚI; phiếu đã lập không đổi.
//   GET  → các em đang học lớp của gia sư kèm % giảm hiện tại (0 = không giảm).
//   POST { studentId, percent (0–100, 0 = bỏ), note? }
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { logAction } from "@/lib/auditLog";
import { requireTutor } from "@/lib/invoiceServer";
import { PREVIEW_BLOCKED_MESSAGE, moneyPathsBlocked } from "@/lib/feeChargeServer";
import { validateDiscountPercent } from "@/lib/tuitionFee";

export async function GET() {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  const [enr, disc] = await Promise.all([
    prisma.enrollment.findMany({ where: { status: "active", course: { ownerId: auth.userId } }, select: { userId: true, user: { select: { name: true } } }, distinct: ["userId"], orderBy: { user: { name: "asc" } }, take: 500 }),
    prisma.studentDiscount.findMany({ where: { tutorId: auth.userId } }),
  ]);
  const pct = new Map(disc.map(d => [d.studentId, d]));
  return NextResponse.json({
    items: enr.map(e => ({ studentId: e.userId, name: e.user.name ?? "Học sinh", percent: pct.get(e.userId)?.percent ?? 0, note: pct.get(e.userId)?.note ?? null })),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  if (moneyPathsBlocked()) return NextResponse.json({ error: PREVIEW_BLOCKED_MESSAGE }, { status: 503 });
  const body = await req.json().catch(() => null) as { studentId?: unknown; percent?: unknown; note?: unknown } | null;
  if (typeof body?.studentId !== "string" || !body.studentId) return NextResponse.json({ error: "Thiếu học sinh" }, { status: 400 });
  const v = validateDiscountPercent(body.percent);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  const hit = await prisma.enrollment.findFirst({ where: { userId: body.studentId, status: "active", course: { ownerId: auth.userId } }, select: { id: true } });
  if (!hit) return NextResponse.json({ error: "Không tìm thấy học sinh trong lớp của bạn" }, { status: 404 });
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 300) : null;
  const prev = await prisma.studentDiscount.findUnique({ where: { tutorId_studentId: { tutorId: auth.userId, studentId: body.studentId } } });
  if (v.percent === 0) await prisma.studentDiscount.deleteMany({ where: { tutorId: auth.userId, studentId: body.studentId } });
  else await prisma.studentDiscount.upsert({
    where: { tutorId_studentId: { tutorId: auth.userId, studentId: body.studentId } },
    create: { tutorId: auth.userId, studentId: body.studentId, percent: v.percent, note, updatedBy: auth.userId },
    update: { percent: v.percent, note, updatedBy: auth.userId },
  });
  await logAction(auth.userId, "student_discount.set", "StudentDiscount", body.studentId, { from: prev?.percent ?? 0, to: v.percent });
  return NextResponse.json({ ok: true, percent: v.percent });
}
