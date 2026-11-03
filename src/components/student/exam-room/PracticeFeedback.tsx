// Phản hồi từng câu của chế độ LUYỆN TẬP (BU-04 mục 5.3). Chỉ vẽ những gì /check trả về; không tự suy ra đúng/sai hay đáp án.
// Gợi ý chưa có đáp án: khi state="hint" máy chủ không gửi answer/explanation nên DOM không thể chứa chúng.
"use client";
import { KinButton } from "@/components/kin";
import { MathText } from "@/components/MathText";
import type { PracticeCheckResponse as CheckResult } from "@/lib/examRoomApi";

export interface PracticeFeedbackProps {
  result: CheckResult | null; loading: boolean; error: string; isCluster: boolean; isLast: boolean;
  onRetry: () => void; onReveal: () => void; onNext: () => void;
}
const BLOCKED: Record<NonNullable<CheckResult["revealBlockedReason"]>, string> = {
  never: "Gia sư chưa cho xem đáp án ở đề này.",
  hide_wrong: "Gia sư chỉ mở đáp án và lời giải cho câu em làm đúng.",
};

export default function PracticeFeedback(p: PracticeFeedbackProps) {
  const r = p.result;
  return (
    <div aria-live="polite" data-phan-hoi className="mt-4">
      {p.loading && <p role="status" className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">Đang kiểm tra…</p>}
      {p.error && <p role="alert" className="text-[length:var(--kin-co-small)] font-semibold" style={{ color: "var(--kin-tt-chu-loi)" }}>{p.error}</p>}
      {r && (
        <div className="rounded-[var(--kin-bo-md)] p-4 flex flex-col gap-2" data-trang-thai-cau={r.state}
          style={r.state === "solved" ? { background: "var(--kin-tt-nen-xong)", border: "1px solid var(--kin-tt-vien-xong)" } : { background: "var(--kin-tt-nen-cho)", border: "1px solid var(--kin-tt-vien-cho)" }}>
          <p className="text-[length:var(--kin-co-body)] font-semibold" style={{ color: r.state === "solved" ? "var(--kin-tt-chu-xong)" : "var(--kin-tt-chu-cho)" }}>
            {r.state === "solved" ? "✓ Đúng rồi" : r.state === "hint" ? "Chưa đúng" : r.correct ? "✓ Đúng rồi" : "Chưa đúng · đây là đáp án"}
          </p>
          {p.isCluster && typeof r.rightCount === "number" && r.state !== "solved" && <p className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-phu)]">Đúng {r.rightCount}/4 ý (KiN không nói ý nào).</p>}
          {r.state === "hint" && r.hint && <p className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-phu)]"><strong>Gợi ý:</strong> <MathText text={r.hint} /></p>}
          {r.state === "hint" && !r.hint && <p className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-phu)]">Đổi đáp án rồi kiểm tra lại, hoặc xem đáp án.</p>}
          {r.explanation && <p className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-phu)]"><strong>Lời giải:</strong> <MathText text={r.explanation} /></p>}
          {r.state !== "hint" && r.revealBlockedReason && <p className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-phu)]">{BLOCKED[r.revealBlockedReason]}</p>}
          <div className="flex flex-wrap gap-2 pt-1">
            {r.state === "hint" && <KinButton variant="secondary" onClick={p.onRetry}>Làm lại</KinButton>}
            {r.state === "hint" && r.canReveal && <KinButton variant="secondary" onClick={p.onReveal}>Xem đáp án</KinButton>}
            {r.state !== "hint" && !p.isLast && <KinButton variant="primary" onClick={p.onNext}>Câu tiếp</KinButton>}
          </div>
        </div>
      )}
    </div>
  );
}
