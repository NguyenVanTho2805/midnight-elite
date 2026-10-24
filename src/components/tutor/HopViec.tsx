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
import { KinPanel } from "@/components/kin/Panel";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { KinPage, KinPageHeader, KIN_TWO_COL, KIN_TABLE_HEAD } from "@/components/kin/PageLayout";
import { KinMoney, KinMoneyEye } from "@/components/kin/MoneyVisibility";
import SetupChecklist from "@/components/tutor/SetupChecklist";

function Skeleton() {
  const sk = "kin-skel kin-skel--soft";
  return (
    <div aria-busy="true" aria-label="Đang tải Hộp việc">
      <div className="hidden md:grid grid-cols-4 gap-x-8 gap-y-5 py-6 border-y border-[var(--kin-vien-nhat)]">
        {[0, 1, 2, 3].map(i => <div key={i} className={`h-[86px] rounded ${sk}`} />)}
      </div>
      <div className={`md:mt-8 ${KIN_TWO_COL}`}>
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
    <KinPage>
      <KinPageHeader title="Hộp việc"
        sub={<>{o ? `${o.dateLine} · ` : ""}<span className="md:hidden">Sổ dạy học</span><span className="hidden md:inline">Việc cần cô xử lý trước, việc chờ phụ huynh để riêng.</span></>}
        actions={<><KinMoneyEye /><Link href="/admin/khoa-hoc?tao=1" className={`${kinButtonClass("secondary")} max-md:hidden`}>Tạo lớp</Link></>} />

      {error && <ErrorStrip message="Không tải được Hộp việc." onRetry={load} />}
      {items === null || !o ? (!error ? <Skeleton /> : null) : (
        <>
          {o.setup && <SetupChecklist setup={o.setup} />}
          <KinStatRow boxed className="hidden md:grid">
            <KinStat label={`Học phí tháng ${o.monthNumber} đã xác nhận`} value={<KinMoney>{o.stats.confirmed.value}</KinMoney>} hint={o.stats.confirmed.hint} />
            <KinStat label="Phiếu đã lập" value={<KinMoney>{o.stats.invoices.value}</KinMoney>} hint={<KinMoney>{o.stats.invoices.hint}</KinMoney>} />
            <KinStat label="Lớp đang quản lý" value={o.stats.classes.value} hint={o.stats.classes.hint} />
            <KinStat label="Lịch hôm nay" value={o.stats.today.value} hint={o.stats.today.hint} />
          </KinStatRow>

          <div className={`md:mt-8 ${KIN_TWO_COL} lg:grid-rows-[auto_1fr]`}>
            {/* Buổi học sắp tới: trên điện thoại đứng trước danh sách việc; máy tính: cột phải, hàng trên. */}
            <section aria-labelledby="hv-next" className="lg:col-start-2 lg:row-start-1">
              <KinSectionHead id="hv-next" className="max-md:hidden"
                title={<><span className="md:hidden">{o.next?.meta.startsWith("Hôm nay") ? "Buổi học hôm nay" : "Buổi học sắp tới"}</span><span className="hidden md:inline">Buổi học sắp tới</span></>} />
              {o.next ? (
                <KinPanel variant="nhan" className="mt-4 max-md:mt-0">
                  <p className="md:hidden text-[length:var(--kin-co-goc)] uppercase tracking-[0.02em] text-[var(--kin-chu-mo)]">{o.next.meta.startsWith("Hôm nay") ? "Buổi học hôm nay" : "Buổi học sắp tới"}</p>
                  <p className="max-md:mt-3 text-[22px] leading-7 font-medium tabular-nums text-[var(--kin-chu-chinh)]">{o.next.time}</p>
                  <p className="mt-4 text-[length:var(--kin-co-tieu-de)] leading-6 text-[var(--kin-chu-chinh)]">{o.next.courseName}</p>
                  <p className="mt-4 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">{o.next.meta}</p>
                  {o.next.note && <p className="text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">{o.next.note}</p>}
                  <Link href={o.next.attendanceHref} className={`${kinButtonClass("primary")} mt-4`}>Mở buổi học</Link>
                  {o.next.following && <p className="mt-4 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Tiếp theo: {o.next.following}</p>}
                </KinPanel>
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
                  <KinPanel flush className="mt-4">
                  <ul aria-label="Việc cần cô xử lý">
                    {todo.map(i => (
                      <li key={i.id}>
                        <KinListRow href={i.href} title={i.title} sub={i.subtitle} trailing={i.when || undefined}
                          status={<KinStatus tone="cho">{i.action}</KinStatus>} />
                      </li>
                    ))}
                  </ul>
                  </KinPanel>
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

              {/* HV-04: số buổi trong tháng — chỉ đếm buổi, không tiền. Hoàn thành = buổi đã chốt "Đã dạy xong". */}
              <section aria-labelledby="hv-sess" className="mt-8" data-hv-sessions>
                <KinSectionHead id="hv-sess" title={`Buổi học tháng ${o.monthNumber}`} aside={<Link href="/lop-cua-toi/lich" className="inline-flex items-center min-h-11 hover:underline">Mở Lịch</Link>} />
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <KinPanel data-session-card="da-len-lich">
                    <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Đã lên lịch</p>
                    <p className="mt-1 text-[22px] leading-7 font-medium tabular-nums text-[var(--kin-chu-chinh)]">{o.sessions.scheduled}</p>
                    <p className="mt-1 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">Chưa chốt, chưa huỷ</p>
                  </KinPanel>
                  <KinPanel data-session-card="hoan-thanh">
                    <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Hoàn thành</p>
                    <p className="mt-1 text-[22px] leading-7 font-medium tabular-nums text-[var(--kin-chu-chinh)]">{o.sessions.completed}</p>
                    <p className="mt-1 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">Đã chốt “Đã dạy xong”</p>
                  </KinPanel>
                  <KinPanel data-session-card="da-nghi">
                    <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Đã nghỉ</p>
                    <p className="mt-1 text-[22px] leading-7 font-medium tabular-nums text-[var(--kin-chu-chinh)]">{o.sessions.cancelled}</p>
                    <p className="mt-1 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">Buổi huỷ hoặc báo nghỉ</p>
                  </KinPanel>
                </div>
              </section>

              {/* HV-05: yêu cầu tìm gia sư gửi tới cô và đang chờ cô duyệt. */}
              <section aria-labelledby="hv-req" className="mt-8" data-hv-requests>
                <KinSectionHead id="hv-req" title="Yêu cầu tìm gia sư" aside={<Link href={o.requests.href} className="inline-flex items-center min-h-11 hover:underline">Mở danh sách</Link>} />
                <div className="pt-4">
                  <KinCallout title={o.requests.newCount > 0 ? `${o.requests.newCount} yêu cầu mới đang chờ cô` : "Chưa có yêu cầu mới"}>
                    <p>{o.requests.newCount > 0 ? "Phụ huynh gửi tới hồ sơ công khai của cô. Cô xem rồi tiếp nhận hoặc từ chối." : "Khi phụ huynh gửi yêu cầu từ hồ sơ công khai, yêu cầu sẽ hiện ở đây."}</p>
                    <Link href={o.requests.href} className="mt-1 inline-flex items-center min-h-11 text-[var(--kin-nhan-link)] underline">{o.requests.newCount > 0 ? "Xem và trả lời yêu cầu" : "Mở trang yêu cầu"}</Link>
                  </KinCallout>
                </div>
              </section>

              <section aria-labelledby="hv-fee" className="mt-8" data-hv-fee>
                <KinSectionHead id="hv-fee" title={`Học phí tháng ${o.monthNumber}`} aside={<Link href="/lop-cua-toi/hoc-phi" className="inline-flex items-center min-h-11 hover:underline">Mở sổ học phí</Link>} />
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <KinPanel data-fee-card="da-thu">
                    <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Đã thu</p>
                    <p className="mt-1 text-[22px] leading-7 font-medium tabular-nums text-[var(--kin-chu-chinh)] break-words"><KinMoney>{o.month.collected}</KinMoney></p>
                    <p className="mt-1 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">{o.stats.confirmed.hint}</p>
                  </KinPanel>
                  <KinPanel data-fee-card="chua-thu">
                    <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Chưa thu</p>
                    <p className="mt-1 text-[22px] leading-7 font-medium tabular-nums text-[var(--kin-chu-chinh)] break-words"><KinMoney>{o.month.receivable}</KinMoney></p>
                    <p className="mt-1 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">{o.month.receivableHint}</p>
                  </KinPanel>
                </div>
              </section>
            </div>

            <div className="lg:col-start-2 lg:row-start-2 min-w-0">
              <section aria-labelledby="hv-soon" className="mb-8" data-hv-upcoming>
                <KinSectionHead id="hv-soon" title="Lịch dạy gần nhất" aside={<Link href="/lop-cua-toi/lich" className="inline-flex items-center min-h-11 hover:underline">Mở Lịch</Link>} />
                {o.upcoming.length === 0 ? (
                  <KinCallout>Chưa có buổi nào trong 7 ngày tới.</KinCallout>
                ) : (
                  <KinPanel flush className="mt-4">
                    <ul aria-label="Các buổi dạy gần nhất">
                      {o.upcoming.map((u, i) => (
                        <li key={i}><KinListRow href={u.href} title={`${u.time} · ${u.courseName}`} sub={`${u.when} · ${u.meta}`} /></li>
                      ))}
                    </ul>
                  </KinPanel>
                )}
              </section>
              <section aria-labelledby="hv-classes">
                <KinSectionHead id="hv-classes" title={<><span className="md:hidden">Lớp của cô</span><span className="hidden md:inline">Lớp thường dùng</span></>}
                  aside={<span className="md:hidden">{o.classes.total} lớp · {o.stats.classes.hint.replace(" đang học", "")}</span>} />
                {o.classes.rows.length === 0 ? (
                  <KinEmptyState title="Cô chưa mở lớp nào" action={<Link href="/admin/khoa-hoc?tao=1" className={kinButtonClass("primary")}>Tạo lớp</Link>}>
                    Tạo lớp đầu tiên, rồi gửi mã mời cho học sinh vào lớp.
                  </KinEmptyState>
                ) : (
                  <>
                  <div className="md:hidden pt-4 flex flex-wrap items-center gap-3">
                    {o.classes.rows.slice(0, 2).map(c => (
                      <Link key={c.id} href={c.href} aria-label={`${c.name}: ${c.students} học sinh`} className={`${kinButtonClass("secondary")} max-w-full`}><span className="truncate">{c.name}</span></Link>
                    ))}
                    <Link href="/lop-cua-toi/lop" className="inline-flex items-center min-h-11 px-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Tất cả</Link>
                  </div>
                  <div className="mt-4 hidden md:block">
                    <div aria-hidden className={`grid grid-cols-2 ${KIN_TABLE_HEAD}`}>
                      <span>Lớp</span><span>Học sinh</span>
                    </div>
                    <ul aria-label="Lớp thường dùng">
                      {o.classes.rows.map(c => (
                        <li key={c.id}>
                          <Link href={c.href} aria-label={`${c.name}: ${c.students} học sinh`}
                            className="grid grid-cols-2 px-[var(--kin-kc-6)] min-h-[var(--kin-hang-bang)] items-center border-b border-[var(--kin-vien-nhat)] text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)] hover:bg-[var(--kin-nen-re-chuot)] transition-colors">
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
                  </>
                )}
              </section>
              <KinPanel className="mt-8 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-phu)]">Chỉ chốt buổi đã dạy mới tạo học phí. Lưu điểm danh không tự tính tiền.</KinPanel>
            </div>
          </div>
        </>
      )}
    </KinPage>
  );
}
