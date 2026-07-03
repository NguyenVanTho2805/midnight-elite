"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useProgress } from "@/hooks/useProgress";
import TeacherTag from "@/components/TeacherTag";
import { COURSE_HASHTAGS } from "@/lib/courseData";

interface DBLesson { id: string; title: string; duration?: string | null; isFree: boolean }
interface DBChapter { id: string; title: string; lessons: DBLesson[] }
interface DBSection { id: string; title: string; chapters: DBChapter[] }
interface DBCourse {
  id: string; name: string; category: string; instructor: string;
  lessons: number; hours: number; price: number; originalPrice?: number | null;
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
          <svg width="18" height="18" viewBox="0 0 24 24" fill={s <= value ? "#FE9900" : "none"} stroke={s <= value ? "#FE9900" : "#D1D5DB"} strokeWidth="1.5">
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
    <div className="rounded-xl p-6" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-extrabold" style={{ color: "#1E2938" }}>Đánh giá khóa học</h2>
        {avg !== null && (
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black" style={{ color: "#FE9900" }}>{avg.toFixed(1)}</span>
            <div>
              <StarRating value={Math.round(avg)} />
              <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>{total} đánh giá</p>
            </div>
          </div>
        )}
      </div>

      {/* Submit form */}
      {!submitted ? (
        <form onSubmit={handleSubmit} className="mb-6 p-4 rounded-xl" style={{ background: "#f6f5f4", border: "1px solid #e5e3df" }}>
          <p className="text-sm font-semibold mb-3" style={{ color: "#1E2938" }}>Chia sẻ trải nghiệm của bạn</p>
          <div className="flex items-center gap-3 mb-3">
            <StarRating value={rating} onChange={setRating} />
            <span className="text-sm" style={{ color: "#6B7280" }}>{["", "Kém", "Dưới trung bình", "Trung bình", "Tốt", "Xuất sắc"][rating]}</span>
          </div>
          <textarea
            value={comment} onChange={e => setComment(e.target.value)}
            placeholder="Nhận xét về nội dung, giảng viên, tài liệu..."
            rows={3}
            className="w-full text-sm rounded-lg px-3 py-2 resize-none outline-none"
            style={{ background: "#ffffff", border: "1px solid #e5e3df", color: "#1E2938" }}
          />
          {error && <p className="text-xs mt-1" style={{ color: "#FF2157" }}>{error}</p>}
          <button type="submit" disabled={submitting || !comment.trim()}
            className="mt-3 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50"
            style={{ background: "#0068FF" }}>
            {submitting ? "Đang gửi..." : "Gửi đánh giá"}
          </button>
        </form>
      ) : (
        <div className="mb-6 p-4 rounded-xl text-sm font-semibold text-center" style={{ background: "#dcfce7", color: "#166534" }}>
          Cảm ơn bạn! Đánh giá đang chờ duyệt và sẽ hiển thị sau khi admin xét duyệt.
        </div>
      )}

      {/* Reviews list */}
      {reviews.length === 0 ? (
        <p className="text-sm text-center py-4" style={{ color: "#9CA3AF" }}>Chưa có đánh giá nào. Hãy là người đầu tiên!</p>
      ) : (
        <div className="space-y-4">
          {reviews.map(r => (
            <div key={r.id} className="pb-4" style={{ borderBottom: "1px solid #e5e3df" }}>
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{ background: "linear-gradient(135deg,#0068FF,#2680FF)" }}>
                  {r.user.name[0]}
                </div>
                <div>
                  <p className="text-sm font-semibold leading-none" style={{ color: "#1E2938" }}>{r.user.name}</p>
                  <p className="text-xs" style={{ color: "#9CA3AF" }}>{new Date(r.createdAt).toLocaleDateString("vi-VN")}</p>
                </div>
                <div className="ml-auto"><StarRating value={r.rating} /></div>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: "#4B5563" }}>{r.comment}</p>
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
  const [course, setCourse]           = useState<DBCourse | null>(null);
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
      .catch(() => {});
  }, [slug]);

