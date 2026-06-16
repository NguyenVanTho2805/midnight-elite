"use client";

interface SkeletonProps {
  className?: string;
  rounded?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
}

export function Skeleton({ className = "", rounded = "xl" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse ${className}`}
      style={{
        background: "linear-gradient(90deg, #E5ECF8 25%, #EEF3FC 50%, #E5ECF8 75%)",
        backgroundSize: "200% 100%",
        animation: "skeleton-shimmer 1.5s infinite",
        borderRadius: rounded === "full" ? "9999px"
          : rounded === "2xl" ? "1rem"
          : rounded === "xl" ? "0.75rem"
          : rounded === "lg" ? "0.5rem"
          : rounded === "md" ? "0.375rem"
          : "0.25rem",
      }}
    />
  );
}

export function SkeletonCourseCard() {
  return (
    <div className="rounded-3xl overflow-hidden"
      style={{ background: "#F0F5FF", boxShadow: "10px 10px 24px #C5D0EA,-10px -10px 24px #ffffff" }}>
      <Skeleton className="w-full h-36" rounded="sm" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-2 w-full" rounded="full" />
        <Skeleton className="h-9 w-full" rounded="2xl" />
      </div>
    </div>
  );
}

export function SkeletonLessonRow() {
  return (
    <div className="flex items-center gap-3 px-3 py-3 border-b border-gray-100">
      <Skeleton className="w-6 h-6 flex-shrink-0" rounded="full" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-2/3" />
        <Skeleton className="h-2.5 w-1/3" />
      </div>
      <Skeleton className="w-4 h-4 flex-shrink-0" rounded="full" />
    </div>
  );
}

export function SkeletonDashboardCard() {
  return (
    <div className="rounded-2xl p-5"
      style={{ background: "#F0F5FF", boxShadow: "8px 8px 16px #C5D0EA,-8px -8px 16px #ffffff" }}>
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="w-10 h-6" rounded="full" />
        </div>
        <Skeleton className="h-2.5 w-full" rounded="full" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 flex-1" rounded="2xl" />
          <Skeleton className="h-9 flex-1" rounded="2xl" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-0">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-gray-100">
          <Skeleton className="w-12 h-6" rounded="md" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="w-8 h-8" rounded="full" />
        </div>
      ))}
    </div>
  );
}
