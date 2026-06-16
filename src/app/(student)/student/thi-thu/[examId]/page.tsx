"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ClipboardList, AlertTriangle, Pin } from "griddy-icons";
import type { ExamFull } from "@/lib/api";

type Phase = "loading" | "error" | "ready" | "entering" | "submit" | "done";

interface MyResult {
  score: number;
  totalPoints: number;
  rank: number;
}

export default function ExamEntryPage() {
  const { examId } = useParams<{ examId: string }>();
  const { user }   = useRouter() && useAuth();

  const [exam,      setExam]      = useState<ExamFull | null>(null);
  const [myResult,  setMyResult]  = useState<MyResult | null>(null);
  const [phase,     setPhase]     = useState<Phase>("loading");
  const [countdown, setCountdown] = useState(5);
  const [scoreInput, setScore]    = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitErr,  setSubmitErr]  = useState("");

  // Load exam + student's existing result
  useEffect(() => {
    if (!examId) return;
    Promise.all([
      fetch(`/api/exams/${examId}`).then(r => r.ok ? r.json() : null),
      fetch("/api/exam-results?mine=true").then(r => r.ok ? r.json() : []),
    ]).then(([examData, allResults]: [ExamFull | null, Array<MyResult & { examId: string }>]) => {
      if (!examData) { setPhase("error"); return; }
      setExam(examData);
      const existing = allResults.find(r => r.examId === examId);
      if (existing) {
        setMyResult(existing);
        setPhase("done");
      } else {
        setPhase("ready");
      }
    }).catch(() => setPhase("error"));
  }, [examId]);

  // Countdown khi đang chuyển hướng
  useEffect(() => {
    if (phase !== "entering") return;
    if (countdown <= 0) {
      if (exam?.azotaUrl) window.open(exam.azotaUrl, "_blank");
      setPhase("submit");
      return;
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown, exam]);

  async function submitScore() {
    const score = parseFloat(scoreInput);
    if (isNaN(score) || score < 0) { setSubmitErr("Điểm không hợp lệ"); return; }
    setSubmitting(true);
    setSubmitErr("");
    try {
      const res  = await fetch("/api/exam-results", {
        method:  "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ examId, score }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Lỗi nộp kết quả");
      setMyResult({ score: data.score, totalPoints: data.totalPoints, rank: data.rank });
      setPhase("done");
    } catch (e) {
      setSubmitErr(e instanceof Error ? e.message : "Lỗi không xác định");
    } finally {
      setSubmitting(false);
    }
  }

  const studentName = user?.name ?? "Học viên";

  // ── Loading / Error ──────────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div className="max-w-lg mx-auto flex justify-center py-20">
        <div className="flex gap-1.5">
          {[0,1,2].map(i => (
            <div key={i} className="w-2.5 h-2.5 rounded-full animate-bounce"
              style={{ background: "#0068FF", animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    );
  }

  if (phase === "error" || !exam) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <p className="text-red-500 font-semibold">Không tìm thấy đề thi</p>
      </div>
    );
  }

  // ── Done: show result ────────────────────────────────────────────────────────
  if (phase === "done" && myResult) {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold" style={{ color: "#1E2938" }}>Kết quả của bạn</h1>
          <p className="text-sm mt-0.5" style={{ color: "#6B7280" }}>{exam.title}</p>
        </div>

        <div className="rounded-xl p-8 text-center"
          style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
          <div className="text-5xl font-bold mb-1" style={{ color: "#0068FF" }}>
            {myResult.score}
            <span className="text-2xl" style={{ color: "#a4a097" }}>/{myResult.totalPoints}</span>
          </div>
          {myResult.rank > 0 && (
            <p className="text-sm mt-1" style={{ color: "#787671" }}>Hạng #{myResult.rank} trong bảng xếp hạng</p>
          )}
          <div className="grid grid-cols-2 gap-3 mt-6 text-left">
            {[
              { label: "Đề thi",    value: exam.code },
              { label: "Ngày thi",  value: exam.date },
              { label: "Thời gian", value: exam.duration },
              { label: "Số câu",    value: `${exam.questions} câu` },
            ].map(item => (
              <div key={item.label} className="rounded-xl p-3"
                style={{ background: "#f6f5f4", border: "1px solid #e5e3df" }}>
                <p className="text-xs mb-0.5" style={{ color: "#a4a097" }}>{item.label}</p>
                <p className="text-sm font-bold" style={{ color: "#37352f" }}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => { setMyResult(null); setPhase("ready"); setCountdown(5); setScore(""); }}
          className="w-full py-3 rounded-lg text-sm font-medium transition-colors hover:bg-[#fafafa]"
          style={{ background: "#f6f5f4", border: "1px solid #e5e3df", color: "#787671", borderRadius: "8px" }}>
          Thi lại đề này
        </button>
      </div>
    );
  }

  // ── Submit score form ────────────────────────────────────────────────────────
  if (phase === "submit") {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold" style={{ color: "#1E2938" }}>Nộp kết quả</h1>
          <p className="text-sm mt-0.5" style={{ color: "#6B7280" }}>{exam.title}</p>
        </div>

        <div className="rounded-xl p-6"
          style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
          <div className="mb-4 p-3 rounded-xl" style={{ background: "#dcfce7", border: "1px solid #86efac" }}>
            <p className="text-sm font-semibold" style={{ color: "#065f46" }}>
              Đã mở Azota. Sau khi hoàn thành bài thi, nhập điểm của bạn dưới đây.
            </p>
          </div>

          <label className="block text-sm font-semibold mb-2" style={{ color: "#1E2938" }}>
            Điểm của bạn <span className="text-gray-400 font-normal">(ví dụ: 112 hoặc 8.5)</span>
          </label>
          <input
            type="number"
            step="0.5"
            min="0"
            value={scoreInput}
            onChange={e => { setScore(e.target.value); setSubmitErr(""); }}
            placeholder={`0 — ${exam.questions}`}
            className="w-full px-4 py-3 rounded-xl text-lg font-bold border-2 outline-none mb-4"
            style={{ borderColor: submitErr ? "#fca5a5" : "#e5e3df", background: "#ffffff" }}
          />
          {submitErr && <p className="text-xs text-red-500 mb-3">{submitErr}</p>}

          <button
            onClick={submitScore}
            disabled={submitting || !scoreInput}
            className="w-full py-4 rounded-lg text-base font-bold text-white disabled:opacity-50"
            style={{ background: "#0068FF", borderRadius: "8px" }}>
            {submitting ? "Đang lưu..." : "Nộp kết quả"}
          </button>

          {exam.azotaUrl && (
            <a href={exam.azotaUrl} target="_blank" rel="noopener noreferrer"
              className="block text-center text-sm mt-3" style={{ color: "#0068FF" }}>
              Mở lại Azota →
            </a>
          )}
        </div>
      </div>
    );
  }

  // ── Ready + Entering (default exam info view) ────────────────────────────────
  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold" style={{ color: "#1E2938" }}>Phòng thi</h1>
        <p className="text-sm mt-1" style={{ color: "#6B7280" }}>
          {exam.azotaUrl ? "Chuyển hướng tới Azota để làm bài" : "Vào phòng thi"}
        </p>
      </div>

      <div className="rounded-xl p-6"
        style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>

        {/* Exam info */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center"
            style={{ background: "#dbeafe", border: "1px solid #93c5fd", color: "#0068FF" }}>
            <ClipboardList size={28} />
          </div>
          <div>
            <h2 className="text-lg font-extrabold" style={{ color: "#1E2938" }}>{exam.title}</h2>
            <p className="text-sm" style={{ color: "#9CA3AF" }}>{exam.date} · {exam.time}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          {[
            { label: "Thời gian làm bài", value: exam.duration },
            { label: "Số câu hỏi",        value: `${exam.questions} câu` },
            { label: "Danh mục",           value: exam.category },
            { label: "Mã đề",              value: exam.code },
          ].map(item => (
            <div key={item.label} className="rounded-xl p-3"
              style={{ background: "#f6f5f4", border: "1px solid #e5e3df" }}>
              <p className="text-xs mb-1" style={{ color: "#a4a097" }}>{item.label}</p>
              <p className="text-base font-bold" style={{ color: "#0068FF" }}>{item.value}</p>
            </div>
          ))}
        </div>

        {/* Warning */}
        <div className="rounded-xl p-4 mb-5" style={{ background: "#fef3c7", border: "1px solid #fde68a" }}>
          <p className="text-xs font-semibold flex items-center gap-1.5 mb-1" style={{ color: "#92400e" }}>
            <AlertTriangle size={13} /> Lưu ý quan trọng
          </p>
          <p className="text-xs" style={{ color: "#78350f" }}>
            Làm bài nghiêm túc như thi thật. Kết quả sẽ được ghi nhận và tính vào GPA tháng.
          </p>
        </div>

        {/* Log info */}
        <div className="rounded-xl p-3 mb-5"
          style={{ background: "#f6f5f4", border: "1px solid #e5e3df" }}>
          <p className="text-xs font-semibold mb-1 flex items-center gap-1.5" style={{ color: "#6B7280" }}>
            <Pin size={13} /> Thông tin ghi nhận
          </p>
          <div className="space-y-1">
            <p className="text-xs" style={{ color: "#9CA3AF" }}>• Thời gian: {new Date().toLocaleString("vi-VN")}</p>
            <p className="text-xs" style={{ color: "#9CA3AF" }}>• Học viên: {studentName}</p>
            <p className="text-xs" style={{ color: "#9CA3AF" }}>• Mã đề thi: {exam.code}</p>
          </div>
        </div>

        {/* Redirect button / Countdown */}
        {phase === "ready" ? (
          !exam.azotaUrl ? (
            <div className="p-4 rounded-2xl text-center" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
              <p className="text-sm text-red-600 font-semibold">Đề thi chưa có link Azota</p>
              <p className="text-xs text-red-400 mt-1">Admin cần cập nhật Azota URL cho đề thi này.</p>
            </div>
          ) : (
            <button
              onClick={() => setPhase("entering")}
              className="w-full py-4 rounded-lg text-base font-bold text-white"
              style={{ background: "#0068FF", borderRadius: "8px" }}>
              ▶ Vào phòng thi ngay
            </button>
          )
        ) : (
          <div className="text-center">
            <div className="w-20 h-20 rounded-xl flex items-center justify-center mx-auto mb-4"
              style={{ background: "#dbeafe", border: "1px solid #93c5fd" }}>
              <span className="text-4xl font-extrabold" style={{ color: "#0068FF" }}>{countdown}</span>
            </div>
            <p className="text-sm font-semibold" style={{ color: "#1E2938" }}>Đang chuyển hướng đến Azota...</p>
          </div>
        )}
      </div>

      {/* Rules */}
      <div className="rounded-xl p-5"
        style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: "#1E2938" }}>
          <ClipboardList size={16} /> Quy định phòng thi
        </h3>
        <ul className="space-y-2">
          {[
            "Không thoát khỏi trang Azota trong khi làm bài",
            "Không chụp ảnh màn hình hoặc chia sẻ đề thi",
            "Kết quả tự động nộp khi hết giờ",
            "Vi phạm sẽ bị xử lý theo quy định kỷ luật (Strike system)",
          ].map((rule, i) => (
            <li key={i} className="flex items-start gap-2 text-xs" style={{ color: "#4B5563" }}>
              <span className="mt-0.5 flex-shrink-0" style={{ color: "#FF2157" }}>•</span>
              {rule}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
