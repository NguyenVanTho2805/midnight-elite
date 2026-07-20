"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import PermissionGuard from "@/components/PermissionGuard";
import { PERMISSIONS } from "@/contexts/AuthContext";
import { useAuth } from "@/contexts/AuthContext";
import { AdminToast, useAdminToast } from "@/components/AdminToast";
import { api, type QuestionBankItemFull, type QuestionBankItemInput, type QuestionType, type Difficulty } from "@/lib/api";

const CLUSTER_LABELS = ["a", "b", "c", "d"] as const;
const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: "NB",  label: "Nhận biết" },
  { value: "TH",  label: "Thông hiểu" },
  { value: "VD",  label: "Vận dụng" },
  { value: "VDC", label: "Vận dụng cao" },
];
const DIFFICULTY_COLOR: Record<Difficulty, { bg: string; color: string }> = {
  NB:  { bg: "#dbeafe", color: "#0068FF" },
  TH:  { bg: "#dcfce7", color: "#16a34a" },
  VD:  { bg: "#fef3c7", color: "#b45309" },
  VDC: { bg: "#fee2e2", color: "#dc2626" },
};
// Giai đoạn 4 — màu badge tỉ lệ trả lời đúng: xanh (dễ/ổn), vàng (trung
// bình), đỏ (khó bất thường — có thể đề sai đáp án, đáng xem lại).
function CORRECT_RATIO_COLOR(ratio: number): { bg: string; color: string } {
  if (ratio >= 0.7) return { bg: "#dcfce7", color: "#16a34a" };
  if (ratio >= 0.4) return { bg: "#fef3c7", color: "#b45309" };
  return { bg: "#fee2e2", color: "#dc2626" };
}
const TYPE_LABEL: Record<QuestionType, string> = {
  MC: "Trắc nghiệm", ESSAY: "Tự luận", TRUE_FALSE_CLUSTER: "Đúng-Sai 4 ý", SHORT_ANSWER: "Trả lời ngắn",
};

// Select môn học + khả năng gõ môn hoàn toàn mới (subject là String tự do,
// không phải enum) — cùng cơ chế toggle select↔input như CategoryField ở
// src/app/(admin)/admin/thi-thu/page.tsx.
function SubjectField({ value, options, onChange, className }: {
  value: string; options: string[]; onChange: (v: string) => void; className: string;
}) {
  const [adding, setAdding] = useState(false);
  const [newVal, setNewVal] = useState("");

  function commit() {
    if (newVal.trim()) onChange(newVal.trim());
    setAdding(false);
    setNewVal("");
  }

  if (adding) {
    return (
      <div className="flex gap-2">
        <input autoFocus className={className} placeholder="Tên môn mới..."
          value={newVal} onChange={e => setNewVal(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setAdding(false); setNewVal(""); } }} />
        <button type="button" onClick={commit}
          className="px-3 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 flex-shrink-0">Xong</button>
      </div>
    );
  }

  return (
    <select className={className} value={value}
      onChange={e => e.target.value === "__add__" ? setAdding(true) : onChange(e.target.value)}>
      <option value="">Chọn môn...</option>
      {options.map(s => <option key={s} value={s}>{s}</option>)}
      {value && !options.includes(value) && <option value={value}>{value}</option>}
      <option value="__add__">+ Thêm môn mới…</option>
    </select>
  );
}

// ─── FORM CÂU HỎI (mirror QuestionForm ở admin/thi-thu/[id]/page.tsx, bỏ
// sectionLabel/sectionMinutes vì bank item không thuộc đề nào, thêm 4 field
// phân loại bắt buộc/tùy chọn: subject, topic, difficulty, tags). ──────────
interface ItemForm {
  type: QuestionType;
  text: string;
  imageUrl: string;
  points: string;
  explanation: string;
  subject: string;
  topic: string;
  difficulty: Difficulty;
  tagsText: string; // tách theo dấu phẩy khi lưu
  options: string[];
  correctIndex: number;
  clusterCorrect: boolean[];
}

const INIT_FORM: ItemForm = {
  type: "MC", text: "", imageUrl: "", points: "1", explanation: "",
  subject: "", topic: "", difficulty: "NB", tagsText: "",
  options: ["", "", "", ""], correctIndex: 0, clusterCorrect: [false, false, false, false],
};

