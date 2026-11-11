// GS-LOP-GON (09/11/2026) — tab "Học sinh" của lớp (trang gia sư RIÊNG, không còn re-export trang quản trị): danh bạ lớp + các mục con ?muc= (xin vào lớp · mã mời · thêm học sinh)
// — những khối trước đây nằm ở LopChiTiet (/lop-cua-toi/[courseId]). Chỉ CHỦ lớp: đồng giảng / giáo viên bộ môn → /lop-cua-toi/<id> (LopChiTiet của họ).
// Trang tự kiểm quyền (không tin layout): lớp của người khác → không tải gì, layout đã hiện "Bạn không có quyền với lớp này".
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import { gateClassPage, loadStudentsTab } from "@/lib/tutorClassPageServer";
import { classBase } from "@/lib/tutorClassRoutes";
import HocSinhTab from "@/components/tutor/HocSinhTab";

export const dynamic = "force-dynamic";

export default async function HocSinhPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const session = await redirectIfNotTutor(await getSession(), { path: `${classBase(id)}/hoc-vien`, adminTo: "/admin" });
  const gate = await gateClassPage(session, id, { ownerOnly: true });
  if (!gate.ok) return null;
  const d = await loadStudentsTab(session, id, sp);
  if (!d) return null;
  return <HocSinhTab d={d} />;
}
