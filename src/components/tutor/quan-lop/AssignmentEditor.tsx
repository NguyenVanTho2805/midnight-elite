// GS-LOP-GON — "Bài tập tự nộp" của một bài học (+ form, chấm bài, kết quả làm trên web), CẮT NGUYÊN VĂN từ admin/khoa-hoc/[id]/page.tsx (chỉ thêm `export`).
"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { api, type AssignmentFull, type AssignmentInput, type AssignmentQuestionInput, type AssignmentSubmissionFull, type AssignmentResultsData, type ExamQuestionInput } from "@/lib/api";
import { MathText } from "@/components/MathText";
import { useKinConfirm } from "@/components/kin/useConfirm";
import { AiQuotaNote } from "@/components/AiQuotaNote";
import { DropZone } from "@/components/DropZone";
import { checkLinkForSlot } from "@/lib/mediaLink";

function fmtDue(d: string | null): string {
  if (!d) return "";
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()}`;
}

// ─── BÀI TẬP "LÀM TRÊN WEB" — chỉ đặt câu hỏi lúc TẠO MỚI ─────────────────────
// Không cho sửa câu hỏi của 1 bài "interactive" đã tạo (xem AssignmentForm bên
// dưới): học viên có thể đã trả lời, đổi options/isCorrect tại chỗ sẽ làm sai
// lệch isCorrect đã chấm sẵn trong AssignmentAnswer. Muốn đổi câu hỏi thì xoá
// tạo lại bài tập mới — chấp nhận được vì đây là luồng ít xảy ra.
interface LocalOption { text: string; isCorrect: boolean }
// points giữ dạng string (giống maxPoints ở AssignmentForm) — ép về number lúc
// nhập từng ký tự sẽ nuốt mất dấu "." đang gõ dở (vd gõ "1.5" bị rớt về "1"
// ngay khi vừa gõ "."), chỉ ép số thật lúc Lưu (xem handleSaveClick).
interface LocalQuestion { text: string; type: "MC" | "ESSAY"; points: string; imageUrl?: string; options: LocalOption[] }

// AI trích được cả TRUE_FALSE_CLUSTER/SHORT_ANSWER (dùng cho đề thi) — bài tập
// web v1 chỉ hỗ trợ MC/ESSAY (xem quyết định phạm vi), lọc bỏ phần còn lại.
function toLocalQuestions(parsed: ExamQuestionInput[]): { kept: LocalQuestion[]; skipped: number } {
  const kept: LocalQuestion[] = [];
  let skipped = 0;
  for (const q of parsed) {
    if (q.type === "MC") {
      kept.push({ text: q.text, type: "MC", points: String(q.points ?? 1), imageUrl: q.imageUrl, options: q.options.map(o => ({ text: o.text, isCorrect: o.isCorrect })) });
    } else if (q.type === "ESSAY") {
      kept.push({ text: q.text, type: "ESSAY", points: String(q.points ?? 1), imageUrl: q.imageUrl, options: [] });
    } else {
      skipped++;
    }
  }
  return { kept, skipped };
}

function QuestionRow({ q, qi, onChange, onRemove }: {
  q: LocalQuestion; qi: number;
  onChange: (patch: Partial<LocalQuestion>) => void;
  onRemove: () => void;
}) {
  const inpSm = "px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-blue-400 bg-[var(--kin-nen-trang)] w-full";

  function setType(type: "MC" | "ESSAY") {
    onChange(type === "MC"
      ? { type, options: q.options.length >= 2 ? q.options : [{ text: "", isCorrect: true }, { text: "", isCorrect: false }] }
      : { type, options: [] });
  }
  function updateOption(oi: number, text: string) {
    onChange({ options: q.options.map((o, i) => i === oi ? { ...o, text } : o) });
  }
  function setCorrect(oi: number) {
    onChange({ options: q.options.map((o, i) => ({ ...o, isCorrect: i === oi })) });
  }

  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-2.5 space-y-1.5">
      <div className="flex items-start gap-2">
        <span className="text-xs font-semibold text-gray-400 pt-1.5 flex-shrink-0">Câu {qi + 1}</span>
        <textarea className={inpSm + " resize-none flex-1"} rows={2} placeholder="Nội dung câu hỏi"
          value={q.text} onChange={e => onChange({ text: e.target.value })} />
        <button type="button" onClick={onRemove} className="text-xs px-1.5 text-red-400 hover:bg-red-50 rounded flex-shrink-0">✕</button>
      </div>
      {q.imageUrl && <img src={q.imageUrl} alt="" className="max-h-32 rounded-lg border border-gray-200 ml-[52px]" />}
      <div className="flex items-center gap-2 pl-[52px]">
        <select className={inpSm + " w-28"} value={q.type} onChange={e => setType(e.target.value as "MC" | "ESSAY")}>
          <option value="MC">Trắc nghiệm</option>
          <option value="ESSAY">Tự luận</option>
        </select>
        <input type="number" min={0.25} step={0.25} className={inpSm + " w-16"} value={q.points} title="Điểm"
          onChange={e => onChange({ points: e.target.value })} />
      </div>
      {q.type === "MC" && (
        <div className="pl-[52px] space-y-1">
          {q.options.map((o, oi) => (
            <div key={oi} className="flex items-center gap-1.5">
              <input type="radio" checked={o.isCorrect} onChange={() => setCorrect(oi)} className="flex-shrink-0" />
              <input className={inpSm} placeholder={`Đáp án ${String.fromCharCode(65 + oi)}`} value={o.text}
                onChange={e => updateOption(oi, e.target.value)} />
              {q.options.length > 2 && (
                <button type="button" onClick={() => onChange({ options: q.options.filter((_, i) => i !== oi) })}
                  className="text-xs px-1 text-red-400 flex-shrink-0">✕</button>
              )}
            </div>
          ))}
          <button type="button" onClick={() => onChange({ options: [...q.options, { text: "", isCorrect: false }] })}
            className="text-xs font-semibold" style={{ color: "var(--kin-nhan-link)" }}>+ Thêm đáp án</button>
        </div>
      )}
    </div>
  );
}

function AssignmentForm({ initial, onCancel, onSave, saving }: {
  initial: AssignmentFull | null;
  onCancel: () => void;
  onSave: (data: AssignmentInput) => void;
  saving: boolean;
}) {
  const isEditing = !!initial;
  const [mode, setMode] = useState<"file" | "interactive">(initial?.mode === "interactive" ? "interactive" : "file");
  const [title, setTitle]               = useState(initial?.title ?? "");
  const [instructions, setInstructions] = useState(initial?.instructions ?? "");
  const [fileUrl, setFileUrl]           = useState(initial?.fileUrl ?? "");
  const [fileName, setFileName]         = useState(initial?.fileName ?? "");
  // File mới chọn nhưng CHƯA upload — chỉ thật sự lên Cloudinary lúc bấm "Lưu
  // bài tập" (xem handleSaveClick), tránh mồ côi nếu Huỷ giữa chừng.
  const [maxPoints, setMaxPoints]       = useState(String(initial?.maxPoints ?? 10));
  const [dueDate, setDueDate]           = useState(initial?.dueDate ? initial.dueDate.slice(0, 10) : "");

  // Câu hỏi "làm trên web" — chỉ dùng lúc tạo mới (xem ghi chú ở khối type phía trên).
  const [questions, setQuestions]     = useState<LocalQuestion[]>([]);
  const [aiLoading, setAiLoading]     = useState(false);
  const [aiErr, setAiErr]             = useState("");
  const [skippedCount, setSkippedCount] = useState(0);
  const qFileRef = useRef<HTMLInputElement>(null);

  async function handleExtractFile(file: File) {
    setAiErr(""); setAiLoading(true);
    try {
      const { questions: parsed, errors } = await api.exams.aiExtractQuestions(file);
      const { kept, skipped } = toLocalQuestions(parsed);
      setQuestions(prev => [...prev, ...kept]);
      setSkippedCount(prev => prev + skipped);
      if (errors.length) setAiErr(`AI đọc lỗi ${errors.length} câu — có thể cần thêm câu thủ công`);
    } catch (err) {
      setAiErr(err instanceof Error ? err.message : "Trích xuất thất bại");
    } finally {
      setAiLoading(false);
    }
  }
  function handleQFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) handleExtractFile(file);
  }
  function addBlankQuestion() {
    setQuestions(prev => [...prev, { text: "", type: "MC", points: "1", options: [{ text: "", isCorrect: true }, { text: "", isCorrect: false }] }]);
  }
  function updateQuestion(idx: number, patch: Partial<LocalQuestion>) {
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, ...patch } : q));
  }
  function removeQuestion(idx: number) {
    setQuestions(prev => prev.filter((_, i) => i !== idx));
  }


  async function handleSaveClick() {
    if (!title.trim()) return;

    if (mode === "interactive" && !isEditing) {
      if (!dueDate) { alert("Bài tập làm trên web bắt buộc phải có Hạn nộp"); return; }
      if (questions.length === 0) { alert("Chưa có câu hỏi nào — trích xuất từ file hoặc thêm câu hỏi thủ công trước"); return; }
      for (const q of questions) {
        if (!q.text.trim()) { alert("Có câu hỏi chưa nhập nội dung"); return; }
        if (q.type === "MC") {
          if (q.options.length < 2 || q.options.some(o => !o.text.trim())) { alert("Câu trắc nghiệm cần ít nhất 2 đáp án, không để trống"); return; }
          if (!q.options.some(o => o.isCorrect)) { alert("Câu trắc nghiệm cần đánh dấu 1 đáp án đúng"); return; }
        }
      }
      onSave({
        title: title.trim(), instructions: instructions.trim() || undefined,
        maxPoints: Number(maxPoints) > 0 ? Number(maxPoints) : 10,
        dueDate, mode: "interactive",
        questions: questions.map((q): AssignmentQuestionInput => ({
          text: q.text.trim(), type: q.type, points: Number(q.points) > 0 ? Number(q.points) : 1, imageUrl: q.imageUrl,
          options: q.type === "MC" ? q.options.map(o => ({ text: o.text.trim(), isCorrect: o.isCorrect })) : [],
        })),
      });
      return;
    }

    if (mode === "interactive" && isEditing && !dueDate) {
      alert("Bài tập làm trên web bắt buộc phải có Hạn nộp");
      return;
    }

    const url = fileUrl.trim();
    if (url) {
      const chk = checkLinkForSlot(url, "document");
      if (!chk.ok) { alert(chk.error); return; }
    }
    onSave({
      title: title.trim(), instructions: instructions.trim() || undefined,
      fileUrl: url || undefined, fileName: fileName || undefined,
      maxPoints: Number(maxPoints) > 0 ? Number(maxPoints) : 10,
      dueDate: dueDate || null,
    });
  }

  const inp = "px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-blue-400 bg-[var(--kin-nen-trang)] w-full";

  return (
    <div className="border border-dashed border-gray-300 rounded-xl p-3 space-y-2">
      <input className={inp} placeholder="Tiêu đề bài tập *" value={title} onChange={e => setTitle(e.target.value)} />
      <textarea className={inp + " resize-none"} rows={2} placeholder="Hướng dẫn làm bài (tuỳ chọn)"
        value={instructions} onChange={e => setInstructions(e.target.value)} />

      {!isEditing ? (
        <div className="flex gap-2">
          <button type="button" onClick={() => setMode("file")}
            className="flex-1 py-2 rounded-lg text-xs font-semibold border-2 transition-colors"
            style={mode === "file" ? { borderColor: "var(--kin-nhan-nen)", background: "var(--kin-nhan-nen-nhat)", color: "var(--kin-nhan-link)" } : { borderColor: "var(--kin-vien-thuong)", color: "var(--kin-chu-mo)" }}>
            📎 Nộp file
          </button>
          <button type="button" onClick={() => setMode("interactive")}
            className="flex-1 py-2 rounded-lg text-xs font-semibold border-2 transition-colors"
            style={mode === "interactive" ? { borderColor: "var(--kin-nhan-nen)", background: "var(--kin-nhan-nen-nhat)", color: "var(--kin-nhan-link)" } : { borderColor: "var(--kin-vien-thuong)", color: "var(--kin-chu-mo)" }}>
            🖥️ Làm trên web
          </button>
        </div>
      ) : mode === "interactive" && (
        <p className="text-xs text-gray-400">
          Kiểu: <span className="font-semibold text-gray-600">Làm trên web</span> · {initial!.questionCount} câu hỏi
          <span className="block mt-0.5">Không thể sửa câu hỏi sau khi tạo — xoá và tạo bài tập mới nếu cần đổi câu hỏi.</span>
        </p>
      )}

      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-500 mb-1">Điểm tối đa</label>
          <input type="number" min={1} step={0.5} className={inp} value={maxPoints} onChange={e => setMaxPoints(e.target.value)} disabled={mode === "interactive"} />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-500 mb-1">Hạn nộp{mode === "interactive" ? " *" : " (tuỳ chọn)"}</label>
          <input type="date" className={inp} value={dueDate} onChange={e => setDueDate(e.target.value)} />
        </div>
      </div>

      {mode === "file" && (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Link đề bài (Google Drive, tuỳ chọn)</label>
          <input className={inp} placeholder="Dán link Drive của đề bài…" value={fileUrl}
            onChange={e => { setFileUrl(e.target.value); if (!fileName) setFileName(""); }} />
          <p data-tai-lieu-dong className="text-xs mt-1" style={{ color: "var(--kin-chu-mo)" }}>
            Tải tệp đề lên: dùng tab Giáo trình của lớp (sắp có). Hiện chỉ dán link Drive.
          </p>
        </div>
      )}

      {mode === "interactive" && !isEditing && (
        <div className="space-y-2 border-t border-gray-100 pt-2">
          <input ref={qFileRef} type="file" accept=".pdf,.docx,.jpg,.jpeg,.png,.webp" className="hidden" onChange={handleQFileSelect} />
          <DropZone onFiles={files => files[0] && handleExtractFile(files[0])} className="rounded-lg">
            <button type="button" onClick={() => qFileRef.current?.click()} disabled={aiLoading}
              className="w-full py-2 rounded-lg text-xs font-semibold border-2 border-dashed transition-colors disabled:opacity-50"
              style={{ borderColor: "var(--kin-vien-o-nhap)", color: "var(--kin-chu-mo)" }}>
              {aiLoading ? "Đang trích xuất bằng AI..." : "🤖 Tải file đề bài để AI trích câu hỏi (PDF/ảnh/Word)"}
            </button>
          </DropZone>
          <AiQuotaNote busy={aiLoading} />
          {aiErr && <p className="text-xs" style={{ color: "var(--kin-tt-chu-loi)" }}>{aiErr}</p>}
          {skippedCount > 0 && (
            <p className="text-xs" style={{ color: "var(--kin-tt-chu-cho)" }}>
              ⚠ Đã bỏ qua {skippedCount} câu Đúng-Sai/Trả lời ngắn — bài tập làm trên web chỉ hỗ trợ Trắc nghiệm và Tự luận
            </p>
          )}

          {questions.map((q, qi) => (
            <QuestionRow key={qi} q={q} qi={qi}
              onChange={patch => updateQuestion(qi, patch)}
              onRemove={() => removeQuestion(qi)} />
          ))}

          <div className="flex items-center justify-between">
            <button type="button" onClick={addBlankQuestion} className="text-xs font-semibold" style={{ color: "var(--kin-nhan-link)" }}>+ Thêm câu hỏi thủ công</button>
            <p className="text-xs text-gray-400">{questions.length} câu hỏi</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <button onClick={onCancel} className="px-3 py-1.5 text-xs border rounded-lg text-gray-600 hover:bg-gray-50">Huỷ</button>
        <button onClick={handleSaveClick}
          disabled={!title.trim() || saving}
          className="px-4 py-1.5 text-xs font-semibold text-white rounded-lg disabled:opacity-40" style={{ background: "var(--kin-nhan-nen)" }}>
          {saving ? "Đang lưu..." : "Lưu bài tập"}
        </button>
      </div>
    </div>
  );
}

function GradeSubmissionsModal({ assignment, onClose, onGraded }: {
  assignment: AssignmentFull | null;
  onClose: () => void;
  onGraded: () => void;
}) {
  const [subs, setSubs] = useState<AssignmentSubmissionFull[]>([]);
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, { score: string; comment: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (!assignment) return;
    setLoading(true);
    api.assignments.listSubmissions(assignment.id)
      .then(list => {
        setSubs(list);
        setDrafts(Object.fromEntries(list.map(s => [s.id, { score: s.score != null ? String(s.score) : "", comment: s.comment ?? "" }])));
      })
      .catch(() => alert("Lỗi tải danh sách bài nộp"))
      .finally(() => setLoading(false));
  }, [assignment]);

  if (!assignment) return null;

  async function handleGrade(sub: AssignmentSubmissionFull) {
    const draft = drafts[sub.id];
    const score = Number(draft?.score);
    if (!draft?.score || Number.isNaN(score)) { alert("Nhập điểm hợp lệ"); return; }
    setSavingId(sub.id);
    try {
      const updated = await api.assignments.grade(assignment!.id, sub.id, { score, comment: draft.comment || undefined });
      setSubs(prev => prev.map(s => s.id === sub.id ? updated : s));
      onGraded();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Chấm điểm thất bại");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div className="bg-[var(--kin-nen-trang)] rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-800">Bài nộp — {assignment.title}</h2>
            <p className="text-xs text-gray-400 mt-0.5">Điểm tối đa: {assignment.maxPoints}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 text-xl font-light">×</button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {loading ? (
            <p className="text-center text-sm text-gray-400 py-8">Đang tải...</p>
          ) : subs.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">Chưa có học viên nào nộp bài</p>
          ) : subs.map(s => (
            <div key={s.id} className="rounded-lg border border-gray-100 p-3">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-sm font-semibold text-gray-800">{s.user?.name ?? "?"}</p>
                <p className="text-xs text-gray-400">{new Date(s.submittedAt).toLocaleString("vi-VN")}</p>
              </div>
              <a href={s.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold" style={{ color: "var(--kin-nhan-link)" }}>
                📎 {s.fileName || "Xem bài làm"}
              </a>
              <div className="flex items-center gap-2 mt-2">
                <input type="number" min={0} max={assignment.maxPoints} step={0.5}
                  className="w-20 px-2 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-blue-400"
                  placeholder="Điểm" value={drafts[s.id]?.score ?? ""}
                  onChange={e => setDrafts(prev => ({ ...prev, [s.id]: { ...prev[s.id], score: e.target.value } }))} />
                <input className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-blue-400"
                  placeholder="Nhận xét (tuỳ chọn)" value={drafts[s.id]?.comment ?? ""}
                  onChange={e => setDrafts(prev => ({ ...prev, [s.id]: { ...prev[s.id], comment: e.target.value } }))} />
                <button onClick={() => handleGrade(s)} disabled={savingId === s.id}
                  className="px-3 py-1.5 text-xs font-semibold text-white rounded-lg disabled:opacity-50 flex-shrink-0" style={{ background: "var(--kin-nhan-nen)" }}>
                  {savingId === s.id ? "..." : s.score != null ? "Cập nhật" : "Chấm"}
                </button>
              </div>
              {s.gradedAt && <p className="text-xs text-gray-400 mt-1">Đã chấm {new Date(s.gradedAt).toLocaleString("vi-VN")}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function InteractiveResultsModal({ assignment, onClose }: {
  assignment: AssignmentFull | null;
  onClose: () => void;
}) {
  const [data, setData]       = useState<AssignmentResultsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [drafts, setDrafts]   = useState<Record<string, { points: string; comment: string }>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!assignment) { setData(null); return; }
    setLoading(true);
    api.assignments.getResults(assignment.id).then(setData).catch(() => alert("Lỗi tải kết quả")).finally(() => setLoading(false));
  }, [assignment]);

  if (!assignment) return null;

  async function handleGradeEssay(userId: string, questionId: string, maxPts: number) {
    const key = `${userId}:${questionId}`;
    const draft = drafts[key];
    const points = Number(draft?.points);
    if (!draft?.points || Number.isNaN(points) || points < 0 || points > maxPts) { alert(`Nhập điểm hợp lệ (0 - ${maxPts})`); return; }
    setSavingKey(key);
    try {
      await api.assignments.gradeQuestion(assignment!.id, questionId, { userId, pointsAwarded: points, teacherComment: draft.comment || undefined });
      const fresh = await api.assignments.getResults(assignment!.id);
      setData(fresh);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Chấm điểm thất bại");
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div className="bg-[var(--kin-nen-trang)] rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-800">Kết quả — {assignment.title}</h2>
            {data && <p className="text-xs text-gray-400 mt-0.5">Tổng {data.totalPoints} điểm · {data.students.length} học viên</p>}
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 text-xl font-light">×</button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {loading || !data ? (
            <p className="text-center text-sm text-gray-400 py-8">Đang tải...</p>
          ) : data.students.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">Chưa có học viên nào ghi danh khoá học này</p>
          ) : data.students.map(s => {
            const pct = s.completion.total > 0 ? Math.round(s.completion.answered / s.completion.total * 100) : 0;
            const open = expandedUserId === s.userId;
            return (
              <div key={s.userId} className="rounded-lg border border-gray-100">
                <button onClick={() => setExpandedUserId(open ? null : s.userId)}
                  className="w-full flex items-center justify-between gap-2 p-3 text-left hover:bg-gray-50">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{s.name}{s.studentId ? ` (${s.studentId})` : ""}</p>
                    <p className="text-xs text-gray-400">Hoàn thành {s.completion.answered}/{s.completion.total} câu ({pct}%) · Điểm {s.score}/{data.totalPoints}</p>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">{open ? "▲" : "▼"}</span>
                </button>
                {open && (
                  <div className="border-t border-gray-100 p-3 space-y-2">
                    {data.questions.map((q, qi) => {
                      const a = s.answers[q.id];
                      const key = `${s.userId}:${q.id}`;
                      return (
                        <div key={q.id} className="rounded-lg bg-gray-50 p-2.5">
                          <p className="text-xs font-semibold text-gray-700 mb-1">Câu {qi + 1} <span className="font-normal text-gray-400">({q.points}đ)</span></p>
                          <MathText className="text-xs text-gray-600" text={q.text} />
                          {q.type === "MC" ? (
                            <p className="text-xs mt-1.5">
                              {a?.optionId ? (
                                <span style={{ color: a.isCorrect ? "var(--kin-tt-chu-xong)" : "var(--kin-tt-chu-loi)" }}>
                                  Chọn: {q.options.find(o => o.id === a.optionId)?.text ?? "?"} ({a.isCorrect ? "Đúng" : "Sai"})
                                </span>
                              ) : (
                                <span className="text-gray-400">Chưa trả lời</span>
                              )}
                              {" · Đáp án đúng: "}{q.options.find(o => o.isCorrect)?.text ?? "?"}
                            </p>
                          ) : (
                            <>
                              <p className="text-xs mt-1.5 whitespace-pre-wrap" style={{ color: a?.textAnswer ? "var(--kin-chu-phu)" : "var(--kin-chu-mo)" }}>
                                {a?.textAnswer || "Chưa trả lời"}
                              </p>
                              <div className="flex items-center gap-2 mt-1.5">
                                <input type="number" min={0} max={q.points} step={0.25}
                                  className="w-16 px-2 py-1 text-xs border border-gray-200 rounded-lg outline-none focus:border-blue-400"
                                  placeholder="Điểm" value={drafts[key]?.points ?? (a?.pointsAwarded != null ? String(a.pointsAwarded) : "")}
                                  onChange={e => setDrafts(prev => ({ ...prev, [key]: { points: e.target.value, comment: prev[key]?.comment ?? a?.teacherComment ?? "" } }))} />
                                <input className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded-lg outline-none focus:border-blue-400"
                                  placeholder="Nhận xét (tuỳ chọn)" value={drafts[key]?.comment ?? a?.teacherComment ?? ""}
                                  onChange={e => setDrafts(prev => ({ ...prev, [key]: { points: prev[key]?.points ?? (a?.pointsAwarded != null ? String(a.pointsAwarded) : ""), comment: e.target.value } }))} />
                                <button onClick={() => handleGradeEssay(s.userId, q.id, q.points)} disabled={savingKey === key}
                                  className="px-2.5 py-1 text-xs font-semibold text-white rounded-lg disabled:opacity-50 flex-shrink-0" style={{ background: "var(--kin-nhan-nen)" }}>
                                  {savingKey === key ? "..." : a?.pointsAwarded != null ? "Cập nhật" : "Chấm"}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function AssignmentEditor({ lessonId }: { lessonId: string }) {
  const [items, setItems]     = useState<AssignmentFull[]>([]);
  const { ask, dialog } = useKinConfirm();
  const [loading, setLoading] = useState(true);
  const [adding, setAdding]   = useState(false);
  const [editing, setEditing] = useState<AssignmentFull | null>(null);
  const [grading, setGrading] = useState<AssignmentFull | null>(null);
  const [viewingResults, setViewingResults] = useState<AssignmentFull | null>(null);
  const [saving, setSaving]   = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.assignments.listByLesson(lessonId).then(setItems).catch(() => {}).finally(() => setLoading(false));
  }, [lessonId]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(data: AssignmentInput) {
    setSaving(true);
    try {
      await api.assignments.create(lessonId, data);
      setAdding(false);
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Tạo bài tập thất bại");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(data: AssignmentInput) {
    if (!editing) return;
    setSaving(true);
    try {
      await api.assignments.update(editing.id, data);
      setEditing(null);
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Cập nhật bài tập thất bại");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!(await ask({ title: "Xoá bài tập này?", message: "Toàn bộ bài học viên đã nộp cũng sẽ mất." }))) return;
    try {
      await api.assignments.remove(id);
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Xoá thất bại");
    }
  }

  return (
    <div>
      {dialog}
      <div className="flex items-center justify-between mb-3 pb-1 border-b border-gray-100">
        <p className="text-sm font-semibold text-gray-700">Bài tập tự nộp</p>
        {!adding && <button onClick={() => setAdding(true)} className="text-xs font-semibold" style={{ color: "var(--kin-nhan-link)" }}>+ Thêm bài tập</button>}
      </div>
      <p className="text-xs text-gray-400 -mt-2 mb-3">Song song với Azota ở trên — dùng khi muốn học viên nộp bài trực tiếp trên nền tảng để chấm điểm.</p>

      {loading ? (
        <p className="text-xs text-gray-400 text-center py-3">Đang tải...</p>
      ) : (
        <div className="space-y-2 mb-3">
          {items.map(a => editing?.id === a.id ? (
            <AssignmentForm key={a.id} initial={a} onCancel={() => setEditing(null)} onSave={handleUpdate} saving={saving} />
          ) : (
            <div key={a.id} className="flex items-center gap-2 p-2.5 rounded-lg border border-gray-100 bg-gray-50">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800 truncate">
                  {a.mode === "interactive" && <span className="mr-1" title="Làm trên web">🖥️</span>}{a.title}
                </p>
                <p className="text-xs text-gray-400">
                  {a.mode === "interactive"
                    ? `${a.questionCount} câu hỏi${a.dueDate ? ` · Hạn ${fmtDue(a.dueDate)}` : ""}`
                    : `Tối đa ${a.maxPoints}đ${a.dueDate ? ` · Hạn ${fmtDue(a.dueDate)}` : ""} · ${a.submissionCount} bài nộp`}
                </p>
              </div>
              {a.mode === "interactive" ? (
                <button onClick={() => setViewingResults(a)} className="text-xs px-2 py-1 rounded text-green-600 hover:bg-green-50 flex-shrink-0">Xem kết quả</button>
              ) : (
                <button onClick={() => setGrading(a)} className="text-xs px-2 py-1 rounded text-green-600 hover:bg-green-50 flex-shrink-0">Chấm bài</button>
              )}
              <button onClick={() => setEditing(a)} className="text-xs px-2 py-1 rounded text-blue-600 hover:bg-blue-50 flex-shrink-0">Sửa</button>
              <button onClick={() => handleDelete(a.id)} className="text-xs px-2 py-1 rounded text-red-400 hover:bg-red-50 flex-shrink-0">✕</button>
            </div>
          ))}
        </div>
      )}

      {adding && <AssignmentForm initial={null} onCancel={() => setAdding(false)} onSave={handleCreate} saving={saving} />}

      {items.length === 0 && !loading && !adding && (
        <p className="text-xs text-gray-400 text-center">Chưa có bài tập tự nộp nào.</p>
      )}

      <GradeSubmissionsModal assignment={grading} onClose={() => setGrading(null)} onGraded={load} />
      <InteractiveResultsModal assignment={viewingResults} onClose={() => setViewingResults(null)} />
    </div>
  );
}
