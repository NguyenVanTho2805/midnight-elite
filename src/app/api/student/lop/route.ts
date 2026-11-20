// LOI-03 — GET /api/student/lop: thư viện "Lớp của tôi" của học sinh đang đăng nhập (x/y, %, bài "Học tiếp" tính sẵn ở máy chủ).
// Cổng: khách 401, gia sư/quản trị 403 (vai đọc lại từ DB — requireStudentRole). Chỉ GET (các phương thức khác ⇒ 405 mặc định của Next).
// KHÔNG trả: ownerId, email/số điện thoại, học sinh khác, giá/feeMode/tag (TIỀN), bg/strip/tagColor thô (mã hex), link nhóm, bài nháp/ẩn, link học liệu.
// Đặc tả: docs/kin/phong-ban/dac-ta/LOI-03.md mục 3.3.
import { NextResponse } from "next/server";
import { requireStudentRole } from "@/lib/studentOnly";
import { loadThuVienLop } from "@/lib/studentLopServer";
import type { ThuVienResp } from "@/lib/studentLop";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

export async function GET() {
  const gate = await requireStudentRole();
  if (gate instanceof NextResponse) { gate.headers.set("Cache-Control", NO_STORE["Cache-Control"]); return gate; }
  try {
    const body: ThuVienResp = { classes: await loadThuVienLop(gate.userId) };
    return NextResponse.json(body, { headers: NO_STORE });
  } catch (e) {
    console.error("[student/lop]", e instanceof Error ? e.message : "lỗi không rõ");
    return NextResponse.json({ error: "Lỗi server" }, { status: 500, headers: NO_STORE });
  }
}
