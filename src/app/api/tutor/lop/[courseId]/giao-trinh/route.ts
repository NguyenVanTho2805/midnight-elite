// G1 (BU-02) — Bản chụp Giáo trình của một lớp. Gia sư ĐÃ DUYỆT là CHỦ lớp (hoặc đồng giảng), hoặc quản trị trung tâm (SCL-B): chưa đăng nhập 401, không phải gia sư / lớp người khác 403, không có lớp 404.
// BU-02-PHẲNG: trả danh sách PHẲNG các mục (kèm trạng thái Nháp/Đã đăng/Ẩn) + nhóm. Không có tên học sinh trong câu trả lời.
import { NextRequest, NextResponse } from "next/server";
import { requireCourseAccess } from "@/lib/courseAccessServer";
import { canDo } from "@/lib/courseAccess";
import { loadGiaoTrinh } from "@/lib/giaoTrinhServer";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const acc = await requireCourseAccess(courseId, "course.view"); // TUT-dong-giang: đồng giảng / bộ môn xem được
  if (!acc.ok) return acc.res;
  // SCL-B (Q1): quản trị trung tâm đứng lớp như chủ lớp — ma trận courseAccess đã cho vai admin cùng quyền owner.
  const snap = await loadGiaoTrinh(courseId, { userId: acc.session.userId, seeTeacherIds: canDo(acc.role, "teacher.role") });
  if (!snap) return NextResponse.json({ error: "Không tìm thấy lớp" }, { status: 404, headers: NO_STORE });
  return NextResponse.json(snap, { headers: NO_STORE });
}
