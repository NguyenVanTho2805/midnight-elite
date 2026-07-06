"use client";

import { useState } from "react";
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
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const total = items.reduce((sum, i) => sum + i.course.price, 0);

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
            <h1 className="text-xl font-bold mb-2" style={{ color: "#1a1a1a" }}>Đăng nhập để xem giỏ hàng</h1>
            <p className="text-sm mb-6" style={{ color: "#787671" }}>Giỏ hàng được lưu theo tài khoản của bạn</p>
            <Link href="/dang-nhap?redirect=/gio-hang"
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
            Giỏ hàng
            {!loading && items.length > 0 && (
              <span className="ml-2 text-sm font-semibold px-2 py-0.5 rounded-full align-middle"
                style={{ background: "#0068FF", color: "#fff" }}>
                {items.length}
              </span>
            )}
          </h1>
          <p className="text-sm mt-1" style={{ color: "#787671" }}>Các khóa học bạn đã chọn</p>
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
            <p className="font-semibold mb-1" style={{ color: "#1a1a1a" }}>Giỏ hàng trống</p>
            <p className="text-sm mb-6" style={{ color: "#a4a097" }}>Khám phá các khóa học và thêm vào giỏ hàng</p>
            <Link href="/khoa-hoc"
              className="inline-flex px-5 py-2.5 rounded-lg text-sm font-semibold text-white"
              style={{ background: "#0068FF" }}>
              Xem khóa học →
            </Link>
          </div>
        )}

        {/* Cart content */}
        {!loading && items.length > 0 && (
          <div className="flex flex-col lg:flex-row gap-5 items-start">

            {/* Items */}
            <div className="flex-1 space-y-3 min-w-0">
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
                        title="Xóa khỏi giỏ">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Order summary */}
            <div className="lg:w-72 w-full flex-shrink-0">
              <div className="rounded-xl p-5 sticky top-20"
                style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
                <p className="text-sm font-bold mb-4" style={{ color: "#1a1a1a" }}>Tóm tắt đơn hàng</p>

                <div className="space-y-2.5 mb-4">
                  {items.map(({ courseId, course }) => (
                    <div key={courseId} className="flex justify-between text-xs">
                      <span className="truncate max-w-[150px]" style={{ color: "#787671" }}>{course.name}</span>
                      <span className="font-semibold flex-shrink-0 ml-2" style={{ color: "#1a1a1a" }}>
                        {formatPrice(course.price)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="pt-3 mb-5" style={{ borderTop: "1px solid #e5e3df" }}>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold" style={{ color: "#1a1a1a" }}>Tổng cộng</span>
                    <span className="text-lg font-black" style={{ color: "#0068FF" }}>
                      {formatPrice(total)}
                    </span>
                  </div>
                  <p className="text-xs mt-1" style={{ color: "#a4a097" }}>Đã bao gồm VAT (nếu có)</p>
                </div>

                <button
                  onClick={() => setCheckoutOpen(true)}
                  className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all hover:brightness-105 active:scale-[0.98]"
                  style={{ background: "#0068FF" }}>
                  Đặt mua ngay →
                </button>

                <Link href="/khoa-hoc"
                  className="block text-center mt-3 text-xs font-medium"
                  style={{ color: "#787671" }}>
                  ← Tiếp tục mua hàng
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Checkout modal */}
      {checkoutOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0"
          style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={() => setCheckoutOpen(false)}>
          <div className="w-full max-w-md rounded-2xl p-6"
            style={{ background: "#ffffff" }}
            onClick={e => e.stopPropagation()}>

            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold" style={{ color: "#1a1a1a" }}>Hoàn tất đăng ký</h2>
              <button onClick={() => setCheckoutOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#f6f5f4]"
                style={{ color: "#787671" }}>✕</button>
            </div>

            <div className="rounded-xl p-4 mb-5" style={{ background: "#f6f5f4", border: "1px solid #e5e3df" }}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "#a4a097" }}>Tổng thanh toán</p>
              <p className="text-2xl font-black" style={{ color: "#0068FF" }}>{formatPrice(total)}</p>
              <p className="text-xs mt-1" style={{ color: "#787671" }}>{items.length} khóa học</p>
            </div>

            <p className="text-sm mb-4" style={{ color: "#787671" }}>
              Liên hệ tư vấn viên để xác nhận đơn hàng và nhận hướng dẫn thanh toán:
            </p>

            <div className="space-y-3">
              <a href="https://zalo.me/0384409051" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all hover:brightness-95"
                style={{ background: "#0068FF", color: "#ffffff" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg>
                <div>
                  <p className="text-sm font-bold">Nhắn Zalo tư vấn</p>
                  <p className="text-xs opacity-75">0384 409 051 · Phản hồi trong 5 phút</p>
                </div>
              </a>

              <a href="tel:0384409051"
                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-colors hover:bg-[#f6f5f4]"
                style={{ border: "1px solid #e5e3df" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8 19.79 19.79 0 01.02 1.18C.02.57.47.03 1.08.01h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L5.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "#1a1a1a" }}>Gọi hotline</p>
                  <p className="text-xs" style={{ color: "#787671" }}>0384 409 051 · 9:00 – 21:30</p>
                </div>
              </a>
            </div>

            <p className="text-xs text-center mt-4" style={{ color: "#a4a097" }}>
              Hỗ trợ thanh toán: chuyển khoản ngân hàng, ví điện tử
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
