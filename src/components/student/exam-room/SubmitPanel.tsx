// "Nộp bài" tách riêng khỏi Câu trước / Câu sau. Bấm → hộp xác nhận nói rõ còn bao nhiêu câu chưa làm và bao nhiêu câu đánh dấu xem lại.
// Hết giờ thì hệ thống tự nộp, không qua hộp này. `variant` chỉ để bài test chọn đúng khối (bảng bên phải / cuối danh sách / tờ trượt).
"use client";
import { useState } from "react";
import { KinButton, KinConfirm } from "@/components/kin";
import { submitConfirmMessage, type UnansweredItem } from "@/lib/quizRoom";

export interface SubmitPanelProps {
  variant: "bang" | "cuoi" | "to";
  unanswered: UnansweredItem[]; flaggedCount: number; hasEssay: boolean; hiddenUnopened: number;
  answered: number; total: number; submitting: boolean; error?: string; onSubmit: () => void | Promise<void>;
  /** Ghi chú đúng sự thật khi hết giờ (đề chia Phần: "Hết giờ Phần 1 thì…"). */
  timeUpNote?: string;
}

export default function SubmitPanel(p: SubmitPanelProps) {
  const [open, setOpen] = useState(false);
  const flagNote = p.flaggedCount > 0 ? ` Em còn ${p.flaggedCount} câu đánh dấu xem lại.` : "";
  return (
    <section data-nop-bai={p.variant} aria-label="Nộp bài" className={p.variant === "cuoi" ? "mt-2 pt-8 border-t border-[var(--kin-vien-thuong)]" : "pt-4 border-t border-[var(--kin-vien-thuong)]"}>
      <p className="text-[length:var(--kin-co-small)] font-semibold text-[var(--kin-chu-chinh)] tabular-nums">Đã làm {p.answered} / {p.total}</p>
      {p.timeUpNote && <p className="mt-0.5 text-[length:var(--kin-co-caption)]" style={{ color: "var(--kin-tt-chu-cho)" }}>{p.timeUpNote}</p>}
      {p.error && <p role="alert" className="mt-1 text-[length:var(--kin-co-small)] font-semibold" style={{ color: "var(--kin-tt-chu-loi)" }}>{p.error}</p>}
      <KinButton variant="secondary" block className="mt-3" disabled={p.submitting} onClick={() => setOpen(true)}>Nộp bài</KinButton>
      <KinConfirm open={open} tone="nguy-hiem" title="Nộp bài ngay?"
        message={<span data-xac-nhan-nop>{submitConfirmMessage(p.unanswered, p.hasEssay, p.hiddenUnopened)}{flagNote}</span>}
        confirmLabel="Nộp bài" cancelLabel="Làm tiếp" loading={p.submitting} loadingLabel="Đang nộp…"
        onConfirm={async () => { await p.onSubmit(); setOpen(false); }} onCancel={() => setOpen(false)} />
    </section>
  );
}
