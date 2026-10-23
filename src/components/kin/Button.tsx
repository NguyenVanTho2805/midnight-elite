// TK-183 (09/10/2026) — nút KiN. Bổ sung 13/10/2026 theo Figma "Nút" 6:50.
//
// Figma có 4 kiểu × 4 trạng thái (Mặc định / Rê chuột / Focus / Tắt), cao tối thiểu 44px:
//   primary   = "Chính"      nền màu nhấn, chữ trắng; rê chuột = màu nhấn đậm
//   secondary = "Thường"     nền trắng, viền 1px đủ 3:1, chữ đậm; rê chuột = nền xám nhạt
//   ghost     = "Ghost"      không nền, không viền, chữ xám
//   danger    = "Nguy hiểm"  như Thường nhưng chữ đỏ
// Thêm danger-solid: nền đỏ đặc cho nút xác nhận trong hộp xác nhận (Figma 106:41).
// Focus: vòng xanh 2px đặt NGOÀI nút (outline) để dòng kế tiếp không cắt viền. Tắt: mờ 45%.
//
// Không có vòng xoay chờ (Figma: dùng chữ, không dùng spinner): `loading` khoá nút, đặt aria-busy,
// và nếu có `loadingLabel` thì thay chữ ("Đang lưu…").
"use client";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export type KinButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "danger-solid";
type Size = "md" | "lg";

export interface KinButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "size"> {
  variant?: KinButtonVariant;
  size?:    Size;
  leading?: ReactNode;
  trailing?: ReactNode;
  loading?: boolean;
  /** Chữ hiện thay nhãn khi `loading` (không có vòng xoay). */
  loadingLabel?: string;
  block?:   boolean;
}

const BASE = [
  "inline-flex items-center justify-center gap-2 border font-medium whitespace-nowrap transition-colors",
  "min-h-[var(--kin-cham-toi-thieu)] rounded-[var(--kin-bo-md)]",
  "focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)]",
].join(" ");
// Tắt (mờ 45%), vòng focus offset 0 và con trỏ chờ nằm ở kin-site.css theo [data-kin-nut]: quy tắc chung của globals.css
// (button:disabled, :focus-visible) không nằm trong @layer nên thắng cả lớp tiện ích của Tailwind.

const VARIANT: Record<KinButtonVariant, string> = {
  primary:   "bg-[var(--kin-nhan-nen)] text-[var(--kin-nhan-chu-tren-nen)] border-transparent enabled:hover:bg-[var(--kin-nhan-nen-re)]",
  secondary: "bg-[var(--kin-nen-trang)] text-[var(--kin-chu-chinh)] border-[var(--kin-vien-o-nhap)] enabled:hover:bg-[var(--kin-nen-re-chuot)]",
  ghost:     "bg-transparent text-[var(--kin-chu-mo)] border-transparent enabled:hover:bg-[var(--kin-nen-re-chuot)] enabled:hover:text-[var(--kin-chu-mo-tren-nen-nhan)]",
  danger:    "bg-[var(--kin-nen-trang)] text-[var(--kin-tt-chu-loi)] border-[var(--kin-vien-o-nhap)] enabled:hover:bg-[var(--kin-nen-re-chuot)]",
  "danger-solid": "bg-[var(--kin-tt-chu-loi)] text-[var(--kin-chu-tren-nut-chinh)] border-transparent enabled:hover:opacity-90",
};

const SIZE: Record<Size, string> = {
  md: "px-[var(--kin-kc-6)] py-[var(--kin-kc-5)] text-[length:var(--kin-co-goc)]", // 14px theo Figma
  lg: "px-[var(--kin-kc-7)] py-[var(--kin-kc-6)] text-[length:var(--kin-co-body)]",
};

/** Cùng dáng với KinButton cho thẻ <a>/<Link> (nút điều hướng): `className={kinButtonClass("secondary")}`. */
export function kinButtonClass(variant: KinButtonVariant = "primary", size: Size = "md"): string {
  return [BASE, VARIANT[variant], SIZE[size]].join(" ");
}

export const KinButton = forwardRef<HTMLButtonElement, KinButtonProps>(function KinButton(
  { variant = "primary", size = "md", leading, trailing, loading, loadingLabel, block, disabled,
    className = "", children, ...rest },
  ref,
) {
  const isDisabled = disabled || loading;
  return (
    <button
      ref={ref}
      disabled={isDisabled}
      aria-busy={loading ? true : undefined}
      data-kin-nut={variant}
      className={[BASE, VARIANT[variant], SIZE[size], block ? "w-full" : "", className].filter(Boolean).join(" ")}
      {...rest}
    >
      {!loading && leading}
      {loading && loadingLabel ? loadingLabel : children}
      {!loading && trailing}
    </button>
  );
});
