"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Edit, ChevronDown, PlayCircle, Tv, FileText, CheckCircle } from "griddy-icons";
import { COURSE_CATEGORIES, CATEGORY_GRADIENT } from "@/lib/courseData";
import { useCourses } from "@/hooks/useCourses";
import { useEnrollments } from "@/hooks/useEnrollments";
import { useProgress } from "@/hooks/useProgress";
import { useFavorites } from "@/hooks/useFavorites";
import TeacherTag from "@/components/TeacherTag";
import { toCatalogCourse, toEnrolledCourse } from "@/lib/apiAdapters";
import { SkeletonCourseCard } from "@/components/Skeleton";
import type { LessonType, EnrolledCourse } from "@/lib/types";

type CatalogCourse = ReturnType<typeof toCatalogCourse>;

interface Deadline {
  lessonId: string; lessonTitle: string; chapterTitle: string;
  courseName: string; courseId: string; category: string;
  azotaUrl: string | null; deadline: string;
  deadlineFormatted: string; daysLeft: number;
  isExpired: boolean; isUrgent: boolean;
}

function useDeadlines() {
  const [data, setData] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/deadlines")
      .then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);
  return { data, loading };
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Chào buổi sáng";
  if (h < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

// ─── TYPE BADGE ───────────────────────────────────────────────────────────────
const TYPE_CFG: Record<LessonType, { label: string; color: string; bg: string; Icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }> }> = {
  record:   { label: "Record",   color: "#0068FF", bg: "#dbeafe", Icon: PlayCircle },
  live:     { label: "LIVE",     color: "#00A63D", bg: "#d1fae5", Icon: Tv },
  quiz:     { label: "Bài Tập",  color: "#FE9900", bg: "#fef3c7", Icon: Edit },
  document: { label: "Tài liệu", color: "#6B7280", bg: "#f3f4f6", Icon: FileText },
};

const CATEGORIES = COURSE_CATEGORIES;

// ─── COURSE THUMBNAIL (enrolled tab) ─────────────────────────────────────────
function CourseThumbnail({ course, totalLessons, doneLessons }: {
  course: EnrolledCourse; totalLessons: number; doneLessons: number;
}) {
  const pct = Math.round(doneLessons * 100 / Math.max(totalLessons, 1));
  return (
    <div className="card-hover rounded-xl overflow-hidden flex flex-col h-full"
      style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
      <div className="relative overflow-hidden" style={{ background: course.bg, minHeight: 148 }}>
        <svg className="absolute bottom-0 left-0 w-full" viewBox="0 0 400 40" preserveAspectRatio="none" style={{ height: 40 }}>
          <path d="M0,20 C100,40 300,0 400,20 L400,40 L0,40 Z" fill="rgba(255,255,255,0.12)" />
        </svg>
        <div className="absolute rounded-full" style={{ width:100, height:100, background:"rgba(255,255,255,0.1)", top:-25, right:-10 }} />
        <div className="relative z-10 flex items-center justify-between px-4 pt-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl"
            style={{ background:"rgba(255,255,255,0.25)", backdropFilter:"blur(4px)" }}>
            <span className="text-white font-black text-sm leading-none">ME</span>
            <span className="text-white text-xs opacity-80 font-semibold">Midnight Elite</span>
          </div>
          <div className="px-2.5 py-1 rounded-xl text-xs font-bold"
            style={{ background:"rgba(0,166,61,0.9)", color:"white" }}>
            ✓ Đã đăng ký
          </div>
        </div>
        <div className="relative z-10 flex items-center justify-between px-4 py-2.5">
          <TeacherTag name={course.instructor} avatar={course.teacherAvatar} size={28} variant="onDark" maxNameWidth={100} />
          <div className="flex gap-1">
            {course.types.map(t => (
              <span key={t} className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: t === "Live" ? "#FEE2E2" : "#DBEAFE", color: t === "Live" ? "#DC2626" : "#1D4ED8" }}>
                {t === "Live" ? "🔴" : "▶"} {t}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="px-4 pt-3 pb-4 flex flex-col flex-1">
        <h3 className="text-sm font-bold mb-3 leading-snug" style={{ color: "#1E2938" }}>{course.title}</h3>
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold" style={{ color: "#6B7280" }}>Tiến độ</span>
            <span className="text-xs font-extrabold" style={{ color: "#0068FF" }}>{pct}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "#f6f5f4" }}>
            <div className="progress-bar h-2 rounded-full" style={{ width: `${pct}%`, background: "#0068FF" }} />
          </div>
          <p className="text-xs mt-1" style={{ color: "#a4a097" }}>{doneLessons}/{totalLessons} bài hoàn thành</p>
        </div>
        <button className="w-full py-2.5 rounded-lg text-xs font-bold text-white mt-auto"
          style={{ background: pct > 0 ? "#0068FF" : "#16a34a", borderRadius: "8px" }}>
          {pct > 0 ? "Tiếp tục học →" : "Bắt đầu học →"}
        </button>
      </div>
    </div>
  );
}

