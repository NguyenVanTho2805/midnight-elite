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
        style={{ background: "var(--kin-nen-trang)" }} onClick={e => e.stopPropagation()}>
        <p className="text-sm font-bold mb-3" style={{ color: "var(--kin-chu-chinh)" }}>Báo cáo câu trả lời</p>
        <textarea value={reason} onChange={e => setReason(e.target.value)}
          placeholder="Lý do báo cáo (sai, spam, gian lận...)"
          rows={3} className="w-full p-3 rounded-lg text-sm resize-none outline-none"
          style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-chu-chinh)" }} />
        <div className="flex gap-2 mt-3">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-xs font-bold"
            style={{ background: "var(--kin-nen-bang)", color: "var(--kin-chu-mo)" }}>Hủy</button>
          <button onClick={() => reason.trim() && onSubmit(reason.trim())}
            className="flex-1 py-2 rounded-lg text-xs font-bold text-white"
            style={{ background: "var(--kin-tt-chu-loi)" }}>Gửi báo cáo</button>
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
  const [mounted, setMounted]           = useState(false);
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

  useEffect(() => { setMounted(true); }, []);

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

  if (!questionId || !mounted) return null;
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
          style={{ background: "var(--kin-chu-chinh)" }}>{toast}</div>
      )}

      {/* Backdrop */}
      <div
        className="fixed top-0 left-0 z-[9999] flex items-end sm:items-center justify-center"
        style={{
          width: "100vw",
          height: "100vh",
          background: "rgba(15,15,15,0.6)",
          animation: "backdropIn 0.18s ease-out",
        }}
        onClick={onClose}
      >
        {/* Panel */}
        <div
          className="relative w-full sm:max-w-2xl sm:mx-4 flex flex-col overflow-hidden rounded-t-[20px] sm:rounded-[20px]"
          style={{
            background: "var(--kin-nen-trang)",
            maxHeight: "92dvh",
            animation: "modalSlideUp 0.22s cubic-bezier(0.16,1,0.3,1)",
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Drag handle (mobile) */}
          <div className="flex justify-center pt-2.5 pb-1 flex-shrink-0 sm:hidden">
            <div className="w-10 h-1 rounded-full" style={{ background: "var(--kin-vien-thuong)" }} />
          </div>

          {/* Header */}
          <div className="flex-shrink-0 flex items-center justify-between px-5 py-3"
            style={{ borderBottom: "1px solid var(--kin-vien-thuong)" }}>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold" style={{ color: "var(--kin-chu-phu)" }}>Câu hỏi</span>
              {question && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    background: answered ? "var(--kin-tt-nen-xong)" : "var(--kin-tt-nen-cho)",
                    color:      answered ? "var(--kin-tt-chu-xong)" : "var(--kin-tt-chu-cho)",
                  }}>
                  {answered ? "✓ Đã giải" : "Đang mở"}
                </span>
              )}
              {question && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "var(--kin-tt-nen-cho)", color: "var(--kin-tt-chu-cho)" }}>
                  🪙 {question.bountyPaid}
                </span>
              )}
            </div>
            <button onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all hover:bg-gray-100"
              style={{ color: "var(--kin-chu-mo)" }}>✕</button>
          </div>

          {/* Scrollable body */}
          <div ref={bodyRef} className="flex-1 overflow-y-auto overscroll-contain">

            {/* Loading skeleton */}
            {loading && (
              <div className="p-5 space-y-3">
                {[90, 75, 60, 85, 50].map((w, i) => (
                  <div key={i} className="h-4 rounded-lg animate-pulse"
                    style={{ background: "var(--kin-vien-thuong)", width: `${w}%` }} />
                ))}
              </div>
            )}

            {/* Error */}
            {fetchError && (
              <div className="p-8 text-center">
                <p className="text-2xl mb-3">⚠️</p>
                <p className="font-semibold mb-1" style={{ color: "var(--kin-chu-chinh)" }}>Không thể tải câu hỏi</p>
                <button onClick={() => questionId && fetchQuestion(questionId)}
                  className="mt-3 px-4 py-2 rounded-lg text-sm font-semibold text-white"
                  style={{ background: "var(--kin-nhan-nen)" }}>Thử lại</button>
              </div>
            )}

            {/* Content */}
            {!loading && !fetchError && question && (
              <div className="p-5 space-y-4">

                {/* Question */}
                <div className="rounded-xl p-4"
                  style={{ background: "var(--kin-tt-nen-cho)", border: "1px solid var(--kin-tt-vien-cho)" }}>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-xs font-semibold" style={{ color: "var(--kin-chu-mo)" }}>
                      {question.author.name} · {timeAgo(question.createdAt)}
                    </span>
                  </div>
                  <h2 className="text-base font-extrabold leading-snug mb-2" style={{ color: "var(--kin-chu-chinh)" }}>
                    {question.title}
                  </h2>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--kin-chu-phu)" }}>
                    {question.content}
                  </p>
                </div>

                {/* Answers header */}
                <p className="text-sm font-bold" style={{ color: "var(--kin-chu-chinh)" }}>
                  {question.answers.length} câu trả lời
                </p>

                {/* Answer list */}
                <div className="space-y-3">
                  {question.answers.map(a => (
                    <div key={a.id} className="rounded-xl p-4"
                      style={{
                        background: a.isAccepted ? "var(--kin-tt-nen-xong)" : "var(--kin-nen-trang)",
                        border: a.isAccepted ? "1px solid var(--kin-tt-vien-xong)" : "1px solid var(--kin-vien-thuong)",
                        opacity: a.isPenalized ? 0.55 : 1,
                      }}>
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-xs font-semibold" style={{ color: "var(--kin-chu-chinh)" }}>{a.author.name}</span>
                        <span className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>{timeAgo(a.createdAt)}</span>
                        {a.isAccepted && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{ background: "var(--kin-tt-nen-xong)", color: "var(--kin-tt-chu-xong)" }}>
                            ✓ Được chấp nhận · +{ANSWER_REWARD} 🪙
                          </span>
                        )}
                        {a.isPenalized && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{ background: "var(--kin-tt-nen-loi)", color: "var(--kin-tt-chu-loi)" }}>⚠ Vi phạm</span>
                        )}
                      </div>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--kin-chu-phu)" }}>
                        {a.content}
                      </p>
                      <div className="flex gap-2 mt-2.5 flex-wrap">
                        {question.isOwn && question.status === "open" && !a.isPenalized && (
                          <button onClick={() => acceptAnswer(a.id)}
                            className="text-xs font-bold px-3 py-1.5 rounded-lg text-white"
                            style={{ background: "var(--kin-nhan-nen)" }}>
                            ✓ Chấp nhận câu trả lời này
                          </button>
                        )}
                        {!a.isOwn && !a.reportedByMe && !a.isPenalized && (
                          <button onClick={() => setReportTarget(a.id)}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                            style={{ background: "var(--kin-nen-bang)", color: "var(--kin-chu-mo)" }}>
                            🚩 Báo cáo
                          </button>
                        )}
                        {a.reportedByMe && (
                          <span className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>Đã báo cáo</span>
                        )}
                      </div>
                    </div>
                  ))}

                  {question.answers.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-2xl mb-2">💬</p>
                      <p className="text-sm" style={{ color: "var(--kin-chu-mo)" }}>Chưa có câu trả lời nào. Hãy là người đầu tiên!</p>
                    </div>
                  )}
                </div>

                {/* Answer form */}
                <div className="rounded-xl p-4" style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)" }}>
                  <p className="text-xs font-semibold mb-2" style={{ color: "var(--kin-chu-phu)" }}>
                    Câu trả lời hay nhất sẽ nhận <span style={{ color: "var(--kin-tt-chu-cho)" }}>+{ANSWER_REWARD} 🪙</span>
                  </p>
                  <textarea
                    value={answerText}
                    onChange={e => { setAnswerText(e.target.value); setPostError(""); }}
                    placeholder="Viết câu trả lời của bạn..."
                    rows={3}
                    className="w-full p-3 rounded-lg text-sm resize-none outline-none"
                    style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-chu-chinh)" }}
                  />
                  {postError && <p className="text-xs mt-1 font-semibold" style={{ color: "var(--kin-tt-chu-loi)" }}>{postError}</p>}
                  <div className="flex justify-end mt-2">
                    <button onClick={submitAnswer} disabled={posting || !answerText.trim()}
                      className="px-4 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-50"
                      style={{ background: "var(--kin-nhan-nen)" }}>
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
