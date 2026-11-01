// BU-01 (R7) — POST /api/tutor/lop/[courseId]/yeu-cau/[id]/duyet (form): gia sư chủ lớp DUYỆT MỘT yêu cầu vào lớp.
// Lớp gia sư khác 403, không có lớp 404, yêu cầu không thuộc lớp này 404, học sinh / chưa đăng nhập 403 / 401. Kết quả nghiệp vụ ⇒ 303 về tab Học sinh kèm ?duyet=
// (ok | tuchoi | day | goi | da-xu-ly | loi-ghi-chu). Lớp đầy / gói chặn ⇒ yêu cầu VẪN pending. Việc ghi nằm ở decideJoinRequest (src/lib/enrollServer.ts).
import { NextRequest, NextResponse } from "next/server";
import { decideJoinRequest, requireCourseTutor } from "@/lib/enrollServer";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: NextRequest, { params }: { params: Promise<{ courseId: string; id: string }> }) {
  const { courseId, id } = await params;
  const g = await requireCourseTutor(courseId);
  if (g instanceof NextResponse) return g;
  const fd = await req.formData().catch(() => null);
  const outcome = await decideJoinRequest(g.course, id, "duyet", g.session.userId, fd?.get("note") ?? undefined);
  if (outcome === "khong-co") return NextResponse.json({ error: "Không tìm thấy yêu cầu" }, { status: 404, headers: NO_STORE });
  return NextResponse.redirect(new URL(`/lop-cua-toi/${encodeURIComponent(courseId)}?tab=hoc-sinh&duyet=${outcome}`, req.url), { status: 303, headers: NO_STORE });
}