  function toggleSection(id: string) {
    setOpenSections(p => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }
  function toggleChapter(id: string) {
    setOpenChapters(p => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }

  if (!course) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex gap-1.5">
          {[0,1,2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full animate-bounce" style={{ background: "#0068FF", animationDelay: `${i*0.15}s` }} />
          ))}
        </div>
      </div>
    );
  }

  const discount = course.originalPrice ? Math.round((1 - course.price / course.originalPrice) * 100) : 0;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-12 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left — Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs" style={{ color: "#9CA3AF" }}>
            <Link href="/khoa-hoc" style={{ color: "#0068FF" }}>Khóa học</Link>
            <span>›</span>
            <Link href={`/khoa-hoc?category=${encodeURIComponent(course.category)}`} style={{ color: "#0068FF" }}>{course.category}</Link>
            <span>›</span>
            <span>{course.name}</span>
          </div>

          {/* Hero card */}
          <div className="rounded-xl overflow-hidden" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
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
                <div className="absolute top-3 right-3 px-2 py-1 rounded-lg text-xs font-bold text-white z-10" style={{ background: "#FF2157" }}>
                  MIỄN PHÍ xem thử
                </div>
              </div>
            ) : (
              <div className="relative h-56 sm:h-72 flex items-center justify-center"
                style={{ background: "linear-gradient(145deg, #001a6e, #0068FF)" }}>
                <p className="text-white font-semibold text-sm opacity-60">Chưa có video giới thiệu</p>
                <div className="absolute top-3 right-3 px-2 py-1 rounded-lg text-xs font-bold text-white" style={{ background: "#FF2157" }}>
                  MIỄN PHÍ xem thử
                </div>
              </div>
            )}

            {/* Course info */}
            <div className="p-6">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{ background: "#dbeafe", color: "#0068FF" }}>
                  {course.category}
                </span>
                {(COURSE_HASHTAGS[course.id] ?? []).map(tag => (
                  <span key={tag} className="text-xs px-2 py-0.5 rounded" style={{ background: "#f6f5f4", color: "#787671" }}>
                    #{tag}
                  </span>
                ))}
                <span className="text-xs" style={{ color: "#9CA3AF" }}>Cập nhật: 5/2026</span>
              </div>
              <h1 className="text-2xl font-extrabold mb-3" style={{ color: "#1E2938" }}>{course.name}</h1>
              <p className="text-sm leading-relaxed mb-3" style={{ color: "#6B7280" }}>
                Khóa học toàn diện với đầy đủ bài giảng video theo chuyên đề.
              </p>
              {course.instructor && (
                <TeacherTag className="mb-5" name={course.instructor} avatar={course.instructor[0]} size={36} role="Giảng viên phụ trách" />
              )}

              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Bài giảng", value: String(course.lessons || course.sections.reduce((t, s) => t + s.chapters.reduce((tc, c) => tc + c.lessons.length, 0), 0)) },
                  { label: "Thời lượng", value: `${course.hours}h` },
                  { label: "Học viên", value: "2.4k" },
                  { label: "Đánh giá", value: "4.9" },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl p-3 text-center"
                    style={{ background: "#f6f5f4", border: "1px solid #e5e3df" }}>
                    <div className="text-base font-extrabold" style={{ color: "#0068FF" }}>{s.value}</div>
                    <div className="text-xs" style={{ color: "#9CA3AF" }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Curriculum */}
          <div className="rounded-xl p-6" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
            <h2 className="text-lg font-extrabold mb-5" style={{ color: "#1E2938" }}>Nội dung khóa học</h2>
            <div className="space-y-5">
              {course.sections.length === 0 && (
                <p className="text-sm text-center py-4" style={{ color: "#9CA3AF" }}>Chương trình học đang được cập nhật.</p>
              )}
              {course.sections.map((section) => (
                <div key={section.id}>
                  <button onClick={() => toggleSection(section.id)}
                    className="w-full flex items-center justify-between gap-2 mb-2 text-left"
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                    <p className="text-base font-extrabold" style={{ color: "#1E2938" }}>{section.title}</p>
                    <svg className="flex-shrink-0 transition-transform duration-200" style={{ transform: openSections.has(section.id) ? "rotate(180deg)" : "rotate(0deg)" }}
                      width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#9CA3AF" strokeWidth="1.8" strokeLinecap="round">
                      <path d="M3 6l5 5 5-5"/>
                    </svg>
                  </button>
                  {openSections.has(section.id) && (
                  <div className="space-y-2 pl-4">
                  {section.chapters.map((chap) => (
                <div key={chap.id}>
                  <button onClick={() => toggleChapter(chap.id)}
                    className="w-full flex items-center justify-between gap-2 mb-1.5 text-left"
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                    <h3 className="text-sm font-bold" style={{ color: "#374151" }}>{chap.title}</h3>
                    <svg className="flex-shrink-0 transition-transform duration-200" style={{ transform: openChapters.has(chap.id) ? "rotate(180deg)" : "rotate(0deg)" }}
                      width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#9CA3AF" strokeWidth="1.8" strokeLinecap="round">
                      <path d="M3 6l5 5 5-5"/>
                    </svg>
                  </button>
                  {openChapters.has(chap.id) && (
                  <div className="space-y-2 pl-4">
                    {chap.lessons.map((lesson) => {
                      const isCompleted = completedIds.has(lesson.id);

                      function toggleComplete(e: React.MouseEvent) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!user) { router.push("/dang-nhap"); return; }
                        isCompleted ? unmarkComplete(lesson.id) : markComplete(lesson.id);
                      }

                      const inner = (
                        <>
                          {lesson.isFree ? (
                            <button onClick={toggleComplete}
                              title={isCompleted ? "Đã học — bấm để bỏ đánh dấu" : "Đánh dấu đã học"}
                              className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 cursor-pointer transition-colors"
                              style={{ borderColor: isCompleted ? "#16a34a" : "#c8c4be", background: isCompleted ? "#16a34a" : "transparent" }}>
                              {isCompleted && (
                                <svg viewBox="0 0 10 8" width="10" height="8" fill="none">
                                  <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                            </button>
                          ) : (
                            <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                              style={{ borderColor: "#e5e3df", background: "transparent" }}>
                              <svg viewBox="0 0 8 8" width="8" height="8" fill="none">
                                <path d="M1 4h6M4 1v6" stroke="#c8c4be" strokeWidth="1.2" strokeLinecap="round"/>
                              </svg>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <span className="text-sm" style={{ color: lesson.isFree ? "#0068FF" : "#6B7280", fontWeight: lesson.isFree ? 600 : 400 }}>
                              {lesson.title}
                            </span>
                            {lesson.isFree && (
                              <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ background: "#00A63D" }}>Free</span>
                            )}
                          </div>
                          <span className="text-xs flex-shrink-0" style={{ color: "#9CA3AF" }}>{lesson.duration ?? ""}</span>
                          {lesson.isFree && (
                            <span className="text-xs flex-shrink-0 flex items-center gap-0.5" style={{ color: "#0068FF" }}>
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.5"><polygon points="5,3 13,8 5,13" fill="#0068FF" stroke="none"/></svg>
                              Xem
                            </span>
                          )}
                        </>
                      );

                      const sharedClass = "flex items-center gap-3 px-4 py-3 rounded-xl transition-all";
                      const sharedStyle = { background: lesson.isFree ? "#ffffff" : "#f6f5f4", border: "1px solid #e5e3df" };

                      return lesson.isFree ? (
                        <Link key={lesson.id} href={`/student/bai-giang/${lesson.id}`}
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
            <p className="text-xs mt-4 text-center" style={{ color: "#9CA3AF" }}>... và nhiều bài học khác sau khi mua khóa học</p>
          </div>

          {/* Reviews */}
          <ReviewsSection courseId={course.id} />
        </div>

        {/* Right — Sticky purchase card */}
        <div className="lg:col-span-1">
          <div className="rounded-xl p-6 sticky top-20"
            style={{ background: "#ffffff", border: "1px solid #e5e3df", boxShadow: "rgba(15,15,15,0.06) 0px 4px 16px 0px" }}>
            {/* Price */}
            <div className="mb-5">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-3xl font-extrabold" style={{ color: "#0068FF" }}>{course.price.toLocaleString("vi-VN")}đ</span>
                <span className="px-2 py-0.5 rounded-lg text-xs font-bold text-white" style={{ background: "#FF2157" }}>-{discount}%</span>
              </div>
              {course.originalPrice && <div className="text-sm line-through" style={{ color: "#9CA3AF" }}>{course.originalPrice.toLocaleString("vi-VN")}đ</div>}
            </div>

            {/* Giá */}
            <div className="rounded-xl p-4 mb-5 flex items-center justify-between"
              style={{ background: "#f6f5f4", border: "1px solid #e5e3df" }}>
              <div>
                <p className="text-2xl font-extrabold" style={{ color: "#0068FF" }}>
                  {course.price.toLocaleString("vi-VN")}đ
                </p>
                {discount > 0 && course.originalPrice && (
                  <p className="text-sm line-through" style={{ color: "#9CA3AF" }}>
                    {course.originalPrice.toLocaleString("vi-VN")}đ
                  </p>
                )}
              </div>
              {discount > 0 && (
                <span className="px-2.5 py-1 rounded-full text-xs font-bold text-white"
                  style={{ background: "#FF2157" }}>-{discount}%</span>
              )}
            </div>

            {/* CTA */}
            <div className="space-y-2 mb-5">
              <a href="tel:0384409051"
                className="block w-full py-3 rounded-xl text-sm font-bold text-center text-white"
                style={{ background: "#0068FF", borderRadius: "8px" }}>
                Gọi tư vấn: 0384 409 051
              </a>
              <a href="https://zalo.me/0384409051" target="_blank" rel="noopener noreferrer"
                className="block w-full py-2.5 rounded-xl text-sm font-medium text-center"
                style={{ background: "#f6f5f4", border: "1px solid #e5e3df", color: "#0068FF", borderRadius: "8px" }}>
                Nhắn Zalo để đăng ký
              </a>
            </div>

            {/* Guarantees */}
            <div className="space-y-2.5 pt-4" style={{ borderTop: "1px solid #e5e3df" }}>
              {[
                "Kích hoạt sau khi xác nhận thanh toán",
                "Học trọn đời, không hết hạn",
                "Xem trên điện thoại & máy tính",
                "AI hỗ trợ giải bài 24/7",
                "Kèm tài liệu PDF miễn phí",
              ].map((g) => (
                <div key={g} className="flex items-center gap-2 text-xs" style={{ color: "#4B5563" }}>
                  <span style={{ color: "#00A63D" }}>✓</span>
                  <span>{g}</span>
                </div>
              ))}
            </div>

            {/* Combo suggestion */}
            {course.id !== "combo-8-mon" && (
              <div className="mt-5 rounded-xl p-4"
                style={{ background: "#fef3c7", border: "1px solid #fde68a" }}>
                <p className="text-xs font-bold mb-2" style={{ color: "#FE9900" }}>Tiết kiệm hơn với Combo</p>
                <p className="text-xs mb-3" style={{ color: "#6B7280" }}>Mua Combo 8 môn chỉ 1.500.000đ — tiết kiệm 57%!</p>
                <Link href="/khoa-hoc/combo-8-mon"
                  className="block w-full py-2 rounded-xl text-xs font-bold text-center"
                  style={{ background: "#FE9900", color: "white" }}>
                  Xem Combo 8 môn →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
