// GS-LOP-GON (09/11/2026) — layout lồng của MỘT lớp trong vỏ gia sư: cổng quyền + ĐẦU LỚP một lần (tên, môn, trạng thái bằng chữ, "← Lớp học") + MỘT dải tab duy nhất
// "Giáo trình · Học sinh · Điểm danh · Bài tập · Lịch học · Cài đặt". Không breadcrumb quản trị, không dải tab thứ hai (đặc tả GS-LOP-GON mục 3.2, 3.3, 4.3, 4.4).
// Cần layout riêng vì (noi-dung)/layout.tsx không có tham số [id]; layout cha chỉ còn vẽ dải của nhóm Đề thi.
// Thứ tự trả lời (khớp courseAccessServer.loadCourseAccess): chưa đăng nhập → đăng nhập; chờ duyệt → /lop-cua-toi/cho-duyet; học sinh → /lop-cua-toi;
// lớp không có → "Không tìm thấy lớp"; lớp của gia sư khác → "Bạn không có quyền với lớp này" — màn này KHÔNG mang tên lớp / môn / số học sinh của lớp đó.
// Lưu ý: nhóm (tutor) có loading.tsx nên mọi trang con được STREAM → mã HTTP của trang luôn 200; "403 / 404" của trang là NỘI DUNG màn, mã HTTP thật nằm ở API.
import Link from "next/link";
import type { ReactNode } from "react";
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import { loadClassHead } from "@/lib/tutorClassPageServer";
import { classBase } from "@/lib/tutorClassRoutes";
import ClassHead from "@/components/tutor/ClassHead";
import TutorContentTabs from "@/components/tutor/TutorContentTabs";

const LIST_HREF = "/lop-cua-toi/lop";

/** Màn thay cho cả trang lớp khi không có lớp / không có quyền. Chỉ chữ cố định — không dữ liệu lớp. */
function ClassNotice({ title, hint, code }: { title: string; hint: string; code: "not-found" | "forbidden" }) {
  return (
    <section data-class-gate={code} className="mx-auto max-w-xl rounded-xl border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-bang)] p-6 text-center">
      <h1 className="text-h3 font-bold text-[var(--kin-chu-chinh)]">{title}</h1>
      <p className="mt-2 text-sm text-[var(--kin-chu-phu)]">{hint}</p>
      <Link href={LIST_HREF} className="mt-4 inline-flex min-h-[44px] items-center rounded-lg px-4 text-sm font-semibold"
        style={{ background: "var(--kin-nhan-nen)", color: "var(--kin-chu-tren-nut-chinh)" }}>
        Về danh sách lớp
      </Link>
    </section>
  );
}

export default async function QuanLopLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await redirectIfNotTutor(await getSession(), { path: classBase(id), adminTo: "/admin" });
  const gate = await loadClassHead(session, id);
  if (!gate.ok) {
    return gate.reason === "not_found"
      ? <ClassNotice code="not-found" title="Không tìm thấy lớp" hint="Lớp này không có hoặc đã bị xoá. Cô quay lại danh sách lớp để chọn lớp khác." />
      : <ClassNotice code="forbidden" title="Bạn không có quyền với lớp này" hint="Lớp này không thuộc về cô. Cô quay lại danh sách lớp của mình." />;
  }
  const h = gate.head;
  return (
    <div className="min-w-0">
      <div className="print:hidden"><ClassHead name={h.name} category={h.category} status={h.classStatus} hidden={h.hidden} studentCount={h.studentCount} examsHref={gate.role === "owner" ? `/lop-cua-toi/de-thi?lop=${encodeURIComponent(id)}` : null} /></div>
      <TutorContentTabs scope="quan-lop" role={gate.role} />
      <div className="pt-4 sm:pt-5">{children}</div>
    </div>
  );
}
