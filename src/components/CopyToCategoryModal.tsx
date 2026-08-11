"use client";

import { useState, useEffect, useCallback } from "react";
import { api, type QuestionBankItemFull, type QuestionCategoryFull } from "@/lib/api";
import { CategoryPicker } from "@/components/CategoryPicker";

// Modal sao chép nhiều câu hỏi lẻ sang 1 đầu mục khác — khác "Copy ngân
// hàng" (copy cả cây). Không giới hạn trạng thái câu nguồn (khác
// AddToExamModal chỉ nhận câu đã duyệt) vì bản copy luôn đi qua lại quy
// trình duyệt ở server.
export function CopyToCategoryModal({ open, items, onClose, onCopied }: {
  open: boolean;
  items: QuestionBankItemFull[];
  onClose: () => void;
  onCopied: (count: number) => void;
}) {
  const [categories, setCategories] = useState<QuestionCategoryFull[]>([]);
  const [targetCategoryId, setTargetCategoryId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const refetchCategories = useCallback(() => api.questionCategories.list().then(setCategories).catch(() => {}), []);

  useEffect(() => {
    if (open) { refetchCategories(); setTargetCategoryId(""); setError(""); }
  }, [open, refetchCategories]);

  if (!open) return null;

  async function handleCopy() {
    if (!targetCategoryId) return;
    setSaving(true);
    setError("");
    try {
      const { copied } = await api.questionBank.copy(items.map(i => i.id), targetCategoryId);
      onCopied(copied);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sao chép thất bại");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div className="bg-white rounded-xl w-full max-w-md flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "#e5e3df" }}>
          <div>
            <h2 className="text-base font-bold" style={{ color: "#1a1a1a" }}>Copy vào đầu mục khác</h2>
            <p className="text-xs text-gray-500 mt-0.5">Sao chép {items.length} câu đã chọn — câu mới vẫn qua lại quy trình duyệt</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 text-xl font-light">×</button>
        </div>

        <div className="px-5 py-4">
          <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Đầu mục đích</label>
          <CategoryPicker className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:border-blue-400"
            value={targetCategoryId} categories={categories} onCategoriesChange={refetchCategories} onChange={setTargetCategoryId} />
        </div>

        {error && <p className="px-5 pb-2 text-xs text-red-500">{error}</p>}

        <div className="flex justify-end gap-2 px-5 py-4 border-t" style={{ borderColor: "#e5e3df" }}>
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg text-gray-600 hover:bg-gray-50" style={{ borderColor: "#e5e3df" }}>Huỷ</button>
          <button onClick={handleCopy} disabled={!targetCategoryId || saving}
            className="px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50" style={{ background: "#16a34a" }}>
            {saving ? "Đang copy..." : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}
