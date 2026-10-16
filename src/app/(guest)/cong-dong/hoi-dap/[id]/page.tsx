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
      <div className="w-full max-w-sm rounded-2xl p-5" style={{ background: "var(--kin-nen-trang)" }} onClick={e => e.stopPropagation()}>
        <p className="text-sm font-bold mb-3" style={{ color: "var(--kin-chu-chinh)" }}>Báo cáo câu trả lời</p>
        <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Lý do báo cáo (sai, spam, gian lận...)"
          rows={3} className="w-full p-3 rounded-lg text-sm resize-none outline-none"
          style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-chu-chinh)" }} />
        <div className="flex gap-2 mt-3">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-xs font-bold"
            style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-chu-mo)" }}>Hủy</button>
          <button onClick={() => reason.trim() && onSubmit(reason.trim())} className="flex-1 py-2 rounded-lg text-xs font-bold text-[var(--kin-chu-tren-nut-chinh)]"
            style={{ background: "var(--kin-tt-chu-loi)" }}>Gửi báo cáo</button>
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
    // Chưa đăng nhập (hoặc phiên hết hạn) → API trả 401 {error}; câu hỏi không có → 404 {error}. Trước đây cả hai được nhét thẳng vào `question`
    // rồi đọc question.author.name → TypeError, trang sập, nút "Thử lại" của khung báo lỗi không làm gì. Nay: 401 sang đăng nhập rồi quay lại ĐÚNG câu hỏi này,
    // lỗi khác thì hiện "Không tìm thấy câu hỏi".
    let toLogin = false;
    fetch(`/api/questions/${id}`)
      .then(r => {
        if (r.status === 401) { toLogin = true; router.replace(`/dang-nhap?redirect=${encodeURIComponent(`/cong-dong/hoi-dap/${id}`)}`); return null; }
        return r.ok ? (r.json() as Promise<QuestionDetailDTO>) : null;
      })
      .then(setQuestion)
      .catch(() => {})
      .finally(() => { if (!toLogin) setLoading(false); });   // đang chuyển trang thì giữ khung chờ, không nháy "Không tìm thấy"
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

  if (loading) return <div className="h-64 rounded-xl animate-pulse" style={{ background: "var(--kin-nen-bang)" }} />;
  if (!question) return <p className="text-sm" style={{ color: "var(--kin-chu-mo)" }}>Không tìm thấy câu hỏi</p>;

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-sm font-semibold text-[var(--kin-chu-tren-nut-chinh)] shadow-lg" style={{ background: "var(--kin-chu-chinh)" }}>
          {toast}
        </div>
      )}
      {reportTarget && <ReportModal onClose={() => setReportTarget(null)} onSubmit={submitReport} />}

      <button onClick={() => router.push("/cong-dong?tab=hoi-dap-qa")}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold"
        style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-nhan-link)", borderRadius: "8px" }}>
        ← Hỏi đáp
      </button>

      {/* Question */}
      <div className="rounded-xl p-5" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: question.status === "answered" ? "var(--kin-tt-nen-xong)" : "var(--kin-nhan-nen-nhat)", color: question.status === "answered" ? "var(--kin-tt-chu-xong)" : "var(--kin-nhan-link)" }}>
            {question.status === "answered" ? "✓ Đã giải" : "Chưa giải"}
          </span>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "var(--kin-tt-nen-cho)", color: "var(--kin-tt-chu-cho)" }}>
            🪙 {question.bountyPaid}
          </span>
          <span className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>{question.author.name} · {timeAgo(question.createdAt)}</span>
        </div>
        <h1 className="text-lg font-extrabold leading-snug" style={{ color: "var(--kin-chu-chinh)" }}>{question.title}</h1>
        <p className="text-sm mt-2 leading-relaxed whitespace-pre-wrap" style={{ color: "var(--kin-chu-phu)" }}>{question.content}</p>
      </div>

      {/* Answers */}
      <div>
        <p className="text-sm font-bold mb-3" style={{ color: "var(--kin-chu-chinh)" }}>{question.answers.length} câu trả lời</p>
        <div className="space-y-3">
          {question.answers.map(a => (
            <div key={a.id} className="rounded-xl p-4"
              style={{
                background: a.isAccepted ? "var(--kin-tt-nen-xong)" : "var(--kin-nen-trang)",
                border: a.isAccepted ? "1px solid var(--kin-tt-vien-xong)" : "1px solid var(--kin-vien-thuong)",
                opacity: a.isPenalized ? 0.6 : 1,
              }}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-bold" style={{ color: "var(--kin-chu-chinh)" }}>{a.author.name}</span>
                <span className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>{timeAgo(a.createdAt)}</span>
                {a.isAccepted && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "var(--kin-tt-nen-xong)", color: "var(--kin-tt-chu-xong)" }}>
                    ✓ Được chấp nhận · +{ANSWER_REWARD} 🪙
                  </span>
                )}
                {a.isPenalized && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "var(--kin-tt-nen-loi)", color: "var(--kin-tt-chu-loi)" }}>
                    ⚠ Vi phạm
                  </span>
                )}
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--kin-chu-phu)" }}>{a.content}</p>

              <div className="flex gap-2 mt-2">
                {question.isOwn && question.status === "open" && !a.isPenalized && (
                  <button onClick={() => acceptAnswer(a.id)}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg text-white" style={{ background: "var(--kin-nhan-nen)" }}>
                    ✓ Chấp nhận câu trả lời này
                  </button>
                )}
                {!a.isOwn && !a.reportedByMe && !a.isPenalized && (
                  <button onClick={() => setReportTarget(a.id)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: "var(--kin-nen-bang)", color: "var(--kin-chu-mo)" }}>
                    🚩 Báo cáo
                  </button>
                )}
                {a.reportedByMe && <span className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>Đã báo cáo</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Answer form */}
      <div className="rounded-xl p-4" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
        <textarea value={answerText} onChange={e => setAnswerText(e.target.value)} placeholder="Viết câu trả lời của bạn..."
          rows={3} className="w-full p-3 rounded-lg text-sm resize-none outline-none"
          style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-chu-chinh)" }} />
        {error && <p className="text-xs font-semibold mt-1" style={{ color: "var(--kin-tt-chu-loi)" }}>{error}</p>}
        <div className="flex justify-end mt-2">
          <button onClick={submitAnswer} disabled={posting || !answerText.trim()}
            className="px-4 py-2 rounded-lg text-xs font-bold text-white"
            style={{ background: "var(--kin-nhan-nen)", opacity: posting || !answerText.trim() ? 0.5 : 1 }}>
            {posting ? "Đang đăng..." : "Đăng trả lời"}
          </button>
        </div>
      </div>
    </div>
  );
}
