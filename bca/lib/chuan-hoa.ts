// ghi-danh.md Điều 1.3
export function chuanHoaSdt(v: unknown): string | null {
  let s = String(v ?? "").replace(/\D/g, "");
  if (!s) return null;
  if (s.startsWith("84") && s.length === 11) s = "0" + s.slice(2);
  if (s.length === 9 && !s.startsWith("0")) s = "0" + s;
  return s;
}
export const sdtHopLe = (s: string | null) => !!s && /^0[35789]\d{8}$/.test(s);

export function chuanHoaGmail(v: unknown): string | null {
  const s = String(v ?? "").replace(/\s+/g, "").toLowerCase();
  return s || null;
}
const DUOI_NHAM = ["gamil.com", "gmai.com", "gmail.con", "gmial.com", "gmail.co", "gmail.cm", "gmal.com", "gnail.com", "gmail.vn"];
/** Trả gợi ý địa chỉ đúng nếu nghi gõ nhầm đuôi; không tự sửa. */
export function goiYGmail(g: string | null): string | null {
  const m = g?.match(/^(.+)@(.+)$/);
  return m && DUOI_NHAM.includes(m[2]) ? `${m[1]}@gmail.com` : null;
}
export const gmailHopLe = (g: string | null) => !!g && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(g) && !goiYGmail(g);

export const catKhoangTrang = (v: unknown) => {
  const s = String(v ?? "").replace(/\s+/g, " ").trim().replace(/^'/, "");
  return s || null;
};

/** Bỏ dấu, chữ thường — để tìm và so tên. */
export const boDau = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

/** ghi-danh.md 1.4: tên giống = bỏ dấu + chữ thường trùng hẳn, hoặc cùng tên gọi (từ cuối) và chung ít nhất 2 từ. */
export function tenGiong(a: string, b: string) {
  const ta = boDau(a).trim().split(/\s+/), tb = boDau(b).trim().split(/\s+/);
  return ta.join(" ") === tb.join(" ") || (ta.at(-1) === tb.at(-1) && new Set(ta.filter((w) => tb.includes(w))).size >= 2);
}

const XEP = new Intl.Collator("vi");
/** Sắp tên kiểu Việt: tên (từ cuối) rồi họ đệm. */
export const soTenViet = (a: string, b: string) => {
  const ta = a.trim().split(/\s+/), tb = b.trim().split(/\s+/);
  return XEP.compare(ta.at(-1)!, tb.at(-1)!) || XEP.compare(a, b);
};
