// BU-01 (R9) — POST /api/tutor/lop/[courseId]/yeu-cau/hang-loat (form: action=duyet|tu-choi, id lặp ≤ 50, note chung cho từ chối).
// Duyệt theo thứ tự gửi cho tới khi đầy lớp; id lạ / khác lớp bị bỏ qua. 303 về tab Học sinh kèm ?duyet=ok|tuchoi|mot-phan|day|dong|da-nghi|loi-ghi-chu&n=<số đã xử lý>. da-nghi = có yêu cầu của học sinh đang tạm dừng (bị bỏ qua, vẫn chờ).
import { NextRequest, NextResponse } from "next/server";
import { decideJoinRequestsBulk, requireCourseTutor } from "@/lib/enrollServer";
import { JOIN_BULK_MAX } from "@/lib/joinRequest";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const g = await requireCourseTutor(courseId);
  if (g instanceof NextResponse) return g;
  const fd = await req.formData().catch(() => null);
  const action = fd?.get("action");
  if (action !== "duyet" && action !== "tu-choi") return NextResponse.json({ error: "Thiếu hành động" }, { status: 400, headers: NO_STORE });
  const ids = [...new Set((fd?.getAll("id") ?? []).filter((x): x is string => typeof x === "string" && !!x))].slice(0, JOIN_BULK_MAX);
  const r = await decideJoinRequestsBulk(g.course, ids, action, g.session.userId, fd?.get("note") ?? undefined);
  const key = r.noteError ? "loi-ghi-chu" : r.blocked ? (r.done > 0 ? "mot-phan" : r.closed ? "dong" : "day") : r.suspended > 0 ? "da-nghi" : action === "duyet" ? "ok" : "tuchoi";
  return NextResponse.redirect(new URL(`/lop-cua-toi/${encodeURIComponent(courseId)}?tab=hoc-sinh&duyet=${key}&n=${r.done}`, req.url), { status: 303, headers: NO_STORE });
}
