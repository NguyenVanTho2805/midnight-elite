// "Lớp học" của gia sư (Figma "Gia sư · Lớp" 299:112349): H1 + dòng phụ + nút "Tạo lớp"; ô tìm + lọc môn/trạng thái;
// bảng dạng danh sách liên kết (Lớp · Học sinh · Lịch cố định · Tiến độ · Thao tác); ghi chú cuối bảng; cột phải nhắc lớp chưa có học sinh.
// Điện thoại: mỗi lớp là một khối một cột, nút ≥ 44px. Đang tải: khung xương. Lỗi: dải báo + "Thử lại". Rỗng: giải thích + đi tiếp.
// Dữ liệu: /api/tutor/lop ({ rows, totalStudents }). KHÔNG có cột "Cách tính phí": KiN chưa lưu cách tính phí theo lớp (xem tutorClassTable.ts).
"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { filterClassRows, type TutorClassRow } from "@/lib/tutorClassTable";
import { CLASS_STATUS_LABEL } from "@/lib/tutorTodo";
import { ErrorStrip } from "@/components/kin/shell/Outlook";
import { kinButtonClass } from "@/components/kin/Button";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { KinCallout } from "@/components/kin/Callout";
import { KinEmptyState } from "@/components/kin/EmptyState";

const FIELD = "w-full min-h-11 px-3 rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)] text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]";
const COLS = "md:grid md:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)] md:gap-x-4";

function Skeleton() {
  const sk = "kin-skel kin-skel--soft";
  return (
    <div aria-busy="true" aria-label="Đang tải danh sách lớp" className="mt-6 space-y-3">
      <div className={`h-11 rounded ${sk}`} />
      {[0, 1, 2, 3].map(i => <div key={i} className={`h-[62px] rounded ${sk}`} />)}
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
    <div className="px-4 md:px-10 pt-6 md:pt-8 pb-10 bg-[var(--kin-nen-trang)]">
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-6">
        <div className="min-w-0">
          <h1 className="text-[length:var(--kin-co-h2)] leading-9 font-medium tracking-[-0.01em] text-[var(--kin-chu-chinh)]">Lớp học</h1>
          <p className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">
            {rows ? `${all.length} lớp · ${totalStudents} học sinh đang học. ` : ""}Một nơi để theo dõi lịch, buổi dạy và học sinh của từng lớp.
          </p>
        </div>
        <Link href="/lop-cua-toi/lop/tao" className={`${kinButtonClass("primary")} self-start flex-shrink-0`}>Tạo lớp</Link>
      </header>

      {error && <ErrorStrip message="Không tải được danh sách lớp." onRetry={load} />}
      {rows === null ? (!error ? <Skeleton /> : null) : all.length === 0 ? (
        <KinEmptyState title="Cô chưa mở lớp nào" action={<Link href="/admin/khoa-hoc?tao=1" className={kinButtonClass("primary")}>Tạo lớp đầu tiên</Link>}>
          Tạo lớp đầu tiên, rồi gửi mã mời cho học sinh vào lớp. Lớp có lịch và học sinh sẽ hiện thành bảng ở đây.
        </KinEmptyState>
      ) : (
        <>
          <div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,440px)_230px_230px]" role="search" aria-label="Tìm và lọc lớp">
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

          <div className="mt-6">
            <div aria-hidden className={`hidden ${COLS} px-[var(--kin-kc-6)] h-11 items-center bg-[var(--kin-nen-bang)] text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]`}>
              <span>Lớp</span><span>Học sinh</span><span>Lịch cố định</span><span>Tiến độ</span><span>Thao tác</span>
            </div>
            {shown.length === 0 ? (
              <KinEmptyState title="Không có lớp nào khớp" action={<button type="button" className={kinButtonClass("secondary")} onClick={() => { setQ(""); setCategory(""); setStatus(""); }}>Xoá bộ lọc</button>}>
                Thử đổi từ khoá, môn học hoặc trạng thái để thấy các lớp còn lại.
              </KinEmptyState>
            ) : (
              <ul aria-label="Danh sách lớp">
                {shown.map(c => {
                  const empty = c.students === 0;
                  return (
                    <li key={c.id} className={`${COLS} flex flex-col gap-1 px-[var(--kin-kc-6)] py-[var(--kin-kc-6)] md:items-center border-b border-[var(--kin-vien-nhat)] text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]`}>
                      <div className="min-w-0">
                        <Link href={`/lop-cua-toi/${c.id}`} className="inline-flex items-center min-h-11 md:min-h-0 font-medium break-words hover:underline">{c.name}</Link>
                        {(c.classStatus !== "open" || c.hidden) && (
                          <p className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">{CLASS_STATUS_LABEL[c.classStatus] ?? c.classStatus}{c.hidden ? " · đang ẩn" : ""}</p>
                        )}
                      </div>
                      <p className="tabular-nums"><span className="md:hidden text-[var(--kin-chu-mo)]">Học sinh: </span>{c.students}{c.capacity != null ? `/${c.capacity}` : ""}</p>
                      <p className={c.schedule ? "tabular-nums" : "text-[var(--kin-chu-mo)]"}>{c.schedule ?? "Chưa xếp lịch"}</p>
                      <p className={c.sessionsTaught > 0 ? "tabular-nums" : "text-[var(--kin-chu-mo)]"}>{c.sessionsTaught > 0 ? `${c.sessionsTaught} buổi đã điểm danh` : "Chưa bắt đầu"}</p>
                      <div>
                        {empty
                          ? <Link href={`/lop-cua-toi/${c.id}?tab=ma-moi`} className="inline-flex items-center min-h-11 md:min-h-0 text-[var(--kin-nhan-link)] hover:underline">{`Mời học sinh →`}</Link>
                          : <Link href={`/lop-cua-toi/${c.id}`} aria-label={`Mở lớp ${c.name}`} className="inline-flex items-center min-h-11 md:min-h-0 text-[var(--kin-nhan-link)] hover:underline">Mở lớp →</Link>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="mt-8 grid lg:grid-cols-[minmax(0,1fr)_354px] gap-x-8 gap-y-8 items-start">
            <KinCallout title="Điểm danh và học phí đi cùng nhau">
              Điểm danh được lưu riêng cho từng buổi. Mở một lớp để điểm danh, xem học sinh và mã mời của lớp đó; học phí theo dõi ở mục Học phí.
            </KinCallout>
            {noStudents && (
              <section aria-labelledby="lop-empty">
                <KinSectionHead id="lop-empty" title={`${noStudents.name} chưa có học sinh`} />
                <p className="pt-4 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">Mời bằng mã lớp để học sinh tự vào, hoặc thêm từ danh sách để bắt đầu lên lịch.</p>
                <Link href={`/lop-cua-toi/${noStudents.id}?tab=ma-moi`} className={`${kinButtonClass("secondary")} mt-4`}>Mời học sinh vào {noStudents.name}</Link>
              </section>
            )}
          </div>
          <p className="mt-8 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Hiển thị {shown.length}/{all.length} lớp{filtering ? " theo bộ lọc" : ""}.</p>
        </>
      )}
    </div>
  );
}
