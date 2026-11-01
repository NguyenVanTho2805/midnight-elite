// BU-06 — lưới thẻ: 4 cột từ lg (1600 và 1280), 2 cột ở điện thoại. Chỉ trình bày; trạng thái nằm ở TimGiaSu.
import { GiaSuCard, GiaSuCardSkeleton } from "./GiaSuCard";
import type { TutorListItem } from "./kieu";

const GRID = "grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4";

export function LuoiGiaSu({ items }: { items: TutorListItem[] }) {
  return (
    <div data-tutor-grid className={GRID}>
      {items.map(t => <GiaSuCard key={t.id} t={t} />)}
    </div>
  );
}

export function LuoiCho() {
  return (
    <div data-tutor-grid-loading aria-busy="true" aria-label="Đang tải danh sách gia sư" className={GRID}>
      {Array.from({ length: 8 }, (_, i) => <GiaSuCardSkeleton key={i} />)}
    </div>
  );
}
