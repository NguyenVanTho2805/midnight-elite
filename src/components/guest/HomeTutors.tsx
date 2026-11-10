// Khối "Gia sư" trang chủ (BU-HS-LANDING 3.2): lưới thẻ gia sư THẬT (đã duyệt, không khoá, không ẩn hồ sơ) + chữ và nút "Tìm gia sư" (HOME-01).
// Dùng lại nguyên GiaSuCard (cả thẻ là một liên kết /mentor/<id>). Dưới `tutorsMin` người → không vẽ lưới, chỉ còn phần chữ + nút (giống trước đây). Máy chủ, không hook, không prisma.
import type { HomeContent } from "@/lib/siteContent";
import { HOME_LANDING_LIMITS } from "@/lib/homeLanding";
import type { TutorListItem } from "@/lib/tutorSearch";
import { GiaSuCard } from "@/components/tutor/tim-gia-su/GiaSuCard";
import { BLOCK_INNER, FindTutorFoot, FindTutorHead } from "./HomeBlockParts";

export default function HomeTutors({ tutors, findTutor }: { tutors: TutorListItem[]; findTutor: HomeContent["findTutor"] }) {
  const showGrid = tutors.length >= HOME_LANDING_LIMITS.tutorsMin;
  return (
    <section aria-labelledby="h-tim-gia-su" data-home-block="tutors" data-home-state={showGrid ? "ok" : "text-only"}>
      <div className={BLOCK_INNER}>
        <FindTutorHead f={findTutor} />
        {showGrid && (
          // flex + canh giữa: 2–3 gia sư vẫn nằm giữa hàng, không dồn trái trong lưới 4 cột.
          <ul className="my-8 flex list-none flex-wrap justify-center gap-3 p-0">
            {tutors.map(t => (
              <li key={t.id} className="flex min-w-0 basis-[calc(50%-6px)] lg:basis-[calc((100%-36px)/4)] [&>article]:w-full">
                <GiaSuCard t={t} />
              </li>
            ))}
          </ul>
        )}
        <div className={showGrid ? "" : "mt-3"}><FindTutorFoot f={findTutor} /></div>
      </div>
    </section>
  );
}
