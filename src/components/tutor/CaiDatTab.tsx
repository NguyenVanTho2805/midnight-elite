// GS-LOP-GON (09/11/2026) — tab "Cài đặt" của lớp gia sư (/lop-cua-toi/quan-lop/[id]?tab=cai-dat). Mục con (?muc=, không thêm tab thứ 7):
// Thông tin (mặc định: form sửa lớp, TabCaiDat) · Học phí · Đồng giảng · Cộng đồng · Bản ghi. Học phí lớp (LopHocPhi, LopPhiKhac) chỉ ĐỔI CHỖ từ tab "Học phí" của LopChiTiet —
// TIỀN: không sửa dòng nào trong hai tệp đó, không thêm nút tạo phiếu / thanh toán. "Đồng giảng" = GiaoVienLop (giáo viên cùng dạy). Cộng đồng và Bản ghi là lối đi tới trang riêng
// (/lop-cua-toi/kiem-duyet, /lop-cua-toi/<id>/ban-ghi) — giữ nguyên route.
"use client";
import Link from "next/link";
import { kinButtonClass } from "@/components/kin/Button";
import { KinSectionHead } from "@/components/kin/SectionHead";
import GiaoVienLop from "@/components/tutor/GiaoVienLop";
import LopHocPhi from "@/components/tutor/LopHocPhi";
import LopPhiKhac from "@/components/tutor/LopPhiKhac";
import MucNav from "@/components/tutor/quan-lop/MucNav";
import QuanLopCourse from "@/components/tutor/quan-lop/QuanLopCourse";
import { classBase, MUC_CAI_DAT, type MucCaiDat } from "@/lib/tutorClassRoutes";
import type { ClassSettingsData } from "@/lib/tutorClassPageServer";
import { featureOn } from "@/lib/features";

const LABEL: Record<MucCaiDat, string> = { "thong-tin": "Thông tin", "hoc-phi": "Học phí", "dong-giang": "Đồng giảng", "cong-dong": "Cộng đồng", "ban-ghi": "Bản ghi" };

function OpenPage({ title, href, note, action }: { title: string; href: string; note: string; action: string }) {
  return (
    <section className="max-w-xl">
      <KinSectionHead title={title} />
      <p className="pt-4 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">{note}</p>
      <Link href={href} className={`${kinButtonClass("secondary")} mt-4`}>{action}</Link>
    </section>
  );
}

export default function CaiDatTab({ d }: { d: ClassSettingsData }) {
  const base = `${classBase(d.courseId)}?tab=cai-dat`;
  const mucHref = (m: MucCaiDat) => (m === "thong-tin" ? base : `${base}&muc=${m}`);
  return (
    <div data-cai-dat-tab className="min-w-0 max-w-5xl">
      <MucNav label="Mục của Cài đặt" items={MUC_CAI_DAT.map(m => ({ key: m, label: LABEL[m], href: mucHref(m), active: d.muc === m }))} />

      {d.muc === "thong-tin" && <QuanLopCourse courseId={d.courseId} view="cai-dat" />}

      {d.muc === "hoc-phi" && (
        <div className="space-y-[var(--kin-cach-muc)]">
          <LopHocPhi courseId={d.courseId} feeMode={d.feeMode} />
          <LopPhiKhac courseId={d.courseId} />
          {/* HP-31: "Gói buổi trả trước" đã ẩn theo quyết định của chủ 25/10/2026 (học xong mới thu học phí). Mã (LopGoiBuoi, API /packages) và hai bảng giữ nguyên để có thể bật lại. */}
        </div>
      )}

      {d.muc === "dong-giang" && <GiaoVienLop courseId={d.courseId} viewRole="owner" />}

      {d.muc === "cong-dong" && (
        <div className="space-y-[var(--kin-cach-muc)]">
          {/* LOI-01 (rà soát): bảng tin chung ẩn thì hỏi đáp của lớp mở ở /cong-dong?scope=<mã lớp> (chỉ thành viên lớp và gia sư). */}
          {!featureOn("CONG_DONG") && (
            <OpenPage title="Hỏi đáp trong lớp" href={`/cong-dong?scope=${encodeURIComponent(d.courseId)}`} action="Mở hỏi đáp của lớp"
              note="Câu hỏi học sinh của lớp gửi cho cô. Chỉ thành viên lớp và gia sư thấy; câu chưa trả lời cũng hiện ở Hộp việc." />
          )}
          <OpenPage title="Kiểm duyệt cộng đồng lớp" href="/lop-cua-toi/kiem-duyet" action="Mở Kiểm duyệt"
            note="Xem báo cáo bài viết trong các lớp của cô, xoá bài vi phạm hoặc bỏ qua." />
        </div>
      )}

      {d.muc === "ban-ghi" && (
        <OpenPage title="Bản ghi của lớp" href={`/lop-cua-toi/${encodeURIComponent(d.courseId)}/ban-ghi`} action="Mở bản ghi của lớp"
          note="Dán link bản ghi sau buổi học, gắn vào đúng buổi, và xem em nào đã xem video bài giảng của lớp." />
      )}
    </div>
  );
}
