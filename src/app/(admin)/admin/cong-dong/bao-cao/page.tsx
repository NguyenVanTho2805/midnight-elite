"use client";

import { useState, useEffect } from "react";

interface ReportDTO {
  id: string;
  reason: string;
  createdAt: string;
  reporter: { id: string; name: string };
  answer: {
    id: string;
    content: string;
    rewardPaid: number | null;
    author: { id: string; name: string };
    question: { id: string; title: string };
  };
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return "vừa xong";
  if (mins < 60)  return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return new Date(iso).toLocaleDateString("vi-VN");
}

export default function BaoCaoTraLoiPage() {
  const [reports, setReports] = useState<ReportDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId]   = useState<string | null>(null);

  function load() {
    fetch("/api/admin/answer-reports")
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setReports)
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function resolve(id: string, decision: "approved" | "rejected") {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/answer-reports/${id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert("Lỗi: " + ((err as { error?: string }).error ?? `HTTP ${res.status}`));
        return;
      }
      setReports(prev => prev.filter(r => r.id !== id));
    } catch {
      alert("Lỗi kết nối, vui lòng thử lại.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Báo cáo trả lời Hỏi đáp</h1>
        <p className="text-sm text-gray-500 mt-1">Duyệt report sai/spam — nếu xác nhận vi phạm, hệ thống tự trừ xu thưởng (nếu đã nhận)</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="h-32 rounded-xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center">
          <p className="text-sm text-gray-400">Không có report nào đang chờ duyệt</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map(r => (
            <div key={r.id} className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-400">
                  Báo cáo bởi <span className="font-semibold text-gray-600">{r.reporter.name}</span> · {timeAgo(r.createdAt)}
                </p>
                {r.answer.rewardPaid != null && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                    Đã nhận {r.answer.rewardPaid} 🪙
                  </span>
                )}
              </div>

              <p className="text-xs text-gray-400 mb-1">Câu hỏi: <span className="text-gray-700 font-medium">{r.answer.question.title}</span></p>

              <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 my-2">
                <p className="text-xs font-semibold text-gray-600 mb-1">{r.answer.author.name} trả lời:</p>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{r.answer.content}</p>
              </div>

              <div className="rounded-lg bg-red-50 border border-red-100 p-3 mb-3">
                <p className="text-xs font-semibold text-red-700 mb-1">Lý do báo cáo:</p>
                <p className="text-sm text-red-800">{r.reason}</p>
              </div>

              <div className="flex gap-2">
                <button onClick={() => resolve(r.id, "approved")} disabled={busyId === r.id}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-red-600 disabled:opacity-50">
                  Xác nhận vi phạm {r.answer.rewardPaid != null ? "(trừ xu)" : ""}
                </button>
                <button onClick={() => resolve(r.id, "rejected")} disabled={busyId === r.id}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-gray-600 bg-gray-100 disabled:opacity-50">
                  Bỏ qua report
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
