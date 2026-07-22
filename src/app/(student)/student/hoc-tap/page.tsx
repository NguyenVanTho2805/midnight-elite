"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, useMemo, Suspense } from "react";
import Link from "next/link";
import { ChevronDown, Play, Eye, Lock, ArrowRight, BookOpen } from "griddy-icons";
import { useProgress } from "@/hooks/useProgress";
import { useEnrollments } from "@/hooks/useEnrollments";
import { parseLessonType } from "@/lib/types";

interface Lesson {
  id: string; code: string; title: string; type: string;
  duration?: string | null; isLocked: boolean; isFree: boolean;
  statsViews?: number;
}
interface Chapter { id: string; title: string; order: number; lessons: Lesson[]; }
interface Section { id: string; title: string; order: number; chapters: Chapter[]; }
interface Course {
  id: string; name: string; instructor: string; category: string;
  bg: string; strip: string; hours: number; lessons: number;
  sections: Section[];
}

function TypeBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    record:   { label: "Video",    color: "#0068FF", bg: "#EFF6FF" },
    live:     { label: "Live",     color: "#DC2626", bg: "#FEF2F2" },
    quiz:     { label: "Bài tập", color: "#FE9900", bg: "#FFF7ED" },
    document: { label: "Tài liệu", color: "#6B7280", bg: "#F9FAFB" },
  };
  const s = map[parseLessonType(type)];
  return (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ color: s.color, background: s.bg }}>
      {s.label}
    </span>
  );
}

function HocTapContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const courseId = searchParams.get("course");

  const [course, setCourse]   = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

  const { completedIds, loading: progressLoading } = useProgress();
  const { enrolledIds, loading: enrollmentsLoading } = useEnrollments();

  useEffect(() => {
    if (!courseId) { setLoading(false); return; }
    setLoading(true);
    fetch(`/api/courses/${courseId}`, { credentials: "same-origin" })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: Course) => {
        setCourse(data);
        setOpenSections(new Set(data.sections.map(s => s.id)));
      })
      .catch(() => setError("Không tìm thấy khóa học"))
      .finally(() => setLoading(false));
  }, [courseId]);

  const allLessons = useMemo(
    () => course?.sections.flatMap(s => s.chapters.flatMap(c => c.lessons)) ?? [],
    [course]
  );
  const completedCount = allLessons.filter(l => completedIds.has(l.id)).length;
  const pct = Math.round(completedCount * 100 / Math.max(allLessons.length, 1));

  const nextLesson = useMemo(
    () => allLessons.find(l => !completedIds.has(l.id) && !l.isLocked),
    [allLessons, completedIds]
  );

  function toggleSection(id: string) {
    setOpenSections(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  if (!courseId) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <BookOpen size={40} style={{ color: "#9CA3AF" }} />
        <p className="text-sm" style={{ color: "#9CA3AF" }}>Không có khóa học nào được chọn.</p>
        <Link href="/khoa-hoc" className="text-sm font-semibold" style={{ color: "#0068FF" }}>← Khóa học</Link>
      </div>
    );
  }

  const isEnrolled = !enrollmentsLoading && courseId ? enrolledIds.has(courseId) : null;

  if (loading || progressLoading || enrollmentsLoading) {
    return (
      <div className="space-y-4">
        <div className="h-7 w-48 rounded-xl animate-pulse" style={{ background: "#e5e3df" }} />
        <div className="h-24 rounded-xl animate-pulse" style={{ background: "#e5e3df" }} />
        {[1,2,3].map(i => (
          <div key={i} className="rounded-xl overflow-hidden" style={{ border: "1px solid #e5e3df" }}>
            <div className="h-10 animate-pulse" style={{ background: "#f6f5f4" }} />
            {[1,2,3].map(j => (
              <div key={j} className="h-12 mx-4 my-2 rounded-lg animate-pulse" style={{ background: "#f0ede9" }} />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-sm" style={{ color: "#DC2626" }}>{error || "Không tìm thấy khóa học"}</p>
        <Link href="/khoa-hoc" className="text-sm font-semibold" style={{ color: "#0068FF" }}>← Khóa học</Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Back button + breadcrumb */}
      <div className="flex items-center gap-3">
        <Link href="/khoa-hoc"
          className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors hover:bg-[#eceae6]"
          style={{ background: "#f6f5f4", border: "1px solid #e5e3df", color: "#0068FF" }}>
          ← Khóa học
        </Link>
        <span className="text-sm font-medium truncate" style={{ color: "#9CA3AF" }}>{course.name}</span>
      </div>

      {/* Course header card */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #e5e3df" }}>
        <div className="h-2" style={{ background: course.strip || "#0068FF" }} />
        <div className="p-5 flex items-start gap-4" style={{ background: "#ffffff" }}>
          <div className="flex-1 min-w-0">
            <p className="text-xs mb-1" style={{ color: "#9CA3AF" }}>{course.category}</p>
            <h1 className="text-xl font-extrabold leading-snug mb-1" style={{ color: "#1E2938" }}>{course.name}</h1>
            <p className="text-sm" style={{ color: "#787671" }}>Gia sư: {course.instructor}</p>
            <div className="flex items-center gap-4 mt-3 text-xs" style={{ color: "#9CA3AF" }}>
              <span className="flex items-center gap-1"><Play size={11} />{course.hours}h video</span>
              <span className="flex items-center gap-1"><BookOpen size={11} />{course.lessons} bài học</span>
            </div>
          </div>
          {/* Progress ring-ish summary */}
          <div className="flex-shrink-0 text-center">
            <p className="text-2xl font-extrabold" style={{ color: "#0068FF" }}>{pct}%</p>
            <p className="text-xs" style={{ color: "#9CA3AF" }}>hoàn thành</p>
            <p className="text-xs mt-1 font-semibold" style={{ color: "#787671" }}>{completedCount}/{allLessons.length} bài</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 mx-5 mb-5 rounded-full overflow-hidden" style={{ background: "#e5e3df" }}>
          <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: "#0068FF" }} />
        </div>

        {/* CTA */}
        <div className="px-5 pb-5">
          {isEnrolled === false ? (
            <div className="space-y-2">
              <p className="text-xs text-center" style={{ color: "#9CA3AF" }}>Bạn chưa đăng ký khóa học này</p>
              <Link href={`/khoa-hoc/${courseId}`}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold text-white"
                style={{ background: "#FE9900" }}>
                Mua khóa học ngay →
              </Link>
            </div>
          ) : nextLesson ? (
            <Link href={`/student/bai-giang/${nextLesson.id}`}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold text-white"
              style={{ background: "#0068FF" }}>
              <Play size={15} />
              {completedCount === 0 ? "Bắt đầu học" : "Tiếp tục học"}
              <ArrowRight size={14} />
            </Link>
          ) : (
            <div className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold"
              style={{ background: "#D1FAE5", color: "#065F46", border: "1px solid #86efac" }}>
              ✓ Đã hoàn thành khóa học
            </div>
          )}
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-2">
        <p className="text-sm font-extrabold" style={{ color: "#1E2938" }}>Nội dung khóa học</p>
        {course.sections.map(section => {
          const lessons = section.chapters.flatMap(c => c.lessons);
          const done    = lessons.filter(l => completedIds.has(l.id)).length;
          const isOpen  = openSections.has(section.id);
          return (
            <div key={section.id} className="rounded-xl overflow-hidden" style={{ border: "1px solid #e5e3df" }}>
              <button onClick={() => toggleSection(section.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
                style={{ background: "#f6f5f4" }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-extrabold uppercase tracking-wide" style={{ color: "#1E2938" }}>
                    {section.title}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>{done}/{lessons.length} bài hoàn thành</p>
                </div>
                <ChevronDown size={14} style={{
                  color: "#9CA3AF",
                  transform: isOpen ? "rotate(180deg)" : "none",
                  transition: "transform 0.2s",
                  flexShrink: 0,
                }} />
              </button>

              {isOpen && (
                <div style={{ background: "#ffffff" }}>
                  {section.chapters.map((chapter, ci) => (
                    <div key={chapter.id}>
                      {section.chapters.length > 1 && (
                        <div className="px-4 py-2" style={{ background: "#fafaf9", borderBottom: "1px solid #f0ede9" }}>
                          <p className="text-xs font-semibold" style={{ color: "#9CA3AF" }}>
                            {ci + 1}. {chapter.title}
                          </p>
                        </div>
                      )}
                      {chapter.lessons.map(lesson => {
                        const isDone    = completedIds.has(lesson.id);
                        const isNext    = lesson.id === nextLesson?.id;
                        return (
                          <button key={lesson.id}
                            onClick={() => !lesson.isLocked && router.push(`/student/bai-giang/${lesson.id}`)}
                            disabled={lesson.isLocked}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#fafaf9]"
                            style={{
                              borderBottom: "1px solid #f0ede9",
                              borderLeft: isNext ? "3px solid #0068FF" : "3px solid transparent",
                              background: isNext ? "#EFF6FF" : "transparent",
                              opacity: lesson.isLocked ? 0.5 : 1,
                              cursor: lesson.isLocked ? "not-allowed" : "pointer",
                            }}>

                            {/* Circle indicator */}
                            <div className="flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center"
                              style={{
                                borderColor: isDone ? "#00A63D" : isNext ? "#0068FF" : "#d1d5db",
                                background: isDone ? "#00A63D" : isNext ? "#EFF6FF" : "transparent",
                              }}>
                              {isDone && (
                                <svg viewBox="0 0 10 8" width="9" height="9" fill="none">
                                  <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                              {!isDone && lesson.isLocked && <Lock size={8} style={{ color: "#9CA3AF" }} />}
                            </div>

                            {/* Lesson info */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm leading-snug truncate"
                                style={{ color: isNext ? "#0068FF" : "#37352f", fontWeight: isDone || isNext ? 600 : 400 }}>
                                {lesson.title}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <TypeBadge type={lesson.type} />
                                {lesson.duration && (
                                  <span className="text-xs flex items-center gap-1" style={{ color: "#c8c4be" }}>
                                    <Play size={9} />{lesson.duration}
                                  </span>
                                )}
                                {lesson.isFree && !lesson.isLocked && (
                                  <span className="text-[10px] font-bold px-1.5 rounded-full" style={{ background: "#d1fae5", color: "#00A63D" }}>FREE</span>
                                )}
                              </div>
                            </div>

                            {isDone && (
                              <Eye size={12} style={{ color: "#00A63D", flexShrink: 0 }} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function HocTapPage() {
  return (
    <Suspense>
      <HocTapContent />
    </Suspense>
  );
}
