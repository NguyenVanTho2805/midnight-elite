// SCL-G-GS (QUYET-DINH §2.2, khung Figma 731:2) — khối "Cần bạn xử lý" đầu cột trái trang lớp gia sư: hàng KinListRow bấm được, KHÔNG thẻ.
// Chỉ việc của LỚP NÀY (bản gom mọi lớp ở Hộp việc). Không việc nào ⇒ một dòng chữ, không khối trống.
import { KinListRow } from "@/components/kin/ListRow";
import { KinStatus, KinGradeStatus } from "@/components/kin/Status";
import { classBase } from "@/lib/tutorClassRoutes";
import { todoTotal, type ClassTodo } from "@/lib/lopViec";

export default function CanXuLyLop({ t }: { t: ClassTodo }) {
  const soDiem = `/lop-cua-toi/so-diem?lop=${encodeURIComponent(t.courseId)}`;
  return (
    <section data-can-xu-ly aria-labelledby="cxl-tieu-de" className="mb-8">
      <h2 id="cxl-tieu-de" className="mb-2 text-[length:var(--kin-co-tieu-de)] font-semibold text-[var(--kin-chu-chinh)]">Cần bạn xử lý</h2>
      {todoTotal(t) === 0 ? (
        <p data-can-xu-ly-trong className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">Lớp này chưa có bài chờ chấm, điểm chờ duyệt hay học sinh xin vào lớp.</p>
      ) : (
        <ul className="border-t border-[var(--kin-vien-nhat)]">
          {t.choCham > 0 && <li><KinListRow size="lg" href={soDiem} title="Bài chờ chấm" sub="Học sinh đã nộp, chưa có điểm" aside={<KinGradeStatus state="cho-cham">{t.choCham} bài</KinGradeStatus>} /></li>}
          {t.choDuyet > 0 && <li><KinListRow size="lg" href={soDiem} title="Điểm chờ duyệt" sub="Điểm tự khai cần bạn xác nhận" aside={<KinGradeStatus state="cho-duyet">{t.choDuyet} điểm</KinGradeStatus>} /></li>}
          {t.xinVao > 0 && <li><KinListRow size="lg" href={`${classBase(t.courseId)}/hoc-vien?muc=xin-vao`} title="Xin vào lớp" sub="Học sinh đang chờ bạn nhận" aside={<KinStatus tone="cho" shape="chua">{t.xinVao} người</KinStatus>} /></li>}
        </ul>
      )}
    </section>
  );
}
