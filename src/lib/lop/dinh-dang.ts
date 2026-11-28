// Định dạng ngày giờ cho giao diện lớp (thuần; chép phần cần dùng từ bca/components/dinh-dang.ts). Ngày là chuỗi "YYYY-MM-DD" giờ Việt Nam (./ngay.ts).
import { ddmm } from "./ngay";

const THU = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
const THU_NGAN = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const thuSo = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay();

/** "Thứ Năm 26/11" */
export const thuNgay = (d: string) => `${THU[thuSo(d)]} ${ddmm(d)}`;
/** "T5 26/11" */
export const thuNganNgay = (d: string) => `${THU_NGAN[thuSo(d)]} ${ddmm(d)}`;
/** "26/11/2026" */
export const ngayDayDu = (d: string) => `${ddmm(d)}/${d.slice(0, 4)}`;

/** Tên đầy đủ của môn cho câu chữ ("Tối nay học Tiếng Anh"). */
const TEN_DAY_DU: Record<string, string> = { toan: "Toán", su: "Lịch sử", dia: "Địa lí", anh: "Tiếng Anh" };
export const tenMonDayDu = (ma: string | undefined, tenNgan = "") => (ma && TEN_DAY_DU[ma]) || tenNgan;

/** "3 giờ 20 phút" / "12 phút" */
export function khoangThoiGian(ms: number) {
  const phut = Math.max(0, Math.ceil(ms / 60_000));
  const g = Math.floor(phut / 60), p = phut % 60;
  return g ? `${g} giờ${p ? ` ${p} phút` : ""}` : `${p} phút`;
}

/** SĐT "0912345678" → "0912 345 678" */
export const sdt = (s: string | null | undefined) => (s && /^\d{10}$/.test(s) ? `${s.slice(0, 4)} ${s.slice(4, 7)} ${s.slice(7)}` : s ?? "");
