"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ClipboardList, AlertTriangle, Pin } from "griddy-icons";
import { api, type ExamFull, type ExamAttemptState, type ExamAttemptHistoryItem, type ExamQuestionPublic, type ExamAttemptReview, type ExamGate } from "@/lib/api";
import { MathText } from "@/components/MathText";
import CorrectionPanel from "@/components/exam/CorrectionPanel";
import ExamRoomView from "@/components/exam/ExamRoomView";
import { KinLoader } from "@/components/kin/KinLoader";
import { KinCopyButton } from "@/components/kin";
import QuizEntryGate from "@/components/exam/QuizEntryGate";
import QuizTimeUp from "@/components/exam/QuizTimeUp";
import { clockOffsetMs, pickDraft, remainingSecFrom, submittedNotice, type DraftState } from "@/lib/quizRoom";
import { clearLocalDrafts, readLocalDraft, writeLocalDraft } from "@/lib/quizDraftStore";

type Phase = "loading" | "error" | "ready" | "entering" | "submit" | "taking" | "timeup" | "done" | "review";

interface MyResult {
  /** null = quiz có tự luận, gia sư chưa công bố (KHÔNG phải 0 điểm). */
  score: number | null;
  totalPoints: number;
  rank: number | null;
  pendingManual?: boolean;
}

interface LeaderboardRow {
  score: number;
  completedAt: string;
  user: { name: string };
}

// Phòng thi khoá cứng Navy (Figma 27:2, TK-168/174): ô đáp án đang chọn mà tô màu chủ đề thầy cô thích (cổ vịt…) thì học sinh đọc nhầm
// là "đáp án đúng", và phòng thi phải giống hệt nhau với mọi người. [data-vung="phong-thi"] đặt lại màu nhấn về Navy cho mọi phần bên trong.
// Phòng thi KHÔNG có vỏ (thanh module): chỉ lúc đang LÀM BÀI mới cần khoá cứng. Các màn trước và sau bài (chuẩn bị vào thi, kết quả, đề không tồn tại) từng không có liên kết nào
// để đi tiếp — học viên nộp bài xong, hoặc mở nhầm đề, chỉ còn nút Back của trình duyệt (16/10/2026).
function ExamExitLink() {
  return (
    <div>
      <Link href="/student/thi-thu" className="inline-flex items-center min-h-11 text-sm font-semibold hover:underline" style={{ color: "var(--kin-nhan-link)" }}>← Về danh sách đề thi</Link>
    </div>
  );
}

export default function ExamEntryPage() {
  return (
    <div data-vung="phong-thi">
      <ExamEntryInner />
    </div>
  );
}

