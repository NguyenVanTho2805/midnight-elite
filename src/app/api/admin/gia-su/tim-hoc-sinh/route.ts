// ADM-xoa-tk 11.1 — POST /api/admin/gia-su/tim-hoc-sinh: tìm CHÍNH XÁC một học sinh theo email để chuyển thành gia sư.
// Một câu trả lời chung {found:false} cho mọi trường hợp không đủ điều kiện (không lộ lý do, tuổi). Không trả email/SĐT/ngày sinh.
import { NextRequest, NextResponse } from "next/server";
import { isNextResponse } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/auditLog";
import { requireCenterAdmin } from "@/lib/tutorApplicationGuard";
import { limitOrBlock } from "@/lib/rate-limit";
import { NOT_ANONYMIZED, isAnonEmail, shortNameOf } from "@/lib/accountDelete";
import { ageOnKey } from "@/lib/consentPolicy";
import { vnDateKeyOf } from "@/lib/classSessions";

const MIN_AGE = 18;

export async function POST(req: NextRequest) {
  const auth = await requireCenterAdmin();
  if (isNextResponse(auth)) return auth;
  const blocked = limitOrBlock(auth.userId, "tim-hoc-sinh", 10, 10 * 60_000);
  if (blocked) return blocked;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Dữ liệu gửi lên không hợp lệ" }, { status: 400 }); }
  const raw = body && typeof body === "object" ? (body as { email?: unknown }).email : undefined;
  if (typeof raw !== "string" || !raw.trim() || raw.length > 254) return NextResponse.json({ error: "Nhập email học sinh" }, { status: 400 });
  const email = raw.trim().toLowerCase();

  try {
    const now = new Date();
    const u = await prisma.user.findFirst({
      where: { email, role: "student", deletedAt: null, banned: false, emailVerified: true, tutorVerified: false, ...NOT_ANONYMIZED },
      select: { id: true, name: true, email: true, dateOfBirth: true },
    });
    let ok = !!u && !isAnonEmail(u.email);
    if (ok && u!.dateOfBirth) {
      const age = ageOnKey(vnDateKeyOf(u!.dateOfBirth), vnDateKeyOf(now));
      if (age !== null && age < MIN_AGE) ok = false;
    }
    await logAction(auth.userId, "student.lookup_email", "User", ok ? u!.id : "email_lookup", { found: ok });
    if (!ok) return NextResponse.json({ found: false });
    const activeEnrollments = await prisma.enrollment.count({ where: { userId: u!.id, status: "active" } });
    return NextResponse.json({ found: true, candidateId: u!.id, shortName: shortNameOf(u!.name ?? ""), activeEnrollments, dobKnown: u!.dateOfBirth !== null });
  } catch (e) {
    console.error("[POST /api/admin/gia-su/tim-hoc-sinh]", e);
    return NextResponse.json({ error: "Lỗi tìm học sinh" }, { status: 500 });
  }
}
