"use client";

import Link from "next/link";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/contexts/AuthContext";

const categoryTheme: Record<string, string> = {
  "ĐGNL HSA":        "linear-gradient(135deg,#0042AA,#0068FF,#38BDF8)",
  "ĐGNL HCM":        "linear-gradient(135deg,#6D28D9,#8B5CF6,#C4B5FD)",
  "Tốt nghiệp THPT": "linear-gradient(135deg,#15803D,#16a34a,#4ADE80)",
  "TSA Bách Khoa":   "linear-gradient(135deg,#C2410C,#EA580C,#FB923C)",
  "BCA":             "linear-gradient(135deg,#1E2938,#374151,#6B7280)",
};

function formatPrice(n: number) {
  return n.toLocaleString("vi-VN") + " đ";
}

export default function GioHangPage() {
  const { user } = useAuth();
  const { items, loading, removeFromCart } = useCart();

  // ── Guest ──────────────────────────────────────────────────────────────────
  if (!user && !loading) {
    return (
      <div className="flex items-center justify-center px-4 py-20">
        <div className="text-center max-w-sm">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#a4a097" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 001.98 1.61H19a2 2 0 001.97-1.67L23 6H6"/>
              </svg>
            </div>
            <h1 className="text-xl font-bold mb-2" style={{ color: "#1a1a1a" }}>Đăng nhập để xem khóa học đã lưu</h1>
            <p className="text-sm mb-6" style={{ color: "#787671" }}>Khóa học được lưu theo tài khoản của bạn</p>
            <Link href="/dang-nhap?redirect=/khoa-hoc-da-luu"
              className="inline-flex px-6 py-2.5 rounded-lg text-sm font-semibold text-white"
              style={{ background: "#0068FF" }}>
              Đăng nhập
            </Link>
          </div>
        </div>
    );
  }

  return (
    <div>

      <div className="max-w-5xl mx-auto w-full px-4 py-10">

        {/* Header */}
        <div className="mb-7">
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#1a1a1a", letterSpacing: "-0.5px" }}>
            Khóa học đã lưu
            {!loading && items.length > 0 && (
              <span className="ml-2 text-sm font-semibold px-2 py-0.5 rounded-full align-middle"
                style={{ background: "#0068FF", color: "#fff" }}>
                {items.length}
              </span>
            )}
          </h1>
          <p className="text-sm mt-1" style={{ color: "#787671" }}>Các khóa học bạn đã lưu lại</p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="rounded-xl p-4 animate-pulse flex gap-4"
                style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
                <div className="w-20 h-20 rounded-lg flex-shrink-0" style={{ background: "#e5e3df" }} />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 rounded" style={{ background: "#e5e3df" }} />
                  <div className="h-3 w-1/2 rounded" style={{ background: "#f0eeec" }} />
                  <div className="h-4 w-1/4 rounded" style={{ background: "#e5e3df" }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && items.length === 0 && (
          <div className="rounded-xl py-20 text-center"
            style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{ background: "#f6f5f4", border: "1px solid #e5e3df" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#c8c4be" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 001.98 1.61H19a2 2 0 001.97-1.67L23 6H6"/>
              </svg>
            </div>
            <p className="font-semibold mb-1" style={{ color: "#1a1a1a" }}>Chưa có khóa học nào được lưu</p>
            <p className="text-sm mb-6" style={{ color: "#a4a097" }}>Khám phá các khóa học và lưu lại để học sau</p>
            <Link href="/khoa-hoc"
              className="inline-flex px-5 py-2.5 rounded-lg text-sm font-semibold text-white"
              style={{ background: "#0068FF" }}>
              Xem khóa học →
            </Link>
          </div>
        )}

        {/* Saved list */}
        {!loading && items.length > 0 && (
          <div className="space-y-3">
            {items.map(({ courseId, course }) => {
              const bg = categoryTheme[course.category] ?? categoryTheme["ĐGNL HSA"];
              const discount = course.originalPrice && course.originalPrice > course.price
                ? Math.round((1 - course.price / course.originalPrice) * 100) : 0;

              return (
                <div key={courseId}
                  className="rounded-xl p-4 flex items-center gap-4"
                  style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>

                  {/* Thumbnail */}
                  <div className="w-16 h-16 rounded-xl flex-shrink-0 flex items-center justify-center text-white font-black text-xs"
                    style={{ background: bg }}>
                    ME
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm leading-snug truncate" style={{ color: "#1a1a1a" }}>
                      {course.name}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "#a4a097" }}>
                      {course.instructor} · {course.lessons} bài · {course.hours}h
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-sm font-bold" style={{ color: "#0068FF" }}>
                        {formatPrice(course.price)}
                      </span>
                      {course.originalPrice && course.originalPrice > course.price && (
                        <span className="text-xs line-through" style={{ color: "#c8c4be" }}>
                          {formatPrice(course.originalPrice)}
                        </span>
                      )}
                      {discount > 0 && (
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded"
                          style={{ background: "#FEE2E2", color: "#dc2626" }}>
                          -{discount}%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Link href={`/khoa-hoc/${courseId}`}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors hover:bg-[#f0f7ff]"
                      style={{ color: "#0068FF", border: "1px solid #BFDBFE" }}>
                      Chi tiết
                    </Link>
                    <button
                      onClick={() => removeFromCart(courseId)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-[#FEF2F2]"
                      style={{ border: "1px solid #e5e3df" }}
                      title="Xóa khỏi danh sách">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
