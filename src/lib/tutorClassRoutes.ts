// GS-LOP-GON (09/11/2026) — hợp đồng đường THUẦN của trang lớp gia sư (/lop-cua-toi/quan-lop/[id]*). Không React, không DB, không cookie: test từng hàng ở
// tools/local-e2e/t-class-routes-lib.ts. Đặc tả: docs/kin/phong-ban/dac-ta/GS-LOP-GON.md mục 3.1 (bảng cũ → mới) và 6.1 (ảnh bìa thẻ lớp).
//
// Hai việc:
//  1. legacyClassTarget — /lop-cua-toi/[courseId]?tab=… (LopChiTiet cũ, nay chỉ còn cho đồng giảng / quản trị / học sinh) → đích mới của CHỦ LỚP gia sư.
//     classPageDecision — /lop-cua-toi/quan-lop/[id]?tab=… → chuyển hướng sang trang con, hay hiện thân tab Cài đặt / Bài tập.
//     Chuyển hướng theo phiên là 307 + no-store (Next redirect() trong trang động); hàm ở đây chỉ trả ĐÍCH. Query chỉ giữ danh sách trắng, đã mã hoá: không mở
//     chuyển hướng ra ngoài, không rò tham số lạ. courseId luôn qua encodeURIComponent.
//  2. coverImageOf — Course.bg (chuỗi CSS của nền: màu, gradient hoặc url("…")) → CHỈ ảnh https hợp lệ cho thẻ lớp; mọi thứ khác null. Máy chủ lọc, trình duyệt
//     không bao giờ nhận chuỗi bg thô.

export type ClassQuery = Record<string, string | string[] | undefined> | URLSearchParams;

export const CLASS_BASE = "/lop-cua-toi/quan-lop";
/** /lop-cua-toi/quan-lop/<id đã mã hoá>. */
// "." và ".." không bị encodeURIComponent đổi, và cả "%2E%2E" cũng bị trình duyệt coi là đoạn ".." (chuẩn URL) nên sẽ chuẩn hoá thoát khỏi quan-lop — mã hoá hai lần (%252E): id vẫn đi
// tới máy chủ như chuỗi "%2E%2E" (không có lớp ⇒ 404), không thành đoạn đường dẫn.
export const classBase = (courseId: string): string => `${CLASS_BASE}/${/^\.{1,2}$/.test(courseId) ? courseId.replace(/\./g, "%252E") : encodeURIComponent(courseId)}`;

/** Mục con (?muc=) của tab Học sinh (…/hoc-vien) và tab Cài đặt (…?tab=cai-dat). Mục đầu là mặc định. */
export const MUC_HOC_SINH = ["danh-ba", "xin-vao", "ma-moi", "them"] as const;
export const MUC_CAI_DAT = ["thong-tin", "hoc-phi", "dong-giang", "cong-dong", "ban-ghi"] as const;
export type MucHocSinh = (typeof MUC_HOC_SINH)[number];
export type MucCaiDat = (typeof MUC_CAI_DAT)[number];
export const DEFAULT_MUC_HOC_SINH: MucHocSinh = MUC_HOC_SINH[0];
export const DEFAULT_MUC_CAI_DAT: MucCaiDat = MUC_CAI_DAT[0];

/** `muc` lạ / rỗng / mảng → mục mặc định, không lỗi. */
export function mucHocSinhOf(raw: unknown): MucHocSinh {
  return (MUC_HOC_SINH as readonly string[]).includes(raw as string) ? (raw as MucHocSinh) : DEFAULT_MUC_HOC_SINH;
}
export function mucCaiDatOf(raw: unknown): MucCaiDat {
  return (MUC_CAI_DAT as readonly string[]).includes(raw as string) ? (raw as MucCaiDat) : DEFAULT_MUC_CAI_DAT;
}

/** Tham số phụ mà các POST 303 (duyệt vào lớp, thêm học sinh, mã mời, tạo lớp) trả về — chỉ những khoá này đi tiếp qua chuyển hướng. */
export const KEEP_QUERY_KEYS = ["moi", "lich", "them", "duyet", "n", "ma"] as const;
type KeepKey = (typeof KEEP_QUERY_KEYS)[number];
const MAX_VALUE_LEN = 64;

/** Giá trị đầu tiên của một khoá (mảng → phần tử đầu). Rỗng / quá dài / không phải chuỗi → undefined. */
function pick(q: ClassQuery, key: string): string | undefined {
  let v: string | string[] | null | undefined;
  if (q instanceof URLSearchParams) v = q.get(key);
  else v = q[key];
  if (Array.isArray(v)) v = v[0];
  return typeof v === "string" && v.length > 0 && v.length <= MAX_VALUE_LEN ? v : undefined;
}

/** Chuỗi query từ cặp khoá-giá trị (URLSearchParams mã hoá giá trị). Rỗng → "". */
function qs(pairs: [string, string | undefined][]): string {
  const sp = new URLSearchParams();
  for (const [k, v] of pairs) if (v !== undefined) sp.set(k, v);
  const s = sp.toString();
  return s ? `?${s}` : "";
}
const keep = (q: ClassQuery, keys: readonly KeepKey[]): [string, string | undefined][] => keys.map(k => [k, pick(q, k)]);

