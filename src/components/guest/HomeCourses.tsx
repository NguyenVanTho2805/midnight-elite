// Khối "Lớp theo kỳ thi" trang chủ (BU-HS-LANDING 3.3). Lớp THẬT còn chỗ (bộ tải đã lọc), chỉ ĐỌC giá: "Miễn phí" khi price<=0, không tính, không ghi, không Coin.
// Không số học viên, không sĩ số; nhãn `tag` hiện chip trung tính (không dùng màu từ DB). Điện thoại: chip và thẻ là dải cuộn ngang (tabindex + aria-label); từ sm: lưới canh giữa.
// Máy chủ, không hook, không prisma. Không có lớp → không vẽ gì (không <section>).
import Link from "next/link";
import { CATEGORY_GRADIENT } from "@/lib/courseData";
import { priceView, seatLabel, type Chip, type PublicCard } from "@/lib/courseCatalogPublic";
import { BLOCK_INNER, BlockHead, BlockMore } from "./HomeBlockParts";

const FALLBACK_GRADIENT = "linear-gradient(135deg, var(--kin-nhan-nen), var(--kin-nhan-nen-re))";

function HomeCourseCard({ course }: { course: PublicCard }) {
  const p = priceView(course.price, course.originalPrice);
  const meta = [course.lessons > 0 ? `${course.lessons} bài` : "", course.hours > 0 ? `${course.hours} giờ` : ""].filter(Boolean).join(" · ");
  return (
    <article data-home-course={course.slug}
      className="relative flex h-full flex-col overflow-hidden rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-nhat)] bg-[var(--kin-nen-trang)] transition-colors hover:border-[var(--kin-vien-o-nhap)]">
      <div className="flex h-12 items-center justify-between gap-2 px-4" style={{ background: CATEGORY_GRADIENT[course.category] ?? FALLBACK_GRADIENT }}>
        <span className="min-w-0 truncate text-[length:var(--kin-co-caption)] font-semibold uppercase tracking-[0.04em] text-[var(--kin-chu-tren-nut-chinh)]">{course.category}</span>
        {p.discountPct > 0 && <span className="flex-shrink-0 rounded-[var(--kin-bo-tron)] bg-[var(--kin-nen-trang)] px-2 py-0.5 text-[length:var(--kin-co-caption)] font-bold text-[var(--kin-tt-chu-loi)]">-{p.discountPct}%</span>}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="text-[length:var(--kin-co-body)] font-semibold leading-snug text-[var(--kin-chu-chinh)]">
          <Link href={`/khoa-hoc/${course.slug}`} className="block min-h-11 line-clamp-2 after:absolute after:inset-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)]">{course.title}</Link>
        </h3>
        {course.teacher && <p className="truncate text-[length:var(--kin-co-small)] text-[var(--kin-chu-phu)]">Gia sư {course.teacher}</p>}
        {meta && <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">{meta}</p>}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-tt-chu-xong)]">{seatLabel(course.seat)}</span>
          {course.tag && <span className="rounded-[var(--kin-bo-tron)] bg-[var(--kin-nen-nhan)] px-2 py-0.5 text-[length:var(--kin-co-caption)] font-semibold text-[var(--kin-nhan-link)]">{course.tag}</span>}
        </div>
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div className="min-w-0">
            {p.free ? (
              <span data-price="free" className="text-[length:var(--kin-co-tieu-de)] font-bold text-[var(--kin-tt-chu-xong)]">Miễn phí</span>
            ) : (
              <>
                <span data-price="paid" className="text-[length:var(--kin-co-tieu-de)] font-bold text-[var(--kin-nhan-link)]">{p.price.toLocaleString("vi-VN")}đ</span>
                {p.original && <span className="ml-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)] line-through">{p.original.toLocaleString("vi-VN")}đ</span>}
              </>
            )}
          </div>
          {/* Nhãn kiểu nút viền: cả thẻ đã là liên kết (after:inset-0), nên KHÔNG lồng thêm <a>. */}
          <span aria-hidden="true" className="inline-flex h-11 flex-shrink-0 items-center rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-o-nhap)] px-4 text-[length:var(--kin-co-small)] font-semibold text-[var(--kin-nhan-link)]">Đăng ký →</span>
        </div>
      </div>
    </article>
  );
}

export default function HomeCourses({ courses, chips }: { courses: PublicCard[]; chips: Chip[] }) {
  if (courses.length === 0) return null;
  return (
    <section aria-labelledby="home-lop-theo-ky-thi" data-home-block="courses">
      <div className={BLOCK_INNER}>
        <BlockHead id="home-lop-theo-ky-thi" label="Lớp đang mở" title="Lớp luyện thi theo từng kỳ thi" desc="Chọn theo kỳ thi. Mỗi thẻ cho biết ai dạy, giá và lớp còn chỗ không." />
        {chips.length > 0 && (
          <ul aria-label="Chọn kỳ thi" className="-mx-4 mb-6 flex list-none snap-x gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0">
            {chips.map(ch => (
              <li key={ch.name} className="flex-shrink-0 snap-start">
                <Link href={`/khoa-hoc?category=${encodeURIComponent(ch.name)}`}
                  className="inline-flex min-h-11 items-center whitespace-nowrap rounded-[var(--kin-bo-tron)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)] px-4 text-[length:var(--kin-co-small)] font-semibold text-[var(--kin-nhan-link)] transition-colors hover:bg-[var(--kin-nen-re-chuot)]">
                  {ch.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <ul tabIndex={0} aria-label="Lớp đang mở, vuốt ngang để xem thêm"
          className="-mx-4 flex list-none snap-x gap-3 overflow-x-auto px-4 pb-2 focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)] sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0 sm:pb-0">
          {courses.map(c => (
            <li key={c.slug} className="w-[280px] flex-shrink-0 snap-start sm:w-auto sm:flex-shrink sm:basis-[calc(50%-6px)] lg:basis-[calc((100%-24px)/3)] min-w-0">
              <HomeCourseCard course={c} />
            </li>
          ))}
        </ul>
        <BlockMore href="/khoa-hoc">Xem tất cả lớp học →</BlockMore>
      </div>
    </section>
  );
}
