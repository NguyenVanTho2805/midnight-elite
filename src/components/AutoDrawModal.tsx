"use client";

import { useState, useEffect } from "react";
import { api, type ExamQuestionInput, type Difficulty, type DrawResult } from "@/lib/api";

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: "NB",  label: "Nhận biết" },
  { value: "TH",  label: "Thông hiểu" },
  { value: "VD",  label: "Vận dụng" },
  { value: "VDC", label: "Vận dụng cao" },
];

// Giai đoạn 5 — rút đề tự động theo ma trận môn×độ khó, gọi
// POST /api/question-bank/draw (đã tự copy + gắn sourceBankItemId, giống hệt
// chiều "+ Từ ngân hàng" của QuestionBankPicker) rồi trả kết quả qua onAdd —
// dùng chung callback với QuestionBankPicker nên nơi gọi không cần phân biệt
// 2 nguồn thêm câu.
export function AutoDrawModal({ open, onClose, onAdd }: {
  open: boolean;
  onClose: () => void;
  onAdd: (items: ExamQuestionInput[]) => void;
}) {
  const [allSubjects, setAllSubjects] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [counts, setCounts] = useState<Record<Difficulty, string>>({ NB: "", TH: "", VD: "", VDC: "" });
  const [excludeRecentExams, setExcludeRecentExams] = useState("3");
  const [drawing, setDrawing] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ count: number; shortfall: DrawResult["shortfall"] } | null>(null);

  useEffect(() => {
    if (!open) return;
    api.questionBank.list({ pageSize: 500 }).then(data => {
      setAllSubjects([...new Set(data.items.map(i => i.subject))].sort());
    }).catch(() => {});
  }, [open]);

  useEffect(() => {
    if (open) {
      setSubject(""); setCounts({ NB: "", TH: "", VD: "", VDC: "" });
      setExcludeRecentExams("3"); setError(""); setResult(null);
    }
  }, [open]);

  const totalRequested = DIFFICULTIES.reduce((sum, d) => sum + (Number(counts[d.value]) || 0), 0);

  async function handleDraw() {
    if (!subject.trim()) { setError("Chọn môn học"); return; }
    if (totalRequested === 0) { setError("Nhập số câu cần rút cho ít nhất 1 độ khó"); return; }
    setError(""); setDrawing(true); setResult(null);
    try {
      const counted: Partial<Record<Difficulty, number>> = {};
      for (const d of DIFFICULTIES) {
        const n = Number(counts[d.value]);
        if (n > 0) counted[d.value] = n;
      }
      const data = await api.questionBank.draw({
        subject: subject.trim(),
        counts: counted,
        excludeRecentExams: Number(excludeRecentExams) || 0,
      });
      onAdd(data.questions);
      setResult({ count: data.questions.length, shortfall: data.shortfall });
    } catch (e) {
      setError("Rút đề thất bại: " + (e instanceof Error ? e.message : "lỗi không xác định"));
    } finally {
      setDrawing(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div className="bg-white rounded-xl w-full max-w-md flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "#e5e3df" }}>
          <div>
            <h2 className="text-base font-bold" style={{ color: "#1a1a1a" }}>Rút đề tự động</h2>
            <p className="text-xs text-gray-500 mt-0.5">Chọn ngẫu nhiên từ ngân hàng theo môn + số câu mỗi độ khó</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 text-xl font-light">×</button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Môn học *</label>
            <select className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:border-blue-400" style={{ borderColor: "#e5e3df" }}
              value={subject} onChange={e => setSubject(e.target.value)}>
              <option value="">Chọn môn...</option>
              {allSubjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Số câu mỗi độ khó</label>
            <div className="grid grid-cols-4 gap-2">
              {DIFFICULTIES.map(d => (
                <div key={d.value}>
                  <input type="number" min={0}
                    className="w-full px-2 py-1.5 text-sm text-center border rounded-lg outline-none focus:border-blue-400"
                    style={{ borderColor: "#e5e3df" }}
                    placeholder="0"
                    value={counts[d.value]}
                    onChange={e => setCounts(c => ({ ...c, [d.value]: e.target.value }))} />
                  <p className="text-[10px] text-gray-400 text-center mt-1">{d.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Chống trùng với N đề gần nhất đã dùng ngân hàng</label>
            <input type="number" min={0}
              className="w-24 px-2 py-1.5 text-sm border rounded-lg outline-none focus:border-blue-400"
              style={{ borderColor: "#e5e3df" }}
              value={excludeRecentExams}
              onChange={e => setExcludeRecentExams(e.target.value)} />
            <p className="text-xs text-gray-400 mt-1">0 = không chống trùng, cho phép rút cả câu vừa dùng ở đề trước</p>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          {result && (
            <div className="p-3 rounded-lg text-xs" style={{ background: result.count > 0 ? "#dcfce7" : "#fee2e2", color: result.count > 0 ? "#16a34a" : "#dc2626" }}>
              <p className="font-semibold">Đã thêm {result.count} câu vào đề.</p>
              {Object.entries(result.shortfall).length > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {Object.entries(result.shortfall).map(([d, s]) => (
                    <li key={d}>Thiếu {d}: chỉ rút được {s!.drawn}/{s!.requested} câu (ngân hàng không đủ)</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t" style={{ borderColor: "#e5e3df" }}>
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-sm border text-gray-600 hover:bg-gray-50" style={{ borderColor: "#e5e3df" }}>
            {result ? "Đóng" : "Huỷ"}
          </button>
          <button onClick={handleDraw} disabled={drawing}
            className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "#0068FF" }}>
            {drawing ? "Đang rút..." : "Rút đề"}
          </button>
        </div>
      </div>
    </div>
  );
}
