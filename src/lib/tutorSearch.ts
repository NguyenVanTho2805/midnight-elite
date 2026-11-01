// BU-06 — Tìm gia sư kiểu sàn: kiểu dữ liệu + hàm THUẦN (không DB, không mạng) cho /api/tutors, /api/tutors/suggest và giao diện /giang-vien.
// Đặc tả: docs/kin/phong-ban/dac-ta/BU-06.md mục C.1/C.2. Test: tools/local-e2e/t-tutor-search-lib.ts.
//
// Nguyên tắc:
//  • Mọi tham số được KẸP/rơi về mặc định, không bao giờ ném lỗi (route công khai).
//  • Lọc theo khu vực/giá/hình thức chạy TRONG BỘ NHỚ trên `PublicArea` (preferences là JSON) — không đẩy xuống SQL, tránh bẫy `NOT (col = x)` loại NULL.
//  • Gia sư chưa khai (area = null / không giá) không bị loại khi KHÔNG lọc mục đó; có lọc thì không khớp (không đoán).
//  • Mọi kiểu sắp là thứ tự TOÀN PHẦN: kết thúc bằng tên rồi `id` để không trùng/mất mục khi qua trang.
import { cityFacets, cleanText, matchesArea, normalizeKey, PRICE_MAX, type ModeFilter, type PublicArea } from "@/lib/tutorArea";
import { DEFAULT_TUTOR_SORT, TUTOR_SORTS, type TutorSort } from "@/lib/tutorActivity";

// ─── Kiểu ────────────────────────────────────────────────────────────────────────────────────────────────────
/** Một thẻ gia sư trên /giang-vien. GIỮ NGUYÊN các trường cũ của /api/tutors; không thêm trường nào chứa dữ liệu mới. */
export type TutorListItem = {
  id: string;
  name: string;
  avatarBase64: string | null;
  bio: string | null;
  subjects: string[];
  tutorVerified: boolean;
  /** Chỉ tính lớp `status:true` (cùng số với hồ sơ chi tiết). */
  classCount: number;
  /** Số lượt ghi danh đang học của các lớp `status:true` (chỉ là số đếm, không có tên). */
  studentCount: number;
  /** ĐX-00: buổi ĐÃ DẠY theo sổ lớp. Gia sư tự ghi, không phải bằng chứng đã xác minh. */
  sessionsTaught: number;
  /** ĐX-05: có buổi đã dạy trong 30 ngày qua. */
  recentlyActive: boolean;
  /** ĐX-06: khu vực/hình thức/giá tham khảo, TỰ KHAI. null = chưa lưu mục này. */
  area: PublicArea | null;
  /** Giữ cho tương thích; giao diện mới không hiển thị (ĐX-05). */
  rating: { avg: number | null; total: number };
};
/** Bản dùng nội bộ ở máy chủ: thêm mốc duyệt để sắp "mới nhất". KHÔNG trả ra ngoài (xem `toListItem`). */
export type SearchableTutor = TutorListItem & { verifiedAtMs: number | null };

/** Tập khoá được phép có trong một phần tử `items` (test bắt trường lỡ thêm). */
export const TUTOR_LIST_ITEM_KEYS = [
  "id", "name", "avatarBase64", "bio", "subjects", "tutorVerified", "classCount", "studentCount", "sessionsTaught", "recentlyActive", "area", "rating",
] as const;

export function toListItem(t: SearchableTutor): TutorListItem {
  return {
    id: t.id, name: t.name, avatarBase64: t.avatarBase64, bio: t.bio, subjects: t.subjects, tutorVerified: t.tutorVerified,
    classCount: t.classCount, studentCount: t.studentCount, sessionsTaught: t.sessionsTaught, recentlyActive: t.recentlyActive,
    area: t.area, rating: t.rating,
  };
}

