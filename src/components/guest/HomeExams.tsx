// Khối "Thi thử miễn phí" trang chủ (BU-HS-LANDING 3.4). Chỉ đề chung, miễn phí, đang mở công khai (bộ tải đã lọc). Không số thí sinh, không điểm, không hạng, không đáp án.
// `state` tính lúc dựng trang (trễ tối đa 1 giờ): đề "open" là liên kết /student/thi-thu/<id> (khách tự được chuyển sang đăng nhập); đề "upcoming" KHÔNG phải liên kết, chỉ ghi giờ mở.
// Điện thoại: một cột, hiện 4 đề đầu (đề 5-6 chỉ từ sm). Máy chủ, không hook, không prisma. Không có đề → không vẽ gì.
import Link from "next/link";
import type { LandingExam } from "@/lib/homeLanding";
import { BLOCK_INNER, BlockHead, BlockMore } from "./HomeBlockParts";

/** "Mở lúc HH:mm ngày dd/mm" từ ngày dd/mm/yyyy và giờ HH:mm đã chuẩn hoá; thiếu phần nào thì bỏ phần đó. */
function openAtText(e: LandingExam): string {
  const dm = e.date.split("/").slice(0, 2).join("/");
  return ["Mở lúc", e.time, dm ? `ngày ${dm}` : ""].filter(Boolean).join(" ");
}

function HomeExamCard({ e, hideOnPhone }: { e: LandingExam; hideOnPhone: boolean }) {
  const prefix = e.code.split(".")[0];
  const meta = [e.date, e.time, e.duration, e.questionCount > 0 ? `${e.questionCount} câu` : ""].filter(Boolean).join(" · ");
  const open = e.state === "open";
  return (
    <article data-home-exam={e.id} data-exam-state={e.state}
      className={`relative min-w-0 flex-col gap-2 rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-nhat)] bg-[var(--kin-nen-trang)] p-4 transition-colors sm:basis-[calc(50%-6px)] lg:basis-[calc((100%-24px)/3)] ${open ? "hover:border-[var(--kin-vien-o-nhap)]" : ""} ${hideOnPhone ? "hidden sm:flex" : "flex"}`}>
      <div className="flex items-center justify-between gap-2">
        {prefix ? <span className="min-w-0 truncate text-[length:var(--kin-co-caption)] font-semibold uppercase tracking-[0.04em] text-[var(--kin-nhan-link)]">{prefix}</span> : <span />}
        <span className="flex-shrink-0 rounded-[var(--kin-bo-tron)] bg-[var(--kin-nen-nhan)] px-2 py-0.5 text-[length:var(--kin-co-caption)] font-semibold text-[var(--kin-tt-chu-xong)]">Miễn phí</span>
      </div>
      <h3 className="text-[length:var(--kin-co-body)] font-semibold leading-snug text-[var(--kin-chu-chinh)]">
        {open
          ? <Link href={`/student/thi-thu/${e.id}`} className="block min-h-11 line-clamp-2 after:absolute after:inset-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)]">{e.title}</Link>
          : <span className="block line-clamp-2">{e.title}</span>}
      </h3>
      {meta && <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">{meta}</p>}
      <p className={`mt-auto pt-1 text-[length:var(--kin-co-small)] font-semibold ${open ? "text-[var(--kin-nhan-link)]" : "text-[var(--kin-chu-phu)]"}`}>
        {open ? "Vào thi ngay →" : openAtText(e)}
      </p>
    </article>
  );
}

export default function HomeExams({ exams }: { exams: LandingExam[] }) {
  if (exams.length === 0) return null;
  return (
    <section aria-labelledby="home-thi-thu" data-home-block="exams">
      <div className={BLOCK_INNER}>
        <BlockHead id="home-thi-thu" label="Thi thử miễn phí" title="Đề thi thử đang mở" desc="Làm đề có giờ như thi thật. Cần đăng nhập để làm bài và lưu kết quả." />
        <div role="list" className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
          {exams.map((e, i) => (
            <div role="listitem" key={e.id} className="contents"><HomeExamCard e={e} hideOnPhone={i >= 4} /></div>
          ))}
        </div>
        <BlockMore href="/thi-thu">Xem tất cả đề thi thử →</BlockMore>
      </div>
    </section>
  );
}
