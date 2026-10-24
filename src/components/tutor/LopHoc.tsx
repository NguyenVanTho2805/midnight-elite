// "Lớp học" của gia sư (Figma "Gia sư · Lớp" 299:112349): H1 + dòng phụ + nút "Tạo lớp"; ô tìm + lọc môn/trạng thái;
// bảng dạng danh sách liên kết (Lớp · Học sinh · Lịch cố định · Tiến độ · Thao tác); ghi chú cuối bảng; cột phải nhắc lớp chưa có học sinh.
// Điện thoại: mỗi lớp là một khối một cột, nút ≥ 44px. Đang tải: khung xương. Lỗi: dải báo + "Thử lại". Rỗng: giải thích + đi tiếp.
// Dữ liệu: /api/tutor/lop ({ rows, totalStudents }). KHÔNG có cột "Cách tính phí": KiN chưa lưu cách tính phí theo lớp (xem tutorClassTable.ts).
"use client";
import { KinPanel } from "@/components/kin/Panel";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { filterClassRows, type TutorClassRow } from "@/lib/tutorClassTable";
import { CLASS_STATUS_LABEL } from "@/lib/tutorTodo";
import { ErrorStrip } from "@/components/kin/shell/Outlook";
import { kinButtonClass } from "@/components/kin/Button";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { KinCallout } from "@/components/kin/Callout";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { KinPage, KinPageHeader, KinTableSkeleton, KIN_TWO_COL, KIN_TABLE_HEAD, KIN_TABLE_ROW, KIN_FIELD } from "@/components/kin/PageLayout";

const FIELD = KIN_FIELD;
const COLS = "md:grid md:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)] md:gap-x-4";

function Skeleton() {
  return <KinTableSkeleton label="Đang tải danh sách lớp" />;
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
        <KinEmptyState title="Cô chưa mở lớp nào" action={<Link href="/admin/khoa-hoc?tao=1" className={kinButtonClass("primary")}>Tạo lớp đầu tiên</Link>}>
          Tạo lớp đầu tiên, rồi gửi mã mời cho học sinh vào lớp. Lớp có lịch và học sinh sẽ hiện thành bảng ở đây.
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

          <KinPanel flush className="mt-6">
            <div aria-hidden className={`hidden ${COLS} ${KIN_TABLE_HEAD}`}>
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
                    <li key={c.id} className={`${COLS} flex flex-col gap-1 ${KIN_TABLE_ROW} text-[var(--kin-chu-chinh)]`}>
                      <div className="min-w-0">
                        <Link href={`/lop-cua-toi/${c.id}`} className="inline-flex items-center min-h-11 md:min-h-0 font-medium break-words hover:underline">{c.name}</Link>
                        {(c.classStatus !== "open" || c.hidden) && (
                          <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">{CLASS_STATUS_LABEL[c.classStatus] ?? c.classStatus}{c.hidden ? " · đang ẩn" : ""}</p>
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
          </KinPanel>

          <div className={`mt-8 ${KIN_TWO_COL}`}>
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
    </KinPage>
  );
}
