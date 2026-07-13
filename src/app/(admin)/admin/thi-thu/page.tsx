"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import PermissionGuard from "@/components/PermissionGuard";
import { PERMISSIONS } from "@/contexts/AuthContext";
import { AdminToast, useAdminToast } from "@/components/AdminToast";
import { type ExamStatus } from "@/lib/examData";
import { CATEGORY_GRADIENT, ADMIN_CATEGORIES } from "@/lib/courseData";
import { useExams } from "@/hooks/useExams";
import { api, type ExamFull, type ExamQuestionInput, type CourseFull } from "@/lib/api";
import { Toggle } from "@/components/Toggle";
import { toSlug } from "@/lib/slug";
import { parseBulkText, parseSpreadsheetRows, type ParseError } from "@/lib/examQuestionParser";

type ExamRow = ExamFull & { status: ExamStatus };

function computeExamStatus(date: string, time: string, active: boolean): ExamStatus {
  if (!active) return "completed";
  const [day, month, year] = (date || "01/01/2000").split("/");
  const [hh, mm] = (time || "00:00").split(":");
  const examDt = new Date(+year, +month - 1, +day, +hh, +mm);
  return examDt <= new Date() ? "available" : "upcoming";
}

// ─── CREATE EXAM DRAWER ───────────────────────────────────────────────────────
const DURATIONS = ["45 phút", "60 phút", "90 phút", "120 phút", "150 phút", "180 phút"];

interface CreateForm {
  title: string; category: string; date: string; time: string;
  duration: string; questions: string; azotaUrl: string;
  active: boolean; activeGuest: boolean;
}

const CREATE_INIT: CreateForm = {
  title: "", category: "ĐGNL HSA", date: "", time: "08:00",
  duration: "90 phút", questions: "80", azotaUrl: "",
  active: true, activeGuest: true,
};

// Select danh mục + khả năng gõ danh mục hoàn toàn mới (Exam.category là String tự do, không phải enum)
function CategoryField({ value, options, onChange, className }: {
  value: string; options: string[]; onChange: (v: string) => void; className: string;
}) {
  const [adding, setAdding] = useState(false);
  const [newCat, setNewCat] = useState("");

  function commit() {
    if (newCat.trim()) onChange(newCat.trim());
    setAdding(false);
    setNewCat("");
  }

  if (adding) {
    return (
      <div className="flex gap-2">
        <input
          autoFocus
          className={className}
          placeholder="Tên danh mục mới..."
          value={newCat}
          onChange={e => setNewCat(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") { setAdding(false); setNewCat(""); }
          }}
        />
        <button type="button" onClick={commit}
          className="px-3 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 flex-shrink-0">
          Xong
        </button>
      </div>
    );
  }

  return (
    <select
      className={className}
      value={value}
      onChange={e => e.target.value === "__add__" ? setAdding(true) : onChange(e.target.value)}
    >
      {options.map(c => <option key={c} value={c}>{c}</option>)}
      {value && !options.includes(value) && <option value={value}>{value}</option>}
      <option value="__add__">+ Thêm danh mục mới…</option>
    </select>
  );
}

function autoCode(category: string, exams: ExamRow[]): string {
  const prefix = category.includes("HSA") ? "HSA"
    : category.includes("HCM") ? "HCM"
    : category.includes("TSA") ? "TSA"
    : category.includes("BCA") ? "BCA"
    : "THPT";
  const count = exams.filter(e => e.code.startsWith(prefix)).length;
  return `${prefix}.${String(count + 1).padStart(2, "0")}`;
}