export type TutorSortKey = TutorSort | "relevant" | "newest" | "sessions" | "price_asc" | "price_desc";
export const NEW_SORTS = ["relevant", "newest", "sessions", "price_asc", "price_desc"] as const;
export const TUTOR_SORT_KEYS: readonly TutorSortKey[] = [...NEW_SORTS, ...TUTOR_SORTS];

export const Q_MAX_CHARS = 60;
export const Q_MAX_WORDS = 5;
export const SUBJECT_MAX = 50;
export const DISTRICT_FILTER_MAX = 60;
export const DEFAULT_PAGE_SIZE = 24;
export const MAX_PAGE_SIZE = 48;
export const MAX_PAGE = 200;
export const MAX_SUBJECT_FACETS = 40;

export interface TutorFilters {
  /** Chuỗi tìm đã làm sạch (≤60 ký tự, ≤5 từ). Rỗng = không tìm. */
  q: string;
  /** Các từ đã bỏ dấu/hoa thường, khớp AND. */
  terms: string[];
  subject: string | null;
  grade: string | null;
  city: string | null;
  district: string | null;
  mode: ModeFilter | null;
  priceMin: number | null;
  priceMax: number | null;
  active: boolean;
  sort: TutorSortKey;
  page: number;
  pageSize: number;
}

// ─── Cấp lớp suy từ chữ trong tên môn ────────────────────────────────────────────────────────────────────────
export const GRADE_GROUPS = [
  { value: "tieu-hoc", label: "Tiểu học" },
  { value: "thcs", label: "THCS" },
  { value: "thpt", label: "THPT" },
  { value: "dai-hoc", label: "Đại học" },
] as const;
export const GRADE_NUMBERS: readonly string[] = Array.from({ length: 12 }, (_, i) => String(i + 1));
export const GRADE_VALUES: readonly string[] = [...GRADE_NUMBERS, ...GRADE_GROUPS.map(g => g.value)];
export const gradeLabel = (value: string): string => GRADE_GROUPS.find(g => g.value === value)?.label ?? `Lớp ${value}`;
export const isGradeValue = (v: unknown): v is string => typeof v === "string" && GRADE_VALUES.includes(v);

const gradeGroupOfNumber = (n: number): string => (n <= 5 ? "tieu-hoc" : n <= 9 ? "thcs" : "thpt");
/** Bỏ dấu, hạ chữ, GIỮ dấu câu (cần để phân biệt "6.5" với "6"). */
const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d");
const GROUP_PATTERNS: [string, RegExp][] = [
  ["tieu-hoc", /(?<![a-z0-9])tieu hoc(?![a-z0-9])/],
  ["thcs", /(?<![a-z0-9])(?:thcs|trung hoc co so|cap 2)(?![a-z0-9])/],
  ["thpt", /(?<![a-z0-9])(?:thpt|trung hoc pho thong|cap 3)(?![a-z0-9])/],
  ["dai-hoc", /(?<![a-z0-9])dai hoc(?![a-z0-9])/],
];
/**
 * Các giá trị `grade` mà MỘT tên môn gợi ra: số 1–12 đứng riêng ("Toán 9", "Tiếng Anh lớp 5") → số đó + nhóm của nó; cụm "tiểu học/THCS/THPT/đại học" → nhóm.
 * Số ngoài 1–12 ("Toán 99"), số thập phân ("IELTS 6.5") và số dính chữ ("A1") KHÔNG tính. Không suy ra gì → mảng rỗng (không đoán).
 */
export function gradesOfSubject(subject: string): string[] {
  const s = fold(typeof subject === "string" ? subject : "");
  const out = new Set<string>();
  for (const m of s.matchAll(/(?<![a-z0-9.,])(\d{1,2})(?![a-z0-9]|[.,]\d)/g)) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 12) { out.add(String(n)); out.add(gradeGroupOfNumber(n)); }
  }
  for (const [value, re] of GROUP_PATTERNS) if (re.test(s)) out.add(value);
  return [...out].sort((a, b) => GRADE_VALUES.indexOf(a) - GRADE_VALUES.indexOf(b));
}
/** Mọi giá trị cấp của một gia sư (hợp các môn). */
export function gradesOfTutor(subjects: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const s of subjects) for (const g of gradesOfSubject(s)) out.add(g);
  return out;
}

