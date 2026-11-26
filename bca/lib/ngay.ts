// Ngày giờ theo Asia/Ho_Chi_Minh. Việt Nam cố định UTC+7, không đổi giờ theo mùa,
// nên cộng 7 giờ là đúng và không phụ thuộc múi giờ của máy chủ (Vercel/Neon chạy UTC).
// Ngày trong mã luôn là chuỗi "YYYY-MM-DD".
const LECH = 7 * 3600_000;
const NGAY_MS = 86400_000;

export const ngayVN = (luc: Date) => new Date(luc.getTime() + LECH).toISOString().slice(0, 10);
/** Số phút từ 00:00 giờ Việt Nam. */
export const phutVN = (luc: Date) => {
  const t = new Date(luc.getTime() + LECH);
  return t.getUTCHours() * 60 + t.getUTCMinutes();
};
export const gioVN = (luc: Date) => new Date(luc.getTime() + LECH).toISOString().slice(11, 16);

export const s2d = (d: string) => new Date(`${d}T00:00:00Z`); // cho cột @db.Date
export const d2s = (d: Date) => d.toISOString().slice(0, 10);
export const d2sOrNull = (d: Date | null) => (d ? d2s(d) : null);

export const congNgay = (d: string, n: number) => d2s(new Date(s2d(d).getTime() + n * NGAY_MS));
export const soNgayGiua = (tu: string, den: string) => Math.round((s2d(den).getTime() - s2d(tu).getTime()) / NGAY_MS);
/** ISO: 1 = Thứ Hai … 7 = Chủ nhật. */
export const thuISO = (d: string) => s2d(d).getUTCDay() || 7;

/** Thời điểm (timestamptz) của "ngày d lúc HH:MM giờ Việt Nam". */
export const lucVN = (d: string, hhmm: string) => new Date(Date.parse(`${d}T${hhmm}:00+07:00`));

export function ngayTrongThang(thang: string): string[] {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(thang)) throw new Error(`Tháng không hợp lệ: ${thang}`);
  const ra: string[] = [];
  for (let d = `${thang}-01`; d.startsWith(thang); d = congNgay(d, 1)) ra.push(d);
  return ra;
}
export const thangCua = (d: string) => d.slice(0, 7);
export const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
