"use client";
// BU-05 — ô hỏi của KHÁCH (không cần tài khoản): form HTML thật, POST application/x-www-form-urlencoded tới /api/community/guest-questions → 303 về /cong-dong?da-gui=1
// (hoặc ?loi=<mã>). Có ô bẫy `website` ẩn. Không ảnh, không tệp. Bài sẽ chờ duyệt, KHÔNG hiện trong feed của khách.
// Cờ KIN_GUEST_QUESTIONS (máy chủ) tắt → chỉ còn lời mời đăng nhập (đúng hiện trạng).
import { useState } from "react";
import Link from "next/link";
import { KinButton, kinButtonClass } from "@/components/kin";
import { loginHref } from "./format";

const field = "w-full rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)] px-3 py-2.5 text-[length:var(--kin-co-body)] text-[var(--kin-chu-chinh)] placeholder:text-[var(--kin-chu-mo)]";

export function GuestQuestionForm({ open: formOpen }: { open: boolean }) {
  const [sending, setSending] = useState(false);
  return (
    <div className="px-4 py-4 border-b border-[var(--kin-vien-thuong)]" data-kc-guest-box>
      {formOpen ? (
        <details className="group">
          <summary className="kc-focus flex min-h-11 cursor-pointer list-none items-center justify-between gap-3">
            <span>
              <span className="block text-[length:var(--kin-co-body)] font-semibold text-[var(--kin-chu-chinh)]">Đặt câu hỏi — không cần tài khoản</span>
              <span className="block kc-meta">Gia sư và các bạn sẽ trả lời công khai.</span>
            </span>
            <span className={kinButtonClass("secondary")} aria-hidden>Đặt câu hỏi</span>
          </summary>
          <form method="POST" action="/api/community/guest-questions" className="mt-3 flex flex-col gap-3" onSubmit={() => setSending(true)} data-kc-guest-form>
            <div className="kc-trap" aria-hidden="true">
              <label>Để trống<input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" /></label>
            </div>
            <label className="flex flex-col gap-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">Tên hiển thị
              <input name="name" required minLength={2} maxLength={40} autoComplete="nickname" placeholder="Ví dụ: Minh" className={field} />
            </label>
            <label className="flex flex-col gap-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">Tiêu đề câu hỏi
              <input name="title" required minLength={5} maxLength={120} placeholder="Ngắn gọn, rõ ý" className={field} />
            </label>
            <label className="flex flex-col gap-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">Nội dung
              <textarea name="content" required minLength={10} maxLength={600} rows={4} placeholder="Bạn đang vướng ở đâu?" className={`${field} resize-none`} />
            </label>
            <p className="kc-meta">Câu hỏi sẽ hiện sau khi được duyệt. Đừng ghi số điện thoại hay liên kết ngoài.</p>
            <div><KinButton type="submit" loading={sending} loadingLabel="Đang gửi…">Gửi câu hỏi</KinButton></div>
          </form>
        </details>
      ) : (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[length:var(--kin-co-body)] font-semibold text-[var(--kin-chu-chinh)]">Đăng nhập để đặt câu hỏi</p>
          <Link href={loginHref("/cong-dong")} className={kinButtonClass("primary")}>Đăng nhập</Link>
        </div>
      )}
      <p className="mt-3 text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">
        <Link href={loginHref("/cong-dong")} className="kc-focus underline">Đăng nhập</Link> để chia sẻ bài viết.
      </p>
    </div>
  );
}
