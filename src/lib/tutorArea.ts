// ĐX-06 (NC1-070..074) — khu vực và hình thức dạy trên hồ sơ gia sư. Hàm THUẦN: kiểm dữ liệu, chuẩn hoá, phần được công khai, lọc.
//
// Thọ chốt Q4 (21/10): thêm vào trang Hồ sơ gia sư (KHÔNG vào form đăng ký), TUỲ CHỌN, không nhóm nào bắt buộc.
//  • Tỉnh/Thành lưu ở cột `users.city` (đã có); Quận/Huyện, hình thức, trường + bằng cấp, giá tham khảo lưu ở `User.preferences.teaching`.
//  • Mọi thứ là TỰ KHAI: KiN không xác minh, hồ sơ công khai ghi rõ "tự khai".
//  • Chỉ hiện quận/huyện. KiN không có ô địa chỉ nhà và không bao giờ trả nó ra công khai.
//  • Giá tham khảo mặc định TẮT: chỉ hiện khi gia sư tự bật (`showPrice`). KiN không thu hộ và không dựa vào số này để tính tiền.
//  • Công khai theo kiểu OPT-IN: chỉ khi gia sư đã lưu mục này (`teaching` có mặt). `users.city` cũ (từ lúc form đăng ký còn ô Tỉnh/Thành)
//    không tự lộ ra khi gia sư chưa làm gì.

export const TEACHING_MODES = ["online", "offline", "both"] as const;
export type TeachingMode = (typeof TEACHING_MODES)[number];
export const MODE_LABEL: Record<TeachingMode, string> = { online: "Online", offline: "Dạy trực tiếp", both: "Online + dạy trực tiếp" };

export const CITY_MAX = 60;
export const DISTRICT_MAX = 60;
export const CREDENTIAL_MAX = 100;
export const PRICE_MIN = 10_000;
export const PRICE_MAX = 10_000_000;

export interface TutorTeaching {
  district?: string;
  mode?: TeachingMode;
  /** Trường và bằng cấp chính, tự khai. */
  credential?: string;
  /** Giá tham khảo mỗi buổi (VND, số nguyên). */
  price?: number;
  /** Chỉ khi true mới hiện giá ở công khai. Vắng mặt = tắt. */
  showPrice?: boolean;
}

// Ký tự điều khiển (C0, DEL, C1), khoảng rộng bằng 0, MỌI ký tự đổi chiều chữ (có thể làm chữ công khai hiển thị sai lệch), ngắt dòng/đoạn Unicode, nối từ vô hình và dấu BOM. Viết bằng chuỗi thoát để mã nguồn chỉ có ASCII.
const INVISIBLE = new RegExp("[\\u0000-\\u001f\\u007f-\\u009f\\u200b-\\u200f\\u2028-\\u202e\\u2060-\\u2064\\u2066-\\u2069\\ufeff]", "g");
/** Chữ tự nhập: NFC, bỏ ký tự điều khiển và ký tự vô hình, gộp khoảng trắng, cắt hai đầu. */
export function cleanText(raw: string): string {
  return raw.normalize("NFC").replace(INVISIBLE, " ").replace(/\s+/g, " ").trim();
}

/** Khoá so khớp: không phân biệt hoa thường, bỏ dấu tiếng Việt, mọi ký tự không phải chữ/số thành một khoảng trắng. */
export function normalizeKey(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d").replace(/[^a-z0-9]+/g, " ").trim();
}

const CITY_ALIASES: [string, string[]][] = [
  ["Hà Nội", ["ha noi", "hn", "tp ha noi", "thanh pho ha noi"]],
  ["TP. Hồ Chí Minh", ["ho chi minh", "tp ho chi minh", "tphcm", "tp hcm", "hcm", "sai gon", "sg", "thanh pho ho chi minh"]],
  ["Đà Nẵng", ["da nang", "tp da nang", "thanh pho da nang"]],
  ["Hải Phòng", ["hai phong", "tp hai phong", "thanh pho hai phong"]],
  ["Cần Thơ", ["can tho", "tp can tho", "thanh pho can tho"]],
  ["Huế", ["hue", "tp hue", "thanh pho hue", "thua thien hue"]],
];
const ALIAS = new Map<string, string>(CITY_ALIASES.flatMap(([canon, keys]) => keys.map(k => [k, canon] as [string, string])));

