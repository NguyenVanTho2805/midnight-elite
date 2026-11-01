// Chân trang cố định: CHỈ hai nút Câu trước / Câu sau (nộp bài nằm ở khối riêng, tránh bấm nhầm khi đang bấm Câu sau).
"use client";
import { KinButton } from "@/components/kin";

export default function RoomFooter({ index, last, onPrev, onNext }: { index: number; last: number; onPrev: () => void; onNext: () => void }) {
  return (
    <footer className="flex-shrink-0 h-16 px-4 flex items-center justify-center gap-3" style={{ background: "var(--kin-nen-bang)", borderTop: "1px solid var(--kin-vien-thuong)" }}>
      <div className="w-full max-w-[680px] flex gap-3">
        <KinButton variant="secondary" onClick={onPrev} disabled={index <= 0} className="flex-1 min-h-12">‹ Câu trước</KinButton>
        <KinButton variant="primary" onClick={onNext} disabled={index >= last} className="flex-1 min-h-12">Câu sau ›</KinButton>
      </div>
    </footer>
  );
}
