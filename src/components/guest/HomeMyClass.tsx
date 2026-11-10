// Trang chủ — khối "Lớp của tôi" (chỉ HỌC SINH). Trang chủ là trang TĨNH nên khối này nằm ở máy khách: chưa biết là ai → không vẽ gì (khách không bị nháy);
// biết là học sinh thì khối hiện ra. Dữ liệu chỉ của chính em (useMyClasses + useProgress); không hiện bạn học. Ba trạng thái: đang tải · rỗng · LỖI (không coi lỗi là "chưa vào lớp nào").
"use client";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useMyClasses } from "@/hooks/useMyClasses";
import { useProgress } from "@/hooks/useProgress";
import { homeBlocksFor, toHomeViewer } from "@/lib/homeLayout";
import { teacherLabel } from "@/components/student/DanhMucLop";
import { kinButtonClass } from "@/components/kin/buttonClass";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { KinSkeleton } from "@/components/kin/StateCard";
import { ErrorStrip } from "@/components/kin/shell/Outlook";

const MAX_ROWS = 3;

export default function HomeMyClass() {
  const { user, isLoading } = useAuth();
  const viewer = toHomeViewer(user, isLoading);
  if (!homeBlocksFor(viewer, { quiz: false }).myClass) return null;
  return <MyClassBody />;
}

function MyClassBody() {
  const { classes, loading, error, reload } = useMyClasses();
  const { courseCompletion } = useProgress();
  const state = loading ? "loading" : error ? "error" : classes.length === 0 ? "empty" : "ok";
  const shown = classes.slice(0, MAX_ROWS);

  return (
    <section aria-labelledby="home-lop-cua-toi" data-home-block="my-class" data-home-state={state} className="bg-[var(--kin-nen-bang)] py-10">
      <div className="mx-auto max-w-[1120px] px-4 sm:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div className="min-w-0">
            <h2 id="home-lop-cua-toi" className="kin-chu-tieu-de font-semibold text-[length:var(--kin-co-h2)] leading-tight text-[var(--kin-chu-chinh)]">Lớp của tôi</h2>
            <p className="mt-1 text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">Tiếp tục học từ chỗ bạn đã dừng.</p>
          </div>
          {state === "ok" && (
            <Link href="/student/hoc-tap" data-home-my-class-cta className={`${kinButtonClass("primary", "lg")} w-full sm:w-auto min-h-12`}>Vào Lớp của tôi</Link>
          )}
        </div>

        {state === "loading" && (
          <div role="status" aria-busy="true" aria-label="Đang tải Lớp của tôi" data-home-skeleton className="rounded-[var(--kin-bo-the)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)]">
            {[0, 1].map(i => <div key={i} className="px-[var(--kin-kc-6)] py-[var(--kin-kc-7)] border-b border-[var(--kin-vien-nhat)] last:border-b-0"><KinSkeleton widths={[48, 30]} /></div>)}
          </div>
        )}

        {state === "error" && (
          <div className="rounded-[var(--kin-bo-the)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)] overflow-hidden">
            <ErrorStrip message="Không tải được danh sách lớp của bạn." onRetry={reload} />
          </div>
        )}

        {state === "empty" && (
          <div className="rounded-[var(--kin-bo-the)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)]">
            <KinEmptyState title="Bạn chưa vào lớp nào"
              action={<span className="flex flex-wrap justify-center gap-3"><Link href="/student/nhap-ma-lop" className={kinButtonClass("primary")}>Nhập mã lớp</Link><Link href="/khoa-hoc?gia=free" className={kinButtonClass("secondary")}>Tìm lớp miễn phí</Link></span>}>
              Gia sư sẽ gửi cho bạn mã mời của lớp. Nhập mã đó để vào lớp. Chưa có mã thì xem các lớp miễn phí đang mở.
            </KinEmptyState>
          </div>
        )}

        {state === "ok" && (
          <>
            <ul aria-label="Các lớp của tôi" className="rounded-[var(--kin-bo-the)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)] overflow-hidden">
              {shown.map(c => {
                const done = Math.min(courseCompletion[c.id] ?? 0, c.lessonCount);
                const sub = [teacherLabel(c.instructor), c.category.trim()].filter(Boolean).join(" · ");
                return (
                  <li key={c.id} data-home-class-row={c.id} className="border-b border-[var(--kin-vien-nhat)] last:border-b-0">
                    <Link href={`/student/hoc-tap?course=${c.id}`} className="flex items-start justify-between gap-4 min-h-16 px-[var(--kin-kc-6)] py-[var(--kin-kc-6)] hover:bg-[var(--kin-nen-re-chuot)] transition-colors">
                      <span className="min-w-0 flex-1">
                        <span className="block text-[length:var(--kin-co-tieu-de)] leading-6 font-medium text-[var(--kin-chu-chinh)] break-words">{c.name}</span>
                        {sub && <span className="block mt-0.5 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)] break-words">{sub}</span>}
                        <span className="block mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">{c.lessonCount > 0 ? `${done}/${c.lessonCount} bài đã hoàn thành` : "Lớp chưa có bài học"}</span>
                      </span>
                      <span className="flex-shrink-0 self-center text-[length:var(--kin-co-goc)] text-[var(--kin-nhan-link)]">Vào lớp →</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            {classes.length > MAX_ROWS && (
              <Link href="/student/hoc-tap" className="mt-2 inline-flex items-center min-h-11 text-[length:var(--kin-co-goc)] font-semibold text-[var(--kin-nhan-link)] underline">Xem tất cả {classes.length} lớp →</Link>
            )}
          </>
        )}
      </div>
    </section>
  );
}
