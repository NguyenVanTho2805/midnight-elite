"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Notification as BellIcon } from "griddy-icons";
import { useNotifications } from "@/hooks/useNotifications";

const TYPE_ICON: Record<string, string> = {
  enrollment:    "🎓",
  exam_new:      "📝",
  exam_reminder: "⏰",
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
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
        onClick={() => setOpen(p => !p)}
        className="relative w-9 h-9 rounded-lg flex items-center justify-center transition-all hover:bg-[#f6f5f4]"
        style={{ border: "1px solid #e5e3df", background: open ? "#f6f5f4" : "#ffffff" }}
        aria-label="Thông báo">
        <BellIcon size={18} style={{ color: "#6B7280" }} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
            style={{ background: "#FF2157" }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-w-[90vw] rounded-xl z-50 overflow-hidden"
          style={{ background: "#ffffff", border: "1px solid #e5e3df", boxShadow: "rgba(15,15,15,0.1) 0px 4px 16px 0px" }}>

          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid #e5e3df" }}>
            <p className="text-sm font-extrabold" style={{ color: "#1E2938" }}>Thông báo</p>
            {unreadCount > 0 && (
              <button onClick={markAllAsRead} className="text-xs font-semibold" style={{ color: "#0068FF" }}>
                Đánh dấu đã đọc
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-sm" style={{ color: "#9CA3AF" }}>Chưa có thông báo nào</p>
              </div>
            ) : (
              notifications.map(n => (
                <button key={n.id} onClick={() => handleClick(n)}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[#fafafa]"
                  style={{ borderBottom: "1px solid #e5e3df", background: n.isRead ? "transparent" : "#F0F7FF" }}>
                  <span className="text-lg flex-shrink-0 leading-none mt-0.5">{TYPE_ICON[n.type] ?? "🔔"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold leading-snug" style={{ color: "#1E2938" }}>{n.title}</p>
                    <p className="text-xs mt-0.5 leading-snug" style={{ color: "#6B7280" }}>{n.message}</p>
                    <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.isRead && <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: "#0068FF" }} />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
