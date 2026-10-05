// FE-097 — Skeleton với variants chuẩn (text | card | table-row | avatar |
// stat-tile). Reexport primitive từ src/components/Skeleton để không phá vỡ
// các trang đang import "@/components/Skeleton".
"use client";
import { Skeleton as SkeletonPrimitive } from "@/components/Skeleton";

export { Skeleton as SkeletonPrimitive } from "@/components/Skeleton";
export { SkeletonCourseCard, SkeletonLessonRow, SkeletonDashboardCard, SkeletonTable } from "@/components/Skeleton";

export type SkeletonVariant = "text" | "card" | "table-row" | "avatar" | "stat-tile";

export interface SkeletonVariantProps {
  variant: SkeletonVariant;
  /** `text`: số dòng; mặc định 1. Bỏ qua với các variant khác. */
  lines?: number;
  /** cho `avatar`: kích thước theo px, mặc định 40. */
  size?: number;
  className?: string;
}

export function SkeletonBlock({ variant, lines = 1, size = 40, className = "" }: SkeletonVariantProps) {
  if (variant === "text") {
    return (
      <div className={`space-y-2 ${className}`}>
        {Array.from({ length: lines }).map((_, i) => (
          <SkeletonPrimitive
            key={i}
            className={`h-3.5 ${i === lines - 1 && lines > 1 ? "w-2/3" : "w-full"}`}
          />
        ))}
      </div>
    );
  }
  if (variant === "card") {
    return (
      <div className={`rounded-2xl p-5 ${className}`}
        style={{ background: "#F0F5FF", boxShadow: "8px 8px 16px #C5D0EA,-8px -8px 16px #ffffff" }}>
        <div className="space-y-3">
          <SkeletonPrimitive className="h-4 w-1/2" />
          <SkeletonPrimitive className="h-3 w-full" />
          <SkeletonPrimitive className="h-3 w-5/6" />
          <SkeletonPrimitive className="h-9 w-28" rounded="2xl" />
        </div>
      </div>
    );
  }
  if (variant === "table-row") {
    return (
      <div className={`flex items-center gap-4 px-4 py-3 border-b border-slate-100 ${className}`}>
        <SkeletonPrimitive className="w-10 h-10" rounded="full" />
        <SkeletonPrimitive className="h-4 flex-1" />
        <SkeletonPrimitive className="h-4 w-24" />
        <SkeletonPrimitive className="h-4 w-16" />
      </div>
    );
  }
  if (variant === "avatar") {
    // `size` áp qua inline style vì Tailwind không biết trước giá trị số.
    return (
      <div
        style={{ width: size, height: size }}
        className={className}
      >
        <SkeletonPrimitive className="w-full h-full" rounded="full" />
      </div>
    );
  }
  // stat-tile
  return (
    <div className={`rounded-2xl p-4 flex items-center gap-3 ${className}`}
      style={{ background: "#F0F5FF", boxShadow: "8px 8px 16px #C5D0EA,-8px -8px 16px #ffffff" }}>
      <SkeletonPrimitive className="w-12 h-12" rounded="xl" />
      <div className="flex-1 space-y-2">
        <SkeletonPrimitive className="h-3 w-1/2" />
        <SkeletonPrimitive className="h-5 w-2/3" />
      </div>
    </div>
  );
}
