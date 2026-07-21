"use client";

import { useState, useEffect } from "react";
import { api, type ExamQuestionInput, type Difficulty, type DrawResult } from "@/lib/api";
import { SUBJECT_GROUPS } from "@/lib/subjectTaxonomy";

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: "NB",  label: "Nhận biết" },
  { value: "TH",  label: "Thông hiểu" },
  { value: "VD",  label: "Vận dụng" },
  { value: "VDC", label: "Vận dụng cao" },
];
const EMPTY_COUNTS: Record<Difficulty, string> = { NB: "", TH: "", VD: "", VDC: "" };
// Đánh dấu 1 lựa chọn trong dropdown Môn là 1 NHÓM (Xã hội/Tự nhiên) thay vì
// 1 môn cụ thể — value dropdown vẫn phải là string đơn để dùng chung <select>.
const GROUP_PREFIX = "__group__:";

// Giai đoạn 5 — rút đề tự động theo ma trận môn×độ khó, gọi
// POST /api/question-bank/draw (đã tự copy + gắn sourceBankItemId, giống hệt
// chiều "+ Từ ngân hàng" của QuestionBankPicker) rồi trả kết quả qua onAdd —
// dùng chung callback với QuestionBankPicker nên nơi gọi không cần phân biệt
// 2 nguồn thêm câu.
//
// Hỗ trợ thêm CHẾ ĐỘ NHÓM MÔN (Xã hội/Tự nhiên) — thay vì rút thẳng theo 1
// subject gộp chung (dễ bốc lệch hẳn về 1 môn con), chọn 1 nhóm sẽ mở ra ma
// trận độ khó RIÊNG cho từng môn con (xem src/lib/subjectTaxonomy.ts), rồi
// gọi /draw tuần tự — mỗi lần đúng 1 subject cụ thể — và gộp kết quả lại.
// Route /draw không đổi gì cả, chỉ orchestrate nhiều lần gọi ở phía client.
export function AutoDrawModal({ open, onClose, onAdd }: {
  open: boolean;
  onClose: () => void;
  onAdd: (items: ExamQuestionInput[]) => void;
}) {
  const [allSubjects, setAllSubjects] = useState<string[]>([]);
  const [subjectSelection, setSubjectSelection] = useState("");
  const [counts, setCounts] = useState<Record<Difficulty, string>>(EMPTY_COUNTS);
  const [groupCounts, setGroupCounts] = useState<Record<string, Record<Difficulty, string>>>({});
  const [groupIncluded, setGroupIncluded] = useState<Record<string, boolean>>({});
  const [excludeRecentExams, setExcludeRecentExams] = useState("3");
  const [drawing, setDrawing] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ count: number; shortfallBySubject: Record<string, DrawResult["shortfall"]> } | null>(null);

  const isGroupMode = subjectSelection.startsWith(GROUP_PREFIX);
  const currentGroup = isGroupMode
    ? SUBJECT_GROUPS.find(g => g.group === subjectSelection.slice(GROUP_PREFIX.length))
    : undefined;

  useEffect(() => {
    if (!open) return;
    api.questionBank.list({ pageSize: 500 }).then(data => {
      setAllSubjects([...new Set(data.items.map(i => i.subject))].sort());
    }).catch(() => {});
  }, [open]);

  useEffect(() => {
    if (open) {
      setSubjectSelection(""); setCounts(EMPTY_COUNTS); setGroupCounts({}); setGroupIncluded({});
      setExcludeRecentExams("3"); setError(""); setResult(null);
    }
  }, [open]);

  function handleSubjectSelectionChange(v: string) {
    setSubjectSelection(v);
    setError(""); setResult(null);
    if (v.startsWith(GROUP_PREFIX)) {
      const group = SUBJECT_GROUPS.find(g => g.group === v.slice(GROUP_PREFIX.length));
      if (group) {
        setGroupIncluded(Object.fromEntries(group.subjects.map(s => [s, true])));
        setGroupCounts(Object.fromEntries(group.subjects.map(s => [s, { ...EMPTY_COUNTS }])));
      }
    }
  }

  const totalRequested = DIFFICULTIES.reduce((sum, d) => sum + (Number(counts[d.value]) || 0), 0);

  async function handleDraw() {
    setError("");

    if (isGroupMode) {
      if (!currentGroup) return;
      const activeSubjects = currentGroup.subjects.filter(s => groupIncluded[s] ?? true);
      if (activeSubjects.length === 0) { setError("Chọn ít nhất 1 môn con"); return; }
      const hasAnyCount = activeSubjects.some(s => DIFFICULTIES.some(d => Number(groupCounts[s]?.[d.value]) > 0));
      if (!hasAnyCount) { setError("Nhập số câu cần rút cho ít nhất 1 môn con"); return; }

      setDrawing(true); setResult(null);
      try {
        let totalCount = 0;
        const allQuestions: ExamQuestionInput[] = [];
        const shortfallBySubject: Record<string, DrawResult["shortfall"]> = {};
        for (const subj of activeSubjects) {
          const subjCounts = groupCounts[subj] ?? EMPTY_COUNTS;
          const counted: Partial<Record<Difficulty, number>> = {};
          for (const d of DIFFICULTIES) {
            const n = Number(subjCounts[d.value]);
            if (n > 0) counted[d.value] = n;
          }
          if (Object.keys(counted).length === 0) continue;
          const data = await api.questionBank.draw({
            subject: subj, counts: counted, excludeRecentExams: Number(excludeRecentExams) || 0,
          });
          allQuestions.push(...data.questions);
          totalCount += data.questions.length;
          if (Object.keys(data.shortfall).length > 0) shortfallBySubject[subj] = data.shortfall;
        }
        onAdd(allQuestions);
        setResult({ count: totalCount, shortfallBySubject });
      } catch (e) {
        setError("Rút đề thất bại: " + (e instanceof Error ? e.message : "lỗi không xác định"));
      } finally {
        setDrawing(false);
      }
      return;
    }

    if (!subjectSelection.trim()) { setError("Chọn môn học"); return; }
    if (totalRequested === 0) { setError("Nhập số câu cần rút cho ít nhất 1 độ khó"); return; }
    setDrawing(true); setResult(null);
    try {
      const counted: Partial<Record<Difficulty, number>> = {};
      for (const d of DIFFICULTIES) {
        const n = Number(counts[d.value]);
        if (n > 0) counted[d.value] = n;
      }
      const data = await api.questionBank.draw({
        subject: subjectSelection.trim(),
        counts: counted,
        excludeRecentExams: Number(excludeRecentExams) || 0,
      });
      onAdd(data.questions);
      setResult({
        count: data.questions.length,
        shortfallBySubject: Object.keys(data.shortfall).length > 0 ? { [subjectSelection]: data.shortfall } : {},
      });
    } catch (e) {
      setError("Rút đề thất bại: " + (e instanceof Error ? e.message : "lỗi không xác định"));
    } finally {
      setDrawing(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div className="bg-white rounded-xl w-full max-w-md flex flex-col overflow-hidden max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0" style={{ borderColor: "#e5e3df" }}>
          <div>
            <h2 className="text-base font-bold" style={{ color: "#1a1a1a" }}>Rút đề tự động</h2>
            <p className="text-xs text-gray-500 mt-0.5">Chọn ngẫu nhiên từ ngân hàng theo môn + số câu mỗi độ khó</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 text-xl font-light">×</button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Môn học / Nhóm môn *</label>
            <select className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:border-blue-400" style={{ borderColor: "#e5e3df" }}
              value={subjectSelection} onChange={e => handleSubjectSelectionChange(e.target.value)}>
              <option value="">Chọn môn...</option>
              {SUBJECT_GROUPS.map(g => (
                <option key={g.group} value={`${GROUP_PREFIX}${g.group}`}>🗂 Nhóm: {g.group} ({g.subjects.join("/")})</option>
              ))}
              {allSubjects.length > 0 && (
                <optgroup label="Môn cụ thể (đã có trong ngân hàng)">
                  {allSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                </optgroup>
              )}
            </select>
            {isGroupMode && (
              <p className="text-xs text-gray-400 mt-1">Rút riêng từng môn con — bỏ tích môn nào để loại khỏi lần rút này.</p>
            )}
          </div>

          {isGroupMode && currentGroup ? (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-600">Số câu mỗi môn con × độ khó</label>
              {currentGroup.subjects.map(subj => (
                <div key={subj} className="p-2 rounded-lg border" style={{ borderColor: "#e5e3df" }}>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-1.5">
                    <input type="checkbox" checked={groupIncluded[subj] ?? true}
                      onChange={e => setGroupIncluded(prev => ({ ...prev, [subj]: e.target.checked }))} />
                    {subj}
                  </label>
                  {(groupIncluded[subj] ?? true) && (
                    <div className="grid grid-cols-4 gap-2">
                      {DIFFICULTIES.map(d => (
                        <div key={d.value}>
                          <input type="number" min={0}
                            className="w-full px-2 py-1.5 text-sm text-center border rounded-lg outline-none focus:border-blue-400"
                            style={{ borderColor: "#e5e3df" }}
                            placeholder="0"
                            value={groupCounts[subj]?.[d.value] ?? ""}
                            onChange={e => setGroupCounts(prev => ({
                              ...prev,
                              [subj]: { ...(prev[subj] ?? EMPTY_COUNTS), [d.value]: e.target.value },
                            }))} />
                          <p className="text-[10px] text-gray-400 text-center mt-1">{d.label}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
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
          )}

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
              {Object.entries(result.shortfallBySubject).map(([subj, sf]) => (
                <div key={subj} className="mt-1">
                  <p className="font-semibold">{subj}:</p>
                  <ul className="space-y-0.5">
                    {Object.entries(sf).map(([d, s]) => (
                      <li key={d}>Thiếu {d}: chỉ rút được {s!.drawn}/{s!.requested} câu (ngân hàng không đủ)</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t flex-shrink-0" style={{ borderColor: "#e5e3df" }}>
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
