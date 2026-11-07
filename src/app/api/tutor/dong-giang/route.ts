// TUT-dong-giang — GET lời mời gửi cho tôi + lớp tôi đang đồng giảng. Gia sư đã duyệt; không tên chủ lớp, không tiền, không tên học sinh.
import { NextResponse } from "next/server";
import { requireTutorOnly } from "@/lib/tutorGateServer";
import { loadMyCoTeaching } from "@/lib/courseTeacherServer";

export async function GET() {
  const auth = await requireTutorOnly();
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json(await loadMyCoTeaching(auth.userId), { headers: { "Cache-Control": "no-store" } });
}
