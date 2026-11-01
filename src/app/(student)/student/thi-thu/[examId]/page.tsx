"use client";
// Phòng thi của học sinh (BU-04). Trang này CHỈ điều phối màn: cổng vào đề → làm bài → (hết giờ) → kết quả → xem lại/chữa bài.
// Mọi thứ vẽ nằm ở components/student/exam-room/*; mọi phán quyết (giờ mở/đóng, hết giờ, đáp án, điểm) là của máy chủ.
// [data-vung="phong-thi"] khoá màu nhấn về Navy cho MỌI màn bên trong: ô đáp án đang chọn mà tô màu chủ đề thầy cô thích (cổ vịt…) thì dễ bị đọc nhầm
// là "đáp án đúng", và phòng thi phải giống hệt nhau với mọi người (Figma 27:2, TK-168/174). Phòng thi KHÔNG có vỏ module — nên các màn trước/sau bài
// luôn có đường đi tiếp (không còn ngõ cụt: mở nhầm đề / nộp xong chỉ còn nút Back, 16/10/2026).
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import QuizTimeUp from "@/components/exam/QuizTimeUp";
import { KinButton } from "@/components/kin";
import { KinLoader } from "@/components/kin/KinLoader";
import AzotaFlow from "@/components/student/exam-room/AzotaFlow";
import ResultView from "@/components/student/exam-room/ResultView";
import ReviewScreen from "@/components/student/exam-room/ReviewScreen";
import RoomGate, { GATE_REASON } from "@/components/student/exam-room/RoomGate";
import TakingRoom from "@/components/student/exam-room/TakingRoom";
import { answersOpenLabel } from "@/components/student/exam-room/roomLogic";
import { useRoomPage } from "@/components/student/exam-room/useRoomPage";
import { useRoomSession } from "@/components/student/exam-room/useRoomSession";

const ExitLink = () => (
  <Link href="/student/thi-thu" className="inline-flex items-center min-h-11 text-sm font-semibold hover:underline" style={{ color: "var(--kin-nhan-link)" }}>← Về danh sách đề thi</Link>
);

export default function ExamEntryPage() {
  return (
    <div data-vung="phong-thi">
      <ExamRoomPage />
    </div>
  );
}

