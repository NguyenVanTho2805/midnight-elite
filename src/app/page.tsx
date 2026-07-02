"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useRouter } from "next/navigation";
import { BookOpen, Trophy, Star, CheckCircle, Flash, ChartBar, UsersGroup } from "griddy-icons";
import SalesBotWidget from "@/components/SalesBotWidget";
import TeacherTag from "@/components/TeacherTag";
import { useCourses } from "@/hooks/useCourses";
import { useFavorites } from "@/hooks/useFavorites";
import { useAuth } from "@/contexts/AuthContext";

// ─── DATA ─────────────────────────────────────────────────────────────────────

const courseCategories = [
  { key: "all",             label: "Tất cả"           },
  { key: "ĐGNL HSA",        label: "ĐGNL HSA"          },
  { key: "Tốt nghiệp THPT", label: "Tốt nghiệp THPT" },
  { key: "TSA Bách Khoa",   label: "TSA Bách Khoa"     },
  { key: "BCA",             label: "BCA"               },
];

interface HomeCourse {
  slug: string; category: string; title: string; shortTitle: string;
  teacher: string; teacherAvatar: string; lessons: number; hours: number;
  price: number; originalPrice: number; openDate: string;
  types: string[]; tag?: string | null; tagColor: string;
}

// tint per why-item
const whyItems = [
  { Icon: Flash,       title: "Học trực tiếp LIVE",        desc: "Buổi học live mỗi tối với giáo viên thực, không phải video cũ. Đặt câu hỏi và nhận phản hồi ngay lập tức.", tint: "var(--tint-yellow-bold)", iconColor: "#b45309" },
  { Icon: ChartBar,    title: "Theo dõi tiến độ realtime", desc: "Dashboard cá nhân hiển thị tiến độ từng môn, GPA, streak và thứ hạng toàn server.", tint: "var(--tint-sky)", iconColor: "#1D4ED8" },
  { Icon: BookOpen,    title: "Kho tài liệu 10,000+ đề",  desc: "Đề thi thử từ năm 2015 đến nay, kèm giải thích chi tiết từng câu.", tint: "var(--tint-mint)", iconColor: "#166534" },
  { Icon: Trophy,      title: "Điểm thưởng & bảng xếp hạng", desc: "Tích điểm, giữ chuỗi ngày học, leo hạng mỗi tuần. Học có mục tiêu, tiến bộ rõ ràng.", tint: "var(--tint-lavender)", iconColor: "#6D28D9" },
  { Icon: Star,        title: "Trợ giảng riêng 1-1",         desc: "Mỗi học viên được phân công trợ giảng người thật để hỏi bài và định hướng lộ trình.", tint: "var(--tint-peach)", iconColor: "#c2410c" },
  { Icon: CheckCircle, title: "Hỏi bài không giới hạn",       desc: "Hỏi trong cộng đồng, trợ giảng phản hồi trong ngày. Ngoài giờ có AI hỗ trợ thêm.", tint: "var(--tint-cream)", iconColor: "#0068FF" },
];


const timeline = [
  { year: "09/2024", event: "Midnight Elite ra đời từ một nhóm giáo viên trẻ muốn thay đổi cách luyện thi ĐGNL." },
  { year: "01/2025", event: "Ra mắt hệ thống thi thử ĐGNL HSA trực tuyến, đầu tiên tại Việt Nam tích hợp Azota." },
  { year: "05/2025", event: "Đạt mốc 1,000 học viên. Ra mắt ĐGNL HCM và TSA Bách Khoa." },
  { year: "09/2025", event: "Mở rộng sang luyện thi Tốt nghiệp THPT 8 môn. Bổ sung đội ngũ 6 mentor chuyên biệt." },
  { year: "01/2026", event: "Triển khai AI Hỏi đáp 24/7 và hệ thống quản lý kỷ luật (Strike) học viên." },
  { year: "Hiện tại", event: "Học viên học live mỗi tối. Bảng xếp hạng cập nhật mỗi ngày. Đội ngũ giáo viên và mentor liên tục mở rộng." },
];

const HERO_CATEGORIES = [
  { label: "ĐGNL HSA",        desc: "ĐH Quốc gia Hà Nội",  tint: "var(--tint-sky)",     text: "#1D4ED8" },
  { label: "TSA Bách Khoa",   desc: "ĐH Bách Khoa HN",     tint: "var(--tint-peach)",   text: "#c2410c" },
  { label: "Tốt nghiệp THPT", desc: "8 môn thi quốc gia",  tint: "var(--tint-mint)",    text: "#166534" },
  { label: "BCA",             desc: "Đánh giá tuyển sinh Bộ Công An", tint: "var(--tint-lavender)", text: "#6D28D9" },
];