/** Cách viết thống nhất cho các thành phố hay gặp ("TP.HCM", "Sài Gòn" → "TP. Hồ Chí Minh"); nơi khác giữ nguyên chữ đã làm sạch. */
export function canonicalCity(raw: string): string {
  const t = cleanText(raw);
  return ALIAS.get(normalizeKey(t)) ?? t;
}
export const cityKey = (raw: string) => normalizeKey(canonicalCity(raw));

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const TEACHING_KEYS = ["district", "mode", "credential", "price", "showPrice"] as const;

export type AreaParse = { city?: string | null; teaching?: TutorTeaching | null; error?: string };
/**
 * Kiểm dữ liệu gia sư gửi lên. Trường KHÔNG gửi → undefined (giữ nguyên). `null` hoặc chuỗi rỗng → xoá giá trị đó.
 * `teaching: null` → xoá cả mục (hồ sơ không còn hiện khu vực/hình thức). Khoá lạ hoặc sai kiểu → lỗi, không ghi dở.
 */
export function parseAreaInput(body: { city?: unknown; teaching?: unknown }): AreaParse {
  const out: { city?: string | null; teaching?: TutorTeaching | null } = {};

  if (body.city !== undefined) {
    if (body.city !== null && typeof body.city !== "string") return { error: "Tỉnh/Thành phải là chuỗi" };
    const c = cleanText(body.city ?? "");
    if (c.length > CITY_MAX) return { error: `Tỉnh/Thành tối đa ${CITY_MAX} ký tự` };
    out.city = c ? canonicalCity(c) : null;
  }

  if (body.teaching !== undefined) {
    if (body.teaching === null) { out.teaching = null; return out; }
    if (!isObj(body.teaching)) return { error: "teaching không hợp lệ" };
    const t: TutorTeaching = {};
    for (const k of Object.keys(body.teaching)) if (!(TEACHING_KEYS as readonly string[]).includes(k)) return { error: `teaching không có "${k.slice(0, 40)}"` };
    const src = body.teaching;

    if (src.district !== undefined && src.district !== null) {
      if (typeof src.district !== "string") return { error: "Quận/Huyện phải là chuỗi" };
      const d = cleanText(src.district);
      if (d.length > DISTRICT_MAX) return { error: `Quận/Huyện tối đa ${DISTRICT_MAX} ký tự` };
      if (d) t.district = d;
    }
    if (src.mode !== undefined && src.mode !== null && src.mode !== "") {
      if (typeof src.mode !== "string" || !(TEACHING_MODES as readonly string[]).includes(src.mode)) return { error: "Hình thức dạy phải là online, offline hoặc both" };
      t.mode = src.mode as TeachingMode;
    }
    if (src.credential !== undefined && src.credential !== null) {
      if (typeof src.credential !== "string") return { error: "Trường và bằng cấp phải là chuỗi" };
      const c = cleanText(src.credential);
      if (c.length > CREDENTIAL_MAX) return { error: `Trường và bằng cấp tối đa ${CREDENTIAL_MAX} ký tự` };
      if (c) t.credential = c;
    }
    if (src.price !== undefined && src.price !== null) {
      if (typeof src.price !== "number" || !Number.isInteger(src.price) || src.price < PRICE_MIN || src.price > PRICE_MAX) {
        return { error: `Giá tham khảo phải là số nguyên từ ${PRICE_MIN.toLocaleString("vi-VN")}đ đến ${PRICE_MAX.toLocaleString("vi-VN")}đ` };
      }
      t.price = src.price;
    }
    if (src.showPrice !== undefined && src.showPrice !== null) {
      if (typeof src.showPrice !== "boolean") return { error: "showPrice phải là đúng-sai" };
      if (src.showPrice) t.showPrice = true;
    }
    if (t.showPrice && t.price === undefined) return { error: "Bật hiện giá thì phải nhập giá tham khảo" };
    out.teaching = t;
  }
  return out;
}

