"use client";

import { useState, useMemo, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { COURSE_CATEGORIES, CATEGORY_GRADIENT, COURSE_HASHTAGS } from "@/lib/courseData";
import { useCourses } from "@/hooks/useCourses";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/contexts/AuthContext";
import PopupBuyRequired from "@/components/PopupBuyRequired";
import TeacherTag from "@/components/TeacherTag";
import { useEnrollments } from "@/hooks/useEnrollments";
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

function CourseCard({ course, inCart, onToggleCart, isEnrolled }: {
  course: Course;
  inCart: boolean;
  onToggleCart: () => void;
  isEnrolled: boolean;
}) {
  const router = useRouter();
  const [showBuyPopup, setShowBuyPopup] = useState(false);
  const discount = course.originalPrice > course.price
    ? Math.round((1 - course.price / course.originalPrice) * 100) : 0;
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
          {discount > 0 && (
            <div className="px-2.5 py-1 rounded-xl text-xs font-black text-white"
              style={{ background: course.tagColor ?? "#FF2157", boxShadow: "0 2px 8px rgba(0,0,0,0.25)" }}>
              -{discount}%
            </div>
          )}
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
        <h3 className="text-sm font-bold mb-2.5 leading-snug" style={{ color: "#1a1a1a" }}>{course.title}</h3>

        {/* Types + hashtags in one row */}
        <div className="flex flex-wrap items-center gap-1 mb-3">
          {course.types.map((t) => (
            <span key={t}
              className="px-2 py-0.5 rounded text-[11px] font-semibold"
              style={t === "Live"
                ? { background: "#FEE2E2", color: "#DC2626" }
                : { background: "#DBEAFE", color: "#1D4ED8" }}>
              {t}
            </span>
          ))}
          {(COURSE_HASHTAGS[course.slug] ?? []).slice(0, 2).map(tag => (
            <span key={tag} className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: "#f6f5f4", color: "#787671" }}>
              #{tag}
            </span>
          ))}
        </div>

        {/* Price row */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-base font-bold" style={{ color: "#0068FF" }}>
            {course.price.toLocaleString("vi-VN")} đ
          </span>
          {course.originalPrice > course.price && (
            <span className="text-xs line-through" style={{ color: "#bbb8b1" }}>
              {course.originalPrice.toLocaleString("vi-VN")} đ
            </span>
          )}
          {course.tag && (
            <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: (course.tagColor ?? "#FF2157") + "22", color: course.tagColor ?? "#FF2157" }}>
              {course.tag}
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mt-auto" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => onToggleCart()}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-all active:scale-95"
            style={inCart
              ? { background: "#EFF6FF", color: "#0068FF", border: "1px solid #BFDBFE" }
              : { background: "#f6f5f4", color: "#787671", border: "1px solid #e5e3df" }}>
            <svg width="12" height="12" viewBox="0 0 24 24"
              fill={inCart ? "currentColor" : "none"}
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
            </svg>
            {inCart ? "Đã lưu" : "Lưu Khóa Học"}
          </button>
          {isEnrolled ? (
            <Link
              href={`/student/hoc-tap?course=${course.slug}`}
              onClick={e => e.stopPropagation()}
              className="flex-1 py-2.5 rounded-lg text-xs font-bold text-white text-center transition-all hover:brightness-105 active:scale-95"
              style={{ background: "#16a34a" }}>
              Tiếp tục học →
            </Link>
          ) : (
            <button onClick={() => setShowBuyPopup(true)}
              className="flex-1 py-2.5 rounded-lg text-xs font-bold text-white text-center cursor-pointer transition-all hover:brightness-105 active:scale-95"
              style={{ background: "#0068FF" }}>
              Mua khóa học
            </button>
          )}
        </div>
      </div>
    </div>
    </>
  );
}

function KhoaHocContent() {
  const { data: apiCourses, loading: coursesLoading } = useCourses();
  const courses = useMemo(() => apiCourses.map(toCourse), [apiCourses]);
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { inCart, addToCart, removeFromCart } = useCart();
  const { enrolledIds } = useEnrollments();

  function handleToggle(slug: string) {
    if (!user) { window.location.href = `/dang-nhap?redirect=/khoa-hoc`; return; }
    inCart(slug) ? removeFromCart(slug) : addToCart(slug);
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
              placeholder="Tìm khóa học, gia sư..."
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
            {coursesLoading && [1,2,3,4,5,6].map(i => (
              <div key={i} className="rounded-xl overflow-hidden animate-pulse" style={{ background:"#f6f5f4", border:"1px solid #e5e3df" }}>
                <div className="h-36" style={{ background:"#e5e3df" }} />
                <div className="p-4 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-gray-200" />
                  <div className="h-3 w-1/2 rounded bg-gray-200" />
                  <div className="h-6 w-24 rounded bg-gray-200 mt-3" />
                </div>
              </div>
            ))}
            {!coursesLoading && filtered.map(course => (
              <CourseCard
                key={course.slug}
                course={course}
                inCart={inCart(course.slug)}
                onToggleCart={() => handleToggle(course.slug)}
                isEnrolled={enrolledIds.has(course.slug)}
              />
            ))}
          </div>

          {!coursesLoading && filtered.length === 0 && (
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
