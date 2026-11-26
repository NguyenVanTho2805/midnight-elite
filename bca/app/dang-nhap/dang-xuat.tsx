"use client";

export function DangXuat() {
  return (
    <button className="min-h-11 rounded-[10px] border border-border-input px-3 text-sm" onClick={async () => { await fetch("/api/dang-xuat", { method: "POST" }); location.href = "/dang-nhap"; }}>
      Đăng xuất
    </button>
  );
}
