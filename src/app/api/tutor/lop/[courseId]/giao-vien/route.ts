// TUT-dong-giang — GET danh sách giáo viên của lớp · POST mời đồng giảng theo email (chỉ chủ lớp / quản trị). JSON, không 303 (client gọi bằng fetch).
// Thứ tự: 401 → 403 khoá → 403 không phải gia sư → 404 lớp → 403 người lạ → 403 ROLE_FORBIDDEN → 400 → 429 → 409.
import { NextRequest, NextResponse } from "next/server";
import { requireCourseAccess } from "@/lib/courseAccessServer";
import { MAX_TEACHERS_PER_COURSE, ROLE_LABEL, TEACHER_ROLES, isTeacherRole, normalizeInviteEmail, normalizeSubjects, canDo } from "@/lib/courseAccess";
import { inviteCoTeacher, listCourseTeachers } from "@/lib/courseTeacherServer";
import { limitOrBlock } from "@/lib/rate-limit";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const acc = await requireCourseAccess(courseId, "course.view");
  if (!acc.ok) return acc.res;
  const isManager = canDo(acc.role, "teacher.invite");
  const teachers = await listCourseTeachers(courseId, { isManager });
  return NextResponse.json({ self: { userId: acc.session.userId, role: acc.role, label: ROLE_LABEL[acc.role] }, teachers, limit: MAX_TEACHERS_PER_COURSE }, { headers: NO_STORE });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const acc = await requireCourseAccess(courseId, "teacher.invite");
  if (!acc.ok) return acc.res;

  const body = (await req.json().catch(() => null)) as { email?: unknown; role?: unknown; subjects?: unknown } | null;
  const email = normalizeInviteEmail(body?.email);
  if (!email) return NextResponse.json({ error: "Email không hợp lệ" }, { status: 400, headers: NO_STORE });
  if (!isTeacherRole(body?.role)) {
    return NextResponse.json({ error: `Vai phải là một trong: ${TEACHER_ROLES.join(", ")}` }, { status: 400, headers: NO_STORE });
  }
  const subjects = normalizeSubjects(body?.subjects);
  if (!subjects) return NextResponse.json({ error: "Nhãn môn tối đa 5 mục, mỗi mục tối đa 40 ký tự" }, { status: 400, headers: NO_STORE });

  // 10 lần / 10 phút / người mời (chống dò email).
  const blocked = limitOrBlock(acc.session.userId, "co-teacher-invite", 10, 10 * 60_000);
  if (blocked) return blocked;

  const out = await inviteCoTeacher(acc.course, { userId: acc.session.userId }, { email, role: body!.role as "co_teacher" | "subject_teacher", subjects });
  if (!out.ok) return NextResponse.json({ error: out.error, code: out.code }, { status: out.status, headers: NO_STORE });
  return NextResponse.json({ ok: true, message: out.reply }, { headers: NO_STORE });
}