function toForm(item: QuestionBankItemFull): ItemForm {
  const base = {
    type: item.type, text: item.text, imageUrl: item.imageUrl ?? "",
    points: String(item.points), explanation: item.explanation ?? "",
    subject: item.subject, topic: item.topic, difficulty: item.difficulty,
    tagsText: (item.tags ?? []).join(", "),
  };
  if (item.type === "TRUE_FALSE_CLUSTER") {
    const bySubLabel = new Map(item.options.map(o => [o.subLabel, o]));
    return {
      ...base,
      options: CLUSTER_LABELS.map(l => bySubLabel.get(l)?.text ?? ""),
      correctIndex: 0,
      clusterCorrect: CLUSTER_LABELS.map(l => !!bySubLabel.get(l)?.isCorrect),
    };
  }
  if (item.type === "ESSAY") {
    return { ...base, options: [], correctIndex: 0, clusterCorrect: [false, false, false, false] };
  }
  if (item.type === "SHORT_ANSWER") {
    return { ...base, options: [item.options[0]?.text ?? ""], correctIndex: 0, clusterCorrect: [false, false, false, false] };
  }
  return {
    ...base,
    options: item.options.map(o => o.text),
    correctIndex: Math.max(0, item.options.findIndex(o => o.isCorrect)),
    clusterCorrect: [false, false, false, false],
  };
}

function toInput(form: ItemForm): QuestionBankItemInput | null {
  if (!form.text.trim() || !form.subject.trim() || !form.topic.trim()) return null;
  const tags = form.tagsText.split(",").map(t => t.trim()).filter(Boolean);
  const base = {
    text: form.text.trim(),
    type: form.type,
    imageUrl: form.imageUrl.trim() || undefined,
    points: Number(form.points) > 0 ? Number(form.points) : 1,
    explanation: form.explanation.trim() || undefined,
    subject: form.subject.trim(),
    topic: form.topic.trim(),
    difficulty: form.difficulty,
    tags: tags.length > 0 ? tags : undefined,
  };

  if (form.type === "ESSAY") return { ...base, options: [] };

  if (form.type === "SHORT_ANSWER") {
    const answer = (form.options[0] ?? "").trim();
    if (!answer) return null;
    return { ...base, options: [{ text: answer, isCorrect: true }] };
  }

  if (form.type === "TRUE_FALSE_CLUSTER") {
    const options = CLUSTER_LABELS.map((l, i) => ({ text: (form.options[i] ?? "").trim(), isCorrect: form.clusterCorrect[i] ?? false, subLabel: l }));
    if (options.some(o => !o.text)) return null;
    return { ...base, options };
  }

  const cleaned = form.options.map(o => o.trim()).filter(Boolean);
  if (cleaned.length < 2) return null;
  return {
    ...base,
    options: cleaned.map((text, i) => ({ text, isCorrect: i === form.correctIndex })),
  };
}

