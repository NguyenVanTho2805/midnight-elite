// TK-183 (09/10/2026) — nút KiN.
//
// Figma Thanh: 106:30, 106:51. 3 kiểu: primary (nhấn), secondary (nhạt),
// ghost (không viền). 2 cỡ: md (mặc định), lg.
//
// Chạm tối thiểu --kin-cham-toi-thieu (44px) — đảm bảo chạm được trên
// điện thoại.
"use client";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size    = "md" | "lg";

export interface KinButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "size"> {
  variant?: Variant;
  size?:    Size;
  leading?: ReactNode;
  trailing?: ReactNode;
  loading?: boolean;
  block?:   boolean;
}

const PADDING: Record<Size, string> = {
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-3 text-base",
};

export const KinButton = forwardRef<HTMLButtonElement, KinButtonProps>(function KinButton(
  { variant = "primary", size = "md", leading, trailing, loading, block, disabled,
    className = "", children, ...rest },
  ref,
) {
  const styles = (() => {
    if (variant === "primary") return {
      background: "var(--kin-nhan-nen)",
      color:      "var(--kin-nhan-chu-tren-nen)",
      border:     "1px solid var(--kin-nhan-nen)",
    };
    if (variant === "secondary") return {
      background: "var(--kin-nen-nhan)",
      color:      "var(--kin-nhan-chu-tren-nhat)",
      border:     "1px solid var(--kin-vien-thuong)",
    };
    return {
      background: "transparent",
      color:      "var(--kin-chu-chinh)",
      border:     "1px solid transparent",
    };
  })();

  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      disabled={isDisabled}
      aria-busy={loading ? true : undefined}
      className={[
        "rounded-lg font-medium inline-flex items-center justify-center gap-2 transition-opacity",
        PADDING[size],
        block ? "w-full" : "",
        isDisabled ? "opacity-50 cursor-not-allowed" : "hover:opacity-90",
        className,
      ].filter(Boolean).join(" ")}
      style={{ ...styles, minHeight: "var(--kin-cham-toi-thieu, 44px)" }}
      {...rest}
    >
      {loading
        ? <span className="inline-block w-4 h-4 rounded-full border-2 border-current border-r-transparent animate-spin" aria-hidden />
        : leading}
      {children}
      {!loading && trailing}
    </button>
  );
});
