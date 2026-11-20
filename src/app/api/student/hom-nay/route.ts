// LOI-03 — GET /api/student/hom-nay: phiếu "Hôm nay có lớp" của học sinh đang đăng nhập. Mốc giờ do MÁY CHỦ quyết (giờ VN), trình duyệt không tự tính "hôm nay".
// Cổng: khách 401, gia sư/quản trị 403 (requireStudentRole). Chỉ GET. Không đọc AssignmentQuestion/AssignmentSubmission/Exam* — không đáp án, lời giải, điểm, bài nộp.
// Đặc tả: docs/kin/phong-ban/dac-ta/LOI-03.md mục 3.4.
import { NextResponse } from "next/server";
import { requireStudentRole } from "@/lib/studentOnly";
import { loadHomNay } from "@/lib/studentLopServer";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

export async function GET() {
  const gate = await requireStudentRole();
  if (gate instanceof NextResponse) { gate.headers.set("Cache-Control", NO_STORE["Cache-Control"]); return gate; }
  try {
    return NextResponse.json(await loadHomNay(gate.userId, new Date()), { headers: NO_STORE });
  } catch (e) {
    console.error("[student/hom-nay]", e instanceof Error ? e.message : "lỗi không rõ");
    return NextResponse.json({ error: "Lỗi server" }, { status: 500, headers: NO_STORE });
  }
}
