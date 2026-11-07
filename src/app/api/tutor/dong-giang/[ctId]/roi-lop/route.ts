// TUT-dong-giang — POST roi-lop: đồng giảng đang active tự rời lớp. Buổi / điểm danh đã có được giữ nguyên; khung lịch + nhóm giao cho mình về chủ.
import { NextRequest, NextResponse } from "next/server";
import { requireTutorOnly } from "@/lib/tutorGateServer";
import { leaveCourse } from "@/lib/courseTeacherServer";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ ctId: string }> }) {
  const { ctId } = await params;
  const auth = await requireTutorOnly();
  if (auth instanceof NextResponse) return auth;
  const out = await leaveCourse(ctId, auth.userId);
  if (!out.ok) return NextResponse.json({ error: out.error, code: "code" in out ? out.code : undefined }, { status: out.status, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
}
