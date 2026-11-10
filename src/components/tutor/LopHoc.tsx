// "Lớp học" của gia sư: H1 + dòng phụ + nút "Tạo lớp"; ô tìm + lọc môn/trạng thái; THƯ VIỆN THẺ LỚP (ThuVienLop) thay bảng 5 cột (GS-LOP-GON 09/11/2026; trước đó
// Figma "Gia sư · Lớp" 299:112349); dưới thư viện nhắc lớp chưa có học sinh → mời. Đã bỏ khối chữ "Điểm danh và học phí đi cùng nhau" (lặp ý với mục Học phí).
// Điện thoại: một cột, nút ≥ 44px. Đang tải: khung xương. Lỗi: dải báo + "Thử lại". Rỗng: giải thích + đi tiếp.
// Dữ liệu: /api/tutor/lop ({ rows, totalStudents }). KHÔNG có cột "Cách tính phí": KiN chưa lưu cách tính phí theo lớp (xem tutorClassTable.ts).
"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { filterClassRows, type TutorClassRow } from "@/lib/tutorClassTable";
import { CLASS_STATUS_LABEL } from "@/lib/tutorTodo";
import { ErrorStrip } from "@/components/kin/shell/Outlook";
import { kinButtonClass } from "@/components/kin/Button";
import { KinEmptyState } from "@/components/kin/EmptyState";
import DongGiangNhom from "@/components/tutor/DongGiangNhom";
import { KinPage, KinPageHeader, KIN_FIELD } from "@/components/kin/PageLayout";
import ThuVienLop from "@/components/tutor/ThuVienLop";
import { classBase } from "@/lib/tutorClassRoutes";

const FIELD = KIN_FIELD;

/** Khung xương thư viện: ô lọc + vài thẻ (cùng lưới với thư viện thật nên không nhảy bố cục). */
function Skeleton() {
  const sk = "kin-skel kin-skel--soft";
  return (
    <div aria-busy="true" aria-label="Đang tải danh sách lớp">
      <div className={`h-[73px] rounded ${sk}`} />
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map(i => <div key={i} className={`h-[300px] rounded-[var(--kin-bo-the)] ${sk}`} />)}
      </div>
    </div>
  );
}

export default function LopHoc() {
  const [rows, setRows] = useState<TutorClassRow[] | null>(null);
  const [totalStudents, setTotalStudents] = useState(0);
  const [error, setError] = useState(false);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");

  const load = useCallback(() => {
    fetch("/api/tutor/lop", { credentials: "same-origin", cache: "no-store" })
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(d => { setRows(Array.isArray(d.rows) ? d.rows : []); setTotalStudents(Number(d.totalStudents) || 0); setError(false); })
      .catch(() => setError(true));
  }, []);
  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const all = useMemo(() => rows ?? [], [rows]);
  const categories = useMemo(() => [...new Set(all.map(r => r.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "vi")), [all]);
  const statuses = useMemo(() => [...new Set(all.map(r => r.classStatus))], [all]);
  const shown = filterClassRows(all, { q, category, status });
  const filtering = q.trim() !== "" || category !== "" || status !== "";
  const noStudents = all.find(r => r.students === 0);

  return (
    <KinPage>
      <KinPageHeader title="Lớp học"
        sub={<>{rows ? `${all.length} lớp · ${totalStudents} học sinh đang học. ` : <span aria-hidden className="invisible">00 lớp · 00 học sinh đang học. </span>}Một nơi để theo dõi lịch, buổi dạy và học sinh của từng lớp.</>}
        actions={<Link href="/lop-cua-toi/lop/tao" className={kinButtonClass("primary")}>Tạo lớp</Link>} />

      {error && <ErrorStrip message="Không tải được danh sách lớp." onRetry={load} />}
      {rows === null ? (!error ? <Skeleton /> : null) : all.length === 0 ? (
        <KinEmptyState title="Cô chưa mở lớp nào" action={<Link href="/lop-cua-toi/lop/tao" className={kinButtonClass("primary")}>Tạo lớp đầu tiên</Link>}>
          Tạo lớp đầu tiên, rồi gửi mã mời cho học sinh vào lớp. Lớp có lịch và học sinh sẽ hiện thành thẻ ở đây.
        </KinEmptyState>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,440px)_230px_230px]" role="search" aria-label="Tìm và lọc lớp">
            <label className="block text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">Tìm lớp
              <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Tên lớp, môn học…" className={`${FIELD} mt-2`} />
            </label>
            <label className="block text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">Môn học
              <select value={category} onChange={e => setCategory(e.target.value)} className={`${FIELD} mt-2`}>
                <option value="">Tất cả môn</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="block text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">Trạng thái
              <select value={status} onChange={e => setStatus(e.target.value)} className={`${FIELD} mt-2`}>
                <option value="">Tất cả trạng thái</option>
                {statuses.map(s => <option key={s} value={s}>{CLASS_STATUS_LABEL[s] ?? s}</option>)}
              </select>
            </label>
          </div>

          {noStudents && (
            <section aria-labelledby="lop-empty" data-lop-nhac className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[var(--kin-bo-the)] bg-[var(--kin-nen-bang)] p-4">
              <div className="min-w-0 flex-1">
                <h2 id="lop-empty" className="text-[length:var(--kin-co-tieu-de)] font-medium break-words">{noStudents.name} chưa có học sinh</h2>
                <p className="pt-1 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">Mời bằng mã lớp để học sinh tự vào, hoặc thêm từ danh sách để bắt đầu lên lịch.</p>
              </div>
              <Link href={`${classBase(noStudents.id)}/hoc-vien?muc=ma-moi`} className={kinButtonClass("secondary")}>Mời học sinh vào {noStudents.name}</Link>
            </section>
          )}

          <div className="mt-6">
            {shown.length === 0 ? (
              <KinEmptyState title="Không có lớp nào khớp" action={<button type="button" className={kinButtonClass("secondary")} onClick={() => { setQ(""); setCategory(""); setStatus(""); }}>Xoá bộ lọc</button>}>
                Thử đổi từ khoá, môn học hoặc trạng thái để thấy các lớp còn lại.
              </KinEmptyState>
            ) : <ThuVienLop rows={shown} />}
          </div>

          <p className="mt-8 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Hiển thị {shown.length}/{all.length} lớp{filtering ? " theo bộ lọc" : ""}.</p>
        </>
      )}
      {/* TUT-dong-giang 7.3: lớp cô được mời cùng dạy, nhóm riêng dưới lớp của cô. */}
      <DongGiangNhom part="courses" />
    </KinPage>
  );
}