function CreateExamDrawer({ open, exams, categoryOptions, onClose, onCreated, showToast }: {
  open: boolean;
  exams: ExamRow[];
  categoryOptions: string[];
  onClose: () => void;
  onCreated: () => void;
  showToast: (msg: string, ok?: boolean) => void;
}) {
  const [form, setForm]     = useState<CreateForm>(CREATE_INIT);
  const [errors, setErrors] = useState<Partial<Record<keyof CreateForm, string>>>({});
  const [saving, setSaving] = useState(false);

  // ── Nhập câu hỏi trực tiếp lúc tạo đề (tùy chọn) ──────────────────────────
  const [rawText, setRawText]             = useState("");
  const [reviewQuestions, setReviewQuestions] = useState<ExamQuestionInput[] | null>(null);
  const [parseErrs, setParseErrs]         = useState<ParseError[]>([]);
  const [fileErr, setFileErr]             = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const inp = "w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200";

  useEffect(() => {
    if (!open) {
      setForm(CREATE_INIT); setErrors({}); setSaving(false);
      setRawText(""); setReviewQuestions(null); setParseErrs([]); setFileErr("");
    }
  }, [open]);

  // Số câu hỏi tự đồng bộ theo danh sách đã review
  useEffect(() => {
    if (reviewQuestions && reviewQuestions.length > 0) {
      setForm(p => ({ ...p, questions: String(reviewQuestions.length) }));
    }
  }, [reviewQuestions?.length]); // eslint-disable-line react-hooks/exhaustive-deps

  function runPreview() {
    const { questions, errors } = parseBulkText(rawText);
    setReviewQuestions(questions);
    setParseErrs(errors);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileErr("");
    const ext = file.name.split(".").pop()?.toLowerCase();
    try {
      if (ext === "txt") {
        const text = await file.text();
        setRawText(text);
        const { questions, errors } = parseBulkText(text);
        setReviewQuestions(questions);
        setParseErrs(errors);
      } else if (ext === "csv") {
        const Papa = await import("papaparse");
        const text = await file.text();
        const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true });
        const { questions, errors } = parseSpreadsheetRows(parsed.data);
        setReviewQuestions(questions);
        setParseErrs(errors);
      } else if (ext === "xlsx") {
        const { Workbook } = await import("exceljs");
        const wb = new Workbook();
        await wb.xlsx.load(await file.arrayBuffer());
        const sheet = wb.worksheets[0];
        const rows: unknown[][] = [];
        sheet?.eachRow(row => {
          const values = row.values as unknown[];
          rows.push(values.slice(1)); // row.values đánh số từ 1, index 0 rỗng
        });
        const { questions, errors } = parseSpreadsheetRows(rows);
        setReviewQuestions(questions);
        setParseErrs(errors);
      } else {
        setFileErr("Chỉ hỗ trợ file .txt, .csv, .xlsx");
      }
    } catch (err) {
      setFileErr("Không đọc được file: " + (err instanceof Error ? err.message : "lỗi không xác định"));
    } finally {
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
  // Đúng-Sai 4 ý: mỗi ý đúng/sai độc lập — không giống radio 1-trong-N của MC
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

  // Cập nhật category mặc định khi options load xong (tránh hiển thị blank)
  useEffect(() => {
    if (categoryOptions.length > 0 && !categoryOptions.includes(form.category)) {
      setForm(p => ({ ...p, category: categoryOptions[0] }));
    }
  }, [categoryOptions]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function set<K extends keyof CreateForm>(k: K, v: CreateForm[K]) {
    setForm(p => ({ ...p, [k]: v }));
    setErrors(p => ({ ...p, [k]: undefined }));
  }

  function validate(): boolean {
    const e: typeof errors = {};
    if (!form.title.trim()) e.title = "Tên đề thi không được để trống";
    if (!form.date)         e.date  = "Chọn ngày thi";
    if (!form.questions || isNaN(+form.questions) || +form.questions <= 0)
      e.questions = "Số câu phải là số dương";
    if (form.azotaUrl && !/^https?:\/\//.test(form.azotaUrl))
      e.azotaUrl = "URL không hợp lệ";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const examDate = form.date.split("-").reverse().join("/");
      const exam = await api.exams.create({
        id:           toSlug(form.title),
        code:         autoCode(form.category, exams),
        title:        form.title.trim(),
        category:     form.category,
        date:         examDate,
        time:         form.time,
        duration:     form.duration,
        questions:    +form.questions,
        status:       computeExamStatus(examDate, form.time, form.active),
        azotaUrl:     form.azotaUrl || null,
        participants: 0,
        active:       form.active,
        activeGuest:  form.activeGuest,
        createdAt:    new Date().toLocaleDateString("vi-VN"),
      });
      if (reviewQuestions && reviewQuestions.length > 0) {
        try {
          await api.examQuestions.bulkCreate(exam.id, reviewQuestions);
        } catch {
          showToast("Đề thi đã tạo nhưng lưu câu hỏi thất bại — vào \"Quản lý câu hỏi\" để thêm lại", false);
        }
      }
      onCreated();
      onClose();
    } catch (e) {
      showToast("Lỗi tạo đề thi: " + (e instanceof Error ? e.message : "Unknown"), false);
    } finally {
      setSaving(false);
    }
  }

  const previewCode = autoCode(form.category, exams);

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.3)" }} onClick={onClose} />
      )}
      <div
        className="fixed top-0 right-0 bottom-0 z-50 bg-white overflow-y-auto shadow-2xl"
        style={{
          width: "min(520px, 100vw)",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.28s cubic-bezier(.4,0,.2,1)",
          pointerEvents: open ? "auto" : "none",
          visibility: open ? "visible" : "hidden",
        }}>

        {/* Header */}
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <button onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors text-xl font-light">
              ×
            </button>
            <div>
              <h2 className="text-base font-bold text-gray-800">Tạo đề thi mới</h2>
              {form.title && (
                <p className="text-xs text-blue-600 font-semibold mt-0.5">
                  Mã: {previewCode}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors">
              Huỷ
            </button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition-opacity"
              style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", boxShadow: "0 4px 15px rgba(22,163,74,0.4), 0 2px 6px rgba(22,163,74,0.2)" }}>
              {saving ? "Đang lưu..." : "Lưu đề thi"}
            </button>
          </div>
        </div>

        {/* Form body */}
        <div className="p-5 space-y-6">

          {/* Thông tin cơ bản */}
          <section>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Thông tin cơ bản</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Tên đề thi <span className="text-red-500">*</span>
                </label>
                <input className={inp} placeholder="VD: Đề thi thử ĐGNL HSA #5 — Tổng ôn tháng 6"
                  value={form.title} onChange={e => set("title", e.target.value)} />
                {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Danh mục</label>
                <CategoryField className={inp + " bg-white"} value={form.category} options={categoryOptions}
                  onChange={v => set("category", v)} />
              </div>
            </div>
          </section>

          {/* Lịch thi */}
          <section>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Lịch thi</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Ngày thi <span className="text-red-500">*</span>
                </label>
                <input type="date" className={inp} value={form.date} onChange={e => set("date", e.target.value)} />
                {errors.date && <p className="text-xs text-red-500 mt-1">{errors.date}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Giờ bắt đầu</label>
                <input type="time" className={inp} value={form.time} onChange={e => set("time", e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Thời lượng</label>
                <select className={inp + " bg-white"} value={form.duration} onChange={e => set("duration", e.target.value)}>
                  {DURATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Số câu hỏi <span className="text-red-500">*</span>
                </label>
                <input type="number" min="1" max="300" className={inp} value={form.questions}
                  readOnly={!!reviewQuestions?.length}
                  onChange={e => set("questions", e.target.value)} />
                {errors.questions && <p className="text-xs text-red-500 mt-1">{errors.questions}</p>}
                {!!reviewQuestions?.length && <p className="text-xs text-gray-400 mt-1">Tự động theo số câu đã nhập bên dưới</p>}
              </div>
            </div>
          </section>

          {/* Câu hỏi thi */}
          <section>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Câu hỏi thi (tùy chọn)</h3>

            {reviewQuestions === null ? (
              <div className="space-y-3">
                <div className="text-xs p-3 rounded-lg" style={{ background: "#f6f5f4", color: "#787671" }}>
                  Dán danh sách câu hỏi hoặc tải file (.txt, .csv, .xlsx). Mỗi câu hỏi 1 khối, cách nhau bởi dòng trống — loại câu hỏi tự nhận diện theo nội dung khối:
                  <pre className="mt-1.5 whitespace-pre-wrap text-[11px]" style={{ color: "#1a1a1a" }}>{`Câu 1: Trắc nghiệm...
*A. Đáp án đúng
B. Đáp án sai

Câu 2: Đoạn dẫn cho 4 ý Đúng-Sai...
*a)[0,NB] Ý đúng
b)[1,NB] Ý sai

Câu 3: Câu tự luận không có đáp án nào cả.`}</pre>
                  <p className="mt-1.5">File .csv/.xlsx: chỉ hỗ trợ trắc nghiệm, cột theo thứ tự Câu hỏi | Đáp án A | B | C | D | Đáp án đúng | Điểm (tùy chọn), dòng đầu là tiêu đề.</p>
                </div>
                <textarea
                  className={inp + " font-mono"}
                  rows={6}
                  placeholder="Dán câu hỏi vào đây..."
                  value={rawText}
                  onChange={e => setRawText(e.target.value)}
                />
                <div className="flex items-center gap-2">
                  <button type="button" onClick={runPreview} disabled={!rawText.trim()}
                    className="px-3 py-2 text-sm font-semibold rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                    Xem trước câu hỏi
                  </button>
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-2 text-sm font-semibold rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
                    Tải file lên
                  </button>
                  <input ref={fileInputRef} type="file" accept=".txt,.csv,.xlsx" className="hidden" onChange={handleFile} />
                </div>
                {fileErr && <p className="text-xs text-red-500">{fileErr}</p>}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold" style={{ color: "#16a34a" }}>
                    {reviewQuestions.length} câu hỏi hợp lệ — xem lại trước khi lưu
                  </p>
                  <button type="button" onClick={() => { setReviewQuestions(null); setParseErrs([]); }}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700">
                    ← Quay lại chỉnh sửa
                  </button>
                </div>

                {parseErrs.length > 0 && (
                  <ul className="text-xs text-red-600 space-y-1 p-2 rounded-lg" style={{ background: "#fef2f2" }}>
                    {parseErrs.map((e, i) => <li key={i}>Khối {e.block}: {e.message}</li>)}
                  </ul>
                )}

                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {reviewQuestions.map((q, idx) => (
                    <div key={idx} className="rounded-lg p-3 border border-gray-200 bg-gray-50">
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
                      {q.type === "ESSAY" ? (
                        <p className="pl-6 text-xs italic text-gray-400">Tự luận — không cần đáp án, chấm tay sau khi nộp bài.</p>
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
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Azota */}
          <section>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Liên kết Azota</h3>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">URL đề thi trên Azota</label>
              <input className={inp} placeholder="https://azota.vn/de-thi/..."
                value={form.azotaUrl} onChange={e => set("azotaUrl", e.target.value)} />
              {errors.azotaUrl && <p className="text-xs text-red-500 mt-1">{errors.azotaUrl}</p>}
              <p className="text-xs text-gray-400 mt-1">Học viên sẽ được chuyển hướng đến đây khi bấm "Vào thi"</p>
            </div>
          </section>

          {/* Công khai & Trạng thái */}
          <section>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Công khai & Trạng thái</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between py-3 px-4 rounded-lg" style={{ background: "#F9FAFB", border: "1px solid #E5E7EB" }}>
                <div>
                  <p className="text-sm font-medium text-gray-700">Trạng thái</p>
                  <p className="text-xs text-gray-400">Tắt = kết thúc · trạng thái tự động từ lịch</p>
                </div>
                <Toggle checked={form.active} onChange={() => set("active", !form.active)} />
              </div>
              <div className="flex items-center justify-between py-3 px-4 rounded-lg" style={{ background: "#F9FAFB", border: "1px solid #E5E7EB" }}>
                <div>
                  <p className="text-sm font-medium text-gray-700">Công khai</p>
                  <p className="text-xs text-gray-400">Chưa đăng nhập vẫn thấy đề thi này</p>
                </div>
                <Toggle checked={form.activeGuest} onChange={() => set("activeGuest", !form.activeGuest)} />
              </div>
            </div>
          </section>

          {/* Preview */}
          {form.title && form.date && (
            <div className="p-4 rounded-xl border border-dashed border-blue-300 bg-blue-50">
              <p className="text-xs font-bold text-blue-600 mb-2">Preview — trạng thái tự động:</p>
              <div className="flex items-center gap-3">
                <span className="px-2 py-0.5 rounded text-xs font-bold text-white"
                  style={{ background: CATEGORY_GRADIENT[form.category] ?? "linear-gradient(135deg,#374151,#1E2938)" }}>
                  {previewCode}
                </span>
                <span className="text-sm font-medium text-gray-800 flex-1 truncate">{form.title}</span>
                {(() => {
                  const st = computeExamStatus(form.date.split("-").reverse().join("/"), form.time, form.active);
                  const cfg = { upcoming: { label: "Sắp diễn ra", bg: "#DBEAFE", color: "#0068FF" }, available: { label: "Đang mở", bg: "#D1FAE5", color: "#00A63D" }, completed: { label: "Đã kết thúc", bg: "#F3F4F6", color: "#6B7280" } }[st];
                  return <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>;
                })()}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {form.date.split("-").reverse().join("/")} · {form.time} · {form.duration} · {form.questions} câu
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── DATE HELPERS ────────────────────────────────────────────────────────────
function toInputDate(d: string) {
  if (!d || !d.includes("/")) return "";
  const [day, month, year] = d.split("/");
  return `${year}-${month}-${day}`;
}
function fromInputDate(d: string) {
  return d ? d.split("-").reverse().join("/") : "";
}

// ─── EDIT EXAM DRAWER ────────────────────────────────────────────────────────
const DEFAULT_CLUSTER_PERCENTS = ["10", "25", "50", "100"];

interface EditForm {
  title: string; category: string; date: string; time: string;
  duration: string; questions: string; azotaUrl: string;
  active: boolean; activeGuest: boolean;
  price: string; // rỗng = miễn phí
  courseId: string; // rỗng = không gắn khoá học nào
  clusterPercents: string[]; // 4 ô % cho câu Đúng-Sai (1-4 ý đúng)
  requirePassword: boolean;
  password: string; // rỗng khi requirePassword=true nghĩa là giữ nguyên mật khẩu cũ (nếu đã có)
  showLeaderboard: boolean;
}

function EditExamDrawer({ exam, categoryOptions, onClose, onSaved, showToast }: {
  exam: ExamRow | null;
  categoryOptions: string[];
  onClose: () => void;
  onSaved: () => void;
  showToast: (msg: string, ok?: boolean) => void;
}) {
  const open = exam !== null;
  const [form, setForm]     = useState<EditForm | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof EditForm, string>>>({});
  const [saving, setSaving] = useState(false);
  const [courses, setCourses] = useState<CourseFull[]>([]);

  const inp = "w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200";

  // Khởi tạo form từ exam data khi mở
  useEffect(() => {
    if (exam) {
      setForm({
        title:     exam.title,
        category:  exam.category,
        date:      toInputDate(exam.date),
        time:      exam.time,
        duration:  exam.duration,
        questions: String(exam.questions),
        azotaUrl:     exam.azotaUrl ?? "",
        active:       exam.active,
        activeGuest:  exam.activeGuest ?? true,
        price:        exam.price ? String(exam.price) : "",
        courseId:     exam.courseId ?? "",
        clusterPercents: exam.clusterScorePercents?.length === 4
          ? exam.clusterScorePercents.map(String)
          : [...DEFAULT_CLUSTER_PERCENTS],
        requirePassword: exam.hasPassword ?? false,
        password:        "", // để trống = giữ nguyên mật khẩu cũ (nếu có); server không bao giờ trả mật khẩu thật
        showLeaderboard: exam.showLeaderboard ?? true,
      });
      setErrors({});
    }
  }, [exam?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Danh sách khoá học để gắn đề thi — chỉ tải khi drawer mở
  useEffect(() => {
    if (open) api.courses.list({ all: "1" }).then(setCourses).catch(() => setCourses([]));
  }, [open]);

  // Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function set<K extends keyof EditForm>(k: K, v: EditForm[K]) {
    setForm(p => p ? { ...p, [k]: v } : p);
    setErrors(p => ({ ...p, [k]: undefined }));
  }

  function validate(): boolean {
    if (!form) return false;
    const e: typeof errors = {};
    if (!form.title.trim()) e.title = "Tên đề thi không được để trống";
    if (!form.date)         e.date  = "Chọn ngày thi";
    if (!form.questions || isNaN(+form.questions) || +form.questions <= 0)
      e.questions = "Số câu phải là số dương";
    if (form.azotaUrl && !/^https?:\/\//.test(form.azotaUrl))
      e.azotaUrl = "URL không hợp lệ";
    if (form.price && (isNaN(+form.price) || +form.price < 0))
      e.price = "Phí phải là số không âm";
    if (form.clusterPercents.some(p => p === "" || isNaN(+p) || +p < 0 || +p > 100))
      e.clusterPercents = "Mỗi ô phải là số từ 0 đến 100";
    if (form.requirePassword && !form.password.trim() && !(exam?.hasPassword))
      e.password = "Nhập mật khẩu cho đề thi";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate() || !form || !exam) return;
    setSaving(true);
    try {
      const examDate = fromInputDate(form.date);
      const isDefaultPercents = form.clusterPercents.every((p, i) => p === DEFAULT_CLUSTER_PERCENTS[i]);
      await api.exams.update(exam.id, {
        title:     form.title.trim(),
        category:  form.category,
        date:      examDate,
        time:      form.time,
        duration:  form.duration,
        questions: +form.questions,
        status:    computeExamStatus(examDate, form.time, form.active),
        azotaUrl:    form.azotaUrl || null,
        active:       form.active,
        activeGuest:  form.activeGuest,
        price:        form.price ? +form.price : null,
        courseId:     form.courseId || null,
        clusterScorePercents: isDefaultPercents ? null : form.clusterPercents.map(Number),
        // requirePassword=false → xoá mật khẩu. true + có gõ mới → đổi.
        // true + để trống + đã có mật khẩu cũ → giữ nguyên (không gửi key này).
        ...(!form.requirePassword
          ? { password: null }
          : form.password.trim()
          ? { password: form.password.trim() }
          : {}),
        showLeaderboard: form.showLeaderboard,
      } as Partial<ExamFull>);
      onSaved();
      onClose();
    } catch (e) {
      showToast("Lỗi lưu đề thi: " + (e instanceof Error ? e.message : "Unknown"), false);
    } finally {
      setSaving(false);
    }
  }

  if (!form) return null;

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.3)" }} onClick={onClose} />
      )}
      <div
        className="fixed top-0 right-0 bottom-0 z-50 bg-white overflow-y-auto shadow-2xl"
        style={{
          width: "min(520px, 100vw)",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.28s cubic-bezier(.4,0,.2,1)",
          pointerEvents: open ? "auto" : "none",
          visibility: open ? "visible" : "hidden",
        }}>

        {/* Header */}
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <button onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors text-xl font-light">
              ×
            </button>
            <div>
              <h2 className="text-base font-bold text-gray-800">Chỉnh sửa đề thi</h2>
              {exam && (
                <span className="text-xs font-bold text-white px-2 py-0.5 rounded mt-0.5 inline-block"
                  style={{ background: CATEGORY_GRADIENT[exam.category] ?? "linear-gradient(135deg,#374151,#1E2938)" }}>
                  {exam.code}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors">
              Huỷ
            </button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition-opacity"
              style={{ background: "linear-gradient(145deg,#0055D4,#0042AA)" }}>
              {saving ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="p-5 space-y-6">

          {/* Thông tin cơ bản */}
          <section>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Thông tin cơ bản</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Tên đề thi <span className="text-red-500">*</span>
                </label>
                <input className={inp} value={form.title} onChange={e => set("title", e.target.value)} />
                {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Mã đề</label>
                  <input className={inp + " bg-gray-50 cursor-not-allowed"} value={exam?.code ?? ""} readOnly />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Danh mục</label>
                  <CategoryField className={inp + " bg-white"} value={form.category} options={categoryOptions}
                    onChange={v => set("category", v)} />
                </div>
              </div>
            </div>
          </section>

          {/* Lịch thi */}
          <section>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Lịch thi</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Ngày thi <span className="text-red-500">*</span>
                </label>
                <input type="date" className={inp} value={form.date} onChange={e => set("date", e.target.value)} />
                {errors.date && <p className="text-xs text-red-500 mt-1">{errors.date}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Giờ bắt đầu</label>
                <input type="time" className={inp} value={form.time} onChange={e => set("time", e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Thời lượng</label>
                <select className={inp + " bg-white"} value={form.duration} onChange={e => set("duration", e.target.value)}>
                  {DURATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Số câu hỏi <span className="text-red-500">*</span>
                </label>
                <input type="number" min="1" max="300" className={inp} value={form.questions}
                  onChange={e => set("questions", e.target.value)} />
                {errors.questions && <p className="text-xs text-red-500 mt-1">{errors.questions}</p>}
              </div>
            </div>
          </section>

          {/* Azota */}
          <section>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Liên kết Azota</h3>
            <input className={inp} placeholder="https://azota.vn/de-thi/..."
              value={form.azotaUrl} onChange={e => set("azotaUrl", e.target.value)} />
            {errors.azotaUrl && <p className="text-xs text-red-500 mt-1">{errors.azotaUrl}</p>}
            {form.azotaUrl && (
              <a href={form.azotaUrl} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1">
                🔗 Mở Azota để kiểm tra
              </a>
            )}
          </section>

          {/* Công khai & Trạng thái */}
          <section>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Công khai & Trạng thái</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between py-3 px-4 rounded-lg" style={{ background: "#F9FAFB", border: "1px solid #E5E7EB" }}>
                <div>
                  <p className="text-sm font-medium text-gray-700">Trạng thái</p>
                  <p className="text-xs text-gray-400">Tắt = kết thúc đề thi · trạng thái tự động từ lịch</p>
                </div>
                <Toggle checked={form.active} onChange={() => set("active", !form.active)} />
              </div>
              <div className="flex items-center justify-between py-3 px-4 rounded-lg" style={{ background: "#F9FAFB", border: "1px solid #E5E7EB" }}>
                <div>
                  <p className="text-sm font-medium text-gray-700">Công khai</p>
                  <p className="text-xs text-gray-400">Chưa đăng nhập vẫn thấy đề thi này</p>
                </div>
                <Toggle checked={form.activeGuest} onChange={() => set("activeGuest", !form.activeGuest)} />
              </div>
              <div className="flex items-center justify-between py-3 px-4 rounded-lg" style={{ background: "#F9FAFB", border: "1px solid #E5E7EB" }}>
                <div>
                  <p className="text-sm font-medium text-gray-700">Bảng xếp hạng</p>
                  <p className="text-xs text-gray-400">Học viên xem được Top 10 điểm cao nhất của đề này</p>
                </div>
                <Toggle checked={form.showLeaderboard} onChange={() => set("showLeaderboard", !form.showLeaderboard)} />
              </div>
              <div className="py-3 px-4 rounded-lg" style={{ background: "#F9FAFB", border: "1px solid #E5E7EB" }}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-gray-700">Mật khẩu vào thi</p>
                  <Toggle checked={form.requirePassword} onChange={() => set("requirePassword", !form.requirePassword)} />
                </div>
                <p className="text-xs text-gray-400 mb-2">Học viên phải nhập đúng mật khẩu này mới bắt đầu làm bài — đọc tại chỗ trong phòng thi có giám sát.</p>
                {form.requirePassword && (
                  <>
                    <input type="text" className={inp}
                      placeholder={exam?.hasPassword ? "Để trống để giữ nguyên mật khẩu cũ" : "Nhập mật khẩu"}
                      value={form.password} onChange={e => set("password", e.target.value)} />
                    {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
                  </>
                )}
              </div>
              <div className="py-3 px-4 rounded-lg" style={{ background: "#F9FAFB", border: "1px solid #E5E7EB" }}>
                <p className="text-sm font-medium text-gray-700 mb-1">Khoá học liên quan</p>
                <p className="text-xs text-gray-400 mb-2">Học viên đã đăng ký khoá học này luôn thi miễn phí, bất kể phí bên dưới.</p>
                <select className={inp} value={form.courseId} onChange={e => set("courseId", e.target.value)}>
                  <option value="">— Không gắn khoá học nào —</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="py-3 px-4 rounded-lg" style={{ background: "#F9FAFB", border: "1px solid #E5E7EB" }}>
                <p className="text-sm font-medium text-gray-700 mb-1">Phí thi (VNĐ)</p>
                <p className="text-xs text-gray-400 mb-2">Bỏ trống = miễn phí cho tất cả. Có phí thì học viên khoá học ở trên vẫn miễn phí, người khác cần admin duyệt thủ công ở trang quản lý câu hỏi.</p>
                <input type="number" min="0" placeholder="Miễn phí" className={inp}
                  value={form.price} onChange={e => set("price", e.target.value)} />
                {errors.price && <p className="text-xs text-red-500 mt-1">{errors.price}</p>}
              </div>
              <div className="py-3 px-4 rounded-lg" style={{ background: "#F9FAFB", border: "1px solid #E5E7EB" }}>
                <p className="text-sm font-medium text-gray-700 mb-1">Thang điểm câu Đúng-Sai 4 ý (%)</p>
                <p className="text-xs text-gray-400 mb-2">% điểm câu nhận được theo số ý trả lời đúng — mặc định 10/25/50/100% (giống Azota).</p>
                <div className="grid grid-cols-4 gap-2">
                  {form.clusterPercents.map((p, idx) => (
                    <div key={idx}>
                      <label className="block text-[11px] text-gray-500 mb-1">{idx + 1} ý đúng</label>
                      <input type="number" min="0" max="100" className={inp}
                        value={p}
                        onChange={e => {
                          const next = [...form.clusterPercents];
                          next[idx] = e.target.value;
                          set("clusterPercents", next);
                        }} />
                    </div>
                  ))}
                </div>
                {errors.clusterPercents && <p className="text-xs text-red-500 mt-1">{errors.clusterPercents}</p>}
              </div>
              <div className="flex items-center gap-2 px-1">
                <span className="text-xs text-gray-400">Trạng thái:</span>
                {(() => {
                  const st = computeExamStatus(fromInputDate(form.date), form.time, form.active);
                  const cfg = { upcoming: { label: "Sắp diễn ra", bg: "#DBEAFE", color: "#0068FF" }, available: { label: "Đang mở", bg: "#D1FAE5", color: "#00A63D" }, completed: { label: "Đã kết thúc", bg: "#F3F4F6", color: "#6B7280" } }[st];
                  return <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>;
                })()}
              </div>
            </div>
          </section>

          {/* Thống kê readonly */}
          {exam && (
            <section>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Thống kê</h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Thí sinh",  val: exam.participants.toLocaleString("vi-VN") },
                  { label: "Ngày tạo", val: exam.createdAt },
                  { label: "Hiển thị", val: exam.active ? "Đang hiển thị" : "Đang ẩn" },
                ].map(s => (
                  <div key={s.label} className="rounded-lg p-3 bg-gray-50 border border-gray-100">
                    <p className="text-xs text-gray-400">{s.label}</p>
                    <p className="text-sm font-semibold text-gray-700 mt-0.5">{s.val}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

function countByStatus(exams: ExamRow[]) {
  return {
    total:     exams.length,
    upcoming:  exams.filter(e => e.status === "upcoming").length,
    available: exams.filter(e => e.status === "available").length,
    completed: exams.filter(e => e.status === "completed").length,
  };
}

const STATUS_CFG: Record<ExamStatus, { label: string; color: string; bg: string }> = {
  upcoming:  { label: "Sắp diễn ra", color: "#0068FF", bg: "#DBEAFE" },
  available: { label: "Đang mở",     color: "#00A63D", bg: "#D1FAE5" },
  completed: { label: "Đã kết thúc", color: "#6B7280", bg: "#F3F4F6" },
};

function ActionMenu({ exam, onEdit, onDelete }: { exam: ExamRow; onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} className="relative inline-block">
      <button onClick={() => setOpen(p => !p)}
        className="w-8 h-8 rounded-full flex items-center justify-center text-blue-400 border border-blue-200 hover:bg-blue-50 transition-colors text-lg font-bold"
        style={{ lineHeight: 1 }}>···
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-48 rounded-lg shadow-xl border border-gray-200 bg-white py-1">
          <button onClick={() => { setOpen(false); onEdit(); }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left cursor-pointer">
            Chỉnh sửa
          </button>
          {exam.azotaUrl && (
            <a href={exam.azotaUrl} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
              <span className="w-5 text-center">🔗</span> Xem Azota
            </a>
          )}
          <Link href={`/student/thi-thu/${exam.id}`} target="_blank" onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-gray-50"
            style={{ color: "#0068FF" }}>
            <span className="w-5 text-center">👁</span> Xem portal học viên
          </Link>
          <Link href={`/admin/thi-thu/${exam.id}`} onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-gray-50"
            style={{ color: "#0068FF" }}>
            <span className="w-5 text-center">📝</span> Quản lý câu hỏi
          </Link>
          <div className="border-t border-gray-100 my-1" />
          <button onClick={() => { setOpen(false); onDelete(); }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50">
            Xóa đề thi
          </button>
        </div>
      )}
    </div>
  );
}

export default function ThiThuAdminPage() {
  const { data: apiExams, loading, refetch } = useExams();

  // Re-compute status mỗi phút để badge tự cập nhật không cần reload
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const exams: ExamRow[] = apiExams.map(e => ({ ...e, status: computeExamStatus(e.date, e.time, e.active) }));
  const stats = countByStatus(exams);

  // Filter dropdown: chỉ hiện danh mục thực sự đang có đề thi
  const examCategories = [...new Set(exams.map(e => e.category))].filter(Boolean).sort();
  // Danh mục cho drawer tạo/sửa: danh sách chuẩn + danh mục custom đã dùng (không phụ thuộc đề thi hiện có)
  const categoryOptions = [...new Set([...ADMIN_CATEGORIES, ...examCategories])];

  const { toast, showToast } = useAdminToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ExamRow | null>(null);
  const [search, setSearch]         = useState("");
  const [catFilter, setCat]         = useState("");
  const [statusFilter, setStatus]   = useState("");
  const [page, setPage]             = useState(1);
  const PAGE_SIZE = 5;

  const filtered = exams.filter(e => {
    if (search && !e.title.toLowerCase().includes(search.toLowerCase()) && !e.code.toLowerCase().includes(search.toLowerCase())) return false;
    if (catFilter && e.category !== catFilter) return false;
    if (statusFilter && e.status !== statusFilter) return false;
    return true;
  });

  // Reset về trang 1 khi filter thay đổi
  useEffect(() => { setPage(1); }, [search, catFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged      = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function toggleActive(id: string) {
    const exam = exams.find(e => e.id === id);
    if (!exam) return;
    const newActive = !exam.active;
    api.exams.update(id, {
      active: newActive,
      status: computeExamStatus(exam.date, exam.time, newActive),
    })
      .then(refetch)
      .catch(e => showToast("Lỗi cập nhật: " + e.message, false));
  }
  function deleteExam(id: string) {
    if (!confirm("Xóa đề thi này?")) return;
    api.exams.remove(id)
      .then(refetch)
      .catch(e => showToast("Lỗi xóa đề thi: " + e.message, false));
  }

  return (
    <PermissionGuard required={PERMISSIONS.MANAGE_CURRICULUM}>
      {toast && <AdminToast msg={toast.msg} ok={toast.ok} />}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col min-w-0" style={{ height: "calc(100vh - 104px)" }}>

        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-gray-100 flex-shrink-0">
          <h1 className="text-lg font-extrabold" style={{ color: "#1E2938" }}>Quản lý Thi thử</h1>
          <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>Tạo và quản lý đề thi thử ĐGNL, THPT</p>
        </div>

        {/* Stats — compact inline */}
        <div className="px-5 py-2.5 flex items-center gap-5 border-b border-gray-100">
          {[
            { label: "Tổng đề",      val: stats.total,     color: "#374151" },
            { label: "Sắp diễn ra",  val: stats.upcoming,  color: "#0068FF" },
            { label: "Đang mở",      val: stats.available, color: "#00A63D" },
            { label: "Đã kết thúc",  val: stats.completed, color: "#6B7280" },
          ].map((s, i) => (
            <div key={s.label} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-gray-200 mr-2">|</span>}
              <span className="text-lg font-extrabold" style={{ color: s.color }}>{s.val}</span>
              <span className="text-xs text-gray-400">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="px-5 pt-3 pb-2 grid grid-cols-1 sm:grid-cols-3 gap-2 border-b border-gray-100">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Tìm kiếm</label>
            <input type="text" placeholder="Tên hoặc mã đề..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-blue-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Danh mục</label>
            <select value={catFilter} onChange={e => setCat(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none bg-white focus:border-blue-400">
              <option value="">Tất cả danh mục</option>
              {examCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Trạng thái</label>
            <select value={statusFilter} onChange={e => setStatus(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none bg-white focus:border-blue-400">
              <option value="">Tất cả trạng thái</option>
              <option value="upcoming">Sắp diễn ra</option>
              <option value="available">Đang mở</option>
              <option value="completed">Đã kết thúc</option>
            </select>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 py-2 flex items-center justify-between border-b border-gray-100">
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white cursor-pointer transition-all duration-150 hover:-translate-y-0.5 active:scale-[0.98]"
            style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", boxShadow: "0 4px 15px rgba(22,163,74,0.4), 0 2px 6px rgba(22,163,74,0.2)" }}>
            + Tạo đề thi mới
          </button>
          <button onClick={() => { setSearch(""); setCat(""); setStatus(""); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-50">
            ↺ Làm mới
          </button>
        </div>

        {/* Table — flex-1, overflow-auto để tự scroll dọc nếu cần */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {["Mã đề", "Tên đề thi", "Danh mục", "Ngày thi", "Thời lượng", "Câu hỏi", "Tình trạng"].map(h => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
                <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Học viên</th>
                <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Công khai</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {Array.from({ length: 10 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 rounded bg-gray-200" style={{ width: j === 1 ? 160 : 60 }} />
                    </td>
                  ))}
                </tr>
              ))}
              {!loading && paged.map(exam => {
                const s = STATUS_CFG[exam.status];
                const grad = CATEGORY_GRADIENT[exam.category] ?? "linear-gradient(135deg,#374151,#1E2938)";
                return (
                  <tr key={exam.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 rounded text-xs font-bold text-white"
                        style={{ background: grad }}>{exam.code}</span>
                    </td>
                    <td className="px-4 py-2.5 max-w-[240px]">
                      <p className="font-medium text-gray-800 truncate">{exam.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{exam.participants} thí sinh</p>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">{exam.category}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-600 whitespace-nowrap">
                      {exam.date}<br /><span className="text-gray-400">{exam.time}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-600 whitespace-nowrap">{exam.duration}</td>
                    <td className="px-4 py-2.5 text-sm font-semibold text-gray-700">{exam.questions}</td>
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{ background: s.bg, color: s.color }}>{s.label}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-center">
                        <Toggle checked={exam.active} onChange={() => toggleActive(exam.id)} />
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-center">
                        <Toggle checked={exam.activeGuest ?? true} onChange={() => {
                          api.exams.update(exam.id, { activeGuest: !(exam.activeGuest ?? true) }).then(refetch).catch(e => showToast("Lỗi: " + e.message, false));
                        }} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ActionMenu exam={exam} onEdit={() => setEditTarget(exam)} onDelete={() => deleteExam(exam.id)} />
                    </td>
                  </tr>
                );
              })}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-gray-400 text-sm">Không tìm thấy đề thi nào</td>
                </tr>
              )}
              {!loading && filtered.length > 0 && paged.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-gray-400 text-sm">Trang này không có dữ liệu</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer + Pagination */}
        <div className="px-5 py-2.5 border-t border-gray-100 flex-shrink-0 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            {filtered.length}/{exams.length} đề thi
            {totalPages > 1 && ` · Trang ${page}/${totalPages}`}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-7 h-7 rounded-lg text-xs font-semibold border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition-colors cursor-pointer">
                ‹
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  className="w-7 h-7 rounded-lg text-xs font-semibold border transition-colors cursor-pointer"
                  style={p === page
                    ? { background: "#16a34a", color: "white", borderColor: "#16a34a" }
                    : { borderColor: "#E5E7EB", color: "#6B7280" }}>
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="w-7 h-7 rounded-lg text-xs font-semibold border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition-colors cursor-pointer">
                ›
              </button>
            </div>
          )}
        </div>
      </div>

      <CreateExamDrawer
        open={createOpen}
        exams={exams}
        categoryOptions={categoryOptions}
        onClose={() => setCreateOpen(false)}
        onCreated={() => { showToast("Đã tạo đề thi mới"); refetch(); }}
        showToast={showToast}
      />
      <EditExamDrawer
        exam={editTarget}
        categoryOptions={categoryOptions}
        onClose={() => setEditTarget(null)}
        onSaved={() => { showToast("Đã lưu đề thi"); refetch(); }}
        showToast={showToast}
      />
    </PermissionGuard>
  );
}
