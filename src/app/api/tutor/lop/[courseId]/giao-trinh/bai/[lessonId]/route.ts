// G4 (BU-02-PHẲNG) — đổi TRẠNG THÁI và/hoặc NHÓM của một mục. Chỉ gia sư ĐÃ DUYỆT và là CHỦ lớp (requireCourseTutor: 401 / 403 / 404).
// Bài phải thuộc lớp trong đường dẫn (id lạ / ở lớp khác ⇒ 404, không ghi). Trạng thái chỉ đổi ở đây và G5 — PUT /api/lessons/[id] bỏ qua `status`.
import { NextRequest, NextResponse } from "next/server";
import { requireCurriculumAccess, denyLessonEdit, denyChapterEdit, roleForbidden } from "@/lib/courseAccessServer";
import { canDo } from "@/lib/courseAccess";
import { patchLesson } from "@/lib/giaoTrinhServer";
import { isLessonStatus, type LessonStatus } from "@/lib/lessonStatus";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;
const bad = (error: string) => NextResponse.json({ error }, { status: 400, headers: NO_STORE });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ courseId: string; lessonId: string }> }) {
  const { courseId, lessonId } = await params;
  const auth = await requireCurriculumAccess(courseId);
  if (auth instanceof NextResponse) return auth;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body !== "object" || Array.isArray(body)) return bad("Dữ liệu gửi lên không đúng.");
  const hasStatus = "status" in body, hasGroup = "groupId" in body;
  if (!hasStatus && !hasGroup) return bad("Thiếu trạng thái hoặc nhóm.");
  let status: LessonStatus | undefined;
  if (hasStatus) { if (!isLessonStatus(body.status)) return bad("Trạng thái không đúng."); status = body.status; }
  let groupId: string | null | undefined;
  if (hasGroup) {
    if (body.groupId === null) groupId = null;
    else if (typeof body.groupId === "string" && body.groupId.trim() && body.groupId.length <= 100) groupId = body.groupId;
    else return bad("Nhóm không đúng.");
  }
  // Bộ môn: bài phải ở nhóm của mình, và nếu chuyển sang nhóm khác thì nhóm đích cũng phải của mình.
  const denied = (await denyLessonEdit(auth.acc, [lessonId])) ?? (typeof groupId === "string" ? await denyChapterEdit(auth.acc, groupId) : groupId === null && !canDo(auth.acc.role, "content.edit.any") ? roleForbidden() : null);
  if (denied) return denied;
  const r = await patchLesson(courseId, lessonId, { status, groupId });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status, headers: NO_STORE });
  return NextResponse.json({ id: r.id, status: r.status, groupId: r.groupId }, { headers: NO_STORE });
}