// ─── Đọc tham số ─────────────────────────────────────────────────────────────────────────────────────────────
export function parseTutorSortKey(raw: string | null | undefined): TutorSortKey {
  return (TUTOR_SORT_KEYS as readonly string[]).includes(raw ?? "") ? (raw as TutorSortKey) : DEFAULT_TUTOR_SORT;
}
const INT_RE = /^[+-]?\d{1,15}$/;
/** Số nguyên thập phân thuần ("1e9", "NaN", "Infinity", "12abc", rỗng → null). */
function parseIntStrict(raw: string | null | undefined): number | null {
  const s = (raw ?? "").trim();
  return INT_RE.test(s) ? Number(s) : null;
}
const clampInt = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const cleanParam = (raw: string | null | undefined, max: number): string | null => {
  const v = cleanText(typeof raw === "string" ? raw : "").slice(0, max).trim();
  return v || null;
};

/**
 * Đọc & kẹp tham số của GET /api/tutors. Không bao giờ ném lỗi; giá trị sai → mặc định / bỏ qua.
 * `page`/`pageSize` ≤ 0 hoặc không phải số → mặc định; vượt trần → kẹp (200 / 48). `priceMin>priceMax` → đổi chỗ.
 */
export function parseTutorQuery(sp: { get(name: string): string | null }): TutorFilters {
  const words = cleanText(sp.get("q") ?? "").slice(0, Q_MAX_CHARS).split(" ").filter(Boolean).slice(0, Q_MAX_WORDS);
  const q = words.join(" ");
  const terms = normalizeKey(q).split(" ").filter(Boolean).slice(0, Q_MAX_WORDS);

  const gradeRaw = (sp.get("grade") ?? "").trim().toLowerCase();

  let priceMin = parseIntStrict(sp.get("priceMin"));
  let priceMax = parseIntStrict(sp.get("priceMax"));
  if (priceMin !== null) priceMin = clampInt(priceMin, 0, PRICE_MAX);
  if (priceMax !== null) priceMax = clampInt(priceMax, 0, PRICE_MAX);
  if (priceMin !== null && priceMax !== null && priceMin > priceMax) [priceMin, priceMax] = [priceMax, priceMin];

  const pageRaw = parseIntStrict(sp.get("page"));
  const sizeRaw = parseIntStrict(sp.get("pageSize"));
  const modeRaw = sp.get("mode");

  return {
    q, terms,
    subject: cleanParam(sp.get("subject"), SUBJECT_MAX),
    grade: isGradeValue(gradeRaw) ? gradeRaw : null,
    city: cleanParam(sp.get("city"), 60),
    district: cleanParam(sp.get("district"), DISTRICT_FILTER_MAX),
    mode: modeRaw === "online" || modeRaw === "offline" ? modeRaw : null,
    priceMin, priceMax,
    active: sp.get("active") === "1",
    sort: parseTutorSortKey(sp.get("sort")),
    page: pageRaw !== null && pageRaw >= 1 ? Math.min(pageRaw, MAX_PAGE) : 1,
    pageSize: sizeRaw !== null && sizeRaw >= 1 ? Math.min(sizeRaw, MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE,
  };
}

// ─── Lọc ─────────────────────────────────────────────────────────────────────────────────────────────────────
export type FilterKey = "q" | "subject" | "grade" | "city" | "district" | "mode" | "price" | "active";
type Skip = FilterKey | readonly FilterKey[] | undefined;
const skips = (skip: Skip, k: FilterKey) => skip === k || (Array.isArray(skip) && (skip as readonly FilterKey[]).includes(k));

/** Khoá so khớp của từng trường của một gia sư (tính một lần cho mỗi lần so). */
function haystacks(t: Pick<TutorListItem, "name" | "subjects" | "area">) {
  return { name: normalizeKey(t.name), subjects: t.subjects.map(normalizeKey), district: t.area?.district ? normalizeKey(t.area.district) : "" };
}

/** Gia sư có khớp mọi bộ lọc không (trừ các mục trong `skip` — dùng cho facet). Không động tới `sort/page/pageSize`. */
export function matchesFilters(t: TutorListItem, f: TutorFilters, skip?: Skip): boolean {
  if (!skips(skip, "q") && f.terms.length) {
    const h = haystacks(t);
    const hay = [h.name, ...h.subjects, h.district].filter(Boolean).join(" ");
    if (!f.terms.every(term => hay.includes(term))) return false;
  }
  if (!skips(skip, "subject") && f.subject && !t.subjects.includes(f.subject)) return false;
  if (!skips(skip, "grade") && f.grade && !gradesOfTutor(t.subjects).has(f.grade)) return false;
  if (!skips(skip, "city") && f.city && !matchesArea(t.area, { city: f.city })) return false;
  if (!skips(skip, "mode") && f.mode && !matchesArea(t.area, { mode: f.mode })) return false;
  if (!skips(skip, "district") && f.district) {
    const want = normalizeKey(f.district);
    if (!t.area?.district || normalizeKey(t.area.district) !== want) return false;
  }
  if (!skips(skip, "price") && (f.priceMin !== null || f.priceMax !== null)) {
    const p = t.area?.price;
    if (p === null || p === undefined) return false; // không bật giá → không khớp khi có lọc giá (không đoán)
    if (f.priceMin !== null && p < f.priceMin) return false;
    if (f.priceMax !== null && p > f.priceMax) return false;
  }
  if (!skips(skip, "active") && f.active && !t.recentlyActive) return false;
  return true;
}

/** Số bộ lọc đang bật (không tính q/sort/trang) — cho nhãn "Bộ lọc (n)". */
export function activeFilterCount(f: TutorFilters): number {
  return [f.subject, f.grade, f.city, f.district, f.mode, f.priceMin !== null || f.priceMax !== null ? "p" : null, f.active ? "a" : null].filter(Boolean).length;
}

// ─── Điểm khớp + sắp xếp ─────────────────────────────────────────────────────────────────────────────────────
/** Điểm cho `sort=relevant`: mỗi từ lấy điểm cao nhất — tên bắt đầu bằng từ 3, từ nằm trong tên 2, môn 2, quận 1. Không có từ → 0. */
export function scoreMatch(t: Pick<TutorListItem, "name" | "subjects" | "area">, terms: readonly string[]): number {
  if (!terms.length) return 0;
  const h = haystacks(t);
  let total = 0;
  for (const term of terms) {
    let best = 0;
    if (h.name.startsWith(term)) best = 3;
    else if (h.name.includes(term)) best = 2;
    if (best < 2 && h.subjects.some(s => s.includes(term))) best = 2;
    if (best < 1 && h.district.includes(term)) best = 1;
    total += best;
  }
  return total;
}

const byName = (a: TutorListItem, b: TutorListItem) => a.name.localeCompare(b.name, "vi");
const byId = (a: TutorListItem, b: TutorListItem) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const ratingOf = (t: TutorListItem) => t.rating.avg ?? -1;
/** Hai mục cuối của MỌI kiểu sắp: tên rồi id ⇒ thứ tự toàn phần. */
const tail = (a: TutorListItem, b: TutorListItem) => byName(a, b) || byId(a, b);
/** Giá tăng/giảm; "không giá" luôn ở cuối cả hai chiều. */
function byPrice(dir: 1 | -1) {
  return (a: TutorListItem, b: TutorListItem) => {
    const pa = a.area?.price ?? null, pb = b.area?.price ?? null;
    if (pa === null && pb === null) return 0;
    if (pa === null) return 1;
    if (pb === null) return -1;
    return (pa - pb) * dir;
  };
}

/** So sánh cho một kiểu sắp. `terms` chỉ dùng cho "relevant". Gia sư trùng mọi số vẫn có thứ tự cố định (tên rồi id). */
export function compareFor(sort: TutorSortKey, terms: readonly string[] = []): (a: SearchableTutor, b: SearchableTutor) => number {
  const active = (a: SearchableTutor, b: SearchableTutor) =>
    Number(b.recentlyActive) - Number(a.recentlyActive) || b.sessionsTaught - a.sessionsTaught || ratingOf(b) - ratingOf(a);
  switch (sort) {
    case "relevant": return (a, b) => scoreMatch(b, terms) - scoreMatch(a, terms) || active(a, b) || tail(a, b);
    case "newest": return (a, b) => {
      const va = a.verifiedAtMs, vb = b.verifiedAtMs;
      if (va === null && vb === null) return tail(a, b);
      if (va === null) return 1;
      if (vb === null) return -1;
      return vb - va || tail(a, b);
    };
    case "sessions": return (a, b) => b.sessionsTaught - a.sessionsTaught || tail(a, b);
    case "price_asc": return (a, b) => byPrice(1)(a, b) || tail(a, b);
    case "price_desc": return (a, b) => byPrice(-1)(a, b) || tail(a, b);
    case "rating": return (a, b) => ratingOf(b) - ratingOf(a) || tail(a, b);
    case "students": return (a, b) => b.studentCount - a.studentCount || tail(a, b);
    case "classes": return (a, b) => b.classCount - a.classCount || tail(a, b);
    case "active":
    default: return (a, b) => active(a, b) || tail(a, b);
  }
}
/** Mảng MỚI đã sắp. */
export function sortSearchable(items: readonly SearchableTutor[], sort: TutorSortKey, terms: readonly string[] = []): SearchableTutor[] {
  return [...items].sort(compareFor(sort, terms));
}

// ─── Phân trang ──────────────────────────────────────────────────────────────────────────────────────────────
export interface Page<T> { items: T[]; total: number; page: number; pageSize: number; hasMore: boolean }
export function paginate<T>(all: readonly T[], page: number, pageSize: number): Page<T> {
  const size = Number.isFinite(pageSize) ? clampInt(Math.floor(pageSize), 1, MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE;
  const p = Number.isFinite(page) ? clampInt(Math.floor(page), 1, MAX_PAGE) : 1;
  const start = (p - 1) * size;
  return { items: all.slice(start, start + size), total: all.length, page: p, pageSize: size, hasMore: start + size < all.length };
}

// ─── Facet ───────────────────────────────────────────────────────────────────────────────────────────────────
export interface TutorFacets {
  cities: string[];
  districts: string[];
  subjects: { value: string; count: number }[];
  grades: { value: string; label: string; count: number }[];
  modes: { online: number; offline: number };
  price: { min: number | null; max: number | null; count: number };
  activeCount: number;
}
/** Mỗi facet tính trên tập đã qua MỌI bộ lọc trừ chính nó, để danh sách chọn không co lại khi đang chọn. */
export function computeFacets(all: readonly TutorListItem[], f: TutorFilters): TutorFacets {
  const without = (k: FilterKey) => all.filter(t => matchesFilters(t, f, k));

  const cities = cityFacets(without("city").map(t => t.area));

  // Quận/huyện chỉ có nghĩa khi đã chọn tỉnh/thành.
  const districts: string[] = [];
  if (f.city) {
    const seen = new Map<string, string>();
    for (const t of without("district")) {
      const d = t.area?.district;
      if (d && !seen.has(normalizeKey(d))) seen.set(normalizeKey(d), d);
    }
    districts.push(...[...seen.values()].sort((x, y) => x.localeCompare(y, "vi")));
  }

  const subjCount = new Map<string, number>();
  for (const t of without("subject")) for (const s of new Set(t.subjects)) subjCount.set(s, (subjCount.get(s) ?? 0) + 1);
  const subjects = [...subjCount].map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, "vi") || (a.value < b.value ? -1 : 1))
    .slice(0, MAX_SUBJECT_FACETS);

  const gradeCount = new Map<string, number>();
  for (const t of without("grade")) for (const g of gradesOfTutor(t.subjects)) gradeCount.set(g, (gradeCount.get(g) ?? 0) + 1);
  const grades = GRADE_VALUES.filter(v => (gradeCount.get(v) ?? 0) > 0).map(v => ({ value: v, label: gradeLabel(v), count: gradeCount.get(v) ?? 0 }));

  const modes = { online: 0, offline: 0 };
  for (const t of without("mode")) {
    const m = t.area?.mode;
    if (m === "online" || m === "both") modes.online++;
    if (m === "offline" || m === "both") modes.offline++;
  }

  let pMin: number | null = null, pMax: number | null = null, pCount = 0;
  for (const t of without("price")) {
    const p = t.area?.price;
    if (p === null || p === undefined) continue;
    pCount++;
    pMin = pMin === null ? p : Math.min(pMin, p);
    pMax = pMax === null ? p : Math.max(pMax, p);
  }

  return { cities, districts, subjects, grades, modes, price: { min: pMin, max: pMax, count: pCount }, activeCount: without("active").filter(t => t.recentlyActive).length };
}

