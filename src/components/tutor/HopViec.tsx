// Hộp việc của gia sư (Figma "Gia sư · Hộp việc" 299:111821, điện thoại 299:116033): TRANG DỌC, không còn hai khung.
// Tiêu đề + "Tạo lớp"; dải 4 số; cột trái "Cần cô xử lý" (mỗi LOẠI việc một dòng, bấm đi thẳng tới trang xử lý) rồi "Chờ phụ huynh"
// (không tính là việc gia sư cần làm); cột phải "Buổi học sắp tới", "Lớp thường dùng", ghi chú chân.
// Điện thoại: một cột, buổi học sắp tới lên trước. Lỗi tải: giữ số cũ, dải báo lỗi có "Thử lại". Đang tải lần đầu: khung xương, không vòng xoay.
// Dữ liệu: /api/tutor/hop-viec ({ items, total, overview }); tải lại khi cửa sổ lấy lại focus.
"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { InboxItem } from "@/lib/tutorInbox";
import type { HopViecOverview } from "@/lib/tutorOverview";
import { ErrorStrip } from "@/components/kin/shell/Outlook";
import { kinButtonClass } from "@/components/kin/Button";
import { KinStatus } from "@/components/kin/Status";
import { KinStat, KinStatRow } from "@/components/kin/Stat";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { KinListRow } from "@/components/kin/ListRow";
import { KinCallout } from "@/components/kin/Callout";
import { KinEmptyState } from "@/components/kin/EmptyState";

function Skeleton() {
  const sk = "kin-skel kin-skel--soft";
  return (
    <div aria-busy="true" aria-label="Đang tải Hộp việc" className="mt-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-5 py-6 border-y border-[var(--kin-vien-nhat)]">
        {[0, 1, 2, 3].map(i => <div key={i} className={`h-[72px] rounded ${sk}`} />)}
      </div>
      <div className="mt-6 grid lg:grid-cols-[minmax(0,1fr)_354px] gap-x-8 gap-y-6">
        <div className="space-y-3">{[0, 1, 2].map(i => <div key={i} className={`h-[76px] rounded ${sk}`} />)}</div>
        <div className={`h-[220px] rounded ${sk}`} />
      </div>
    </div>
  );
}

