// TK-183 (09/10/2026) — ô nhập KiN.
//
// Figma Thanh: 105:26, 106:23. Nối FE-092/093/094 (PR #22/23 đã có
// design system 2.1). Component này gói các token KiN để các màn mới
// không cần copy inline style nữa.
//
// Dùng:
//   <KinInput label="Email" value={v} onChange={e => setV(e.target.value)} />
//   <KinInput label="Mật khẩu" type="password" error="Sai mật khẩu" />
"use client";
import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";

type Size = "sm" | "md" | "lg";

export interface KinInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "prefix"> {
  label?:  ReactNode;
  error?:  string;
  hint?:   string;
  size?:   Size;
  prefix?: ReactNode;
  suffix?: ReactNode;
}

const PADDING: Record<Size, string> = {
  sm: "py-1.5 text-sm",
  md: "py-2.5 text-sm",
  lg: "py-3 text-base",
};

export const KinInput = forwardRef<HTMLInputElement, KinInputProps>(function KinInput(
  { label, error, hint, size = "md", prefix, suffix, className = "", id, ...rest },
  ref,
) {
  const inputId = id ?? (label && typeof label === "string" ? `kin-input-${label.replace(/\s+/g, "-")}` : undefined);
  // Viền đỏ khi error — dùng --kin-tt-chu-loi (3 màu nghĩa TK-169).
  const borderColor = error ? "var(--kin-tt-chu-loi)" : "var(--kin-vien-o-nhap)";

  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId}
          className="block text-sm font-medium mb-1.5"
          style={{ color: "var(--kin-chu-chinh)" }}>
          {label}
        </label>
      )}
      <div className="relative flex items-stretch rounded-lg"
        style={{ background: "var(--kin-nen-trang)", border: `1px solid ${borderColor}` }}>
        {prefix && (
          <span className="flex items-center px-3 text-sm"
            style={{ color: "var(--kin-chu-phu)", borderRight: "1px solid var(--kin-vien-nhat)" }}>
            {prefix}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-err` : hint ? `${inputId}-hint` : undefined}
          className={`flex-1 min-w-0 px-3 outline-none bg-transparent ${PADDING[size]}`}
          style={{ color: "var(--kin-chu-chinh)" }}
          {...rest}
        />
        {suffix && (
          <span className="flex items-center px-3 text-sm"
            style={{ color: "var(--kin-chu-phu)", borderLeft: "1px solid var(--kin-vien-nhat)" }}>
            {suffix}
          </span>
        )}
      </div>
      {error ? (
        <p id={`${inputId}-err`} className="text-caption mt-1"
          style={{ color: "var(--kin-tt-chu-loi)" }}>
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-caption mt-1"
          style={{ color: "var(--kin-chu-mo)" }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
});
