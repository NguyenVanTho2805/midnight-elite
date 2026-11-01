// CAT-01 — quy tắc THUẦN cho trang danh mục khoá học công khai /khoa-hoc. Dùng chung máy chủ, trình duyệt và test:
// KHÔNG import prisma / server-only ở đây. Tiền chỉ để HIỂN THỊ (không tính lại học phí).
import { foldVi } from "@/lib/courseCatalogAdmin";

/** Thẻ khoá gửi ra trình duyệt. KHÔNG có capacity / số đang học / link nhóm: chỉ có trạng thái chỗ đã tính sẵn. */
export interface PublicCard {
  slug: string;
  title: string;
  category: string;
  teacher: string;
  teacherAvatar: string;
  lessons: number;
  hours: number;
  price: number;
  originalPrice: number | null;
  tag: string | null;
  tagColor: string | null;
  seat: SeatInfo;
}

export type SeatState = "unlimited" | "open" | "low" | "full" | "closed" | "paused";
export interface SeatInfo { state: SeatState; left: number | null }

/** Còn ≤ ngưỡng này thì báo "Chỉ còn N chỗ". */
export const LOW_SEAT_THRESHOLD = 5;

/** Chỗ của một lớp: `enrolled` = số Enrollment status="active". Thứ tự kiểm theo bảng ở dac-ta/CAT-01.md mục 2. */
export function seatState(capacity: number | null | undefined, enrolled: number, classStatus: string | null | undefined): SeatInfo {
  if (classStatus === "closed") return { state: "closed", left: null };
  if (classStatus === "paused") return { state: "paused", left: null };
  if (capacity == null) return { state: "unlimited", left: null };
  const left = Math.max(0, capacity - Math.max(0, enrolled));
  if (left === 0) return { state: "full", left: 0 };
  return { state: left <= LOW_SEAT_THRESHOLD ? "low" : "open", left };
}

export const SEAT_TEXT: Record<SeatState, string> = {
  unlimited: "Đang nhận học viên", open: "Còn chỗ", low: "Còn chỗ", full: "Đã đầy", closed: "Đã đóng nhận học viên", paused: "Tạm ngừng",
};
export function seatLabel(s: SeatInfo): string {
  if (s.state === "open") return `Còn ${s.left} chỗ`;
  if (s.state === "low") return `Chỉ còn ${s.left} chỗ`;
  return SEAT_TEXT[s.state];
}
export function seatTone(s: SeatInfo): "xong" | "cho" | "loi" | "mo" {
  return s.state === "unlimited" || s.state === "open" ? "xong" : s.state === "low" ? "cho" : s.state === "full" ? "loi" : "mo";
}
/** Lớp còn nhận người: không đầy, không đóng, không tạm ngừng. */
export function hasSeat(s: SeatInfo): boolean {
  return s.state === "unlimited" || s.state === "open" || s.state === "low";
}

export interface PriceView { free: boolean; price: number; original: number | null; discountPct: number }
/** Chỉ trình bày giá sẵn có: 0 → Miễn phí; giảm giá = làm tròn % chênh giữa giá gốc và giá bán. */
export function priceView(price: number, originalPrice: number | null | undefined): PriceView {
  const original = originalPrice != null && originalPrice > price ? originalPrice : null;
  const discountPct = original ? Math.round((1 - price / original) * 100) : 0;
  return { free: price <= 0, price, original, discountPct };
}

// ── URL ─────────────────────────────────────────────────────────────────────────────────────
export type FeeFilter = "" | "free" | "paid";
export type SortKey = "moi" | "gia-tang" | "gia-giam";
export interface CatalogFilters { category: string; q: string; fee: FeeFilter; seat: boolean; sort: SortKey }
export const DEFAULT_FILTERS: CatalogFilters = { category: "", q: "", fee: "", seat: false, sort: "moi" };

type Raw = string | string[] | undefined | null;
const first = (v: Raw): string => (Array.isArray(v) ? v[0] ?? "" : v ?? "").trim();

