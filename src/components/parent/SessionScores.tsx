// BU-11 — điểm từng buổi của ĐÚNG em này (phụ huynh mở link Sổ của con). Chỉ hiện khi gia sư đã ghi và đồng ý ghi điểm còn hiệu lực.
// Server component: không gọi thêm, không hiện gì khi chưa có điểm (không mục rỗng gây hiểu nhầm).
import ParentSection from "@/components/parent/Section";
import { KinStatus } from "@/components/kin/Status";
import { pctChip, scoreText } from "@/lib/sessionScore";
import type { PartyScore } from "@/lib/sessionScoreServer";

const ddmm = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}`;

export default function SessionScores({ items }: { items: PartyScore[] }) {
  if (items.length === 0) return null;
  return (
    <ParentSection id="h-diem-buoi" title="Điểm từng buổi">
      <ul className="divide-y divide-[color:var(--kin-vien-nhat)]" data-session-scores>
        {items.map((s, i) => (
          <li key={i} className="py-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span className="min-w-0 break-words" style={{ color: "var(--kin-chu-chinh)" }}>{s.courseName} · {ddmm(s.dateKey)}</span>
            <span className="flex flex-wrap items-center gap-3 text-sm">
              {s.score !== null && <span className="font-semibold tabular-nums" style={{ color: "var(--kin-chu-chinh)" }}>Điểm {scoreText(s.score)}/10</span>}
              {s.homeworkPct !== null && <KinStatus tone={pctChip(s.homeworkPct).tone}>{pctChip(s.homeworkPct).text}</KinStatus>}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs mt-2" style={{ color: "var(--kin-chu-mo)" }}>Chỉ anh/chị và gia sư của lớp xem được mục này.</p>
    </ParentSection>
  );
}
