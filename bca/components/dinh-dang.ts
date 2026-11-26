// Định dạng ngày giờ, số cho giao diện (thuần, dùng được cả máy chủ lẫn trình duyệt).
// Ngày trong mã là chuỗi "YYYY-MM-DD" theo giờ Việt Nam (lib/ngay.ts).
import { ddmm, gioVN, lucVN } from "@/lib/ngay";

const THU = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
const THU_NGAN = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const thuSo = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay();

export { ddmm };
export const thuDay = (d: string) => THU[thuSo(d)];
export const thuNgan = (d: string) => THU_NGAN[thuSo(d)];
/** "Thứ Năm 26/11" */
export const thuNgay = (d: string) => `${thuDay(d)} ${ddmm(d)}`;
/** "Thứ Ba 29/11/2026" — dòng đọc lại dưới ô chọn ngày. */
export const ngayDu = (d: string) => `${thuDay(d)} ${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
/** "T5 26/11" */
export const thuNganNgay = (d: string) => `${thuNgan(d)} ${ddmm(d)}`;
/** Giờ:phút theo giờ Việt Nam của một thời điểm. */
export const gio = (luc: Date | string | number) => gioVN(new Date(luc));
export { lucVN };

/** Tên đầy đủ của môn cho câu chữ ("Tối nay học Tiếng Anh"). */
const TEN_DAY_DU: Record<string, string> = { toan: "Toán", su: "Lịch sử", dia: "Địa lí", anh: "Tiếng Anh" };
export const tenMonDayDu = (ma: string | undefined, tenNgan = "") => (ma && TEN_DAY_DU[ma]) || tenNgan;

/** "GV Thanh, GV Hoa" — không lặp chữ "GV" khi tên hiển thị đã bắt đầu bằng "GV". */
export const tenGv = (ds: string[]) => ds.map((t) => (/^GV\s/i.test(t) ? t : `GV ${t}`)).join(", ");

const SO = new Intl.NumberFormat("vi-VN");
export const so = (n: number) => SO.format(n);
export const tien = (n: number) => `${SO.format(n)}đ`;

/** "3 giờ 20 phút" / "12 phút" */
export function khoangThoiGian(ms: number) {
  const phut = Math.max(0, Math.ceil(ms / 60_000));
  const g = Math.floor(phut / 60), p = phut % 60;
  return g ? `${g} giờ${p ? ` ${p} phút` : ""}` : `${p} phút`;
}

/** SĐT "0912345678" → "0912 345 678" */
export const sdt = (s: string | null | undefined) => (s && /^\d{10}$/.test(s) ? `${s.slice(0, 4)} ${s.slice(4, 7)} ${s.slice(7)}` : s ?? "");
