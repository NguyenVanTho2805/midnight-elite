// NV-185/186/189 — báo cáo tháng trên "Sổ của con". Mỗi môn có HAI thanh riêng: Nỗ lực và Năng lực (không cộng thành một
// con số, không thứ hạng). Năng lực in đủ 3 điểm gần nhất để thấy xu hướng; không bao giờ dùng màu đỏ cho năng lực.
// Mục "Điều chưa đạt tháng này" LUÔN có, kể cả khi rỗng. Trạng thái luôn kèm chữ, không chỉ màu.
import type { PartyReport } from "@/lib/monthlyReportServer";
import { EMPTY_UNMET_TEXT, fmtScore } from "@/lib/monthlyReport";

const TONE: Record<string, string> = { xong: "var(--kin-tt-chu-xong)", cho: "var(--kin-tt-chu-cho)", "trung-tinh": "var(--kin-chu-phu)" };
const monthLabel = (ym: string) => `${Number(ym.slice(5, 7))}/${ym.slice(0, 4)}`;

function Bar({ label, value, max, text, color }: { label: string; value: number | null; max: number; text: string; color: string }) {
  const pct = value === null ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span style={{ color: "var(--kin-chu-phu)" }}>{label}</span>
        <span className="font-semibold text-right" style={{ color: "var(--kin-chu-chinh)" }}>{text}</span>
      </div>
      <div className="h-1.5 rounded-full mt-1" style={{ background: "var(--kin-vien-nhat)" }} role="img" aria-label={`${label}: ${text}`}>
        <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export default function MonthlyReportCard({ report }: { report: PartyReport }) {
  return (
    <article className="py-1" aria-label={`Báo cáo tháng ${monthLabel(report.yearMonth)}`}>
      <header className="mb-3">
        <h3 className="font-semibold" style={{ color: "var(--kin-chu-chinh)" }}>Báo cáo tháng {monthLabel(report.yearMonth)}</h3>
        <p className="text-xs mt-0.5" style={{ color: "var(--kin-chu-phu)" }}>Gia sư {report.tutorName} đã duyệt</p>
      </header>

      <div className="space-y-4">
        {report.subjects.map(s => {
          const m = s.mastery;
          const scores = m.scores.length ? m.scores.map(fmtScore).join(" · ") : "";
          return (
            <section key={s.courseId} aria-label={s.courseName}>
              <p className="text-sm font-medium mb-2" style={{ color: "var(--kin-chu-chinh)" }}>{s.courseName}</p>
              <div className="space-y-2.5">
                <Bar label="Chuyên cần" value={s.attendance.ratio === null ? null : s.attendance.ratio * 100} max={100}
                  text={s.attendance.ratio === null ? "chưa có buổi điểm danh" : `${Math.round(s.attendance.ratio * 100)}% · ${s.attendance.sessions} buổi`} color="var(--kin-nhan-diem)" />
                <Bar label="Nỗ lực" value={s.effort} max={10} text={s.effort === null ? "chưa đo được" : `${s.effort}/10`} color="var(--kin-nhan-diem)" />
                <Bar label="Năng lực" value={m.value} max={10}
                  text={m.value === null ? "chưa có bài kiểm tra" : `${fmtScore(m.value)}/10${scores ? ` (${scores})` : ""}`} color={TONE[m.tone]} />
                <p className="text-xs font-semibold" style={{ color: TONE[m.tone] }}>{m.text}</p>
              </div>
            </section>
          );
        })}
      </div>

      <section className="mt-4 pt-3" style={{ borderTop: "1px solid var(--kin-vien-nhat)" }} aria-labelledby={`chua-dat-${report.yearMonth}-${report.tutorName}`}>
        <h4 id={`chua-dat-${report.yearMonth}-${report.tutorName}`} className="text-sm font-semibold mb-1.5" style={{ color: "var(--kin-chu-chinh)" }}>Điều chưa đạt tháng này</h4>
        {report.items.length === 0
          ? <p className="text-sm" style={{ color: "var(--kin-chu-phu)" }}>{EMPTY_UNMET_TEXT}</p>
          : <ul className="space-y-1.5 list-disc pl-5 text-sm" style={{ color: "var(--kin-chu-chinh)" }}>{report.items.map((it, i) => <li key={i}>{it.text}</li>)}</ul>}
      </section>
    </article>
  );
}