function ItemDrawer({ open, initial, subjectOptions, onClose, onSave, saving }: {
  open: boolean;
  initial: ItemForm | null;
  subjectOptions: string[];
  onClose: () => void;
  onSave: (form: ItemForm) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<ItemForm>(initial ?? INIT_FORM);
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

  const inp = "w-full px-3 py-2.5 text-sm border rounded-lg outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200";
  const inpStyle = { borderColor: "#e5e3df" };

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
            <h2 className="text-base font-bold" style={{ color: "#1a1a1a" }}>{initial ? "Sửa câu hỏi" : "Thêm câu hỏi vào ngân hàng"}</h2>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg text-gray-600 hover:bg-gray-50" style={inpStyle}>Huỷ</button>
            <button onClick={() => { const input = toInput(form); if (input) onSave(form); }} disabled={saving}
              className="px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-60" style={{ background: "#16a34a" }}>
              {saving ? "Đang lưu..." : "Lưu"}
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Môn học <span className="text-red-500">*</span></label>
              <SubjectField className={inp} value={form.subject} options={subjectOptions} onChange={v => setForm({ ...form, subject: v })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Chủ đề <span className="text-red-500">*</span></label>
              <input className={inp} style={inpStyle} list="bank-topics"
                value={form.topic} onChange={e => setForm({ ...form, topic: e.target.value })}
                placeholder="VD: Hàm số" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Độ khó <span className="text-red-500">*</span></label>
            <div className="flex gap-2">
              {DIFFICULTIES.map(d => (
                <button key={d.value} type="button" onClick={() => setForm({ ...form, difficulty: d.value })}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
                  style={form.difficulty === d.value
                    ? { background: "#0068FF", borderColor: "#0068FF", color: "#fff" }
                    : { borderColor: "#e5e3df", color: "#787671" }}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Loại câu hỏi</label>
            <div className="flex gap-2">
              {([
                { v: "MC", label: "Trắc nghiệm" },
                { v: "TRUE_FALSE_CLUSTER", label: "Đúng-Sai 4 ý" },
                { v: "SHORT_ANSWER", label: "Trả lời ngắn" },
                { v: "ESSAY", label: "Tự luận" },
              ] as const).map(t => (
                <button key={t.v} type="button" onClick={() => setForm({ ...form, type: t.v })}
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
            <textarea className={inp} style={inpStyle} rows={3}
              value={form.text} onChange={e => setForm({ ...form, text: e.target.value })}
              placeholder="Nhập nội dung câu hỏi..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Điểm</label>
              <input type="number" min={0.25} step={0.25} className={inp} style={inpStyle}
                value={form.points} onChange={e => setForm({ ...form, points: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Ảnh minh hoạ (URL, tùy chọn)</label>
              <input className={inp} style={inpStyle}
                value={form.imageUrl} onChange={e => setForm({ ...form, imageUrl: e.target.value })} />
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
                    <input className="flex-1 px-3 py-2 text-sm border rounded-lg outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
                      style={inpStyle} value={opt} onChange={e => updateOption(idx, e.target.value)}
                      placeholder={`Đáp án ${String.fromCharCode(65 + idx)}`} />
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
                    <input className="flex-1 px-3 py-2 text-sm border rounded-lg outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
                      style={inpStyle} value={form.options[idx] ?? ""}
                      onChange={e => {
                        const next = [...form.options];
                        next[idx] = e.target.value;
                        setForm({ ...form, options: next });
                      }}
                      placeholder={`Ý ${label}`} />
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs" style={{ color: "#a4a097" }}>Mỗi ý đúng/sai độc lập — học viên trả lời riêng từng ý, không phải chọn 1 trong 4.</p>
            </div>
          )}

          {form.type === "SHORT_ANSWER" && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Đáp án đúng</label>
              <input className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
                style={inpStyle} value={form.options[0] ?? ""}
                onChange={e => setForm({ ...form, options: [e.target.value] })} placeholder="VD: 42" />
              <p className="mt-1.5 text-xs" style={{ color: "#a4a097" }}>Chấm tự động bằng so khớp chính xác (không phân biệt hoa/thường, tự đổi dấu phẩy thập phân).</p>
            </div>
          )}

          {form.type === "ESSAY" && (
            <div className="text-xs p-3 rounded-lg" style={{ background: "#f6f5f4", color: "#787671" }}>
              Câu tự luận không có đáp án cố định — học viên gõ câu trả lời, giáo viên chấm điểm thủ công sau khi nộp bài.
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Giải thích (tùy chọn)</label>
            <textarea className={inp} style={inpStyle} rows={2}
              value={form.explanation} onChange={e => setForm({ ...form, explanation: e.target.value })} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Tags (tùy chọn, cách nhau bởi dấu phẩy)</label>
            <input className={inp} style={inpStyle}
              value={form.tagsText} onChange={e => setForm({ ...form, tagsText: e.target.value })}
              placeholder="VD: đề thi thử, chương 1" />
          </div>
        </div>
      </div>
    </>
  );
}

// ─── PAGE INNER ─────────────────────────────────────────────────────────────

function PageInner() {
  const { user } = useAuth();
  const isTeacher = user?.adminRole === "teacher";

  const [items, setItems]       = useState<QuestionBankItemFull[]>([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [drawerOpen, setDrawer] = useState(false);
  const [editItem, setEditItem] = useState<QuestionBankItemFull | null>(null);
  const [delId, setDelId]       = useState<string | null>(null);
  const [saving, setSaving]     = useState(false);

  const [search, setSearch]         = useState("");
  const [subjectFilter, setSubject] = useState("");
  const [topicFilter, setTopic]     = useState("");
  const [difficultyFilter, setDiff] = useState("");
  const [page, setPage]             = useState(1);
  const pageSize = 20;

  const [allSubjects, setAllSubjects] = useState<string[]>([]);
  const [allTopics, setAllTopics]     = useState<string[]>([]);

  const { toast, showToast } = useAdminToast();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.questionBank.list({
        search: search || undefined,
        subject: subjectFilter || undefined,
        topic: topicFilter || undefined,
        difficulty: difficultyFilter || undefined,
        page, pageSize, withStats: true,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch {
      showToast("Lỗi tải dữ liệu", false);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, subjectFilter, topicFilter, difficultyFilter, page]);

  useEffect(() => { loadData(); }, [loadData]);

  // Danh sách môn/chủ đề cho dropdown lọc + form — tải riêng, không phân
  // trang (đủ dùng cho quy mô ngân hàng ở Giai đoạn 1).
  const loadTaxonomy = useCallback(async () => {
    try {
      const data = await api.questionBank.list({ pageSize: 500 });
      setAllSubjects([...new Set(data.items.map(i => i.subject))].sort());
      setAllTopics([...new Set(data.items.map(i => i.topic))].sort());
    } catch { /* không chặn trang nếu lỗi — chỉ ảnh hưởng gợi ý dropdown */ }
  }, []);

  useEffect(() => { loadTaxonomy(); }, [loadTaxonomy]);

  function canEdit(item: QuestionBankItemFull): boolean {
    if (!user) return false;
    if (!isTeacher) return true;
    return item.ownerId === user.id;
  }

  function openCreate() {
    setEditItem(null);
    setDrawer(true);
  }
  function openEdit(item: QuestionBankItemFull) {
    setEditItem(item);
    setDrawer(true);
  }

  async function handleSave(form: ItemForm) {
    const input = toInput(form);
    if (!input) { showToast("Thiếu thông tin bắt buộc (nội dung/môn/chủ đề)", false); return; }
    setSaving(true);
    try {
      if (editItem) {
        await api.questionBank.update(editItem.id, input);
        showToast("Đã cập nhật câu hỏi");
      } else {
        await api.questionBank.create(input);
        showToast("Đã thêm câu hỏi vào ngân hàng");
      }
      setDrawer(false);
      await Promise.all([loadData(), loadTaxonomy()]);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Lưu thất bại", false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!delId) return;
    try {
      await api.questionBank.remove(delId);
      showToast("Đã xoá câu hỏi");
      setDelId(null);
      await loadData();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Xoá thất bại", false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <datalist id="bank-topics">
        {allTopics.map(t => <option key={t} value={t} />)}
      </datalist>

      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-extrabold" style={{ color: "#1a1a1a" }}>Ngân hàng câu hỏi</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} câu hỏi — dùng chung giữa mọi giáo viên, mỗi người chỉ sửa/xoá được câu của mình</p>
        </div>
        <button onClick={openCreate} className="px-4 py-2.5 text-sm font-semibold text-white rounded-lg" style={{ background: "#0068FF" }}>
          + Thêm câu hỏi
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          className="flex-1 min-w-[200px] px-3 py-2 text-sm border rounded-lg outline-none focus:border-blue-400"
          style={{ borderColor: "#e5e3df" }}
          placeholder="Tìm theo nội dung câu hỏi..."
          value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        <select className="px-3 py-2 text-sm border rounded-lg outline-none" style={{ borderColor: "#e5e3df" }}
          value={subjectFilter} onChange={e => { setSubject(e.target.value); setPage(1); }}>
          <option value="">Tất cả môn</option>
          {allSubjects.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="px-3 py-2 text-sm border rounded-lg outline-none" style={{ borderColor: "#e5e3df" }}
          value={topicFilter} onChange={e => { setTopic(e.target.value); setPage(1); }}>
          <option value="">Tất cả chủ đề</option>
          {allTopics.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="px-3 py-2 text-sm border rounded-lg outline-none" style={{ borderColor: "#e5e3df" }}
          value={difficultyFilter} onChange={e => { setDiff(e.target.value); setPage(1); }}>
          <option value="">Tất cả độ khó</option>
          {DIFFICULTIES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#e5e3df" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 uppercase tracking-wide" style={{ background: "#f6f5f4" }}>
              <th className="px-4 py-3">Câu hỏi</th>
              <th className="px-4 py-3">Môn / Chủ đề</th>
              <th className="px-4 py-3">Độ khó</th>
              <th className="px-4 py-3">Loại</th>
              <th className="px-4 py-3">Người soạn</th>
              <th className="px-4 py-3">Sử dụng</th>
              <th className="px-4 py-3">Cập nhật</th>
              <th className="px-4 py-3">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Đang tải...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Chưa có câu hỏi nào</td></tr>
            ) : items.map(item => (
              <tr key={item.id} className="border-t" style={{ borderColor: "#e5e3df" }}>
                <td className="px-4 py-3 max-w-sm truncate" title={item.text}>{item.text}</td>
                <td className="px-4 py-3 text-gray-600">{item.subject} / {item.topic}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={DIFFICULTY_COLOR[item.difficulty]}>
                    {DIFFICULTIES.find(d => d.value === item.difficulty)?.label ?? item.difficulty}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{TYPE_LABEL[item.type]}</td>
                <td className="px-4 py-3 text-gray-600">{item.owner?.name ?? "—"}</td>
                <td className="px-4 py-3 text-gray-600">
                  {!item.usageCount ? (
                    <span className="text-xs text-gray-300">Chưa dùng</span>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs">{item.examCount} đề{item.usageCount !== item.examCount ? ` (${item.usageCount} lượt)` : ""}</span>
                      {item.correctRatio != null && (
                        <span className="px-1.5 py-0.5 rounded-full text-xs font-semibold" style={CORRECT_RATIO_COLOR(item.correctRatio)}>
                          {Math.round(item.correctRatio * 100)}% đúng
                        </span>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{new Date(item.updatedAt).toLocaleDateString("vi-VN")}</td>
                <td className="px-4 py-3">
                  {canEdit(item) ? (
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(item)} className="text-xs font-semibold" style={{ color: "#0068FF" }}>Sửa</button>
                      <button onClick={() => setDelId(item.id)} className="text-xs font-semibold text-red-500">Xoá</button>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4 text-sm">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            className="px-3 py-1.5 rounded-lg border disabled:opacity-40" style={{ borderColor: "#e5e3df" }}>‹</button>
          <span className="text-gray-500">Trang {page}/{totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
            className="px-3 py-1.5 rounded-lg border disabled:opacity-40" style={{ borderColor: "#e5e3df" }}>›</button>
        </div>
      )}

      <ItemDrawer
        open={drawerOpen}
        initial={editItem ? toForm(editItem) : null}
        subjectOptions={allSubjects}
        onClose={() => setDrawer(false)}
        onSave={handleSave}
        saving={saving}
      />

      {delId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.3)" }}>
          <div className="bg-white rounded-xl p-5 max-w-sm w-full mx-4">
            <p className="text-sm font-semibold mb-1">Xoá câu hỏi này?</p>
            <p className="text-xs text-gray-500 mb-4">Chỉ xoá khỏi ngân hàng — không ảnh hưởng đề thi đã dùng câu này trước đó.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDelId(null)} className="px-3 py-1.5 text-sm border rounded-lg text-gray-600" style={{ borderColor: "#e5e3df" }}>Huỷ</button>
              <button onClick={handleDelete} className="px-3 py-1.5 text-sm font-semibold text-white rounded-lg" style={{ background: "#dc2626" }}>Xoá</button>
            </div>
          </div>
        </div>
      )}

      {toast && <AdminToast msg={toast.msg} ok={toast.ok} />}
    </div>
  );
}

export default function QuestionBankAdminPage() {
  return (
    <PermissionGuard required={PERMISSIONS.MANAGE_CURRICULUM}>
      <Suspense>
        <PageInner />
      </Suspense>
    </PermissionGuard>
  );
}
