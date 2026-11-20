// LOI-07 (11/11/2026, nợ P3 của LOI-01) — dòng nhắc "Phần này đang tạm đóng." trên trang đầu khi người dùng vừa bị chuyển ra khỏi một phần đang ẩn
// (thông báo cũ trỏ vào bài tin tức, trả lời cộng đồng chung, câu hỏi cũ /student/hoi-dap/<id>…). Chốt chặn gắn `?tam-dong=<CỜ>` (src/lib/hostRouting.ts,
// src/app/(guest)/cong-dong/[id]/page.tsx); ở đây chỉ ĐỌC dấu qua `pausedNoticeFrom` (features.ts, rác / cờ đang mở → null). Không nói tên phần, không số liệu.
// MỘT component cho cả bốn trang đích (khách "/", Việc của tôi, Hộp việc, /admin): cắm một lần ở layout gốc, không sửa vỏ nào. Nổi ở góc trên như thông báo KiN,
// KHÔNG tự tắt (đọc kịp), "Đã hiểu" ≥ 44px đóng và bỏ dấu khỏi địa chỉ (tải lại không hiện nữa, giữ các tham số khác). Móc kiểm thử: [data-paused-notice=<CỜ>].
"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { KinToast } from "./Toast";
import { KinButton } from "./Button";
import { PAUSED_PARAM, pausedNoticeFrom } from "@/lib/features";

function Notice() {
  const sp = useSearchParams();
  const k = pausedNoticeFrom(sp?.toString() ?? "");
  const [closed, setClosed] = useState<string | null>(null);
  if (!k || closed === k) return null;
  const close = () => {
    setClosed(k);
    try {
      const u = new URL(window.location.href);
      u.searchParams.delete(PAUSED_PARAM);
      window.history.replaceState(window.history.state, "", u.pathname + u.search + u.hash);
    } catch { /* địa chỉ lạ: chỉ ẩn dòng nhắc */ }
  };
  return (
    <div data-paused-notice={k} className="fixed top-4 left-4 right-4 sm:left-auto sm:w-[400px] z-[150] flex justify-end">
      <KinToast tone="tin" title="Phần này đang tạm đóng."
        detail={<>KiN đưa bạn về trang đầu. Các phần khác vẫn dùng bình thường.<span className="block mt-2"><KinButton variant="secondary" onClick={close}>Đã hiểu</KinButton></span></>} />
    </div>
  );
}

export function PausedNotice() {
  return <Suspense fallback={null}><Notice /></Suspense>;
}
