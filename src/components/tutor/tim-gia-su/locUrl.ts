// BU-06 — bộ lọc "Tìm gia sư" <-> chuỗi truy vấn. Trạng thái nằm trên URL (chia sẻ được, F5/Back giữ nguyên).
// Thuần: không React, không mạng. Số lọc sai kiểu được bỏ qua ở đây; máy chủ vẫn kẹp lại lần nữa.

export const SORT_OPTIONS = [
  { value: "relevant", label: "Phù hợp" },
  { value: "newest", label: "Mới" },
  { value: "sessions", label: "Nhiều buổi" },
  { value: "price_asc", label: "Giá tăng" },
  { value: "price_desc", label: "Giá giảm" },
] as const;
export type SortValue = (typeof SORT_OPTIONS)[number]["value"];

export interface BoLocState {
  q: string;
  subject: string;
  grade: string;
  city: string;
  district: string;
  mode: "" | "online" | "offline";
  priceMin: string;
  priceMax: string;
  active: boolean;
  sort: SortValue;
}

export const BO_LOC_RONG: BoLocState = { q: "", subject: "", grade: "", city: "", district: "", mode: "", priceMin: "", priceMax: "", active: false, sort: "relevant" };

const digits = (s: string | null) => (s ?? "").replace(/\D+/g, "").slice(0, 8);

export function docBoLoc(sp: URLSearchParams): BoLocState {
  const mode = sp.get("mode");
  const sort = sp.get("sort");
  return {
    q: (sp.get("q") ?? "").slice(0, 60),
    subject: (sp.get("subject") ?? "").slice(0, 50),
    grade: (sp.get("grade") ?? "").slice(0, 12),
    city: (sp.get("city") ?? "").slice(0, 60),
    district: (sp.get("district") ?? "").slice(0, 60),
    mode: mode === "online" || mode === "offline" ? mode : "",
    priceMin: digits(sp.get("priceMin")),
    priceMax: digits(sp.get("priceMax")),
    active: sp.get("active") === "1",
    sort: SORT_OPTIONS.some(o => o.value === sort) ? (sort as SortValue) : "relevant",
  };
}

/** Chuỗi truy vấn (không có dấu ?). `forApi`: thêm page/pageSize và ánh xạ sort; URL trang thì bỏ giá trị mặc định. */
export function ghiBoLoc(f: BoLocState, extra?: { page?: number; pageSize?: number }): string {
  const qs = new URLSearchParams();
  const put = (k: string, v: string) => { if (v) qs.set(k, v); };
  put("q", f.q.trim()); put("subject", f.subject); put("grade", f.grade); put("city", f.city);
  put("district", f.city ? f.district : "");
  put("mode", f.mode); put("priceMin", f.priceMin); put("priceMax", f.priceMax);
  if (f.active) qs.set("active", "1");
  if (f.sort !== "relevant") qs.set("sort", f.sort);
  if (extra?.page && extra.page > 1) qs.set("page", String(extra.page));
  if (extra?.pageSize) qs.set("pageSize", String(extra.pageSize));
  return qs.toString();
}

/** Số bộ lọc đang bật trên nút "Bộ lọc (n)": không tính ô tìm và kiểu sắp. Khoảng giá tính là một. */
export function demLoc(f: BoLocState): number {
  return [f.subject, f.grade, f.city, f.district, f.mode, f.priceMin || f.priceMax ? "gia" : "", f.active ? "1" : ""].filter(Boolean).length;
}

/** Tên các bộ lọc đang bật, để câu trạng thái rỗng nói rõ vì sao không có kết quả. */
export function moTaLoc(f: BoLocState): string[] {
  const out: string[] = [];
  if (f.q.trim()) out.push(`từ khóa "${f.q.trim()}"`);
  if (f.subject) out.push(`môn ${f.subject}`);
  if (f.grade) out.push(`lớp/cấp ${f.grade}`);
  if (f.city) out.push(f.district ? `${f.district}, ${f.city}` : f.city);
  if (f.mode) out.push(f.mode === "online" ? "dạy online" : "dạy trực tiếp");
  if (f.priceMin || f.priceMax) out.push("khoảng giá");
  if (f.active) out.push("đang hoạt động");
  return out;
}

export const soVND = (v: string) => (v ? Number(v).toLocaleString("vi-VN") : "");
