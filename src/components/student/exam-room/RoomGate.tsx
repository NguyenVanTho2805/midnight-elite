// Cổng vào đề (BU-04 mục 5.1): MỘT thẻ, MỘT nút. Chỉ dựng chữ từ /api/exams/[id]/gate (không có câu hỏi/đáp án); máy chủ vẫn kiểm lại ở /start.
// Nút khoá ở đây chỉ để khỏi bấm vô ích. Điện thoại: thẻ tràn lề 16px, nút cao 52px dính đáy.
"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { KinButton, KinCallout } from "@/components/kin";
import { clockOffsetMs } from "@/lib/quizRoom";
import { studentDeadlineText } from "@/lib/quizDeadline";
import type { RoomBlockReason, RoomGate as Gate } from "./roomApi";
import { countdownLabel, windowLabel } from "./roomLogic";

export const GATE_REASON: Record<RoomBlockReason, { title: string; body: string }> = {
  not_enrolled: { title: "Em chưa vào lớp của đề này", body: "Đề này dành cho học sinh trong lớp. Nhập mã lớp gia sư gửi để vào lớp, rồi quay lại làm bài." },
  payment_required: { title: "Đề này cần được gia sư mở quyền", body: "Hãy liên hệ gia sư của lớp để được mở quyền vào làm đề này." },
  attempts_exhausted: { title: "Em đã dùng hết số lượt làm bài", body: "Đề này giới hạn số lượt. Cần làm thêm thì hỏi gia sư." },
  past_deadline: { title: "Hạn nộp riêng của em đã qua", body: "Gia sư đã đặt hạn riêng cho em ở quiz này và hạn đó đã qua. Cần làm thêm thì hỏi gia sư." },
  no_questions: { title: "Đề chưa có câu hỏi", body: "Gia sư chưa soạn xong câu hỏi cho đề này." },
  not_open: { title: "Bài kiểm tra chưa mở", body: "Đến giờ mở, nút bên dưới sẽ bật. Máy chủ KiN quyết định giờ mở, không phải đồng hồ trên máy em." },
  closed: { title: "Bài đã đóng", body: "Khung giờ làm bài đã kết thúc nên không vào làm mới được nữa." },
};
const BUTTON_TEXT: Partial<Record<RoomBlockReason, string>> = { not_open: "Chưa đến giờ mở" };

export interface RoomGateProps {
  gate: Gate | null; loading: boolean; loadError: boolean; onRetry: () => void;
  password: string; onPassword: (v: string) => void; startError: string; starting: boolean; onStart: () => void;
  /** Em đã có bài nộp của đề này → hiện "Xem kết quả" ở các trạng thái khoá. */
  hasResult: boolean; onViewResult: () => void;
}

function OpensIn({ opensAt, serverNow, onDue }: { opensAt: string; serverNow: string; onDue: () => void }) {
  const [left, setLeft] = useState(() => Date.parse(opensAt) - Date.now() - clockOffsetMs(serverNow, Date.now()));
  useEffect(() => {
    const off = clockOffsetMs(serverNow, Date.now());
    const t = setInterval(() => setLeft(Date.parse(opensAt) - (Date.now() + off)), 1000);
    return () => clearInterval(t);
  }, [opensAt, serverNow]);
  const fired = useRef(false);
  useEffect(() => { if (left <= 0 && !fired.current) { fired.current = true; onDue(); } }, [left, onDue]); // máy chủ vẫn là nơi phán: chỉ nạp lại cổng một lần
  return <p role="timer" aria-label="Còn bao lâu nữa bài mở" className="text-[length:var(--kin-co-small)] font-semibold tabular-nums" style={{ color: "var(--kin-tt-chu-cho)" }}>Còn {countdownLabel(left)} nữa bài mở.</p>;
}

