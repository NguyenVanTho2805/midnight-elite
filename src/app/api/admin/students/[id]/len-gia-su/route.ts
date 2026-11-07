// ADM-xoa-tk — POST /api/admin/students/[id]/len-gia-su: quản trị trung tâm chuyển thẳng một học sinh thành gia sư (không cần đơn).
// Ghi danh KHÔNG đổi (em vẫn giữ lớp đang học). updateMany có điều kiện → hai người bấm cùng lúc chỉ một thành công.
import { NextRequest, NextResponse } from "next/server";
import { isNextResponse } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { logAction } from "@/lib/auditLog";
import { requireCenterAdmin } from "@/lib/tutorApplicationGuard";
import { NOT_ANONYMIZED, isAnonEmail } from "@/lib/accountDelete";
import { ageOnKey } from "@/lib/consentPolicy";
import { vnDateKeyOf } from "@/lib/classSessions";

const MIN_AGE = 18;
const MAX_SUBJECTS = 10, MAX_SUBJECT_LEN = 60, MAX_BIO = 1000;

type Row = { role: string; email: string; deletedAt: Date | null; banned: boolean; emailVerified: boolean; tutorVerified: boolean; dateOfBirth: Date | null; tutorAppliedAt: Date | null };
const SELECT = { role: true, email: true, deletedAt: true, banned: true, emailVerified: true, tutorVerified: true, dateOfBirth: true, tutorAppliedAt: true } as const;

function refusal(u: Row | null, now: Date): NextResponse | null {
  if (!u) return NextResponse.json({ error: "Không tìm thấy học sinh" }, { status: 404 });
  if (u.role !== "student") return NextResponse.json({ error: u.tutorVerified ? "Tài khoản này đã là gia sư" : "Chỉ chuyển được tài khoản học sinh", code: u.tutorVerified ? "already_tutor" : "not_student" }, { status: u.tutorVerified ? 409 : 403 });
  if (u.deletedAt || isAnonEmail(u.email)) return NextResponse.json({ error: "Học sinh đang ẩn hoặc đã xóa", code: "hidden" }, { status: 409 });
  if (u.banned) return NextResponse.json({ error: "Tài khoản đang bị khóa", code: "banned" }, { status: 409 });
  if (!u.emailVerified) return NextResponse.json({ error: "Học sinh chưa xác thực email", code: "email_unverified" }, { status: 409 });
  if (u.tutorVerified) return NextResponse.json({ error: "Tài khoản này đã là gia sư", code: "already_tutor" }, { status: 409 });
  if (u.dateOfBirth) {
    const age = ageOnKey(vnDateKeyOf(u.dateOfBirth), vnDateKeyOf(now));
    if (age !== null && age < MIN_AGE) return NextResponse.json({ error: `Chưa đủ ${MIN_AGE} tuổi, chưa thể làm gia sư`, code: "underage" }, { status: 409 });
  }
  return null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCenterAdmin();
  if (isNextResponse(auth)) return auth;
  const { id } = await params;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Dữ liệu gửi lên không hợp lệ" }, { status: 400 }); }
  const b = (body && typeof body === "object" ? body : {}) as { subjects?: unknown; bio?: unknown; confirmAge18?: unknown };
  if (!Array.isArray(b.subjects) || b.subjects.some(s => typeof s !== "string")) return NextResponse.json({ error: "Cần chọn ít nhất 1 môn dạy" }, { status: 400 });
  const subjects = [...new Set((b.subjects as string[]).map(s => s.trim()).filter(Boolean))];
  if (subjects.length < 1) return NextResponse.json({ error: "Cần chọn ít nhất 1 môn dạy" }, { status: 400 });
  if (subjects.length > MAX_SUBJECTS) return NextResponse.json({ error: `Tối đa ${MAX_SUBJECTS} môn dạy` }, { status: 400 });
  if (subjects.some(s => s.length > MAX_SUBJECT_LEN)) return NextResponse.json({ error: `Tên môn tối đa ${MAX_SUBJECT_LEN} ký tự` }, { status: 400 });
  let bio: string | null | undefined;
  if (b.bio !== undefined && b.bio !== null) {
    if (typeof b.bio !== "string") return NextResponse.json({ error: "Giới thiệu không hợp lệ" }, { status: 400 });
    if (b.bio.trim().length > MAX_BIO) return NextResponse.json({ error: `Giới thiệu tối đa ${MAX_BIO} ký tự` }, { status: 400 });
    bio = b.bio.trim() || null;
  }

  const confirmAge18 = b.confirmAge18 === true;

  try {
    const now = new Date();
    const before = await prisma.user.findUnique({ where: { id }, select: SELECT });
    const no = refusal(before, now);
    if (no) return no;
    if (!before!.dateOfBirth && !confirmAge18) return NextResponse.json({ error: "Học sinh chưa khai ngày sinh. Hãy xác minh đủ 18 tuổi rồi tick xác nhận.", code: "need_age_confirm" }, { status: 400 });

    const flipped = await prisma.user.updateMany({
      where: { id, role: "student", deletedAt: null, banned: false, emailVerified: true, tutorVerified: false, ...NOT_ANONYMIZED },
      data: {
        role: "admin", adminRole: "teacher", tutorVerified: true, tutorVerifiedAt: now, tutorVerifiedBy: auth.userId,
        tutorAppliedAt: before!.tutorAppliedAt ?? now, tutorRejectedAt: null, tutorRejectReason: null,
        subjects, ...(bio !== undefined ? { bio } : {}),
      },
    });
    if (flipped.count === 0) {
      return refusal(await prisma.user.findUnique({ where: { id }, select: SELECT }), now)
        ?? NextResponse.json({ error: "Không chuyển được, thử lại" }, { status: 409 });
    }

    const activeEnrollments = await prisma.enrollment.count({ where: { userId: id, status: "active" } });
    await logAction(auth.userId, "student.promote_tutor", "User", id, { activeEnrollments, hadApplication: before!.tutorAppliedAt !== null, dobKnown: before!.dateOfBirth !== null, ageConfirmedByOperator: before!.dateOfBirth === null && confirmAge18 });
    await notify(id, {
      type: "tutor_approved",
      title: "Hồ sơ gia sư đã được duyệt",
      message: "Bạn đã là gia sư trên KiN. Đăng nhập lại để bắt đầu tạo lớp.",
      link: "/lop-cua-toi",
    });
    return NextResponse.json({ ok: true, activeEnrollments });
  } catch (e) {
    console.error("[POST /api/admin/students/:id/len-gia-su]", e);
    return NextResponse.json({ error: "Lỗi chuyển thành gia sư" }, { status: 500 });
  }
}
