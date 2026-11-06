// G6 (BU-02-PHẲNG) — đổi tên nhóm (PATCH) và "Bỏ nhóm" (DELETE). Chỉ gia sư đã duyệt và là chủ lớp.
// DELETE: mọi mục trong chương chuyển về chương không nhóm rồi xoá chương trống; KHÔNG BAO GIỜ xoá Lesson. Chương ngầm ⇒ 400 "Đây không phải nhóm".
import { NextRequest, NextResponse } from "next/server";
import { requireCourseTutor } from "@/lib/enrollServer";
import { renameGroup, ungroup } from "@/lib/giaoTrinhServer";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ courseId: string; chapterId: string }> }) {
  const { courseId, chapterId } = await params;
  const auth = await requireCourseTutor(courseId);
  if (auth instanceof NextResponse) return auth;
  const body = await req.json().catch(() => null) as { title?: unknown } | null;
  const r = await renameGroup(courseId, chapterId, typeof body?.title === "string" ? body.title : "");
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status, headers: NO_STORE });
  return NextResponse.json({ id: r.id, title: r.title }, { headers: NO_STORE });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ courseId: string; chapterId: string }> }) {
  const { courseId, chapterId } = await params;
  const auth = await requireCourseTutor(courseId);
  if (auth instanceof NextResponse) return auth;
  const r = await ungroup(courseId, chapterId);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status, headers: NO_STORE });
  return NextResponse.json({ moved: r.moved }, { headers: NO_STORE });
}
