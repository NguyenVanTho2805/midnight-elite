"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useWallet } from "@/hooks/useWallet";
import { QUESTION_COST } from "@/lib/wallet-constants";

interface QuestionDTO {
  id: string;
  title: string;
  content: string;
  bountyPaid: number;
  status: string;
  createdAt: string;
  author: { id: string; name: string };
  answerCount: number;
  isOwn: boolean;
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

// ─── ASK FORM ───────────────────────────────────────────────────────────────────
function AskForm({ balance, onPosted }: { balance: number; onPosted: () => void }) {
  const [open, setOpen]       = useState(false);
  const [title, setTitle]     = useState("");
  const [content, setContent] = useState("");
  const [error, setError]     = useState("");
  const [posting, setPosting] = useState(false);

  const insufficient = balance < QUESTION_COST;

  async function submit() {
    if (!title.trim() || !content.trim()) { setError("Vui lòng nhập đầy đủ tiêu đề và nội dung"); return; }
    setPosting(true);
    setError("");
    try {
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Đăng câu hỏi thất bại"); return; }
      setTitle(""); setContent(""); setOpen(false);
      onPosted();
    } catch {
      setError("Lỗi kết nối, vui lòng thử lại");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="rounded-xl p-5" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
      {!open ? (
        <button onClick={() => setOpen(true)} disabled={insufficient}
          className="w-full py-3 rounded-lg text-sm font-bold text-white transition-all"
          style={{ background: insufficient ? "#c8c4be" : "#0068FF", borderRadius: "8px", cursor: insufficient ? "not-allowed" : "pointer" }}>
          {insufficient ? `Cần ${QUESTION_COST} 🪙 để đặt câu hỏi` : `+ Đặt câu hỏi (${QUESTION_COST} 🪙)`}
        </button>
      ) : (
        <div className="space-y-3">
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Tiêu đề câu hỏi..."
            maxLength={200}
            className="w-full p-3 rounded-lg text-sm outline-none"
            style={{ background: "#f6f5f4", border: "1px solid #e5e3df", color: "#1E2938" }} />
          <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Mô tả chi tiết câu hỏi của bạn..."
            rows={4}
            className="w-full p-3 rounded-lg text-sm resize-none outline-none"
            style={{ background: "#f6f5f4", border: "1px solid #e5e3df", color: "#1E2938" }} />
          {error && <p className="text-xs font-semibold" style={{ color: "#FF2157" }}>{error}</p>}
          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: "#9CA3AF" }}>Đăng câu hỏi sẽ trừ {QUESTION_COST} 🪙</p>
            <div className="flex gap-2">
              <button onClick={() => setOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-bold"
                style={{ background: "#f6f5f4", border: "1px solid #e5e3df", color: "#6B7280" }}>Hủy</button>
              <button onClick={submit} disabled={posting}
                className="px-4 py-2 rounded-lg text-xs font-bold text-white"
                style={{ background: "#0068FF", opacity: posting ? 0.6 : 1 }}>
                {posting ? "Đang đăng..." : "Đăng câu hỏi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PAGE ────────────────────────────────────────────────────────────────────────
export default function HoiDapPage() {
  const [questions, setQuestions] = useState<QuestionDTO[]>([]);
  const [filter, setFilter]       = useState<"all" | "open" | "answered">("all");
  const [loading, setLoading]     = useState(true);
  const { balance, refetch: refetchWallet } = useWallet();

  function load() {
    const status = filter === "all" ? "" : `?status=${filter}`;
    fetch(`/api/questions${status}`)
      .then(r => r.json())
      .then(setQuestions)
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(load, [filter]);

  function handlePosted() {
    load();
    refetchWallet();
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold" style={{ color: "#1E2938" }}>Hỏi đáp</h1>
        <p className="text-sm mt-0.5" style={{ color: "#6B7280" }}>
          Đặt câu hỏi mất {QUESTION_COST} 🪙, trả lời được chấp nhận nhận xu thưởng
        </p>
      </div>

      <AskForm balance={balance} onPosted={handlePosted} />

      <div className="flex gap-2">
        {[{ key: "all", label: "Tất cả" }, { key: "open", label: "Chưa giải" }, { key: "answered", label: "Đã giải" }].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key as typeof filter)}
            className="px-4 py-1.5 rounded-md text-sm font-medium transition-colors"
            style={filter === f.key
              ? { background: "#0068FF", color: "white", borderRadius: "8px" }
              : { background: "#ffffff", border: "1px solid #e5e3df", color: "#787671", borderRadius: "8px" }}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: "#f6f5f4" }} />)}
        </div>
      ) : questions.length === 0 ? (
        <div className="rounded-xl p-10 text-center" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
          <p className="text-sm" style={{ color: "#9CA3AF" }}>Chưa có câu hỏi nào</p>
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map(q => (
            <Link key={q.id} href={`/student/hoi-dap/${q.id}`}
              className="block rounded-xl p-5 transition-colors hover:bg-[#fafafa]"
              style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ background: q.status === "answered" ? "#d1fae5" : "#DBEAFE", color: q.status === "answered" ? "#00A63D" : "#0068FF" }}>
                      {q.status === "answered" ? "✓ Đã giải" : "Chưa giải"}
                    </span>
                    <span className="text-xs" style={{ color: "#9CA3AF" }}>{q.author.name} · {timeAgo(q.createdAt)}</span>
                  </div>
                  <p className="text-sm font-bold leading-snug" style={{ color: "#1E2938" }}>{q.title}</p>
                  <p className="text-xs mt-1 leading-snug line-clamp-2" style={{ color: "#6B7280" }}>{q.content}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: "#FFFBEB", color: "#92400E" }}>
                    🪙 {q.bountyPaid}
                  </span>
                  <span className="text-xs" style={{ color: "#9CA3AF" }}>{q.answerCount} trả lời</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
