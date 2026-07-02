"use client";

import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { useCourses } from "@/hooks/useCourses";
import { useEnrollments } from "@/hooks/useEnrollments";
import { useProgress } from "@/hooks/useProgress";
import { useFavorites } from "@/hooks/useFavorites";
import { toEnrolledCourse } from "@/lib/apiAdapters";

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

export default function StudentDashboardPage() {
  const { user } = useAuth();
  const { data: apiCourses }    = useCourses();
  const { enrolledIds }         = useEnrollments();
  const { completedIds }        = useProgress();
  const { data: deadlines }     = useDeadlines();
  const { favoriteIds, loading: favLoading } = useFavorites();
  const catalogCourses = apiCourses.map(c => ({ slug: c.id, title: c.name }));

  const savedCourses = useMemo(
    () => apiCourses.filter(c => favoriteIds.has(c.id)),
    [apiCourses, favoriteIds]
  );

  const enrolledCourses = useMemo(() => apiCourses
    .filter(c => enrolledIds.has(c.id))
    .map(c => {
      const ec = toEnrolledCourse(c as Parameters<typeof toEnrolledCourse>[0], completedIds);
      const allLessons = ec.sections.flatMap(s => s.chapters.flatMap(ch => ch.lessons));
      const completed  = allLessons.filter(l => l.isCompleted).length;
      const nextLesson = allLessons.find(l => !l.isCompleted && !l.isLocked);
      return {
        id: c.id, title: c.name, color: "#0068FF", daysLeft: 180,
        progress:         Math.round(completed * 100 / Math.max(allLessons.length, 1)),
        totalLessons:     allLessons.length,
        completedLessons: completed,
        nextLesson:       nextLesson?.title ?? "Hoàn thành khóa học",
        nextLessonId:     nextLesson?.id ?? "",
      };
    }), [apiCourses, enrolledIds, completedIds]);

  return (
    <div className="flex items-start -mx-4 md:-mx-8 -mt-6 min-h-screen">

      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 flex-shrink-0 sticky top-[72px] self-start"
        style={{ minHeight: "calc(100vh - 72px)", background: "#f6f5f4", borderRight: "1px solid #e5e3df" }}>

        <Link href="/student/hoc-tap"
          className="flex items-center gap-3 px-5 py-4 text-sm font-semibold transition-colors hover:bg-white"
          style={{ color: "#1a1a1a", borderBottom: "1px solid #e5e3df" }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "#dbeafe" }}>
            <svg className="w-4 h-4" fill="none" stroke="#0068FF" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
            </svg>
          </div>
          Khóa học của tôi
        </Link>

        <div className="flex items-center gap-3 px-5 py-3.5"
          style={{ background: "#fee2e2", borderBottom: "1px solid #fecaca" }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#dc2626" }}>
            <svg className="w-4 h-4" fill="white" viewBox="0 0 24 24">
              <rect x="3" y="3" width="7" height="7" rx="1.5"/>
              <rect x="14" y="3" width="7" height="7" rx="1.5"/>
              <rect x="3" y="14" width="7" height="7" rx="1.5"/>
              <rect x="14" y="14" width="7" height="7" rx="1.5"/>
            </svg>
          </div>
          <span className="text-sm font-bold" style={{ color: "#dc2626" }}>Danh mục khoá học</span>
        </div>

        <Link href="/khoa-hoc"
          className="flex items-center px-5 py-3 text-sm font-semibold transition-colors hover:bg-white"
          style={{ color: "#dc2626", background: "#fee2e2", borderBottom: "1px solid #e5e3df" }}>
          Tất cả khoá học
        </Link>

        <div className="overflow-y-auto flex-1">
          {catalogCourses.map(course => (
            <Link key={course.slug} href={`/khoa-hoc/${course.slug}`}
              className="block px-5 py-3 text-xs font-medium uppercase tracking-wide transition-colors hover:bg-white"
              style={{ color: "#787671", borderBottom: "1px solid #e5e3df", lineHeight: "1.5" }}>
              {course.title}
            </Link>
          ))}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 px-4 md:px-8 py-6 space-y-6">

        {/* Welcome banner */}
        <div className="notion-hero-band rounded-xl p-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <p className="text-sm font-medium mb-1" style={{ color: "rgba(255,255,255,0.7)" }}>{getGreeting()}</p>
              <h1 className="text-2xl font-bold text-white mb-2" style={{ letterSpacing: "-0.5px" }}>{user?.name ?? "Học viên"}</h1>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-3 py-1 rounded-full text-xs font-medium text-white" style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)" }}>Rank #47 / 312</span>
                <span className="px-3 py-1 rounded-full text-xs font-medium text-white" style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)" }}>Streak 12 ngày</span>
                <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: "#FDE047", color: "#1a1a1a" }}>GPA 8.4</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold text-white">1,240</div>
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>EXP tích lũy</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Right column — Đã lưu ── */}
          <div className="order-first lg:order-last space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold" style={{ color: "#1a1a1a" }}>Đã lưu</h2>
              <Link href="/khoa-hoc" className="text-xs font-semibold" style={{ color: "#0068FF" }}>Khám phá →</Link>
            </div>
            {favLoading ? (
              <div className="space-y-2 animate-pulse">
                {[1, 2].map(i => <div key={i} className="h-14 rounded-xl" style={{ background: "#f6f5f4" }} />)}
              </div>
            ) : savedCourses.length === 0 ? (
              <div className="p-4 rounded-xl text-center space-y-1" style={{ background: "#f6f5f4", border: "1px solid #e5e3df" }}>
                <p className="text-xs" style={{ color: "#a4a097" }}>Chưa lưu khóa học nào.</p>
                <Link href="/khoa-hoc" className="text-xs font-semibold block" style={{ color: "#0068FF" }}>
                  Xem các khóa học →
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {savedCourses.map(c => (
                  <Link key={c.id} href={`/khoa-hoc/${c.id}`}
                    className="flex items-center gap-3 p-3 rounded-xl transition-colors hover:bg-[#f0eeec]"
                    style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
                    <div className="w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center text-white text-xs font-black"
                      style={{ background: "#0068FF" }}>
                      ME
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold leading-snug truncate" style={{ color: "#1a1a1a" }}>{c.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: "#787671" }}>
                        {c.price.toLocaleString("vi-VN")} đ
                      </p>
                    </div>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#c8c4be" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold" style={{ color: "#1a1a1a" }}>Khóa học của tôi</h2>
              <Link href="/student/hoc-tap" className="text-xs font-semibold" style={{ color: "#0068FF" }}>Xem tất cả →</Link>
            </div>

            {enrolledCourses.map(course => (
              <div key={course.id} className="rounded-xl p-5" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
                <div className="flex items-start justify-between mb-3 gap-2">
                  <div className="min-w-0 flex-1">
                    <Link href={`/student/hoc-tap?course=${course.id}`}
                      className="font-bold text-sm hover:underline block truncate"
                      style={{ color: "#0068FF" }}>
                      {course.title}
                    </Link>
                    <p className="text-xs mt-0.5" style={{ color: "#a4a097" }}>{course.completedLessons}/{course.totalLessons} bài · còn {course.daysLeft} ngày</p>
                  </div>
                  <span className="text-lg font-bold flex-shrink-0" style={{ color: course.color }}>{course.progress}%</span>
                </div>
                <div className="h-2 rounded-full mb-4" style={{ background: "#f6f5f4" }}>
                  <div className="h-2 rounded-full" style={{ width: `${course.progress}%`, background: course.color }} />
                </div>
                <div className="flex items-center justify-between gap-3 p-3 rounded-lg mb-3"
                  style={{ background: "#f6f5f4", border: "1px solid #e5e3df" }}>
                  <div className="min-w-0">
                    <p className="text-xs font-medium mb-0.5" style={{ color: "#a4a097" }}>Tiếp theo:</p>
                    <p className="text-sm font-semibold truncate" style={{ color: "#1a1a1a" }}>{course.nextLesson}</p>
                  </div>
                  <Link href={`/student/bai-giang/${course.nextLessonId}`}
                    className="flex-shrink-0 px-4 py-2 rounded-lg text-xs font-semibold text-white"
                    style={{ background: "#0068FF", borderRadius: "8px" }}>
                    Học ngay
                  </Link>
                </div>
                <Link href={`/student/hoc-tap?course=${course.id}`}
                  className="block w-full py-2 rounded-lg text-xs font-medium text-center transition-colors hover:bg-[#f0f0f0]"
                  style={{ background: "#f6f5f4", border: "1px solid #e5e3df", color: "#787671", borderRadius: "8px" }}>
                  Xem lộ trình đầy đủ
                </Link>
              </div>
            ))}

            <h2 className="text-base font-bold pt-2" style={{ color: "#1a1a1a" }}>Bài tập sắp đến hạn</h2>
            {deadlines.length === 0 ? (
              <div className="p-4 rounded-xl text-center" style={{ background: "#f6f5f4", border: "1px solid #e5e3df" }}>
                <p className="text-sm" style={{ color: "#a4a097" }}>Không có bài tập nào đang chờ nộp.</p>
              </div>
            ) : deadlines.slice(0, 5).map(a => (
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

        </div>
      </div>
    </div>
  );
}
