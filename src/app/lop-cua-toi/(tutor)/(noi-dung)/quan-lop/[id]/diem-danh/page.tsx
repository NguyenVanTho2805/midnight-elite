// GS-LOP-GON (09/11/2026) — tab "Điểm danh" của lớp (trang gia sư RIÊNG): bảng điểm danh (DiemDanhPanel `embedded`: không h1 thứ hai — h1 là tên lớp ở đầu lớp) + "Lịch sử buổi học"
// (5 buổi gần nhất, mỗi dòng mở trang Buổi — trước đây nằm ở LopChiTiet). Chỉ CHỦ lớp; đồng giảng → /lop-cua-toi/<id>. Trang tự kiểm quyền (không tin layout).
// Chốt buổi / học phí KHÔNG ở đây: nằm ở /lop-cua-toi/buoi/<lớp>/<ngày> (sessionBook*, feeCharge*) — trang này chỉ ĐỌC lịch sử, không tạo / sửa phiếu nào.
import { Suspense } from "react";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import { gateClassPage, loadAttendanceHistory } from "@/lib/tutorClassPageServer";
import { classBase } from "@/lib/tutorClassRoutes";
import DiemDanhPanel from "@/components/tutor/DiemDanh";
import { KinPanel } from "@/components/kin/Panel";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { KinStatus } from "@/components/kin/Status";
import { KIN_TABLE_ROW } from "@/components/kin/PageLayout";

export const dynamic = "force-dynamic";

const dm = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}`;

export default async function DiemDanhPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await redirectIfNotTutor(await getSession(), { path: `${classBase(id)}/diem-danh`, adminTo: "/admin" });
  const gate = await gateClassPage(session, id, { ownerOnly: true });
  if (!gate.ok) return null;
  const h = await loadAttendanceHistory(id);
  const n = h.studentCount;
  return (
    <div className="space-y-8">
      <Suspense fallback={null}><DiemDanhPanel courseId={id} embedded /></Suspense>
      <section aria-labelledby="lop-ls" data-lich-su-buoi>
        <KinSectionHead id="lop-ls" title="Lịch sử buổi học" />
        {h.history.length === 0 ? (
          <p className="pt-4 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">Chưa có buổi nào được điểm danh. Chọn ngày ở bảng trên rồi tạo buổi điểm danh đầu tiên.</p>
        ) : (
          <KinPanel flush className="mt-4">
            <ul aria-label="Các buổi đã điểm danh gần đây">
              {h.history.map(s => {
                const full = n > 0 && s.marked >= n;
                return (
                  <li key={s.id}>
                    <Link href={`/lop-cua-toi/buoi/${encodeURIComponent(id)}/${s.dateKey}`} className={`flex min-h-[44px] justify-between gap-3 ${KIN_TABLE_ROW}`}>
                      <span className="min-w-0 break-words text-[var(--kin-chu-chinh)]">{dm(s.dateKey)}{s.note ? ` · ${s.note}` : ""}</span>
                      <KinStatus tone={full ? "xong" : "cho"} className="flex-shrink-0">{full ? "Đã điểm danh đủ" : `Mới ${s.marked}/${n} em`}</KinStatus>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </KinPanel>
        )}
        <p className="mt-4 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">{h.sessionsTaught} buổi đã điểm danh từ đầu đến nay.</p>
      </section>
    </div>
  );
}
