// FE-095 — EmptyState dùng chung thay cho ≥15 trang admin tự viết "chưa có
// dữ liệu" khác nhau. Chọn 1 kiểu neumorphism nhất quán với dashboard.
"use client";
import type { ReactNode } from "react";

export interface EmptyStateProps {
  icon?: ReactNode;    // ví dụ <svg…/> hoặc emoji
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({ icon, title, description, actionLabel, onAction, className = "" }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-12 px-6 text-center ${className}`}
      role="status"
    >
      {icon ? (
        <div className="mb-4 w-16 h-16 flex items-center justify-center rounded-2xl text-3xl"
          style={{ background: "#F0F5FF", boxShadow: "inset 4px 4px 8px #C5D0EA, inset -4px -4px 8px #ffffff" }}>
          {icon}
        </div>
      ) : null}
      <h3 className="text-base font-semibold text-slate-800">{title}</h3>
      {description ? (
        <p className="mt-1.5 text-sm text-slate-500 max-w-sm">{description}</p>
      ) : null}
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 px-5 py-2.5 rounded-2xl text-sm font-semibold text-white transition"
          style={{ background: "linear-gradient(135deg, #4F6BF5, #6B4FE8)" }}
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
