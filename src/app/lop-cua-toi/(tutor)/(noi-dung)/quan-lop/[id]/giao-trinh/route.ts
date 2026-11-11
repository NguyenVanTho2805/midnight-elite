// LOI-02 (11/11/2026) — đường cũ /lop-cua-toi/quan-lop/<id>/giao-trinh (tab "Giáo trình" đã bỏ) → 307 THẬT + no-store về gốc lớp (tab "Bài học"), bỏ hết query.
// Route handler (không phải page.tsx) vì nhóm (tutor) có loading.tsx: trang bị stream ⇒ redirect() chỉ ra 200 + meta refresh; route handler không chịu loading.tsx.
// Next cấm route.ts và page.tsx CÙNG một đoạn; trang con giao-trinh/xem/[lessonId]/page.tsx ("Xem như học sinh") ở đoạn sâu hơn nên vẫn sống.
// Không lộ dữ liệu: đích luôn là gốc lớp, gốc tự kiểm quyền. Cổng gia sư chạy trước: khách → đăng nhập, chờ duyệt → /lop-cua-toi/cho-duyet, học sinh → /lop-cua-toi.
// Đặc tả: docs/kin/phong-ban/dac-ta/LOI-02.md mục 2.A4–A5.
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import { classBase } from "@/lib/tutorClassRoutes";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await redirectIfNotTutor(await getSession(), { path: classBase(id), adminTo: "/admin" });
  return NextResponse.redirect(new URL(classBase(id), req.url), { status: 307, headers: { "Cache-Control": "no-store" } });
}
