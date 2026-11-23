// SCL đợt 5 (D8, tình huống 11–12) — POST (form) /api/tutor/lop/[courseId]/hoc-thu: chủ lớp hoặc quản trị trung tâm (requireCourseAccess, như các nút duyệt khác)
// bấm "Xác nhận chính thức" (bỏ hạn, giữ điểm/bài đã nộp) hoặc "Gia hạn 7 ngày" cho MỘT ghi danh thử của lớp. Kết quả 303 về tab Học sinh kèm ?hocthu=ok | loi.
import { NextResponse } from "next/server";
import { requireCourseAccess } from "@/lib/courseAccessServer";
import { applyTrialAction, type TrialAction } from "@/lib/trialServer";
import { classBase } from "@/lib/tutorClassRoutes";
import { logAction } from "@/lib/auditLog";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const acc = await requireCourseAccess(courseId);
  if (!acc.ok) return acc.res;
  if (acc.role !== "owner" && acc.role !== "admin") return NextResponse.json({ error: "Chỉ chủ lớp hoặc quản trị trung tâm" }, { status: 403, headers: NO_STORE });
  const fd = await req.formData().catch(() => null);
  const enrollmentId = String(fd?.get("enrollmentId") ?? "");
  const action = fd?.get("action");
  const back = (r: string) => NextResponse.redirect(new URL(`${classBase(courseId)}/hoc-vien?hocthu=${r}`, req.url), { status: 303, headers: NO_STORE });
  if (!enrollmentId || enrollmentId.length > 100 || (action !== "xac-nhan" && action !== "gia-han")) return back("loi");
  const ok = await applyTrialAction(courseId, enrollmentId, action as TrialAction);
  if (ok) await logAction(acc.session.userId, action === "xac-nhan" ? "enrollment.trial_confirm" : "enrollment.trial_extend", "Enrollment", enrollmentId, { courseId });
  return back(ok ? "ok" : "loi");
}
