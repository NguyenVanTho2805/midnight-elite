// "Điểm" của học sinh theo bản chốt SCL-G (QUYET-DINH-GIAO-DIEN §2.1, §3.5, §3.6; khung 3 "Học sinh · Điểm"): mỗi lớp một nhóm hàng mảnh —
// đầu nhóm: chấm màu lớp + tên lớp + "Trung bình 8,8/10" (chỉ tính bài ĐÃ CHẤM). Trên: bài còn chờ (Chưa nộp / Chờ chấm / Chờ gia sư duyệt — KHÔNG hiện số,
// máy chủ cũng không gửi số, R4). Dưới: nhóm "Đã xong" ghi điểm quy về thang 10 ("8,5/10"). Trạng thái luôn có chữ + hình (KinGradeStatus).
// Dữ liệu: /api/student/ket-qua (cùng hàm thuần với sổ điểm gia sư, src/lib/soDiem.ts). `courseId` = chỉ một lớp.
"use client";
import { useCallback, useEffect, useState } from "react";
import { ErrorStrip } from "@/components/kin/shell/Outlook";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { KinListRow } from "@/components/kin/ListRow";
import { KinGradeStatus, type GradeState } from "@/components/kin/Status";
import { KIND_LABEL, STUDENT_LABEL, type CellState, type ColumnKind } from "@/lib/soDiem";
import { classAccent } from "@/lib/classColor";
import { average10, on10 } from "@/lib/studentClassPage";

type Item = { id: string; kind: ColumnKind; title: string; max: number; state: CellState; score: number | null };
type Klass = { courseId: string; courseName: string; items: Item[] };
const GOC = "text-[length:var(--kin-co-goc)]";

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
      <KinListRow size="lg" title={i.title} sub={KIND_LABEL[i.kind]}
        aside={i.state === "da-cham" && i.score !== null
          ? <span data-diem className="text-[length:var(--kin-co-tieu-de)] font-semibold text-[var(--kin-chu-chinh)]">{on10(i.score, i.max)}<span className={`${GOC} font-normal text-[var(--kin-chu-phu)]`}>/10</span></span>
          : <KinGradeStatus state={i.state as GradeState}>{STUDENT_LABEL[i.state]}</KinGradeStatus>} />
    </li>
  );
  return (
    <div data-ket-qua className="space-y-8">
      {classes.map(c => {
        const avg = average10(c.items);
        const open = c.items.filter(i => i.state !== "da-cham");
        const done = c.items.filter(i => i.state === "da-cham");
        return (
          <section key={c.courseId} id={`lop-${c.courseId}`} aria-labelledby={`diem-${c.courseId}`} data-diem-lop={c.courseId} className="scroll-mt-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pb-2 border-b border-[var(--kin-vien-nhat)]">
              <span aria-hidden className="w-2.5 h-2.5 rounded-[var(--kin-bo-tron)] flex-shrink-0" style={{ background: classAccent(c.courseId) }} />
              <h2 id={`diem-${c.courseId}`} className="min-w-0 flex-1 text-[length:var(--kin-co-body)] leading-6 font-semibold text-[var(--kin-chu-chinh)] [overflow-wrap:anywhere]">{c.courseName}</h2>
              <p data-trung-binh className={`${GOC} text-[var(--kin-chu-phu)]`}>
                {avg ? <>Trung bình <b className="text-[length:var(--kin-co-body)] text-[var(--kin-chu-chinh)]">{avg}</b>/10</> : "Chưa có bài nào có điểm"}
              </p>
            </div>
            {open.length > 0 && <ul aria-label={`Bài còn chờ của lớp ${c.courseName}`}>{open.map(row)}</ul>}
            {done.length > 0 && (
              <>
                <h3 className={`mt-4 ${GOC} font-semibold text-[var(--kin-chu-phu)]`}>Đã xong</h3>
                <ul aria-label={`Bài đã xong của lớp ${c.courseName}`} className="mt-1 border-t border-[var(--kin-vien-nhat)]">{done.map(row)}</ul>
              </>
            )}
          </section>
        );
      })}
      <p className={`${GOC} text-[var(--kin-chu-phu)]`}>&ldquo;Chờ gia sư duyệt&rdquo;: bài đã có điểm, điểm sẽ hiện khi gia sư chủ nhiệm xác nhận.</p>
    </div>
  );
}
