"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { ANSWER_REWARD } from "@/lib/wallet-constants";

interface AnswerDTO {
  id: string;
  content: string;
  isAccepted: boolean;
  isPenalized: boolean;
  createdAt: string;
  author: { id: string; name: string };
  isOwn: boolean;
  reportedByMe: boolean;
}

interface QuestionDetailDTO {
  id: string;
  title: string;
  content: string;
  bountyPaid: number;
  status: string;
  createdAt: string;
  author: { id: string; name: string };
  isOwn: boolean;
  acceptedAnswerId: string | null;
  answers: AnswerDTO[];
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return "vừa xong";
  if (mins < 60)  return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 7)   return `${days} ngày trước`;
  return new Date(iso).toLocaleDateString("vi-VN");
}

function ReportModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl p-5" style={{ background: "#ffffff" }} onClick={e => e.stopPropagation()}>
        <p className="text-sm font-bold mb-3" style={{ color: "#1E2938" }}>Báo cáo câu trả lời</p>
        <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Lý do báo cáo (sai, spam, gian lận...)"
          rows={3} className="w-full p-3 rounded-lg text-sm resize-none outline-none"
          style={{ background: "#f6f5f4", border: "1px solid #e5e3df", color: "#1E2938" }} />
        <div className="flex gap-2 mt-3">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-xs font-bold"
            style={{ background: "#f6f5f4", border: "1px solid #e5e3df", color: "#6B7280" }}>Hủy</button>
          <button onClick={() => reason.trim() && onSubmit(reason.trim())} className="flex-1 py-2 rounded-lg text-xs font-bold text-white"
            style={{ background: "#FF2157" }}>Gửi báo cáo</button>
        </div>
      </div>
    </div>
  );
}

export default function QuestionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [question, setQuestion] = useState<QuestionDetailDTO | null>(null);
  const [loading, setLoading]   = useState(true);
  const [answerText, setAnswerText] = useState("");
  const [posting, setPosting]       = useState(false);
  const [error, setError]           = useState("");
  const [reportTarget, setReportTarget] = useState<string | null>(null);
  const [toast, setToast]               = useState("");

  function load() {
    fetch(`/api/questions/${id}`)
      .then(r => r.json())
      .then(setQuestion)
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(load, [id]);

  async function submitAnswer() {
    if (!answerText.trim()) return;
    setPosting(true);
    setError("");
    try {
      const res = await fetch(`/api/questions/${id}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: answerText }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Đăng trả lời thất bại"); return; }
      setAnswerText("");
      load();
    } catch {
      setError("Lỗi kết nối, vui lòng thử lại");
    } finally {
      setPosting(false);
    }
  }

  async function acceptAnswer(answerId: string) {
    const res = await fetch(`/api/answers/${answerId}/accept`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) { setToast(data.error ?? "Không thể chấp nhận câu trả lời"); setTimeout(() => setToast(""), 3000); return; }
    load();
  }

  async function submitReport(reason: string) {
    if (!reportTarget) return;
    const res = await fetch(`/api/answers/${reportTarget}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const data = await res.json();
    setReportTarget(null);
    setToast(res.ok ? "Đã gửi báo cáo, admin sẽ xem xét" : (data.error ?? "Báo cáo thất bại"));
    setTimeout(() => setToast(""), 3000);
    if (res.ok) load();
  }

  if (loading) return <div className="h-64 rounded-xl animate-pulse" style={{ background: "#f6f5f4" }} />;
  if (!question) return <p className="text-sm" style={{ color: "#9CA3AF" }}>Không tìm thấy câu hỏi</p>;

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-sm font-semibold text-white shadow-lg" style={{ background: "#1E2938" }}>
          {toast}
        </div>
      )}
      {reportTarget && <ReportModal onClose={() => setReportTarget(null)} onSubmit={submitReport} />}

      <button onClick={() => router.push("/student/hoi-dap")}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold"
        style={{ background: "#f6f5f4", border: "1px solid #e5e3df", color: "#0068FF", borderRadius: "8px" }}>
        ← Hỏi đáp
      </button>

      {/* Question */}
      <div className="rounded-xl p-5" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: question.status === "answered" ? "#d1fae5" : "#DBEAFE", color: question.status === "answered" ? "#00A63D" : "#0068FF" }}>
            {question.status === "answered" ? "✓ Đã giải" : "Chưa giải"}
          </span>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#FFFBEB", color: "#92400E" }}>
            🪙 {question.bountyPaid}
          </span>
          <span className="text-xs" style={{ color: "#9CA3AF" }}>{question.author.name} · {timeAgo(question.createdAt)}</span>
        </div>
        <h1 className="text-lg font-extrabold leading-snug" style={{ color: "#1E2938" }}>{question.title}</h1>
        <p className="text-sm mt-2 leading-relaxed whitespace-pre-wrap" style={{ color: "#374151" }}>{question.content}</p>
      </div>

      {/* Answers */}
      <div>
        <p className="text-sm font-bold mb-3" style={{ color: "#1E2938" }}>{question.answers.length} câu trả lời</p>
        <div className="space-y-3">
          {question.answers.map(a => (
            <div key={a.id} className="rounded-xl p-4"
              style={{
                background: a.isAccepted ? "#F0FDF4" : "#ffffff",
                border: a.isAccepted ? "1px solid #BBF7D0" : "1px solid #e5e3df",
                opacity: a.isPenalized ? 0.6 : 1,
              }}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-bold" style={{ color: "#1E2938" }}>{a.author.name}</span>
                <span className="text-xs" style={{ color: "#9CA3AF" }}>{timeAgo(a.createdAt)}</span>
                {a.isAccepted && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#d1fae5", color: "#00A63D" }}>
                    ✓ Được chấp nhận · +{ANSWER_REWARD} 🪙
                  </span>
                )}
                {a.isPenalized && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#FEE2E2", color: "#DC2626" }}>
                    ⚠ Vi phạm
                  </span>
                )}
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#374151" }}>{a.content}</p>

              <div className="flex gap-2 mt-2">
                {question.isOwn && question.status === "open" && !a.isPenalized && (
                  <button onClick={() => acceptAnswer(a.id)}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg text-white" style={{ background: "#00A63D" }}>
                    ✓ Chấp nhận câu trả lời này
                  </button>
                )}
                {!a.isOwn && !a.reportedByMe && !a.isPenalized && (
                  <button onClick={() => setReportTarget(a.id)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: "#f6f5f4", color: "#9CA3AF" }}>
                    🚩 Báo cáo
                  </button>
                )}
                {a.reportedByMe && <span className="text-xs" style={{ color: "#9CA3AF" }}>Đã báo cáo</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Answer form */}
      <div className="rounded-xl p-4" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
        <textarea value={answerText} onChange={e => setAnswerText(e.target.value)} placeholder="Viết câu trả lời của bạn..."
          rows={3} className="w-full p-3 rounded-lg text-sm resize-none outline-none"
          style={{ background: "#f6f5f4", border: "1px solid #e5e3df", color: "#1E2938" }} />
        {error && <p className="text-xs font-semibold mt-1" style={{ color: "#FF2157" }}>{error}</p>}
        <div className="flex justify-end mt-2">
          <button onClick={submitAnswer} disabled={posting || !answerText.trim()}
            className="px-4 py-2 rounded-lg text-xs font-bold text-white"
            style={{ background: "#0068FF", opacity: posting || !answerText.trim() ? 0.5 : 1 }}>
            {posting ? "Đang đăng..." : "Đăng trả lời"}
          </button>
        </div>
      </div>
    </div>
  );
}
