// Bảng số câu: đã làm = viền liền + chấm, chưa = viền đứt, đánh dấu = cờ, đang xem = nền Navy. KHÔNG dựa vào màu một mình (mỗi ô có chữ đọc được).
"use client";
import { gridCell } from "@/lib/examRoomLib";

type CellState = "empty" | "answered" | "flagged" | "flagged-answered";

export interface GridQuestion { id: string; answered: boolean; flagged: boolean; practice?: "correct" | "wrong" | null }

export function Legend() {
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)]" aria-label="Chú giải">
      <li><span aria-hidden className="inline-block w-3 h-3 mr-1 align-middle rounded-[3px]" style={{ border: "1px solid var(--kin-nhan-nen)", background: "var(--kin-nen-nhan)" }} />Đã làm (viền liền, chấm)</li>
      <li><span aria-hidden className="inline-block w-3 h-3 mr-1 align-middle rounded-[3px]" style={{ border: "1px dashed var(--kin-vien-o-nhap)" }} />Chưa làm (viền đứt)</li>
      <li><span aria-hidden className="mr-1">⚑</span>Đánh dấu xem lại</li>
      <li><span aria-hidden className="inline-block w-3 h-3 mr-1 align-middle rounded-[3px]" style={{ background: "var(--kin-nhan-nen)" }} />Câu đang xem</li>
    </ul>
  );
}

const BOX: Record<CellState, { border: string; bg: string; color: string }> = {
  empty: { border: "1px dashed var(--kin-vien-o-nhap)", bg: "var(--kin-nen-trang)", color: "var(--kin-chu-mo)" },
  answered: { border: "1px solid var(--kin-nhan-nen)", bg: "var(--kin-nen-nhan)", color: "var(--kin-th-navy)" },
  flagged: { border: "1px dashed var(--kin-vien-o-nhap)", bg: "var(--kin-nen-trang)", color: "var(--kin-chu-chinh)" },
  "flagged-answered": { border: "1px solid var(--kin-nhan-nen)", bg: "var(--kin-nen-nhan)", color: "var(--kin-th-navy)" },
};

export default function QuestionGrid({ items, current, onPick, label = "Nhảy tới câu" }: { items: GridQuestion[]; current: number; onPick: (index: number) => void; label?: string }) {
  return (
    <nav aria-label={label} id="luoi-nhay-cau">
      <ul className="grid grid-cols-5 gap-2">
        {items.map((it, i) => {
          const on = i === current, cell = gridCell(i + 1, it.answered, it.flagged, on);
          const b = BOX[(it.flagged ? (it.answered ? "flagged-answered" : "flagged") : it.answered ? "answered" : "empty") as CellState];
          return (
            <li key={it.id}>
              <button type="button" onClick={() => onPick(i)} aria-label={it.practice ? `${cell.ariaLabel}, ${it.practice === "correct" ? "đúng" : "chưa đúng"}` : cell.ariaLabel} aria-current={on ? "true" : undefined}
                data-da-tra-loi={it.answered ? "1" : "0"} data-danh-dau={it.flagged ? "1" : "0"}
                className="relative w-full min-h-[44px] rounded-[var(--kin-bo-sm)] text-[length:var(--kin-co-small)] font-semibold tabular-nums"
                style={on ? { background: "var(--kin-nhan-nen)", color: "var(--kin-nhan-chu-tren-nen)", border: "2px solid var(--kin-nhan-nen)" } : { background: b.bg, color: b.color, border: b.border }}>
                {i + 1}
                {it.flagged && <span aria-hidden className="absolute top-0 right-[3px] text-[10px] leading-4">⚑</span>}
                {it.answered && !on && <span aria-hidden className="absolute bottom-[3px] right-[4px] w-[5px] h-[5px] rounded-full" style={{ background: "var(--kin-nhan-nen)" }} />}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
