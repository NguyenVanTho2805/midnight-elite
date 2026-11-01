"use client";
// BU-05 — cột phải: Gia sư nổi bật (xếp theo số trả lời THẬT 30 ngày qua) + Câu hỏi chưa trả lời. Không đủ dữ liệu → ẩn khối, không bịa.
// Dữ liệu chỉ là bài chung (máy chủ lọc); khối "chưa trả lời" ở vùng hẹp thành một hàng cuộn ngang dưới ô soạn (UnansweredStrip).
import Link from "next/link";
import type { SidebarData } from "@/lib/communityTypes";
import { timeAgo } from "./format";

export function RightRail({ data }: { data: SidebarData | null }) {
  if (!data || (data.tutors.length === 0 && data.unanswered.length === 0)) return null;
  return (
    <div className="flex flex-col gap-6" data-kc-rail-content>
      {data.tutors.length > 0 && (
        <section aria-labelledby="kc-tutors">
          <h2 id="kc-tutors" className="mb-2 text-[length:var(--kin-co-body)] font-semibold text-[var(--kin-chu-chinh)]">Gia sư nổi bật</h2>
          <ul className="flex flex-col">
            {data.tutors.map(t => (
              <li key={t.id} className="border-b border-[var(--kin-vien-thuong)] last:border-b-0">
                <Link href={t.href} className="kc-focus flex flex-col justify-center min-h-11 py-2 hover:bg-[var(--kin-nen-re-chuot)]">
                  <span className="kc-name">{t.label}</span>
                  <span className="kc-meta">{t.subjects.slice(0, 3).join(" · ")}{t.subjects.length ? " · " : ""}{t.answers30d} trả lời trong 30 ngày</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {data.unanswered.length > 0 && (
        <section aria-labelledby="kc-unanswered">
          <h2 id="kc-unanswered" className="mb-2 text-[length:var(--kin-co-body)] font-semibold text-[var(--kin-chu-chinh)]">Câu hỏi chưa trả lời</h2>
          <ul className="flex flex-col">
            {data.unanswered.map(q => (
              <li key={q.key} className="border-b border-[var(--kin-vien-thuong)] last:border-b-0">
                <Link href={q.href} className="kc-focus flex flex-col justify-center min-h-11 py-2 hover:bg-[var(--kin-nen-re-chuot)]">
                  <span className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)] line-clamp-2">{q.title}</span>
                  <span className="kc-meta">{timeAgo(q.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** Hàng cuộn ngang dưới ô soạn ở vùng hẹp; ẩn nếu rỗng (CSS ẩn tiếp khi đã đủ rộng để có cột phải). */
export function UnansweredStrip({ data }: { data: SidebarData | null }) {
  if (!data || data.unanswered.length === 0) return null;
  return (
    <nav className="kc-strip" aria-label="Câu hỏi chưa trả lời" data-kc-strip>
      {data.unanswered.map(q => <Link key={q.key} href={q.href} className="kc-focus"><span className="line-clamp-2">{q.title}</span></Link>)}
    </nav>
  );
}