export default function HopViec() {
  const [items, setItems] = useState<InboxItem[] | null>(null);
  const [overview, setOverview] = useState<HopViecOverview | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    fetch("/api/tutor/hop-viec", { credentials: "same-origin", cache: "no-store" })
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(d => { setItems(Array.isArray(d.items) ? d.items : []); setOverview(d.overview ?? null); setError(false); })
      .catch(() => setError(true));
  }, []);

  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const todo = (items ?? []).filter(i => !i.waiting);
  const waiting = (items ?? []).filter(i => i.waiting);
  const todoCount = todo.reduce((n, i) => n + (Number(i.title.match(/^\d+/)?.[0]) || 1), 0);
  const o = overview;

  return (
    <div className="px-4 md:px-10 pt-6 md:pt-8 pb-10 bg-[var(--kin-nen-trang)]">
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-6">
        <div className="min-w-0">
          <h1 className="text-[length:var(--kin-co-h2)] leading-9 font-medium tracking-[-0.01em] text-[var(--kin-chu-chinh)]">Hộp việc</h1>
          <p className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">
            {o ? `${o.dateLine} · ` : ""}Việc cần cô xử lý trước, việc chờ phụ huynh để riêng.
          </p>
        </div>
        <Link href="/admin/khoa-hoc?tao=1" className={`${kinButtonClass("secondary")} self-start flex-shrink-0`}>Tạo lớp</Link>
      </header>

      {error && <ErrorStrip message="Không tải được Hộp việc." onRetry={load} />}
      {items === null || !o ? (!error ? <Skeleton /> : null) : (
        <>
          <KinStatRow>
            <KinStat label={`Học phí tháng ${o.monthNumber} đã xác nhận`} value={o.stats.confirmed.value} hint={o.stats.confirmed.hint} />
            <KinStat label="Phiếu đã lập" value={o.stats.invoices.value} hint={o.stats.invoices.hint} />
            <KinStat label="Lớp đang quản lý" value={o.stats.classes.value} hint={o.stats.classes.hint} />
            <KinStat label="Lịch hôm nay" value={o.stats.today.value} hint={o.stats.today.hint} />
          </KinStatRow>

          <div className="mt-8 grid lg:grid-cols-[minmax(0,1fr)_354px] lg:grid-rows-[auto_1fr] gap-x-8 gap-y-8 items-start">
            {/* Buổi học sắp tới: trên điện thoại đứng trước danh sách việc; máy tính: cột phải, hàng trên. */}
            <section aria-labelledby="hv-next" className="lg:col-start-2 lg:row-start-1">
              <KinSectionHead id="hv-next" title="Buổi học sắp tới" />
              {o.next ? (
                <div className="pt-5">
                  <p className="text-[22px] leading-7 font-medium tabular-nums text-[var(--kin-chu-chinh)]">{o.next.time}</p>
                  <p className="mt-4 text-[length:var(--kin-co-tieu-de)] leading-6 text-[var(--kin-chu-chinh)]">{o.next.courseName}</p>
                  <p className="mt-4 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">{o.next.meta}</p>
                  {o.next.note && <p className="text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">{o.next.note}</p>}
                  <Link href={o.next.attendanceHref} className={`${kinButtonClass("primary")} mt-4`}>Mở buổi học</Link>
                  {o.next.following && <p className="mt-4 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Tiếp theo: {o.next.following}</p>}
                </div>
              ) : (
                <KinEmptyState title="7 ngày tới chưa có buổi nào" action={<Link href="/lop-cua-toi/lich" className={kinButtonClass("secondary")}>Mở Lịch</Link>}>
                  Khi lớp có khung giờ học, buổi gần nhất sẽ hiện ở đây.
                </KinEmptyState>
              )}
            </section>

            <div className="lg:col-start-1 lg:row-start-1 lg:row-span-2 min-w-0">
              <section aria-labelledby="hv-todo">
                <KinSectionHead id="hv-todo" title="Cần cô xử lý" aside={todo.length > 0 ? `${todoCount} việc` : undefined} />
                {todo.length === 0 ? (
                  <KinEmptyState title="Không có việc nào đang chờ cô" action={<Link href="/lop-cua-toi/lich" className={kinButtonClass("secondary")}>Xem lịch hôm nay</Link>}>
                    Báo nghỉ sát giờ, tiền cần đối soát, bài chưa chấm và các việc cần cô ra tay sẽ hiện ở đây.
                  </KinEmptyState>
                ) : (
                  <ul aria-label="Việc cần cô xử lý">
                    {todo.map(i => (
                      <li key={i.id}>
                        <KinListRow href={i.href} title={i.title} sub={i.subtitle} trailing={i.when || undefined}
                          status={<KinStatus tone="cho">{i.action}</KinStatus>} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section aria-labelledby="hv-wait" className="mt-8">
                <KinSectionHead id="hv-wait" title="Chờ phụ huynh" aside="Không tính là việc cô cần làm" />
                <div className="pt-4 space-y-3">
                  {waiting.length === 0 ? (
                    <KinCallout>Hiện không có gì đang chờ phụ huynh.</KinCallout>
                  ) : waiting.map(i => (
                    <KinCallout key={i.id} title={i.title}>
                      {i.detail.rows.slice(0, 3).map((r, idx) => <p key={idx}>{r.title} · {r.sub}</p>)}
                      {i.detail.more > 0 && <p>và {i.detail.more} việc nữa.</p>}
                      <p className="mt-1">{i.detail.meta}</p>
                      <Link href={i.href} className="mt-1 inline-flex items-center min-h-11 text-[var(--kin-nhan-link)] underline">Mở danh sách học viên của lớp</Link>
                    </KinCallout>
                  ))}
                </div>
              </section>
            </div>

            <div className="lg:col-start-2 lg:row-start-2 min-w-0">
              <section aria-labelledby="hv-classes">
                <KinSectionHead id="hv-classes" title="Lớp thường dùng" />
                {o.classes.rows.length === 0 ? (
                  <KinEmptyState title="Cô chưa mở lớp nào" action={<Link href="/admin/khoa-hoc?tao=1" className={kinButtonClass("primary")}>Tạo lớp</Link>}>
                    Tạo lớp đầu tiên, rồi gửi mã mời cho học sinh vào lớp.
                  </KinEmptyState>
                ) : (
                  <div className="mt-4">
                    <div aria-hidden className="grid grid-cols-2 px-[var(--kin-kc-6)] h-11 items-center bg-[var(--kin-nen-bang)] text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">
                      <span>Lớp</span><span>Học sinh</span>
                    </div>
                    <ul aria-label="Lớp thường dùng">
                      {o.classes.rows.map(c => (
                        <li key={c.id}>
                          <Link href={c.href} aria-label={`${c.name}: ${c.students} học sinh`}
                            className="grid grid-cols-2 items-center px-[var(--kin-kc-6)] min-h-[62px] border-b border-[var(--kin-vien-nhat)] text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)] hover:bg-[var(--kin-nen-re-chuot)] transition-colors">
                            <span className="min-w-0 truncate">{c.name}</span>
                            <span className="text-[var(--kin-nhan-link)] tabular-nums">{c.students} →</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <Link href="/lop-cua-toi/lop" className="flex items-center min-h-11 px-[var(--kin-kc-7)] mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)] hover:text-[var(--kin-chu-chinh)]">
                      Xem {o.classes.total} lớp
                    </Link>
                  </div>
                )}
              </section>
              <KinCallout className="mt-8">Chỉ chốt buổi đã dạy mới tạo học phí. Lưu điểm danh không tự tính tiền.</KinCallout>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
