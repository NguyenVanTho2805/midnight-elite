// SCL-C (P1-1, HS4) — GET ?courseId= (tuỳ chọn) → { classes: [{ courseId, courseName, items: [{ id, kind, title, max, state, label, score }] }] }: điểm / trạng thái
// từng bài của CHÍNH học sinh trong các lớp đang học (lớp không học ⇒ không có trong danh sách). Cùng hàm thuần với sổ điểm gia sư (src/lib/soDiem.ts).
import { NextRequest, NextResponse } from "next/server";
import { isNextResponse } from "@/lib/auth-guard";
import { requireStudentRole } from "@/lib/studentOnly";
import { loadStudentResults } from "@/lib/gradebookServer";

export async function GET(req: NextRequest) {
  const s = await requireStudentRole();
  if (isNextResponse(s)) return s;
  const courseId = new URL(req.url).searchParams.get("courseId");
  try {
    return NextResponse.json({ classes: await loadStudentResults(s.userId, courseId && courseId.length <= 100 ? courseId : null) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[GET /api/student/ket-qua]", e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}
