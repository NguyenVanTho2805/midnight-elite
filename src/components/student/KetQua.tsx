// "Điểm" của học sinh theo bản chốt SCL-G (QUYET-DINH-GIAO-DIEN §2.1, §3.5, §3.6, §4.1 #5; khung 3 "Học sinh · Điểm"): mỗi lớp một khối viền mảnh —
// đầu khối: chấm màu lớp + tên lớp + "Trung bình 8,8/10" (chỉ tính bài ĐÃ CHẤM). Hàng: bài đang chờ (Chờ chấm / Chờ gia sư duyệt — KHÔNG hiện số, máy chủ cũng
// không gửi số, R4) rồi bài đã có điểm ("8,5/10"). Dòng 2 luôn ghi ngày: "Chấm thứ Bảy 14/11" / "Nộp thứ Sáu 20/11". Bài tập: cả hàng là link tới bài (có chevron).
// Bài CHƯA NỘP không liệt kê ở đây (đã có ở Cần làm, kèm đúng trạng thái Quá hạn): chỉ một dòng "Còn N bài chưa nộp · Xem ở Cần làm".
// Dữ liệu: /api/student/ket-qua (cùng hàm thuần với sổ điểm gia sư, src/lib/soDiem.ts). `courseId` = chỉ một lớp.
"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ErrorStrip } from "@/components/kin/shell/Outlook";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { KinListRow } from "@/components/kin/ListRow";
import { KinGradeStatus, type GradeState } from "@/components/kin/Status";
import { KIND_LABEL, STUDENT_LABEL, type CellState, type ColumnKind } from "@/lib/soDiem";
import { classAccent } from "@/lib/classColor";
import { average10, on10, resultDateLine } from "@/lib/studentClassPage";

type Item = { id: string; kind: ColumnKind; title: string; max: number; state: CellState; score: number | null; submittedAt?: string | null; gradedAt?: string | null; href?: string | null };
type Klass = { courseId: string; courseName: string; items: Item[] };
const GOC = "text-[length:var(--kin-co-goc)]";
const Chevron = () => <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--kin-chu-mo)]"><path d="M9 6l6 6-6 6" /></svg>;

export default function KetQua({ courseId }: { courseId?: string }) {
  const [data, setData] = useState<Klass[] | null>(null);
  const [error, setError] = useState(false);
  const load = useCallback(() => {
    fetch(`/api/student/ket-qua${courseId ? `?courseId=${encodeURIComponent(courseId)}` : ""}`, { credentials: "same-origin", cache: "no-store" })
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(d => { setData(Array.isArray(d.classes) ? d.classes : []); setError(false); })
      .catch(() => setError(true));
  }, [courseId]);
  useEffect(() => { load(); }, [load]);

  if (error) return <ErrorStrip message="Không tải được kết quả." onRetry={load} />;
  if (!data) return <div aria-busy="true" aria-label="Đang tải kết quả" className="kin-skel kin-skel--soft h-[180px] rounded" />;
  const classes = data.filter(c => c.items.length > 0);
  if (classes.length === 0) {
    return <KinEmptyState title="Chưa có bài nào để xem điểm">Khi gia sư giao bài tập, quiz hoặc đề cho lớp, điểm và trạng thái của bạn sẽ hiện ở đây.</KinEmptyState>;
  }
  const row = (i: Item) => (
    <li key={i.id} data-ket-qua-hang={i.state}>
      <KinListRow size="lg" href={i.href ?? undefined} title={i.title} sub={resultDateLine(i) || KIND_LABEL[i.kind]}
        aside={<>
          {i.state === "da-cham" && i.score !== null
            ? <span data-diem className="text-[length:var(--kin-co-tieu-de)] font-semibold text-[var(--kin-chu-chinh)]">{on10(i.score, i.max)}<span className={`${GOC} font-normal text-[var(--kin-chu-phu)]`}>/10</span></span>
            : <KinGradeStatus state={i.state as GradeState}>{STUDENT_LABEL[i.state]}</KinGradeStatus>}
          {i.href && <Chevron />}
        </>} />
    </li>
  );
  return (
    <div data-ket-qua className="space-y-4">
      {classes.map(c => {
        const avg = average10(c.items);
        const shown = [...c.items.filter(i => i.state === "cho-cham" || i.state === "cho-duyet"), ...c.items.filter(i => i.state === "da-cham")];
        const notYet = c.items.filter(i => i.state === "chua-nop").length;
        return (
          <section key={c.courseId} id={`lop-${c.courseId}`} aria-labelledby={`diem-${c.courseId}`} data-diem-lop={c.courseId}
            className="scroll-mt-4 rounded-[var(--kin-bo-the)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)] overflow-hidden">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-[var(--kin-kc-6)] py-3 border-b border-[var(--kin-vien-nhat)]">
              <span aria-hidden className="w-2.5 h-2.5 rounded-[var(--kin-bo-tron)] flex-shrink-0" style={{ background: classAccent(c.courseId) }} />
              <h2 id={`diem-${c.courseId}`} className="min-w-0 flex-1 text-[length:var(--kin-co-body)] leading-6 font-semibold text-[var(--kin-chu-chinh)] [overflow-wrap:anywhere]">{c.courseName}</h2>
              <p data-trung-binh className={`${GOC} text-[var(--kin-chu-phu)]`}>
                {avg ? <>Trung bình <b className="text-[length:var(--kin-co-body)] text-[var(--kin-chu-chinh)]">{avg}</b>/10</> : "Chưa có bài nào có điểm"}
              </p>
            </div>
            {shown.length > 0 && <ul aria-label={`Điểm của lớp ${c.courseName}`} className="[&>li:last-child>*]:border-b-0">{shown.map(row)}</ul>}
            {notYet > 0 && (
              <p data-chua-nop className={`px-[var(--kin-kc-6)] py-2 border-t border-[var(--kin-vien-nhat)] ${GOC} text-[var(--kin-chu-phu)]`}>
                Còn {notYet} bài chưa nộp · <Link href="/student/viec-cua-toi" className="inline-flex items-center min-h-11 text-[var(--kin-nhan-link)] underline">Xem ở Cần làm</Link>
              </p>
            )}
          </section>
        );
      })}
      <p className={`${GOC} text-[var(--kin-chu-phu)]`}>&ldquo;Chờ gia sư duyệt&rdquo;: bài đã có điểm, điểm sẽ hiện khi gia sư chủ nhiệm xác nhận.</p>
    </div>
  );
}
