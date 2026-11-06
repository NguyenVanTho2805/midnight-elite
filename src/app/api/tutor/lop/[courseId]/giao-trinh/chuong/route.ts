// G6 (BU-02-PHẲNG) — tạo chương (NHÓM) tuỳ chọn. Chỉ gia sư đã duyệt và là chủ lớp.
import { NextRequest, NextResponse } from "next/server";
import { requireCourseTutor } from "@/lib/enrollServer";
import { createGroup } from "@/lib/giaoTrinhServer";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

export async function POST(req: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const auth = await requireCourseTutor(courseId);
  if (auth instanceof NextResponse) return auth;
  const body = await req.json().catch(() => null) as { title?: unknown } | null;
  const r = await createGroup(courseId, typeof body?.title === "string" ? body.title : "");
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status, headers: NO_STORE });
  return NextResponse.json({ id: r.id, title: r.title }, { status: 201, headers: NO_STORE });
}
