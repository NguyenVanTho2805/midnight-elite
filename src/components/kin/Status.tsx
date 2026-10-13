// Thẻ trạng thái KiN (Figma "Thẻ trạng thái" 8:139) — chấm 7px + chữ, cao 16px.
//
// HAI BỘ MÃ MÀU, cố ý, đừng gộp: chấm là đồ hoạ nên chỉ cần tương phản 3:1; chữ cần 4,5:1.
// Dùng chung một mã thì hoặc chấm quá nhạt, hoặc chữ trượt chuẩn.
//   xong → chấm --kin-tt-cham-xong, chữ --kin-tt-chu-xong
//   cho  → chấm --kin-tt-cham-cho,  chữ --kin-tt-chu-cho
//   loi  → chấm và chữ --kin-tt-chu-loi
//   mo   → chấm --kin-tt-cham-trung-tinh, chữ --kin-chu-mo   (trung tính)
// MÀU KHÔNG BAO GIỜ NÓI MỘT MÌNH: thẻ luôn có chữ, chấm chỉ để trang trí (aria-hidden).
import type { ReactNode } from "react";

export type StatusTone = "xong" | "cho" | "loi" | "mo";

export const STATUS_DOT: Record<StatusTone, string> = {
  xong: "var(--kin-tt-cham-xong)", cho: "var(--kin-tt-cham-cho)", loi: "var(--kin-tt-chu-loi)", mo: "var(--kin-tt-cham-trung-tinh)",
};
export const STATUS_TEXT: Record<StatusTone, string> = {
  xong: "var(--kin-tt-chu-xong)", cho: "var(--kin-tt-chu-cho)", loi: "var(--kin-tt-chu-loi)", mo: "var(--kin-chu-mo)",
};

export function KinStatus({ tone, children, className = "" }: { tone: StatusTone; children: ReactNode; className?: string }) {
  return (
    <span
      data-kin-status={tone}
      className={`inline-flex items-center gap-[var(--kin-kc-1)] h-4 leading-4 whitespace-nowrap text-[length:var(--kin-co-small)] ${className}`}
      style={{ color: STATUS_TEXT[tone] }}
    >
      <span aria-hidden className="inline-block w-[7px] h-[7px] rounded-full flex-shrink-0" style={{ background: STATUS_DOT[tone] }} />
      {children}
    </span>
  );
}