/** Đọc `User.preferences.teaching` từ DB: khoan dung (bỏ phần hỏng, không bao giờ ném lỗi). Không phải đối tượng → undefined (= chưa lưu mục này). */
export function readTeaching(raw: unknown): TutorTeaching | undefined {
  if (!isObj(raw)) return undefined;
  const t: TutorTeaching = {};
  if (typeof raw.district === "string") { const d = cleanText(raw.district); if (d && d.length <= DISTRICT_MAX) t.district = d; }
  if (typeof raw.mode === "string" && (TEACHING_MODES as readonly string[]).includes(raw.mode)) t.mode = raw.mode as TeachingMode;
  if (typeof raw.credential === "string") { const c = cleanText(raw.credential); if (c && c.length <= CREDENTIAL_MAX) t.credential = c; }
  if (typeof raw.price === "number" && Number.isInteger(raw.price) && raw.price >= PRICE_MIN && raw.price <= PRICE_MAX) t.price = raw.price;
  if (raw.showPrice === true && t.price !== undefined) t.showPrice = true;
  return t;
}

/** Phần được trả ra CÔNG KHAI. Không có địa chỉ nhà, không có số điện thoại. */
export interface PublicArea { city: string | null; district: string | null; mode: TeachingMode | null; credential: string | null; price: number | null }
/** Chưa lưu mục này (`teaching` vắng) → null: không lộ `users.city` cũ. */
export function publicArea(city: string | null | undefined, teaching: TutorTeaching | undefined): PublicArea | null {
  if (!teaching) return null;
  return {
    city: city ? canonicalCity(city) || null : null,
    district: teaching.district ?? null,
    mode: teaching.mode ?? null,
    credential: teaching.credential ?? null,
    // Giá chỉ ra công khai khi gia sư tự bật; tắt thì không rò dù vẫn đang lưu trong DB.
    price: teaching.showPrice && teaching.price !== undefined ? teaching.price : null,
  };
}
export const hasPublicArea = (a: PublicArea | null | undefined): a is PublicArea => !!a && !!(a.city || a.district || a.mode || a.credential || a.price);
/** "Hà Nội · Cầu Giấy" */
export const areaLine = (a: Pick<PublicArea, "city" | "district">): string => [a.district, a.city].filter(Boolean).reverse().join(" · ");
export const priceText = (vnd: number): string => `${vnd.toLocaleString("vi-VN")}đ / buổi`;

// ─── Lọc danh sách /giang-vien ───────────────────────────────────────────────────────────────────────────────
export type ModeFilter = "online" | "offline";
export const parseModeFilter = (raw: string | null | undefined): ModeFilter | null => (raw === "online" || raw === "offline" ? raw : null);

/**
 * Gia sư chưa lưu mục khu vực không khớp bất kỳ bộ lọc nào đang bật (không đoán).
 * "online" khớp online và cả hai; "offline" (dạy trực tiếp) khớp offline và cả hai.
 */
export function matchesArea(a: PublicArea | null, f: { city?: string | null; mode?: ModeFilter | null }): boolean {
  const wantCity = f.city ? cityKey(f.city) : "", wantMode = f.mode ?? null;
  if (!wantCity && !wantMode) return true;
  if (!a) return false;
  if (wantCity && (!a.city || cityKey(a.city) !== wantCity)) return false;
  if (wantMode && !(a.mode === wantMode || a.mode === "both")) return false;
  return true;
}

/** Danh sách tỉnh/thành có gia sư, không trùng (theo khoá bỏ dấu), sắp theo tên tiếng Việt. */
export function cityFacets(areas: ReadonlyArray<PublicArea | null>): string[] {
  const seen = new Map<string, string>();
  for (const a of areas) if (a?.city && !seen.has(cityKey(a.city))) seen.set(cityKey(a.city), a.city);
  return [...seen.values()].sort((x, y) => x.localeCompare(y, "vi"));
}