/** Đọc từ searchParams (máy chủ: object; trình duyệt: Object.fromEntries). `category` thắng `kythi` (bí danh CAT-02); "Tất cả" = không lọc. */
export function parseCatalogParams(sp: Record<string, Raw>): CatalogFilters {
  const cat = first(sp.category) || first(sp.kythi);
  const gia = first(sp.gia), sx = first(sp.sx);
  return {
    category: cat === "Tất cả" ? "" : cat.slice(0, 80),
    q: first(sp.q).slice(0, 80),
    fee: gia === "free" || gia === "paid" ? gia : "",
    seat: first(sp.concho) === "1",
    sort: sx === "gia-tang" || sx === "gia-giam" ? sx : "moi",
  };
}

/** Chuỗi truy vấn (không có "?"); bỏ giá trị mặc định. Luôn ghi `category` (không ghi `kythi`). */
export function buildCatalogQuery(f: CatalogFilters): string {
  const p = new URLSearchParams();
  if (f.category) p.set("category", f.category);
  if (f.q) p.set("q", f.q);
  if (f.fee) p.set("gia", f.fee);
  if (f.seat) p.set("concho", "1");
  if (f.sort !== "moi") p.set("sx", f.sort);
  return p.toString();
}
export function isFiltered(f: CatalogFilters): boolean {
  return !!(f.category || f.q || f.fee || f.seat);
}

// ── Lọc / sắp xếp ───────────────────────────────────────────────────────────────────────────
export function filterCatalog(cards: PublicCard[], f: CatalogFilters): PublicCard[] {
  const q = foldVi(f.q);
  return cards.filter(c => {
    if (f.category && c.category !== f.category) return false;
    if (f.fee === "free" && c.price > 0) return false;
    if (f.fee === "paid" && c.price <= 0) return false;
    if (f.seat && !hasSeat(c.seat)) return false;
    if (q && !foldVi(`${c.title} ${c.teacher} ${c.category}`).includes(q)) return false;
    return true;
  });
}
/** `moi` giữ nguyên thứ tự đầu vào (= Course.sortOrder). Sắp ổn định, không đổi mảng gốc. */
export function sortCatalog(cards: PublicCard[], sort: SortKey): PublicCard[] {
  if (sort === "moi") return [...cards];
  const dir = sort === "gia-tang" ? 1 : -1;
  return cards.map((c, i) => ({ c, i })).sort((a, b) => dir * (a.c.price - b.c.price) || a.i - b.i).map(x => x.c);
}

// ── Danh mục ────────────────────────────────────────────────────────────────────────────────
/** Cùng luật với GET /api/categories: dòng course_categories theo sortOrder (rồi tên), tên chưa có dòng xếp cuối theo chữ cái. */
export function orderCategoryNames(rows: { name: string; sortOrder: number }[], usedNames: string[]): string[] {
  const sorted = [...rows].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "vi")).map(r => r.name);
  const listed = new Set(sorted);
  return [...sorted, ...[...new Set(usedNames)].filter(n => !listed.has(n)).sort((a, b) => a.localeCompare(b, "vi"))];
}

export interface Chip { name: string; count: number }
/** Chip danh mục theo `ordered`: chỉ danh mục có ≥1 khoá công khai, cộng danh mục đang chọn (dù rỗng/lạ) để gỡ được. */
export function catalogChips(ordered: string[], cards: PublicCard[], selected: string): Chip[] {
  const count = new Map<string, number>();
  for (const c of cards) count.set(c.category, (count.get(c.category) ?? 0) + 1);
  const names = ordered.filter(n => (count.get(n) ?? 0) > 0);
  const extra = [...count.keys()].filter(n => !names.includes(n)).sort((a, b) => a.localeCompare(b, "vi"));
  const all = [...names, ...extra];
  if (selected && !all.includes(selected)) all.push(selected);
  return all.map(name => ({ name, count: count.get(name) ?? 0 }));
}

/** Dòng DB tối thiểu → thẻ công khai. Chỉ chép trường cần; không bao giờ truyền cả dòng Course. */
export function toPublicCard(c: {
  id: string; name: string; category: string; instructor: string; teacherAvatar: string; lessons: number; hours: number;
  price: number; originalPrice: number | null; tag: string | null; tagColor: string | null; capacity: number | null; classStatus: string;
}, enrolled: number): PublicCard {
  return {
    slug: c.id, title: c.name, category: c.category, teacher: c.instructor, teacherAvatar: c.teacherAvatar,
    lessons: c.lessons, hours: c.hours, price: c.price, originalPrice: c.originalPrice, tag: c.tag, tagColor: c.tagColor,
    seat: seatState(c.capacity, enrolled, c.classStatus),
  };
}
