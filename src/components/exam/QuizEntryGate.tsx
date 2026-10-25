// Cổng vào đề (QZ-11, Figma 464:8063): trước khi bấm bắt đầu em thấy đề thuộc lớp nào, dài bao lâu, có tự luận không, còn mấy lượt, và vì sao CHƯA vào được.
// Chỉ dựng chữ từ /api/exams/[id]/gate (không có câu hỏi/đáp án). Máy chủ vẫn kiểm lại ở /start; nút bị khoá ở đây chỉ để khỏi bấm vô ích.
"use client";
import Link from "next/link";
import type { ExamGate } from "@/lib/api";
import { KinButton, KinCallout } from "@/components/kin";
import { studentDeadlineText } from "@/lib/quizDeadline";

const REASON: Record<NonNullable<ExamGate["blockReason"]>, { title: string; body: string }> = {
  not_enrolled: { title: "Em chưa vào lớp của đề này", body: "Đề này dành cho học sinh trong lớp. Nhập mã lớp gia sư gửi để vào lớp, rồi quay lại làm bài." },
  payment_required: { title: "Đề này cần được gia sư mở quyền", body: "Hãy liên hệ gia sư của lớp để được mở quyền vào làm đề này." },
  attempts_exhausted: { title: "Em đã dùng hết số lượt làm bài", body: "Đề này giới hạn số lượt. Cần làm thêm thì hỏi gia sư." },
  past_deadline: { title: "Hạn nộp riêng của em đã qua", body: "Gia sư đã đặt hạn riêng cho em ở quiz này và hạn đó đã qua. Cần làm thêm thì hỏi gia sư." },
  no_questions: { title: "Đề chưa có câu hỏi", body: "Gia sư chưa soạn xong câu hỏi cho đề này." },
};

export interface QuizEntryGateProps {
  gate: ExamGate | null;
  loading: boolean;
  loadError: boolean;
  onRetry: () => void;
  password: string;
  onPassword: (v: string) => void;
  startError: string;
  starting: boolean;
  onStart: () => void;
}

export default function QuizEntryGate(p: QuizEntryGateProps) {
  const { gate } = p;
  if (p.loading) return <p role="status" className="text-sm text-center py-4" style={{ color: "var(--kin-chu-mo)" }}>Đang kiểm tra quyền vào đề…</p>;
  if (p.loadError || !gate) {
    return (
      <div role="alert" className="flex flex-col gap-3">
        <p className="text-sm font-semibold" style={{ color: "var(--kin-tt-chu-loi)" }}>Chưa kiểm tra được quyền vào đề. Kiểm tra kết nối rồi thử lại.</p>
        <KinButton variant="secondary" onClick={p.onRetry}>Thử lại</KinButton>
      </div>
    );
  }
  const reason = gate.blockReason ? REASON[gate.blockReason] : null;
  const dueText = gate.deadline ? studentDeadlineText(new Date(gate.deadline.dueAt), new Date(gate.serverNow)) : null;
  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-3 text-sm">
        {gate.klass && (
          <div className="col-span-2 rounded-xl p-3" style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)" }}>
            <dt className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>Lớp</dt>
            <dd className="font-bold" style={{ color: "var(--kin-chu-chinh)" }}>{gate.klass.name}{gate.klass.tutorName ? ` · ${gate.klass.tutorName}` : ""}</dd>
          </div>
        )}
        <div className="rounded-xl p-3" style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)" }}>
          <dt className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>Thời gian</dt>
          <dd className="font-bold" style={{ color: "var(--kin-chu-chinh)" }}>{gate.exam.durationMinutes} phút</dd>
        </div>
        <div className="rounded-xl p-3" style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)" }}>
          <dt className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>Số lượt</dt>
          <dd className="font-bold" style={{ color: "var(--kin-chu-chinh)" }} data-so-luot>{gate.attempts.label}</dd>
        </div>
      </dl>

      <ul className="text-xs flex flex-col gap-1" style={{ color: "var(--kin-chu-phu)" }}>
        {dueText && <li data-han-rieng><strong>{dueText}.</strong></li>}
        <li>Đồng hồ chạy theo giờ máy chủ KiN, không theo đồng hồ trên máy em.</li>
        <li>Bài tự lưu nháp khi em làm; hết giờ KiN tự nộp.</li>
        {gate.exam.hasEssay && <li>Có câu tự luận: gia sư chấm sau. Điểm tổng, đáp án và lời giải chỉ hiện khi gia sư công bố.</li>}
        {gate.attempts.resumable && <li><strong>Em đang có một lượt làm dở, bấm tiếp tục để quay lại đúng chỗ.</strong></li>}
      </ul>

      {reason && (
        <KinCallout title={reason.title}>
          <p>{reason.body}</p>
          {gate.blockReason === "not_enrolled" && (
            <Link href="/student/nhap-ma-lop" className="inline-flex items-center min-h-11 mt-1 font-semibold underline" style={{ color: "var(--kin-nhan-link)" }}>Nhập mã lớp</Link>
          )}
        </KinCallout>
      )}

      {!reason && gate.exam.hasPassword && !gate.attempts.resumable && (
        <label className="flex flex-col gap-1 text-sm font-semibold" style={{ color: "var(--kin-chu-chinh)" }}>
          Mật khẩu vào đề
          <input type="password" autoComplete="off" value={p.password} onChange={e => p.onPassword(e.target.value)} placeholder="Hỏi gia sư để lấy mật khẩu"
            className="w-full px-4 min-h-11 rounded-lg text-sm border-2 outline-none font-normal" style={{ borderColor: "var(--kin-vien-thuong)" }} />
        </label>
      )}

      <KinButton variant="primary" size="lg" block disabled={!gate.canStart || p.starting} loading={p.starting} loadingLabel="Đang vào phòng…" onClick={p.onStart}>
        {gate.attempts.resumable ? "Tiếp tục làm bài" : "Bắt đầu làm bài"}
      </KinButton>
      {p.startError && <p role="alert" className="text-xs text-center" style={{ color: "var(--kin-tt-chu-loi)" }}>{p.startError}</p>}
    </div>
  );
}
