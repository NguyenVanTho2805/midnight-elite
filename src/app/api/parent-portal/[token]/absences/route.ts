// TT-202 — phụ huynh báo con nghỉ một buổi qua link "Sổ của con" (không đăng nhập). Token chỉ cho
// phép báo cho ĐÚNG em đó, ở các lớp em đang học.
// POST { scheduleId, dateKey: "YYYY-MM-DD", reason? }
//   báo trước ≥ 2 giờ → tự ghi "Nghỉ có báo" + giữ 1 buổi bù
//   báo dưới 2 giờ    → vào Hộp việc của gia sư, chờ gia sư bấm 1 nút
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidPortalToken } from "@/lib/parentPortal";
import { limitOrBlock } from "@/lib/rate-limit";
import { reportAbsence } from "@/lib/absenceServer";

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isValidPortalToken(token)) return NextResponse.json({ error: "Mã không hợp lệ" }, { status: 404 });
  const blocked = limitOrBlock(token, "portal-absence", 20, 60 * 60_000);
  if (blocked) return blocked;
  const link = await prisma.parentLink.findFirst({ where: { portalToken: token, status: "verified" }, select: { studentId: true } });
  if (!link) return NextResponse.json({ error: "Mã không hợp lệ hoặc đã bị thu hồi" }, { status: 404 });

  let b: Record<string, unknown> = {};
  try { b = await req.json(); } catch { /* 400 bên dưới */ }
  if (typeof b.scheduleId !== "string" || typeof b.dateKey !== "string") return NextResponse.json({ error: "Thiếu buổi học cần báo nghỉ" }, { status: 400 });
  const r = await reportAbsence({
    studentId: link.studentId, scheduleId: b.scheduleId, dateKey: b.dateKey, reportedBy: "parent",
    reason: typeof b.reason === "string" ? b.reason : null,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, kind: r.kind, status: r.status, leadMinutes: r.leadMinutes, deadlineAt: r.deadlineAt, makeupGranted: r.makeupGranted }, { status: 201 });
}