function ExamEntryInner() {
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
  const [showCorrection, setShowCorrection] = useState(false); // NV-188: màn Chữa bài
  const [tabLeaves, setTabLeaves] = useState(0); // số lần rời tab trong lượt thi này (server đếm)

  // QZ-11: giờ máy chủ, cổng vào đề, bản nháp, biên nhận, màn hết giờ.
  const [clockOffset, setClockOffset] = useState(0); // ms: giờ máy chủ − giờ trình duyệt
  const [gate, setGate] = useState<ExamGate | null>(null);
  const [gateErr, setGateErr] = useState(false);
  const [starting, setStarting] = useState(false);
  const [draftStatus, setDraftStatus] = useState<Record<string, DraftState>>({});
  const draftTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const attemptIdRef = useRef<string | null>(null);
  const clockOffsetRef = useRef(0);
  const [submitInfo, setSubmitInfo] = useState<{ expired: boolean; receipt: string; submittedAt: string | null } | null>(null);
  const [timeUp, setTimeUp] = useState<"sending" | "unconfirmed">("sending");

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

  // QZ-11: cổng vào đề — tải khi ở màn chuẩn bị (đề làm trong KiN) và khi ở màn kết quả (để biết còn được làm lại không).
  function loadGate() {
    if (!examId) return;
    api.examAttempts.gate(examId).then(g => { setGate(g); setGateErr(false); }).catch(() => setGateErr(true));
  }
  useEffect(() => {
    if (!exam?.hasQuestions || (phase !== "ready" && phase !== "done")) return;
    loadGate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exam?.hasQuestions, phase === "ready" || phase === "done"]);

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

  // Đổ trạng thái lượt (bắt đầu / tiếp tục) vào màn làm bài: đồng hồ theo máy chủ, bản nháp trộn với bản dự phòng trên máy này.
  function hydrateAttempt(state: ExamAttemptState) {
    const off = clockOffsetMs(state.serverNow, Date.now());
    clockOffsetRef.current = off; setClockOffset(off);
    attemptIdRef.current = state.attemptId;
    const server = state.textAnswers ?? {};
    const merged: Record<string, string> = { ...server };
    const toPush: [string, string][] = [];
    for (const q of state.questions ?? []) {
      if (q.type !== "ESSAY" && q.type !== "SHORT_ANSWER") continue;
      const d = pickDraft(server[q.id], readLocalDraft(state.attemptId, q.id));
      if (d.text || server[q.id] !== undefined) merged[q.id] = d.text;
      if (d.fromLocal) toPush.push([q.id, d.text]);
    }
    setAttempt(state);
    setSelected((state.answers ?? {}) as Record<string, string>);
    setEssayText(merged);
    setClusterAnswers(state.boolAnswers ?? {});
    setTabLeaves(state.tabSwitchCount ?? 0);
    setDraftStatus({});
    autoSubmitted.current = false;
    toPush.forEach(([qid, text]) => saveDraftNow(qid, text, state.attemptId));
  }

  async function startAttempt() {
    setStartErr("");
    setStarting(true);
    try {
      const state = await api.examAttempts.start(examId, examPassword || undefined);
      hydrateAttempt(state);
      setPhase("taking");
    } catch (e) {
      setStartErr(e instanceof Error ? e.message : "Không thể bắt đầu bài thi");
      loadGate(); // số lượt/quyền có thể đã đổi — cập nhật lại cổng
    } finally {
      setStarting(false);
    }
  }

  function selectAnswer(questionId: string, optionId: string) {
    setSelected(prev => ({ ...prev, [questionId]: optionId }));
    if (attempt) {
      api.examAttempts.answer(attempt.attemptId, questionId, optionId).catch(() => {});
    }
  }

  // QZ-11: tự lưu nháp lên máy chủ khi em ngừng gõ (1,2 giây), kèm bản dự phòng trên máy. Báo trạng thái thật: chỉ "đã lưu trên máy chủ" khi máy chủ đã nhận.
  function nowLabel() { return new Date(Date.now() + clockOffsetRef.current).toLocaleTimeString("vi-VN", { hour12: false }); }
  async function saveDraftNow(questionId: string, text: string, attemptId?: string) {
    const aid = attemptId ?? attemptIdRef.current;
    if (!aid) return;
    clearTimeout(draftTimers.current[questionId]);
    setDraftStatus(prev => ({ ...prev, [questionId]: { kind: "saving" } }));
    try {
      await api.examAttempts.answerEssay(aid, questionId, text);
      const local = readLocalDraft(aid, questionId);
      if (!local || local.text === text) writeLocalDraft(aid, questionId, { text, synced: true });
      setDraftStatus(prev => ({ ...prev, [questionId]: { kind: "saved", at: nowLabel() } }));
    } catch (e) {
      setDraftStatus(prev => ({ ...prev, [questionId]: { kind: "failed" } }));
      const permanent = e instanceof Error && /hết giờ|kết thúc|Phần này/.test(e.message);
      if (!permanent && attemptIdRef.current === aid) draftTimers.current[questionId] = setTimeout(() => { const t = readLocalDraft(aid, questionId); if (t && !t.synced) saveDraftNow(questionId, t.text, aid); }, 5000);
    }
  }
  function updateEssayAnswer(questionId: string, text: string) {
    setEssayText(prev => ({ ...prev, [questionId]: text }));
    const aid = attemptIdRef.current;
    if (!aid) return;
    writeLocalDraft(aid, questionId, { text, synced: false });
    clearTimeout(draftTimers.current[questionId]);
    draftTimers.current[questionId] = setTimeout(() => saveDraftNow(questionId, text, aid), 1200);
  }
  // Rời khỏi ô nhập → lưu ngay, không chờ hết nhịp.
  function saveEssayAnswer(questionId: string) {
    if (!attempt) return;
    saveDraftNow(questionId, essayText[questionId] ?? "");
  }

  function selectClusterAnswer(optionId: string, answerTrue: boolean) {
    setClusterAnswers(prev => ({ ...prev, [optionId]: answerTrue }));
    if (attempt) {
      api.examAttempts.answerBool(attempt.attemptId, optionId, answerTrue).catch(() => {});
    }
  }

  // Đã trả lời hay chưa — dùng cho thanh tiến độ + lưới nhảy câu (khác cách tính theo type)
  function isQuestionAnswered(q: ExamQuestionPublic): boolean {
    if (q.type === "ESSAY" || q.type === "SHORT_ANSWER") return !!essayText[q.id]?.trim();
    if (q.type === "TRUE_FALSE_CLUSTER") return q.options.every(o => clusterAnswers[o.id] !== null && clusterAnswers[o.id] !== undefined);
    if (q.type === "MC_MULTI") return q.options.some(o => clusterAnswers[o.id] === true); // QZ-03: tích ít nhất một ô
    return !!selected[q.id];
  }

  async function submitAttempt() {
    if (!attempt || submitting) return;
    setSubmitting(true);
    try {
      // Gửi lại mọi chữ còn chưa chắc đã lên máy chủ (gõ xong mà chưa rời ô / mạng chập chờn) rồi mới nộp.
      // Sau hạn máy chủ sẽ từ chối các lần gửi này — không sao, bản nháp đã tự lưu trước đó vẫn là bài.
      const essayEntries = Object.entries(essayText).filter(([, text]) => text.trim());
      await Promise.all(
        essayEntries.map(([questionId, text]) =>
          api.examAttempts.answerEssay(attempt.attemptId, questionId, text).catch(() => {})
        )
      );
      const result = await api.examAttempts.submit(attempt.attemptId);
      // Chỉ tới đây — máy chủ đã trả biên nhận — mới được coi là đã nộp.
      Object.values(draftTimers.current).forEach(clearTimeout);
      clearLocalDrafts(attempt.attemptId);
      setSubmitInfo({ expired: !!result.expired, receipt: result.receipt ?? "", submittedAt: result.submittedAt ?? null });
      setMyResult({ score: result.score, totalPoints: result.totalPoints, rank: result.rank, pendingManual: !!result.pendingManual });
      setPhase("done");
      refreshLeaderboardAndHistory();
    } catch {
      // Hết giờ mà chưa có xác nhận: ở lại màn "chưa xác nhận" (có nút thử lại), không giả vờ đã nộp.
      if (autoSubmitted.current) setTimeUp("unconfirmed");
      else setStartErr("Nộp bài thất bại, thử lại");
    } finally {
      setSubmitting(false);
    }
  }

  // QZ-11: hết giờ → màn "đang xác nhận bài nộp"; nút thử lại gọi lại nộp (nộp lặp an toàn: máy chủ trả lại kết quả đã có).
  function retryTimeUp() { setTimeUp("sending"); submitAttempt(); }

  // Lượt thi để xem lại: ưu tiên attempt vừa làm trong phiên này, nếu không
  // có (vd vào thẳng trang đã có kết quả từ trước) thì dùng lượt gần nhất trong lịch sử.
  const reviewableAttemptId = attempt?.attemptId ?? history[0]?.id ?? null;

  // Đóng màn Chữa bài: tải lại bài làm để các câu vừa chữa xong hiện đáp án + lời giải ở màn xem lại.
  async function closeCorrection() {
    setShowCorrection(false);
    if (!reviewableAttemptId) return;
    try { setReviewData(await api.examAttempts.review(reviewableAttemptId)); } catch { /* giữ dữ liệu cũ */ }
  }

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

  // Dọn hẹn giờ lưu nháp khi rời trang.
  useEffect(() => () => { Object.values(draftTimers.current).forEach(clearTimeout); }, []);

  // Em chuyển tab / khoá màn hình: đẩy ngay mọi chữ chưa đồng bộ lên máy chủ.
  useEffect(() => {
    if (phase !== "taking" || !attempt?.attemptId) return;
    const aid = attempt.attemptId;
    const qs = attempt.questions ?? [];
    function flush() {
      if (document.visibilityState !== "hidden") return;
      for (const q of qs) {
        if (q.type !== "ESSAY" && q.type !== "SHORT_ANSWER") continue;
        const d = readLocalDraft(aid, q.id);
        if (d && !d.synced) saveDraftNow(q.id, d.text, aid);
      }
    }
    document.addEventListener("visibilitychange", flush);
    return () => document.removeEventListener("visibilitychange", flush);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, attempt?.attemptId]);

  // Giám sát rời màn hình/chuyển tab lúc đang thi — chỉ đếm sự kiện gửi lên
  // server, không quay màn hình/webcam, không làm gián đoạn bài thi.
  // Chỉ dùng visibilitychange (không thêm window blur) để tránh đếm trùng —
  // hầu hết trình duyệt bắn cả 2 sự kiện cùng lúc khi chuyển tab thật.
  useEffect(() => {
    if (phase !== "taking" || !attempt?.attemptId) return;
    const attemptId = attempt.attemptId;
    function report() {
      if (document.visibilityState === "hidden") {
        api.examAttempts.tabEvent(attemptId).then(r => { if (typeof r.tabSwitchCount === "number") setTabLeaves(r.tabSwitchCount); }).catch(() => {});
      }
    }
    document.addEventListener("visibilitychange", report);
    return () => document.removeEventListener("visibilitychange", report);
  }, [phase, attempt?.attemptId]);

  // Giờ riêng từng Phần (vd đề ĐGNL HSA) — null nếu đề không dùng (hành vi cũ,
  // chỉ 1 đồng hồ chung). currentSectionIndex = Phần đang hiển thị: Phần đầu
  // tiên còn endsAt ở tương lai, hoặc Phần cuối nếu tất cả đã qua (sắp tự nộp).
  // QZ-11: mọi phép tính giờ dùng giờ MÁY CHỦ (giờ trình duyệt + chênh lệch lấy lúc mở lượt), không tin đồng hồ máy em.
  const sectionWindows = attempt?.sectionWindows ?? null;
  const serverNowMs = Date.now() + clockOffset;
  const currentSectionIndex = sectionWindows && sectionWindows.length > 0
    ? (() => {
        const idx = sectionWindows.findIndex(w => new Date(w.endsAt).getTime() > serverNowMs);
        return idx === -1 ? sectionWindows.length - 1 : idx;
      })()
    : -1;
  const isLastSection = !sectionWindows || currentSectionIndex === sectionWindows.length - 1;

  const remainingSec = sectionWindows && currentSectionIndex >= 0
    ? remainingSecFrom(sectionWindows[currentSectionIndex].endsAt, clockOffset, Date.now())
    : attempt?.expiresAt
    ? remainingSecFrom(attempt.expiresAt, clockOffset, Date.now())
    : 0;

  // Chỉ tự nộp TOÀN đề khi Phần đang hiển thị là Phần CUỐI (hoặc đề không
  // chia Phần) — hết giờ 1 Phần giữa chừng chỉ tự chuyển sang Phần kế tiếp
  // (suy ra lại từ currentSectionIndex mỗi giây qua nowTick, không cần state riêng).
  useEffect(() => {
    if (phase === "taking" && attempt?.expiresAt && isLastSection && remainingSec <= 0 && !autoSubmitted.current) {
      autoSubmitted.current = true;
      setTimeUp("sending");
      setPhase("timeup");
      submitAttempt();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, remainingSec, isLastSection]);

  const studentName = user?.name ?? "Học viên";

  // ── Loading / Error ──────────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div className="max-w-lg mx-auto flex justify-center py-20">
        <KinLoader size={44} />
      </div>
    );
  }

  if (phase === "error" || !exam) {
    // Phòng thi không có vỏ (thanh module) nên trang lỗi này từng là ngõ cụt: chỉ một dòng chữ, không đường đi đâu. Link cũ / đề đã xoá → có lối về danh sách đề.
    return (
      <div className="max-w-lg mx-auto text-center py-20 space-y-4">
        <p className="font-semibold" style={{ color: "var(--kin-tt-chu-loi)" }}>Không tìm thấy đề thi</p>
        <Link href="/student/thi-thu" className="inline-block text-sm font-semibold hover:underline" style={{ color: "var(--kin-nhan-link)" }}>← Về danh sách đề thi</Link>
      </div>
    );
  }

  // ── Hết giờ: đang xác nhận bài nộp (QZ-11) ───────────────────────────────────
  if (phase === "timeup" && attempt) {
    return (
      <div className="px-4 py-6">
        <QuizTimeUp examTitle={exam.title} attemptId={attempt.attemptId} state={timeUp} retrying={submitting} onRetry={retryTimeUp} />
      </div>
    );
  }

  // ── Done: show result ────────────────────────────────────────────────────────
  if (phase === "done" && myResult) {
    // Điểm chỉ hiện khi máy chủ trả điểm thật. Quiz có tự luận chưa công bố: màn "đã ghi nhận", không có điểm/hạng (không phải 0 điểm).
    const pending = !!myResult.pendingManual || myResult.score === null;
    const notice = submittedNotice({ hasEssay: pending, published: !pending }, !!submitInfo?.expired);
    const receiptTime = submitInfo?.submittedAt ? new Date(submitInfo.submittedAt).toLocaleString("vi-VN", { hour12: false }) : null;
    const canRetake = !exam.hasQuestions || gate?.canStart === true;
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold" style={{ color: "var(--kin-chu-chinh)" }}>{pending ? notice.heading : "Kết quả của bạn"}</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--kin-chu-mo)" }}>{exam.title}</p>
        </div>

        <div className="rounded-xl p-8 text-center"
          style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
          {pending ? (
            <div role="status" data-cho-cham className="text-left space-y-3">
              <p className="text-base font-semibold" style={{ color: "var(--kin-chu-chinh)" }}>Máy chủ KiN đã nhận bài của em</p>
              <p className="text-sm font-semibold" style={{ color: "var(--kin-tt-chu-cho)" }}>Chờ gia sư chấm</p>
              <p className="text-sm" style={{ color: "var(--kin-chu-phu)" }}>{notice.body}</p>
              {(submitInfo?.receipt || receiptTime) && (
                <p className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>
                  {submitInfo?.receipt && <>Mã lượt: <strong>{submitInfo.receipt}</strong></>}
                  {submitInfo?.receipt && receiptTime && " · "}
                  {receiptTime && <>Nhận lúc {receiptTime}</>}
                </p>
              )}
              {submitInfo?.receipt && <KinCopyButton text={submitInfo.receipt} label="Sao chép mã lượt" appearance="button" buttonVariant="secondary">Sao chép mã lượt</KinCopyButton>}
            </div>
          ) : (
            <>
              <div className="text-5xl font-bold mb-1" style={{ color: "var(--kin-nhan-link)" }}>
                {myResult.score}
                <span className="text-2xl" style={{ color: "var(--kin-chu-mo)" }}>/{myResult.totalPoints}</span>
              </div>
              {myResult.rank !== null && myResult.rank > 0 && (
                <p className="text-sm mt-1" style={{ color: "var(--kin-chu-mo)" }}>Hạng #{myResult.rank} trong bảng xếp hạng</p>
              )}
            </>
          )}
          <div className="grid grid-cols-2 gap-3 mt-6 text-left">
            {[
              { label: "Đề thi",    value: exam.code },
              { label: "Ngày thi",  value: exam.date },
              { label: "Thời gian", value: exam.duration },
              { label: "Số câu",    value: `${exam.questions} câu` },
            ].map(item => (
              <div key={item.label} className="rounded-xl p-3"
                style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)" }}>
                <p className="text-xs mb-0.5" style={{ color: "var(--kin-chu-mo)" }}>{item.label}</p>
                <p className="text-sm font-bold" style={{ color: "var(--kin-chu-phu)" }}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {exam.hasQuestions && reviewableAttemptId && (
          <button
            onClick={openReview}
            className="w-full py-3 min-h-11 rounded-lg text-sm font-semibold text-white"
            style={{ background: "var(--kin-nhan-nen)", borderRadius: "8px" }}>
            {pending ? "Xem lại câu trả lời của em" : "Xem lại bài làm"}
          </button>
        )}

        {canRetake ? (
          <button
            onClick={() => { setMyResult(null); setSubmitInfo(null); setPhase("ready"); setCountdown(5); setScore(""); }}
            className="w-full py-3 min-h-11 rounded-lg text-sm font-medium transition-colors hover:bg-[var(--kin-nen-bang)]"
            style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-chu-mo)", borderRadius: "8px" }}>
            Thi lại đề này
          </button>
        ) : gate && (
          <p className="text-xs text-center" style={{ color: "var(--kin-chu-mo)" }}>Em đã dùng hết số lượt làm bài của đề này ({gate.attempts.label.replace("Lượt ", "")} lượt).</p>
        )}
        <ExamExitLink />
      </div>
    );
  }

  // ── Review: xem lại bài làm sau khi nộp ──────────────────────────────────────
  if (phase === "review") {
    return (
      <div className="max-w-2xl mx-auto space-y-5 pb-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold" style={{ color: "var(--kin-chu-chinh)" }}>Xem lại bài làm</h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--kin-chu-mo)" }}>{exam.title}</p>
          </div>
          <button onClick={() => { setShowCorrection(false); setPhase("done"); }}
            className="text-sm font-semibold" style={{ color: "var(--kin-nhan-link)" }}>
            ← Quay lại kết quả
          </button>
        </div>

        {reviewLoading ? (
          <p className="text-sm text-center py-10" style={{ color: "var(--kin-chu-mo)" }}>Đang tải...</p>
        ) : reviewErr ? (
          <p className="text-sm text-center py-10" style={{ color: "var(--kin-tt-chu-loi)" }}>{reviewErr}</p>
        ) : reviewData && showCorrection ? (
          <CorrectionPanel attemptId={reviewData.attemptId} onClose={closeCorrection} />
        ) : reviewData ? (
          <>
            {(reviewData.correctableCount ?? 0) > 0 && (
              <div className="rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap" style={{ background: "var(--kin-nhan-nen-nhat)", border: "1px solid var(--kin-nhan-vien)" }}>
                <p className="text-sm" style={{ color: "var(--kin-nhan-chu-tren-nhat)" }}>
                  Bạn có <strong>{reviewData.correctableCount} câu</strong> làm chưa đúng. Chữa lại từng câu: gợi ý trước, đáp án sau.
                </p>
                <button type="button" onClick={() => setShowCorrection(true)} className="px-4 rounded-lg text-sm font-bold text-white min-h-[44px]" style={{ background: "var(--kin-nhan-nen)" }}>
                  Chữa lại các câu sai
                </button>
              </div>
            )}
            {reviewData.pendingManual && (
              <div role="status" data-cho-cong-bo className="rounded-xl p-3 text-xs" style={{ background: "var(--kin-tt-nen-cho)", border: "1px solid var(--kin-tt-vien-cho)", color: "var(--kin-tt-chu-cho)" }}>
                Gia sư chưa chấm xong và công bố kết quả bài này. Em chỉ xem được câu trả lời của chính mình; điểm, đáp án và lời giải sẽ hiện khi gia sư công bố.
              </div>
            )}
            {!reviewData.canSeeAnswers && !reviewData.pendingManual && (
              <div className="rounded-xl p-3 text-xs" style={{ background: "var(--kin-tt-nen-cho)", border: "1px solid var(--kin-tt-vien-cho)", color: "var(--kin-tt-chu-cho)" }}>
                Đề thi này chưa cho phép xem đáp án lúc này — chỉ hiện câu trả lời của bạn.
              </div>
            )}
            <div className="space-y-3">
              {reviewData.questions.map((q, idx) => {
                const prevSection = idx > 0 ? reviewData.questions[idx - 1].sectionLabel : undefined;
                const showSectionHeader = q.sectionLabel && q.sectionLabel !== prevSection;
                return (
                <Fragment key={q.id}>
                  {showSectionHeader && (
                    <p className="text-xs font-bold uppercase tracking-wide pt-2" style={{ color: "var(--kin-nhan-link)" }}>{q.sectionLabel}</p>
                  )}
                <div className="rounded-xl p-4" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
                  <p className="text-sm font-semibold mb-2" style={{ color: "var(--kin-chu-chinh)" }}>Câu {idx + 1}: <MathText text={q.text} /></p>

                  {q.type === "MC" && (
                    <div className="space-y-1.5">
                      {q.options.map(o => {
                        const isMine = o.id === q.studentOptionId;
                        const color = o.isCorrect === true ? "var(--kin-tt-chu-xong)" : o.isCorrect === false && isMine ? "var(--kin-tt-chu-loi)" : "var(--kin-chu-mo)";
                        return (
                          <div key={o.id} className="text-xs flex items-center gap-1.5" style={{ color }}>
                            {isMine && <strong>→</strong>} <MathText text={o.text} />
                            {o.isCorrect === true && " ✓"}
                          </div>
                        );
                      })}
                      {q.explanation && (
                        <p className="text-xs mt-1.5 p-2 rounded-lg" style={{ background: "var(--kin-nen-bang)", color: "var(--kin-chu-mo)" }}>
                          <strong>Giải thích:</strong> <MathText text={q.explanation} />
                        </p>
                      )}
                      {q.correctionPending && (
                        <p className="text-xs mt-1.5 p-2 rounded-lg" style={{ background: "var(--kin-tt-nen-cho)", color: "var(--kin-tt-chu-cho)" }}>
                          Câu này chưa chữa. Bấm <strong>Chữa lại các câu sai</strong> để thử trước — gợi ý sẽ hiện nếu chưa đúng, đáp án hiện sau khi bạn thử.
                        </p>
                      )}
                    </div>
                  )}

                  {q.type === "MC_MULTI" && (
                    <div className="space-y-1.5">
                      {q.options.map(o => (
                        <div key={o.id} className="text-xs flex items-center gap-1.5" style={{ color: o.isCorrect === true ? "var(--kin-tt-chu-xong)" : o.picked && o.isCorrect === false ? "var(--kin-tt-chu-loi)" : "var(--kin-chu-mo)" }}>
                          <strong>{o.picked ? "☑" : "☐"}</strong> <MathText text={o.text} />
                          {o.picked && " — bạn chọn"}
                          {o.isCorrect === true && " ✓ đáp án đúng"}
                        </div>
                      ))}
                      {q.explanation && (
                        <p className="text-xs mt-1.5 p-2 rounded-lg" style={{ background: "var(--kin-nen-bang)", color: "var(--kin-chu-mo)" }}>
                          <strong>Giải thích:</strong> <MathText text={q.explanation} />
                        </p>
                      )}
                    </div>
                  )}

                  {q.type === "TRUE_FALSE_CLUSTER" && (
                    <div className="space-y-1.5">
                      {q.options.map(o => (
                        <div key={o.id} className="text-xs flex items-center gap-1.5" style={{ color: "var(--kin-chu-phu)" }}>
                          <strong>{o.subLabel})</strong> <MathText text={o.text} />
                          <span style={{ color: "var(--kin-chu-mo)" }}>
                            — bạn chọn: {o.studentAnswerTrue === null ? "chưa trả lời" : o.studentAnswerTrue ? "Đúng" : "Sai"}
                          </span>
                          {o.isCorrect !== null && (
                            <span style={{ color: o.isCorrect === o.studentAnswerTrue ? "var(--kin-tt-chu-xong)" : "var(--kin-tt-chu-loi)" }}>
                              (đáp án đúng: {o.isCorrect ? "Đúng" : "Sai"})
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {q.type === "ESSAY" && (
                    <div>
                      <div className="text-sm p-3 rounded-lg mb-2" style={{ background: "var(--kin-nen-bang)", color: "var(--kin-chu-phu)" }}>
                        {q.textAnswer?.trim() ? q.textAnswer : <em style={{ color: "var(--kin-chu-mo)" }}>Bạn chưa trả lời</em>}
                      </div>
                      {q.pointsAwarded != null ? (
                        <div>
                          <p className="text-xs font-semibold" style={{ color: "var(--kin-tt-chu-xong)" }}>Điểm: {q.pointsAwarded}/{q.points}</p>
                          {q.teacherComment && <p className="text-xs mt-1" style={{ color: "var(--kin-chu-mo)" }}>Nhận xét: {q.teacherComment}</p>}
                        </div>
                      ) : (
                        <p className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>{reviewData.pendingManual ? "Chờ gia sư chấm và công bố" : "Chưa chấm"}</p>
                      )}
                    </div>
                  )}

                  {q.type === "SHORT_ANSWER" && (
                    <div className="text-xs space-y-1">
                      <p style={{ color: q.isCorrect ? "var(--kin-tt-chu-xong)" : "var(--kin-tt-chu-loi)" }}>
                        Bạn trả lời: <strong>{q.studentAnswer?.trim() || "chưa trả lời"}</strong>
                        {q.isCorrect === true && " ✓"}
                      </p>
                      {q.correctAnswer !== null && (
                        <p style={{ color: "var(--kin-chu-mo)" }}>Đáp án đúng: {q.correctAnswer}</p>
                      )}
                      {q.correctionPending && (
                        <p className="p-2 rounded-lg" style={{ background: "var(--kin-tt-nen-cho)", color: "var(--kin-tt-chu-cho)" }}>
                          Câu này chưa chữa. Bấm <strong>Chữa lại các câu sai</strong> để thử trước — đáp án hiện sau khi bạn thử.
                        </p>
                      )}
                    </div>
                  )}
                </div>
                </Fragment>
                );
              })}
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
          <h1 className="text-2xl font-extrabold" style={{ color: "var(--kin-chu-chinh)" }}>Nộp kết quả</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--kin-chu-mo)" }}>{exam.title}</p>
        </div>

        <div className="rounded-xl p-6"
          style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
          <div className="mb-4 p-3 rounded-xl" style={{ background: "var(--kin-tt-nen-xong)", border: "1px solid var(--kin-tt-vien-xong)" }}>
            <p className="text-sm font-semibold" style={{ color: "var(--kin-tt-chu-xong)" }}>
              Đã mở Azota. Sau khi hoàn thành bài thi, nhập điểm của bạn dưới đây.
            </p>
          </div>

          <label className="block text-sm font-semibold mb-2" style={{ color: "var(--kin-chu-chinh)" }}>
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
            style={{ borderColor: submitErr ? "var(--kin-tt-vien-loi)" : "var(--kin-vien-thuong)", background: "var(--kin-nen-trang)" }}
          />
          {submitErr && <p className="text-xs mb-3" style={{ color: "var(--kin-tt-chu-loi)" }}>{submitErr}</p>}

          <button
            onClick={submitScore}
            disabled={submitting || !scoreInput}
            className="w-full py-4 rounded-lg text-base font-bold text-white disabled:opacity-50"
            style={{ background: "var(--kin-nhan-nen)", borderRadius: "8px" }}>
            {submitting ? "Đang lưu..." : "Nộp kết quả"}
          </button>

          {exam.azotaUrl && (
            <a href={exam.azotaUrl} target="_blank" rel="noopener noreferrer"
              className="block text-center text-sm mt-3" style={{ color: "var(--kin-nhan-link)" }}>
              Mở lại Azota →
            </a>
          )}
        </div>
      </div>
    );
  }

  // ── Taking: render câu hỏi + sidebar trái sticky (đếm ngược, tiến độ, jump-grid) ──
  if (phase === "taking" && attempt?.questions) {
    // Đề dùng giờ riêng Phần: Phần chưa tới lượt ẨN HOÀN TOÀN (chỉ hiện Phần
    // đang làm + các Phần đã xong, khoá chỉ đọc) — đề không dùng giờ riêng
    // Phần (sectionWindows null) thì hiện toàn bộ như cũ, không đổi gì.
    const visibleSectionLabels = sectionWindows
      ? new Set(sectionWindows.slice(0, currentSectionIndex + 1).map(w => w.label))
      : null;
    const lockedSectionLabels = sectionWindows
      ? new Set(sectionWindows.slice(0, currentSectionIndex).map(w => w.label))
      : null;
    const visibleQuestions = visibleSectionLabels
      ? attempt.questions.filter(q => visibleSectionLabels.has(q.sectionLabel ?? null))
      : attempt.questions;

    // Giao diện làm bài theo Figma 27:2 nằm ở ExamRoomView; trang giữ logic (lưu đáp án, giờ từng Phần, rời tab, tự nộp).
    return (
      <ExamRoomView
        examTitle={exam.title}
        sectionLabels={sectionWindows ? sectionWindows.map(w => w.label) : null}
        sectionIndex={currentSectionIndex}
        questions={visibleQuestions}
        totalQuestions={attempt.questions.length}
        lockedLabels={lockedSectionLabels}
        remainingSec={remainingSec}
        tabLeaves={tabLeaves}
        selected={selected}
        essayText={essayText}
        clusterAnswers={clusterAnswers}
        isAnswered={isQuestionAnswered}
        onSelect={selectAnswer}
        onEssayChange={updateEssayAnswer}
        onEssaySave={saveEssayAnswer}
        draftStatus={draftStatus}
        onCluster={selectClusterAnswer}
        onSubmit={submitAttempt}
        submitting={submitting}
        error={startErr}
      />
    );
  }

  // ── Ready + Entering (default exam info view) ────────────────────────────────
  return (
    <div className="max-w-lg mx-auto space-y-6">
      <ExamExitLink />
      <div>
        <h1 className="text-2xl font-extrabold" style={{ color: "var(--kin-chu-chinh)" }}>Phòng thi</h1>
        <p className="text-sm mt-1" style={{ color: "var(--kin-chu-mo)" }}>
          {exam.azotaUrl ? "Chuyển hướng tới Azota để làm bài" : "Vào phòng thi"}
        </p>
      </div>

      <div className="rounded-xl p-6"
        style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>

        {/* Exam info */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center"
            style={{ background: "var(--kin-nhan-nen-nhat)", border: "1px solid var(--kin-nhan-vien)", color: "var(--kin-nhan-link)" }}>
            <ClipboardList size={28} />
          </div>
          <div>
            <h2 className="text-lg font-extrabold" style={{ color: "var(--kin-chu-chinh)" }}>{exam.title}</h2>
            <p className="text-sm" style={{ color: "var(--kin-chu-mo)" }}>{exam.date} · {exam.time}</p>
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
              style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)" }}>
              <p className="text-xs mb-1" style={{ color: "var(--kin-chu-mo)" }}>{item.label}</p>
              <p className="text-base font-bold" style={{ color: "var(--kin-nhan-link)" }}>{item.value}</p>
            </div>
          ))}
        </div>

        {/* Warning */}
        <div className="rounded-xl p-4 mb-5" style={{ background: "var(--kin-tt-nen-cho)", border: "1px solid var(--kin-tt-vien-cho)" }}>
          <p className="text-xs font-semibold flex items-center gap-1.5 mb-1" style={{ color: "var(--kin-tt-chu-cho)" }}>
            <AlertTriangle size={13} /> Lưu ý quan trọng
          </p>
          <p className="text-xs" style={{ color: "var(--kin-tt-chu-cho)" }}>
            Làm bài nghiêm túc như thi thật. Kết quả sẽ được ghi nhận và tính vào GPA tháng.
          </p>
        </div>

        {/* Log info */}
        <div className="rounded-xl p-3 mb-5"
          style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)" }}>
          <p className="text-xs font-semibold mb-1 flex items-center gap-1.5" style={{ color: "var(--kin-chu-mo)" }}>
            <Pin size={13} /> Thông tin ghi nhận
          </p>
          <div className="space-y-1">
            <p className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>• Thời gian: {new Date().toLocaleString("vi-VN")}</p>
            <p className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>• Học viên: {studentName}</p>
            <p className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>• Mã đề thi: {exam.code}</p>
          </div>
        </div>

        {/* Redirect button / Countdown */}
        {phase === "ready" ? (
          exam.hasQuestions ? (
            <QuizEntryGate gate={gate} loading={!gate && !gateErr} loadError={gateErr && !gate} onRetry={() => { setGateErr(false); loadGate(); }}
              password={examPassword} onPassword={setExamPassword} startError={startErr} starting={starting} onStart={startAttempt} />
          ) : !exam.azotaUrl ? (
            <div className="p-4 rounded-2xl text-center" style={{ background: "var(--kin-tt-nen-loi)", border: "1px solid var(--kin-tt-vien-loi)" }}>
              <p className="text-sm text-red-600 font-semibold">Đề thi chưa có link Azota</p>
              <p className="text-xs text-red-400 mt-1">Admin cần cập nhật Azota URL cho đề thi này.</p>
            </div>
          ) : (
            <button
              onClick={() => setPhase("entering")}
              className="w-full py-4 rounded-lg text-base font-bold text-white"
              style={{ background: "var(--kin-nhan-nen)", borderRadius: "8px" }}>
              ▶ Vào phòng thi ngay
            </button>
          )
        ) : (
          <div className="text-center">
            <div className="w-20 h-20 rounded-xl flex items-center justify-center mx-auto mb-4"
              style={{ background: "var(--kin-nhan-nen-nhat)", border: "1px solid var(--kin-nhan-vien)" }}>
              <span className="text-4xl font-extrabold" style={{ color: "var(--kin-nhan-link)" }}>{countdown}</span>
            </div>
            <p className="text-sm font-semibold" style={{ color: "var(--kin-chu-chinh)" }}>Đang chuyển hướng đến Azota...</p>
          </div>
        )}
      </div>

      {/* Rules */}
      <div className="rounded-xl p-5"
        style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: "var(--kin-chu-chinh)" }}>
          <ClipboardList size={16} /> Quy định phòng thi
        </h3>
        <ul className="space-y-2">
          {(exam.hasQuestions
            ? [
                "Hệ thống đếm số lần bạn rời khỏi tab khi làm bài. Không quay màn hình, không dùng camera.",
                "Không chụp ảnh màn hình hoặc chia sẻ đề thi",
                "Bài tự động nộp khi hết giờ",
              ]
            : [
                "Không thoát khỏi trang Azota trong khi làm bài",
                "Không chụp ảnh màn hình hoặc chia sẻ đề thi",
              ]
          ).map((rule, i) => (
            <li key={i} className="flex items-start gap-2 text-xs" style={{ color: "var(--kin-chu-phu)" }}>
              <span className="mt-0.5 flex-shrink-0" style={{ color: "var(--kin-tt-chu-loi)" }}>•</span>
              {rule}
            </li>
          ))}
        </ul>
      </div>

      {exam.hasQuestions && (exam.showLeaderboard ?? true) && leaderboard.length > 0 && (
        <div className="rounded-xl p-5" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
          <h3 className="text-sm font-bold mb-3" style={{ color: "var(--kin-chu-chinh)" }}>Bảng xếp hạng Top 10</h3>
          <div className="space-y-2">
            {leaderboard.map((row, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-5 text-xs font-bold" style={{ color: "var(--kin-chu-mo)" }}>{i + 1}</span>
                  <span style={{ color: "var(--kin-chu-phu)" }}>{row.user.name}</span>
                </div>
                <span className="font-bold" style={{ color: "var(--kin-nhan-link)" }}>{row.score}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {exam.hasQuestions && history.length > 0 && (
        <div className="rounded-xl p-5" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
          <h3 className="text-sm font-bold mb-3" style={{ color: "var(--kin-chu-chinh)" }}>Lịch sử làm bài</h3>
          <div className="space-y-2">
            {history.map(h => (
              <div key={h.id} className="flex items-center justify-between text-sm">
                <span style={{ color: "var(--kin-chu-mo)" }}>
                  {h.submittedAt ? new Date(h.submittedAt).toLocaleString("vi-VN") : "—"}
                  {h.status === "expired" && " (hết giờ)"}
                </span>
                {h.score === null
                  ? <span data-cho-gia-su className="text-xs font-semibold" style={{ color: "var(--kin-chu-mo)" }}>{h.held ? "Chờ gia sư chấm" : "Chưa có điểm"}</span>
                  : <span className="font-bold" style={{ color: "var(--kin-nhan-link)" }}>{h.score}/{exam.totalPoints}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
