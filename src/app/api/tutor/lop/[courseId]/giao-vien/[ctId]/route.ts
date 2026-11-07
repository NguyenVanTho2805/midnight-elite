// TUT-dong-giang — PATCH đổi vai / nhãn môn · DELETE gỡ (active) hoặc huỷ lời mời (invited). Chỉ chủ lớp / quản trị. `ctId` phải thuộc `courseId` (không thì 404).
// DELETE ?preview=1 chỉ đếm khung lịch / nhóm sẽ về chủ, không ghi gì.
import { NextRequest, NextResponse } from "next/server";
import { requireCourseAccess } from "@/lib/courseAccessServer";
import { isTeacherRole, normalizeSubjects } from "@/lib/courseAccess";
import { changeTeacherRole, removeCoTeacherByOwner } from "@/lib/courseTeacherServer";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ courseId: string; ctId: string }> }) {
  const { courseId, ctId } = await params;
  const acc = await requireCourseAccess(courseId, "teacher.role");
  if (!acc.ok) return acc.res;
  const body = (await req.json().catch(() => null)) as { role?: unknown; subjects?: unknown } | null;
  const patch: { role?: "co_teacher" | "subject_teacher"; subjects?: string[] } = {};
  if (body?.role !== undefined) {
    if (!isTeacherRole(body.role)) return NextResponse.json({ error: "Vai không hợp lệ" }, { status: 400, headers: NO_STORE });
    patch.role = body.role;
  }
  if (body?.subjects !== undefined) {
    const s = normalizeSubjects(body.subjects);
    if (!s) return NextResponse.json({ error: "Nhãn môn tối đa 5 mục, mỗi mục tối đa 40 ký tự" }, { status: 400, headers: NO_STORE });
    patch.subjects = s;
  }
  if (!patch.role && !patch.subjects) return NextResponse.json({ error: "Không có gì để đổi" }, { status: 400, headers: NO_STORE });
  const out = await changeTeacherRole(acc.course, ctId, acc.session.userId, patch);
  if (!out.ok) return NextResponse.json({ error: out.error }, { status: out.status, headers: NO_STORE });
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ courseId: string; ctId: string }> }) {
  const { courseId, ctId } = await params;
  const acc = await requireCourseAccess(courseId, "teacher.remove");
  if (!acc.ok) return acc.res;
  const preview = new URL(req.url).searchParams.get("preview") === "1";
  const out = await removeCoTeacherByOwner(acc.course, ctId, acc.session.userId, preview);
  if (!out.ok) return NextResponse.json({ error: out.error }, { status: out.status, headers: NO_STORE });
  return NextResponse.json(out, { headers: NO_STORE });
}
