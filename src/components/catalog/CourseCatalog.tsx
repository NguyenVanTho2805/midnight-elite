// CAT-01 — phần tương tác của /khoa-hoc: chip danh mục, ô tìm, lọc giá / còn chỗ, sắp xếp, lưới thẻ. HTML đầu tiên do máy chủ dựng (page.tsx) nên công cụ tìm kiếm thấy đủ khoá.
// Bộ lọc nằm trong URL bằng history.replaceState (không gọi lại máy chủ, không thêm mục lịch sử mỗi lần gõ). Dac-ta: docs/kin/phong-ban/dac-ta/CAT-01.md
"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CATEGORY_GRADIENT } from "@/lib/courseData";
import { useFollowedCourses } from "@/hooks/useFollowedCourses";
import { useEnrollments } from "@/hooks/useEnrollments";
import { useAuth } from "@/contexts/AuthContext";
import TeacherTag from "@/components/TeacherTag";
import { KinStatus, KinBookmark, KinEmptyState, kinButtonClass } from "@/components/kin";
import {
  buildCatalogQuery, catalogChips, filterCatalog, isFiltered, priceView, safeTagColor, seatLabel, seatTone, sortCatalog,
  DEFAULT_FILTERS, type CatalogFilters, type PublicCard,
} from "@/lib/courseCatalogPublic";

const CONTROL = "min-h-[var(--kin-cham-toi-thieu)] rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)] text-[var(--kin-chu-chinh)] text-[length:var(--kin-co-goc)] px-[var(--kin-kc-6)]";
const FALLBACK_GRADIENT = "linear-gradient(135deg, var(--kin-nhan-nen), var(--kin-nhan-nen-re))";

