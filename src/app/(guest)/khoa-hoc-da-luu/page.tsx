"use client";

import Link from "next/link";
import { useFollowedCourses } from "@/hooks/useFollowedCourses";
import { useAuth } from "@/contexts/AuthContext";

const categoryTheme: Record<string, string> = {
  "ĐGNL HSA":        "var(--kin-nhan-nen)",
  "ĐGNL HCM":        "var(--kin-nhan-nen)",
  "Tốt nghiệp THPT": "var(--kin-tt-chu-xong)",
  "TSA Bách Khoa":   "var(--kin-tt-chu-cho)",
  "BCA":             "var(--kin-chu-chinh)",
};

const CLASS_STATUS_LABEL: Record<string, { text: string; color: string; bg: string }> = {
  open:   { text: "Đang nhận học viên", color: "var(--kin-tt-chu-xong)", bg: "var(--kin-chu-tren-nut-chinh)" },
  closed: { text: "Đã đóng",             color: "var(--kin-chu-mo)", bg: "var(--kin-nen-bang)" },
  paused: { text: "Tạm dừng",           color: "var(--kin-tt-chu-cho)", bg: "var(--kin-chu-tren-nut-chinh)" },
};

export default function LopTheoDoiPage() {
  const { user } = useAuth();
  const { items, loading, unfollow } = useFollowedCourses();

  // ── Guest ──────────────────────────────────────────────────────────────────
  if (!user && !loading) {
    return (
      <div className="flex items-center justify-center px-4 py-20">
        <div className="text-center max-w-sm">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--kin-chu-mo)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 001.98 1.61H19a2 2 0 001.97-1.67L23 6H6"/>
              </svg>
            </div>
            <h1 className="text-xl font-bold mb-2" style={{ color: "var(--kin-chu-chinh)" }}>Đăng nhập để xem lớp đang theo dõi</h1>
            <p className="text-sm mb-6" style={{ color: "var(--kin-chu-mo)" }}>Danh sách lớp theo dõi gắn với tài khoản của bạn</p>
            <Link href="/dang-nhap?redirect=/khoa-hoc-da-luu"
              className="inline-flex px-6 py-2.5 rounded-lg text-sm font-semibold text-white"
              style={{ background: "var(--kin-nhan-nen)" }}>
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
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--kin-chu-chinh)", letterSpacing: "-0.5px" }}>
            Lớp đang theo dõi
            {!loading && items.length > 0 && (
              <span className="ml-2 text-sm font-semibold px-2 py-0.5 rounded-full align-middle"
                style={{ background: "var(--kin-nhan-nen)", color: "var(--kin-chu-tren-nut-chinh)" }}>
                {items.length}
              </span>
            )}
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--kin-chu-mo)" }}>Các lớp bạn quan tâm, để quay lại xem khi muốn tham gia</p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="rounded-xl p-4 animate-pulse flex gap-4"
                style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
                <div className="w-20 h-20 rounded-lg flex-shrink-0" style={{ background: "var(--kin-vien-thuong)" }} />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 rounded" style={{ background: "var(--kin-vien-thuong)" }} />
                  <div className="h-3 w-1/2 rounded" style={{ background: "var(--kin-nen-re-chuot)" }} />
                  <div className="h-4 w-1/4 rounded" style={{ background: "var(--kin-vien-thuong)" }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && items.length === 0 && (
          <div className="rounded-xl py-20 text-center"
            style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--kin-vien-o-nhap)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 001.98 1.61H19a2 2 0 001.97-1.67L23 6H6"/>
              </svg>
            </div>
            <p className="font-semibold mb-1" style={{ color: "var(--kin-chu-chinh)" }}>Bạn chưa theo dõi lớp nào</p>
            <p className="text-sm mb-6" style={{ color: "var(--kin-chu-mo)" }}>Bấm “Theo dõi lớp” ở các lớp bạn quan tâm để xem lại ở đây</p>
            <Link href="/khoa-hoc"
              className="inline-flex px-5 py-2.5 rounded-lg text-sm font-semibold text-white"
              style={{ background: "var(--kin-nhan-nen)" }}>
              Xem khóa học →
            </Link>
          </div>
        )}

        {/* Saved list */}
        {!loading && items.length > 0 && (
          <div className="space-y-3">
            {items.map(({ courseId, course }) => {
              const bg = categoryTheme[course.category] ?? categoryTheme["ĐGNL HSA"];
              const st = CLASS_STATUS_LABEL[course.classStatus] ?? CLASS_STATUS_LABEL.open;
              return (
                <div key={courseId}
                  className="rounded-xl p-4 flex items-center gap-4"
                  style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>

                  {/* Thumbnail */}
                  <div className="w-16 h-16 rounded-xl flex-shrink-0 flex items-center justify-center text-white font-black text-xs"
                    style={{ background: bg }}>
                    KiN
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm leading-snug truncate" style={{ color: "var(--kin-chu-chinh)" }}>
                      {course.name}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--kin-chu-mo)" }}>
                      {course.instructor} · {course.lessons} bài · {course.hours}h
                    </p>
                    <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded mt-1.5"
                      style={{ color: st.color, background: st.bg }}>
                      {st.text}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Link href={`/khoa-hoc/${courseId}`}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors hover:bg-[var(--kin-nhan-nen-nhat)]"
                      style={{ color: "var(--kin-nhan-link)", border: "1px solid var(--kin-nhan-vien)" }}>
                      Chi tiết
                    </Link>
                    <button
                      onClick={() => unfollow(courseId)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--kin-tt-nen-loi)]"
                      style={{ border: "1px solid var(--kin-vien-thuong)" }}
                      title="Bỏ theo dõi" aria-label="Bỏ theo dõi">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--kin-tt-chu-loi)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
