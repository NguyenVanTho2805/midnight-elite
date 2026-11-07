// TUT-dong-giang 7.3 — một dòng "lớp tôi đồng giảng": tên lớp, huy hiệu vai, "N buổi chưa điểm danh". Dùng ở Hộp việc và danh sách Lớp.
// Không tên chủ lớp, không tiền.
import Link from "next/link";
import { RoleBadge } from "@/components/tutor/GiaoVienLop";
import type { CoCourse } from "@/components/tutor/dongGiangUi";

export default function DongGiangHang({ c }: { c: CoCourse }) {
  const next = c.nextSession?.dateKey ? `${c.nextSession.dateKey.slice(8, 10)}/${c.nextSession.dateKey.slice(5, 7)}` : null;
  return (
    <li data-dong-giang-hang={c.courseId} className="flex flex-col items-start md:flex-row md:items-center gap-1 md:gap-4 px-[var(--kin-kc-6)] py-[var(--kin-kc-4)] md:min-h-[var(--kin-hang-bang)] border-b border-[var(--kin-vien-nhat)] text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-chinh)]">
      <div className="min-w-0 md:flex-1">
        <Link href={`/lop-cua-toi/${c.courseId}`} className="inline-flex items-center min-h-11 md:min-h-0 font-medium break-words hover:underline">{c.courseName}</Link>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <RoleBadge role={c.role} />
        {c.subjects.length > 0 && <span className="text-[var(--kin-chu-mo)] break-words">{c.subjects.join(", ")}</span>}
      </div>
      <p className={`tabular-nums ${c.unmarkedCount > 0 ? "" : "text-[var(--kin-chu-mo)]"}`}>
        {c.unmarkedCount > 0 ? `${c.unmarkedCount} buổi chưa điểm danh` : "Không có buổi chờ điểm danh"}
        {next ? ` · buổi tới ${next}` : ""}
      </p>
      <Link href={`/lop-cua-toi/${c.courseId}`} aria-label={`Mở lớp ${c.courseName}`} className="inline-flex items-center min-h-11 md:min-h-0 text-[var(--kin-nhan-link)] hover:underline">Mở lớp →</Link>
    </li>
  );
}
