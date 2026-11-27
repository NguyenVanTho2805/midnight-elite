"use client";
// Nút đổi giao diện sáng/tối (QĐ 27). Lựa chọn lưu ở máy này; chưa chọn thì theo máy (script trong app/layout.tsx).

export function NutDoiGiaoDien({ className = "", coNhan = false }: { className?: string; coNhan?: boolean }) {
  return (
    <button
      type="button"
      aria-label="Đổi giao diện sáng / tối"
      className={`nhan inline-flex min-h-11 min-w-11 items-center justify-center gap-3 rounded-[10px] px-3 text-text-2 hover:bg-row-hover hover:text-text ${className}`}
      onClick={() => {
        const moi = document.documentElement.dataset.theme === "light" ? "dark" : "light";
        document.documentElement.dataset.theme = moi;
        try { localStorage.setItem("bca-giao-dien", moi); } catch {}
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 3v18a9 9 0 0 0 0-18z" fill="currentColor" /></svg>
      {coNhan ? <span>Giao diện sáng / tối</span> : null}
    </button>
  );
}
