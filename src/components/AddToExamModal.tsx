"use client";

import { useState, useEffect, useCallback } from "react";
import { api, type ExamFull, type QuestionBankItemFull } from "@/lib/api";
import { bankItemToExamQuestionInput } from "@/components/QuestionBankPicker";

// Modal chọn 1 đề đích để gộp các câu đã chọn từ Ngân hàng câu hỏi vào — dùng
// ở luồng "Tự chọn câu hỏi" (trang danh sách câu hỏi, chế độ chọn nhiều).
// api.exams.list() đã tự scope theo quyền sở hữu ở server (ownerScopeWhere)
// nên giáo viên chỉ thấy đề của chính mình, không cần lọc thêm ở đây.
export function AddToExamModal({ open, items, onClose, onAdded }: {
  open: boolean;
  items: QuestionBankItemFull[];
  onClose: () => void;
  onAdded: (examTitle: string) => void;
}) {
  const [exams, setExams] = useState<ExamFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.exams.list();
      setExams(data);
    } catch {
      setError("Lỗi tải danh sách đề thi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) { load(); setSearch(""); setSelectedExamId(null); setError(""); }
  }, [open, load]);

  if (!open) return null;

  const filtered = exams.filter(e => e.title.toLowerCase().includes(search.trim().toLowerCase()));

  async function handleAdd() {
    if (!selectedExamId) return;
    const exam = exams.find(e => e.id === selectedExamId);
    if (!exam) return;
    setSaving(true);
    setError("");
    try {
      await api.examQuestions.bulkCreate(selectedExamId, items.map(bankItemToExamQuestionInput));
      onAdded(exam.title);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Thêm vào đề thất bại");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div className="bg-white rounded-xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "#e5e3df" }}>
          <div>
            <h2 className="text-base font-bold" style={{ color: "#1a1a1a" }}>Thêm vào đề thi</h2>
            <p className="text-xs text-gray-500 mt-0.5">Chọn 1 đề để thêm {items.length} câu đã chọn</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 text-xl font-light">×</button>
        </div>

        <div className="px-5 py-3 border-b" style={{ borderColor: "#e5e3df" }}>
          <input
            className="w-full px-3 py-1.5 text-sm border rounded-lg outline-none focus:border-blue-400"
            style={{ borderColor: "#e5e3df" }}
            placeholder="Tìm theo tên đề..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1.5">
          {loading ? (
            <p className="text-center text-sm text-gray-400 py-8">Đang tải...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">Không có đề nào khớp</p>
          ) : filtered.map(exam => (
            <label key={exam.id}
              className="flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer hover:bg-gray-50"
              style={{ borderColor: selectedExamId === exam.id ? "#0068FF" : "#e5e3df" }}>
              <input type="radio" name="targetExam" checked={selectedExamId === exam.id}
                onChange={() => setSelectedExamId(exam.id)} />
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate" style={{ color: "#1a1a1a" }}>{exam.title}</p>
                <p className="text-xs text-gray-400">{exam.category} — {exam.questions} câu</p>
              </div>
            </label>
          ))}
        </div>

        {error && <p className="px-5 py-2 text-xs text-red-500">{error}</p>}

        <div className="flex justify-end gap-2 px-5 py-4 border-t" style={{ borderColor: "#e5e3df" }}>
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg text-gray-600 hover:bg-gray-50" style={{ borderColor: "#e5e3df" }}>Huỷ</button>
          <button onClick={handleAdd} disabled={!selectedExamId || saving}
            className="px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50" style={{ background: "#16a34a" }}>
            {saving ? "Đang thêm..." : "Thêm vào đề"}
          </button>
        </div>
      </div>
    </div>
  );
}
