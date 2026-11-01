// BU-07 — kiểu dữ liệu + hàm trình bày dùng chung cho các thành phần Tin tức (thuần, không React, không DB).
// Dữ liệu đến từ src/lib/articlesPublic.ts (lọc bài đã công bố, đã qua shapeCover); ở đây KHÔNG tự lọc lại điều gì về an toàn.

/** Một bài ở dạng thẻ (không có content). Ngày có thể là Date (máy chủ) hoặc chuỗi ISO. */
export interface TinThe {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  author: string;
  tag: string | null;
  isPinned: boolean;
  readTime: number;
  publishedAt: Date | string | null;
  createdAt: Date | string;
  coverImage: string | null;
  coverCaption: string | null;
}

export const NHAN_MUC: Record<string, string> = {
  "tuyen-sinh": "Tuyển sinh",
  "hoc-thuat": "Học tập",
  "kinh-nghiem": "Kinh nghiệm thi",
  "tin-midnight": "KiN",
  "gia-su": "Gia sư",
};

/** Thứ tự bốn khối trang chủ tin tức. */
export const KHOI_MUC: ReadonlyArray<string> = ["tuyen-sinh", "hoc-thuat", "tin-midnight", "gia-su"];

/** Thanh chuyên mục: giá trị rỗng = Tất cả. */
export const THANH_MUC: ReadonlyArray<{ muc: string; nhan: string }> = [
  { muc: "", nhan: "Tất cả" },
  { muc: "tuyen-sinh", nhan: "Tuyển sinh" },
  { muc: "hoc-thuat", nhan: "Học tập" },
  { muc: "tin-midnight", nhan: "KiN" },
  { muc: "gia-su", nhan: "Gia sư" },
];

export const nhanMuc = (m: string): string => NHAN_MUC[m] ?? "Tin tức";
export const hrefMuc = (m: string): string => (m ? `/tin-tuc?muc=${encodeURIComponent(m)}` : "/tin-tuc");
export const hrefBai = (slug: string): string => `/tin-tuc/${encodeURIComponent(slug)}`;

/** Màu chip theo mục — chỉ token --kin-*. */
export function mauMuc(m: string): { nen: string; chu: string } {
  switch (m) {
    case "tuyen-sinh": return { nen: "var(--kin-tt-nen-loi)", chu: "var(--kin-tt-chu-loi)" };
    case "tin-midnight": return { nen: "var(--kin-tt-nen-xong)", chu: "var(--kin-tt-chu-xong)" };
    case "gia-su": return { nen: "var(--kin-tt-nen-cho)", chu: "var(--kin-tt-chu-cho)" };
    default: return { nen: "var(--kin-nhan-nen-nhat)", chu: "var(--kin-nhan-link)" };
  }
}

const ngayCua = (v: Date | string | null | undefined): Date | null => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Mốc thời gian hiển thị của bài: ngày đăng, rơi về ngày tạo. */
export const mocBai = (a: Pick<TinThe, "publishedAt" | "createdAt">): Date | null => ngayCua(a.publishedAt) ?? ngayCua(a.createdAt);

function phan(d: Date): Record<string, string> {
  const o: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d)) o[p.type] = p.value;
  if (o.hour === "24") o.hour = "00";
  return o;
}

/** "dd/MM/yyyy · HH:mm" (giờ Việt Nam). */
export function ngayGio(v: Date | string | null | undefined): string {
  const d = ngayCua(v); if (!d) return "";
  const p = phan(d);
  return `${p.day}/${p.month}/${p.year} · ${p.hour}:${p.minute}`;
}

/** "3 giờ", "2 ngày"; quá 7 ngày thì "dd/MM". */
export function gioTuongDoi(v: Date | string | null | undefined, now: Date = new Date()): string {
  const d = ngayCua(v); if (!d) return "";
  const s = Math.max(0, Math.floor((now.getTime() - d.getTime()) / 1000));
  if (s < 60) return "Vừa xong";
  if (s < 3600) return `${Math.floor(s / 60)} phút`;
  if (s < 86400) return `${Math.floor(s / 3600)} giờ`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} ngày`;
  const p = phan(d);
  return `${p.day}/${p.month}`;
}

/** Tên tác giả hiển thị: "Admin" hoặc trống → "KiN". */
export const tenTacGia = (a: string | null | undefined): string => {
  const t = (a ?? "").trim();
  return !t || t.toLowerCase() === "admin" ? "KiN" : t;
};
