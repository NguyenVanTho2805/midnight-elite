"use client";

import { useState, useEffect, useCallback, useRef, Fragment } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import PermissionGuard from "@/components/PermissionGuard";
import { PERMISSIONS } from "@/contexts/AuthContext";
import { AdminToast, useAdminToast } from "@/components/AdminToast";
import { api, type ExamFull, type ExamQuestionFull, type ExamQuestionInput, type ExamGuestAccessFull, type ExamAttemptAdminRow, type ExamAttemptAdminDetail, type QuestionType, type SaveToBankInput, type Difficulty } from "@/lib/api";
import { MathText } from "@/components/MathText";
import { QuestionBankPicker } from "@/components/QuestionBankPicker";

const EMPTY_OPTIONS = ["", "", "", ""];
const CLUSTER_LABELS = ["a", "b", "c", "d"] as const;

interface QuestionForm {
  type: QuestionType;
  text: string;
  imageUrl: string;
  points: string;
  explanation: string;
  sectionLabel: string; // tên Phần thi, tùy chọn — rỗng = không thuộc phần nào
  sectionMinutes: string; // số phút riêng cho Phần (giờ riêng HSA), tùy chọn — rỗng = không dùng
  options: string[]; // MC: N đáp án; TRUE_FALSE_CLUSTER: đúng 4 ý a-d; ESSAY: không dùng
  correctIndex: number; // chỉ MC
  clusterCorrect: boolean[]; // chỉ TRUE_FALSE_CLUSTER, length 4 khớp CLUSTER_LABELS
}

const INIT_FORM: QuestionForm = {
  type: "MC", text: "", imageUrl: "", points: "1", explanation: "", sectionLabel: "", sectionMinutes: "",
  options: [...EMPTY_OPTIONS], correctIndex: 0, clusterCorrect: [false, false, false, false],
};

function toForm(q: ExamQuestionFull): QuestionForm {
  const base = {
    type: q.type, text: q.text, imageUrl: q.imageUrl ?? "",
    points: String(q.points), explanation: q.explanation ?? "",
    sectionLabel: q.sectionLabel ?? "",
    sectionMinutes: q.sectionMinutes != null ? String(q.sectionMinutes) : "",
  };
  if (q.type === "TRUE_FALSE_CLUSTER") {
    const bySubLabel = new Map(q.options.map(o => [o.subLabel, o]));
    return {
      ...base,
      options: CLUSTER_LABELS.map(l => bySubLabel.get(l)?.text ?? ""),
      correctIndex: 0,
      clusterCorrect: CLUSTER_LABELS.map(l => !!bySubLabel.get(l)?.isCorrect),
    };
  }
  if (q.type === "ESSAY") {
    return { ...base, options: [], correctIndex: 0, clusterCorrect: [false, false, false, false] };
  }
  if (q.type === "SHORT_ANSWER") {
    return { ...base, options: [q.options[0]?.text ?? ""], correctIndex: 0, clusterCorrect: [false, false, false, false] };
  }
  return {
    ...base,
    options: q.options.map(o => o.text),
    correctIndex: Math.max(0, q.options.findIndex(o => o.isCorrect)),
    clusterCorrect: [false, false, false, false],
  };
}

function toInput(form: QuestionForm): ExamQuestionInput | null {
  if (!form.text.trim()) return null;
  const base = {
    text: form.text.trim(),
    type: form.type,
    imageUrl: form.imageUrl.trim() || undefined,
    points: Number(form.points) > 0 ? Number(form.points) : 1,
    explanation: form.explanation.trim() || undefined,
    sectionLabel: form.sectionLabel.trim() || null,
    sectionMinutes: Number(form.sectionMinutes) > 0 ? Number(form.sectionMinutes) : null,
  };

  if (form.type === "ESSAY") return { ...base, options: [] };

  if (form.type === "SHORT_ANSWER") {
    const answer = (form.options[0] ?? "").trim();
    if (!answer) return null;
    return { ...base, options: [{ text: answer, isCorrect: true }] };
  }

  if (form.type === "TRUE_FALSE_CLUSTER") {
    const options = CLUSTER_LABELS.map((label, idx) => ({
      text: (form.options[idx] ?? "").trim(),
      isCorrect: form.clusterCorrect[idx] ?? false,
      subLabel: label,
    }));
    if (options.some(o => !o.text)) return null;
    return { ...base, options };
  }

  const options = form.options.map(t => t.trim()).filter(Boolean);
  if (options.length < 2) return null;
  return { ...base, options: options.map((text, idx) => ({ text, isCorrect: idx === form.correctIndex })) };
}

