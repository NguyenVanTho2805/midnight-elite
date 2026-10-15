"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useProgress } from "@/hooks/useProgress";
import { useEnrollments } from "@/hooks/useEnrollments";
import TeacherTag from "@/components/TeacherTag";
import { KinLoader } from "@/components/kin/KinLoader";

interface DBLesson { id: string; title: string; duration?: string | null; isFree: boolean }
interface DBChapter { id: string; title: string; lessons: DBLesson[] }
interface DBSection { id: string; title: string; chapters: DBChapter[] }
interface DBCourse {
  id: string; name: string; category: string; instructor: string;
  teacherAvatar?: string | null;
  lessons: number; hours: number; price: number; originalPrice?: number | null;
  openDate?: string | null;
  introVideo?: string | null;
  sections: DBSection[];
}

interface Review {
  id: string; rating: number; comment: string; createdAt: string;
  user: { name: string };
}

function StarRating({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map(s => (
        <button key={s} type={onChange ? "button" : undefined}
          onClick={() => onChange?.(s)}
          className={onChange ? "transition-transform hover:scale-110" : ""}
          style={{ cursor: onChange ? "pointer" : "default", background: "none", border: "none", padding: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill={s <= value ? "var(--kin-tt-chu-cho)" : "none"} stroke={s <= value ? "var(--kin-tt-chu-cho)" : "var(--kin-chu-mo)"} strokeWidth="1.5">
            <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
          </svg>
        </button>
      ))}
    </div>
  );
}

function ReviewsSection({ courseId }: { courseId: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avg, setAvg] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    fetch(`/api/courses/${courseId}/reviews`)
      .then(r => r.json())
      .then(d => { setReviews(d.reviews ?? []); setAvg(d.avg); setTotal(d.total ?? 0); })
      .catch(() => {});
  }, [courseId]);

  useEffect(() => { load(); }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) { router.push("/dang-nhap"); return; }
    setError(""); setSubmitting(true);
    const res = await fetch(`/api/courses/${courseId}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, comment }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) { setError(data.error ?? "Có lỗi xảy ra"); return; }
    setSubmitted(true);
    setComment(""); setRating(5);
  }

  return (
    <div className="rounded-xl p-6" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-extrabold" style={{ color: "var(--kin-chu-chinh)" }}>Đánh giá khóa học</h2>
        {avg !== null && (
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black" style={{ color: "var(--kin-tt-chu-cho)" }}>{avg.toFixed(1)}</span>
            <div>
              <StarRating value={Math.round(avg)} />
              <p className="text-xs mt-0.5" style={{ color: "var(--kin-chu-mo)" }}>{total} đánh giá</p>
            </div>
          </div>
        )}
      </div>

      {/* Submit form */}
      {!submitted ? (
        <form onSubmit={handleSubmit} className="mb-6 p-4 rounded-xl" style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)" }}>
          <p className="text-sm font-semibold mb-3" style={{ color: "var(--kin-chu-chinh)" }}>Chia sẻ trải nghiệm của bạn</p>
          <div className="flex items-center gap-3 mb-3">
            <StarRating value={rating} onChange={setRating} />
            <span className="text-sm" style={{ color: "var(--kin-chu-mo)" }}>{["", "Kém", "Dưới trung bình", "Trung bình", "Tốt", "Xuất sắc"][rating]}</span>
          </div>
          <textarea
            value={comment} onChange={e => setComment(e.target.value)}
            placeholder="Nhận xét về nội dung, gia sư, tài liệu..."
            rows={3}
            className="w-full text-sm rounded-lg px-3 py-2 resize-none outline-none"
            style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-chu-chinh)" }}
          />
          {error && <p className="text-xs mt-1" style={{ color: "var(--kin-tt-chu-loi)" }}>{error}</p>}
          <button type="submit" disabled={submitting || !comment.trim()}
            className="mt-3 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50"
            style={{ background: "var(--kin-nhan-nen)" }}>
            {submitting ? "Đang gửi..." : "Gửi đánh giá"}
          </button>
        </form>
      ) : (
        <div className="mb-6 p-4 rounded-xl text-sm font-semibold text-center" style={{ background: "var(--kin-tt-nen-xong)", color: "var(--kin-tt-chu-xong)" }}>
          Cảm ơn bạn! Đánh giá đang chờ duyệt và sẽ hiển thị sau khi admin xét duyệt.
        </div>
      )}

      {/* Reviews list */}
      {reviews.length === 0 ? (
        <p className="text-sm text-center py-4" style={{ color: "var(--kin-chu-mo)" }}>Chưa có đánh giá nào. Hãy là người đầu tiên!</p>
      ) : (
        <div className="space-y-4">
          {reviews.map(r => (
            <div key={r.id} className="pb-4" style={{ borderBottom: "1px solid var(--kin-vien-thuong)" }}>
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{ background: "var(--kin-nhan-nen)" }}>
                  {r.user.name[0]}
                </div>
                <div>
                  <p className="text-sm font-semibold leading-none" style={{ color: "var(--kin-chu-chinh)" }}>{r.user.name}</p>
                  <p className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>{new Date(r.createdAt).toLocaleDateString("vi-VN")}</p>
                </div>
                <div className="ml-auto"><StarRating value={r.rating} /></div>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: "var(--kin-chu-phu)" }}>{r.comment}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function extractYouTubeId(url: string): string | null {
  const patterns = [/youtube\.com\/watch\?v=([^&]+)/, /youtu\.be\/([^?]+)/, /youtube\.com\/embed\/([^?]+)/];
  for (const p of patterns) { const m = url.match(p); if (m) return m[1]; }
  return null;
}


export default function KhoaHocDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { completedIds, markComplete, unmarkComplete } = useProgress();
  const { enrolledIds, loading: enrollmentsLoading } = useEnrollments();
  const [course, setCourse]             = useState<DBCourse | null>(null);
  const [loaded, setLoaded]             = useState(false);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const [openChapters, setOpenChapters] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/courses/${slug}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: DBCourse | null) => {
        setCourse(data);
        if (data) {
          setOpenSections(new Set(data.sections.map(s => s.id)));
          setOpenChapters(new Set(data.sections.flatMap(s => s.chapters.map(c => c.id))));
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [slug]);

  function toggleSection(id: string) {
    setOpenSections(p => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }
  function toggleChapter(id: string) {
    setOpenChapters(p => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-32">
        <KinLoader size={44} />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center px-4">
        <div className="text-5xl mb-4">🔍</div>
        <h1 className="text-xl font-extrabold mb-2" style={{ color: "var(--kin-chu-chinh)" }}>Không tìm thấy khóa học</h1>
        <p className="text-sm mb-6" style={{ color: "var(--kin-chu-mo)" }}>Khóa học này không tồn tại hoặc đã bị gỡ xuống.</p>
        <Link href="/khoa-hoc"
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
          style={{ background: "var(--kin-nhan-nen)" }}>
          Xem tất cả khóa học
        </Link>
      </div>
    );
  }

  const discount = course.originalPrice ? Math.round((1 - course.price / course.originalPrice) * 100) : 0;
  const isEnrolled = !enrollmentsLoading && enrolledIds.has(course.id);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-12 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left — Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs" style={{ color: "var(--kin-chu-mo)" }}>
            <Link href="/khoa-hoc" style={{ color: "var(--kin-nhan-link)" }}>Khóa học</Link>
            <span>›</span>
            <Link href={`/khoa-hoc?category=${encodeURIComponent(course.category)}`} style={{ color: "var(--kin-nhan-link)" }}>{course.category}</Link>
            <span>›</span>
            <span>{course.name}</span>
          </div>

          {/* Hero card */}
          <div className="rounded-xl overflow-hidden" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
            {/* Thumbnail / Video preview */}
            {course.introVideo && extractYouTubeId(course.introVideo) ? (
              <div className="relative" style={{ paddingBottom: "56.25%" }}>
                <iframe
                  className="absolute inset-0 w-full h-full"
                  src={`https://www.youtube.com/embed/${extractYouTubeId(course.introVideo)}?rel=0&modestbranding=1`}
                  title="Video giới thiệu khoá học"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
                <div className="absolute top-3 right-3 px-2 py-1 rounded-lg text-xs font-bold text-[var(--kin-chu-tren-nut-chinh)] z-10" style={{ background: "var(--kin-tt-chu-loi)" }}>
                  MIỄN PHÍ xem thử
                </div>
              </div>
            ) : (
              <div className="relative h-56 sm:h-72 flex items-center justify-center"
                style={{ background: "var(--kin-nhan-nen)" }}>
                <p className="text-white font-semibold text-sm opacity-60">Chưa có video giới thiệu</p>
                <div className="absolute top-3 right-3 px-2 py-1 rounded-lg text-xs font-bold text-[var(--kin-chu-tren-nut-chinh)]" style={{ background: "var(--kin-tt-chu-loi)" }}>
                  MIỄN PHÍ xem thử
                </div>
              </div>
            )}

            {/* Course info */}
            <div className="p-6">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{ background: "var(--kin-nhan-nen-nhat)", color: "var(--kin-nhan-link)" }}>
                  {course.category}
                </span>
                {course.openDate && <span className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>Khai giảng: {course.openDate}</span>}
              </div>
              <h1 className="text-2xl font-extrabold mb-3" style={{ color: "var(--kin-chu-chinh)" }}>{course.name}</h1>
              {course.instructor && (
                <TeacherTag className="mb-5" name={course.instructor} avatar={course.teacherAvatar ?? course.instructor[0]} size={36} role="Gia sư phụ trách" />
              )}

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Bài giảng", value: String(course.lessons || course.sections.reduce((t, s) => t + s.chapters.reduce((tc, c) => tc + c.lessons.length, 0), 0)) },
                  { label: "Thời lượng", value: `${course.hours}h` },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl p-3 text-center"
                    style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)" }}>
                    <div className="text-base font-extrabold" style={{ color: "var(--kin-nhan-link)" }}>{s.value}</div>
                    <div className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Curriculum */}
          <div className="rounded-xl p-6" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
            <h2 className="text-lg font-extrabold mb-5" style={{ color: "var(--kin-chu-chinh)" }}>Nội dung khóa học</h2>
            <div className="space-y-5">
              {course.sections.length === 0 && (
                <p className="text-sm text-center py-4" style={{ color: "var(--kin-chu-mo)" }}>Chương trình học đang được cập nhật.</p>
              )}
              {course.sections.map((section) => (
                <div key={section.id}>
                  <button onClick={() => toggleSection(section.id)}
                    className="w-full flex items-center gap-2 mb-2 text-left"
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                    <svg className="flex-shrink-0 transition-transform duration-200" style={{ transform: openSections.has(section.id) ? "rotate(90deg)" : "rotate(0deg)" }}
                      width="10" height="10" viewBox="0 0 10 10">
                      <polygon points="2,1 9,5 2,9" fill="var(--kin-chu-chinh)"/>
                    </svg>
                    <p className="text-base font-extrabold" style={{ color: "var(--kin-chu-chinh)" }}>{section.title}</p>
                  </button>
                  {openSections.has(section.id) && (
                  <div className="space-y-2 pl-4">
                  {section.chapters.map((chap) => (
                <div key={chap.id}>
                  <button onClick={() => toggleChapter(chap.id)}
                    className="w-full flex items-center gap-2 mb-1.5 text-left"
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                    <svg className="flex-shrink-0 transition-transform duration-200" style={{ transform: openChapters.has(chap.id) ? "rotate(90deg)" : "rotate(0deg)" }}
                      width="8" height="8" viewBox="0 0 10 10">
                      <polygon points="2,1 9,5 2,9" fill="var(--kin-chu-mo)"/>
                    </svg>
                    <h3 className="text-sm font-bold" style={{ color: "var(--kin-chu-phu)" }}>{chap.title}</h3>
                  </button>
                  {openChapters.has(chap.id) && (
                  <div className="space-y-2 pl-4">
                    {chap.lessons.map((lesson) => {
                      const isCompleted  = completedIds.has(lesson.id);
                      const isAccessible = lesson.isFree || isEnrolled;

                      function toggleComplete(e: React.MouseEvent) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!user) { router.push("/dang-nhap"); return; }
                        isCompleted ? unmarkComplete(lesson.id) : markComplete(lesson.id);
                      }

                      const inner = (
                        <>
                          {isAccessible ? (
                            <button onClick={toggleComplete}
                              title={isCompleted ? "Đã học — bấm để bỏ đánh dấu" : "Đánh dấu đã học"}
                              className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 cursor-pointer transition-colors"
                              style={{ borderColor: isCompleted ? "var(--kin-tt-chu-xong)" : "var(--kin-vien-o-nhap)", background: isCompleted ? "var(--kin-tt-chu-xong)" : "transparent" }}>
                              {isCompleted && (
                                <svg viewBox="0 0 10 8" width="10" height="8" fill="none">
                                  <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                            </button>
                          ) : (
                            <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                              style={{ borderColor: "var(--kin-vien-thuong)", background: "transparent" }}>
                              <svg viewBox="0 0 8 8" width="8" height="8" fill="none">
                                <path d="M1 4h6M4 1v6" stroke="var(--kin-vien-o-nhap)" strokeWidth="1.2" strokeLinecap="round"/>
                              </svg>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <span className="text-sm" style={{ color: isAccessible ? "var(--kin-nhan-link)" : "var(--kin-chu-mo)", fontWeight: isAccessible ? 600 : 400 }}>
                              {lesson.title}
                            </span>
                            {lesson.isFree && (
                              <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold text-[var(--kin-chu-tren-nut-chinh)]" style={{ background: "var(--kin-tt-chu-xong)" }}>Free</span>
                            )}
                          </div>
                          <span className="text-xs flex-shrink-0" style={{ color: "var(--kin-chu-mo)" }}>{lesson.duration ?? ""}</span>
                          {isAccessible && (
                            <span className="text-xs flex-shrink-0 flex items-center gap-0.5" style={{ color: "var(--kin-nhan-link)" }}>
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.5"><polygon points="5,3 13,8 5,13" fill="var(--kin-nhan-nen)" stroke="none"/></svg>
                              Xem
                            </span>
                          )}
                        </>
                      );

                      const sharedClass = "flex items-center gap-3 px-4 py-3 rounded-xl transition-all";
                      const sharedStyle = { background: isAccessible ? "var(--kin-nen-trang)" : "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)" };

                      return isAccessible ? (
                        <Link key={lesson.id}
                          href={user ? `/student/bai-giang/${lesson.id}` : `/dang-nhap?redirect=/student/bai-giang/${lesson.id}`}
                          className={sharedClass + " hover:opacity-80 cursor-pointer"}
                          style={sharedStyle}>
                          {inner}
                        </Link>
                      ) : (
                        <div key={lesson.id} className={sharedClass} style={sharedStyle}>
                          {inner}
                        </div>
                      );
                    })}
                  </div>
                  )}
                </div>
                  ))}
                  </div>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs mt-4 text-center" style={{ color: "var(--kin-chu-mo)" }}>... và nhiều bài học khác sau khi mua khóa học</p>
          </div>

          {/* Reviews */}
          <ReviewsSection courseId={course.id} />
        </div>

        {/* Right — Sticky purchase card */}
        <div className="lg:col-span-1">
          <div className="rounded-xl p-6 sticky top-20"
            style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)", boxShadow: "rgba(15,15,15,0.06) 0px 4px 16px 0px" }}>
            {/* Price */}
            <div className="mb-5">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-3xl font-extrabold" style={{ color: "var(--kin-nhan-link)" }}>{course.price.toLocaleString("vi-VN")}đ</span>
                {discount > 0 && (
                  <span className="px-2 py-0.5 rounded-lg text-xs font-bold text-[var(--kin-chu-tren-nut-chinh)]" style={{ background: "var(--kin-tt-chu-loi)" }}>-{discount}%</span>
                )}
              </div>
              {course.originalPrice && <div className="text-sm line-through" style={{ color: "var(--kin-chu-mo)" }}>{course.originalPrice.toLocaleString("vi-VN")}đ</div>}
            </div>

            {/* CTA */}
            <div className="space-y-2 mb-5">
              {isEnrolled ? (
                <Link href={`/student/hoc-tap?course=${course.id}`}
                  className="block w-full py-3 rounded-xl text-sm font-bold text-center text-white"
                  style={{ background: "var(--kin-nhan-nen)", borderRadius: "8px" }}>
                  Vào học →
                </Link>
              ) : (
                <>
                  <a href="tel:0384409051"
                    className="block w-full py-3 rounded-xl text-sm font-bold text-center text-white"
                    style={{ background: "var(--kin-nhan-nen)", borderRadius: "8px" }}>
                    Gọi tư vấn: 0384 409 051
                  </a>
                  <a href="https://zalo.me/0384409051" target="_blank" rel="noopener noreferrer"
                    className="block w-full py-2.5 rounded-xl text-sm font-medium text-center"
                    style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-nhan-link)", borderRadius: "8px" }}>
                    Nhắn Zalo để đăng ký
                  </a>
                </>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
