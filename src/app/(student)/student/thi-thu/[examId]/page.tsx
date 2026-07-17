"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ClipboardList, AlertTriangle, Pin } from "griddy-icons";
import { api, type ExamFull, type ExamAttemptState, type ExamAttemptHistoryItem, type ExamQuestionPublic, type ExamAttemptReview } from "@/lib/api";
import { MathText } from "@/components/MathText";

type Phase = "loading" | "error" | "ready" | "entering" | "submit" | "taking" | "done" | "review";

interface MyResult {
  score: number;
  totalPoints: number;
  rank: number;
}

interface LeaderboardRow {
  score: number;
  completedAt: string;
  user: { name: string };
}

export default function ExamEntryPage() {
  const { examId } = useParams<{ examId: string }>();
  const { user }   = useAuth();

  const [exam,      setExam]      = useState<ExamFull | null>(null);
  const [myResult,  setMyResult]  = useState<MyResult | null>(null);
  const [phase,     setPhase]     = useState<Phase>("loading");
  const [countdown, setCountdown] = useState(5);
  const [scoreInput, setScore]    = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitErr,  setSubmitErr]  = useState("");

  // ── In-platform exam taking (exam.hasQuestions) ──────────────────────────
  const [attempt,  setAttempt]  = useState<ExamAttemptState | null>(null);
  const [selected, setSelected] = useState<Record<string, string>>({}); // MC: questionId -> optionId
  const [essayText, setEssayText] = useState<Record<string, string>>({}); // ESSAY: questionId -> text
  const [clusterAnswers, setClusterAnswers] = useState<Record<string, boolean | null>>({}); // CLUSTER: optionId -> đúng/sai
  const [startErr, setStartErr] = useState("");
  const [examPassword, setExamPassword] = useState("");
  const [nowTick,  setNowTick]  = useState(0);
  const autoSubmitted = useRef(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [history,     setHistory]     = useState<ExamAttemptHistoryItem[]>([]);
  const [reviewData, setReviewData] = useState<ExamAttemptReview | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewErr, setReviewErr] = useState("");

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

  // Top 10 leaderboard + lịch sử làm bài — chỉ cho đề có câu hỏi trong platform
  function refreshLeaderboardAndHistory() {
    if (!examId) return;
    fetch(`/api/exam-results?examId=${examId}`)
      .then(r => r.ok ? r.json() : [])
      .then((rows: LeaderboardRow[]) => setLeaderboard(rows.slice(0, 10)))
      .catch(() => {});
    api.examAttempts.history(examId).then(setHistory).catch(() => {});
  }

  useEffect(() => {
    if (!exam?.hasQuestions || !examId) return;
    refreshLeaderboardAndHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exam?.hasQuestions, examId]);

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

  async function startAttempt() {
    setStartErr("");
    try {
      const state = await api.examAttempts.start(examId, examPassword || undefined);
      setAttempt(state);
      setSelected((state.answers ?? {}) as Record<string, string>);
      setEssayText(state.textAnswers ?? {});
      setClusterAnswers(state.boolAnswers ?? {});
      setPhase("taking");
    } catch (e) {
      setStartErr(e instanceof Error ? e.message : "Không thể bắt đầu bài thi");
    }
  }

  function selectAnswer(questionId: string, optionId: string) {
    setSelected(prev => ({ ...prev, [questionId]: optionId }));
    if (attempt) {
      api.examAttempts.answer(attempt.attemptId, questionId, optionId).catch(() => {});
    }
  }

  function updateEssayAnswer(questionId: string, text: string) {
    setEssayText(prev => ({ ...prev, [questionId]: text }));
  }
  // Lưu câu tự luận khi rời khỏi ô nhập (không autosave từng ký tự — tránh spam request)
  function saveEssayAnswer(questionId: string) {
    if (!attempt) return;
    api.examAttempts.answerEssay(attempt.attemptId, questionId, essayText[questionId] ?? "").catch(() => {});
  }

  function selectClusterAnswer(optionId: string, answerTrue: boolean) {
    setClusterAnswers(prev => ({ ...prev, [optionId]: answerTrue }));
    if (attempt) {
      api.examAttempts.answerBool(attempt.attemptId, optionId, answerTrue).catch(() => {});
    }
  }

  // Đã trả lời hay chưa — dùng cho thanh tiến độ + lưới nhảy câu (khác cách tính theo type)
  function isQuestionAnswered(q: ExamQuestionPublic): boolean {
    if (q.type === "ESSAY") return !!essayText[q.id]?.trim();
    if (q.type === "TRUE_FALSE_CLUSTER") return q.options.every(o => clusterAnswers[o.id] !== null && clusterAnswers[o.id] !== undefined);
    return !!selected[q.id];
  }

  async function submitAttempt() {
    if (!attempt || submitting) return;
    setSubmitting(true);
    try {
      // saveEssayAnswer chỉ lưu lúc rời ô nhập (blur) — nếu học viên gõ xong
      // câu tự luận rồi bấm "Kết thúc bài thi" ngay mà chưa từng blur, câu trả
      // lời chỉ tồn tại trong state cục bộ, chưa từng gửi lên server. Flush lại
      // toàn bộ câu tự luận đang có trước khi nộp để không mất bài làm.
      const essayEntries = Object.entries(essayText).filter(([, text]) => text.trim());
      await Promise.all(
        essayEntries.map(([questionId, text]) =>
          api.examAttempts.answerEssay(attempt.attemptId, questionId, text).catch(() => {})
        )
      );
      const result = await api.examAttempts.submit(attempt.attemptId);
      setMyResult({ score: result.score, totalPoints: result.totalPoints, rank: result.rank });
      setPhase("done");
      refreshLeaderboardAndHistory();
    } catch {
      setStartErr("Nộp bài thất bại, thử lại");
    } finally {
      setSubmitting(false);
    }
  }

  // Lượt thi để xem lại: ưu tiên attempt vừa làm trong phiên này, nếu không
  // có (vd vào thẳng trang đã có kết quả từ trước) thì dùng lượt gần nhất trong lịch sử.
  const reviewableAttemptId = attempt?.attemptId ?? history[0]?.id ?? null;

  async function openReview() {
    if (!reviewableAttemptId) return;
    setReviewErr("");
    setReviewLoading(true);
    setPhase("review");
    try {
      const data = await api.examAttempts.review(reviewableAttemptId);
      setReviewData(data);
    } catch (e) {
      setReviewErr(e instanceof Error ? e.message : "Không tải được bài làm");
    } finally {
      setReviewLoading(false);
    }
  }

  // Đếm ngược hiển thị (client-side, chỉ để hiển thị — server tự enforce hạn giờ thật)
  useEffect(() => {
    if (phase !== "taking" || !attempt?.expiresAt) return;
    const t = setInterval(() => setNowTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, [phase, attempt?.expiresAt]);

  // Giám sát rời màn hình/chuyển tab lúc đang thi — chỉ đếm sự kiện gửi lên
  // server, không quay màn hình/webcam, không làm gián đoạn bài thi.
  // Chỉ dùng visibilitychange (không thêm window blur) để tránh đếm trùng —
  // hầu hết trình duyệt bắn cả 2 sự kiện cùng lúc khi chuyển tab thật.
  useEffect(() => {
    if (phase !== "taking" || !attempt?.attemptId) return;
    const attemptId = attempt.attemptId;
    function report() {
      if (document.visibilityState === "hidden") {
        api.examAttempts.tabEvent(attemptId).catch(() => {});
      }
    }
    document.addEventListener("visibilitychange", report);
    return () => document.removeEventListener("visibilitychange", report);
  }, [phase, attempt?.attemptId]);

  const remainingSec = attempt?.expiresAt
    ? Math.max(0, Math.floor((new Date(attempt.expiresAt).getTime() - Date.now()) / 1000))
    : 0;

  useEffect(() => {
    if (phase === "taking" && attempt?.expiresAt && remainingSec <= 0 && !autoSubmitted.current) {
      autoSubmitted.current = true;
      submitAttempt();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, remainingSec]);

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
        <p className="font-semibold" style={{ color: "#dc2626" }}>Không tìm thấy đề thi</p>
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

        {exam.hasQuestions && reviewableAttemptId && (
          <button
            onClick={openReview}
            className="w-full py-3 rounded-lg text-sm font-semibold text-white"
            style={{ background: "#0068FF", borderRadius: "8px" }}>
            Xem lại bài làm
          </button>
        )}

        <button
          onClick={() => { setMyResult(null); setPhase("ready"); setCountdown(5); setScore(""); }}
          className="w-full py-3 rounded-lg text-sm font-medium transition-colors hover:bg-[#fafafa]"
          style={{ background: "#f6f5f4", border: "1px solid #e5e3df", color: "#787671", borderRadius: "8px" }}>
          Thi lại đề này
        </button>
      </div>
    );
  }

  // ── Review: xem lại bài làm sau khi nộp ──────────────────────────────────────
  if (phase === "review") {
    return (
      <div className="max-w-2xl mx-auto space-y-5 pb-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold" style={{ color: "#1E2938" }}>Xem lại bài làm</h1>
            <p className="text-sm mt-0.5" style={{ color: "#6B7280" }}>{exam.title}</p>
          </div>
          <button onClick={() => setPhase("done")}
            className="text-sm font-semibold" style={{ color: "#0068FF" }}>
            ← Quay lại kết quả
          </button>
        </div>

        {reviewLoading ? (
          <p className="text-sm text-center py-10" style={{ color: "#787671" }}>Đang tải...</p>
        ) : reviewErr ? (
          <p className="text-sm text-center py-10" style={{ color: "#dc2626" }}>{reviewErr}</p>
        ) : reviewData ? (
          <>
            {!reviewData.canSeeAnswers && (
              <div className="rounded-xl p-3 text-xs" style={{ background: "#fef3c7", border: "1px solid #fde68a", color: "#92400e" }}>
                Đề thi này chưa cho phép xem đáp án lúc này — chỉ hiện câu trả lời của bạn.
              </div>
            )}
            <div className="space-y-3">
              {reviewData.questions.map((q, idx) => (
                <div key={q.id} className="rounded-xl p-4" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
                  <p className="text-sm font-semibold mb-2" style={{ color: "#1E2938" }}>Câu {idx + 1}: <MathText text={q.text} /></p>

                  {q.type === "MC" && (
                    <div className="space-y-1.5">
                      {q.options.map(o => {
                        const isMine = o.id === q.studentOptionId;
                        const color = o.isCorrect === true ? "#16a34a" : o.isCorrect === false && isMine ? "#dc2626" : "#787671";
                        return (
                          <div key={o.id} className="text-xs flex items-center gap-1.5" style={{ color }}>
                            {isMine && <strong>→</strong>} <MathText text={o.text} />
                            {o.isCorrect === true && " ✓"}
                          </div>
                        );
                      })}
                      {q.explanation && (
                        <p className="text-xs mt-1.5 p-2 rounded-lg" style={{ background: "#f6f5f4", color: "#787671" }}>
                          <strong>Giải thích:</strong> <MathText text={q.explanation} />
                        </p>
                      )}
                    </div>
                  )}

                  {q.type === "TRUE_FALSE_CLUSTER" && (
                    <div className="space-y-1.5">
                      {q.options.map(o => (
                        <div key={o.id} className="text-xs flex items-center gap-1.5" style={{ color: "#37352f" }}>
                          <strong>{o.subLabel})</strong> <MathText text={o.text} />
                          <span style={{ color: "#a4a097" }}>
                            — bạn chọn: {o.studentAnswerTrue === null ? "chưa trả lời" : o.studentAnswerTrue ? "Đúng" : "Sai"}
                          </span>
                          {o.isCorrect !== null && (
                            <span style={{ color: o.isCorrect === o.studentAnswerTrue ? "#16a34a" : "#dc2626" }}>
                              (đáp án đúng: {o.isCorrect ? "Đúng" : "Sai"})
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {q.type === "ESSAY" && (
                    <div>
                      <div className="text-sm p-3 rounded-lg mb-2" style={{ background: "#f6f5f4", color: "#37352f" }}>
                        {q.textAnswer?.trim() ? q.textAnswer : <em style={{ color: "#a4a097" }}>Bạn chưa trả lời</em>}
                      </div>
                      {q.pointsAwarded != null ? (
                        <div>
                          <p className="text-xs font-semibold" style={{ color: "#16a34a" }}>Điểm: {q.pointsAwarded}/{q.points}</p>
                          {q.teacherComment && <p className="text-xs mt-1" style={{ color: "#787671" }}>Nhận xét: {q.teacherComment}</p>}
                        </div>
                      ) : (
                        <p className="text-xs" style={{ color: "#a4a097" }}>Chưa chấm</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : null}
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
            placeholder="0 — 150"
            className="w-full px-4 py-3 rounded-xl text-lg font-bold border-2 outline-none mb-4"
            style={{ borderColor: submitErr ? "#fca5a5" : "#e5e3df", background: "#ffffff" }}
          />
          {submitErr && <p className="text-xs mb-3" style={{ color: "#dc2626" }}>{submitErr}</p>}

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

  // ── Taking: render câu hỏi + sidebar trái sticky (đếm ngược, tiến độ, jump-grid) ──
  if (phase === "taking" && attempt?.questions) {
    const total = attempt.questions.length;
    const answeredCount = attempt.questions.filter(isQuestionAnswered).length;
    const mm = String(Math.floor(remainingSec / 60)).padStart(2, "0");
    const ss = String(remainingSec % 60).padStart(2, "0");
    const cardStyle = { background: "#ffffff", border: "1px solid #e5e3df" };

    return (
      <div className="max-w-6xl mx-auto pb-10">
        <div className="mb-5">
          <h1 className="text-xl font-extrabold" style={{ color: "#1E2938" }}>{exam.title}</h1>
          <p className="text-sm mt-0.5" style={{ color: "#6B7280" }}>Làm bài nghiêm túc — điểm được chấm và ghi nhận tự động khi nộp bài.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6">
          {/* Sidebar trái: sticky ngay cả khi cuộn — đếm ngược luôn hiện, không bị che bởi thanh điều hướng dưới.
              Không đặt items-start ở grid cha: cột trái cần "thừa hưởng" chiều cao của cột phải (câu hỏi) để
              còn khoảng trống mà dính (sticky) trong lúc cuộn — nếu chỉ cao bằng nội dung của chính nó thì
              sticky sẽ hết tác dụng ngay khi cuộn qua khỏi chiều cao đó. */}
          <div className="space-y-3 md:sticky md:top-20 md:self-start order-1">
            <div className="rounded-xl p-4 text-center" style={cardStyle}>
              <p className="text-xs mb-1" style={{ color: "#a4a097" }}>Thời gian còn lại</p>
              <p className="text-3xl font-extrabold tabular-nums" style={{ color: remainingSec < 60 ? "#dc2626" : "#1E2938" }}>{mm}:{ss}</p>
            </div>

            <div className="rounded-xl p-4" style={cardStyle}>
              <p className="text-xs mb-1.5" style={{ color: "#a4a097" }}>Đã hoàn thành {answeredCount}/{total}</p>
              <div className="h-1.5 rounded-full" style={{ background: "#f6f5f4" }}>
                <div className="h-1.5 rounded-full" style={{ width: `${(answeredCount / total) * 100}%`, background: "#0068FF" }} />
              </div>
            </div>

            <div className="rounded-xl p-4" style={cardStyle}>
              <p className="text-xs mb-2" style={{ color: "#a4a097" }}>Chọn câu hỏi</p>
              <div className="grid grid-cols-5 md:grid-cols-4 gap-1.5">
                {attempt.questions.map((q, idx) => (
                  <button key={q.id}
                    onClick={() => document.getElementById(`q-${q.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
                    className="w-full aspect-square rounded text-xs font-semibold"
                    style={{
                      background: isQuestionAnswered(q) ? "#dbeafe" : "#f6f5f4",
                      color: isQuestionAnswered(q) ? "#0068FF" : "#787671",
                      border: "1px solid #e5e3df",
                    }}>
                    {idx + 1}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={submitAttempt} disabled={submitting}
              className="w-full py-3 rounded-lg text-sm font-bold text-white disabled:opacity-50"
              style={{ background: "#dc2626" }}>
              {submitting ? "Đang nộp..." : "Kết thúc bài thi"}
            </button>
          </div>

          {/* Danh sách câu hỏi */}
          <div className="space-y-5 order-2">
            {attempt.questions.map((q, idx) => (
              <div key={q.id} id={`q-${q.id}`} className="rounded-xl p-5" style={cardStyle}>
                <p className="text-sm font-semibold mb-3" style={{ color: "#1E2938" }}>
                  Câu {idx + 1}: <MathText text={q.text} />
                </p>
                {q.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={q.imageUrl} alt="" className="max-w-full rounded-lg mb-3" />
                )}

                {q.type === "ESSAY" ? (
                  <textarea
                    className="w-full px-3 py-2.5 text-sm rounded-lg outline-none focus:border-blue-400"
                    style={{ border: "1px solid #e5e3df" }}
                    rows={5}
                    placeholder="Nhập câu trả lời của bạn..."
                    value={essayText[q.id] ?? ""}
                    onChange={e => updateEssayAnswer(q.id, e.target.value)}
                    onBlur={() => saveEssayAnswer(q.id)}
                  />
                ) : q.type === "TRUE_FALSE_CLUSTER" ? (
                  <div className="space-y-2">
                    {q.options.map(o => (
                      <div key={o.id} className="flex items-center justify-between gap-3 p-2.5 rounded-lg"
                        style={{ border: "1px solid #e5e3df" }}>
                        <span className="text-sm flex-1" style={{ color: "#37352f" }}>
                          <strong>{o.subLabel})</strong> <MathText text={o.text} />
                        </span>
                        <div className="flex gap-1.5 flex-shrink-0">
                          {([["Đúng", true], ["Sai", false]] as const).map(([label, val]) => (
                            <button key={label} type="button"
                              onClick={() => selectClusterAnswer(o.id, val)}
                              className="px-3 py-1 rounded-lg text-xs font-semibold border"
                              style={clusterAnswers[o.id] === val
                                ? { background: "#0068FF", borderColor: "#0068FF", color: "#fff" }
                                : { borderColor: "#e5e3df", color: "#787671" }}>
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {q.options.map((o, oi) => (
                      <label key={o.id}
                        className="flex items-start gap-2.5 p-2.5 rounded-lg cursor-pointer hover:bg-[#f6f5f4]"
                        style={{ border: `1px solid ${selected[q.id] === o.id ? "#0068FF" : "#e5e3df"}` }}>
                        <input type="radio" name={`q-${q.id}`} className="mt-0.5"
                          checked={selected[q.id] === o.id}
                          onChange={() => selectAnswer(q.id, o.id)} />
                        <span className="text-sm" style={{ color: "#37352f" }}>
                          <strong>{String.fromCharCode(65 + oi)}.</strong> <MathText text={o.text} />
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {startErr && (
          <p className="fixed bottom-4 left-1/2 -translate-x-1/2 text-xs px-3 py-2 rounded-lg z-50"
            style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>{startErr}</p>
        )}
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
          exam.hasQuestions ? (
            <>
              {exam.hasPassword && (
                <input
                  type="text"
                  placeholder="Nhập mật khẩu đề thi (hỏi giáo viên)"
                  className="w-full px-4 py-3 rounded-lg text-sm border-2 outline-none mb-3"
                  style={{ borderColor: "#e5e3df" }}
                  value={examPassword}
                  onChange={e => setExamPassword(e.target.value)}
                />
              )}
              <button
                onClick={startAttempt}
                className="w-full py-4 rounded-lg text-base font-bold text-white"
                style={{ background: "#0068FF", borderRadius: "8px" }}>
                ▶ Bắt đầu làm bài
              </button>
              {startErr && <p className="text-xs mt-2 text-center" style={{ color: "#dc2626" }}>{startErr}</p>}
            </>
          ) : !exam.azotaUrl ? (
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

      {exam.hasQuestions && (exam.showLeaderboard ?? true) && leaderboard.length > 0 && (
        <div className="rounded-xl p-5" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
          <h3 className="text-sm font-bold mb-3" style={{ color: "#1E2938" }}>Bảng xếp hạng Top 10</h3>
          <div className="space-y-2">
            {leaderboard.map((row, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-5 text-xs font-bold" style={{ color: "#a4a097" }}>{i + 1}</span>
                  <span style={{ color: "#37352f" }}>{row.user.name}</span>
                </div>
                <span className="font-bold" style={{ color: "#0068FF" }}>{row.score}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {exam.hasQuestions && history.length > 0 && (
        <div className="rounded-xl p-5" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
          <h3 className="text-sm font-bold mb-3" style={{ color: "#1E2938" }}>Lịch sử làm bài</h3>
          <div className="space-y-2">
            {history.map(h => (
              <div key={h.id} className="flex items-center justify-between text-sm">
                <span style={{ color: "#787671" }}>
                  {h.submittedAt ? new Date(h.submittedAt).toLocaleString("vi-VN") : "—"}
                  {h.status === "expired" && " (hết giờ)"}
                </span>
                <span className="font-bold" style={{ color: "#0068FF" }}>{h.score ?? 0}/{exam.totalPoints}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
