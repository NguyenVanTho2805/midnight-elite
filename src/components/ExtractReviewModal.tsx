"use client";

import { useState, useEffect, useRef } from "react";
import { api, type ExamFileFull, type ExamQuestionInput, type QuestionBankItemFull, type QuestionCategoryFull, type Difficulty } from "@/lib/api";
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

// Modal "Tách câu hỏi" dùng chung ở 2 nơi: trang Ngân hàng đề thi (tách 1
// file đã lưu trong kho) và luồng "Tải file lên & tách câu hỏi" ngay trong
// Ngân hàng câu hỏi (gallery/trang chi tiết 1 ngân hàng). `fixedBankId` có
// giá trị khi gọi từ 1 ngân hàng cụ thể (câu tách ra đi thẳng vào đó, bỏ qua
// bước tự đặt tên ngân hàng theo tên file); để trống (gọi từ Ngân hàng đề
// thi/gallery) thì tự lấy tên file làm tên ngân hàng, khớp lại nếu đã có
// hoặc tự tạo mới.
export function ExtractReviewModal({ examFile, fixedBankId, onClose, onSaved, showToast }: {
  examFile: ExamFileFull | null;
  fixedBankId?: string;
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

        if (qs.length === 0) { setCategories(cats); return; }

        if (fixedBankId) {
          // Gọi từ 1 ngân hàng cụ thể — câu tách ra đi thẳng vào đây, không
          // tự đặt tên/tạo ngân hàng mới theo file.
          const fixed = cats.find(c => c.id === fixedBankId);
          setCategories(cats);
          setTargetBankName(fixed?.name ?? "");
          setTargetBankId(fixedBankId);
        } else {
          // Ngân hàng đích lấy thẳng theo tên file — khớp ngân hàng đã có
          // trùng tên, chưa có thì tự tạo mới, không cần chọn tay.
          const bank = await findOrCreateCategory(null, bankNameFromFilename(examFile.fileName), cats);
          setCategories(bank.cats);
          setTargetBankName(bank.name);
          setTargetBankId(bank.id);
        }
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Tách câu hỏi thất bại", false);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examFile, fixedBankId]);

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
              <span className="text-gray-400">
                {fixedBankId ? "" : " (theo tên file — có thể đổi tên ngân hàng sau ở trang Ngân hàng câu hỏi)"}
              </span>
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