/**
 * Đích mới cho CHỦ LỚP gia sư mở /lop-cua-toi/[courseId] (bảng 3.1). Không phụ thuộc người xem: nơi gọi tự kiểm "chủ lớp + gia sư" trước.
 *  - (không ?tab=) / ?tab= lạ: moi=1 → …/hoc-vien?muc=ma-moi&moi=1 (lớp mới chưa có học sinh); lich=loi → …/lich-hoc?lich=loi; duyet → …/hoc-vien?muc=xin-vao; còn lại …/giao-trinh.
 *  - diem-danh → …/diem-danh · hoc-sinh → …/hoc-vien (muc=xin-vao nếu có duyet hoặc n) · ma-moi → …/hoc-vien?muc=ma-moi
 *  - giao-vien → …?tab=cai-dat&muc=dong-giang · hoc-phi → muc=hoc-phi · cong-dong → muc=cong-dong.
 */
export function legacyClassTarget(courseId: string, query: ClassQuery = {}): string {
  const Q = classBase(courseId);
  switch (pick(query, "tab")) {
    case "diem-danh": return `${Q}/diem-danh`;
    case "hoc-sinh": {
      const xinVao = pick(query, "duyet") !== undefined || pick(query, "n") !== undefined;
      return `${Q}/hoc-vien${qs([["muc", xinVao ? "xin-vao" : undefined], ...keep(query, ["them", "duyet", "n"])])}`;
    }
    case "ma-moi": return `${Q}/hoc-vien${qs([["muc", "ma-moi"], ...keep(query, ["moi", "them", "ma"])])}`;
    case "giao-vien": return `${Q}?tab=cai-dat&muc=dong-giang`;
    case "hoc-phi": return `${Q}?tab=cai-dat&muc=hoc-phi`;
    case "cong-dong": return `${Q}?tab=cai-dat&muc=cong-dong`;
    default: break; // không có ?tab= hoặc tab lạ
  }
  if (pick(query, "moi") === "1") return `${Q}/hoc-vien${qs([["muc", "ma-moi"], ["moi", "1"], ...keep(query, ["them", "ma", "lich"])])}`;
  if (pick(query, "lich") === "loi") return `${Q}/lich-hoc?lich=loi`;
  if (pick(query, "duyet") !== undefined) return `${Q}/hoc-vien${qs([["muc", "xin-vao"], ...keep(query, ["duyet", "n"])])}`;
  return `${Q}/giao-trinh`;
}

/** Quyết định của trang /lop-cua-toi/quan-lop/[id] (bảng 3.1, nửa dưới). `tab` = thân tab hiện ngay tại trang này (không chuyển hướng). */
export type ClassPageDecision =
  | { kind: "redirect"; to: string }
  | { kind: "tab"; tab: "cai-dat" | "chuong-bai"; muc: MucCaiDat };

/**
 *  (không tab) / lạ / giao-trinh → …/giao-trinh · diem-danh → …/diem-danh · lich-hoc → …/lich-hoc · hoc-vien → …/hoc-vien (giữ muc hợp lệ)
 *  cai-dat → thân Cài đặt (muc mặc định thong-tin) · chuong-bai → thân Bài tập. Chuyển hướng giữ danh sách trắng query.
 */
export function classPageDecision(courseId: string, query: ClassQuery = {}): ClassPageDecision {
  const Q = classBase(courseId);
  const tab = pick(query, "tab");
  if (tab === "cai-dat") return { kind: "tab", tab: "cai-dat", muc: mucCaiDatOf(pick(query, "muc")) };
  if (tab === "chuong-bai") return { kind: "tab", tab: "chuong-bai", muc: DEFAULT_MUC_CAI_DAT };
  const rest = keep(query, KEEP_QUERY_KEYS);
  switch (tab) {
    case "diem-danh": return { kind: "redirect", to: `${Q}/diem-danh${qs(rest)}` };
    case "lich-hoc": return { kind: "redirect", to: `${Q}/lich-hoc${qs(rest)}` };
    case "hoc-vien": {
      const m = pick(query, "muc");
      const muc = (MUC_HOC_SINH as readonly string[]).includes(m ?? "") && m !== DEFAULT_MUC_HOC_SINH ? m : undefined;
      return { kind: "redirect", to: `${Q}/hoc-vien${qs([["muc", muc], ...rest])}` };
    }
    default: return { kind: "redirect", to: `${Q}/giao-trinh${qs(rest)}` }; // không tab, "giao-trinh", hoặc lạ
  }
}

/** Đường về trang lớp kiểu cũ cho đồng giảng (không dùng được quan-lop/[id]). */
export const coTeacherClassHref = (courseId: string): string => `/lop-cua-toi/${encodeURIComponent(courseId)}`;

/**
 * Ảnh bìa thẻ lớp từ Course.bg. Chỉ nhận đúng dạng url("https://…") (nháy kép / đơn / không nháy), ≤ 2048 ký tự, không khoảng trắng / nháy / ngoặc / < > \ trong địa chỉ,
 * có tên máy chủ, không có tài khoản trong địa chỉ. Gradient, màu, http:, data:, javascript:, chuỗi rỗng → null.
 */
export function coverImageOf(bg: string | null | undefined): string | null {
  if (typeof bg !== "string" || bg.length === 0 || bg.length > 2100) return null;
  const m = /url\(\s*(["']?)(https:\/\/[^\s"'()<>\\\/][^\s"'()<>\\]*)\1\s*\)/i.exec(bg);
  if (!m) return null;
  const url = m[2];
  if (url.length > 2048) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || !u.hostname || u.username || u.password) return null;
  } catch { return null; }
  return url;
}

// GS-LOP-GON: hàm thuần, không phụ thuộc máy chủ — kiểm ở tools/local-e2e/t-class-routes-lib.ts
