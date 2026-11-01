// Ô trả lời theo loại câu. Đáp án ≥52px (token --kin-cham-dap-an), Đúng–Sai ≥48px, ô điền 52px; đang chọn = viền Navy 2px + nền nhạt + dấu ✓ (không chỉ đổi màu chữ).
// `reveal` chỉ có khi máy chủ đã trả đáp án (luyện tập, sau khi xem đáp án): giao diện KHÔNG tự suy ra đáp án từ dữ liệu nào khác.
"use client";
import type { ExamQuestionPublic } from "@/lib/api";
import { MathText } from "@/components/MathText";
import { FormulaBar } from "@/components/exam/FormulaBar";
import { draftStatusLabel, type DraftState } from "@/lib/quizRoom";

export interface Reveal { correctIds: Set<string>; truths: Map<string, boolean>; correctText: string | null }
export interface AnswerInputsProps {
  q: ExamQuestionPublic; locked: boolean; selected?: string; text: string; cluster: Record<string, boolean | null>; textStatus?: DraftState;
  onSelect: (optionId: string) => void; onBool: (optionId: string, value: boolean) => void; onText: (t: string) => void; onBlur: () => void;
  reveal?: Reveal | null;
}
const BORDER = "1px solid var(--kin-vien-thuong)";
const FOCUS = "focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--kin-nhan-link)]";
const FIELD = "w-full px-3 text-[length:var(--kin-co-small)] rounded-[var(--kin-bo-md)] outline-none focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)] disabled:cursor-not-allowed";

function Choice({ on, locked, mark, correct, input, children }: { on: boolean; locked: boolean; mark: string; correct?: boolean; input: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className={`flex items-center gap-3 px-4 min-h-[var(--kin-cham-dap-an)] rounded-[var(--kin-bo-md)] ${FOCUS} ${locked ? "cursor-not-allowed" : "cursor-pointer hover:bg-[var(--kin-nen-bang)]"}`}
      style={{ border: `${on ? 2 : 1}px solid ${on ? "var(--kin-nhan-nen)" : "var(--kin-vien-thuong)"}`, background: on ? "var(--kin-nen-nhan)" : undefined }}>
      {input}
      <span aria-hidden className="font-mono w-5 flex-shrink-0 text-[length:var(--kin-co-small)]" style={{ color: on ? "var(--kin-th-navy)" : "var(--kin-chu-mo)" }}>{mark}</span>
      <span className="flex-1 min-w-0 text-[length:var(--kin-co-small)] text-[var(--kin-chu-phu)]">{children}</span>
      {correct && <span className="flex-shrink-0 text-[length:var(--kin-co-caption)] font-semibold" style={{ color: "var(--kin-tt-chu-xong)" }}>✓ Đáp án đúng</span>}
      {on && <span aria-hidden className="flex-shrink-0 font-semibold" style={{ color: "var(--kin-th-navy)" }}>✓</span>}
    </label>
  );
}

