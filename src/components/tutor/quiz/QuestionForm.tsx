// QZ-03 — trình soạn MỘT câu hỏi của gia sư (Figma 521:4667 "Soạn câu hỏi · Nhiều đáp án và tự luận"): cả 5 dạng câu, kiểm hợp lệ ngay lúc gõ,
// bên phải là bản "xem như học sinh" (không lộ đáp án đúng). Luật kiểm nằm ở src/lib/quizQuestion.ts và được MÁY CHỦ chạy lại khi lưu.
// Hướng dẫn chấm + tiêu chí chấm chỉ gia sư thấy: học sinh không nhận hai trường này ở bất kỳ API nào (applyAttemptOrder / review không trả).
"use client";
import { useMemo, useState } from "react";
import { KinButton } from "@/components/kin/Button";
import { KinCallout } from "@/components/kin/Callout";
import { KinStatus } from "@/components/kin/Status";
import { KIN_FIELD, KIN_LABEL } from "@/components/kin/PageLayout";
import { MathText } from "@/components/MathText";
import {
  describeValidity, fmtPoints, LIMITS, multiRuleText, normalizeRubric, QUIZ_QUESTION_TYPES, QUIZ_TYPE_LABEL, rubricTotal,
  type QuizQuestionInput, type QuizQuestionType, type RubricRow,
} from "@/lib/quizQuestion";
import type { QuizQ } from "./quizClient";

interface Opt { text: string; isCorrect: boolean; subLabel: string | null }
interface RubricDraft { name: string; requirement: string; points: string }

const LETTERS = ["a", "b", "c", "d"] as const;
const blankOptions = (type: QuizQuestionType): Opt[] => {
  if (type === "TRUE_FALSE_CLUSTER") return LETTERS.map(l => ({ text: "", isCorrect: false, subLabel: l }));
  if (type === "SHORT_ANSWER") return [{ text: "", isCorrect: true, subLabel: null }];
  if (type === "ESSAY") return [];
  return Array.from({ length: 4 }, () => ({ text: "", isCorrect: false, subLabel: null }));
};
const num = (s: string) => Number(s.replace(",", "."));

export interface QuestionFormProps {
  initial?: QuizQ | null;
  /** Chữ trên nút lưu (mặc định "Lưu câu hỏi"; bước rà soát nhập đề dùng "Xác nhận câu"). */
  saveLabel?: string;
  /** Trả chuỗi lỗi (hiện dưới nút Lưu) hoặc null nếu đã lưu xong. */
  onSave: (input: QuizQuestionInput) => Promise<string | null>;
  onCancel: () => void;
}

