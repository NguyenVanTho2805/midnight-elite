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
//
// BU-00 sửa sau test (31/10/2026): lớp CSS (BASE/VARIANT/SIZE) và kinButtonClass() chuyển sang ./buttonClass.ts
// (module thuần, không "use client") để trang máy chủ dùng được cho <Link>; ở đây chỉ import + re-export.
"use client";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { KIN_BUTTON_BASE, KIN_BUTTON_VARIANT, KIN_BUTTON_SIZE, type KinButtonVariant, type KinButtonSize } from "./buttonClass";

export { kinButtonClass, type KinButtonVariant, type KinButtonSize } from "./buttonClass";

export interface KinButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "size"> {
  variant?: KinButtonVariant;
  size?:    KinButtonSize;
  leading?: ReactNode;
  trailing?: ReactNode;
  loading?: boolean;
  /** Chữ hiện thay nhãn khi `loading` (không có vòng xoay). */
  loadingLabel?: string;
  block?:   boolean;
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
      className={[KIN_BUTTON_BASE, KIN_BUTTON_VARIANT[variant], KIN_BUTTON_SIZE[size], block ? "w-full" : "", className].filter(Boolean).join(" ")}
      {...rest}
    >
      {!loading && leading}
      {loading && loadingLabel ? loadingLabel : children}
      {!loading && trailing}
    </button>
  );
});