function ExamRoomPage() {
  const { examId } = useParams<{ examId: string }>();
  const d = useRoomPage(examId);
  const s = useRoomSession(examId);
  const [password, setPassword] = useState("");
  const { exam, phase, gate, myResult } = d;
  const mode = gate?.exam.mode ?? s.attempt?.mode ?? null;
  const reviewId = s.attempt?.attemptId ?? d.latestSubmitted;

  // Máy chủ đã trả biên nhận → sang màn kết quả; tải lại cổng (số lượt đã đổi), lịch sử, bảng xếp hạng và bài xem lại (để biết đáp án mở lúc nào).
  const submitted = s.result;
  useEffect(() => {
    if (!submitted || !s.attempt) return;
    d.setMyResult({ score: submitted.score, totalPoints: submitted.totalPoints, rank: submitted.rank, pendingManual: !!submitted.pendingManual });
    d.setPhase("done");
    void d.loadGate(); d.loadHistory(); void d.loadReview(s.attempt.attemptId, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted]);
  // Vào thẳng trang đã có kết quả: tải im lặng bài xem lại của lượt gần nhất.
  useEffect(() => {
    if (phase === "done" && !s.attempt && d.latestSubmitted) void d.loadReview(d.latestSubmitted, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, d.latestSubmitted]);

  async function begin() {
    if (await s.start(password)) d.setPhase("taking"); else void d.loadGate(); // số lượt/quyền/giờ mở có thể đã đổi
  }
  function again() { setPassword(""); s.setStartErr(""); d.setPhase("gate"); void d.loadGate(); }
  function openReview(attemptId?: string) { const id = attemptId ?? reviewId; if (!id) return; d.setPhase("review"); void d.loadReview(id); }

  const wrap = (children: React.ReactNode, narrow = true) => <div className="px-4 py-6"><div className={narrow ? "max-w-[480px] mx-auto" : ""}>{children}</div></div>;

  if (phase === "loading") return <div className="max-w-lg mx-auto flex justify-center py-20" role="status" aria-label="Đang tải phòng thi"><KinLoader size={44} /></div>;
  if (phase === "error" || !exam) {
    return wrap(
      <div className="text-center py-14 space-y-4">
        <p className="font-semibold" style={{ color: "var(--kin-tt-chu-loi)" }}>Không tìm thấy đề thi</p>
        <p className="text-sm" style={{ color: "var(--kin-chu-mo)" }}>Đề có thể đã bị gỡ, hoặc đường dẫn chưa đúng.</p>
        <div className="flex flex-col items-center gap-2"><KinButton variant="secondary" onClick={() => window.location.reload()}>Thử lại</KinButton><ExitLink /></div>
      </div>,
    );
  }

  if (phase === "taking" && s.attempt) {
    if (s.timeUp) {
      const saved = Object.values(s.textStatus).flatMap(x => (x.kind === "saved" ? [x.at] : [])).sort().at(-1) ?? null;
      return <div className="px-4 py-6"><QuizTimeUp examTitle={exam.title} attemptId={s.attempt.attemptId} state={s.timeUp} retrying={s.submitting} onRetry={s.retryTimeUp} klass={gate?.klass ?? null} sentAt={s.timeUpAt} lastServerSaveAt={saved} /></div>;
    }
    return <TakingRoom s={s} examTitle={exam.title} mode={mode} feedback={s.attempt.feedback ?? gate?.feedback ?? "instant"} />;
  }

  if (phase === "azota") return wrap(<AzotaFlow exam={exam} onDone={r => { d.setMyResult(r); d.setPhase("done"); }} />);

  if (phase === "gate") {
    return wrap(
      <div className="space-y-3">
        <ExitLink />
        <div className="rounded-xl p-5" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
          <RoomGate gate={gate} loading={!gate && !d.gateErr} loadError={d.gateErr && !gate} onRetry={() => { d.setGateErr(false); void d.loadGate(); }}
            password={password} onPassword={setPassword} startError={s.startErr} starting={s.starting} onStart={begin}
            hasResult={!!myResult} onViewResult={() => d.setPhase("done")} />
        </div>
      </div>,
    );
  }

  if (phase === "review") {
    return <div className="px-4 py-6"><ReviewScreen title={exam.title} data={d.review} loading={d.reviewLoading} error={d.reviewErr} onBack={() => d.setPhase("done")}
      onRetry={() => reviewId && void d.loadReview(reviewId)} onCorrectionClosed={() => reviewId && void d.loadReview(reviewId, true)} /></div>;
  }

  // ── kết quả ──
  const r = myResult ?? { score: null, totalPoints: exam.totalPoints, rank: null, pendingManual: false };
  const pending = !!r.pendingManual || r.score === null;
  const rv = d.review;
  const hasQ = exam.hasQuestions;
  const canRetake = hasQ ? gate?.canStart === true : true;
  const open = rv?.answersOpenAt ?? s.result?.answersOpenAt ?? null;
  const answersLine = pending || !hasQ ? null : rv ? (rv.canSeeAnswers ? null : open ? answersOpenLabel(open, new Date().toISOString()) : "Gia sư chưa cho xem đáp án ở đề này")
    : open ? answersOpenLabel(open, new Date().toISOString()) : null;
  const note = gate?.blockReason ? (gate.blockReason === "attempts_exhausted" ? `Em đã dùng hết số lượt làm bài của đề này (${gate.attempts.label.replace("Lượt ", "")} lượt).` : GATE_REASON[gate.blockReason].title) : null;
  const showRank = (rv?.exam?.showLeaderboard ?? exam.showLeaderboard ?? true) && !pending && mode !== "practice";
  return (
    <div className="px-4 py-6">
      <ResultView examTitle={exam.title} mode={mode} hasQuestions={hasQ} result={r} receipt={s.result?.receipt ?? ""} submittedAt={s.result?.submittedAt ?? null}
        expired={!!s.result?.expired} showRank={showRank} answersLine={answersLine} board={showRank ? d.board : []} history={d.history} totalPoints={exam.totalPoints}
        tiles={[{ label: "Đề thi", value: exam.code }, ...(mode === "practice" ? [] : [{ label: "Ngày thi", value: exam.date }]), { label: "Thời gian", value: exam.duration }, { label: "Số câu", value: `${exam.questions} câu` }]}
        canReview={hasQ && !!reviewId} onReview={openReview} canRetake={canRetake} retakeNote={note} onRetake={hasQ ? again : () => d.setPhase("azota")} />
    </div>
  );
}
