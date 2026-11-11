// LOI-03 mục 4.4 — phiếu "Hôm nay có lớp" ở đầu "Việc của tôi" (trang học sinh mở đầu tiên). Dữ liệu: GET /api/student/hom-nay — MÁY CHỦ quyết "hôm nay"
// (todayKey, giờ VN, past); trình duyệt không tự tính ngày. Chỉ bài Đã đăng có ngày học (Lesson.scheduledAt) của lớp em đang học (enrollment active).
//   Có bài hôm nay: tiêu đề "Hôm nay có lớp" + "Thứ Tư, 11/11"; mỗi bài một hàng [giờ | tên lớp + tên bài | Mở tài liệu ↗ · Bài Azota ↗ · Làm bài tập]; giờ đã qua có chữ "Đã qua".
//   Sắp tới (7 ngày): tối đa 5 hàng gọn "Ngày mai · 19:30 · Toán 9 · Bài 6", nhiều hơn thì "Xem thêm" (máy chủ cắt ≤ 10).
//   Không bài hôm nay nhưng có sắp tới: một dòng "Hôm nay không có bài nào được hẹn." + Sắp tới. Cả hai rỗng: KHÔNG vẽ gì. Đang tải: không vẽ gì (tránh nháy).
//   Lỗi: ErrorStrip "Không tải được bài hôm nay." + Thử lại (không im lặng). Riêng 403 (gia sư / quản trị xem thử) ⇒ không vẽ gì.
// Không hiện thứ API không trả: không đáp án, điểm, lượt xem, đếm ngược, ghi chú; không push, không hẹn giờ. Liên kết ngoài mở tab mới, rel="noopener noreferrer".
// Móc kiểm thử: [data-hom-nay], [data-hom-nay-bai=<lessonId>], [data-hom-nay-sap-toi], [data-hom-nay-qua], [data-hom-nay-them].
"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ErrorStrip } from "@/components/kin/shell/Outlook";
import { kinButtonClass } from "@/components/kin/Button";
import { KinStatus } from "@/components/kin/Status";
import { vnDayLong, type HomNayItem, type HomNayResp } from "@/lib/studentLop";

const GOC = "text-[length:var(--kin-co-goc)]";
const UPCOMING_LIMIT = 5;
const linkCls = `inline-flex items-center min-h-11 ${GOC} font-medium text-[var(--kin-nhan-link)] underline [overflow-wrap:anywhere]`;

function TodayRow({ it }: { it: HomNayItem }) {
  const hasActions = it.docs.length > 0 || it.azota.length > 0 || !!it.baiTapHref;
  return (
    <li data-hom-nay-bai={it.lessonId} className="grid grid-cols-[auto_minmax(0,1fr)] md:grid-cols-[72px_minmax(0,1fr)_auto] gap-x-4 gap-y-1 items-start py-[var(--kin-kc-6)] border-b border-[var(--kin-vien-nhat)] last:border-b-0">
      <p className="pt-[11px] text-[length:var(--kin-co-body)] font-semibold leading-6 tabular-nums text-[var(--kin-chu-chinh)]">
        {it.time}
        {it.past && <span data-hom-nay-qua className="block md:mt-1"><KinStatus tone="mo">Đã qua</KinStatus></span>}
      </p>
      <div className="min-w-0">
        <p className={`pt-[11px] ${GOC} leading-5 text-[var(--kin-chu-mo-tren-nen-nhan)] break-words`}>{it.courseName}</p>
        <Link href={it.href} data-hom-nay-ten-bai className="inline-flex items-center min-h-11 text-[length:var(--kin-co-body)] font-medium leading-6 text-[var(--kin-chu-chinh)] hover:underline [overflow-wrap:anywhere]">{it.lessonTitle}</Link>
      </div>
      {hasActions && (
        <div className="col-span-2 md:col-span-1 flex flex-wrap items-center gap-x-4 gap-y-1 md:justify-end md:pt-1">
          {it.docs.map((d, i) => (
            <a key={`d${i}`} href={d.href} target="_blank" rel="noopener noreferrer" data-hom-nay-tai-lieu className={linkCls} aria-label={`Mở tài liệu ${d.name} (tab mới)`}>
              <span className="max-w-[220px] truncate">{d.name}</span>&nbsp;· Mở ↗
            </a>
          ))}
          {it.azota.map((a, i) => (
            <a key={`a${i}`} href={a.url} target="_blank" rel="noopener noreferrer" data-hom-nay-azota className={linkCls} aria-label={`${a.label} của bài ${it.lessonTitle} (tab mới)`}>{a.label} ↗</a>
          ))}
          {it.baiTapHref && <Link href={it.baiTapHref} data-hom-nay-bai-tap className={kinButtonClass("secondary")}>Làm bài tập</Link>}
        </div>
      )}
    </li>
  );
}

