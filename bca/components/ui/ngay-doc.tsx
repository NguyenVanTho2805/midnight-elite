// Dòng đọc lại ngày dưới mọi ô chọn ngày: "= Thứ Ba 29/11/2026" (ô date của máy hiện theo ngôn ngữ máy, dễ nhầm ngày/tháng).
// Nối với ô bằng aria-describedby={id}.
import { ngayDu } from "../dinh-dang";

export function NgayDoc({ ngay, id }: { ngay: string | null | undefined; id: string }) {
  const ok = !!ngay && /^\d{4}-\d{2}-\d{2}$/.test(ngay);
  return <p id={id} className="so mt-1 min-h-5 text-[13px] text-text-2" aria-live="polite">{ok ? `= ${ngayDu(ngay)}` : null}</p>;
}