function CourseCard({ course, following, onToggleFollow, isEnrolled }: {
  course: PublicCard; following: boolean; onToggleFollow: () => void; isEnrolled: boolean;
}) {
  const p = priceView(course.price, course.originalPrice);
  const tagColor = safeTagColor(course.tagColor) ?? "var(--kin-tt-chu-loi)";
  const dim = course.seat.state === "closed" || course.seat.state === "paused";
  return (
    <article data-course-card={course.slug} data-seat={course.seat.state}
      className="relative flex flex-col overflow-hidden rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-nhat)] bg-[var(--kin-nen-trang)] transition-colors hover:border-[var(--kin-vien-o-nhap)]">
      <div className="flex items-center justify-between gap-2 px-[var(--kin-kc-6)] h-14" style={{ background: CATEGORY_GRADIENT[course.category] ?? FALLBACK_GRADIENT }}>
        <span className="min-w-0 truncate text-[length:var(--kin-co-caption)] font-semibold uppercase tracking-[0.04em] text-[var(--kin-chu-tren-nut-chinh)]">{course.category}</span>
        {p.discountPct > 0 && (
          <span className="flex-shrink-0 rounded-[var(--kin-bo-tron)] px-2 py-0.5 text-[length:var(--kin-co-caption)] font-bold bg-[var(--kin-nen-trang)] text-[var(--kin-tt-chu-loi)]">-{p.discountPct}%</span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-[var(--kin-kc-4)] p-[var(--kin-kc-6)]">
        <h3 className="text-[length:var(--kin-co-body)] font-semibold leading-snug line-clamp-2 min-h-[2.75em] text-[var(--kin-chu-chinh)]">
          <Link href={`/khoa-hoc/${course.slug}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)]">
            {course.title}
          </Link>
        </h3>

        <TeacherTag name={course.teacher || "Trung tâm"} avatar={course.teacherAvatar || (course.teacher || "T").slice(0, 1)} size={24} maxNameWidth={180} />

        <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">{course.lessons} bài · {course.hours} giờ</p>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1" style={dim ? { opacity: 0.9 } : undefined}>
          <KinStatus tone={seatTone(course.seat)}>{seatLabel(course.seat)}</KinStatus>
          {course.tag && (
            <span className="rounded-[var(--kin-bo-tron)] px-2 py-0.5 text-[length:var(--kin-co-caption)] font-semibold"
              style={{ color: tagColor, background: `color-mix(in srgb, ${tagColor} 14%, transparent)` }}>
              {course.tag}
            </span>
          )}
        </div>

        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <div className="min-w-0">
            {p.free ? (
              <span data-price="free" className="text-[length:var(--kin-co-tieu-de)] font-bold text-[var(--kin-tt-chu-xong)]">Miễn phí</span>
            ) : (
              <>
                <span data-price="paid" className="text-[length:var(--kin-co-tieu-de)] font-bold text-[var(--kin-nhan-link)]">{p.price.toLocaleString("vi-VN")}đ</span>
                {p.original && <span className="ml-2 text-[length:var(--kin-co-goc)] line-through text-[var(--kin-chu-mo)]">{p.original.toLocaleString("vi-VN")}đ</span>}
              </>
            )}
          </div>
          {isEnrolled ? (
            <Link href={`/student/hoc-tap?course=${encodeURIComponent(course.slug)}`}
              className={`relative z-10 ${kinButtonClass("secondary")}`}>Đang học · Vào học</Link>
          ) : (
            <span className="relative z-10 -mr-2 -mb-2">
              <KinBookmark on={following} onToggle={onToggleFollow} labelOn="Bỏ theo dõi lớp" labelOff="Theo dõi lớp"
                className="min-w-[var(--kin-cham-toi-thieu)] min-h-[var(--kin-cham-toi-thieu)] flex items-center justify-center" />
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

export default function CourseCatalog({ cards, categories, initial }: { cards: PublicCard[]; categories: string[]; initial: CatalogFilters }) {
  const router = useRouter();
  const { user } = useAuth();
  const { isFollowing, follow, unfollow } = useFollowedCourses();
  const { enrolledIds } = useEnrollments();
  const [f, setF] = useState<CatalogFilters>(initial);

  const apply = useCallback((patch: Partial<CatalogFilters>) => {
    setF(prev => {
      const next = { ...prev, ...patch };
      const qs = buildCatalogQuery(next);
      window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
      return next;
    });
  }, []);

  const chips = useMemo(() => catalogChips(categories, cards, f.category), [categories, cards, f.category]);
  const shown = useMemo(() => sortCatalog(filterCatalog(cards, f), f.sort), [cards, f]);
  const filtered = isFiltered(f);

  function toggle(slug: string) {
    if (!user) {
      const back = `${window.location.pathname}${window.location.search}`;
      router.push(`/dang-nhap?redirect=${encodeURIComponent(back)}`);
      return;
    }
    if (isFollowing(slug)) unfollow(slug); else follow(slug);
  }

  return (
    <div data-catalog className="flex flex-col gap-[var(--kin-kc-6)]">
      <div className="flex flex-col gap-[var(--kin-kc-5)]">
        <input type="search" role="searchbox" aria-label="Tìm khoá học hoặc gia sư" placeholder="Tìm khoá học, gia sư…" value={f.q}
          onChange={e => apply({ q: e.target.value })} className={`${CONTROL} w-full`} />

        <div role="group" aria-label="Danh mục" data-chip-row className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
          {[{ name: "", count: cards.length }, ...chips].map(c => {
            const on = f.category === c.name;
            return (
              <button key={c.name || "all"} type="button" data-chip={c.name || "all"} aria-pressed={on} onClick={() => apply({ category: c.name })}
                className="flex-shrink-0 min-h-[var(--kin-cham-toi-thieu)] rounded-[var(--kin-bo-tron)] border px-[var(--kin-kc-7)] text-[length:var(--kin-co-goc)] font-medium whitespace-nowrap"
                style={on
                  ? { background: "var(--kin-nhan-nen)", color: "var(--kin-nhan-chu-tren-nen)", borderColor: "transparent" }
                  : { background: "var(--kin-nen-trang)", color: "var(--kin-chu-phu)", borderColor: "var(--kin-vien-o-nhap)" }}>
                {c.name || "Tất cả"} <span style={{ opacity: 0.75 }}>({c.count})</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-[var(--kin-kc-5)]">
          <select aria-label="Giá" value={f.fee} onChange={e => apply({ fee: e.target.value as CatalogFilters["fee"] })} className={CONTROL}>
            <option value="">Mọi mức giá</option>
            <option value="free">Miễn phí</option>
            <option value="paid">Có phí</option>
          </select>
          <select aria-label="Sắp xếp" value={f.sort} onChange={e => apply({ sort: e.target.value as CatalogFilters["sort"] })} className={CONTROL}>
            <option value="moi">Thứ tự mặc định</option>
            <option value="gia-tang">Giá thấp → cao</option>
            <option value="gia-giam">Giá cao → thấp</option>
          </select>
          <label className="inline-flex min-h-[var(--kin-cham-toi-thieu)] items-center gap-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">
            <input type="checkbox" checked={f.seat} onChange={e => apply({ seat: e.target.checked })} className="h-5 w-5" />
            Chỉ lớp còn chỗ
          </label>
        </div>

        <p aria-live="polite" data-result-count className="flex flex-wrap items-center gap-x-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">
          <span>{shown.length} khoá học</span>
          {filtered && (
            <button type="button" data-clear-filters onClick={() => apply({ ...DEFAULT_FILTERS })}
              className="min-h-[var(--kin-cham-toi-thieu)] font-medium text-[var(--kin-nhan-link)] underline-offset-2 hover:underline">Xoá bộ lọc</button>
          )}
        </p>
      </div>

      {cards.length === 0 ? (
        <KinEmptyState title="Chưa có khoá học nào đang mở"
          action={<Link href="/giang-vien" className={kinButtonClass("secondary")}>Xem gia sư</Link>}>
          Khi có lớp mới mở, khoá học sẽ hiện ở đây.
        </KinEmptyState>
      ) : shown.length === 0 ? (
        <KinEmptyState title="Không có khoá học phù hợp"
          action={<button type="button" data-clear-filters onClick={() => apply({ ...DEFAULT_FILTERS })} className={kinButtonClass("secondary")}>Xoá bộ lọc</button>}>
          {f.category ? `Chưa có khoá nào trong "${f.category}" khớp bộ lọc hiện tại.` : "Thử bỏ bớt bộ lọc hoặc đổi từ khoá tìm kiếm."}
        </KinEmptyState>
      ) : (
        <div data-course-grid className="grid grid-cols-1 min-[560px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-[var(--kin-kc-7)]">
          {shown.map(c => (
            <CourseCard key={c.slug} course={c} following={isFollowing(c.slug)} onToggleFollow={() => toggle(c.slug)} isEnrolled={enrolledIds.has(c.slug)} />
          ))}
        </div>
      )}
    </div>
  );
}
