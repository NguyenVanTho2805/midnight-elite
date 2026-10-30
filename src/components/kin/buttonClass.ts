// BU-00 sửa sau test (31/10/2026) — lớp CSS của nút KiN tách khỏi Button.tsx ("use client").
// Lý do: trang máy chủ (vd src/app/lop-cua-toi/(tutor)/cho-duyet/page.tsx) gọi kinButtonClass() cho <Link>;
// khi hàm nằm trong module "use client", Next báo "Attempted to call kinButtonClass() from the server" → 500.
// Module này KHÔNG có "use client": dùng được ở cả Server Component lẫn Client Component.
// Button.tsx import và re-export lại nên mọi `import { kinButtonClass } from "@/components/kin"` / ".../kin/Button" vẫn chạy.
//
// Dáng theo Figma "Nút" 6:50 (xem chú thích đầu Button.tsx): 5 kiểu, cao tối thiểu 44px, focus = outline 2px ngoài nút.

export type KinButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "danger-solid";
export type KinButtonSize = "md" | "lg";

export const KIN_BUTTON_BASE = [
  "inline-flex items-center justify-center gap-2 border font-medium whitespace-nowrap transition-colors",
  "min-h-[var(--kin-cham-toi-thieu)] rounded-[var(--kin-bo-md)]",
  "focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)]",
].join(" ");
// Tắt (mờ 45%), vòng focus offset 0 và con trỏ chờ nằm ở kin-site.css theo [data-kin-nut]: quy tắc chung của globals.css
// (button:disabled, :focus-visible) không nằm trong @layer nên thắng cả lớp tiện ích của Tailwind.

export const KIN_BUTTON_VARIANT: Record<KinButtonVariant, string> = {
  primary:   "bg-[var(--kin-nhan-nen)] text-[var(--kin-nhan-chu-tren-nen)] border-transparent enabled:hover:bg-[var(--kin-nhan-nen-re)]",
  secondary: "bg-[var(--kin-nen-trang)] text-[var(--kin-chu-chinh)] border-[var(--kin-vien-o-nhap)] enabled:hover:bg-[var(--kin-nen-re-chuot)]",
  ghost:     "bg-transparent text-[var(--kin-chu-mo)] border-transparent enabled:hover:bg-[var(--kin-nen-re-chuot)] enabled:hover:text-[var(--kin-chu-mo-tren-nen-nhan)]",
  danger:    "bg-[var(--kin-nen-trang)] text-[var(--kin-tt-chu-loi)] border-[var(--kin-vien-o-nhap)] enabled:hover:bg-[var(--kin-nen-re-chuot)]",
  "danger-solid": "bg-[var(--kin-tt-chu-loi)] text-[var(--kin-chu-tren-nut-chinh)] border-transparent enabled:hover:opacity-90",
};

export const KIN_BUTTON_SIZE: Record<KinButtonSize, string> = {
  md: "px-[var(--kin-kc-6)] py-[var(--kin-kc-5)] text-[length:var(--kin-co-goc)]", // 14px theo Figma
  lg: "px-[var(--kin-kc-7)] py-[var(--kin-kc-6)] text-[length:var(--kin-co-body)]",
};

/** Cùng dáng với KinButton cho thẻ <a>/<Link> (nút điều hướng): `className={kinButtonClass("secondary")}`. */
export function kinButtonClass(variant: KinButtonVariant = "primary", size: KinButtonSize = "md"): string {
  return [KIN_BUTTON_BASE, KIN_BUTTON_VARIANT[variant], KIN_BUTTON_SIZE[size]].join(" ");
}
