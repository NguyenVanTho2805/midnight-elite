// LOI-05 mục 4.1 — lưới thẻ gia sư: 1 cột (điện thoại) · 2 cột · 3 cột (1600), toàn bề ngang, không cột lọc trái.
// Số cột theo bề ngang THẬT của vùng chứa (container query), không theo cỡ màn hình: thẻ không bao giờ hẹp hơn ~320px,
// kể cả khi trang nằm trong vỏ có thanh bên (học sinh đã đăng nhập). 3 cột cần ≥ 992px = 3 × 320 + 2 khe 16.
import type { TutorListItem } from "@/components/tutor/tim-gia-su/kieu";
import { TheGiaSu, TheGiaSuCho } from "./TheGiaSu";

const LUOI = "grid grid-cols-1 gap-4 @min-[672px]:grid-cols-2 @min-[992px]:grid-cols-3";

export function LuoiGiaSu({ items }: { items: TutorListItem[] }) {
  return (
    <div className="@container">
      <ul data-luoi-gia-su className={`m-0 list-none p-0 ${LUOI}`}>
        {items.map(t => <li key={t.id} className="min-w-0"><TheGiaSu t={t} /></li>)}
      </ul>
    </div>
  );
}

/** 6 khung chờ cùng dáng thẻ. */
export function LuoiCho() {
  return (
    <div className="@container">
      <div data-luoi-cho aria-busy="true" aria-label="Đang tải danh sách gia sư" className={LUOI}>
        {Array.from({ length: 6 }, (_, i) => <TheGiaSuCho key={i} />)}
      </div>
    </div>
  );
}
