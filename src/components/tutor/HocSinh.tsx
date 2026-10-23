// Học sinh của gia sư (Figma "Gia sư · Học sinh" 299:113083): tiêu đề + "Thêm học sinh"; ô tìm và lọc theo lớp; tab Đang học / Đã nghỉ;
// danh sách (máy tính: các cột Học sinh · Lớp · Liên hệ · Ghi danh; điện thoại: mỗi em một dòng xếp dọc, không cuộn ngang).
// Chỉ học sinh trong lớp của chính gia sư, chỉ các trường trang lớp đã hiện. Cột "Phụ huynh · Zalo" và "Báo cáo gần nhất" của Figma
// CHƯA có nguồn dữ liệu ở trang lớp nên không dựng (không bịa số liệu, không thu thêm dữ liệu trẻ em).
// Lỗi tải: dải lỗi có "Thử lại". Đang tải: khung xương. Rỗng: có lời giải thích + nút đi tiếp.
"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { TutorStudentRow } from "@/lib/tutorStudentsServer";
import { ErrorStrip } from "@/components/kin/shell/Outlook";
import { kinButtonClass } from "@/components/kin/Button";
import { KinTabs } from "@/components/kin/Tabs";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { KinCallout } from "@/components/kin/Callout";

type TabKey = "active" | "suspended";
const COLS = "md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,0.8fr)_auto]";
const FIELD = "w-full min-h-11 px-3 rounded-lg text-[length:var(--kin-co-goc)] bg-[var(--kin-nen-trang)] text-[var(--kin-chu-chinh)] border border-[var(--kin-vien-o-nhap)] focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)]";

