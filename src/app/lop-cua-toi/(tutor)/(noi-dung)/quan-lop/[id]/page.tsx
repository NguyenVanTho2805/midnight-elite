// GS-LOP-GON (09/11/2026) → LOI-02 (11/11/2026) — trang GỐC của một lớp trong vỏ gia sư = tab "Bài học" (đặc tả docs/kin/phong-ban/dac-ta/LOI-02.md mục 2.A).
// Quy tắc (hàm thuần classPageDecision ở tutorClassRoutes.ts):
//   không ?tab= / chuong-bai / giao-trinh / lạ → thân "Bài học" NGAY tại đây (không chuyển hướng: nhiều liên kết cũ trỏ ?tab=chuong-bai) ·
//   ?tab=cai-dat → thân Cài đặt (+ ?muc=) · diem-danh / lich-hoc / hoc-vien → trang con tương ứng (liên kết cũ, kể cả proxy /admin/khoa-hoc/<id>?tab=…).
// "Bài học": CHỦ lớp → cây Chương · Bài (QuanLopCourse view="bai-hoc"); đồng giảng / giáo viên bộ môn → màn Giáo trình đang dùng (GiaoTrinh embedded — khoá theo nhóm,
// API G1 trả theo vai), vì TabChuongBai chỉ cho chủ lớp và API tải tệp trả 403 với người khác (A3). Cài đặt chỉ của chủ lớp.
// Cổng: redirectIfNotTutor → lớp có không (layout hiện "Không tìm thấy lớp") → của người khác ("Bạn không có quyền với lớp này").
// Lưu ý mã HTTP: nhóm (tutor) có loading.tsx nên chuyển hướng trong trang này đi theo kiểu stream (200 + <meta refresh> / điều hướng phía trình duyệt).
// …/giao-trinh (trang cũ) là route.ts trả 307 thật về gốc này.
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import { gateClassPage, loadClassSettings } from "@/lib/tutorClassPageServer";
import { classBase, classPageDecision, coTeacherClassHref } from "@/lib/tutorClassRoutes";
import CaiDatTab from "@/components/tutor/CaiDatTab";
import QuanLopCourse from "@/components/tutor/quan-lop/QuanLopCourse";
import GiaoTrinh from "@/components/tutor/giao-trinh/GiaoTrinh";

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
  if (d.tab === "bai-hoc") {
    if (gate.role !== "owner") return <GiaoTrinh courseId={id} embedded />;
    return <QuanLopCourse courseId={id} view="bai-hoc" />;
  }
  if (gate.role !== "owner") redirect(classBase(id)); // Cài đặt chỉ của chủ lớp: đồng giảng về "Bài học" của họ
  const settings = await loadClassSettings(id, sp);
  if (!settings) return null;
  return <CaiDatTab d={settings} />;
}
