"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { ANSWER_REWARD } from "@/lib/wallet-constants";

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface AnswerDTO {
  id:           string;
  content:      string;
  isAccepted:   boolean;
  isPenalized:  boolean;
  createdAt:    string;
  author:       { id: string; name: string };
  isOwn:        boolean;
  reportedByMe: boolean;
}

interface QuestionDetail {
  id:               string;
  title:            string;
  content:          string;
  bountyPaid:       number;
  status:           string;
  createdAt:        string;
  author:           { id: string; name: string };
  isOwn:            boolean;
  acceptedAnswerId: string | null;
  answers:          AnswerDTO[];
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return "vừa xong";
  if (mins < 60)  return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days  = Math.floor(hours / 24);
  if (days < 7)   return `${days} ngày trước`;
  return new Date(iso).toLocaleDateString("vi-VN");
}

// ─── REPORT SUB-MODAL ─────────────────────────────────────────────────────────

function ReportModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (r: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl p-5"
        style={{ background: "#ffffff" }} onClick={e => e.stopPropagation()}>
        <p className="text-sm font-bold mb-3" style={{ color: "#1a1a1a" }}>Báo cáo câu trả lời</p>
        <textarea value={reason} onChange={e => setReason(e.target.value)}
          placeholder="Lý do báo cáo (sai, spam, gian lận...)"
          rows={3} className="w-full p-3 rounded-lg text-sm resize-none outline-none"
          style={{ background: "#f6f5f4", border: "1px solid #e5e3df", color: "#1a1a1a" }} />
        <div className="flex gap-2 mt-3">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-xs font-bold"
            style={{ background: "#f6f5f4", color: "#787671" }}>Hủy</button>
          <button onClick={() => reason.trim() && onSubmit(reason.trim())}
            className="flex-1 py-2 rounded-lg text-xs font-bold text-white"
            style={{ background: "#dc2626" }}>Gửi báo cáo</button>
        </div>
      </div>
    </div>
  );
}

// ─── MODAL ────────────────────────────────────────────────────────────────────

