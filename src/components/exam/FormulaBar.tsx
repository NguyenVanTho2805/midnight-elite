// Thanh công thức trên ô tự luận của học sinh (phòng quiz). Mỗi nút CHÈN CHỮ THUẦN vào ô nhập qua `onChange` sẵn có của phòng thi
// (cùng đường lưu nháp và nộp bài), không HTML thô, không tự gửi gì. Nút ≥ 44px; bấm nút không làm ô mất tiêu điểm.
"use client";
import { FORMULA_BUTTONS, applyFormula } from "@/lib/essayFormula";

export function FormulaBar({ areaId, value, onChange, disabled }: {
  /** id của <textarea> cần chèn chữ vào. */
  areaId: string; value: string; onChange: (v: string) => void; disabled?: boolean;
}) {
  return (
    <div role="toolbar" aria-label="Chèn ký hiệu vào bài viết" className="mb-2 flex flex-wrap items-center gap-2" data-formula-bar>
      {FORMULA_BUTTONS.map(b => (
        <button key={b.kind} type="button" disabled={disabled} aria-label={b.aria} title={b.aria}
          onMouseDown={e => e.preventDefault()}
          onClick={() => {
            const el = document.getElementById(areaId) as HTMLTextAreaElement | null;
            const r = applyFormula(value, el?.selectionStart ?? value.length, el?.selectionEnd ?? value.length, b.kind);
            if (r.value === value) return;
            onChange(r.value);
            requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(r.selStart, r.selEnd); });
          }}
          className="min-w-11 min-h-11 px-3 rounded-[var(--kin-bo-md)] text-[length:var(--kin-co-small)] font-semibold tabular-nums disabled:cursor-not-allowed disabled:opacity-60 hover:bg-[var(--kin-nen-bang)] focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)]"
          style={{ border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-chu-chinh)", background: "var(--kin-nen-trang)" }}>
          {b.label}
        </button>
      ))}
      <span className="text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)]">Chèn ký hiệu bằng chữ, em sửa lại được như chữ bình thường.</span>
    </div>
  );
}
