// Kết quả sau khi nộp (BU-04 mục 5.4): điểm lớn hoặc "Chờ gia sư chấm" (không bao giờ 0 giả), nhãn luyện tập, mã biên nhận, khi nào đáp án mở,
// Xem lại bài làm / Làm lại (nút tắt có lý do). Hạng chỉ hiện khi bảng xếp hạng bật và điểm đã được phép hiện; KHÔNG hiện tên ai.
"use client";
import Link from "next/link";
import { KinButton, KinCopyButton } from "@/components/kin";
import type { ExamAttemptHistoryItem } from "@/lib/api";
import { submittedNotice } from "@/lib/quizRoom";
import type { ExamMode } from "./roomApi";

export interface ResultViewProps {
  examTitle: string; mode: ExamMode; hasQuestions: boolean;
  result: { score: number | null; totalPoints: number; rank: number | null; pendingManual?: boolean };
  receipt: string; submittedAt: string | null; expired: boolean;
  tiles: { label: string; value: string }[];
  showRank: boolean; answersLine: string | null;
  canReview: boolean; onReview: (attemptId?: string) => void;
  canRetake: boolean; retakeNote: string | null; onRetake: () => void;
  board: { score: number }[]; history: ExamAttemptHistoryItem[]; totalPoints: number;
}

export default function ResultView(p: ResultViewProps) {
  const pending = !!p.result.pendingManual || p.result.score === null;
  const practice = p.mode === "practice";
  const notice = submittedNotice({ hasEssay: pending, published: !pending }, p.expired);
  const at = p.submittedAt ? new Date(p.submittedAt).toLocaleString("vi-VN", { hour12: false }) : null;
  return (
    <div className="max-w-[680px] mx-auto space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-extrabold" style={{ color: "var(--kin-chu-chinh)" }}>{pending ? notice.heading : "Kết quả của bạn"}</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--kin-chu-mo)" }}>{p.examTitle}</p>
      </div>
      <div className="rounded-xl p-6 sm:p-8" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
        {pending ? (
          <div role="status" data-cho-cham className="space-y-3">
            <p className="text-base font-semibold" style={{ color: "var(--kin-chu-chinh)" }}>Máy chủ KiN đã nhận bài của em</p>
            <p className="text-sm font-semibold" style={{ color: "var(--kin-tt-chu-cho)" }}>Chờ gia sư chấm</p>
            <p className="text-sm" style={{ color: "var(--kin-chu-phu)" }}>{notice.body}</p>
          </div>
        ) : (
          <div className="text-center" data-diem>
            {practice && <p className="text-sm font-semibold mb-1" style={{ color: "var(--kin-chu-phu)" }}>Điểm luyện tập · để tham khảo, không vào bảng xếp hạng</p>}
            <div className="text-5xl font-bold mb-1 tabular-nums" style={{ color: "var(--kin-nhan-link)" }}>
              {p.result.score}<span className="text-2xl" style={{ color: "var(--kin-chu-mo)" }}>/{p.result.totalPoints}</span>
            </div>
            {p.showRank && p.result.rank !== null && p.result.rank > 0 && <p className="text-sm mt-1" style={{ color: "var(--kin-chu-mo)" }}>Hạng #{p.result.rank} trong bảng xếp hạng</p>}
          </div>
        )}
        {(p.receipt || at) && (
          <p className="mt-4 text-xs" style={{ color: "var(--kin-chu-mo)" }}>
            {p.receipt && <>Mã lượt: <strong>{p.receipt}</strong></>}{p.receipt && at && " · "}{at && <>Nhận lúc {at}</>}
          </p>
        )}
        {p.receipt && <div className="mt-2"><KinCopyButton text={p.receipt} label="Sao chép mã lượt" appearance="button" buttonVariant="secondary">Sao chép mã lượt</KinCopyButton></div>}
        {p.answersLine && <p className="mt-4 text-sm font-semibold" style={{ color: "var(--kin-chu-phu)" }} data-dap-an-mo>{p.answersLine}</p>}
        <dl className="grid grid-cols-2 gap-3 mt-6">
          {p.tiles.map(t => (
            <div key={t.label} className="rounded-xl p-3" style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)" }}>
              <dt className="text-xs mb-0.5" style={{ color: "var(--kin-chu-mo)" }}>{t.label}</dt>
              <dd className="text-sm font-bold" style={{ color: "var(--kin-chu-phu)" }}>{t.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        {p.canReview && <KinButton variant="primary" block className="min-h-12" onClick={() => p.onReview()}>{pending ? "Xem lại câu trả lời của em" : "Xem lại bài làm"}</KinButton>}
        <KinButton variant="secondary" block className="min-h-12" disabled={!p.canRetake} onClick={p.onRetake}>Làm lại</KinButton>
      </div>
      {p.retakeNote && !p.canRetake && <p className="text-xs text-center" style={{ color: "var(--kin-chu-mo)" }}>{p.retakeNote}</p>}

      {p.board.length > 0 && (
        <section className="rounded-xl p-5" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
          <h2 className="text-sm font-bold mb-3" style={{ color: "var(--kin-chu-chinh)" }}>Bảng xếp hạng Top 10 (ẩn danh)</h2>
          <ol className="space-y-2">
            {p.board.map((row, i) => (
              <li key={i} className="flex items-center justify-between text-sm"><span style={{ color: "var(--kin-chu-phu)" }}>Hạng #{i + 1}</span><span className="font-bold tabular-nums" style={{ color: "var(--kin-nhan-link)" }}>{row.score}</span></li>
            ))}
          </ol>
        </section>
      )}
      {p.hasQuestions && p.history.length > 0 && (
        <section className="rounded-xl p-5" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
          <h2 className="text-sm font-bold mb-2" style={{ color: "var(--kin-chu-chinh)" }}>Các lượt đã làm</h2>
          <ul>
            {p.history.map(h => (
              <li key={h.id} className="flex items-center justify-between gap-3 text-sm min-h-11">
                <span style={{ color: "var(--kin-chu-mo)" }}>{h.submittedAt ? new Date(h.submittedAt).toLocaleString("vi-VN") : "Đang làm dở"}{h.status === "expired" && " (hết giờ)"}</span>
                <span className="flex items-center gap-3">
                  {h.score === null ? <span data-cho-gia-su className="text-xs font-semibold" style={{ color: "var(--kin-chu-mo)" }}>{h.held ? "Chờ gia sư chấm" : "Chưa có điểm"}</span> : <span className="font-bold tabular-nums" style={{ color: "var(--kin-nhan-link)" }}>{h.score}/{p.totalPoints}</span>}
                  {h.submittedAt && <button type="button" onClick={() => p.onReview(h.id)} className="min-h-11 px-2 underline text-xs" style={{ color: "var(--kin-nhan-link)" }}>Xem lại</button>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <Link href="/student/thi-thu" className="inline-flex items-center min-h-11 text-sm font-semibold hover:underline" style={{ color: "var(--kin-nhan-link)" }}>← Về danh sách đề thi</Link>
    </div>
  );
}
