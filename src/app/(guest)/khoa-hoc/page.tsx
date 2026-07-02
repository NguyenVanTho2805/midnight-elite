"use client";

import { useState, useMemo, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { COURSE_CATEGORIES, CATEGORY_GRADIENT, COURSE_HASHTAGS } from "@/lib/courseData";
import { useCourses } from "@/hooks/useCourses";
import { useFavorites } from "@/hooks/useFavorites";
import { useAuth } from "@/contexts/AuthContext";
import PopupBuyRequired from "@/components/PopupBuyRequired";
import TeacherTag from "@/components/TeacherTag";
import type { CourseFull } from "@/lib/api";

const categories = COURSE_CATEGORIES;

interface Course {
  slug: string; category: string; title: string; shortTitle: string;
  teacher: string; teacherAvatar: string; openDate: string; types: string[];
  lessons: number; hours: number; price: number; originalPrice: number;
  tag?: string; tagColor?: string;
}

function toCourse(c: CourseFull): Course {
  return {
    slug:          c.id,
    category:      c.category,
    title:         c.name,
    shortTitle:    c.shortTitle,
    teacher:       c.instructor,
    teacherAvatar: c.teacherAvatar,
    openDate:      c.openDate,
    types:         c.types,
    lessons:       c.lessons,
    hours:         c.hours,
    price:         c.price,
    originalPrice: c.originalPrice ?? c.price,
    tag:           c.tag ?? undefined,
    tagColor:      c.tagColor ?? undefined,
  };
}

const categoryTheme = Object.fromEntries(
  Object.entries(CATEGORY_GRADIENT).map(([k, bg]) => [k, { bg, strip: "#FDE047", stripText: "#1E2938" }])
) as Record<string, { bg: string; strip: string; stripText: string }>;

function CourseCard({ course, isFavorited, onToggleFavorite }: {
  course: Course;
  isFavorited: boolean;
  onToggleFavorite: () => void;
}) {
  const router = useRouter();
  const [showBuyPopup, setShowBuyPopup] = useState(false);
  const discount = Math.round((1 - course.price / course.originalPrice) * 100);
  const theme = categoryTheme[course.category] ?? categoryTheme["ĐGNL HSA"];

  return (
    <>
      {showBuyPopup && (
        <PopupBuyRequired
          courseName={course.title}
          price={course.price}
          originalPrice={course.originalPrice}
          title="Mua khóa học"
          subtitle="Liên hệ admin để được hướng dẫn thanh toán"
          closeLabel="Đóng"
          onClose={() => setShowBuyPopup(false)}
        />
      )}
    <div className="card-hover rounded-xl overflow-hidden flex flex-col cursor-pointer"
      style={{ background: "#ffffff", border: "1px solid #e5e3df" }}
      onClick={() => router.push(`/khoa-hoc/${course.slug}`)}>

      {/* ── Thumbnail ── */}
      <div className="relative overflow-hidden" style={{ background: theme.bg, minHeight: 168 }}>
        <svg className="absolute bottom-0 left-0 w-full" viewBox="0 0 400 40" preserveAspectRatio="none" style={{ height: 40 }}>
          <path d="M0,20 C100,40 300,0 400,20 L400,40 L0,40 Z" fill="rgba(255,255,255,0.12)" />
        </svg>
        <div className="absolute rounded-full" style={{ width: 120, height: 120, background: "rgba(255,255,255,0.1)", top: -30, right: -20 }} />
        <div className="absolute rounded-full" style={{ width: 80, height: 80, background: "rgba(255,255,255,0.08)", bottom: 10, left: -15 }} />

        <div className="relative z-10 flex items-start justify-between px-4 pt-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl"
            style={{ background: "rgba(255,255,255,0.25)", backdropFilter: "blur(4px)" }}>
            <span className="text-white font-black text-sm leading-none">ME</span>
            <span className="text-white text-xs opacity-80 leading-none font-semibold">Midnight Elite</span>
          </div>
          <div className="px-2.5 py-1 rounded-xl text-xs font-black text-white"
            style={{ background: course.tagColor, boxShadow: "0 2px 8px rgba(0,0,0,0.25)" }}>
            -{discount}%
          </div>
        </div>

        <div className="relative z-10 px-4 pt-2 pb-1">
          {course.shortTitle.split("\n").map((line, i) => (
            <div key={i} className="text-white font-black leading-tight select-none"
              style={{ fontSize: i === 0 ? "1.35rem" : "1.55rem", textShadow: "1px 2px 8px rgba(0,0,0,0.3)", letterSpacing: "0.02em" }}>
              {line}
            </div>
          ))}
        </div>

        <div className="relative z-10 mx-3 mt-2 px-3 py-1.5 rounded-lg flex items-center justify-between"
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
          <TeacherTag name={course.teacher} avatar={course.teacherAvatar} size={32} variant="onDark" blur maxNameWidth={80} />
        </div>
      </div>

      {/* ── Card body ── */}
      <div className="flex flex-col flex-1 px-4 pt-3 pb-4">
        <h3 className="text-sm font-bold mb-2 leading-snug" style={{ color: "#1a1a1a" }}>{course.title}</h3>

        <div className="flex gap-1.5 mb-2">
          {course.types.map((t) => (
            <span key={t}
              className="flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold"
              style={t === "Live"
                ? { background: "#FEE2E2", color: "#DC2626" }
                : { background: "#DBEAFE", color: "#1D4ED8" }}>
              {t === "Live" ? "Live" : "Video"}
            </span>
          ))}
        </div>
        {(COURSE_HASHTAGS[course.slug] ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {(COURSE_HASHTAGS[course.slug] ?? []).slice(0, 3).map(tag => (
              <span key={tag} className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: "#f6f5f4", color: "#787671" }}>
                #{tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-base font-bold" style={{ color: "#0068FF" }}>
              {course.price.toLocaleString("vi-VN")} đ
            </div>
            <div className="text-xs line-through" style={{ color: "#9CA3AF" }}>
              {course.originalPrice.toLocaleString("vi-VN")} đ
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {course.tag && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: course.tagColor + "22", color: course.tagColor }}>
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
              <svg width="13" height="13" viewBox="0 0 24 24"
                fill={isFavorited ? "currentColor" : "none"}
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
              </svg>
            </button>
          </div>
        </div>

        <div className="flex gap-2 mt-auto" onClick={e => e.stopPropagation()}>
          <Link href={`/khoa-hoc/${course.slug}`}
            className="flex-1 py-2 rounded-lg text-xs font-medium text-center"
            style={{ background: "#f6f5f4", border: "1px solid #e5e3df", color: "#0068FF", borderRadius: "8px" }}>
            Xem chi tiết
          </Link>
          <button onClick={() => setShowBuyPopup(true)}
            className="flex-1 py-2 rounded-lg text-xs font-bold text-white text-center cursor-pointer"
            style={{ background: "#0068FF", borderRadius: "8px" }}>
            Mua khóa học
          </button>
        </div>
      </div>
    </div>
    </>
  );
}

function KhoaHocContent() {
  const { data: apiCourses } = useCourses();
  const courses = useMemo(() => apiCourses.map(toCourse), [apiCourses]);
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { favoriteIds, toggleFavorite } = useFavorites();

  function handleToggle(slug: string) {
    if (!user) { window.location.href = `/dang-nhap?redirect=/khoa-hoc`; return; }
    toggleFavorite(slug);
  }

  const [activeCategory, setActiveCategory] = useState(searchParams.get("category") ?? "Tất cả");
  const [selectedSlug, setSelectedSlug]     = useState<string | null>(null);
  const [searchQuery, setSearchQuery]       = useState("");

  const filtered = useMemo(() => {
    let result = selectedSlug
      ? courses.filter(c => c.slug === selectedSlug)
      : activeCategory === "Tất cả"
        ? courses
        : courses.filter(c => c.category === activeCategory);
    const q = searchQuery.trim().toLowerCase();
    if (q) result = result.filter(c =>
      c.title.toLowerCase().includes(q) ||
      c.teacher.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q)
    );
    return result;
  }, [courses, selectedSlug, activeCategory, searchQuery]);

  function selectCourse(slug: string) {
    setSelectedSlug(slug);
    setActiveCategory("Tất cả");
  }
  function selectAll() {
    setSelectedSlug(null);
    setActiveCategory("Tất cả");
  }
  function selectCategory(cat: string) {
    setActiveCategory(cat);
    setSelectedSlug(null);
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-12 max-w-7xl mx-auto">

      {/* Page title */}
      <div className="text-center mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold mb-3" style={{ color: "#1a1a1a", letterSpacing: "-0.5px" }}>
          Chọn <span style={{ color: "#0068FF" }}>lộ trình</span> phù hợp với bạn
        </h1>
        <p className="text-sm max-w-xl mx-auto" style={{ color: "#787671" }}>
          Mỗi khóa học được thiết kế sát đề thi thực tế.
        </p>
      </div>

      <div className="flex gap-7 items-start">

        {/* ── Sidebar ── */}
        <aside className="hidden lg:flex flex-col w-56 flex-shrink-0 sticky top-24 rounded-xl overflow-hidden"
          style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
          <div className="px-4 py-3.5" style={{ background: "#f6f5f4", borderBottom: "1px solid #e5e3df" }}>
            <p className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: "#787671" }}>
              Danh mục
            </p>
          </div>

          <button onClick={selectAll}
            className="w-full text-left px-4 py-3 text-sm font-medium transition-colors"
            style={{
              color: !selectedSlug && activeCategory === "Tất cả" ? "#0068FF" : "#37352f",
              background: !selectedSlug && activeCategory === "Tất cả" ? "#dcecfa" : "transparent",
              borderBottom: "1px solid #e5e3df",
              borderLeft: !selectedSlug && activeCategory === "Tất cả" ? "2px solid #0068FF" : "2px solid transparent",
            }}>
            Tất cả khoá học
          </button>

          <div className="overflow-y-auto" style={{ maxHeight: "60vh" }}>
            {courses.map(course => (
              <button key={course.slug} onClick={() => selectCourse(course.slug)}
                className="w-full text-left px-4 py-2.5 text-xs font-medium transition-colors"
                style={{
                  color: selectedSlug === course.slug ? "#0068FF" : "#787671",
                  background: selectedSlug === course.slug ? "#dcecfa" : "transparent",
                  borderBottom: "1px solid #e5e3df",
                  borderLeft: selectedSlug === course.slug ? "2px solid #0068FF" : "2px solid transparent",
                  lineHeight: "1.4",
                }}>
                {course.title}
              </button>
            ))}
          </div>
        </aside>

        {/* ── Main content ── */}
        <div className="flex-1 min-w-0">

          {/* Search */}
          <div className="relative mb-5">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#a4a097" }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Tìm khóa học, giáo viên..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setSelectedSlug(null); }}
              className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl outline-none transition-shadow focus:shadow-[0_0_0_2px_#0068FF33]"
              style={{ background: "#f6f5f4", border: "1px solid #e5e3df", color: "#1a1a1a" }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-full"
                style={{ background: "#c8c4be", color: "#fff" }}>
                <svg width="8" height="8" viewBox="0 0 12 12" fill="currentColor"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
              </button>
            )}
          </div>

          {/* Mobile pills */}
          <div className="flex flex-wrap gap-2 mb-6 lg:hidden">
            {categories.map(cat => (
              <button key={cat} onClick={() => selectCategory(cat)}
                className="px-4 py-2 rounded-md text-sm font-medium transition-colors"
                style={activeCategory === cat && !selectedSlug
                  ? { background: "#0068FF", color: "white", borderRadius: "8px" }
                  : { background: "#ffffff", border: "1px solid #e5e3df", color: "#787671", borderRadius: "8px" }
                }>
                {cat}
              </button>
            ))}
          </div>

          {/* Desktop pills */}
          <div className="hidden lg:flex flex-wrap gap-2 mb-6">
            {categories.map(cat => (
              <button key={cat} onClick={() => selectCategory(cat)}
                className="px-4 py-1.5 rounded-md text-sm font-medium transition-colors"
                style={activeCategory === cat && !selectedSlug
                  ? { background: "#0068FF", color: "white", borderRadius: "8px" }
                  : { background: "#ffffff", border: "1px solid #e5e3df", color: "#787671", borderRadius: "8px" }
                }>
                {cat}
              </button>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {filtered.map(course => (
              <CourseCard
                key={course.slug}
                course={course}
                isFavorited={favoriteIds.has(course.slug)}
                onToggleFavorite={() => handleToggle(course.slug)}
              />
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-16 rounded-xl"
              style={{ background: "#f6f5f4", border: "1px solid #e5e3df" }}>
              <p className="text-base font-semibold mb-2" style={{ color: "#9CA3AF" }}>
                {searchQuery ? `Không tìm thấy "${searchQuery}"` : "Không có khóa học nào"}
              </p>
              <button onClick={() => { selectAll(); setSearchQuery(""); }} className="text-sm font-semibold" style={{ color: "#0068FF" }}>Xem tất cả</button>
            </div>
          )}
        </div>
      </div>

      {/* Guarantee bar */}
      <div className="mt-12 rounded-xl p-6 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center"
        style={{ background: "#f6f5f4", border: "1px solid #e5e3df" }}>
        {[
          { title: "Kích hoạt nhanh chóng", desc: "Admin duyệt và kích hoạt tài khoản trong vòng 24 giờ" },
          { title: "Học trọn đời",          desc: "Mua 1 lần, xem không giới hạn" },
          { title: "Hỏi bài không giới hạn",  desc: "Trợ giảng người thật phản hồi trong ngày, AI hỗ trợ ngoài giờ" },
        ].map(g => (
          <div key={g.title}>
            <div className="text-sm font-bold mb-1" style={{ color: "#1a1a1a" }}>{g.title}</div>
            <div className="text-xs" style={{ color: "#787671" }}>{g.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function KhoaHocPage() {
  return (
    <Suspense>
      <KhoaHocContent />
    </Suspense>
  );
}
