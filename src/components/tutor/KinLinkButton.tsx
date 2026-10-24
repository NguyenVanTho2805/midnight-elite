// Liên kết mang dáng nút KiN, dùng được trong trang máy chủ (kinButtonClass nằm ở tệp "use client" nên trang máy chủ không gọi trực tiếp được).
"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { kinButtonClass, type KinButtonVariant } from "@/components/kin/Button";

export default function KinLinkButton({ href, variant = "primary", external, children, ariaLabel }:
  { href: string; variant?: KinButtonVariant; external?: boolean; children: ReactNode; ariaLabel?: string }) {
  const cls = kinButtonClass(variant);
  if (external) return <a href={href} rel="noopener noreferrer" target="_blank" className={cls} aria-label={ariaLabel}>{children}</a>;
  return <Link href={href} className={cls} aria-label={ariaLabel}>{children}</Link>;
}
