// Dữ liệu và chuyển màn của trang phòng thi: đề, kết quả sẵn có, cổng vào đề, lịch sử, bảng xếp hạng (chỉ điểm — không tên), bài xem lại.
// Phòng thi KHÔNG có vỏ; mọi màn (cổng, làm bài, hết giờ, kết quả, xem lại) nằm trong cùng khung data-vung="phong-thi" do trang bọc.
import { useCallback, useEffect, useRef, useState } from "react";
import { api, type ExamAttemptHistoryItem, type ExamFull } from "@/lib/api";
import { PUBLIC_EXAM_CLOSED_CODE } from "@/lib/features";
import { examRoomApi, type GateResponse, type ReviewResponse } from "@/lib/examRoomApi";

export type Phase = "loading" | "error" | "gate" | "azota" | "taking" | "done" | "review";
export interface MyResult { score: number | null; totalPoints: number; rank: number | null; pendingManual?: boolean }

export function useRoomPage(examId: string) {
  const [exam, setExam] = useState<ExamFull | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [gate, setGate] = useState<GateResponse | null>(null);
  const [gateErr, setGateErr] = useState(false);
  /** DG: máy chủ báo thi thử công khai đang đóng (cờ THI_THU_CONG_KHAI) — trang báo đúng lý do thay cho "Không tìm thấy đề". */
  const [publicClosed, setPublicClosed] = useState(false);
  const [myResult, setMyResult] = useState<MyResult | null>(null);
  const [history, setHistory] = useState<ExamAttemptHistoryItem[]>([]);
  const [board, setBoard] = useState<{ score: number }[]>([]);
  const [review, setReview] = useState<ReviewResponse | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewErr, setReviewErr] = useState("");
  const reviewFor = useRef<string | null>(null);

  const loadGate = useCallback(async (): Promise<GateResponse | null> => {
    const r = await examRoomApi.gate(examId);
    if (!r.ok) { setGateErr(true); return null; }
    setGate(r.data); setGateErr(false); return r.data;
  }, [examId]);

  /** Bỏ cổng cũ rồi nạp lại: sau khi nộp bài số lượt đã đổi, nên màn kết quả/nút "Làm lại" không được dùng `canStart` của lần nạp trước (cho tới khi có bản mới, nút tắt). */
  const refreshGate = useCallback(() => { setGate(null); return loadGate(); }, [loadGate]);

  const loadHistory = useCallback(() => {
    api.examAttempts.history(examId).then(setHistory).catch(() => {});
    fetch(`/api/exam-results?examId=${examId}`, { credentials: "same-origin" }).then(r => (r.ok ? r.json() : []))
      // chỉ lấy điểm: tên học sinh không bao giờ đi vào giao diện
      .then((rows: { score: number | null }[]) => setBoard(rows.filter(r => typeof r.score === "number").slice(0, 10).map(r => ({ score: r.score as number }))))
      .catch(() => {});
  }, [examId]);

  useEffect(() => {
    if (!examId) return;
    let live = true;
    (async () => {
      try {
        const [ex, mine] = await Promise.all([
          fetch(`/api/exams/${examId}`, { credentials: "same-origin" }).then(async r => {
            if (r.ok) return r.json() as Promise<ExamFull>;
            const body = await r.json().catch(() => null) as { code?: string } | null;
            if (body?.code === PUBLIC_EXAM_CLOSED_CODE) setPublicClosed(true);
            return null;
          }),
          fetch("/api/exam-results?mine=true", { credentials: "same-origin" }).then(r => (r.ok ? r.json() : [])) as Promise<(MyResult & { examId: string })[]>,
        ]);
        if (!live) return;
        if (!ex) { setPhase("error"); return; }
        setExam(ex);
        const existing = mine.find(r => r.examId === examId) ?? null;
        if (existing) setMyResult(existing);
        if (!ex.hasQuestions) { setPhase(existing ? "done" : "azota"); return; }
        const g = await loadGate();
        if (!live) return;
        // BU-04 rà soát: LUYỆN TẬP không bao giờ có ExamResult (không vào xếp hạng) nên "Xem kết quả" / tải lại trang rơi về cổng và mất kết quả.
        // Đề luyện tập đã có lượt nộp → dựng màn kết quả từ lượt nộp gần nhất (điểm tham khảo; giữ điểm → "chờ gia sư chấm").
        let practiceDone = false;
        if (!existing && g?.exam.mode === "practice" && !g.attempts.resumable && g.attempts.used > 0) {
          const h = await api.examAttempts.history(examId).catch(() => [] as ExamAttemptHistoryItem[]);
          if (!live) return;
          const last = h.find(x => x.status !== "in_progress");
          if (last) { setHistory(h); setMyResult({ score: last.held ? null : last.score, totalPoints: ex.totalPoints, rank: null, pendingManual: !!last.held }); practiceDone = true; }
        }
        loadHistory();
        setPhase((existing || practiceDone) && !g?.attempts.resumable ? "done" : "gate");
      } catch { if (live) setPhase("error"); }
    })();
    return () => { live = false; };
  }, [examId, loadGate, loadHistory]);

  const loadReview = useCallback(async (attemptId: string, silent = false) => {
    reviewFor.current = attemptId;
    if (!silent) { setReviewLoading(true); setReviewErr(""); }
    const r = await examRoomApi.review(attemptId);
    if (reviewFor.current === attemptId) {
      if (r.ok) setReview(r.data); else if (!silent) setReviewErr(r.error || "Không tải được bài làm");
    }
    if (!silent) setReviewLoading(false);
  }, []);

  /** Lượt có thể xem lại khi vào thẳng trang đã có kết quả: lượt đã nộp gần nhất trong lịch sử. */
  const latestSubmitted = history.find(h => h.status !== "in_progress")?.id ?? null;
  return { exam, phase, setPhase, publicClosed, gate, gateErr, setGateErr, loadGate, refreshGate, myResult, setMyResult, history, board, loadHistory, review, reviewLoading, reviewErr, loadReview, latestSubmitted };
}
