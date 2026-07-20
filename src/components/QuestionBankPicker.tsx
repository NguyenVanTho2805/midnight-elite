"use client";

import { useState, useEffect, useCallback } from "react";
import { api, type QuestionBankItemFull, type ExamQuestionInput, type QuestionType, type Difficulty } from "@/lib/api";

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
const TYPE_LABEL: Record<QuestionType, string> = {
  MC: "Trắc nghiệm", ESSAY: "Tự luận", TRUE_FALSE_CLUSTER: "Đúng-Sai 4 ý", SHORT_ANSWER: "Trả lời ngắn",
};

// Copy nội dung 1 câu từ Ngân hàng câu hỏi (QuestionBankItemFull) thành 1 câu
// mới độc lập trong đề (ExamQuestionInput) — chỉ giữ sourceBankItemId để truy
// vết nguồn gốc, KHÔNG share row (xem ghi chú ở QuestionBankItem trong
// prisma/schema.prisma). Sửa/xoá câu gốc trong ngân hàng sau này không ảnh
// hưởng câu đã copy vào đề.
function bankItemToExamQuestionInput(item: QuestionBankItemFull): ExamQuestionInput {
  return {
    text: item.text,
    type: item.type,
    imageUrl: item.imageUrl ?? undefined,
    points: item.points,
    explanation: item.explanation ?? undefined,
    options: item.options.map(o => ({ text: o.text, isCorrect: o.isCorrect, subLabel: o.subLabel ?? undefined })),
    sourceBankItemId: item.id,
  };
}

// Modal chọn câu có sẵn trong Ngân hàng câu hỏi để thêm vào đề đang soạn —
// dùng chung ở cả CreateExamDrawer (đề chưa lưu) và trang quản lý câu hỏi
// của 1 đề đã tồn tại. Component chỉ chịu trách nhiệm chọn + map dữ liệu,
// KHÔNG tự quyết định lưu ngay hay chỉ thêm vào state nháp — nơi gọi tự xử
// lý qua callback onAdd (2 nơi dùng có luồng lưu khác nhau).
export function QuestionBankPicker({ open, onClose, onAdd }: {
  open: boolean;
  onClose: () => void;
  onAdd: (items: ExamQuestionInput[]) => void;
}) {
  const [items, setItems]   = useState<QuestionBankItemFull[]>([]);
  const [total, setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Map<string, QuestionBankItemFull>>(new Map());

  const [search, setSearch]         = useState("");
  const [subjectFilter, setSubject] = useState("");
  const [topicFilter, setTopic]     = useState("");
  const [difficultyFilter, setDiff] = useState("");

  const [allSubjects, setAllSubjects] = useState<string[]>([]);
  const [allTopics, setAllTopics]     = useState<string[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.questionBank.list({
        search: search || undefined,
        subject: subjectFilter || undefined,
        topic: topicFilter || undefined,
        difficulty: difficultyFilter || undefined,
        pageSize: 50,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch { /* im lặng — không chặn modal nếu lỗi tải */ }
    finally { setLoading(false); }
  }, [search, subjectFilter, topicFilter, difficultyFilter]);

  useEffect(() => { if (open) loadData(); }, [open, loadData]);

  useEffect(() => {
    if (!open) return;
    api.questionBank.list({ pageSize: 500 }).then(data => {
      setAllSubjects([...new Set(data.items.map(i => i.subject))].sort());
      setAllTopics([...new Set(data.items.map(i => i.topic))].sort());
    }).catch(() => {});
  }, [open]);

  useEffect(() => {
    if (open) { setSelected(new Map()); setSearch(""); setSubject(""); setTopic(""); setDiff(""); }
  }, [open]);

  function toggle(item: QuestionBankItemFull) {
    setSelected(prev => {
      const next = new Map(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.set(item.id, item);
      return next;
    });
  }

  function handleAdd() {
    onAdd([...selected.values()].map(bankItemToExamQuestionInput));
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div className="bg-white rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "#e5e3df" }}>
          <div>
            <h2 className="text-base font-bold" style={{ color: "#1a1a1a" }}>Thêm câu từ Ngân hàng câu hỏi</h2>
            <p className="text-xs text-gray-500 mt-0.5">{total} câu — đã chọn {selected.size}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 text-xl font-light">×</button>
        </div>

        <div className="flex flex-wrap gap-2 px-5 py-3 border-b" style={{ borderColor: "#e5e3df" }}>
          <input
            className="flex-1 min-w-[160px] px-3 py-1.5 text-sm border rounded-lg outline-none focus:border-blue-400"
            style={{ borderColor: "#e5e3df" }}
            placeholder="Tìm theo nội dung câu hỏi..."
            value={search} onChange={e => setSearch(e.target.value)} />
          <select className="px-2.5 py-1.5 text-sm border rounded-lg outline-none" style={{ borderColor: "#e5e3df" }}
            value={subjectFilter} onChange={e => setSubject(e.target.value)}>
            <option value="">Tất cả môn</option>
            {allSubjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="px-2.5 py-1.5 text-sm border rounded-lg outline-none" style={{ borderColor: "#e5e3df" }}
            value={topicFilter} onChange={e => setTopic(e.target.value)}>
            <option value="">Tất cả chủ đề</option>
            {allTopics.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className="px-2.5 py-1.5 text-sm border rounded-lg outline-none" style={{ borderColor: "#e5e3df" }}
            value={difficultyFilter} onChange={e => setDiff(e.target.value)}>
            <option value="">Tất cả độ khó</option>
            {DIFFICULTIES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {loading ? (
            <p className="text-center text-sm text-gray-400 py-8">Đang tải...</p>
          ) : items.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">Không có câu hỏi nào khớp bộ lọc</p>
          ) : items.map(item => (
            <label key={item.id}
              className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50"
              style={{ borderColor: selected.has(item.id) ? "#0068FF" : "#e5e3df" }}>
              <input type="checkbox" className="mt-1" checked={selected.has(item.id)} onChange={() => toggle(item)} />
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate" style={{ color: "#1a1a1a" }}>{item.text}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-xs text-gray-500">{item.subject} / {item.topic}</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={DIFFICULTY_COLOR[item.difficulty]}>
                    {DIFFICULTIES.find(d => d.value === item.difficulty)?.label ?? item.difficulty}
                  </span>
                  <span className="text-xs text-gray-400">{TYPE_LABEL[item.type]}</span>
                </div>
              </div>
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t" style={{ borderColor: "#e5e3df" }}>
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg text-gray-600 hover:bg-gray-50" style={{ borderColor: "#e5e3df" }}>Huỷ</button>
          <button onClick={handleAdd} disabled={selected.size === 0}
            className="px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50" style={{ background: "#16a34a" }}>
            Thêm {selected.size > 0 ? `${selected.size} câu` : ""} đã chọn
          </button>
        </div>
      </div>
    </div>
  );
}