export default function QuestionForm({ initial, saveLabel = "Lưu câu hỏi", onSave, onCancel }: QuestionFormProps) {
  const [type, setType] = useState<QuizQuestionType>(initial?.type ?? "MC");
  const [text, setText] = useState(initial?.text ?? "");
  const [points, setPoints] = useState(initial ? String(initial.points).replace(".", ",") : "1");
  const [options, setOptions] = useState<Opt[]>(initial ? initial.options.map(o => ({ text: o.text, isCorrect: o.isCorrect, subLabel: o.subLabel })) : blankOptions("MC"));
  const [explanation, setExplanation] = useState(initial?.explanation ?? "");
  const [hint, setHint] = useState(initial?.hint ?? "");
  const [studentGuide, setStudentGuide] = useState(initial?.studentGuide ?? "");
  const [graderGuide, setGraderGuide] = useState(initial?.graderGuide ?? "");
  const [rubric, setRubric] = useState<RubricDraft[]>((initial?.rubric ?? []).map(r => ({ name: r.name, requirement: r.requirement, points: String(r.points).replace(".", ",") })));
  const [imageUrl] = useState(initial?.imageUrl ?? "");
  const [sectionLabel] = useState(initial?.sectionLabel ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  function changeType(next: QuizQuestionType) {
    if (next === type) return;
    const choiceLike = (t: QuizQuestionType) => t === "MC" || t === "MC_MULTI";
    setErr(null);
    if (choiceLike(type) && choiceLike(next)) {
      // Giữ chữ các lựa chọn; một đáp án thì chỉ giữ đáp án đúng đầu tiên.
      if (next === "MC") {
        let seen = false;
        setOptions(options.map(o => { const keep = o.isCorrect && !seen; if (o.isCorrect) seen = true; return { ...o, isCorrect: keep }; }));
      }
    } else {
      setOptions(blankOptions(next));
    }
    if (next === "ESSAY" && num(points) < 5) setPoints("10");
    setType(next);
  }

  const input: QuizQuestionInput = useMemo(() => ({
    type, text, points: num(points),
    imageUrl: imageUrl || null, explanation: explanation || null, hint: hint || null, sectionLabel: sectionLabel || null,
    studentGuide: type === "ESSAY" ? studentGuide || null : null, graderGuide: type === "ESSAY" ? graderGuide || null : null,
    rubric: type === "ESSAY" && rubric.length ? rubric.map(r => ({ name: r.name, requirement: r.requirement, points: num(r.points) })) : null,
    options: type === "ESSAY" ? [] : options.map(o => ({ text: o.text, isCorrect: o.isCorrect, subLabel: o.subLabel })),
  }), [type, text, points, imageUrl, explanation, hint, sectionLabel, studentGuide, graderGuide, rubric, options]);
  const validity = describeValidity(input);

  const setOpt = (i: number, patch: Partial<Opt>) => setOptions(options.map((o, k) => k === i ? { ...o, ...patch } : o));
  const toggleCorrect = (i: number) => {
    if (type === "MC") setOptions(options.map((o, k) => ({ ...o, isCorrect: k === i })));
    else setOpt(i, { isCorrect: !options[i].isCorrect });
  };

  async function save() {
    setSaving(true); setErr(null);
    const e = await onSave(input);
    setSaving(false);
    if (e) setErr(e);
  }

  const rubricRows = normalizeRubric(input.rubric ?? null);
  const rubricSum = rubricRows.ok ? rubricTotal(rubricRows.rows as RubricRow[]) : null;
  const ptsNum = num(points);

  return (
    <form onSubmit={e => { e.preventDefault(); void save(); }} className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] gap-x-8 gap-y-6 items-start" aria-label={initial ? "Sửa câu hỏi" : "Thêm câu hỏi"}>
      <div className="min-w-0 space-y-6">
        <div role="radiogroup" aria-label="Dạng câu hỏi" className="flex flex-wrap gap-2">
          {QUIZ_QUESTION_TYPES.map(t => (
            <button key={t} type="button" role="radio" aria-checked={t === type} onClick={() => changeType(t)}
              className={`min-h-11 px-4 rounded-[var(--kin-bo-md)] border text-[length:var(--kin-co-goc)] ${t === type ? "border-[var(--kin-nhan-nen)] bg-[var(--kin-nen-nhan)] font-semibold text-[var(--kin-chu-chinh)]" : "border-[var(--kin-vien-o-nhap)] text-[var(--kin-chu-mo)]"}`}>
              {QUIZ_TYPE_LABEL[t]}
            </button>
          ))}
        </div>

        <div className="grid sm:grid-cols-[minmax(0,1fr)_160px] gap-4">
          <div className="sm:col-span-2">
            <label htmlFor="qf-text" className={`${KIN_LABEL} mb-2`}>Nội dung câu hỏi *</label>
            <textarea id="qf-text" rows={4} className={`${KIN_FIELD} py-3 resize-y`} value={text} maxLength={LIMITS.text} onChange={e => setText(e.target.value)} aria-describedby="qf-text-hint" />
            <p id="qf-text-hint" className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Công thức viết trong $…$ (ví dụ $x^2 = 4$).</p>
          </div>
          <div>
            <label htmlFor="qf-points" className={`${KIN_LABEL} mb-2`}>Điểm tối đa</label>
            <input id="qf-points" inputMode="decimal" className={KIN_FIELD} value={points} onChange={e => setPoints(e.target.value)} />
          </div>
        </div>

        {(type === "MC" || type === "MC_MULTI") && (
          <fieldset className="min-w-0">
            <legend className="text-[length:var(--kin-co-tieu-de)] font-medium text-[var(--kin-chu-chinh)]">Lựa chọn và đáp án đúng</legend>
            <p className="mt-1 mb-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">
              {type === "MC" ? "Chọn đúng một đáp án đúng." : "Đánh dấu mọi đáp án đúng; học sinh được chọn nhiều ô."}
            </p>
            <ul className="space-y-3">
              {options.map((o, i) => (
                <li key={i} className={`flex items-center gap-3 px-3 rounded-[var(--kin-bo-md)] border ${o.isCorrect ? "border-[var(--kin-nhan-nen)] bg-[var(--kin-nen-nhan)]" : "border-[var(--kin-vien-o-nhap)]"}`}>
                  <input type={type === "MC" ? "radio" : "checkbox"} name="qf-correct" checked={o.isCorrect} onChange={() => toggleCorrect(i)}
                    aria-label={`Đáp án ${String.fromCharCode(65 + i)} là đáp án đúng`} className="w-5 h-5 flex-shrink-0" />
                  <span aria-hidden className="font-mono text-[var(--kin-chu-mo)] w-5 flex-shrink-0">{String.fromCharCode(65 + i)}</span>
                  <input aria-label={`Nội dung đáp án ${String.fromCharCode(65 + i)}`} className="flex-1 min-w-0 min-h-11 bg-transparent outline-none text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)] focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)]"
                    value={o.text} maxLength={LIMITS.option} onChange={e => setOpt(i, { text: e.target.value })} />
                  {o.isCorrect && <span className="text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-xong)] flex-shrink-0">Đúng</span>}
                  {options.length > 2 && (
                    <button type="button" aria-label={`Bỏ đáp án ${String.fromCharCode(65 + i)}`} onClick={() => setOptions(options.filter((_, k) => k !== i))}
                      className="min-w-11 min-h-11 flex-shrink-0 text-[var(--kin-chu-mo)] hover:text-[var(--kin-tt-chu-loi)]">×</button>
                  )}
                </li>
              ))}
            </ul>
            {options.length < LIMITS.maxOptions && (
              <KinButton type="button" variant="secondary" className="mt-3" onClick={() => setOptions([...options, { text: "", isCorrect: false, subLabel: null }])}>+ Thêm lựa chọn</KinButton>
            )}
            {type === "MC_MULTI" && <KinCallout title="Quy tắc điểm rõ ràng" className="mt-4">{multiRuleText(Number.isFinite(ptsNum) && ptsNum > 0 ? ptsNum : 0)}</KinCallout>}
          </fieldset>
        )}

        {type === "TRUE_FALSE_CLUSTER" && (
          <fieldset className="min-w-0">
            <legend className="text-[length:var(--kin-co-tieu-de)] font-medium text-[var(--kin-chu-chinh)]">Bốn ý Đúng/Sai</legend>
            <p className="mt-1 mb-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Mỗi ý học sinh tự chọn Đúng hoặc Sai. Điểm tính theo số ý đúng (thang của đề).</p>
            <ul className="space-y-3">
              {options.map((o, i) => (
                <li key={i} className="flex items-center gap-3 px-3 rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-o-nhap)]">
                  <span aria-hidden className="font-mono text-[var(--kin-chu-mo)] w-5 flex-shrink-0">{LETTERS[i]})</span>
                  <input aria-label={`Nội dung ý ${LETTERS[i]}`} className="flex-1 min-w-0 min-h-11 bg-transparent outline-none text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)] focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)]"
                    value={o.text} maxLength={LIMITS.option} onChange={e => setOpt(i, { text: e.target.value })} />
                  <div role="radiogroup" aria-label={`Ý ${LETTERS[i]} đúng hay sai`} className="flex flex-shrink-0 rounded-[var(--kin-bo-md)] overflow-hidden border border-[var(--kin-vien-o-nhap)]">
                    {([["Đúng", true], ["Sai", false]] as const).map(([name, val]) => (
                      <button key={name} type="button" role="radio" aria-checked={o.isCorrect === val} onClick={() => setOpt(i, { isCorrect: val })}
                        className={`min-h-11 min-w-14 px-3 text-[length:var(--kin-co-goc)] font-semibold ${o.isCorrect === val ? "bg-[var(--kin-nhan-nen)] text-[var(--kin-nhan-chu-tren-nen)]" : "bg-[var(--kin-nen-trang)] text-[var(--kin-chu-mo)]"}`}>{name}</button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </fieldset>
        )}

        {type === "SHORT_ANSWER" && (
          <div>
            <label htmlFor="qf-short" className={`${KIN_LABEL} mb-2`}>Đáp án đúng *</label>
            <input id="qf-short" className={KIN_FIELD} value={options[0]?.text ?? ""} maxLength={LIMITS.option} onChange={e => setOptions([{ text: e.target.value, isCorrect: true, subLabel: null }])} />
            <p className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">KiN so khớp chữ, không phân biệt hoa thường; dấu phẩy thập phân coi như dấu chấm. Sai một ký tự là không có điểm.</p>
          </div>
        )}

        {type === "ESSAY" && (
          <>
            <div>
              <label htmlFor="qf-sguide" className={`${KIN_LABEL} mb-2`}>Hướng dẫn cho học sinh</label>
              <textarea id="qf-sguide" rows={3} className={`${KIN_FIELD} py-3 resize-y`} value={studentGuide} maxLength={LIMITS.note} onChange={e => setStudentGuide(e.target.value)} />
              <p className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Học sinh đọc dòng này ngay dưới đề, ví dụ cách trình bày bài.</p>
            </div>
            <fieldset className="min-w-0">
              <legend className="text-[length:var(--kin-co-tieu-de)] font-medium text-[var(--kin-chu-chinh)]">Tiêu chí chấm tự luận</legend>
              <p className="mt-1 mb-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Không bắt buộc. Có tiêu chí thì tổng điểm các tiêu chí phải bằng điểm của câu.</p>
              <ul className="space-y-3">
                {rubric.map((r, i) => (
                  <li key={i} className="grid grid-cols-[minmax(0,1fr)_88px_44px] sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_88px_44px] gap-2 items-start">
                    <input aria-label={`Tên tiêu chí ${i + 1}`} placeholder="Tiêu chí" className={KIN_FIELD} value={r.name} maxLength={LIMITS.rubricName} onChange={e => setRubric(rubric.map((x, k) => k === i ? { ...x, name: e.target.value } : x))} />
                    <input aria-label={`Yêu cầu của tiêu chí ${i + 1}`} placeholder="Yêu cầu" className={`${KIN_FIELD} col-span-3 sm:col-span-1 order-last sm:order-none`} value={r.requirement} maxLength={LIMITS.rubricReq} onChange={e => setRubric(rubric.map((x, k) => k === i ? { ...x, requirement: e.target.value } : x))} />
                    <input aria-label={`Điểm của tiêu chí ${i + 1}`} inputMode="decimal" placeholder="Điểm" className={KIN_FIELD} value={r.points} onChange={e => setRubric(rubric.map((x, k) => k === i ? { ...x, points: e.target.value } : x))} />
                    <button type="button" aria-label={`Bỏ tiêu chí ${i + 1}`} onClick={() => setRubric(rubric.filter((_, k) => k !== i))} className="min-w-11 min-h-11 text-[var(--kin-chu-mo)] hover:text-[var(--kin-tt-chu-loi)]">×</button>
                  </li>
                ))}
              </ul>
              {rubric.length < LIMITS.rubricRows && (
                <KinButton type="button" variant="secondary" className="mt-3" onClick={() => setRubric([...rubric, { name: "", requirement: "", points: "" }])}>+ Thêm tiêu chí</KinButton>
              )}
              {rubric.length > 0 && rubricSum !== null && (
                <p className="mt-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Tổng các tiêu chí: {fmtPoints(rubricSum)} / {Number.isFinite(ptsNum) ? fmtPoints(ptsNum) : "?"} điểm</p>
              )}
            </fieldset>
            <div>
              <label htmlFor="qf-gguide" className={`${KIN_LABEL} mb-2`}>Hướng dẫn chấm · chỉ cô xem</label>
              <textarea id="qf-gguide" rows={3} className={`${KIN_FIELD} py-3 resize-y`} value={graderGuide} maxLength={LIMITS.note} onChange={e => setGraderGuide(e.target.value)} />
            </div>
            <KinCallout title="Không tự quy thành 0 điểm">
              Bài tự luận giữ “Chờ chấm” đến khi cô chấm. Học sinh không thấy hướng dẫn chấm hay tiêu chí chấm của cô.
            </KinCallout>
          </>
        )}

        {type !== "ESSAY" && (
          <div>
            <label htmlFor="qf-expl" className={`${KIN_LABEL} mb-2`}>Giải thích · cô đã rà soát</label>
            <textarea id="qf-expl" rows={3} className={`${KIN_FIELD} py-3 resize-y`} value={explanation} maxLength={LIMITS.note} onChange={e => setExplanation(e.target.value)} />
            <p className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Học sinh chỉ thấy khi quiz cho phép xem đáp án.</p>
          </div>
        )}
        {(type === "MC" || type === "SHORT_ANSWER") && (
          <div>
            <label htmlFor="qf-hint" className={`${KIN_LABEL} mb-2`}>Gợi ý khi chữa bài (không bắt buộc)</label>
            <textarea id="qf-hint" rows={2} className={`${KIN_FIELD} py-3 resize-y`} value={hint} maxLength={1000} onChange={e => setHint(e.target.value)} />
          </div>
        )}

        <div className="space-y-3">
          <KinStatus tone={validity.ok ? "xong" : "loi"}><span role="status">{validity.message}</span></KinStatus>
          {err && <p role="alert" className="text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">{err}</p>}
          <div className="flex flex-wrap gap-3">
            <KinButton type="button" variant="secondary" className="lg:hidden" onClick={() => setShowPreview(v => !v)} aria-expanded={showPreview}>{showPreview ? "Ẩn bản xem trước" : "Xem như học sinh"}</KinButton>
            <KinButton type="submit" variant="primary" loading={saving} loadingLabel="Đang lưu…" disabled={!validity.ok}>{saveLabel}</KinButton>
            <KinButton type="button" variant="ghost" onClick={onCancel}>Huỷ</KinButton>
          </div>
        </div>
      </div>

      <aside aria-label="Xem như học sinh" className={`${showPreview ? "" : "hidden"} lg:block min-w-0 rounded-[var(--kin-bo-md)] bg-[var(--kin-nen-bang)] p-6 lg:sticky lg:top-4`}>
        <h3 className="text-[length:var(--kin-co-tieu-de)] font-medium text-[var(--kin-chu-chinh)]">Xem như học sinh</h3>
        <p className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">{QUIZ_TYPE_LABEL[type]} · {Number.isFinite(ptsNum) ? fmtPoints(ptsNum) : "?"} điểm{type === "ESSAY" ? " · chấm thủ công" : ""}</p>
        <div className="mt-4 text-[length:var(--kin-co-body)] leading-relaxed text-[var(--kin-chu-chinh)] break-words">{text.trim() ? <MathText text={text} /> : <span className="text-[var(--kin-chu-mo)]">Nội dung câu hỏi sẽ hiện ở đây.</span>}</div>
        {type === "ESSAY" && studentGuide.trim() && <p className="mt-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)] whitespace-pre-line">{studentGuide}</p>}
        <div className="mt-4 space-y-2">
          {(type === "MC" || type === "MC_MULTI") && options.map((o, i) => (
            <div key={i} className="flex items-center gap-3 px-3 min-h-11 rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)] text-[length:var(--kin-co-goc)]">
              <span aria-hidden>{type === "MC" ? "○" : "☐"}</span>
              <span className="font-mono text-[var(--kin-chu-mo)]">{String.fromCharCode(65 + i)}.</span>
              <span className="min-w-0 break-words">{o.text.trim() ? <MathText text={o.text} /> : <span className="text-[var(--kin-chu-mo)]">…</span>}</span>
            </div>
          ))}
          {type === "TRUE_FALSE_CLUSTER" && options.map((o, i) => (
            <div key={i} className="flex items-center justify-between gap-3 px-3 min-h-11 rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)] text-[length:var(--kin-co-goc)]">
              <span className="min-w-0 break-words"><span className="font-mono text-[var(--kin-chu-mo)] mr-2">{LETTERS[i]})</span>{o.text.trim() ? <MathText text={o.text} /> : "…"}</span>
              <span aria-hidden className="text-[var(--kin-chu-mo)] flex-shrink-0">Đ / S</span>
            </div>
          ))}
          {type === "SHORT_ANSWER" && <div className="px-3 min-h-11 flex items-center rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)] text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Học sinh gõ đáp án ngắn…</div>}
          {type === "ESSAY" && <div className="px-3 py-3 min-h-24 rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)] text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Học sinh viết bài làm ở đây…</div>}
        </div>
        {type === "MC_MULTI" && <p className="mt-4 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Chọn tất cả các đáp án đúng. Chọn đúng và đủ thì được trọn điểm; thiếu hoặc thừa thì 0 điểm.</p>}
        <p className="mt-4 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Đáp án đúng{type === "ESSAY" ? ", hướng dẫn chấm và tiêu chí" : ""} không hiện ở bản học sinh.</p>
      </aside>
    </form>
  );
}
