"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import PermissionGuard from "@/components/PermissionGuard";
import { PERMISSIONS } from "@/contexts/AuthContext";
import { AdminToast, useAdminToast } from "@/components/AdminToast";
import { api, type ExamFileFull, type ExamQuestionInput, type QuestionBankItemFull, type QuestionCategoryFull, type Difficulty } from "@/lib/api";
import { CategoryPicker, categoryPath } from "@/components/CategoryPicker";

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

// ─── DUYỆT CÂU TÁCH RA (gán Đầu mục, chống trùng, rồi lưu vào Ngân hàng) ──────
interface ExtractMeta {
  include: boolean;
  categoryId: string;
  difficulty: Difficulty;
  aiSuggested: boolean; // true nếu AI đọc được mức độ từ đề gốc (không phải tự đoán)
  dupMatch: QuestionBankItemFull | null;
  similarMatches: { item: QuestionBankItemFull; similarity: number }[];
  semanticMatches: { item: QuestionBankItemFull; similarity: number }[];
  resolution: "new" | "skip";
  checking: boolean;
}

function ExtractReviewModal({ examFile, onClose, onSaved, showToast }: {
  examFile: ExamFileFull | null;
  onClose: () => void;
  onSaved: () => void;
  showToast: (msg: string, ok?: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<ExamQuestionInput[]>([]);
  const [errors, setErrors] = useState<{ block: number; message: string }[]>([]);
  const [meta, setMeta] = useState<ExtractMeta[]>([]);
  const [categories, setCategories] = useState<QuestionCategoryFull[]>([]);
  const [saving, setSaving] = useState(false);
  const [bulkCategoryId, setBulkCategoryId] = useState("");
  const refetchCategories = () => api.questionCategories.list().then(setCategories).catch(() => {});

  useEffect(() => {
    if (!examFile) { setQuestions([]); setMeta([]); setErrors([]); return; }
    refetchCategories();
    setLoading(true);
    api.examFiles.extract(examFile.id)
      .then(({ questions: qs, errors: errs }) => {
        setQuestions(qs);
        setErrors(errs);
        setMeta(qs.map(q => ({
          include: true,
          categoryId: "",
          difficulty: q.difficulty ?? "NB",
          aiSuggested: !!q.difficulty,
          dupMatch: null, similarMatches: [], semanticMatches: [], resolution: "new", checking: false,
        })));
      })
      .catch(e => showToast(e instanceof Error ? e.message : "Tách câu hỏi thất bại", false))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examFile]);

  function updateMeta(idx: number, patch: Partial<ExtractMeta>) {
    setMeta(prev => prev.map((m, i) => i === idx ? { ...m, ...patch } : m));
  }

  async function checkDup(idx: number, categoryId: string) {
    const q = questions[idx];
    if (!q || !categoryId) return;
    updateMeta(idx, { checking: true });
    try {
      const { match, similar, semantic } = await api.questionBank.checkDuplicate({ text: q.text, categoryId });
      updateMeta(idx, { dupMatch: match, similarMatches: similar, semanticMatches: semantic, resolution: "new", checking: false });
    } catch {
      updateMeta(idx, { checking: false });
    }
  }

  function applyBulkCategory() {
    if (!bulkCategoryId) return;
    setMeta(prev => prev.map(m => m.include ? { ...m, categoryId: bulkCategoryId } : m));
    meta.forEach((m, i) => { if (m.include) checkDup(i, bulkCategoryId); });
  }

  async function handleSaveAll() {
    setSaving(true);
    let saved = 0, skippedMissingCategory = 0, skippedDup = 0, failed = 0;
    for (let i = 0; i < questions.length; i++) {
      const m = meta[i];
      const q = questions[i];
      if (!m.include) continue;
      if (m.dupMatch && m.resolution === "skip") { skippedDup++; continue; }
      if (!m.categoryId) { skippedMissingCategory++; continue; }
      try {
        await api.questionBank.create({
          type: q.type ?? "MC",
          text: q.text,
          imageUrl: q.imageUrl,
          points: q.points ?? 1,
          explanation: q.explanation,
          categoryId: m.categoryId,
          difficulty: m.difficulty,
          options: q.options,
        });
        saved++;
      } catch {
        failed++;
      }
    }
    setSaving(false);
    const parts = [`Đã lưu ${saved} câu vào ngân hàng`];
    if (skippedMissingCategory) parts.push(`${skippedMissingCategory} câu bỏ qua (thiếu đầu mục)`);
    if (skippedDup) parts.push(`${skippedDup} câu bỏ qua (đã có sẵn)`);
    if (failed) parts.push(`${failed} câu lỗi khi lưu`);
    showToast(parts.join(" — "), failed === 0);
    onSaved();
    onClose();
  }

  if (!examFile) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "#e5e3df" }}>
          <div>
            <h2 className="text-base font-bold" style={{ color: "#1a1a1a" }}>Tách câu hỏi — {examFile.fileName}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {loading ? "AI đang đọc file, có thể mất 20-40 giây..." : `${questions.length} câu — gán Đầu mục rồi lưu vào Ngân hàng câu hỏi`}
            </p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 text-xl font-light">×</button>
        </div>

        {!loading && questions.length > 0 && (
          <div className="px-5 py-3 border-b" style={{ borderColor: "#e5e3df", background: "#eff6ff" }}>
            <p className="text-xs font-semibold text-gray-600 mb-2">Áp dụng Đầu mục cho tất cả câu đang chọn</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-[200px]">
                <CategoryPicker className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded outline-none focus:border-blue-400"
                  value={bulkCategoryId} categories={categories} onCategoriesChange={refetchCategories} onChange={setBulkCategoryId} />
              </div>
              <button type="button" onClick={applyBulkCategory} disabled={!bulkCategoryId}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg text-white disabled:opacity-50 flex-shrink-0"
                style={{ background: "#0068FF" }}>
                Áp dụng cho tất cả
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
          {loading ? (
            <p className="text-center text-sm text-gray-400 py-8">Đang xử lý...</p>
          ) : errors.length > 0 && questions.length === 0 ? (
            <p className="text-center text-sm text-red-500 py-8">Không tách được câu hỏi nào — {errors[0]?.message}</p>
          ) : questions.map((q, idx) => {
            const m = meta[idx];
            if (!m) return null;
            return (
              <div key={idx} className="rounded-lg p-3 border" style={{ borderColor: "#e5e3df", background: m.include ? "#fff" : "#f6f5f4" }}>
                <div className="flex items-start gap-2 mb-2">
                  <input type="checkbox" checked={m.include} onChange={e => updateMeta(idx, { include: e.target.checked })} className="mt-1" />
                  <p className="flex-1 text-sm" style={{ color: "#1a1a1a" }}>{q.text}</p>
                </div>
                {m.include && (
                  <div className="ml-6 space-y-2" style={{ width: "calc(100% - 1.5rem)" }}>
                    <CategoryPicker className="w-full px-2 py-1 text-xs border border-gray-300 rounded outline-none focus:border-blue-400"
                      value={m.categoryId} categories={categories} onCategoriesChange={refetchCategories}
                      onChange={v => { updateMeta(idx, { categoryId: v }); checkDup(idx, v); }} />
                    <div className="flex items-center gap-1 flex-wrap">
                      {DIFFICULTIES.map(d => (
                        <button key={d.value} type="button" onClick={() => updateMeta(idx, { difficulty: d.value })}
                          className="px-2 py-0.5 rounded-full text-xs font-semibold border"
                          style={m.difficulty === d.value
                            ? { background: DIFFICULTY_COLOR[d.value].bg, color: DIFFICULTY_COLOR[d.value].color, borderColor: DIFFICULTY_COLOR[d.value].color }
                            : { borderColor: "#E5E7EB", color: "#9CA3AF" }}>
                          {d.label}
                        </button>
                      ))}
                      {m.aiSuggested && <span className="text-xs text-gray-400">(AI đọc được từ đề gốc)</span>}
                    </div>
                    {m.checking && <p className="text-xs text-gray-400">Đang kiểm tra trùng lặp...</p>}
                    {m.dupMatch && (
                      <div className="p-2 rounded-lg text-xs" style={{ background: "#fef3c7", color: "#92400e" }}>
                        <p className="font-semibold">⚠️ Trùng khớp với câu đã có trong ngân hàng ({categoryPath(m.dupMatch.categoryId, categories)})</p>
                        <div className="flex gap-2 mt-1.5">
                          <button type="button" onClick={() => updateMeta(idx, { resolution: "skip" })}
                            className="px-2 py-1 rounded font-semibold"
                            style={m.resolution === "skip" ? { background: "#92400e", color: "#fff" } : { border: "1px solid #92400e" }}>
                            Bỏ qua (đã có)
                          </button>
                          <button type="button" onClick={() => updateMeta(idx, { resolution: "new" })}
                            className="px-2 py-1 rounded font-semibold"
                            style={m.resolution === "new" ? { background: "#92400e", color: "#fff" } : { border: "1px solid #92400e" }}>
                            Vẫn thêm câu mới
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t" style={{ borderColor: "#e5e3df" }}>
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg text-gray-600 hover:bg-gray-50" style={{ borderColor: "#e5e3df" }}>Huỷ</button>
          <button onClick={handleSaveAll} disabled={saving || loading || questions.length === 0}
            className="px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50" style={{ background: "#16a34a" }}>
            {saving ? "Đang lưu..." : "Lưu vào ngân hàng"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────
function PageInner() {
  const [items, setItems] = useState<ExamFileFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [extractTarget, setExtractTarget] = useState<ExamFileFull | null>(null);
  const [delTarget, setDelTarget] = useState<ExamFileFull | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast, showToast } = useAdminToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await api.examFiles.list());
    } catch {
      showToast("Lỗi tải danh sách file", false);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await api.examFiles.upload(file);
      showToast("Đã tải lên file đề thi");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Upload thất bại", false);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete() {
    if (!delTarget) return;
    try {
      await api.examFiles.remove(delTarget.id);
      showToast("Đã xoá file");
      setDelTarget(null);
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Xoá thất bại", false);
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {toast && <AdminToast msg={toast.msg} ok={toast.ok} />}

      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-extrabold" style={{ color: "#1a1a1a" }}>Ngân hàng đề thi</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Lưu trữ file đề gốc (PDF/Word) để xem lại sau — bấm &quot;Tách câu hỏi&quot; khi cần đưa câu vào{" "}
            <Link href="/admin/thi-thu/ngan-hang-cau-hoi" className="text-blue-600 hover:underline">Ngân hàng câu hỏi</Link>
          </p>
        </div>
        <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
          className="px-4 py-2.5 text-sm font-semibold text-white rounded-lg disabled:opacity-50" style={{ background: "#0068FF" }}>
          {uploading ? "Đang tải lên..." : "+ Tải file lên"}
        </button>
        <input ref={fileInputRef} type="file" accept=".pdf,.docx,.jpg,.jpeg,.png,.webp" className="hidden" onChange={handleUpload} />
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#e5e3df" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 uppercase tracking-wide" style={{ background: "#f6f5f4" }}>
              <th className="px-4 py-3">Tên file</th>
              <th className="px-4 py-3">Người tải lên</th>
              <th className="px-4 py-3">Ngày tải lên</th>
              <th className="px-4 py-3">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Đang tải...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Chưa có file đề thi nào</td></tr>
            ) : items.map(item => (
              <tr key={item.id} className="border-t" style={{ borderColor: "#e5e3df" }}>
                <td className="px-4 py-3 max-w-sm truncate" title={item.fileName}>{item.fileName}</td>
                <td className="px-4 py-3 text-gray-600">{item.owner?.name ?? "—"}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{new Date(item.createdAt).toLocaleDateString("vi-VN")}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-3">
                    <a href={item.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold" style={{ color: "#0068FF" }}>
                      Xem/Tải về
                    </a>
                    <button onClick={() => setExtractTarget(item)} className="text-xs font-semibold" style={{ color: "#16a34a" }}>
                      Tách câu hỏi
                    </button>
                    <button onClick={() => setDelTarget(item)} className="text-xs font-semibold text-red-500">Xoá</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ExtractReviewModal
        examFile={extractTarget}
        onClose={() => setExtractTarget(null)}
        onSaved={() => {}}
        showToast={showToast}
      />

      {delTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.3)" }}>
          <div className="bg-white rounded-xl p-5 max-w-sm w-full mx-4">
            <p className="text-sm font-semibold mb-1">Xoá file &quot;{delTarget.fileName}&quot;?</p>
            <p className="text-xs text-gray-500 mb-4">Chỉ xoá file lưu trữ — không ảnh hưởng câu hỏi đã tách và lưu vào ngân hàng trước đó.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDelTarget(null)} className="px-3 py-1.5 text-sm border rounded-lg text-gray-600" style={{ borderColor: "#e5e3df" }}>Huỷ</button>
              <button onClick={handleDelete} className="px-3 py-1.5 text-sm font-semibold text-white rounded-lg" style={{ background: "#dc2626" }}>Xoá</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ExamFilesAdminPage() {
  return (
    <PermissionGuard required={PERMISSIONS.MANAGE_CURRICULUM}>
      <PageInner />
    </PermissionGuard>
  );
}
