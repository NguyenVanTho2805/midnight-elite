// Một câu một khối: viền 1px, bo 12px, số câu + điểm, đề (MathText + ảnh), ô trả lời, "Đánh dấu xem lại" cao 44px; luyện tập thêm "Kiểm tra câu này".
"use client";
import { MathText } from "@/components/MathText";
import { KinButton } from "@/components/kin";
import type { ExamQuestionPublic } from "@/lib/api";
import type { DraftState } from "@/lib/quizRoom";
import AnswerInputs, { type Reveal } from "./AnswerInputs";
import PracticeFeedback from "./PracticeFeedback";
import type { CheckResult } from "./roomApi";

export interface PracticeProps {
  /** "none" = đề giữ điểm tới khi công bố: không có nút kiểm tra. */
  feedback: "instant" | "none"; result: CheckResult | null; loading: boolean; error: string;
  onCheck: () => void; onRetry: () => void; onReveal: () => void; onNext: () => void; isLast: boolean;
}
export interface QuestionBlockProps {
  q: ExamQuestionPublic; index: number; locked: boolean; answered: boolean; flagged: boolean;
  selected?: string; text: string; cluster: Record<string, boolean | null>; textStatus?: DraftState;
  onSelect: (oid: string) => void; onBool: (oid: string, v: boolean) => void; onText: (t: string) => void; onBlur: () => void; onFlag: () => void;
  practice?: PracticeProps;
}

function revealOf(r: CheckResult | null): Reveal | null {
  if (!r?.answer) return null;
  return { correctIds: new Set(r.answer.correctOptionIds), truths: new Map(r.answer.clusterTruths.map(t => [t.optionId, t.isTrue])), correctText: r.answer.correctText };
}

export default function QuestionBlock(p: QuestionBlockProps) {
  const { q, practice: pr } = p;
  const done = pr?.result?.state === "solved" || pr?.result?.state === "revealed";
  const lockedNow = p.locked || done;
  return (
    <section id={`q-${q.id}`} data-cau={p.index} aria-labelledby={`q-${q.id}-de`} className="scroll-mt-4 rounded-[var(--kin-bo-xl)] px-4 py-4 sm:px-5"
      style={{ border: "1px solid var(--kin-vien-thuong)", background: "var(--kin-nen-trang)", opacity: p.locked ? 0.6 : undefined }}>
      {typeof q.points === "number" && <p className="mb-1 text-right text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)] tabular-nums">{q.points} điểm</p>}
      <h2 id={`q-${q.id}-de`} className="text-[length:var(--kin-co-body)] font-semibold leading-relaxed text-[var(--kin-chu-chinh)] mb-3">
        Câu {p.index + 1}. <MathText text={q.text} />
      </h2>
      {p.locked && <p className="text-[length:var(--kin-co-small)] font-semibold mb-2" style={{ color: "var(--kin-tt-chu-loi)" }}>Đã hết giờ Phần này — không thể sửa câu trả lời.</p>}
      {q.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={q.imageUrl} alt={`Hình minh hoạ câu ${p.index + 1}`} className="max-w-full rounded-[var(--kin-bo-md)] mb-3" />
      )}
      <AnswerInputs q={q} locked={lockedNow} selected={p.selected} text={p.text} cluster={p.cluster} textStatus={p.textStatus}
        onSelect={p.onSelect} onBool={p.onBool} onText={p.onText} onBlur={p.onBlur} reveal={revealOf(pr?.result ?? null)} />

      {pr && pr.feedback === "instant" && q.type !== "ESSAY" && !pr.result && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <KinButton variant="secondary" disabled={!p.answered || pr.loading} loading={pr.loading} loadingLabel="Đang kiểm tra…" onClick={pr.onCheck}>Kiểm tra câu này</KinButton>
          {!p.answered && <p className="text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)]">Chọn hoặc nhập đáp án trước khi kiểm tra.</p>}
        </div>
      )}
      {pr && <PracticeFeedback result={pr.result} loading={false} error={pr.error} isCluster={q.type === "TRUE_FALSE_CLUSTER"} isLast={pr.isLast}
        onRetry={pr.onRetry} onReveal={pr.onReveal} onNext={pr.onNext} />}
      {pr?.feedback === "none" && q.type !== "ESSAY" && <p className="mt-3 text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)]">Đáp án mở sau khi gia sư công bố.</p>}

      <div className="mt-4">
        <button type="button" onClick={p.onFlag} aria-pressed={p.flagged} data-danh-dau-nut
          className="inline-flex items-center gap-2 min-h-11 px-3 rounded-[var(--kin-bo-md)] text-[length:var(--kin-co-small)] font-semibold hover:bg-[var(--kin-nen-re-chuot)] focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)]"
          style={{ border: "1px solid var(--kin-vien-o-nhap)", color: p.flagged ? "var(--kin-tt-chu-cho)" : "var(--kin-chu-phu)", background: p.flagged ? "var(--kin-tt-nen-cho)" : "var(--kin-nen-trang)" }}>
          <span aria-hidden>{p.flagged ? "☑" : "☐"}</span>{p.flagged ? "Đã đánh dấu xem lại" : "Đánh dấu xem lại"}
        </button>
      </div>
    </section>
  );
}