// ─── Gợi ý (thanh tìm) ───────────────────────────────────────────────────────────────────────────────────────
export type Suggestion = { kind: "subject"; label: string; value: string; count: number } | { kind: "tutor"; label: string; id: string };
export const SUGGEST_MIN_CHARS = 2;
export const SUGGEST_MAX_SUBJECTS = 5;
export const SUGGEST_MAX_TUTORS = 3;
/** `q` thô → chuỗi đã làm sạch (≤60 ký tự); dưới 2 ký tự → "" (không gợi ý). */
export function parseSuggestQuery(raw: string | null | undefined): string {
  const q = cleanText(typeof raw === "string" ? raw : "").slice(0, Q_MAX_CHARS).trim();
  return q.length >= SUGGEST_MIN_CHARS ? q : "";
}
/** Tối đa 5 môn (khớp không dấu, đếm gia sư) rồi tối đa 3 tên gia sư. Không trả ảnh. `tutors` đã là tập hiển thị công khai. */
export function buildSuggestions(tutors: readonly SearchableTutor[], rawQ: string): Suggestion[] {
  const q = parseSuggestQuery(rawQ);
  const terms = normalizeKey(q).split(" ").filter(Boolean).slice(0, Q_MAX_WORDS);
  if (!terms.length) return [];

  const subjCount = new Map<string, number>();
  for (const t of tutors) for (const s of new Set(t.subjects)) {
    const key = normalizeKey(s);
    if (key && terms.every(term => key.includes(term))) subjCount.set(s, (subjCount.get(s) ?? 0) + 1);
  }
  const subjects: Suggestion[] = [...subjCount].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "vi") || (a[0] < b[0] ? -1 : 1))
    .slice(0, SUGGEST_MAX_SUBJECTS).map(([value, count]) => ({ kind: "subject", label: value, value, count }));

  const cmp = compareFor("relevant", terms);
  const names: Suggestion[] = tutors
    .filter(t => { const k = normalizeKey(t.name); return terms.every(term => k.includes(term)); })
    .sort(cmp).slice(0, SUGGEST_MAX_TUTORS).map(t => ({ kind: "tutor", label: t.name, id: t.id }));
  return [...subjects, ...names];
}

/** Chạy toàn bộ: lọc → sắp → cắt trang → facet. Dùng chung cho route và test. */
export interface TutorListResponse extends Page<TutorListItem> { facets: TutorFacets }
export function searchTutors(all: readonly SearchableTutor[], f: TutorFilters): TutorListResponse {
  const matched = all.filter(t => matchesFilters(t, f));
  const page = paginate(sortSearchable(matched, f.sort, f.terms), f.page, f.pageSize);
  return { ...page, items: page.items.map(toListItem), facets: computeFacets(all, f) };
}
