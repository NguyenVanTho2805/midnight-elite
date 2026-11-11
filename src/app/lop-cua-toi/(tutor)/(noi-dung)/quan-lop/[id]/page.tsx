// GS-LOP-GON (09/11/2026) — trang GỐC của một lớp trong vỏ gia sư. Không còn re-export KhoaHocDetailPage của quản trị (breadcrumb "Bảng điều khiển /", đầu khung, dải tab thứ hai).
// Quy tắc (đặc tả mục 3.1, hàm thuần classPageDecision ở tutorClassRoutes.ts):
//   không ?tab= / lạ / giao-trinh → redirect …/giao-trinh · diem-danh / lich-hoc / hoc-vien → trang con tương ứng (liên kết cũ, kể cả proxy /admin/khoa-hoc/<id>?tab=lich-hoc);
//   ?tab=cai-dat → thân tab Cài đặt (+ ?muc=) · ?tab=chuong-bai → thân tab Bài tập (cây Phần · Chương · Bài). Chuyển hướng chỉ giữ danh sách trắng query.
// Thân tab chỉ dành CHỦ lớp (đồng giảng → /lop-cua-toi/<id>). Cổng: redirectIfNotTutor → lớp có không (layout hiện "Không tìm thấy lớp") → của người khác ("Bạn không có quyền với lớp này").
// Lưu ý mã HTTP: nhóm (tutor) có loading.tsx nên chuyển hướng trong trang này đi theo kiểu stream (200 + <meta refresh> / điều hướng phía trình duyệt), KHÔNG phải 307 như
// /lop-cua-toi/[courseId] (trang đó không có loading.tsx). Xem bàn giao: muốn 307 thật phải qua proxy (hostRouting.ts, tệp chung).
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import { gateClassPage, loadClassSettings } from "@/lib/tutorClassPageServer";
import { classBase, classPageDecision, coTeacherClassHref } from "@/lib/tutorClassRoutes";
import CaiDatTab from "@/components/tutor/CaiDatTab";
import QuanLopCourse from "@/components/tutor/quan-lop/QuanLopCourse";

export const dynamic = "force-dynamic";

export default async function QuanLopPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const session = await redirectIfNotTutor(await getSession(), { path: classBase(id), adminTo: "/admin" });
  const gate = await gateClassPage(session, id, { ownerOnly: false });
  if (!gate.ok) return null;
  const d = classPageDecision(id, sp);
  if (d.kind === "redirect") {
    // Đồng giảng / bộ môn không có tab Học sinh / Điểm danh: đi thẳng tới trang lớp của họ (không qua hai chặng).
    if (gate.role !== "owner" && /\/(hoc-vien|diem-danh)(\?|$)/.test(d.to)) redirect(coTeacherClassHref(id));
    redirect(d.to);
  }
  if (gate.role !== "owner") redirect(coTeacherClassHref(id)); // thân Cài đặt / Bài tập chỉ của chủ lớp
  if (d.tab === "chuong-bai") return <QuanLopCourse courseId={id} view="chuong-bai" />;
  const settings = await loadClassSettings(id, sp);
  if (!settings) return null;
  return <CaiDatTab d={settings} />;
}
