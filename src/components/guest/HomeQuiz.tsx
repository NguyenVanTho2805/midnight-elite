// Trang chủ — khối "Quiz từ gia sư" (cột phải của bảng tin). Hiện KHÔNG có cơ chế nào đăng quiz lên Cộng đồng hay công khai quiz của gia sư (BU-HS-TRANG-CHU mục 1.2),
// nên `items` luôn rỗng và khối nói đúng điều đó + một nút đặc dẫn sang đề thi thử có thật. Không hứa tính năng chưa có, không bịa quiz mẫu.
// Khi chủ duyệt cách đăng quiz (mục 9, câu 6), nơi gọi chỉ việc truyền `items` / `status`; ba trạng thái đã dựng sẵn. Chỉ hiện tiêu đề đề + tên gia sư + số câu + thời lượng:
// KHÔNG đáp án, KHÔNG điểm, KHÔNG thứ hạng, KHÔNG "người đã làm". Ẩn hẳn khi KIN_HOME_QUIZ=0 (page.tsx đọc ở máy chủ và không dựng khối này).
"use client";
import Link from "next/link";
import { kinButtonClass } from "@/components/kin/buttonClass";
import { KinSkeleton } from "@/components/kin/StateCard";

export interface HomeQuizItem { id: string; title: string; tutorName: string; questionCount: number; minutes: number; href: string }

export default function HomeQuiz({ status = "ok", items = [], onRetry }: { status?: "loading" | "ok" | "error"; items?: HomeQuizItem[]; onRetry?: () => void }) {
  const state = status === "ok" && items.length === 0 ? "empty" : status;
  return (
    <aside aria-labelledby="home-quiz" data-home-block="quiz" data-home-state={state} className="rounded-[var(--kin-bo-the)] border border-[var(--kin-vien-nhat)] bg-[var(--kin-nen-bang)] p-[var(--kin-kc-8)]">
      <h3 id="home-quiz" className="kin-chu-tieu-de font-semibold text-[length:var(--kin-co-h4)] leading-tight text-[var(--kin-chu-chinh)]">Quiz từ gia sư</h3>
      <p className="mt-1 text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">Làm thử vài câu để biết mình đang ở đâu.</p>

      {state === "loading" && <div role="status" aria-busy="true" aria-label="Đang tải quiz" className="mt-4"><KinSkeleton widths={[80, 55, 70]} /></div>}

      {state === "error" && (
        <div role="alert" className="mt-4 flex flex-col items-start gap-2">
          <p className="text-[length:var(--kin-co-goc)] font-semibold text-[var(--kin-tt-chu-loi)]">Không tải được quiz.</p>
          {onRetry && <button type="button" onClick={onRetry} className={kinButtonClass("secondary")}>Thử lại</button>}
        </div>
      )}

      {state === "empty" && (
        <div role="status" className="mt-4 flex flex-col items-start gap-3">
          <p className="text-[length:var(--kin-co-tieu-de)] font-medium text-[var(--kin-chu-chinh)]">Chưa có quiz nào được đăng.</p>
          <p className="text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-phu)]">Bạn vẫn có thể làm đề thi thử để biết mình đang ở đâu.</p>
          <Link href="/thi-thu" className={`${kinButtonClass("primary")} w-full sm:w-auto`}>Làm đề thi thử</Link>
        </div>
      )}

      {state === "ok" && (
        <ul className="mt-4 flex flex-col gap-3">
          {items.map(q => (
            <li key={q.id} data-home-quiz-item className="rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-nhat)] bg-[var(--kin-nen-trang)] p-[var(--kin-kc-6)]">
              <p className="text-[length:var(--kin-co-goc)] font-semibold text-[var(--kin-chu-chinh)] break-words">{q.title}</p>
              <p className="mt-1 text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">{q.tutorName} · {q.questionCount} câu · {q.minutes} phút</p>
              <Link href={q.href} className={`${kinButtonClass("secondary")} mt-3`}>Làm quiz</Link>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
