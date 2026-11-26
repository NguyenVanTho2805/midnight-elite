"use client";
import { IconDangXuat } from "../bieu-tuong";

export function NutDangXuat({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      aria-label="Đăng xuất"
      className={`nhan flex min-h-11 w-full items-center gap-3 rounded-[10px] px-3 text-left text-text-2 hover:bg-row-hover hover:text-text ${className}`}
      onClick={async () => {
        await fetch("/api/dang-xuat", { method: "POST" });
        location.href = "/dang-nhap";
      }}
    >
      <IconDangXuat size={20} />
      <span>Đăng xuất</span>
    </button>
  );
}
