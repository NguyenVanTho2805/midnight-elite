"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import PermissionGuard from "@/components/PermissionGuard";
import { PERMISSIONS } from "@/contexts/AuthContext";
import { AdminToast, useAdminToast } from "@/components/AdminToast";
import { api, type ExamFileFull, type ExamFileFolderFull, type ExamQuestionInput, type QuestionBankItemFull, type QuestionCategoryFull, type Difficulty } from "@/lib/api";
import { CategoryPicker, categoryPath } from "@/components/CategoryPicker";
import { MathText } from "@/components/MathText";

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
  const [targetBankId, setTargetBankId] = useState("");
  const [targetBankName, setTargetBankName] = useState("");
  const [placing, setPlacing] = useState(false);
  const placedForRef = useRef<string | null>(null); // bankId đã tự xếp rồi — tránh chạy lại/tạo trùng
  const refetchCategories = () => api.questionCategories.list().then(setCategories).catch(() => {});

  // Tìm đầu mục con tên khớp `name` (không phân biệt hoa/thường, đã trim)
  // trong `parentId` (null = tầng gốc/ngân hàng) — không thấy thì tạo mới.
  // Trả về id + danh sách category đã cập nhật (để lượt gọi sau trong cùng
  // phiên tự khớp thấy đầu mục vừa tạo, không tạo trùng).
  async function findOrCreateCategory(
    parentId: string | null, name: string, cats: QuestionCategoryFull[]
  ): Promise<{ id: string; name: string; cats: QuestionCategoryFull[] }> {
    const normalized = name.trim().toLowerCase();
    const existing = cats.find(c => c.parentId === parentId && c.name.trim().toLowerCase() === normalized);
    if (existing) return { id: existing.id, name: existing.name, cats };
    const created = await api.questionCategories.create({ name: name.trim(), parentId });
    return { id: created.id, name: created.name, cats: [...cats, { ...created, count: 0, difficultyCounts: { NB: 0, TH: 0, VD: 0, VDC: 0 } }] };
  }

  // Bỏ tên phần mở rộng (".pdf"/".docx"/...) khỏi tên file để làm tên ngân
  // hàng đích — không xử lý gì thêm (không viết hoa/chuẩn hoá), giữ nguyên ý
  // định đặt tên của giáo viên khi lưu file.
  function bankNameFromFilename(fileName: string): string {
    const dot = fileName.lastIndexOf(".");
    return (dot > 0 ? fileName.slice(0, dot) : fileName).trim();
  }

  useEffect(() => {
    if (!examFile) {
      setQuestions([]); setMeta([]); setErrors([]);
      setTargetBankId(""); setTargetBankName(""); placedForRef.current = null;
      return;
    }
    setLoading(true);
    setTargetBankId(""); setTargetBankName("");
    placedForRef.current = null;

    (async () => {
      try {
        const [cats, { questions: qs, errors: errs }] = await Promise.all([
          api.questionCategories.list(),
          api.examFiles.extract(examFile.id),
        ]);
        setQuestions(qs);
        setErrors(errs);
        setMeta(qs.map(q => ({
          include: true,
          categoryId: "",
          difficulty: q.difficulty ?? "NB",
          aiSuggested: !!q.difficulty,
          dupMatch: null, similarMatches: [], semanticMatches: [], resolution: "new", checking: false,
        })));

        // Ngân hàng đích lấy thẳng theo tên file — khớp ngân hàng đã có
        // trùng tên, chưa có thì tự tạo mới, không cần chọn tay.
        if (qs.length > 0) {
          const bank = await findOrCreateCategory(null, bankNameFromFilename(examFile.fileName), cats);
          setCategories(bank.cats);
          setTargetBankName(bank.name);
          setTargetBankId(bank.id);
        } else {
          setCategories(cats);
        }
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Tách câu hỏi thất bại", false);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examFile]);

  function updateMeta(idx: number, patch: Partial<ExtractMeta>) {
    setMeta(prev => prev.map((m, i) => i === idx ? { ...m, ...patch } : m));
  }

  // AI gợi ý Chương/Bài cho từng câu (bố cục file không có tiêu đề rõ ràng,
  // nên đây là suy luận — xem SYSTEM_INSTRUCTION trong aiExamImport.ts) — tự
  // khớp vào đầu mục có sẵn theo tên trong ngân hàng đích, chưa có thì tự
  // tạo. Chạy tuần tự (không Promise.all) vì câu sau cần thấy đầu mục câu
  // trước vừa tạo để không tạo trùng. Vẫn qua bước duyệt (checkDup + màn hình
  // review) trước khi lưu thật — không lưu thẳng.
  useEffect(() => {
    if (!targetBankId || questions.length === 0 || placedForRef.current === targetBankId) return;
    placedForRef.current = targetBankId;

    (async () => {
      setPlacing(true);
      let cats = categories;
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!q.suggestedChapter) continue;
        try {
          const chapter = await findOrCreateCategory(targetBankId, q.suggestedChapter, cats);
          cats = chapter.cats;
          let finalId = chapter.id;
          if (q.suggestedLesson) {
            const lesson = await findOrCreateCategory(chapter.id, q.suggestedLesson, cats);
            cats = lesson.cats;
            finalId = lesson.id;
          }
          updateMeta(i, { categoryId: finalId });
          checkDup(i, finalId);
        } catch {
          // 1 câu lỗi khi tự xếp không chặn các câu còn lại — giáo viên tự
          // chọn tay đầu mục cho câu đó ở màn hình duyệt.
        }
      }
      setCategories(cats);
      setPlacing(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetBankId, questions]);

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

        {!loading && questions.length > 0 && targetBankName && (
          <div className="px-5 py-3 border-b" style={{ borderColor: "#e5e3df" }}>
            <p className="text-xs text-gray-500">
              Ngân hàng đích: <span className="font-semibold" style={{ color: "#1a1a1a" }}>{targetBankName}</span>
              <span className="text-gray-400"> (theo tên file — có thể đổi tên ngân hàng sau ở trang Ngân hàng câu hỏi)</span>
            </p>
            {placing && <p className="text-xs mt-1.5" style={{ color: "#0068FF" }}>AI đang xếp câu hỏi vào Chương/Bài...</p>}
          </div>
        )}

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
                  <div className="flex-1">
                    <p className="text-sm" style={{ color: "#1a1a1a" }}><MathText text={q.text} /></p>
                    {q.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={q.imageUrl} alt="Hình/biểu đồ AI đã cắt từ đề gốc" className="mt-2 max-w-xs rounded-lg border" style={{ borderColor: "#e5e3df" }} />
                    )}
                  </div>
                </div>
                {m.include && (
                  <div className="ml-6 space-y-2" style={{ width: "calc(100% - 1.5rem)" }}>
                    <CategoryPicker className="w-full px-2 py-1 text-xs border border-gray-300 rounded outline-none focus:border-blue-400"
                      value={m.categoryId} categories={categories} onCategoriesChange={refetchCategories}
                      onChange={v => { updateMeta(idx, { categoryId: v }); checkDup(idx, v); }} />
                    {q.suggestedChapter && (
                      <p className="text-xs text-gray-400">
                        AI gợi ý: {q.suggestedChapter}{q.suggestedLesson ? ` › ${q.suggestedLesson}` : ""}
                      </p>
                    )}
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
          <button onClick={handleSaveAll} disabled={saving || loading || placing || questions.length === 0}
            className="px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50" style={{ background: "#16a34a" }}>
            {saving ? "Đang lưu..." : "Lưu vào ngân hàng"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── DUYỆT THƯ MỤC KIỂU FILE MANAGER (1 cấp phẳng, giống trang "Đề thi" của
// Azota — thư mục VÀ file gộp chung 1 bảng, không tách view riêng). Root =
// mọi thư mục + file chưa phân loại; bấm vào 1 thư mục để xem file bên
// trong (không có thư mục con vì thư mục ở đây là 1 cấp phẳng).
type View = { type: "root" } | { type: "folder"; id: string; name: string };

function Breadcrumb({ view, onRoot }: { view: View; onRoot: () => void }) {
  return (
    <div className="flex items-center gap-1.5 text-sm mb-4">
      <button onClick={onRoot} className={view.type === "root" ? "font-bold" : "font-semibold text-blue-600 hover:underline"}
        style={view.type === "root" ? { color: "#1a1a1a" } : undefined}>
        Tất cả
      </button>
      {view.type === "folder" && (
        <>
          <span className="text-gray-400">›</span>
          <span className="font-bold" style={{ color: "#1a1a1a" }}>{view.name}</span>
        </>
      )}
    </div>
  );
}

// Bảng gộp thư mục + file trong CÙNG 1 danh sách (giống trang "Đề thi" gốc
// của Azota — họ cũng gộp icon thư mục lẫn file trong 1 bảng, không tách
// view riêng). `folders` chỉ khác rỗng khi đang ở root (thư mục phẳng,
// không có thư mục con để liệt kê khi đã ở trong 1 thư mục).
function FileFolderTable({ folders, files, allFolders, onOpenFolder, onRenamed, onDeleted, onExtract, onMove, onRequestDeleteFile, onDeleteFileNow, showToast, loading }: {
  folders: ExamFileFolderFull[];
  files: ExamFileFull[];
  allFolders: ExamFileFolderFull[];
  onOpenFolder: (f: ExamFileFolderFull) => void;
  onRenamed: () => void;
  onDeleted: () => void;
  onExtract: (f: ExamFileFull) => void;
  onMove: (f: ExamFileFull, folderId: string) => void;
  // Xoá từng file: mở modal xác nhận (nút Xoá ở từng dòng). Xoá hàng loạt:
  // xoá thẳng luôn (đã có 1 lần confirm() gộp cho cả nhóm ở handleDeleteSelected).
  onRequestDeleteFile: (f: ExamFileFull) => void;
  onDeleteFileNow: (f: ExamFileFull) => Promise<void>;
  showToast: (msg: string, ok?: boolean) => void;
  loading: boolean;
}) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [sortAsc, setSortAsc] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  async function handleRenameFolder(id: string) {
    if (!renameValue.trim()) return;
    try {
      await api.examFileFolders.update(id, renameValue.trim());
      setRenaming(null);
      onRenamed();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Đổi tên thất bại", false);
    }
  }

  async function handleDeleteFolder(id: string) {
    if (!confirm("Xoá thư mục này? (chỉ xoá được nếu không còn file bên trong)")) return;
    try {
      await api.examFileFolders.remove(id);
      onDeleted();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Xoá thất bại", false);
    }
  }

  async function handleDeleteSelected() {
    if (selected.size === 0) return;
    if (!confirm(`Xoá ${selected.size} file đã chọn?`)) return;
    for (const f of files) {
      if (selected.has(f.id)) await onDeleteFileNow(f);
    }
    setSelected(new Set());
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const sortedFolders = [...folders].sort((a, b) => sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
  const sortedFiles = [...files].sort((a, b) => sortAsc ? a.fileName.localeCompare(b.fileName) : b.fileName.localeCompare(a.fileName));
  const allFileIdsSelected = files.length > 0 && files.every(f => selected.has(f.id));

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#e5e3df" }}>
      <div className="flex items-center gap-3 px-4 py-3 text-xs text-gray-500 uppercase tracking-wide" style={{ background: "#f6f5f4" }}>
        <input type="checkbox" checked={allFileIdsSelected} disabled={files.length === 0}
          onChange={e => setSelected(e.target.checked ? new Set(files.map(f => f.id)) : new Set())} />
        <button onClick={() => setSortAsc(v => !v)} className="flex items-center gap-1 hover:text-gray-700">
          Tên <span>{sortAsc ? "▲" : "▼"}</span>
        </button>
        <span className="flex-1" />
        {selected.size > 0 && (
          <button onClick={handleDeleteSelected} className="text-xs font-semibold text-red-500 normal-case">Xoá {selected.size} đã chọn</button>
        )}
        <span className="w-28 text-right">Người tải lên</span>
        <span className="w-24 text-right">Ngày tải</span>
        <span className="w-56 text-right">Hành động</span>
      </div>

      {sortedFolders.map(f => (
        <div key={f.id} className="flex items-center gap-3 px-4 py-3 border-t group" style={{ borderColor: "#e5e3df" }}>
          <span className="w-4 flex-shrink-0" />
          {renaming === f.id ? (
            <div className="flex items-center gap-2 flex-1">
              <input autoFocus className="flex-1 px-2 py-1.5 text-sm border rounded-lg outline-none focus:border-blue-400" style={{ borderColor: "#e5e3df" }}
                value={renameValue} onChange={e => setRenameValue(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleRenameFolder(f.id); if (e.key === "Escape") setRenaming(null); }} />
              <button onClick={() => handleRenameFolder(f.id)} className="text-xs font-semibold text-blue-600 flex-shrink-0">Lưu</button>
              <button onClick={() => setRenaming(null)} className="text-xs text-gray-400 flex-shrink-0">Huỷ</button>
            </div>
          ) : (
            <>
              <button onClick={() => onOpenFolder(f)} className="flex items-center gap-2.5 flex-1 text-left py-0.5 min-w-0">
                <span className="text-lg flex-shrink-0">📁</span>
                <span className="text-sm font-medium truncate" style={{ color: "#1a1a1a" }}>{f.name}</span>
              </button>
              <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" style={{ width: "17.5rem" }}>
                <button onClick={() => { setRenaming(f.id); setRenameValue(f.name); }} className="text-xs font-semibold text-blue-600">Đổi tên</button>
                <button onClick={() => handleDeleteFolder(f.id)} className="text-xs font-semibold text-red-500">Xoá</button>
              </div>
            </>
          )}
        </div>
      ))}

      {sortedFiles.map(item => (
        <div key={item.id} className="flex items-center gap-3 px-4 py-3 border-t" style={{ borderColor: "#e5e3df" }}>
          <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleSelect(item.id)} className="flex-shrink-0" />
          <span className="text-lg flex-shrink-0">📄</span>
          <span className="text-sm flex-1 truncate" title={item.fileName}>{item.fileName}</span>
          <span className="w-28 text-right text-xs text-gray-500 truncate">{item.owner?.name ?? "—"}</span>
          <span className="w-24 text-right text-xs text-gray-400">{new Date(item.createdAt).toLocaleDateString("vi-VN")}</span>
          <div className="flex items-center justify-end gap-2 flex-wrap" style={{ width: "17.5rem" }}>
            <a href={item.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold" style={{ color: "#0068FF" }}>Xem</a>
            <button onClick={() => onExtract(item)} className="text-xs font-semibold" style={{ color: "#16a34a" }}>Tách câu</button>
            <select className="px-1 py-1 text-xs border rounded outline-none bg-white max-w-[6rem]" style={{ borderColor: "#e5e3df" }}
              value={item.folderId ?? ""} onChange={e => onMove(item, e.target.value)}>
              <option value="">Chưa phân loại</option>
              {allFolders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <button onClick={() => onRequestDeleteFile(item)} className="text-xs font-semibold text-red-500">Xoá</button>
          </div>
        </div>
      ))}

      {loading && <p className="px-4 py-8 text-center text-sm text-gray-400">Đang tải...</p>}
      {!loading && sortedFolders.length === 0 && sortedFiles.length === 0 && (
        <p className="px-4 py-8 text-center text-sm text-gray-400">Chưa có thư mục hay file nào ở đây</p>
      )}
    </div>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────
function PageInner() {
  const [items, setItems] = useState<ExamFileFull[]>([]);
  const [folders, setFolders] = useState<ExamFileFolderFull[]>([]);
  const [view, setView] = useState<View>({ type: "root" });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [extractTarget, setExtractTarget] = useState<ExamFileFull | null>(null);
  const [delTarget, setDelTarget] = useState<ExamFileFull | null>(null);
  const [search, setSearch] = useState("");
  const [addingFolder, setAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
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
  const loadFolders = useCallback(() => {
    api.examFileFolders.list().then(setFolders).catch(() => {});
  }, []);

  useEffect(() => { load(); loadFolders(); }, [load, loadFolders]);

  const q = search.trim().toLowerCase();
  const foldersToShow = (view.type === "root" ? folders : []) // thư mục phẳng — không có thư mục con
    .filter(f => !q || f.name.toLowerCase().includes(q));
  const filesToShow = items
    .filter(item => view.type === "root" ? !item.folderId : item.folderId === view.id)
    .filter(item => !q || item.fileName.toLowerCase().includes(q));
  const recentFiles = [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 4);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const folderId = view.type === "folder" ? view.id : null;
      await api.examFiles.upload(file, folderId);
      showToast("Đã tải lên file đề thi");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Upload thất bại", false);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleMove(item: ExamFileFull, folderId: string) {
    try {
      const updated = await api.examFiles.move(item.id, folderId || null);
      setItems(prev => prev.map(x => x.id === item.id ? updated : x));
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Chuyển thư mục thất bại", false);
    }
  }

  async function handleDeleteFileNow(file: ExamFileFull) {
    try {
      await api.examFiles.remove(file.id);
      setItems(prev => prev.filter(x => x.id !== file.id));
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Xoá thất bại", false);
    }
  }

  async function handleDeleteConfirmed() {
    if (!delTarget) return;
    await handleDeleteFileNow(delTarget);
    showToast("Đã xoá file");
    setDelTarget(null);
  }

  async function handleCreateFolder() {
    if (!newFolderName.trim()) return;
    try {
      await api.examFileFolders.create(newFolderName.trim());
      setAddingFolder(false); setNewFolderName("");
      loadFolders();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Tạo thư mục thất bại", false);
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {toast && <AdminToast msg={toast.msg} ok={toast.ok} />}

      <div className="mb-5">
        <h1 className="text-xl font-extrabold" style={{ color: "#1a1a1a" }}>Ngân hàng đề thi</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Lưu trữ file đề gốc (PDF/Word) để xem lại sau — bấm &quot;Tách câu hỏi&quot; khi cần đưa câu vào{" "}
          <Link href="/admin/thi-thu/ngan-hang-cau-hoi" className="text-blue-600 hover:underline">Ngân hàng câu hỏi</Link>
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm kiếm..."
          className="flex-1 min-w-[200px] max-w-xs px-3 py-2.5 text-sm border rounded-lg outline-none focus:border-blue-400"
          style={{ borderColor: "#e5e3df" }} />
        <div className="flex items-center gap-2 flex-shrink-0">
          {addingFolder ? (
            <div className="flex items-center gap-2">
              <input autoFocus className="px-3 py-2 text-sm border rounded-lg outline-none focus:border-blue-400" style={{ borderColor: "#e5e3df" }}
                placeholder="Tên thư mục..." value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleCreateFolder(); if (e.key === "Escape") { setAddingFolder(false); setNewFolderName(""); } }} />
              <button onClick={handleCreateFolder} className="px-3 py-2 text-sm font-semibold text-white rounded-lg" style={{ background: "#0068FF" }}>Thêm</button>
              <button onClick={() => { setAddingFolder(false); setNewFolderName(""); }} className="text-sm text-gray-400">Huỷ</button>
            </div>
          ) : (
            <button onClick={() => setAddingFolder(true)}
              className="px-4 py-2.5 text-sm font-semibold text-white rounded-lg" style={{ background: "#0052DD" }}>
              📁+ Tạo thư mục
            </button>
          )}
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
            className="px-4 py-2.5 text-sm font-semibold text-white rounded-lg disabled:opacity-50" style={{ background: "#16a34a" }}>
            {uploading ? "Đang tải lên..." : "+ Tải file lên"}
          </button>
          <input ref={fileInputRef} type="file" accept=".pdf,.docx,.jpg,.jpeg,.png,.webp" className="hidden" onChange={handleUpload} />
        </div>
      </div>

      {view.type === "root" && recentFiles.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-bold mb-3" style={{ color: "#1a1a1a" }}>Tải lên gần đây</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {recentFiles.map(f => (
              <a key={f.id} href={f.fileUrl} target="_blank" rel="noopener noreferrer"
                className="rounded-xl border p-3 hover:shadow-sm transition-shadow" style={{ borderColor: "#e5e3df" }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-2" style={{ background: "#fff7ed" }}>
                  <span className="text-lg">📄</span>
                </div>
                <p className="text-xs font-semibold truncate" style={{ color: "#1a1a1a" }} title={f.fileName}>{f.fileName}</p>
                <p className="text-xs text-gray-400 mt-1">Ngày tải: {new Date(f.createdAt).toLocaleDateString("vi-VN")}</p>
                {f.folder && <p className="text-xs text-gray-400 truncate">📁 {f.folder.name}</p>}
              </a>
            ))}
          </div>
        </div>
      )}

      <Breadcrumb view={view} onRoot={() => setView({ type: "root" })} />

      <FileFolderTable
        folders={foldersToShow}
        files={filesToShow}
        allFolders={folders}
        onOpenFolder={f => setView({ type: "folder", id: f.id, name: f.name })}
        onRenamed={loadFolders}
        onDeleted={loadFolders}
        onExtract={setExtractTarget}
        onMove={handleMove}
        onRequestDeleteFile={setDelTarget}
        onDeleteFileNow={handleDeleteFileNow}
        showToast={showToast}
        loading={loading}
      />

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
              <button onClick={handleDeleteConfirmed} className="px-3 py-1.5 text-sm font-semibold text-white rounded-lg" style={{ background: "#dc2626" }}>Xoá</button>
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
