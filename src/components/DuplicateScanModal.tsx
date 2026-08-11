"use client";

import { useState, useEffect, useCallback } from "react";
import { api, type DuplicateGroup, type BankItemStatus } from "@/lib/api";
import { MathText } from "@/components/MathText";

const TIER_LABEL: Record<DuplicateGroup["tier"], string> = {
  exact: "Trùng y hệt", fuzzy: "Giống chuỗi", semantic: "Giống nghĩa",
};
const STATUS_LABEL: Record<BankItemStatus, string> = { draft: "Nháp", pending: "Chờ duyệt", approved: "Đã duyệt" };

// Quét trùng lặp hàng loạt trong 1 ngân hàng (khác cơ chế chống trùng lúc
// thêm câu mới — đây là quét lại toàn bộ câu đã có sẵn). Mở từ trang chi
// tiết 1 ngân hàng.
export function DuplicateScanModal({ open, bankId, onClose }: {
  open: boolean;
  bankId: string;
  onClose: () => void;
}) {
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { groups } = await api.questionCategories.duplicates(bankId);
      setGroups(groups);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Quét trùng lặp thất bại");
    } finally {
      setLoading(false);
    }
  }, [bankId]);

  useEffect(() => { if (open) load(); }, [open, load]);

  if (!open) return null;

  async function handleDelete(id: string) {
    try {
      await api.questionBank.remove(id);
      setGroups(prev => prev
        .map(g => ({ ...g, items: g.items.filter(i => i.id !== id) }))
        .filter(g => g.items.length > 1));
    } catch {
      setError("Xoá thất bại");
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div className="bg-white rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "#e5e3df" }}>
          <div>
            <h2 className="text-base font-bold" style={{ color: "#1a1a1a" }}>Quét trùng lặp</h2>
            <p className="text-xs text-gray-500 mt-0.5">Quét toàn bộ câu hỏi trong ngân hàng này và các Chương/Bài bên trong</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 text-xl font-light">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
          {loading ? (
            <p className="text-center text-sm text-gray-400 py-8">Đang quét, có thể mất vài giây...</p>
          ) : error ? (
            <p className="text-center text-sm text-red-500 py-8">{error}</p>
          ) : groups.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">Không tìm thấy trùng lặp nào 🎉</p>
          ) : (
            groups.map((group, gi) => (
              <div key={gi} className="rounded-lg border overflow-hidden" style={{ borderColor: "#e5e3df" }}>
                <div className="px-3 py-2 text-xs font-semibold" style={{ background: "#f6f5f4", color: "#787671" }}>
                  {TIER_LABEL[group.tier]}{group.tier !== "exact" ? ` — giống ${Math.round(group.similarity * 100)}%` : ""}
                </div>
                <div className="divide-y" style={{ borderColor: "#e5e3df" }}>
                  {group.items.map(item => (
                    <div key={item.id} className="flex items-start gap-3 px-3 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate" style={{ color: "#1a1a1a" }}><MathText text={item.text} /></p>
                        <p className="text-xs text-gray-400 mt-0.5">{item.categoryPath} — {STATUS_LABEL[item.status]}</p>
                      </div>
                      <button onClick={() => handleDelete(item.id)} className="text-xs font-semibold text-red-500 flex-shrink-0">Xoá</button>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t" style={{ borderColor: "#e5e3df" }}>
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg text-gray-600 hover:bg-gray-50" style={{ borderColor: "#e5e3df" }}>Đóng</button>
        </div>
      </div>
    </div>
  );
}