// ─── DRAWER: thêm/sửa 1 câu hỏi ───────────────────────────────────────────────
function QuestionDrawer({ open, initial, onClose, onSave, saving }: {
  open: boolean;
  initial: QuestionForm | null;
  onClose: () => void;
  onSave: (form: QuestionForm) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<QuestionForm>(initial ?? INIT_FORM);
  useEffect(() => { if (open) setForm(initial ?? INIT_FORM); }, [open, initial]);

  function updateOption(idx: number, val: string) {
    const opts = [...form.options];
    opts[idx] = val;
    setForm({ ...form, options: opts });
  }
  function addOption() { setForm({ ...form, options: [...form.options, ""] }); }
  function removeOption(idx: number) {
    const opts = form.options.filter((_, i) => i !== idx);
    const correctIndex = form.correctIndex === idx ? 0 : form.correctIndex > idx ? form.correctIndex - 1 : form.correctIndex;
    setForm({ ...form, options: opts.length >= 2 ? opts : form.options, correctIndex });
  }

  return (
    <>
      {open && <div className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.3)" }} onClick={onClose} />}
      <div className="fixed top-0 right-0 bottom-0 z-50 bg-white overflow-y-auto shadow-2xl"
        style={{
          width: "min(560px, 100vw)",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.28s cubic-bezier(.4,0,.2,1)",
          pointerEvents: open ? "auto" : "none",
          visibility: open ? "visible" : "hidden",
        }}>
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "#e5e3df" }}>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 text-xl font-light">×</button>
            <h2 className="text-base font-bold" style={{ color: "#1a1a1a" }}>{initial ? "Sửa câu hỏi" : "Thêm câu hỏi"}</h2>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg text-gray-600 hover:bg-gray-50" style={{ borderColor: "#e5e3df" }}>Huỷ</button>
            <button onClick={() => { const input = toInput(form); if (input) onSave(form); }} disabled={saving}
              className="px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-60" style={{ background: "#16a34a" }}>
              {saving ? "Đang lưu..." : "Lưu"}
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Loại câu hỏi</label>
            <div className="flex gap-2">
              {([
                { v: "MC", label: "Trắc nghiệm" },
                { v: "TRUE_FALSE_CLUSTER", label: "Đúng-Sai 4 ý" },
                { v: "SHORT_ANSWER", label: "Trả lời ngắn" },
                { v: "ESSAY", label: "Tự luận" },
              ] as const).map(t => (
                <button key={t.v} type="button"
                  onClick={() => setForm({ ...form, type: t.v })}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
                  style={form.type === t.v
                    ? { background: "#0068FF", borderColor: "#0068FF", color: "#fff" }
                    : { borderColor: "#e5e3df", color: "#787671" }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
              {form.type === "TRUE_FALSE_CLUSTER" ? "Đoạn dẫn" : "Nội dung câu hỏi"}
            </label>
            <textarea
              className="w-full px-3 py-2.5 text-sm border rounded-lg outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
              style={{ borderColor: "#e5e3df" }}
              rows={3}
              value={form.text}
              onChange={e => setForm({ ...form, text: e.target.value })}
              placeholder="Nhập nội dung câu hỏi..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Điểm</label>
              <input type="number" min={0.25} step={0.25}
                className="w-full px-3 py-2.5 text-sm border rounded-lg outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
                style={{ borderColor: "#e5e3df" }}
                value={form.points}
                onChange={e => setForm({ ...form, points: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Ảnh minh hoạ (URL, tùy chọn)</label>
              <input
                className="w-full px-3 py-2.5 text-sm border rounded-lg outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
                style={{ borderColor: "#e5e3df" }}
                value={form.imageUrl}
                onChange={e => setForm({ ...form, imageUrl: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Phần thi (tùy chọn)</label>
              <input
                className="w-full px-3 py-2.5 text-sm border rounded-lg outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
                style={{ borderColor: "#e5e3df" }}
                value={form.sectionLabel}
                onChange={e => setForm({ ...form, sectionLabel: e.target.value })}
                placeholder="VD: Phần Trắc nghiệm — để trống nếu đề không chia phần"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Phút/Phần</label>
              <input
                type="number" min={1}
                className="w-full px-3 py-2.5 text-sm border rounded-lg outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
                style={{ borderColor: "#e5e3df" }}
                value={form.sectionMinutes}
                onChange={e => setForm({ ...form, sectionMinutes: e.target.value })}
                placeholder="VD: 60"
              />
            </div>
          </div>

          {form.type === "MC" && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Đáp án (chọn đáp án đúng)</label>
              <div className="space-y-2">
                {form.options.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input type="radio" name="correct" checked={form.correctIndex === idx}
                      onChange={() => setForm({ ...form, correctIndex: idx })} />
                    <span className="text-xs font-semibold text-gray-400 w-4">{String.fromCharCode(65 + idx)}.</span>
                    <input
                      className="flex-1 px-3 py-2 text-sm border rounded-lg outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
                      style={{ borderColor: "#e5e3df" }}
                      value={opt}
                      onChange={e => updateOption(idx, e.target.value)}
                      placeholder={`Đáp án ${String.fromCharCode(65 + idx)}`}
                    />
                    {form.options.length > 2 && (
                      <button type="button" onClick={() => removeOption(idx)}
                        className="px-2.5 py-1.5 rounded-lg border border-red-200 text-red-400 hover:bg-red-50 text-sm">✕</button>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" onClick={addOption} className="mt-2 text-xs font-semibold" style={{ color: "#0068FF" }}>+ Thêm đáp án</button>
            </div>
          )}

          {form.type === "TRUE_FALSE_CLUSTER" && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">4 ý (tích ô nếu ý đó ĐÚNG)</label>
              <div className="space-y-2">
                {CLUSTER_LABELS.map((label, idx) => (
                  <div key={label} className="flex items-center gap-2">
                    <input type="checkbox" checked={form.clusterCorrect[idx] ?? false}
                      onChange={() => {
                        const next = [...form.clusterCorrect];
                        next[idx] = !next[idx];
                        setForm({ ...form, clusterCorrect: next });
                      }} />
                    <span className="text-xs font-semibold text-gray-400 w-4">{label})</span>
                    <input
                      className="flex-1 px-3 py-2 text-sm border rounded-lg outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
                      style={{ borderColor: "#e5e3df" }}
                      value={form.options[idx] ?? ""}
                      onChange={e => {
                        const next = [...form.options];
                        next[idx] = e.target.value;
                        setForm({ ...form, options: next });
                      }}
                      placeholder={`Ý ${label}`}
                    />
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs" style={{ color: "#a4a097" }}>Mỗi ý đúng/sai độc lập — học viên trả lời riêng từng ý, không phải chọn 1 trong 4.</p>
            </div>
          )}

          {form.type === "SHORT_ANSWER" && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Đáp án đúng</label>
              <input
                className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
                style={{ borderColor: "#e5e3df" }}
                value={form.options[0] ?? ""}
                onChange={e => setForm({ ...form, options: [e.target.value] })}
                placeholder="VD: 42"
              />
              <p className="mt-1.5 text-xs" style={{ color: "#a4a097" }}>Chấm tự động bằng so khớp chính xác (không phân biệt hoa/thường, tự đổi dấu phẩy thập phân).</p>
            </div>
          )}

          {form.type === "ESSAY" && (
            <div className="text-xs p-3 rounded-lg" style={{ background: "#f6f5f4", color: "#787671" }}>
              Câu tự luận không có đáp án cố định — học viên gõ câu trả lời, giáo viên chấm điểm thủ công sau khi nộp bài.
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Giải thích (hiện sau khi nộp bài, tùy chọn)</label>
            <textarea
              className="w-full px-3 py-2.5 text-sm border rounded-lg outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
              style={{ borderColor: "#e5e3df" }}
              rows={2}
              value={form.explanation}
              onChange={e => setForm({ ...form, explanation: e.target.value })}
            />
          </div>
        </div>
      </div>
    </>
  );
}

// Định dạng file đề thi gốc dùng luồng AI (Gemini) thay vì parse cơ học —
// khớp với SUPPORTED_AI_MIME_TYPES ở src/lib/aiExamImport.ts.
const AI_FILE_EXTENSIONS = new Set(["pdf", "docx", "jpg", "jpeg", "png", "webp"]);
const MAX_AI_FILE_BYTES = 4 * 1024 * 1024; // ~4MB — giới hạn body request của Vercel Serverless

// Điểm/câu (+ tuỳ chọn gán Phần thi) theo khuôn tính điểm chính thức — áp
// dụng theo LOẠI câu hỏi, không theo vị trí. Xem giải thích đầy đủ ở hằng số
// cùng tên trong src/app/(admin)/admin/thi-thu/page.tsx (2 nơi lặp lại vì
// mỗi trang có state review câu hỏi riêng, không chia sẻ component).
interface ScoreRule { points: number; section?: string | null }
interface ScorePreset { label: string; mc?: ScoreRule; cluster?: ScoreRule; short?: ScoreRule; essay?: ScoreRule }
const SCORE_PRESETS: Record<string, ScorePreset> = {
  thpt_toan:     { label: "THPT - Toán",          mc: { points: 0.25 }, cluster: { points: 1 }, short: { points: 0.5 } },
  thpt_tunhien:  { label: "THPT - Tự nhiên & CN",  mc: { points: 0.25 }, cluster: { points: 1 }, short: { points: 0.25 } },
  thpt_xahoi:    { label: "THPT - Xã hội",         mc: { points: 0.25 }, cluster: { points: 1 } },
  thpt_ngoaingu: { label: "THPT - Ngoại ngữ",      mc: { points: 0.25 } },
  bca:           { label: "Bộ Công An",            mc: { points: 1, section: "Phần Trắc nghiệm" }, essay: { points: 25, section: "Phần Tự luận" } },
};

// ─── DRAWER: nhập hàng loạt ────────────────────────────────────────────────────
function BulkImportDrawer({ open, onClose, onImport, saving, result, examId, showToast, onSaved }: {
  open: boolean;
  onClose: () => void;
  onImport: (text: string) => void;
  saving: boolean;
  result: { imported: number; errors: { block: number; message: string }[] } | null;
  examId: string;
  showToast: (msg: string, ok?: boolean) => void;
  onSaved: () => void;
}) {
  const [text, setText] = useState("");

  // ── Trích xuất bằng AI từ file đề thi gốc (PDF/Word/ảnh) — có bước review
  // trước khi lưu, tách biệt hoàn toàn với luồng dán text ở trên (lưu ngay). ──
  const [aiLoading, setAiLoading]         = useState(false);
  const [aiSaving, setAiSaving]           = useState(false);
  const [aiFileErr, setAiFileErr]         = useState("");
  const [answerKeyFile, setAnswerKeyFile] = useState<File | null>(null);
  const [reviewQuestions, setReviewQuestions] = useState<ExamQuestionInput[] | null>(null);
  const [parseErrs, setParseErrs]         = useState<{ block: number; message: string }[]>([]);
  const [scorePreset, setScorePreset]     = useState<keyof typeof SCORE_PRESETS>("thpt_toan");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const answerKeyInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setText(""); setAiFileErr(""); setAnswerKeyFile(null);
      setReviewQuestions(null); setParseErrs([]); setAiLoading(false); setAiSaving(false);
    }
  }, [open]);

  async function handleAiFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAiFileErr("");
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !AI_FILE_EXTENSIONS.has(ext)) {
      setAiFileErr("Chỉ hỗ trợ file .pdf, .docx, .jpg, .png, .webp");
      return;
    }
    if (file.size > MAX_AI_FILE_BYTES) {
      setAiFileErr("File đề thi vượt quá 4MB");
      return;
    }
    setAiLoading(true);
    try {
      const { questions, errors } = await api.exams.aiExtractQuestions(file, answerKeyFile ?? undefined);
      setReviewQuestions(questions);
      setParseErrs(errors);
    } catch (err) {
      setAiFileErr(err instanceof Error ? err.message : "Trích xuất thất bại");
    } finally {
      setAiLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function updateReviewQuestion(idx: number, text: string) {
    setReviewQuestions(prev => prev?.map((q, i) => i === idx ? { ...q, text } : q) ?? null);
  }
  function updateReviewOption(idx: number, oi: number, text: string) {
    setReviewQuestions(prev => prev?.map((q, i) =>
      i === idx ? { ...q, options: q.options.map((o, j) => j === oi ? { ...o, text } : o) } : q
    ) ?? null);
  }
  function setReviewCorrect(idx: number, oi: number) {
    setReviewQuestions(prev => prev?.map((q, i) =>
      i === idx ? { ...q, options: q.options.map((o, j) => ({ ...o, isCorrect: j === oi })) } : q
    ) ?? null);
  }
  function toggleReviewClusterCorrect(idx: number, oi: number) {
    setReviewQuestions(prev => prev?.map((q, i) =>
      i === idx ? { ...q, options: q.options.map((o, j) => j === oi ? { ...o, isCorrect: !o.isCorrect } : o) } : q
    ) ?? null);
  }
  function removeReviewQuestion(idx: number) {
    setReviewQuestions(prev => {
      const next = prev?.filter((_, i) => i !== idx) ?? null;
      return next && next.length > 0 ? next : null;
    });
  }
  function updateReviewShortAnswer(idx: number, text: string) {
    setReviewQuestions(prev => prev?.map((q, i) =>
      i === idx ? { ...q, options: [{ text, isCorrect: true }] } : q
    ) ?? null);
  }
  function updateReviewSection(idx: number, sectionLabel: string) {
    setReviewQuestions(prev => prev?.map((q, i) =>
      i === idx ? { ...q, sectionLabel: sectionLabel || null } : q
    ) ?? null);
  }
  function updateReviewSectionMinutes(idx: number, minutes: string) {
    const n = minutes.trim() === "" ? null : Number(minutes);
    setReviewQuestions(prev => prev?.map((q, i) =>
      i === idx ? { ...q, sectionMinutes: n != null && Number.isFinite(n) && n > 0 ? n : null } : q
    ) ?? null);
  }
  function applyScorePreset() {
    if (!reviewQuestions) return;
    const preset = SCORE_PRESETS[scorePreset];
    const ruleFor = (type: string): ScoreRule | undefined =>
      type === "MC" ? preset.mc
      : type === "TRUE_FALSE_CLUSTER" ? preset.cluster
      : type === "SHORT_ANSWER" ? preset.short
      : type === "ESSAY" ? preset.essay
      : undefined;
    setReviewQuestions(prev => prev?.map(q => {
      const rule = ruleFor(q.type ?? "MC");
      if (!rule) return q;
      return { ...q, points: rule.points, sectionLabel: rule.section !== undefined ? rule.section : q.sectionLabel };
    }) ?? null);
  }

  async function saveAiQuestions() {
    if (!reviewQuestions || reviewQuestions.length === 0) return;
    setAiSaving(true);
    try {
      await api.examQuestions.bulkCreate(examId, reviewQuestions);
      showToast(`Đã thêm ${reviewQuestions.length} câu hỏi`, true);
      setReviewQuestions(null); setParseErrs([]); setAnswerKeyFile(null);
      onSaved();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Lưu câu hỏi thất bại", false);
    } finally {
      setAiSaving(false);
    }
  }

  return (
    <>
      {open && <div className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.3)" }} onClick={onClose} />}
      <div className="fixed top-0 right-0 bottom-0 z-50 bg-white overflow-y-auto shadow-2xl"
        style={{
          width: "min(640px, 100vw)",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.28s cubic-bezier(.4,0,.2,1)",
          pointerEvents: open ? "auto" : "none",
          visibility: open ? "visible" : "hidden",
        }}>
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "#e5e3df" }}>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 text-xl font-light">×</button>
            <h2 className="text-base font-bold" style={{ color: "#1a1a1a" }}>Nhập hàng loạt câu hỏi</h2>
          </div>
          <button onClick={() => onImport(text)} disabled={saving || !text.trim()}
            className="px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-60" style={{ background: "#16a34a" }}>
            {saving ? "Đang nhập..." : "Nhập"}
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="text-xs p-3 rounded-lg" style={{ background: "#f6f5f4", color: "#787671" }}>
            Mỗi câu hỏi là 1 khối, cách nhau bởi dòng trống — loại câu hỏi tự nhận diện theo nội dung khối:
            <pre className="mt-1.5 whitespace-pre-wrap text-[11px]" style={{ color: "#1a1a1a" }}>{`Câu 1: Trắc nghiệm...
Ảnh: https://... (tùy chọn, ảnh đã tải lên sẵn)
*A. Đáp án đúng
B. Đáp án sai

Câu 2: Đoạn dẫn cho 4 ý Đúng-Sai...
*a)[0,NB] Ý đúng
b)[1,NB] Ý sai

Câu 3: Câu tự luận không có đáp án nào cả.`}</pre>
            <p className="mt-1.5">Ảnh minh hoạ: thêm dòng riêng <code>Ảnh: &lt;url&gt;</code> trong khối câu hỏi — dán URL ảnh đã tải lên sẵn, áp dụng cho cả 3 loại câu hỏi.</p>
            <p className="mt-1.5">Công thức toán: gõ mã LaTeX trong <code>$...$</code> (inline) hoặc <code>$$...$$</code> (xuống dòng riêng), vd <code>$x^2+1$</code>. Copy công thức từ Word không tự thành LaTeX được.</p>
          </div>
          <textarea
            className="w-full px-3 py-2.5 text-sm border rounded-lg outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 font-mono"
            style={{ borderColor: "#e5e3df" }}
            rows={16}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Dán danh sách câu hỏi vào đây..."
          />
          {result && (
            <div className="text-sm space-y-1.5">
              <p className="font-semibold" style={{ color: result.imported > 0 ? "#16a34a" : "#dc2626" }}>
                Đã nhập {result.imported} câu hỏi.
              </p>
              {result.errors.length > 0 && (
                <ul className="space-y-1 text-xs text-red-600">
                  {result.errors.map((e, i) => (
                    <li key={i}>Khối {e.block}: {e.message}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="border-t pt-4" style={{ borderColor: "#e5e3df" }}>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Hoặc tải file đề thi gốc (AI)</h3>
            {reviewQuestions === null ? (
              <div className="space-y-3">
                <p className="text-xs" style={{ color: "#787671" }}>
                  Tải file đề thi gốc (.pdf, .docx, .jpg, .png, .webp) — AI (Gemini) sẽ tự đọc và trích xuất câu hỏi. Đính kèm thêm file đáp án/hướng dẫn giải (tùy chọn) để AI xác định đáp án đúng chính xác hơn. Kết quả luôn qua bước xem lại trước khi lưu.
                </p>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    File đáp án / hướng dẫn giải (tùy chọn)
                  </label>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => answerKeyInputRef.current?.click()}
                      className="px-3 py-2 text-xs font-semibold rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
                      {answerKeyFile ? "Đổi file đáp án" : "Chọn file đáp án"}
                    </button>
                    {answerKeyFile && (
                      <span className="text-xs text-gray-500">
                        {answerKeyFile.name} <button type="button" onClick={() => setAnswerKeyFile(null)} className="text-red-500 ml-1">✕</button>
                      </span>
                    )}
                    <input ref={answerKeyInputRef} type="file" accept=".pdf,.docx,.jpg,.jpeg,.png,.webp"
                      className="hidden" onChange={e => setAnswerKeyFile(e.target.files?.[0] ?? null)} />
                  </div>
                </div>
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={aiLoading}
                  className="px-3 py-2 text-sm font-semibold rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                  {aiLoading ? "Đang phân tích bằng AI... (có thể mất 20-40 giây)" : "Tải file đề thi lên"}
                </button>
                <input ref={fileInputRef} type="file" accept=".pdf,.docx,.jpg,.jpeg,.png,.webp"
                  className="hidden" onChange={handleAiFile} disabled={aiLoading} />
                {aiFileErr && <p className="text-xs text-red-500">{aiFileErr}</p>}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold" style={{ color: "#16a34a" }}>
                    {reviewQuestions.length} câu hỏi hợp lệ — xem lại trước khi lưu
                  </p>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => { setReviewQuestions(null); setParseErrs([]); }}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700">
                      ← Quay lại
                    </button>
                    <button type="button" onClick={saveAiQuestions} disabled={aiSaving}
                      className="px-3 py-1.5 text-xs font-semibold text-white rounded-lg disabled:opacity-60" style={{ background: "#16a34a" }}>
                      {aiSaving ? "Đang lưu..." : "Lưu câu hỏi này"}
                    </button>
                  </div>
                </div>

                {parseErrs.length > 0 && (
                  <ul className="text-xs text-red-600 space-y-1 p-2 rounded-lg" style={{ background: "#fef2f2" }}>
                    {parseErrs.map((e, i) => <li key={i}>Khối {e.block}: {e.message}</li>)}
                  </ul>
                )}

                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 flex-shrink-0">Khuôn điểm đề thi:</span>
                  <select className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded-lg outline-none bg-white"
                    value={scorePreset} onChange={e => setScorePreset(e.target.value as keyof typeof SCORE_PRESETS)}>
                    {Object.entries(SCORE_PRESETS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                  <button type="button" onClick={applyScorePreset}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 flex-shrink-0">
                    Áp dụng khuôn
                  </button>
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {reviewQuestions.map((q, idx) => {
                    const prevSection = idx > 0 ? reviewQuestions[idx - 1].sectionLabel : undefined;
                    const showSectionHeader = q.sectionLabel && q.sectionLabel !== prevSection;
                    return (
                    <Fragment key={idx}>
                      {showSectionHeader && (
                        <p className="text-xs font-bold uppercase tracking-wide pt-2" style={{ color: "#0068FF" }}>{q.sectionLabel}</p>
                      )}
                    <div className="rounded-lg p-3 border border-gray-200 bg-gray-50">
                      <div className="flex items-start gap-2 mb-2">
                        <span className="text-xs font-semibold text-gray-400 mt-2">Câu {idx + 1}</span>
                        <textarea
                          className="flex-1 px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg outline-none focus:border-blue-400"
                          rows={2}
                          value={q.text}
                          onChange={e => updateReviewQuestion(idx, e.target.value)}
                        />
                        <button type="button" onClick={() => removeReviewQuestion(idx)}
                          className="px-2 py-1 rounded-lg border border-red-200 text-red-400 hover:bg-red-50 text-xs flex-shrink-0">✕</button>
                      </div>
                      <div className="flex items-center gap-1.5 mb-2 pl-6">
                        <input
                          className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded outline-none focus:border-blue-400"
                          placeholder="Phần (tùy chọn, vd: Phần Trắc nghiệm)"
                          value={q.sectionLabel ?? ""}
                          onChange={e => updateReviewSection(idx, e.target.value)}
                        />
                        <input
                          type="number" min={1}
                          className="w-24 px-2 py-1 text-xs border border-gray-300 rounded outline-none focus:border-blue-400 flex-shrink-0"
                          placeholder="Phút/Phần"
                          value={q.sectionMinutes ?? ""}
                          onChange={e => updateReviewSectionMinutes(idx, e.target.value)}
                        />
                      </div>
                      {q.type === "ESSAY" ? (
                        <p className="pl-6 text-xs italic text-gray-400">Tự luận — không cần đáp án, chấm tay sau khi nộp bài.</p>
                      ) : q.type === "SHORT_ANSWER" ? (
                        <div className="pl-6">
                          <input
                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded outline-none focus:border-blue-400"
                            placeholder="Đáp án đúng"
                            value={q.options[0]?.text ?? ""}
                            onChange={e => updateReviewShortAnswer(idx, e.target.value)}
                          />
                        </div>
                      ) : q.type === "TRUE_FALSE_CLUSTER" ? (
                        <div className="grid grid-cols-2 gap-1.5 pl-6">
                          {q.options.map((o, oi) => (
                            <div key={oi} className="flex items-center gap-1.5">
                              <input type="checkbox" checked={o.isCorrect} onChange={() => toggleReviewClusterCorrect(idx, oi)} />
                              <span className="text-xs font-semibold text-gray-400 w-3.5">{o.subLabel}</span>
                              <input
                                className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded outline-none focus:border-blue-400"
                                value={o.text}
                                onChange={e => updateReviewOption(idx, oi, e.target.value)}
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-1.5 pl-6">
                          {q.options.map((o, oi) => (
                            <div key={oi} className="flex items-center gap-1.5">
                              <input type="radio" checked={o.isCorrect} onChange={() => setReviewCorrect(idx, oi)} />
                              <span className="text-xs font-semibold text-gray-400 w-3.5">{String.fromCharCode(65 + oi)}</span>
                              <input
                                className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded outline-none focus:border-blue-400"
                                value={o.text}
                                onChange={e => updateReviewOption(idx, oi, e.target.value)}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    </Fragment>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function DelModal({ target, onClose, onConfirm }: { target: { id: string; label: string } | null; onClose: () => void; onConfirm: () => void }) {
  if (!target) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
        <div className="text-center mb-5">
          <h2 className="text-base font-bold mb-1" style={{ color: "#1a1a1a" }}>Xoá câu hỏi?</h2>
          <p className="text-sm text-gray-500">Xoá "{target.label}". Không thể hoàn tác.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm border border-gray-300 text-gray-600 hover:bg-gray-50">Huỷ</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: "#dc2626" }}>Xoá</button>
        </div>
      </div>
    </div>
  );
}

// ─── LƯU CÂU CÓ SẴN VÀO NGÂN HÀNG (hồi tố, chiều ngược của QuestionBankPicker) ──
const SAVE_TO_BANK_DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: "NB",  label: "Nhận biết" },
  { value: "TH",  label: "Thông hiểu" },
  { value: "VD",  label: "Vận dụng" },
  { value: "VDC", label: "Vận dụng cao" },
];

function SaveToBankModal({ target, onClose, onSave, saving }: {
  target: { id: string; label: string } | null;
  onClose: () => void;
  onSave: (data: SaveToBankInput) => void;
  saving: boolean;
}) {
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("NB");
  const [tagsText, setTagsText] = useState("");

  useEffect(() => {
    if (target) { setSubject(""); setTopic(""); setDifficulty("NB"); setTagsText(""); }
  }, [target]);

  if (!target) return null;

  function handleSave() {
    if (!subject.trim() || !topic.trim()) return;
    const tags = tagsText.split(",").map(t => t.trim()).filter(Boolean);
    onSave({ subject: subject.trim(), topic: topic.trim(), difficulty, tags: tags.length > 0 ? tags : undefined });
  }

  const inp = "w-full px-3 py-2 text-sm border rounded-lg outline-none focus:border-blue-400";
  const inpStyle = { borderColor: "#e5e3df" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
        <h2 className="text-base font-bold mb-1" style={{ color: "#1a1a1a" }}>Lưu vào ngân hàng câu hỏi</h2>
        <p className="text-sm text-gray-500 mb-4">"{target.label}"</p>
        <div className="space-y-3 mb-5">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Môn học *</label>
            <input className={inp} style={inpStyle} value={subject} onChange={e => setSubject(e.target.value)} placeholder="VD: Toán" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Chủ đề *</label>
            <input className={inp} style={inpStyle} value={topic} onChange={e => setTopic(e.target.value)} placeholder="VD: Hàm số" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Độ khó *</label>
            <div className="flex gap-2 flex-wrap">
              {SAVE_TO_BANK_DIFFICULTIES.map(d => (
                <button key={d.value} type="button" onClick={() => setDifficulty(d.value)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
                  style={difficulty === d.value
                    ? { background: "#0068FF", borderColor: "#0068FF", color: "#fff" }
                    : { borderColor: "#e5e3df", color: "#787671" }}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Tags (tùy chọn, cách nhau bởi dấu phẩy)</label>
            <input className={inp} style={inpStyle} value={tagsText} onChange={e => setTagsText(e.target.value)} placeholder="VD: đề thi thử, chương 1" />
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm border border-gray-300 text-gray-600 hover:bg-gray-50">Huỷ</button>
          <button onClick={handleSave} disabled={saving || !subject.trim() || !topic.trim()}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: "#16a34a" }}>
            {saving ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── DUYỆT PHÍ GUEST (đề thi có price, tái dùng quy trình sales thủ công) ──────
function GuestAccessPanel({ examId, showToast }: { examId: string; showToast: (msg: string, ok?: boolean) => void }) {
  const [grants, setGrants] = useState<ExamGuestAccessFull[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.examGuestAccess.list(examId).then(setGrants).finally(() => setLoading(false));
  }, [examId]);

  useEffect(() => { load(); }, [load]);

  async function grant() {
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      await api.examGuestAccess.grant(examId, email.trim());
      showToast("Đã duyệt quyền vào thi cho " + email.trim(), true);
      setEmail("");
      load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Duyệt thất bại", false);
    } finally {
      setSubmitting(false);
    }
  }

  async function revoke(userId: string, label: string) {
    try {
      await api.examGuestAccess.revoke(examId, userId);
      showToast("Đã thu hồi quyền của " + label, true);
      load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Thu hồi thất bại", false);
    }
  }

  return (
    <div className="mb-6 rounded-xl border p-4" style={{ borderColor: "#e5e3df", background: "#ffffff" }}>
      <h3 className="text-sm font-bold mb-1" style={{ color: "#1a1a1a" }}>Duyệt phí guest</h3>
      <p className="text-xs mb-3" style={{ color: "#787671" }}>
        Đề thi này thu phí — học viên đã đăng ký khoá học liên quan vẫn thi miễn phí.
        Guest khác cần duyệt tay ở đây sau khi xác nhận đã thanh toán qua tư vấn/sales.
      </p>
      <div className="flex gap-2 mb-3">
        <input type="email" placeholder="Email học viên/guest đã trả phí..."
          className="flex-1 px-3 py-2 text-sm border rounded-lg outline-none focus:border-blue-400"
          style={{ borderColor: "#e5e3df" }}
          value={email} onChange={e => setEmail(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") grant(); }} />
        <button onClick={grant} disabled={submitting || !email.trim()}
          className="px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-60" style={{ background: "#16a34a" }}>
          {submitting ? "Đang duyệt..." : "Duyệt"}
        </button>
      </div>
      {loading ? (
        <p className="text-xs" style={{ color: "#787671" }}>Đang tải...</p>
      ) : grants.length === 0 ? (
        <p className="text-xs" style={{ color: "#787671" }}>Chưa có guest nào được duyệt.</p>
      ) : (
        <ul className="space-y-1.5">
          {grants.map(g => (
            <li key={g.id} className="flex items-center justify-between text-xs px-3 py-2 rounded-lg" style={{ background: "#f6f5f4" }}>
              <span>
                <span className="font-medium" style={{ color: "#1a1a1a" }}>{g.user.name}</span>
                <span style={{ color: "#787671" }}> — {g.user.email}</span>
              </span>
              <button onClick={() => revoke(g.userId, g.user.email)}
                className="text-red-500 hover:underline">Thu hồi</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── DRAWER: xem bài làm 1 lượt thi + chấm tự luận ─────────────────────────────
function GradeAttemptDrawer({ attemptId, onClose, onGraded }: {
  attemptId: string | null;
  onClose: () => void;
  onGraded: () => void;
}) {
  const open = attemptId !== null;
  const [detail, setDetail] = useState<ExamAttemptAdminDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, { points: string; comment: string }>>({});
  const [saving, setSaving] = useState<string | null>(null); // questionId đang lưu

  useEffect(() => {
    if (!attemptId) return;
    setLoading(true);
    api.examAttemptsAdmin.detail(attemptId).then(d => {
      setDetail(d);
      const init: Record<string, { points: string; comment: string }> = {};
      for (const q of d.questions) {
        if (q.type === "ESSAY") {
          init[q.id] = { points: q.pointsAwarded != null ? String(q.pointsAwarded) : "", comment: q.teacherComment ?? "" };
        }
      }
      setDrafts(init);
    }).finally(() => setLoading(false));
  }, [attemptId]);

  async function saveGrade(questionId: string, maxPoints: number) {
    if (!attemptId) return;
    const draft = drafts[questionId];
    const points = Number(draft?.points);
    if (!draft?.points || isNaN(points) || points < 0 || points > maxPoints) return;
    setSaving(questionId);
    try {
      const res = await api.examAttemptsAdmin.gradeEssay(attemptId, questionId, points, draft.comment);
      setDetail(prev => prev
        ? { ...prev, score: res.score, questions: prev.questions.map(q => q.id === questionId ? { ...q, pointsAwarded: points, teacherComment: draft.comment } : q) }
        : prev);
      onGraded();
    } finally {
      setSaving(null);
    }
  }

  return (
    <>
      {open && <div className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.3)" }} onClick={onClose} />}
      <div className="fixed top-0 right-0 bottom-0 z-50 bg-white overflow-y-auto shadow-2xl"
        style={{
          width: "min(640px, 100vw)",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.28s cubic-bezier(.4,0,.2,1)",
          pointerEvents: open ? "auto" : "none",
          visibility: open ? "visible" : "hidden",
        }}>
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "#e5e3df" }}>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 text-xl font-light">×</button>
            <div>
              <h2 className="text-base font-bold" style={{ color: "#1a1a1a" }}>Bài làm của {detail?.user.name ?? "..."}</h2>
              {detail && <p className="text-xs" style={{ color: "#787671" }}>{detail.user.email} — Điểm: {detail.score ?? "—"}/{detail.totalPoints}</p>}
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {loading || !detail ? (
            <p className="text-sm" style={{ color: "#787671" }}>Đang tải...</p>
          ) : (
            detail.questions.map((q, idx) => (
              <div key={q.id} className="rounded-xl border p-4" style={{ borderColor: "#e5e3df" }}>
                <p className="text-sm font-medium mb-2" style={{ color: "#1a1a1a" }}>Câu {idx + 1}: <MathText text={q.text} /></p>

                {q.type === "MC" && (
                  <div className="space-y-1">
                    {q.options.map(o => (
                      <div key={o.id} className="text-xs flex items-center gap-1.5"
                        style={{ color: o.id === q.studentOptionId ? (o.isCorrect ? "#16a34a" : "#dc2626") : "#a4a097" }}>
                        {o.id === q.studentOptionId && "→ "}<MathText text={o.text} /> {o.isCorrect && "✓"}
                      </div>
                    ))}
                  </div>
                )}

                {q.type === "TRUE_FALSE_CLUSTER" && (
                  <div className="space-y-1">
                    {q.options.map(o => (
                      <div key={o.id} className="text-xs flex items-center gap-1.5"
                        style={{ color: o.studentAnswerTrue === o.isCorrect ? "#16a34a" : "#dc2626" }}>
                        <strong>{o.subLabel})</strong> <MathText text={o.text} /> — học viên chọn: {o.studentAnswerTrue === null ? "chưa trả lời" : o.studentAnswerTrue ? "Đúng" : "Sai"}
                      </div>
                    ))}
                  </div>
                )}

                {q.type === "SHORT_ANSWER" && (() => {
                  const normalize = (s: string) => s.trim().toLowerCase().replace(/,/g, ".");
                  const correct = q.options[0]?.text ?? "";
                  const isCorrect = !!q.textAnswer?.trim() && normalize(q.textAnswer) === normalize(correct);
                  return (
                    <div className="text-xs space-y-1">
                      <p>
                        Học viên trả lời: <strong style={{ color: q.textAnswer?.trim() ? undefined : "#a4a097" }}>
                          {q.textAnswer?.trim() || "chưa trả lời"}
                        </strong>
                      </p>
                      <p style={{ color: "#787671" }}>Đáp án đúng: {correct || "—"}</p>
                      <p style={{ color: isCorrect ? "#16a34a" : "#dc2626" }}>
                        Chấm tự động — {isCorrect ? `Đúng (${q.points} điểm)` : "Sai (0 điểm)"}
                      </p>
                    </div>
                  );
                })()}

                {q.type === "ESSAY" && (
                  <div>
                    <div className="text-sm p-3 rounded-lg mb-3" style={{ background: "#f6f5f4", color: "#37352f" }}>
                      {q.textAnswer?.trim() ? q.textAnswer : <em style={{ color: "#a4a097" }}>Học viên chưa trả lời</em>}
                    </div>
                    <div className="flex gap-2 items-start">
                      <div className="w-28">
                        <label className="block text-[11px] text-gray-500 mb-1">Điểm (tối đa {q.points})</label>
                        <input type="number" min={0} max={q.points} step={0.25}
                          className="w-full px-2.5 py-1.5 text-sm border rounded-lg outline-none focus:border-blue-400"
                          style={{ borderColor: "#e5e3df" }}
                          value={drafts[q.id]?.points ?? ""}
                          onChange={e => setDrafts(prev => ({ ...prev, [q.id]: { points: e.target.value, comment: prev[q.id]?.comment ?? "" } }))}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-[11px] text-gray-500 mb-1">Nhận xét (tùy chọn)</label>
                        <input
                          className="w-full px-2.5 py-1.5 text-sm border rounded-lg outline-none focus:border-blue-400"
                          style={{ borderColor: "#e5e3df" }}
                          value={drafts[q.id]?.comment ?? ""}
                          onChange={e => setDrafts(prev => ({ ...prev, [q.id]: { points: prev[q.id]?.points ?? "", comment: e.target.value } }))}
                        />
                      </div>
                      <button onClick={() => saveGrade(q.id, q.points)} disabled={saving === q.id}
                        className="mt-5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg disabled:opacity-60"
                        style={{ background: "#16a34a" }}>
                        {saving === q.id ? "..." : "Lưu điểm"}
                      </button>
                    </div>
                    {q.pointsAwarded != null && (
                      <p className="text-[11px] mt-1.5" style={{ color: "#16a34a" }}>Đã chấm: {q.pointsAwarded}/{q.points} điểm</p>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

// ─── DANH SÁCH ĐÃ THI (điểm + số lần rời tab lúc thi) ──────────────────────────
function AttemptsPanel({ examId }: { examId: string }) {
  const [attempts, setAttempts] = useState<ExamAttemptAdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [grading, setGrading] = useState<string | null>(null); // attemptId đang mở drawer chấm bài

  const load = useCallback(() => {
    setLoading(true);
    api.examAttemptsAdmin.list(examId).then(setAttempts).finally(() => setLoading(false));
  }, [examId]);

  useEffect(() => { if (open) load(); }, [open, load]);

  return (
    <div className="mb-6 rounded-xl border" style={{ borderColor: "#e5e3df", background: "#ffffff" }}>
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left">
        <h3 className="text-sm font-bold" style={{ color: "#1a1a1a" }}>Danh sách đã thi</h3>
        <span className="text-xs" style={{ color: "#787671" }}>{open ? "Thu gọn ▲" : "Xem ▼"}</span>
      </button>
      {open && (
        <div className="px-4 pb-4">
          {loading ? (
            <p className="text-xs" style={{ color: "#787671" }}>Đang tải...</p>
          ) : attempts.length === 0 ? (
            <p className="text-xs" style={{ color: "#787671" }}>Chưa có ai nộp bài.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left" style={{ color: "#a4a097" }}>
                    <th className="py-2 pr-3 font-medium">Học viên</th>
                    <th className="py-2 pr-3 font-medium">Điểm</th>
                    <th className="py-2 pr-3 font-medium">Nộp lúc</th>
                    <th className="py-2 pr-3 font-medium">Số lần rời tab</th>
                    <th className="py-2 pr-3 font-medium">Trạng thái</th>
                    <th className="py-2 pr-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map(a => (
                    <tr key={a.id} className="border-t" style={{ borderColor: "#f6f5f4" }}>
                      <td className="py-2 pr-3">
                        <span className="font-medium" style={{ color: "#1a1a1a" }}>{a.user.name}</span>
                        <span style={{ color: "#787671" }}> — {a.user.email}</span>
                      </td>
                      <td className="py-2 pr-3">{a.score ?? "—"}/{a.totalPoints ?? "—"}</td>
                      <td className="py-2 pr-3">{a.submittedAt ? new Date(a.submittedAt).toLocaleString("vi-VN") : "—"}</td>
                      <td className="py-2 pr-3">
                        {a.tabSwitchCount > 0 ? (
                          <span className="px-2 py-0.5 rounded-full font-semibold" style={{ background: "#fef3c7", color: "#b45309" }}>
                            {a.tabSwitchCount} lần
                          </span>
                        ) : (
                          <span style={{ color: "#787671" }}>0</span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        {a.ungradedEssayCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full font-semibold" style={{ background: "#fef3c7", color: "#b45309" }}>
                            Chưa chấm tự luận
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <button onClick={() => setGrading(a.id)} className="text-xs font-semibold" style={{ color: "#0068FF" }}>
                          Xem bài làm
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      <GradeAttemptDrawer attemptId={grading} onClose={() => setGrading(null)} onGraded={load} />
    </div>
  );
}

// ─── TRANG CHÍNH ───────────────────────────────────────────────────────────────
function ThiThuQuestionsPage() {
  const { id } = useParams<{ id: string }>();
  const [exam, setExam] = useState<ExamFull | null>(null);
  const [questions, setQuestions] = useState<ExamQuestionFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ExamQuestionFull | null | "new">(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bankPickerOpen, setBankPickerOpen] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ imported: number; errors: { block: number; message: string }[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState<{ id: string; label: string } | null>(null);
  const [saveToBank, setSaveToBank] = useState<{ id: string; label: string } | null>(null);
  const [savingToBank, setSavingToBank] = useState(false);
  const { toast, showToast } = useAdminToast();

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.exams.get(id), api.examQuestions.list(id)])
      .then(([e, qs]) => { setExam(e); setQuestions(qs); })
      .catch(() => showToast("Không tải được dữ liệu đề thi", false))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(form: QuestionForm) {
    const input = toInput(form);
    if (!input) return;
    setSaving(true);
    try {
      if (editing && editing !== "new") {
        await api.examQuestions.update(id, editing.id, input);
        showToast("Đã cập nhật câu hỏi", true);
      } else {
        await api.examQuestions.create(id, input);
        showToast("Đã thêm câu hỏi", true);
      }
      setEditing(null);
      load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Lưu thất bại", false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!del) return;
    try {
      await api.examQuestions.remove(id, del.id);
      showToast("Đã xoá câu hỏi", true);
      setDel(null);
      load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Xoá thất bại", false);
    }
  }

  // Thêm câu đã chọn từ Ngân hàng câu hỏi thẳng vào đề đã tồn tại — lưu ngay
  // qua bulkCreate (khác CreateExamDrawer, ở đây exam đã có id, không cần
  // qua state nháp).
  async function handleAddFromBank(items: ExamQuestionInput[]) {
    try {
      await api.examQuestions.bulkCreate(id, items);
      showToast(`Đã thêm ${items.length} câu từ ngân hàng`, true);
      load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Thêm câu từ ngân hàng thất bại", false);
    }
  }

  async function handleSaveToBank(data: SaveToBankInput) {
    if (!saveToBank) return;
    setSavingToBank(true);
    try {
      await api.examQuestions.saveToBank(id, saveToBank.id, data);
      showToast("Đã lưu vào ngân hàng câu hỏi", true);
      setSaveToBank(null);
      load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Lưu vào ngân hàng thất bại", false);
    } finally {
      setSavingToBank(false);
    }
  }

  async function handleBulkImport(text: string) {
    setBulkSaving(true);
    try {
      const result = await api.examQuestions.bulkImport(id, text);
      setBulkResult(result);
      if (result.imported > 0) load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Nhập hàng loạt thất bại", false);
    } finally {
      setBulkSaving(false);
    }
  }

  async function move(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= questions.length) return;
    const arr = [...questions];
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    setQuestions(arr);
    const order = arr.map((q, i) => ({ id: q.id, order: i + 1 }));
    try {
      await api.examQuestions.reorder(id, order);
    } catch {
      showToast("Lỗi sắp xếp lại", false);
      load();
    }
  }

  if (loading) return <div className="p-8 text-sm text-gray-500">Đang tải...</div>;
  if (!exam) return <div className="p-8 text-sm text-gray-500">Không tìm thấy đề thi.</div>;

  return (
    <div className="min-h-screen" style={{ background: "#f6f5f4" }}>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link href="/admin/thi-thu" className="text-sm mb-3 inline-block" style={{ color: "#787671" }}>← Quay lại danh sách đề thi</Link>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "#1a1a1a" }}>{exam.title}</h1>
            <p className="text-sm" style={{ color: "#787671" }}>{questions.length} câu hỏi đã soạn</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setBankPickerOpen(true)}
              className="px-4 py-2 text-sm font-semibold rounded-lg border" style={{ borderColor: "#e5e3df", color: "#1a1a1a" }}>
              + Từ ngân hàng
            </button>
            <button onClick={() => { setBulkResult(null); setBulkOpen(true); }}
              className="px-4 py-2 text-sm font-semibold rounded-lg border" style={{ borderColor: "#e5e3df", color: "#1a1a1a" }}>
              Nhập hàng loạt
            </button>
            <button onClick={() => setEditing("new")}
              className="px-4 py-2 text-sm font-semibold text-white rounded-lg" style={{ background: "#0068FF" }}>
              + Thêm câu hỏi
            </button>
          </div>
        </div>

        <AttemptsPanel examId={id} />

        {!!exam.price && <GuestAccessPanel examId={id} showToast={showToast} />}

        {questions.length === 0 ? (
          <div className="text-center py-16 rounded-xl border" style={{ borderColor: "#e5e3df", background: "#ffffff" }}>
            <p className="text-sm" style={{ color: "#787671" }}>Đề thi này chưa có câu hỏi nào — học viên sẽ dùng luồng thi Azota cũ cho tới khi có câu hỏi đầu tiên.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {questions.map((q, idx) => {
              const prevSection = idx > 0 ? questions[idx - 1].sectionLabel : undefined;
              const showSectionHeader = q.sectionLabel && q.sectionLabel !== prevSection;
              return (
              <Fragment key={q.id}>
                {showSectionHeader && (
                  <p className="text-xs font-bold uppercase tracking-wide pt-2" style={{ color: "#0068FF" }}>
                    {q.sectionLabel}{q.sectionMinutes != null && ` (${q.sectionMinutes} phút)`}
                  </p>
                )}
              <div className="rounded-xl border p-4" style={{ borderColor: "#e5e3df", background: "#ffffff" }}>
                <div className="flex items-start gap-3">
                  <div className="flex flex-col gap-0.5 pt-0.5">
                    <button onClick={() => move(idx, -1)} disabled={idx === 0} className="text-gray-400 hover:text-gray-700 disabled:opacity-30 text-xs">▲</button>
                    <button onClick={() => move(idx, 1)} disabled={idx === questions.length - 1} className="text-gray-400 hover:text-gray-700 disabled:opacity-30 text-xs">▼</button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium" style={{ color: "#1a1a1a" }}>Câu {idx + 1}: <MathText text={q.text} /></p>
                      {q.type !== "MC" && (
                        <span className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase"
                          style={{ background: "#f6f5f4", color: "#787671" }}>
                          {q.type === "ESSAY" ? "Tự luận" : q.type === "SHORT_ANSWER" ? "Trả lời ngắn" : "Đúng-Sai"}
                        </span>
                      )}
                    </div>
                    {q.type === "ESSAY" ? (
                      <p className="mt-1.5 text-xs italic" style={{ color: "#a4a097" }}>Câu tự luận — chấm điểm thủ công sau khi nộp bài.</p>
                    ) : q.type === "SHORT_ANSWER" ? (
                      <p className="mt-1.5 text-xs" style={{ color: "#16a34a" }}>Đáp án: <strong>{q.options[0]?.text ?? "—"}</strong></p>
                    ) : q.type === "TRUE_FALSE_CLUSTER" ? (
                      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                        {q.options.map(o => (
                          <div key={o.id} className="text-xs flex items-center gap-1.5" style={{ color: o.isCorrect ? "#16a34a" : "#dc2626" }}>
                            <span className="font-semibold">{o.subLabel})</span> <MathText text={o.text} />
                            <span className="font-semibold">{o.isCorrect ? "Đúng" : "Sai"}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                        {q.options.map((o, oi) => (
                          <div key={o.id} className="text-xs flex items-center gap-1.5" style={{ color: o.isCorrect ? "#16a34a" : "#787671" }}>
                            <span className="font-semibold">{String.fromCharCode(65 + oi)}.</span> <MathText text={o.text} /> {o.isCorrect && "✓"}
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="mt-1.5 text-xs" style={{ color: "#a4a097" }}>{q.points} điểm</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {!q.sourceBankItemId && (
                      <button onClick={() => setSaveToBank({ id: q.id, label: `Câu ${idx + 1}` })}
                        className="text-xs font-semibold" style={{ color: "#16a34a" }}>Lưu vào ngân hàng</button>
                    )}
                    <button onClick={() => setEditing(q)} className="text-xs font-semibold" style={{ color: "#0068FF" }}>Sửa</button>
                    <button onClick={() => setDel({ id: q.id, label: `Câu ${idx + 1}` })} className="text-xs font-semibold text-red-500">Xoá</button>
                  </div>
                </div>
              </div>
              </Fragment>
              );
            })}
          </div>
        )}
      </div>

      <QuestionDrawer
        open={editing !== null}
        initial={editing && editing !== "new" ? toForm(editing) : null}
        onClose={() => setEditing(null)}
        onSave={handleSave}
        saving={saving}
      />
      <BulkImportDrawer
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onImport={handleBulkImport}
        saving={bulkSaving}
        result={bulkResult}
        examId={id}
        showToast={showToast}
        onSaved={load}
      />
      <DelModal target={del} onClose={() => setDel(null)} onConfirm={handleDelete} />
      <SaveToBankModal target={saveToBank} onClose={() => setSaveToBank(null)} onSave={handleSaveToBank} saving={savingToBank} />
      <QuestionBankPicker open={bankPickerOpen} onClose={() => setBankPickerOpen(false)} onAdd={handleAddFromBank} />
      {toast && <AdminToast msg={toast.msg} ok={toast.ok} />}
    </div>
  );
}

export default function Page() {
  return (
    <PermissionGuard required={PERMISSIONS.MANAGE_CURRICULUM}>
      <ThiThuQuestionsPage />
    </PermissionGuard>
  );
}