type State = { s: "dang-tai" } | { s: "loi" } | { s: "khong-phai-hoc-sinh" } | { s: "ok"; data: HomNayResp };

export default function HomNayCoLop() {
  const [st, setSt] = useState<State>({ s: "dang-tai" });
  const [tick, setTick] = useState(0);
  const [all, setAll] = useState(false);
  useEffect(() => {
    let live = true;
    fetch("/api/student/hom-nay", { credentials: "same-origin", cache: "no-store" })
      .then(async r => {
        // 403 = không phải học sinh (gia sư / quản trị xem thử trang này) ⇒ im lặng, không vẽ gì; như ThuVienLop.
        if (r.status === 403) return { s: "khong-phai-hoc-sinh" } as const;
        if (!r.ok) throw new Error(String(r.status));
        const d = (await r.json()) as HomNayResp;
        return { s: "ok", data: { ...d, today: Array.isArray(d.today) ? d.today : [], upcoming: Array.isArray(d.upcoming) ? d.upcoming : [] } } as const;
      })
      .then(next => { if (live) setSt(next); })
      .catch(() => { if (live) setSt({ s: "loi" }); });
    return () => { live = false; };
  }, [tick]);
  const retry = useCallback(() => { setSt({ s: "dang-tai" }); setTick(t => t + 1); }, []);

  if (st.s === "dang-tai" || st.s === "khong-phai-hoc-sinh") return null;
  if (st.s === "loi") return <div className="mb-6" data-hom-nay-loi><ErrorStrip message="Không tải được bài hôm nay." onRetry={retry} /></div>;
  const { today, upcoming, todayKey } = st.data;
  if (today.length === 0 && upcoming.length === 0) return null;

  const shownUp = all ? upcoming : upcoming.slice(0, UPCOMING_LIMIT);
  const dayLine = vnDayLong(todayKey);
  return (
    <section aria-labelledby="hom-nay-h" data-hom-nay className="mb-8 rounded-[var(--kin-bo-the)] bg-[var(--kin-nen-nhan)] px-[var(--kin-kc-7)] md:px-[var(--kin-kc-8)] py-[var(--kin-kc-7)]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="hom-nay-h" className="text-[length:var(--kin-co-tieu-de)] font-semibold leading-6 text-[var(--kin-chu-chinh)]">Hôm nay có lớp</h2>
        {dayLine && <p className={`${GOC} text-[var(--kin-chu-mo-tren-nen-nhan)]`}>{dayLine}</p>}
      </div>
      {today.length > 0 ? (
        <ul aria-label="Bài học hôm nay" className="mt-2">{today.map(it => <TodayRow key={it.lessonId} it={it} />)}</ul>
      ) : (
        <p className={`mt-3 ${GOC} text-[var(--kin-chu-mo-tren-nen-nhan)]`}>Hôm nay không có bài nào được hẹn.</p>
      )}
      {upcoming.length > 0 && (
        <div data-hom-nay-sap-toi className="mt-4 pt-4 border-t border-[var(--kin-vien-thuong)]">
          <h3 className={`${GOC} font-semibold text-[var(--kin-chu-chinh)]`}>Sắp tới</h3>
          <ul aria-label="Bài học sắp tới" className="mt-1">
            {shownUp.map(it => (
              <li key={it.lessonId}>
                <Link href={it.href} data-hom-nay-sap-toi-bai={it.lessonId} className={`flex items-center min-h-11 ${GOC} text-[var(--kin-chu-chinh)] hover:underline [overflow-wrap:anywhere]`}>
                  <span><span className="tabular-nums">{it.dayTitle} · {it.time}</span> · {it.courseName} · {it.lessonTitle}</span>
                </Link>
              </li>
            ))}
          </ul>
          {upcoming.length > UPCOMING_LIMIT && (
            <button type="button" data-hom-nay-them aria-expanded={all} onClick={() => setAll(v => !v)} className={`mt-1 inline-flex items-center min-h-11 px-1 ${GOC} text-[var(--kin-nhan-link)] underline`}>
              {all ? "Thu gọn" : `Xem thêm ${upcoming.length - UPCOMING_LIMIT} bài`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
