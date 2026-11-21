// SCL-C (P1-1) — sổ điểm gọn: GET ?courseId=<lớp> → { courses, courseId, columns, rows }. Không courseId ⇒ lớp đầu tiên người này được mở.
// Chủ nhiệm (quản trị trung tâm) mọi lớp; gia sư chỉ lớp mình làm chủ (đồng giảng / bộ môn / lớp người khác 403, không có lớp 404). Học sinh 403.
// Quyền theo ma trận courseAccess `score.write` (chỉ owner + admin) — cùng chốt với duyệt điểm / chấm điểm trong sổ.
import { NextRequest, NextResponse } from "next/server";
import { requireCourseAccess } from "@/lib/courseAccessServer";
import { getSessionChecked } from "@/lib/session";
import { gradebookCourses, loadClassGradebook } from "@/lib/gradebookServer";
import { isCenterAdmin, isTeacher } from "@/lib/tutorGate";
import { gradebookCsvMatrix, toCsv } from "@/lib/soDiem";
import { vnDateKeyOf } from "@/lib/classSessions";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(req: NextRequest) {
  const { session } = await getSessionChecked();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401, headers: NO_STORE });
  if (!isTeacher(session) && !isCenterAdmin(session)) return NextResponse.json({ error: "Chỉ gia sư mới dùng chức năng này" }, { status: 403, headers: NO_STORE });
  const courses = await gradebookCourses(session);
  const sp = new URL(req.url).searchParams;
  const courseId = sp.get("courseId") ?? courses[0]?.id ?? null;
  if (!courseId) return NextResponse.json({ courses, courseId: null, columns: [], rows: [], truncated: false }, { headers: NO_STORE });
  const acc = await requireCourseAccess(courseId, "score.write");
  if (!acc.ok) return acc.res;
  const book = await loadClassGradebook(courseId);
  // SCL-G-SD: &format=csv ⇒ "Xuất CSV" (BOM UTF-8). Cùng quyền, cùng dữ liệu bảng — chỉ tên học sinh và điểm, không mã nào.
  if (sp.get("format") === "csv") {
    const now = new Date();
    return new NextResponse(toCsv(gradebookCsvMatrix(book.columns, book.rows, now)), {
      headers: { ...NO_STORE, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="so-diem-${vnDateKeyOf(now)}.csv"` },
    });
  }
  return NextResponse.json({ courses, courseId, ...book }, { headers: NO_STORE });
}
