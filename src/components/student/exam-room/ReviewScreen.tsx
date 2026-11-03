// Màn "Xem lại bài làm" + Chữa bài (NV-188). Ba trạng thái: đang tải, lỗi (+ Thử lại), không có gì cần chữa (nói rõ lý do).
// Khi nào đáp án mở lấy từ `answersOpenAt` của /review; không có thì nói thẳng "gia sư chưa cho xem đáp án".
"use client";
import { useState } from "react";
import CorrectionPanel from "@/components/exam/CorrectionPanel";
import { KinButton } from "@/components/kin";
import ReviewList from "./ReviewList";
import type { ReviewResponse } from "@/lib/examRoomApi";
import { answersLockedNotice } from "./answersLocked";

export interface ReviewScreenProps {
  title: string; data: ReviewResponse | null; loading: boolean; error: string;
  onBack: () => void; onRetry: () => void; onCorrectionClosed: () => void;
}

export default function ReviewScreen(p: ReviewScreenProps) {
  const [fixing, setFixing] = useState(false);
  const d = p.data;
  return (
    <div className="max-w-[680px] mx-auto space-y-5 pb-10">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold" style={{ color: "var(--kin-chu-chinh)" }}>Xem lại bài làm</h1>
          <p className="text-sm mt-0.5 truncate" style={{ color: "var(--kin-chu-mo)" }}>{p.title}</p>
        </div>
        <KinButton variant="ghost" onClick={p.onBack}>← Quay lại kết quả</KinButton>
      </div>

      {p.loading ? <p role="status" className="text-sm text-center py-10" style={{ color: "var(--kin-chu-mo)" }}>Đang tải bài làm…</p>
        : p.error ? (
          <div role="alert" className="text-center py-10 space-y-3">
            <p className="text-sm" style={{ color: "var(--kin-tt-chu-loi)" }}>{p.error}</p>
            <KinButton variant="secondary" onClick={p.onRetry}>Thử lại</KinButton>
          </div>
        ) : d && fixing ? <CorrectionPanel attemptId={d.attemptId} onClose={() => { setFixing(false); p.onCorrectionClosed(); }} />
        : d ? (
          <>
            {(d.correctableCount ?? 0) > 0 && (
              <div className="rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap" style={{ background: "var(--kin-nhan-nen-nhat)", border: "1px solid var(--kin-nhan-vien)" }}>
                <p className="text-sm" style={{ color: "var(--kin-nhan-chu-tren-nhat)" }}>Bạn có <strong>{d.correctableCount} câu</strong> làm chưa đúng. Chữa lại từng câu: gợi ý trước, đáp án sau.</p>
                <KinButton variant="primary" onClick={() => setFixing(true)}>Chữa lại các câu sai</KinButton>
              </div>
            )}
            {d.canSeeAnswers && !d.pendingManual && d.correctableCount === 0 && (
              <p className="rounded-xl p-3 text-xs" style={{ background: "var(--kin-tt-nen-xong)", color: "var(--kin-tt-chu-xong)" }} data-khong-can-chua>Không có câu nào cần chữa lại.</p>
            )}
            {d.pendingManual && (
              <div role="status" data-cho-cong-bo className="rounded-xl p-3 text-xs" style={{ background: "var(--kin-tt-nen-cho)", border: "1px solid var(--kin-tt-vien-cho)", color: "var(--kin-tt-chu-cho)" }}>
                Gia sư chưa chấm xong và công bố kết quả bài này. Em chỉ xem được câu trả lời của chính mình; điểm, đáp án và lời giải sẽ hiện khi gia sư công bố.
              </div>
            )}
            {(() => {
              const notice = answersLockedNotice(d, new Date().toISOString());
              return notice ? (
                <div role="status" className="rounded-xl p-3 text-xs" style={{ background: "var(--kin-tt-nen-cho)", border: "1px solid var(--kin-tt-vien-cho)", color: "var(--kin-tt-chu-cho)" }} data-dap-an-chua-mo data-khoa-dap-an={notice.reason}>
                  {notice.text}
                </div>
              ) : null;
            })()}
            <ReviewList data={d} />
          </>
        ) : null}
    </div>
  );
}