// ─── CATEGORY THEME ───────────────────────────────────────────────────────────
const categoryTheme: Record<string, { bg: string; strip: string; stripText: string }> = {
  "ĐGNL HSA":        { bg: "linear-gradient(135deg,#0042AA 0%,#0068FF 60%,#38BDF8 100%)", strip: "#FDE047", stripText: "#1E2938" },
  "Tốt nghiệp THPT": { bg: "linear-gradient(135deg,#15803D 0%,#16a34a 60%,#4ADE80 100%)", strip: "#FDE047", stripText: "#1E2938" },
  "ĐGNL HCM":        { bg: "linear-gradient(135deg,#6D28D9 0%,#8B5CF6 60%,#C4B5FD 100%)", strip: "#FDE047", stripText: "#1E2938" },
  "TSA Bách Khoa":   { bg: "linear-gradient(135deg,#C2410C 0%,#EA580C 60%,#FB923C 100%)", strip: "#FDE047", stripText: "#1E2938" },
};

// ─── BOOKMARK ICON ────────────────────────────────────────────────────────────
function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
    </svg>
  );
}

// ─── COURSE CARD (Notion flat style) ─────────────────────────────────────────
function CourseCard({ course, isFavorited, onToggleFavorite }: {
  course: HomeCourse;
  isFavorited: boolean;
  onToggleFavorite: () => void;
}) {
  const router = useRouter();
  const discount = course.originalPrice > 0 && course.originalPrice > course.price
    ? Math.round((1 - course.price / course.originalPrice) * 100) : 0;
  const theme = categoryTheme[course.category] ?? categoryTheme["ĐGNL HSA"];

  return (
    <div
      className="rounded-xl overflow-hidden flex flex-col cursor-pointer transition-shadow hover:shadow-md"
      style={{ background: "#ffffff", border: "1px solid #e5e3df", boxShadow: "rgba(15,15,15,0.04) 0px 1px 2px 0px" }}
      onClick={() => router.push(`/khoa-hoc/${course.slug}`)}
    >
      {/* Thumbnail */}
      <div className="relative overflow-hidden" style={{ background: theme.bg, minHeight: 160 }}>
        <svg className="absolute bottom-0 left-0 w-full" viewBox="0 0 400 40" preserveAspectRatio="none" style={{ height: 36 }}>
          <path d="M0,20 C100,40 300,0 400,20 L400,40 L0,40 Z" fill="rgba(255,255,255,0.12)" />
        </svg>

        <div className="relative z-10 flex items-start justify-between px-4 pt-3">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md"
            style={{ background: "rgba(255,255,255,0.22)" }}>
            <span className="text-white font-black text-xs leading-none">ME</span>
          </div>
          {course.tag && (
            <div className="px-2 py-0.5 rounded-md text-xs font-bold"
              style={{ background: course.tagColor, color: "#fff" }}>
              -{discount}%
            </div>
          )}
        </div>

        <div className="relative z-10 px-4 pt-2 pb-1">
          {course.shortTitle.split("\n").map((line, i) => (
            <div key={i} className="text-white font-black leading-tight select-none"
              style={{ fontSize: i === 0 ? "1.25rem" : "1.45rem", letterSpacing: "0.02em" }}>
              {line}
            </div>
          ))}
        </div>

        <div className="relative z-10 mx-3 mt-2 px-3 py-1.5 rounded-md flex items-center justify-between"
          style={{ background: theme.strip }}>
          <span className="text-xs font-extrabold uppercase tracking-wide" style={{ color: theme.stripText }}>
            {course.category}
          </span>
          <span className="text-xs font-bold" style={{ color: theme.stripText, opacity: 0.7 }}>
            {course.lessons} bài · {course.hours}h
          </span>
        </div>

        <div className="relative z-10 flex items-center justify-between px-4 py-2.5">
          <div>
            <p className="text-white text-xs opacity-70 leading-none mb-0.5">Khai giảng</p>
            <p className="text-white text-xs font-bold">{course.openDate}</p>
          </div>
          <TeacherTag name={course.teacher} avatar={course.teacherAvatar} size={28} variant="onDark" maxNameWidth={80} />
        </div>
      </div>

      {/* Card body */}
      <div className="flex flex-col flex-1 px-4 pt-3 pb-4">
        <h3 className="text-sm font-semibold mb-2 leading-snug" style={{ color: "#1a1a1a" }}>{course.title}</h3>

        <div className="flex gap-1.5 mb-3">
          {course.types.map((t) => (
            <span key={t}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
              style={t === "Live"
                ? { background: "var(--tint-rose)", color: "#9d174d" }
                : { background: "var(--tint-sky)", color: "#1D4ED8" }}>
              {t === "Live" ? "Live" : "Video"}
            </span>
          ))}
        </div>

        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-base font-bold" style={{ color: "#0068FF" }}>
              {course.price.toLocaleString("vi-VN")} đ
            </div>
            <div className="text-xs line-through" style={{ color: "#bbb8b1" }}>
              {course.originalPrice.toLocaleString("vi-VN")} đ
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {course.tag && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--tint-peach)", color: "#9a3412" }}>
                {course.tag}
              </span>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
              title={isFavorited ? "Bỏ lưu" : "Lưu khóa học"}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95"
              style={{
                background: isFavorited ? "#0068FF" : "#f6f5f4",
                border: `1px solid ${isFavorited ? "#0068FF" : "#e5e3df"}`,
                color: isFavorited ? "white" : "#787671",
              }}
            >
              <BookmarkIcon filled={isFavorited} />
            </button>
          </div>
        </div>

        <div className="flex gap-2 mt-auto" onClick={e => e.stopPropagation()}>
          <Link href={`/khoa-hoc/${course.slug}`}
            className="flex-1 py-2 rounded-lg text-xs font-medium text-center transition-colors hover:bg-[#f6f5f4] border"
            style={{ color: "#787671", borderColor: "#e5e3df" }}>
            Chi tiết
          </Link>
          <Link href={`/khoa-hoc/${course.slug}`}
            className="flex-1 py-2 rounded-lg text-xs font-semibold text-white text-center hover:brightness-105 transition-all"
            style={{ background: "#0068FF" }}>
            Xem khoá học
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────
export default function HomePage() {
  const [activeCategory, setActiveCategory] = useState("all");
  const { data: apiCourses, loading: coursesLoading } = useCourses();
  const { user } = useAuth();
  const { favoriteIds, toggleFavorite } = useFavorites();

  function handleToggle(slug: string) {
    if (!user) { window.location.href = "/dang-nhap"; return; }
    toggleFavorite(slug);
  }

  const courses: HomeCourse[] = useMemo(() => apiCourses.map(c => ({
    slug:          c.id,
    category:      c.category,
    title:         c.name,
    shortTitle:    c.shortTitle,
    teacher:       c.instructor,
    teacherAvatar: c.teacherAvatar,
    lessons:       c.lessons,
    hours:         c.hours,
    price:         c.price,
    originalPrice: c.originalPrice ?? c.price,
    openDate:      c.openDate,
    types:         c.types,
    tag:           c.tag,
    tagColor:      c.tagColor ?? "#FF2157",
  })), [apiCourses]);

  const filtered = activeCategory === "all"
    ? courses
    : courses.filter((c) => c.category === activeCategory);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#ffffff" }}>
      <Navbar />

      <main className="flex-1">

        {/* ── HERO — Notion navy band ────────────────────────────────────── */}
        <section style={{ background: "var(--brand-navy)" }}>
          <div className="max-w-7xl mx-auto px-6 sm:px-10 py-16 lg:py-24">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

              {/* Left */}
              <div>
                <div className="inline-block mb-5 text-xs font-semibold px-3 py-1 rounded-full"
                  style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.15)" }}>
                  Midnight Elite · Luyện thi ĐGNL, THPT &amp; BCA
                </div>
                <h1
                  className="font-bold text-white mb-5 leading-tight"
                  style={{ fontSize: "clamp(2rem,5vw,3.25rem)", letterSpacing: "-0.03em" }}
                >
                  Mua 1 lần,<br />
                  <span style={{ color: "#93C5FD" }}>học trọn đời</span>
                </h1>
                <p className="text-base mb-8 leading-relaxed" style={{ color: "rgba(255,255,255,0.6)", maxWidth: "38ch" }}>
                  Thầy cô dạy live mỗi tối — không phải video cũ. Thi thử đề thật, theo dõi tiến độ từng ngày cùng lớp.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/khoa-hoc"
                    className="notion-btn-on-dark text-sm font-semibold"
                  >
                    Xem khóa học
                  </Link>
                  <Link
                    href="/thi-thu"
                    className="notion-btn-secondary-on-dark text-sm font-medium"
                  >
                    Thi thử miễn phí
                  </Link>
                </div>
              </div>

              {/* Right — category tiles (Notion tint style) */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Đang mở luyện thi
                </p>
              <div className="grid grid-cols-2 gap-3">
                {HERO_CATEGORIES.map(c => (
                  <Link
                    href="/khoa-hoc"
                    key={c.label}
                    className="p-4 rounded-xl transition-all hover:brightness-95"
                    style={{ background: c.tint }}
                  >
                    <div className="text-sm font-bold mb-1" style={{ color: c.text }}>{c.label}</div>
                    <div className="text-xs" style={{ color: c.text, opacity: 0.65 }}>{c.desc}</div>
                  </Link>
                ))}
              </div>
              </div>

            </div>
          </div>
        </section>

        {/* ── COURSES WITH SIDEBAR ──────────────────────────────────────────── */}
        <section className="px-4 sm:px-6 lg:px-8 py-16 max-w-7xl mx-auto">
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-2 tracking-tight" style={{ color: "#1a1a1a", letterSpacing: "-0.5px" }}>
              Khóa học nổi bật
            </h2>
            <p className="text-sm" style={{ color: "#787671" }}>Chọn kỳ thi, bắt đầu học ngay — không cần chờ khai giảng.</p>
          </div>

          {/* Mobile pills */}
          <div className="lg:hidden mb-5 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {courseCategories.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className="flex-shrink-0 px-3 py-1.5 text-xs font-medium transition-colors"
                style={activeCategory === cat.key
                  ? { background: "#1a1a1a", color: "#ffffff", borderRadius: "9999px" }
                  : { background: "transparent", color: "#787671", border: "1px solid #e5e3df", borderRadius: "9999px" }}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="flex gap-7 items-start">

            {/* Sidebar — desktop only */}
            <aside className="hidden lg:block w-52 flex-shrink-0" style={{ position: "sticky", top: "80px" }}>
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #e5e3df" }}>
                <div className="px-4 py-3" style={{ borderBottom: "1px solid #e5e3df" }}>
                  <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#a4a097" }}>Danh mục</p>
                </div>
                {courseCategories.map((cat) => {
                  const count = cat.key === "all" ? courses.length : courses.filter(c => c.category === cat.key).length;
                  const active = activeCategory === cat.key;
                  return (
                    <button
                      key={cat.key}
                      onClick={() => setActiveCategory(cat.key)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[#f6f5f4]"
                      style={{
                        background: active ? "#f6f5f4" : "transparent",
                        borderLeft: active ? "2px solid #0068FF" : "2px solid transparent",
                        borderBottom: "1px solid #ede9e4",
                      }}
                    >
                      <span className="flex-1 text-xs font-medium truncate" style={{ color: active ? "#0068FF" : "#5d5b54" }}>
                        {cat.label}
                      </span>
                      <span
                        className="text-xs w-5 h-5 rounded-full flex items-center justify-center font-semibold flex-shrink-0"
                        style={{ background: active ? "#0068FF" : "#f0eeec", color: active ? "#fff" : "#a4a097", fontSize: 10 }}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
                <div className="p-3">
                  <Link
                    href="/khoa-hoc"
                    className="block w-full py-2 rounded-lg text-xs font-semibold text-center text-white"
                    style={{ background: "#0068FF" }}
                  >
                    Xem tất cả →
                  </Link>
                </div>
              </div>
            </aside>

            {/* Course grid */}
            <div className="flex-1 min-w-0">
              {coursesLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="rounded-xl overflow-hidden animate-pulse" style={{ border: "1px solid #e5e3df" }}>
                      <div className="h-40 bg-[#f0eeec]" />
                      <div className="p-4 space-y-3">
                        <div className="h-4 bg-[#f0eeec] rounded w-3/4" />
                        <div className="h-3 bg-[#f6f5f4] rounded w-1/2" />
                        <div className="h-8 bg-[#f0eeec] rounded-lg" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filtered.map((course) => (
                      <CourseCard
                        key={course.slug}
                        course={course}
                        isFavorited={favoriteIds.has(course.slug)}
                        onToggleFavorite={() => handleToggle(course.slug)}
                      />
                    ))}
                  </div>
                  {filtered.length === 0 && (
                    <div
                      className="text-center py-16 rounded-xl"
                      style={{ border: "1px solid #e5e3df", background: "#f6f5f4" }}
                    >
                      <p className="text-sm font-medium mb-2" style={{ color: "#a4a097" }}>Không có khóa học</p>
                      <button onClick={() => setActiveCategory("all")} className="text-sm font-semibold" style={{ color: "#0068FF" }}>
                        Xem tất cả
                      </button>
                    </div>
                  )}
                  <div className="mt-6 text-center">
                    <Link
                      href="/khoa-hoc"
                      className="inline-block px-6 py-2.5 rounded-lg text-sm font-medium border transition-colors hover:bg-[#f6f5f4]"
                      style={{ color: "#1a1a1a", borderColor: "#c8c4be" }}
                    >
                      Xem toàn bộ {courses.length} khóa học →
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        {/* ── WHY — Notion pastel tint cards ──────────────────────────────── */}
        <section className="px-4 sm:px-6 lg:px-8 py-16 max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-2 tracking-tight" style={{ color: "#1a1a1a", letterSpacing: "-0.5px" }}>
            Học ở đây thì được gì?
          </h2>
          <p className="text-sm text-center mb-10" style={{ color: "#787671" }}>Những thứ học viên thực tế dùng mỗi ngày</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {whyItems.map(({ Icon, title, desc, tint, iconColor }) => (
              <div
                key={title}
                className="rounded-xl p-6"
                style={{ background: tint }}
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ background: "rgba(255,255,255,0.55)" }}>
                  <Icon size={22} style={{ color: iconColor }} />
                </div>
                <h3 className="font-semibold text-sm mb-2" style={{ color: "#37352f" }}>{title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: "#5d5b54" }}>{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── TIMELINE ─────────────────────────────────────────────────────── */}
        <section className="px-4 sm:px-6 lg:px-8 py-16 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10 tracking-tight" style={{ color: "#1a1a1a", letterSpacing: "-0.5px" }}>
            Hành trình phát triển
          </h2>
          <div className="relative pl-6 border-l-2" style={{ borderColor: "#e5e3df" }}>
            {timeline.map((item, i) => (
              <div key={i} className="relative mb-6 last:mb-0">
                <div
                  className="absolute -left-[25px] w-3 h-3 rounded-full border-2 border-white"
                  style={{ background: i === timeline.length - 1 ? "#0068FF" : "#c8c4be" }}
                />
                <div
                  className="rounded-xl p-4"
                  style={{ border: "1px solid #e5e3df", background: "#ffffff" }}
                >
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded mb-2 inline-block"
                    style={{
                      background: i === timeline.length - 1 ? "var(--tint-sky)" : "var(--tint-gray)",
                      color: i === timeline.length - 1 ? "#1D4ED8" : "#787671",
                    }}
                  >
                    {item.year}
                  </span>
                  <p className="text-sm" style={{ color: "#37352f" }}>{item.event}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA — Notion navy band ─────────────────────────────────────── */}
        <section className="px-4 sm:px-6 lg:px-8 py-16 max-w-3xl mx-auto">
          <div
            className="rounded-xl p-10 text-center"
            style={{ background: "var(--brand-navy)" }}
          >
            <UsersGroup size={44} style={{ color: "rgba(255,255,255,0.7)", margin: "0 auto 16px" }} />
            <h2 className="text-2xl font-bold text-white mb-3" style={{ letterSpacing: "-0.5px" }}>
              Gia nhập cộng đồng Midnight Elite ngay hôm nay
            </h2>
            <p className="text-sm mb-8" style={{ color: "rgba(255,255,255,0.6)", maxWidth: "42ch", margin: "0 auto 32px" }}>
              Thi thử miễn phí. Kết quả thật sau 30 ngày học nghiêm túc cùng giáo viên thực.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/dang-ky"
                className="notion-btn-on-dark text-sm font-semibold"
              >
                Tạo tài khoản miễn phí →
              </Link>
              <Link
                href="/thi-thu"
                className="notion-btn-secondary-on-dark text-sm font-medium"
              >
                Thi thử ĐGNL ngay
              </Link>
            </div>
          </div>
        </section>

      </main>
      <Footer />
      <SalesBotWidget />
    </div>
  );
}
