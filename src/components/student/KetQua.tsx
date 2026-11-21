// SCL-C (P1-1, HS4) — "Kết quả" của học sinh: mỗi bài của lớp (bài tập nộp tệp, quiz, đề Azota) một dòng, điểm hoặc trạng thái bằng chữ.
// Điểm tự khai chưa được gia sư duyệt ghi rõ "Chờ gia sư duyệt". Dùng ở tab Kết quả của trang lớp (courseId) và trang /student/diem (mọi lớp).
"use client";
import { useCallback, useEffect, useState } from "react";
import { ErrorStrip } from "@/components/kin/shell/Outlook";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { KinStatus, type StatusTone } from "@/components/kin/Status";
import { KIND_LABEL, STUDENT_LABEL, type CellState, type ColumnKind } from "@/lib/soDiem";
import { fmtScore } from "@/lib/studentTodo";

type Item = { id: string; kind: ColumnKind; title: string; max: number; state: CellState; score: number | null };
type Klass = { courseId: string; courseName: string; items: Item[] };
const TONE: Record<CellState, StatusTone> = { "chua-nop": "mo", "cho-cham": "cho", "cho-duyet": "cho", "da-cham": "xong" };

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
  return (
    <div data-ket-qua className="space-y-8">
      {classes.map(c => (
        <section key={c.courseId} aria-label={`Kết quả lớp ${c.courseName}`}>
          {!courseId && <KinSectionHead title={c.courseName} aside={`${c.items.length} bài`} />}
          <ul className="mt-3 border-t border-[var(--kin-vien-nhat)]">
            {c.items.map(i => (
              <li key={i.id} data-ket-qua-hang={i.state} className="flex items-start justify-between gap-4 py-3 border-b border-[var(--kin-vien-nhat)] text-[length:var(--kin-co-goc)]">
                <div className="min-w-0">
                  <p className="text-[var(--kin-chu-chinh)] [overflow-wrap:anywhere]">{i.title}</p>
                  <p className="text-[var(--kin-chu-mo)]">{KIND_LABEL[i.kind]}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0 text-right">
                  {i.score !== null && <span className="tabular-nums font-medium text-[var(--kin-chu-chinh)]">{fmtScore(i.score)}/{fmtScore(i.max)}</span>}
                  <KinStatus tone={TONE[i.state]}>{STUDENT_LABEL[i.state]}</KinStatus>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
