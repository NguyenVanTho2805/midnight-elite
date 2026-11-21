// Thẻ trạng thái KiN (Figma "Thẻ trạng thái" 8:139) — HÌNH 16px + chữ 14px (chữ gốc, như dòng phụ cạnh nó), cao 20px.
// SCL-G-0 (21/11/2026, QUYET-DINH-GIAO-DIEN §3.6): chấm 7px thay bằng hình mang nghĩa (lấy từ PA2) để trạng thái không chỉ khác nhau bằng màu (WCAG 1.4.1):
//   vòng nét đứt = chưa có gì · vòng đứt + "!" = quá hạn · nửa tô = chờ chấm · tô 3/4 = chờ duyệt · tô kín + dấu ✓ = xong.
//
// HAI BỘ MÃ MÀU, cố ý, đừng gộp: hình là đồ hoạ nên chỉ cần tương phản 3:1; chữ cần 4,5:1.
//   xong    → hình --kin-tt-cham-xong, chữ --kin-tt-chu-xong
//   cho     → hình --kin-tt-cham-cho,  chữ --kin-tt-chu-cho
//   loi     → hình và chữ --kin-tt-chu-loi (lỗi)
//   qua-han → hình và chữ --kin-tt-chu-loi-dam (đỏ CHỈ cho lỗi và quá hạn)
//   mo      → hình --kin-tt-cham-trung-tinh, chữ --kin-chu-phu (10,3:1 — §3.1 mục 4: không chữ xám nhạt cho thông tin)
// MÀU KHÔNG BAO GIỜ NÓI MỘT MÌNH: thẻ luôn có chữ, hình chỉ để trang trí (aria-hidden).
import type { ReactNode } from "react";

export type StatusTone = "xong" | "cho" | "loi" | "mo" | "qua-han";
/** Hình của thẻ. Mặc định theo tone; truyền riêng khi cùng một tone có hai nghĩa (cho: "nua" = chờ chấm, "ba-phan-tu" = chờ duyệt). */
export type StatusShape = "chua" | "qua-han" | "nua" | "ba-phan-tu" | "kin" | "loi";

export const STATUS_DOT: Record<StatusTone, string> = {
  xong: "var(--kin-tt-cham-xong)", cho: "var(--kin-tt-cham-cho)", loi: "var(--kin-tt-chu-loi)", mo: "var(--kin-tt-cham-trung-tinh)", "qua-han": "var(--kin-tt-chu-loi-dam)",
};
export const STATUS_TEXT: Record<StatusTone, string> = {
  xong: "var(--kin-tt-chu-xong)", cho: "var(--kin-tt-chu-cho)", loi: "var(--kin-tt-chu-loi)", mo: "var(--kin-chu-phu)", "qua-han": "var(--kin-tt-chu-loi-dam)",
};
const DEFAULT_SHAPE: Record<StatusTone, StatusShape> = { xong: "kin", cho: "nua", loi: "loi", mo: "chua", "qua-han": "qua-han" };

/** Hình 16px của thẻ trạng thái (tự dùng được, vd. ô sổ điểm). Luôn aria-hidden: nghĩa nằm ở chữ đi kèm. */
export function KinStatusIcon({ shape, color }: { shape: StatusShape; color: string }) {
  const ring = <circle cx="8" cy="8" r="6" stroke={color} strokeWidth="2" fill="none" strokeDasharray={shape === "chua" || shape === "qua-han" ? "3 2.4" : undefined} />;
  return (
    <svg data-kin-hinh={shape} aria-hidden width="16" height="16" viewBox="0 0 16 16" className="flex-shrink-0">
      {shape === "kin" || shape === "loi" ? <circle cx="8" cy="8" r="7" fill={color} /> : ring}
      {shape === "nua" && <path d="M8 2a6 6 0 010 12z" fill={color} />}
      {shape === "ba-phan-tu" && <path d="M8 8V2a6 6 0 11-6 6z" fill={color} />}
      {shape === "kin" && <path d="M4.8 8.2l2.2 2.2 4.2-4.4" stroke="var(--kin-nen-trang)" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
      {shape === "loi" && <><path d="M8 4.6v4" stroke="var(--kin-nen-trang)" strokeWidth="1.8" strokeLinecap="round" /><circle cx="8" cy="11.3" r="1" fill="var(--kin-nen-trang)" /></>}
      {shape === "qua-han" && <><path d="M8 4.8v3.8" stroke={color} strokeWidth="2" strokeLinecap="round" /><circle cx="8" cy="11.2" r="1.1" fill={color} /></>}
    </svg>
  );
}

export function KinStatus({ tone, shape, children, className = "" }: { tone: StatusTone; shape?: StatusShape; children: ReactNode; className?: string }) {
  return (
    <span
      data-kin-status={tone}
      className={`inline-flex items-center gap-[var(--kin-kc-2)] min-h-5 leading-5 whitespace-nowrap text-[length:var(--kin-co-goc)] font-medium ${tone === "qua-han" ? "font-semibold" : ""} ${className}`}
      style={{ color: STATUS_TEXT[tone] }}
    >
      <KinStatusIcon shape={shape ?? DEFAULT_SHAPE[tone]} color={STATUS_DOT[tone]} />
      {children}
    </span>
  );
}

/** Nhãn trạng thái bài/điểm dùng chung (§3.6) — mọi màn học sinh, gia sư, sổ điểm gọi cùng một chữ, một hình. */
export type GradeState = "chua-nop" | "qua-han" | "cho-cham" | "cho-duyet" | "da-nop" | "da-cham";
export const GRADE_STATUS: Record<GradeState, { label: string; tone: StatusTone; shape: StatusShape }> = {
  "chua-nop": { label: "Chưa nộp", tone: "mo", shape: "chua" },
  "qua-han": { label: "Quá hạn", tone: "qua-han", shape: "qua-han" },
  "cho-cham": { label: "Chờ chấm", tone: "cho", shape: "nua" },
  "cho-duyet": { label: "Chờ duyệt", tone: "cho", shape: "ba-phan-tu" },
  "da-nop": { label: "Đã nộp", tone: "xong", shape: "kin" },
  "da-cham": { label: "Đã chấm", tone: "xong", shape: "kin" },
};

/** `<KinGradeStatus state="cho-duyet">Chờ duyệt · 7,5</KinGradeStatus>` — không truyền chữ thì dùng nhãn chung. */
export function KinGradeStatus({ state, children, className }: { state: GradeState; children?: ReactNode; className?: string }) {
  const s = GRADE_STATUS[state];
  return <KinStatus tone={s.tone} shape={s.shape} className={className}>{children ?? s.label}</KinStatus>;
}