export default function QuestionModal({
  questionId,
  onClose,
}: {
  questionId: string | null;
  onClose:    () => void;
}) {
  const [question, setQuestion]         = useState<QuestionDetail | null>(null);
  const [loading, setLoading]           = useState(false);
  const [fetchError, setFetchError]     = useState(false);
  const [answerText, setAnswerText]     = useState("");
  const [posting, setPosting]           = useState(false);
  const [postError, setPostError]       = useState("");
  const [reportTarget, setReportTarget] = useState<string | null>(null);
  const [toast, setToast]               = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);

  const fetchQuestion = useCallback((id: string) => {
    setLoading(true);
    setFetchError(false);
    fetch(`/api/questions/${id}`, { credentials: "same-origin" })
      .then(async r => {
        if (!r.ok) throw new Error();
        setQuestion(await r.json());
      })
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!questionId) { setQuestion(null); setFetchError(false); return; }
    fetchQuestion(questionId);
  }, [questionId, fetchQuestion]);

  // ESC + body scroll lock
  useEffect(() => {
    if (!questionId) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [questionId, onClose]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  async function submitAnswer() {
    if (!question || !answerText.trim()) return;
    setPosting(true); setPostError("");
    try {
      const res  = await fetch(`/api/questions/${question.id}/answers`, {
        method:  "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ content: answerText }),
      });
      const data = await res.json();
      if (!res.ok) { setPostError(data.error ?? "Đăng trả lời thất bại"); return; }
      setAnswerText("");
      fetchQuestion(question.id);
      setTimeout(() => bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" }), 200);
    } catch { setPostError("Lỗi kết nối, vui lòng thử lại"); }
    finally { setPosting(false); }
  }

  async function acceptAnswer(answerId: string) {
    if (!question) return;
    const res  = await fetch(`/api/answers/${answerId}/accept`, { method: "POST", credentials: "same-origin" });
    const data = await res.json();
    if (!res.ok) { showToast(data.error ?? "Không thể chấp nhận câu trả lời"); return; }
    fetchQuestion(question.id);
  }

  async function submitReport(reason: string) {
    if (!reportTarget) return;
    const res  = await fetch(`/api/answers/${reportTarget}/report`, {
      method:  "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ reason }),
    });
    const data = await res.json();
    setReportTarget(null);
    showToast(res.ok ? "Đã gửi báo cáo, admin sẽ xem xét" : (data.error ?? "Báo cáo thất bại"));
    if (res.ok && question) fetchQuestion(question.id);
  }

  if (!questionId) return null;
  const answered = question?.status === "answered";

  return createPortal(
    <>
      <style>{`
        @keyframes modalSlideUp {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes backdropIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>

      {reportTarget && <ReportModal onClose={() => setReportTarget(null)} onSubmit={submitReport} />}

      {/* Toast */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[70] px-5 py-3 rounded-xl text-sm font-semibold text-white shadow-lg"
          style={{ background: "#1a1a1a" }}>{toast}</div>
      )}

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
        style={{
          background: "rgba(15,15,15,0.55)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          animation: "backdropIn 0.18s ease-out",
        }}
        onClick={onClose}
      >
        {/* Panel */}
        <div
          className="relative w-full sm:max-w-2xl sm:mx-4 flex flex-col overflow-hidden rounded-t-[20px] sm:rounded-[20px]"
          style={{
            background: "#ffffff",
            maxHeight: "92dvh",
            animation: "modalSlideUp 0.22s cubic-bezier(0.16,1,0.3,1)",
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Drag handle (mobile) */}
          <div className="flex justify-center pt-2.5 pb-1 flex-shrink-0 sm:hidden">
            <div className="w-10 h-1 rounded-full" style={{ background: "#e5e3df" }} />
          </div>

          {/* Header */}
          <div className="flex-shrink-0 flex items-center justify-between px-5 py-3"
            style={{ borderBottom: "1px solid #e5e3df" }}>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold" style={{ color: "#37352f" }}>Câu hỏi</span>
              {question && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    background: answered ? "#dcfce7" : "#fffbeb",
                    color:      answered ? "#15803d" : "#92400e",
                  }}>
                  {answered ? "✓ Đã giải" : "Đang mở"}
                </span>
              )}
              {question && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "#fffbeb", color: "#b45309" }}>
                  🪙 {question.bountyPaid}
                </span>
              )}
            </div>
            <button onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all hover:bg-gray-100"
              style={{ color: "#787671" }}>✕</button>
          </div>

          {/* Scrollable body */}
          <div ref={bodyRef} className="flex-1 overflow-y-auto overscroll-contain">

            {/* Loading skeleton */}
            {loading && (
              <div className="p-5 space-y-3">
                {[90, 75, 60, 85, 50].map((w, i) => (
                  <div key={i} className="h-4 rounded-lg animate-pulse"
                    style={{ background: "#e5e3df", width: `${w}%` }} />
                ))}
              </div>
            )}

            {/* Error */}
            {fetchError && (
              <div className="p-8 text-center">
                <p className="text-2xl mb-3">⚠️</p>
                <p className="font-semibold mb-1" style={{ color: "#1a1a1a" }}>Không thể tải câu hỏi</p>
                <button onClick={() => questionId && fetchQuestion(questionId)}
                  className="mt-3 px-4 py-2 rounded-lg text-sm font-semibold text-white"
                  style={{ background: "#0068FF" }}>Thử lại</button>
              </div>
            )}

            {/* Content */}
            {!loading && !fetchError && question && (
              <div className="p-5 space-y-4">

                {/* Question */}
                <div className="rounded-xl p-4"
                  style={{ background: "#fffbeb", border: "1px solid #fde68a" }}>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-xs font-semibold" style={{ color: "#a4a097" }}>
                      {question.author.name} · {timeAgo(question.createdAt)}
                    </span>
                  </div>
                  <h2 className="text-base font-extrabold leading-snug mb-2" style={{ color: "#1a1a1a" }}>
                    {question.title}
                  </h2>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#37352f" }}>
                    {question.content}
                  </p>
                </div>

                {/* Answers header */}
                <p className="text-sm font-bold" style={{ color: "#1a1a1a" }}>
                  {question.answers.length} câu trả lời
                </p>

                {/* Answer list */}
                <div className="space-y-3">
                  {question.answers.map(a => (
                    <div key={a.id} className="rounded-xl p-4"
                      style={{
                        background: a.isAccepted ? "#f0fdf4" : "#ffffff",
                        border: a.isAccepted ? "1px solid #bbf7d0" : "1px solid #e5e3df",
                        opacity: a.isPenalized ? 0.55 : 1,
                      }}>
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-xs font-semibold" style={{ color: "#1a1a1a" }}>{a.author.name}</span>
                        <span className="text-xs" style={{ color: "#a4a097" }}>{timeAgo(a.createdAt)}</span>
                        {a.isAccepted && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{ background: "#dcfce7", color: "#15803d" }}>
                            ✓ Được chấp nhận · +{ANSWER_REWARD} 🪙
                          </span>
                        )}
                        {a.isPenalized && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{ background: "#fee2e2", color: "#dc2626" }}>⚠ Vi phạm</span>
                        )}
                      </div>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#37352f" }}>
                        {a.content}
                      </p>
                      <div className="flex gap-2 mt-2.5 flex-wrap">
                        {question.isOwn && question.status === "open" && !a.isPenalized && (
                          <button onClick={() => acceptAnswer(a.id)}
                            className="text-xs font-bold px-3 py-1.5 rounded-lg text-white"
                            style={{ background: "#15803d" }}>
                            ✓ Chấp nhận câu trả lời này
                          </button>
                        )}
                        {!a.isOwn && !a.reportedByMe && !a.isPenalized && (
                          <button onClick={() => setReportTarget(a.id)}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                            style={{ background: "#f6f5f4", color: "#a4a097" }}>
                            🚩 Báo cáo
                          </button>
                        )}
                        {a.reportedByMe && (
                          <span className="text-xs" style={{ color: "#a4a097" }}>Đã báo cáo</span>
                        )}
                      </div>
                    </div>
                  ))}

                  {question.answers.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-2xl mb-2">💬</p>
                      <p className="text-sm" style={{ color: "#787671" }}>Chưa có câu trả lời nào. Hãy là người đầu tiên!</p>
                    </div>
                  )}
                </div>

                {/* Answer form */}
                <div className="rounded-xl p-4" style={{ background: "#f9f9f8", border: "1px solid #e5e3df" }}>
                  <p className="text-xs font-semibold mb-2" style={{ color: "#37352f" }}>
                    Câu trả lời hay nhất sẽ nhận <span style={{ color: "#b45309" }}>+{ANSWER_REWARD} 🪙</span>
                  </p>
                  <textarea
                    value={answerText}
                    onChange={e => { setAnswerText(e.target.value); setPostError(""); }}
                    placeholder="Viết câu trả lời của bạn..."
                    rows={3}
                    className="w-full p-3 rounded-lg text-sm resize-none outline-none"
                    style={{ background: "#ffffff", border: "1px solid #e5e3df", color: "#1a1a1a" }}
                  />
                  {postError && <p className="text-xs mt-1 font-semibold" style={{ color: "#dc2626" }}>{postError}</p>}
                  <div className="flex justify-end mt-2">
                    <button onClick={submitAnswer} disabled={posting || !answerText.trim()}
                      className="px-4 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-50"
                      style={{ background: "#0068FF" }}>
                      {posting ? "Đang đăng..." : "Đăng trả lời"}
                    </button>
                  </div>
                </div>

                {/* Bottom padding */}
                <div className="h-2" />
              </div>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