export default function AnswerInputs(p: AnswerInputsProps) {
  const { q, locked, reveal } = p;
  const labelId = `q-${q.id}-de`;
  if (q.type === "ESSAY") {
    return (
      <div>
        {q.studentGuide && <p className="mb-2 text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)] whitespace-pre-line">{q.studentGuide}</p>}
        <FormulaBar areaId={`q-${q.id}-area`} value={p.text} onChange={p.onText} disabled={locked} />
        <textarea id={`q-${q.id}-area`} aria-labelledby={labelId} aria-describedby={`q-${q.id}-nhap`} rows={6} disabled={locked} placeholder="Nhập câu trả lời của em..."
          className={`${FIELD} py-2.5`} style={{ border: BORDER }} value={p.text} onChange={e => p.onText(e.target.value)} onBlur={p.onBlur} />
        <p id={`q-${q.id}-nhap`} role="status" data-trang-thai-nhap className="mt-1.5 text-[length:var(--kin-co-caption)]"
          style={{ color: p.textStatus?.kind === "failed" ? "var(--kin-tt-chu-loi)" : p.textStatus?.kind === "saved" ? "var(--kin-tt-chu-xong)" : "var(--kin-chu-mo)" }}>
          {draftStatusLabel(p.textStatus ?? { kind: "idle" })}
        </p>
        <p className="mt-0.5 text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)]">Cần đính kèm? Dán đường link vào bài viết. Bản nháp không phải bài đã nộp.</p>
      </div>
    );
  }
  if (q.type === "SHORT_ANSWER") {
    return (
      <div>
        <input aria-labelledby={labelId} disabled={locked} placeholder="Nhập đáp án..." className={`${FIELD} min-h-[var(--kin-cham-dap-an)]`} style={{ border: BORDER }}
          value={p.text} onChange={e => p.onText(e.target.value)} onBlur={p.onBlur} />
        {reveal?.correctText != null && <p className="mt-2 text-[length:var(--kin-co-small)] font-semibold" style={{ color: "var(--kin-tt-chu-xong)" }}>Đáp án đúng: {reveal.correctText}</p>}
      </div>
    );
  }
  if (q.type === "MC_MULTI") {
    return (
      <div role="group" aria-labelledby={labelId} className="flex flex-col gap-[10px]">
        <p className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">Chọn tất cả các đáp án đúng. Chọn đúng và đủ thì được trọn điểm; thiếu hoặc thừa thì 0 điểm.</p>
        {q.options.map((o, i) => {
          const on = p.cluster[o.id] === true;
          return (
            <Choice key={o.id} on={on} locked={locked} mark={on ? "☑" : "☐"} correct={reveal?.correctIds.has(o.id)}
              input={<input type="checkbox" className="sr-only" disabled={locked} checked={on} onChange={() => p.onBool(o.id, !on)} />}>
              <span className="font-mono mr-2 text-[var(--kin-chu-mo)]">{String.fromCharCode(65 + i)}.</span><MathText text={o.text} />
            </Choice>
          );
        })}
      </div>
    );
  }
  if (q.type === "TRUE_FALSE_CLUSTER") {
    return (
      <div className="flex flex-col gap-2">
        {q.options.map(o => (
          <div key={o.id} className="flex items-center justify-between gap-3 px-4 py-2 rounded-[var(--kin-bo-md)]" style={{ border: BORDER, background: "var(--kin-nen-trang)" }}>
            <div className="flex-1 min-w-0 text-[length:var(--kin-co-small)] text-[var(--kin-chu-phu)]">
              <span className="font-mono mr-2 text-[var(--kin-chu-mo)]">{o.subLabel})</span><MathText text={o.text} />
              {reveal?.truths.has(o.id) && <p className="mt-1 text-[length:var(--kin-co-caption)] font-semibold" style={{ color: "var(--kin-tt-chu-xong)" }}>Đáp án: {reveal.truths.get(o.id) ? "Đúng" : "Sai"}</p>}
            </div>
            <div role="radiogroup" aria-label={`Ý ${o.subLabel}`} className="flex flex-shrink-0 rounded-[var(--kin-bo-md)] overflow-hidden" style={{ border: "1px solid var(--kin-vien-o-nhap)" }}>
              {([["Đúng", true], ["Sai", false]] as const).map(([name, val]) => {
                const on = p.cluster[o.id] === val;
                return (
                  <button key={name} type="button" role="radio" aria-checked={on} aria-label={name} disabled={locked} onClick={() => p.onBool(o.id, val)}
                    className="min-h-12 min-w-[52px] px-3 text-[length:var(--kin-co-small)] font-semibold disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--kin-nhan-link)]"
                    style={on ? { background: "var(--kin-nhan-nen)", color: "var(--kin-nhan-chu-tren-nen)" } : { background: "var(--kin-nen-trang)", color: "var(--kin-chu-mo)" }}>
                    {on ? "✓ " : ""}{name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div role="radiogroup" aria-labelledby={labelId} className="flex flex-col gap-[10px]">
      {q.options.map((o, i) => {
        const on = p.selected === o.id;
        return (
          <Choice key={o.id} on={on} locked={locked} mark={String.fromCharCode(65 + i)} correct={reveal?.correctIds.has(o.id)}
            input={<input type="radio" name={`q-${q.id}`} className="sr-only" disabled={locked} checked={on} onChange={() => p.onSelect(o.id)} />}>
            <MathText text={o.text} />
          </Choice>
        );
      })}
    </div>
  );
}
