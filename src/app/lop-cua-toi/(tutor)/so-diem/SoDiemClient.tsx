"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KinButton, KinEmptyState, KinStat, KinStatRow } from "@/components/kin";
import { Badge, CARD_STYLE, FIELD_STYLE, callApi } from "@/components/tutor/shared";
import { fmtScore } from "@/lib/monthlyReport";
import { summariseClasses, type ClassSummary, type GradeRow } from "@/lib/gradebook";
import { vnMonthKey } from "@/lib/revenue";

interface Data { yearMonth: string; rows: GradeRow[]; classes: ClassSummary[]; truncated: boolean }
const monthLabel = (ym: string) => `Tháng ${Number(ym.slice(5, 7))}/${ym.slice(0, 4)}`;
const shift = (ym: string, n: number) => { const y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)) - 1 + n; return `${y + Math.floor(m / 12)}-${String(((m % 12) + 12) % 12 + 1).padStart(2, "0")}`; };
const pct = (r: number | null) => (r === null ? "Chưa có" : `${Math.round(r * 100)}%`);
const TONE: Record<string, "ok" | "wait" | "neutral"> = { dat: "ok", tut: "wait", "chua-dat": "wait", "chua-du": "neutral" };

export default function SoDiemClient() {
  const now = vnMonthKey(new Date());
  const [ym, setYm] = useState(now);
  const [course, setCourse] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const seq = useRef(0);

  const load = useCallback(async (m: string) => {
    await Promise.resolve();
    const my = ++seq.current;
    setLoading(true); setFailed(false);
    const r = await callApi<Data>(`/api/tutor/so-diem?yearMonth=${m}`);
    if (my !== seq.current) return;
    if (!r.ok) setFailed(true); else setData(r.data);
    setLoading(false);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(ym); }, [load, ym]);

  const rows = useMemo(() => (data?.rows ?? []).filter(r => !course || r.courseId === course), [data, course]);
  const classes = useMemo(() => summariseClasses(rows), [rows]);
  const courseOptions = data?.classes ?? [];

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-end gap-3 flex-wrap" role="group" aria-label="Chọn tháng và lớp">
        <KinButton variant="secondary" onClick={() => setYm(shift(ym, -1))} aria-label="Tháng trước">←</KinButton>
        <span className="font-bold min-w-28 text-center" style={{ color: "var(--kin-chu-chinh)" }}>{monthLabel(ym)}</span>
        <KinButton variant="secondary" disabled={ym >= now} onClick={() => setYm(shift(ym, 1))} aria-label="Tháng sau">→</KinButton>
        <label className="text-xs" style={{ color: "var(--kin-chu-phu)" }}>Lớp
          <select value={course} onChange={e => setCourse(e.target.value)} className="block mt-1 px-3 py-2 rounded-lg text-sm min-h-[44px]" style={FIELD_STYLE}>
            <option value="">Tất cả lớp</option>
            {courseOptions.map(c => <option key={c.courseId} value={c.courseId}>{c.courseName}</option>)}
          </select>
        </label>
      </div>

      {failed ? (
        <div role="alert" className="rounded-xl p-6 text-center text-sm" style={CARD_STYLE}>
          Không tải được sổ điểm. <button className="underline font-semibold min-h-[44px]" onClick={() => load(ym)}>Thử lại</button>
        </div>
      ) : loading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Đang tải">{[0, 1, 2].map(i => <div key={i} className="h-16 rounded-xl animate-pulse" style={CARD_STYLE} />)}</div>
      ) : rows.length === 0 ? (
        <KinEmptyState title="Chưa có học sinh để hiện">Sổ điểm chỉ hiện học sinh đang ghi danh ở lớp của bạn. Thêm học sinh vào lớp rồi quay lại.</KinEmptyState>
      ) : (<>
        {classes.map(c => (
          <section key={c.courseId} aria-labelledby={`h-${c.courseId}`} className="space-y-3">
            <h2 id={`h-${c.courseId}`} className="font-bold" style={{ color: "var(--kin-chu-chinh)" }}>{c.courseName} · {c.students} học sinh</h2>
            <KinStatRow className="md:!grid-cols-3">
              <KinStat label="Chuyên cần trung bình" value={c.attendanceAvgPct === null ? "Chưa có" : `${c.attendanceAvgPct}%`} />
              <KinStat label="Năng lực trung bình" value={c.masteryAvg === null ? "Chưa có" : fmtScore(c.masteryAvg)} hint={`${c.masteryCount}/${c.students} em có bài kiểm tra`} />
              <KinStat label="Bài về nhà đúng hạn" value={c.homeworkOnTimePct === null ? "Chưa giao bài" : `${c.homeworkOnTimePct}%`} />
            </KinStatRow>
            <ul className="space-y-2">
              {rows.filter(r => r.courseId === c.courseId).map(r => (
                <li key={r.studentId + r.courseId} className="rounded-xl px-4 py-3 grid gap-2 md:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,1fr))] md:items-center" style={CARD_STYLE}>
                  <div className="min-w-0">
                    <p className="font-medium truncate" style={{ color: "var(--kin-chu-chinh)" }}>{r.name}</p>
                    <p className="text-xs" style={{ color: "var(--kin-chu-phu)" }}>{r.progress.text}</p>
                  </div>
                  <p className="text-sm" style={{ color: "var(--kin-chu-chinh)" }}><span className="text-xs block" style={{ color: "var(--kin-chu-phu)" }}>Chuyên cần</span>{pct(r.attendance.ratio)}{r.attendance.sessions ? ` · ${r.attendance.sessions} buổi` : ""}</p>
                  <p className="text-sm" style={{ color: "var(--kin-chu-chinh)" }}><span className="text-xs block" style={{ color: "var(--kin-chu-phu)" }}>Bài về nhà</span>{r.homework.assigned ? `${r.homework.onTime}/${r.homework.assigned} đúng hạn` : "Chưa giao bài"}</p>
                  <div className="text-sm" style={{ color: "var(--kin-chu-chinh)" }}><span className="text-xs block" style={{ color: "var(--kin-chu-phu)" }}>Bài kiểm tra</span>
                    {r.mastery.value === null ? "Chưa có điểm" : `${fmtScore(r.mastery.value)} · `}<Badge tone={TONE[r.mastery.code] ?? "neutral"}>{r.mastery.text}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {data?.truncated && <p className="text-xs" style={{ color: "var(--kin-chu-phu)" }}>Chỉ hiện 200 học sinh đầu tiên.</p>}
      </>)}
    </div>
  );
}