export default function RoomGate(p: RoomGateProps) {
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
  const mode = gate.exam.mode ?? null;
  const reason = gate.blockReason ? GATE_REASON[gate.blockReason] : null;
  const dueText = gate.deadline ? studentDeadlineText(new Date(gate.deadline.dueAt), new Date(gate.serverNow)) : null;
  const win = gate.window && gate.window.state !== "none" && gate.window.opensAt ? windowLabel(gate.window.opensAt, gate.window.closesAt) : null;
  const modeNote = mode === "practice" ? "Sai thì được gợi ý, làm lại ngay." : "Hết giờ hệ thống tự nộp.";
  return (
    <div className="flex flex-col gap-4" data-cong-vao-de>
      {mode && (
        <p className="self-start px-3 py-1 rounded-[var(--kin-bo-tron)] text-[length:var(--kin-co-caption)] font-semibold" data-che-do={mode}
          style={mode === "practice" ? { background: "var(--kin-nen-nhan)", color: "var(--kin-th-navy)" } : { border: "1px solid var(--kin-th-navy)", color: "var(--kin-th-navy)" }}>
          {mode === "practice" ? "Luyện tập" : "Kiểm tra"}
        </p>
      )}
      <div>
        <h1 className="text-[length:var(--kin-co-h2)] font-extrabold leading-tight" style={{ color: "var(--kin-chu-chinh)" }}>{gate.exam.title}</h1>
        {gate.klass && <p className="mt-1 text-sm" style={{ color: "var(--kin-chu-mo)" }}>{gate.klass.name}{gate.klass.tutorName ? ` · ${gate.klass.tutorName}` : ""}</p>}
      </div>
      <p className="text-sm font-semibold tabular-nums" style={{ color: "var(--kin-chu-phu)" }} data-so-luot>
        {gate.exam.questionCount} câu · {gate.exam.durationMinutes} phút · {gate.attempts.label}
      </p>
      {win && <p className="text-sm" style={{ color: "var(--kin-chu-phu)" }} data-khung-gio>{win}</p>}
      <ul className="text-xs flex flex-col gap-1" style={{ color: "var(--kin-chu-phu)" }}>
        {dueText && <li data-han-rieng><strong>{dueText}.</strong></li>}
        <li>{modeNote}</li>
        <li>Đồng hồ chạy theo giờ máy chủ KiN, không theo đồng hồ trên máy em.</li>
        {gate.exam.hasEssay && <li>Có câu tự luận: gia sư chấm sau. Điểm tổng, đáp án và lời giải chỉ hiện khi gia sư công bố.</li>}
        {gate.attempts.resumable && <li><strong>Em đang có một lượt làm dở, bấm tiếp tục để quay lại đúng chỗ.</strong></li>}
      </ul>

      {reason && (
        <KinCallout title={reason.title}>
          <p>{reason.body}</p>
          {gate.blockReason === "not_open" && gate.window?.opensAt && <div className="mt-1"><OpensIn opensAt={gate.window.opensAt} serverNow={gate.serverNow} onDue={p.onRetry} /></div>}
          {gate.blockReason === "not_enrolled" && (
            <Link href="/student/nhap-ma-lop" className="inline-flex items-center min-h-11 mt-1 font-semibold underline" style={{ color: "var(--kin-nhan-link)" }}>Nhập mã lớp</Link>
          )}
          {p.hasResult && (gate.blockReason === "closed" || gate.blockReason === "attempts_exhausted" || gate.blockReason === "past_deadline") && (
            <KinButton variant="secondary" className="mt-2" onClick={p.onViewResult}>Xem kết quả</KinButton>
          )}
        </KinCallout>
      )}

      {!reason && gate.exam.hasPassword && !gate.attempts.resumable && (
        <label className="flex flex-col gap-1 text-sm font-semibold" style={{ color: "var(--kin-chu-chinh)" }}>
          Mật khẩu vào đề
          <input type="password" autoComplete="off" value={p.password} onChange={e => p.onPassword(e.target.value)} placeholder="Hỏi gia sư để lấy mật khẩu"
            className="w-full px-4 min-h-12 rounded-lg text-sm border-2 outline-none font-normal" style={{ borderColor: "var(--kin-vien-thuong)" }} />
        </label>
      )}

      <div className="sticky bottom-0 -mx-5 px-5 py-3 sm:static sm:m-0 sm:p-0" style={{ background: "var(--kin-nen-trang)" }}>
        <KinButton variant="primary" size="lg" block className="min-h-[52px]" disabled={!gate.canStart || p.starting} loading={p.starting} loadingLabel="Đang vào phòng…" onClick={p.onStart}>
          {(gate.blockReason && BUTTON_TEXT[gate.blockReason]) || (gate.attempts.resumable ? "Tiếp tục làm bài" : "Bắt đầu làm bài")}
        </KinButton>
        {p.startError && <p role="alert" className="mt-2 text-xs text-center" style={{ color: "var(--kin-tt-chu-loi)" }}>{p.startError}</p>}
      </div>
    </div>
  );
}