// ─── CATALOG CARD ─────────────────────────────────────────────────────────────
function CatalogCard({ course, isEnrolled, onLearn, isFavorited, onToggleFavorite }: {
  course: CatalogCourse; isEnrolled: boolean; onLearn: () => void;
  isFavorited?: boolean; onToggleFavorite?: () => void;
}) {
  const discount = course.originalPrice && course.originalPrice > course.price
    ? Math.round((1 - course.price / course.originalPrice) * 100)
    : 0;

  const router = useRouter();
  return (
    <div className="rounded-xl overflow-hidden flex flex-col h-full cursor-pointer card-hover"
      style={{ background: "#ffffff", border: "1px solid #e5e3df" }}
      onClick={() => router.push(isEnrolled ? `/student/hoc-tap?course=${course.id}` : `/khoa-hoc/${course.id}`)}>

      {/* Thumbnail */}
      <div className="relative overflow-hidden" style={{ background: course.bg, minHeight: 148 }}>
        <svg className="absolute bottom-0 left-0 w-full" viewBox="0 0 400 40" preserveAspectRatio="none" style={{ height: 40 }}>
          <path d="M0,20 C100,40 300,0 400,20 L400,40 L0,40 Z" fill="rgba(255,255,255,0.12)" />
        </svg>
        <div className="absolute rounded-full" style={{ width:100, height:100, background:"rgba(255,255,255,0.1)", top:-25, right:-10 }} />

        <div className="relative z-10 flex items-center justify-between px-4 pt-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl"
            style={{ background:"rgba(255,255,255,0.25)", backdropFilter:"blur(4px)" }}>
            <span className="text-white font-black text-sm leading-none">ME</span>
            <span className="text-white text-xs opacity-80 font-semibold">Midnight Elite</span>
          </div>
          <div className="flex gap-1.5 items-center">
            {isEnrolled ? (
              <span className="px-2.5 py-1 rounded-xl text-xs font-bold text-white"
                style={{ background:"rgba(0,166,61,0.9)" }}>✓ Đã đăng ký</span>
            ) : (
              <>
                {course.tag && (
                  <span className="px-2.5 py-1 rounded-xl text-xs font-bold text-white"
                    style={{ background: course.tagColor }}>{course.tag}</span>
                )}
                {discount > 0 && (
                  <span className="px-2.5 py-1 rounded-xl text-xs font-bold text-white"
                    style={{ background:"rgba(0,0,0,0.45)" }}>−{discount}%</span>
                )}
              </>
            )}
          </div>
        </div>


        <div className="relative z-10 flex items-center gap-3 px-4 py-1.5" style={{ background: course.strip }}>
          <span className="text-xs font-bold" style={{ color:"#1E2938" }}>📚 {course.lessons} bài</span>
          <span className="text-xs font-bold" style={{ color:"#1E2938" }}>⏱ {course.hours}h</span>
          <span className="ml-auto text-xs font-bold" style={{ color:"#1E2938" }}>{course.category}</span>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pt-3 pb-4 flex flex-col flex-1">
        <h3 className="text-sm font-bold mb-2 leading-snug" style={{ color: "#1E2938" }}>{course.title}</h3>

        <div className="flex items-center gap-2 mb-2">
          <TeacherTag className="flex-1 min-w-0" name={course.instructor} avatar={course.teacherAvatar} size={24} />
          <div className="flex gap-1">
            {course.types.map(t => (
              <span key={t} className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
                style={{ background: t === "Live" ? "#FEE2E2" : "#DBEAFE", color: t === "Live" ? "#DC2626" : "#1D4ED8" }}>
                {t === "Live" ? "🔴" : "▶"} {t}
              </span>
            ))}
          </div>
        </div>

        <p className="text-xs mb-3" style={{ color:"#9CA3AF" }}>Khai giảng: {course.openDate}</p>

        <div className="mt-auto" onClick={e => e.stopPropagation()}>
          {isEnrolled ? (
            <button onClick={onLearn}
              className="w-full py-2.5 rounded-lg text-xs font-bold text-white"
              style={{ background: "#0068FF", borderRadius: "8px" }}>
              Tiếp tục học →
            </button>
          ) : (
            <>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-base font-bold" style={{ color:"#dc2626" }}>
                  {course.price.toLocaleString("vi-VN")}đ
                </span>
                {course.originalPrice && course.originalPrice > course.price && (
                  <span className="text-xs line-through" style={{ color:"#a4a097" }}>
                    {course.originalPrice.toLocaleString("vi-VN")}đ
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={onToggleFavorite}
                  className="flex-1 py-2 rounded-lg text-xs font-bold text-center transition-colors"
                  style={isFavorited
                    ? { background: "#EFF6FF", color: "#0068FF", border: "1px solid #BFDBFE", borderRadius: "8px" }
                    : { background: "#f6f5f4", color: "#787671", border: "1px solid #e5e3df", borderRadius: "8px" }}>
                  {isFavorited ? "✓ Đã lưu" : "Lưu Khóa Học"}
                </button>
                <Link href={`/khoa-hoc/${course.id}`}
                  className="flex-1 py-2 rounded-lg text-xs font-bold text-white text-center"
                  style={{ background:"#0068FF", borderRadius: "8px" }}>
                  Mua ngay
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── CURRICULUM VIEW ──────────────────────────────────────────────────────────
function CurriculumView({ course, onBack }: { course: EnrolledCourse; onBack: () => void }) {
  const router = useRouter();
  const allLessons = course.sections.flatMap(s => s.chapters.flatMap(c => c.lessons.filter(l => !l.isLocked)));
  const done = allLessons.filter(l => l.isCompleted).length;
  const pct  = Math.round(done * 100 / Math.max(allLessons.length, 1));
  const circumference = 2 * Math.PI * 32;

  const initSections = useMemo(() => new Set([course.sections[0].id]), [course]);
  const initChapters = useMemo(() => new Set(course.sections[0].chapters.map(c => c.id)), [course]);
  const [openS, setOpenS] = useState<Set<string>>(initSections);
  const [openC, setOpenC] = useState<Set<string>>(initChapters);

  function toggleS(id: string) { setOpenS(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  function toggleC(id: string) { setOpenC(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }); }

  const TYPE_STATS: { type: LessonType; label: string; color: string }[] = [
    { type: "record",   label: "Record",   color: "#0068FF" },
    { type: "live",     label: "LIVE",     color: "#00A63D" },
    { type: "quiz",     label: "Bài Tập",  color: "#FE9900" },
    { type: "document", label: "Tài liệu", color: "#6B7280" },
  ];

  const catGrad = CATEGORY_GRADIENT[course.category] ?? CATEGORY_GRADIENT["ĐGNL HSA"];
  const SC = { badge: catGrad, color: "#0068FF" };

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-4">
        <button onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold flex-shrink-0 transition-all hover:bg-[#fafafa]"
          style={{ background: "#f6f5f4", border: "1px solid #e5e3df", color: "#0068FF", borderRadius: "8px" }}>
          ← Khóa học
        </button>
        <div>
          <h1 className="text-xl font-extrabold leading-tight" style={{ color: "#1E2938" }}>{course.title}</h1>
          <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>{course.category} · {course.instructor}</p>
        </div>
      </div>

      <div className="rounded-xl p-5" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
        <div className="flex items-center gap-5">
          <div className="relative flex-shrink-0 w-20 h-20">
            <svg viewBox="0 0 80 80" className="w-full h-full" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="40" cy="40" r="32" fill="none" stroke="#e5e3df" strokeWidth="7" />
              <circle cx="40" cy="40" r="32" fill="none"
                stroke={pct === 100 ? "#00A63D" : "#0068FF"} strokeWidth="7"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - pct / 100)}
                strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-base font-extrabold leading-none" style={{ color: pct === 100 ? "#00A63D" : "#0068FF" }}>{pct}%</span>
              <span className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>xong</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-extrabold" style={{ color: "#1E2938" }}>Tiến độ học tập</p>
            <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>{done} / {allLessons.length} bài hoàn thành</p>
            <div className="flex gap-2 mt-2 flex-wrap">
              {TYPE_STATS.map(s => {
                const cnt = allLessons.filter(l => l.type === s.type).length;
                if (!cnt) return null;
                return (
                  <span key={s.type} className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg"
                    style={{ background: `${s.color}15`, color: s.color }}>
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                    {cnt} {s.label}
                  </span>
                );
              })}
            </div>
          </div>
          {done < allLessons.length && (
            <div className="hidden md:flex flex-col items-end gap-1 flex-shrink-0">
              <p className="text-xs" style={{ color: "#9CA3AF" }}>Tiếp tục học</p>
              <button
                onClick={() => {
                  const next = allLessons.find(l => !l.isCompleted && !l.isLocked);
                  if (next) router.push(`/student/bai-giang/${next.id}`);
                }}
                className="px-4 py-2 rounded-lg text-xs font-bold text-white"
                style={{ background: "#0068FF", borderRadius: "8px" }}>
                ▶ Học ngay
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {course.sections.map((section, sIdx) => {
          const secLessons = section.chapters.flatMap(c => c.lessons.filter(l => !l.isLocked));
          const secDone    = secLessons.filter(l => l.isCompleted).length;
          const isOpenS    = openS.has(section.id);

          return (
            <div key={section.id} className="rounded-xl overflow-hidden"
              style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>

              <button onClick={() => toggleS(section.id)}
                className="w-full flex items-center gap-4 px-5 py-4 text-left transition-all relative"
                style={{ background: SC.badge }}>
                <div className="absolute right-0 top-0 w-24 h-24 rounded-full pointer-events-none"
                  style={{ background: "rgba(255,255,255,0.07)", transform: "translate(30%,-40%)" }} />
                <div className="flex flex-col items-center justify-center w-12 h-12 rounded-2xl flex-shrink-0 font-black"
                  style={{ background: "rgba(255,255,255,0.2)", backdropFilter: "blur(4px)" }}>
                  <span className="text-xs leading-none text-white opacity-80">Phần</span>
                  <span className="text-lg leading-none text-white">{sIdx + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-extrabold text-white">{section.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.65)" }}>
                    {section.chapters.length} chương · {secLessons.length} bài
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="hidden sm:flex flex-col items-end">
                    <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.25)" }}>
                      <div className="h-1.5 rounded-full transition-all"
                        style={{ width: `${secDone * 100 / Math.max(secLessons.length, 1)}%`, background: "rgba(255,255,255,0.9)" }} />
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.65)" }}>{secDone}/{secLessons.length}</p>
                  </div>
                  <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.2)" }}>
                    <motion.div animate={{ rotate: isOpenS ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronDown size={15} style={{ color: "white" }} />
                    </motion.div>
                  </div>
                </div>
              </button>

              <AnimatePresence initial={false}>
              {isOpenS && (
                <motion.div key="sc"
                  initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: "easeInOut" }}
                  style={{ overflow: "hidden", borderTop: "1px solid #e5e3df" }}>
                  <div className="px-4 pb-4 space-y-3">
                    {section.chapters.map((chapter, cIdx) => {
                      const visibleLessons = chapter.lessons.filter(l => !l.isLocked);
                      const chDone  = visibleLessons.filter(l => l.isCompleted).length;
                      const chAll   = visibleLessons.length;
                      const isDone  = chDone === chAll && chAll > 0;
                      const isOpenC = openC.has(chapter.id);

                      return (
                        <div key={chapter.id} className="mt-3">
                          <button onClick={() => toggleC(chapter.id)}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all hover:bg-[#fafafa]"
                            style={{ background: "#f6f5f4" }}>
                            <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                              style={{ background: isDone ? "#00A63D" : "#0068FF" }}>
                              {isDone ? "✓" : cIdx + 1}
                            </div>
                            <p className="flex-1 text-sm font-bold" style={{ color: "#374151" }}>{chapter.title}</p>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                              style={{ background: isDone ? "#d1fae5" : "#DBEAFE", color: isDone ? "#00A63D" : "#0068FF" }}>
                              {chDone}/{chAll}
                            </span>
                            <motion.div animate={{ rotate: isOpenC ? 180 : 0 }} transition={{ duration: 0.2 }} style={{ flexShrink: 0 }}>
                              <ChevronDown size={13} style={{ color: "#9CA3AF" }} />
                            </motion.div>
                          </button>

                          <AnimatePresence initial={false}>
                          {isOpenC && (
                            <motion.div key="cc"
                              initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: "easeInOut" }}
                              style={{ overflow: "hidden" }}>
                              <div className="mt-1.5 rounded-xl overflow-hidden" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
                                {visibleLessons.map((lesson, lIdx) => {
                                  const cfg = TYPE_CFG[lesson.type];
                                  const isLast = lIdx === visibleLessons.length - 1;
                                  return (
                                    <button key={lesson.id}
                                      onClick={() => router.push(`/student/bai-giang/${lesson.id}`)}
                                      className="w-full flex items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-white/60"
                                      style={{ borderBottom: isLast ? "none" : "1px solid #e5e3df", cursor: "pointer" }}>
                                      <div className="flex-shrink-0 w-6 flex items-center justify-center">
                                        {lesson.isCompleted
                                          ? <CheckCircle size={20} style={{ color: "#00A63D" }} />
                                          : <cfg.Icon size={20} style={{ color: cfg.color }} />
                                        }
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium leading-snug" style={{ color: "#1E2938" }}>{lesson.title}</p>
                                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                          <span className="text-xs font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
                                          {lesson.duration && <span className="text-xs" style={{ color: "#9CA3AF" }}>/ {lesson.duration}</span>}
                                          {lesson.stats.materials > 0 && <span className="text-xs" style={{ color: "#9CA3AF" }}>/ {lesson.stats.materials} tài liệu</span>}
                                          {lesson.stats.views > 0 && <span className="text-xs" style={{ color: "#9CA3AF" }}>/ {lesson.stats.views > 999 ? (lesson.stats.views / 1000).toFixed(1) + "K" : lesson.stats.views} lượt xem</span>}
                                          {lesson.isFree && <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ background: "#d1fae5", color: "#00A63D" }}>FREE</span>}
                                        </div>
                                      </div>
                                      <div className="flex-shrink-0 w-5 text-center">
                                        {lesson.isCompleted
                                          ? <CheckCircle size={16} style={{ color: "#00A63D" }} />
                                          : <span className="text-base font-light" style={{ color: "#c8c4be" }}>−</span>
                                        }
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </motion.div>
                          )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────
function StudentContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const [showMy,  setShowMy]  = useState(true);
  const [showFav, setShowFav] = useState(true);
  const [showAll, setShowAll] = useState(true);
  const [catFilter, setCat]   = useState("Tất cả");

  const { data: apiCourses, loading: coursesLoading } = useCourses();
  const { enrolledIds }                               = useEnrollments();
  const { favoriteIds, toggleFavorite }               = useFavorites();
  const { completedIds, courseCompletion }            = useProgress();
  const { data: deadlines }                           = useDeadlines();

  const ALL_COURSES      = apiCourses.map(toCatalogCourse);
  const ENROLLED_COURSES = apiCourses.filter(c => enrolledIds.has(c.id));
  const FAVORITE_COURSES = ALL_COURSES.filter(c => favoriteIds.has(c.id));

  function openCourse(courseId: string) {
    router.push(`/student/hoc-tap?course=${courseId}`);
  }

  const filtered = useMemo(
    () => catFilter === "Tất cả" ? ALL_COURSES : ALL_COURSES.filter(c => c.category === catFilter),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [catFilter, apiCourses],
  );

  return (
    <div className="space-y-4">
      {/* Welcome banner */}
      <div className="notion-hero-band rounded-xl p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm font-medium mb-1" style={{ color: "rgba(255,255,255,0.7)" }}>{getGreeting()}</p>
            <h1 className="text-2xl font-bold text-white mb-2" style={{ letterSpacing: "-0.5px" }}>{user?.name ?? "Học viên"}</h1>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full text-xs font-medium text-white" style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)" }}>{enrolledIds.size} khóa học</span>
              <span className="px-3 py-1 rounded-full text-xs font-medium text-white" style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)" }}>{completedIds.size} bài đã học</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold text-white">{completedIds.size}</div>
            <div className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>Bài hoàn thành</div>
          </div>
        </div>
      </div>

      {/* Section: Khóa học của tôi */}
      <div className="rounded-xl overflow-hidden" style={{ background:"#ffffff", border: "1px solid #e5e3df" }}>
        <button onClick={() => setShowMy(p => !p)}
          className="w-full flex items-center gap-3 px-5 py-4 text-left"
          style={{ borderBottom: showMy ? "1px solid #e5e3df" : "none" }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#0068FF" }}>
            <span className="text-base">📚</span>
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <p className="text-sm font-extrabold" style={{ color:"#1E2938" }}>Khóa học của tôi</p>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background:"#DBEAFE", color:"#0068FF" }}>
              {ENROLLED_COURSES.length}
            </span>
          </div>
          <svg className="w-5 h-5 flex-shrink-0 transition-transform" style={{ color:"#9CA3AF", transform: showMy ? "rotate(180deg)" : "none" }}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {showMy && (
          <div className="p-5">
            {coursesLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {[1,2].map(i => <SkeletonCourseCard key={i} />)}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {ENROLLED_COURSES.map(c => (
                  <div key={c.id} className="cursor-pointer card-hover" onClick={() => openCourse(c.id)}>
                    <CourseThumbnail
                      course={toEnrolledCourse(c as Parameters<typeof toEnrolledCourse>[0], completedIds)}
                      totalLessons={c.lessons}
                      doneLessons={courseCompletion[c.id] ?? 0}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section: Khóa học đã lưu */}
      {FAVORITE_COURSES.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ background:"#ffffff", border: "1px solid #e5e3df" }}>
          <button onClick={() => setShowFav(p => !p)}
            className="w-full flex items-center gap-3 px-5 py-4 text-left"
            style={{ borderBottom: showFav ? "1px solid #e5e3df" : "none" }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background:"linear-gradient(135deg,#FF2157,#cc0033)" }}>
              <span className="text-base">❤️</span>
            </div>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <p className="text-sm font-extrabold" style={{ color:"#1E2938" }}>Đã lưu</p>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background:"#fee2e2", color:"#FF2157" }}>
                {FAVORITE_COURSES.length}
              </span>
            </div>
            <svg className="w-5 h-5 flex-shrink-0 transition-transform" style={{ color:"#9CA3AF", transform: showFav ? "rotate(180deg)" : "none" }}
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showFav && (
            <div className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {FAVORITE_COURSES.map(c => (
                  <CatalogCard key={c.id} course={c}
                    isEnrolled={enrolledIds.has(c.id)}
                    onLearn={() => openCourse(c.id)}
                    isFavorited
                    onToggleFavorite={() => toggleFavorite(c.id)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Section: Tất cả khóa học */}
      <div className="rounded-xl overflow-hidden" style={{ background:"#ffffff", border: "1px solid #e5e3df" }}>
        <button onClick={() => setShowAll(p => !p)}
          className="w-full flex items-center gap-3 px-5 py-4 text-left"
          style={{ borderBottom: showAll ? "1px solid #e5e3df" : "none" }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background:"linear-gradient(135deg,#FE9900,#e68800)" }}>
            <span className="text-base">🗂</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-extrabold" style={{ color:"#1E2938" }}>Tất cả khóa học</p>
            <p className="text-xs mt-0.5" style={{ color:"#9CA3AF" }}>
              {ALL_COURSES.length} khóa học · {CATEGORIES.length - 1} danh mục
            </p>
          </div>
          <svg className="w-5 h-5 flex-shrink-0 transition-transform" style={{ color:"#9CA3AF", transform: showAll ? "rotate(180deg)" : "none" }}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {showAll && (
          <div className="p-5 space-y-4">
            <div className="flex gap-2 flex-wrap">
              {CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setCat(cat)}
                  className="px-4 py-1.5 rounded-md text-sm font-medium transition-colors"
                  style={catFilter === cat
                    ? { background:"#0068FF", color:"white", borderRadius: "8px" }
                    : { background:"#ffffff", border: "1px solid #e5e3df", color:"#787671", borderRadius: "8px" }}>
                  {cat}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {coursesLoading
                ? [1,2,3].map(i => <SkeletonCourseCard key={i} />)
                : filtered.map(course => (
                    <CatalogCard
                      key={course.id}
                      course={course}
                      isEnrolled={enrolledIds.has(course.id)}
                      onLearn={() => openCourse(course.id)}
                      isFavorited={favoriteIds.has(course.id)}
                      onToggleFavorite={() => toggleFavorite(course.id)}
                    />
                  ))
              }
            </div>
          </div>
        )}
      </div>

      {/* Section: Bài tập sắp đến hạn */}
      {deadlines.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-bold pt-2" style={{ color: "#1a1a1a" }}>Bài tập sắp đến hạn</h2>
          {deadlines.slice(0, 5).map(a => (
            <div key={a.lessonId} className="flex items-center gap-4 p-4 rounded-xl"
              style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                style={{ background: "#dbeafe" }}>
                📝
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: "#1a1a1a" }}>{a.courseName} — {a.lessonTitle}</p>
                <p className="text-xs mt-0.5" style={{ color: a.isUrgent ? "#dc2626" : "#b45309" }}>
                  {a.daysLeft === 0 ? "Hôm nay hết hạn!" : a.daysLeft === 1 ? `Ngày mai · ${a.deadlineFormatted}` : `Còn ${a.daysLeft} ngày · ${a.deadlineFormatted}`}
                </p>
              </div>
              {a.azotaUrl ? (
                <a href={a.azotaUrl} target="_blank" rel="noopener noreferrer"
                  className="flex-shrink-0 px-3 py-2 rounded-lg text-xs font-semibold text-white"
                  style={{ background: a.isUrgent ? "#dc2626" : "#b45309", borderRadius: "8px" }}>
                  Nộp bài
                </a>
              ) : (
                <Link href={`/student/bai-giang/${a.lessonId}`}
                  className="flex-shrink-0 px-3 py-2 rounded-lg text-xs font-semibold text-white"
                  style={{ background: "#0068FF", borderRadius: "8px" }}>
                  Xem bài
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function StudentPage() {
  return (
    <Suspense>
      <StudentContent />
    </Suspense>
  );
}