function Skeleton() {
  const sk = "kin-skel kin-skel--soft";
  return (
    <div aria-busy="true" aria-label="Đang tải danh sách học sinh" className="mt-6 space-y-3">
      <div className={`h-11 rounded ${sk}`} />
      {[0, 1, 2, 3].map(i => <div key={i} className={`h-[62px] rounded ${sk}`} />)}
    </div>
  );
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

export default function HocSinh() {
  const [rows, setRows] = useState<TutorStudentRow[] | null>(null);
  const [error, setError] = useState(false);
  const [q, setQ] = useState("");
  const [courseId, setCourseId] = useState("");
  const [tab, setTab] = useState<TabKey>("active");

  const load = useCallback(() => {
    fetch("/api/tutor/hoc-sinh", { credentials: "same-origin", cache: "no-store" })
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(d => { setRows(Array.isArray(d.students) ? d.students : []); setError(false); })
      .catch(() => setError(true));
  }, []);
  useEffect(() => { load(); }, [load]);

  const all = useMemo(() => rows ?? [], [rows]);
  const courses = useMemo(() => [...new Map(all.map(r => [r.courseId, r.courseName])).entries()], [all]);
  const countOf = (s: TabKey) => new Set(all.filter(r => r.status === s).map(r => r.userId)).size;
  const needle = q.trim().toLowerCase();
  const shown = all.filter(r => r.status === tab && (!courseId || r.courseId === courseId)
    && (!needle || [r.name, r.email, r.phone ?? "", r.school ?? ""].some(v => v.toLowerCase().includes(needle))));
  const nActive = countOf("active");

  return (
    <div className="px-4 md:px-10 pt-6 md:pt-8 pb-10 bg-[var(--kin-nen-trang)]">
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-6">
        <div className="min-w-0">
          <h1 className="text-[length:var(--kin-co-h2)] leading-9 font-medium tracking-[-0.01em] text-[var(--kin-chu-chinh)]">Học sinh</h1>
          <p className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">
            {rows ? `${nActive} học sinh đang học · ` : ""}Chỉ gồm học sinh trong các lớp của bạn.
          </p>
        </div>
        <Link href="/lop-cua-toi/lop" className={`${kinButtonClass("primary")} self-start flex-shrink-0`}>Thêm học sinh</Link>
      </header>

      {error && <ErrorStrip message="Không tải được danh sách học sinh." onRetry={load} />}
      {rows === null ? (!error ? <Skeleton /> : null) : rows.length === 0 ? (
        <KinEmptyState title="Chưa có học sinh nào trong lớp của bạn"
          action={<Link href="/lop-cua-toi/lop" className={kinButtonClass("secondary")}>Mở danh sách lớp</Link>}>
          Khi học sinh vào lớp bằng mã mời (hoặc bạn thêm em vào lớp), em sẽ hiện ở đây. Mã mời nằm trong từng lớp.
        </KinEmptyState>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
            <label className="block min-w-0">
              <span className="block mb-1.5 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">Tìm học sinh</span>
              <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Nhập tên, email, số liên hệ…" className={FIELD} />
            </label>
            <label className="block min-w-0">
              <span className="block mb-1.5 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">Lớp</span>
              <select value={courseId} onChange={e => setCourseId(e.target.value)} className={FIELD}>
                <option value="">Tất cả lớp</option>
                {courses.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </label>
          </div>

          <KinTabs className="mt-6" label="Trạng thái học" value={tab} onChange={setTab}
            tabs={[{ key: "active", label: `Đang học · ${nActive}` }, { key: "suspended", label: `Đã nghỉ · ${countOf("suspended")}` }]} />

          {shown.length === 0 ? (
            <KinEmptyState title={needle || courseId ? "Không có em nào khớp" : tab === "active" ? "Chưa có em nào đang học" : "Chưa có em nào đã nghỉ"}
              action={needle || courseId ? <button type="button" className={kinButtonClass("secondary")} onClick={() => { setQ(""); setCourseId(""); }}>Bỏ lọc</button> : undefined}>
              {needle || courseId ? "Thử đổi từ khoá hoặc chọn lại lớp." : tab === "active" ? "Học sinh đang học trong lớp của bạn sẽ hiện ở đây." : "Em tạm dừng hoặc hết hạn gói sẽ chuyển sang mục này."}
            </KinEmptyState>
          ) : (
            <div className="mt-4">
              <div aria-hidden className={`hidden md:grid ${COLS} gap-4 px-3 py-3 bg-[var(--kin-nen-bang)] text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]`}>
                <span>Học sinh</span><span>Lớp</span><span>Liên hệ</span><span>Ghi danh</span><span className="w-20" />
              </div>
              <ul aria-label="Danh sách học sinh">
                {shown.map(r => (
                  <li key={r.key} data-hoc-sinh className={`grid ${COLS} gap-x-4 gap-y-1 px-3 py-4 items-center border-b border-[var(--kin-vien-nhat)] text-[length:var(--kin-co-goc)] leading-5`}>
                    <div className="min-w-0">
                      <p className="text-[var(--kin-chu-chinh)] break-words">{r.name}</p>
                      {r.school && <p className="text-[var(--kin-chu-mo)] break-words">{r.school}</p>}
                    </div>
                    <p className="text-[var(--kin-chu-chinh)] break-words">{r.courseName}</p>
                    <div className="min-w-0 text-[var(--kin-chu-mo)] break-words">
                      {r.phone && <a href={`tel:${r.phone}`} className="block min-h-6 text-[var(--kin-nhan-link)] underline">{r.phone}</a>}
                      <p className="break-all">{r.email}</p>
                    </div>
                    <p className="text-[var(--kin-chu-mo)] tabular-nums">Ghi danh {fmtDate(r.enrolledAt)}</p>
                    <Link href={`/lop-cua-toi/${r.courseId}`} aria-label={`Mở lớp ${r.courseName} của ${r.name}`}
                      className="inline-flex items-center min-h-11 text-[var(--kin-nhan-link)] underline md:w-20">Mở lớp</Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <KinCallout className="mt-8" title="Thông tin chỉ mình bạn thấy">
            Tên và liên hệ học sinh chỉ hiện với gia sư của lớp, không đưa lên hồ sơ công khai.
          </KinCallout>
        </>
      )}
    </div>
  );
}
