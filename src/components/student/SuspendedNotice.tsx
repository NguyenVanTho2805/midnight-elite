// Trang thông báo cho học sinh đã nghỉ lớp (quyết định 06/11/2026): không xem được bài / bản ghi của lớp đó nữa.
// Giọng KiN; KHÔNG tên gia sư, KHÔNG số tiền. Dùng được ở Server và Client Component (không "use client", không hook).
import Link from "next/link";
import { KinEmptyState, kinButtonClass } from "@/components/kin";
import { SUSPENDED_CONTENT_MESSAGE } from "@/lib/suspendedContent";

export function SuspendedNotice({ contactHref, backHref = "/student/hoc-tap" }: { contactHref: string | null; backHref?: string }) {
  return (
    <div data-suspended-notice className="px-4 md:px-10 py-10">
      <KinEmptyState
        title="Bạn đã nghỉ lớp này"
        action={
          <div className="flex flex-wrap justify-center gap-3">
            {contactHref && <Link href={contactHref} data-contact-tutor className={kinButtonClass("primary")}>Liên hệ gia sư</Link>}
            <Link href={backHref} className={kinButtonClass("secondary")}>Về Lớp của tôi</Link>
          </div>
        }
      >
        {SUSPENDED_CONTENT_MESSAGE}
      </KinEmptyState>
    </div>
  );
}
