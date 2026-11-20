// LOI-05 (mục 3.3 docs/kin/phong-ban/dac-ta/LOI-05.md) — bộ lọc TỐI GIẢN của /giang-vien <-> chuỗi truy vấn. THUẦN: không React, không mạng.
// Test: tools/local-e2e/t-tutor-card-lib.ts.
//
// Chỉ 4 mục: ô tìm (tên/môn), Môn, Khu vực (tỉnh/thành), Hình thức. Tham số cũ trên URL (grade, district, priceMin, priceMax, active, sort, page…)
// bị BỎ QUA khi đọc — link cũ mở ra danh sách đầy đủ hơn, không lỗi. Máy chủ (`parseTutorQuery`) vẫn kẹp/làm sạch lại lần nữa.

export interface SanLoc { q: string; subject: string; city: string; mode: "" | "online" | "offline" }

export const SAN_LOC_RONG: SanLoc = Object.freeze({ q: "", subject: "", city: "", mode: "" }) as SanLoc;

export const SAN_Q_MAX = 60;
export const SAN_SUBJECT_MAX = 50;
export const SAN_CITY_MAX = 60;
export const SAN_PAGE_SIZE = 24;
const PAGE_SIZE_MAX = 48;

/** Cắt ≤ `max` đơn vị mã (như locUrl) nhưng không để lại nửa cặp thay thế (emoji bị chặt đôi). */
function clip(raw: string | null, max: number): string {
  let s = (raw ?? "").slice(0, max);
  const last = s.charCodeAt(s.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) s = s.slice(0, -1);
  return s;
}
const modeOf = (raw: unknown): SanLoc["mode"] => (raw === "online" || raw === "offline" ? raw : "");

/** URL → bộ lọc. Kẹp độ dài (q 60, subject 50, city 60); mode lạ → ""; mọi tham số khác bị bỏ. */
export function docSanLoc(sp: { get(name: string): string | null }): SanLoc {
  return {
    q: clip(sp.get("q"), SAN_Q_MAX),
    subject: clip(sp.get("subject"), SAN_SUBJECT_MAX),
    city: clip(sp.get("city"), SAN_CITY_MAX),
    mode: modeOf(sp.get("mode")),
  };
}

function params(f: SanLoc): URLSearchParams {
  const qs = new URLSearchParams();
  const put = (k: string, v: string) => { if (v) qs.set(k, v); };
  put("q", (f.q ?? "").trim());
  put("subject", (f.subject ?? "").trim());
  put("city", (f.city ?? "").trim());
  put("mode", modeOf(f.mode));
  return qs;
}

/** Chuỗi truy vấn của TRANG (không có "?"), bỏ giá trị rỗng. Bộ lọc rỗng → "". */
export function ghiSanLoc(f: SanLoc): string {
  return params(f).toString();
}

/** Chuỗi truy vấn cho GET /api/tutors (không có "?"). `page` chỉ ghi khi > 1; `pageSize` kẹp 1..48 (sai → 24). */
export function apiQuery(f: SanLoc, page: number, pageSize = SAN_PAGE_SIZE): string {
  const qs = params(f);
  if (Number.isInteger(page) && page > 1) qs.set("page", String(page));
  const size = Number.isInteger(pageSize) && pageSize >= 1 ? Math.min(pageSize, PAGE_SIZE_MAX) : SAN_PAGE_SIZE;
  qs.set("pageSize", String(size));
  return qs.toString();
}

/** Số lọc đang bật cho nút "Lọc (n)" — KHÔNG tính ô tìm. */
export function demSanLoc(f: SanLoc): number {
  return [(f.subject ?? "").trim(), (f.city ?? "").trim(), modeOf(f.mode)].filter(Boolean).length;
}

/** Tên các lọc đang bật cho câu trạng thái rỗng: ['từ khóa "x"', "môn Toán", "Hà Nội", "dạy online" | "dạy trực tiếp"]. */
export function moTaSanLoc(f: SanLoc): string[] {
  const out: string[] = [];
  const q = (f.q ?? "").trim(), subject = (f.subject ?? "").trim(), city = (f.city ?? "").trim(), mode = modeOf(f.mode);
  if (q) out.push(`từ khóa "${q}"`);
  if (subject) out.push(`môn ${subject}`);
  if (city) out.push(city);
  if (mode) out.push(mode === "online" ? "dạy online" : "dạy trực tiếp");
  return out;
}
