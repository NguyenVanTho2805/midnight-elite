import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isStudentInDb } from "@/lib/studentOnly";
import { listStudentAssignments } from "@/lib/examAssignmentsServer";

// GET /api/student/de-thi — BU-04: danh sách "Đề thi" của học sinh đang đăng nhập (lớp em học + đề em đã làm).
// Chỉ đề đã phát hành, bản mới nhất, KHÔNG có mã con. Không trả tên học sinh khác, id mã con, giá, đáp án; điểm tốt nhất chỉ khi được xem.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  // H4: gia sư / quản trị không phải học sinh ⇒ rỗng (200).
  if (session.role !== "student" || !(await isStudentInDb(session.userId))) {
    return NextResponse.json({ serverNow: new Date().toISOString(), items: [] }, { headers: { "Cache-Control": "no-store" } });
  }
  try {
    const now = new Date();
    const items = await listStudentAssignments(session.userId, now);
    return NextResponse.json({ serverNow: now.toISOString(), items }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[GET /api/student/de-thi]", e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}
