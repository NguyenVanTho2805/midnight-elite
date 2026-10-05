// FE-096 — ErrorState dùng chung cho các panel/trang khi fetch hỏng. Tách
// khỏi EmptyState vì semantic khác (role="alert"), và màu/CTA khác.
"use client";

export interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({ message = "Có lỗi xảy ra, vui lòng thử lại.", onRetry, className = "" }: ErrorStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-10 px-6 text-center ${className}`}
      role="alert"
    >
      <div className="mb-3 w-14 h-14 flex items-center justify-center rounded-2xl text-2xl"
        style={{ background: "#FEE2E2", color: "#B91C1C" }}>
        ⚠
      </div>
      <p className="text-sm font-medium text-slate-700 max-w-md">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold border border-red-200 text-red-700 bg-white hover:bg-red-50 transition"
        >
          Thử lại
        </button>
      ) : null}
    </div>
  );
}
