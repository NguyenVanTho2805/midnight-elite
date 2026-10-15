// Chuyển động (15/10/2026) lấy từ Lucian UX/UI Prompt #074 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#074
// (CSS .kin-bell*, .kin-badge, .kin-pan, .kin-notif-*, .kin-dot ở src/app/kin-motion.css):
//   - có thông báo MỚI (số chưa đọc tăng) → chuông rung 0,9 giây, huy hiệu nảy lên;
//   - mở bảng → bảng nở ra từ chỗ chuông; thông báo mới đến lúc bảng đang mở → dòng mới đẩy xuống từ trên;
//   - bấm đọc → chấm chưa đọc co lại, nền nhạt dần.
// Rung / nảy bật bằng cách gắn lớp thẳng lên DOM (không qua state) nên không dựng lại thành phần mỗi 30 giây khi thăm dò.
"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Notification as BellIcon } from "griddy-icons";
import { useNotifications } from "@/hooks/useNotifications";
import { replayClass } from "@/lib/replayClass";

const NONE: ReadonlySet<string> = new Set();

const TYPE_ICON: Record<string, string> = {
  enrollment:    "🎓",
  exam_new:      "📝",
  exam_reminder: "⏰",
  class_reminder: "🎥",
  thread_reply:    "💬",
  thread_like:     "❤️",
  reply_like:      "❤️",
  article_new:     "📰",
  answer_new:      "🙋",
  answer_accepted: "🪙",
  report_penalty:  "⚠️",
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1)   return "Vừa xong";
  if (min < 60)  return `${min} phút trước`;
  const hr = Math.floor(min / 60);
  if (hr < 24)   return `${hr} giờ trước`;
  return `${Math.floor(hr / 24)} ngày trước`;
}

export default function NotificationBell() {
  const router = useRouter();
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);
  const badgeRef = useRef<HTMLSpanElement>(null);
  const prevUnread = useRef<number | null>(null);
  // Dòng MỚI = id chưa có ở lần thăm dò trước (lần tải đầu không có dòng mới). Chỉ giữ khi bảng đang mở: đóng bảng thì xoá, mở lại không phát lại chuyển động.
  const [track, setTrack] = useState<{ sig: string | null; fresh: ReadonlySet<string> }>({ sig: null, fresh: NONE });
  const sig = loading ? null : notifications.map(n => n.id).join(",");
  let nextTrack = track;
  if (sig !== null && sig !== track.sig) {
    const before = new Set((track.sig ?? "").split(","));
    nextTrack = { sig, fresh: track.sig === null ? NONE : new Set(notifications.filter(n => !before.has(n.id)).map(n => n.id)) };
  }
  if (!open && nextTrack.fresh.size > 0) nextTrack = { sig: nextTrack.sig, fresh: NONE };
  if (nextTrack !== track) setTrack(nextTrack);

  // Số chưa đọc TĂNG so với lần thăm dò trước (không tính lần tải đầu) → chuông rung + huy hiệu nảy; đổi số bất kỳ → huy hiệu nảy.
  useEffect(() => {
    if (loading) return;
    const prev = prevUnread.current;
    prevUnread.current = unreadCount;
    if (prev === null || prev === unreadCount) return;
    if (unreadCount > prev) replayClass(bellRef.current, "kin-bell-ring");
    replayClass(badgeRef.current, "kin-badge-pop");
  }, [unreadCount, loading]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleClick(n: typeof notifications[number]) {
    if (!n.isRead) markAsRead(n.id);
    setOpen(false);
    if (n.link) router.push(n.link);
  }

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        ref={bellRef}
        onClick={() => setOpen(p => !p)}
        className="kin-bell kin-m relative w-9 h-9 rounded-lg flex items-center justify-center hover:bg-[var(--kin-nen-bang)]"
        style={{ border: "1px solid var(--kin-vien-thuong)", background: open ? "var(--kin-nen-bang)" : "var(--kin-nen-trang)" }}
        aria-label={unreadCount > 0 ? `Thông báo, ${unreadCount} chưa đọc` : "Thông báo"}
        aria-expanded={open}>
        <BellIcon size={18} style={{ color: "var(--kin-chu-mo)" }} />
        <span ref={badgeRef} aria-hidden="true" data-zero={unreadCount > 0 ? undefined : ""}
          className="kin-badge absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[length:var(--kin-co-caption)] font-bold text-white"
          style={{ background: "var(--kin-tt-chu-loi)" }}>
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      </button>

      {open && (
        <div className="kin-pan kin-m absolute right-0 top-full mt-2 w-80 max-w-[90vw] rounded-xl z-50 overflow-hidden"
          style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)", boxShadow: "rgba(15,15,15,0.1) 0px 4px 16px 0px" }}>

          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--kin-vien-thuong)" }}>
            <p className="text-sm font-extrabold" style={{ color: "var(--kin-chu-chinh)" }}>Thông báo</p>
            {unreadCount > 0 && (
              <button onClick={markAllAsRead} className="text-xs font-semibold" style={{ color: "var(--kin-nhan-link)" }}>
                Đánh dấu đã đọc
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-sm" style={{ color: "var(--kin-chu-mo)" }}>Chưa có thông báo nào</p>
              </div>
            ) : (
              notifications.map(n => {
                return (
                  <div key={n.id} className={track.fresh.has(n.id) ? "kin-notif-it kin-notif-it--new" : "kin-notif-it"}>
                    <div className="kin-notif-in">
                      <button onClick={() => handleClick(n)}
                        className="kin-notif-btn w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-[var(--kin-nen-bang)]"
                        style={{ borderBottom: "1px solid var(--kin-vien-thuong)", background: n.isRead ? "transparent" : "var(--kin-nhan-nen-nhat)" }}>
                        <span className="text-lg flex-shrink-0 leading-none mt-0.5">{TYPE_ICON[n.type] ?? "🔔"}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold leading-snug" style={{ color: "var(--kin-chu-chinh)" }}>{n.title}</p>
                          <p className="text-xs mt-0.5 leading-snug" style={{ color: "var(--kin-chu-mo)" }}>{n.message}</p>
                          <p className="text-xs mt-1" style={{ color: "var(--kin-chu-mo)" }}>{timeAgo(n.createdAt)}</p>
                        </div>
                        <span aria-hidden="true" data-read={n.isRead ? "" : undefined} className="kin-dot w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: "var(--kin-nhan-nen)" }} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
