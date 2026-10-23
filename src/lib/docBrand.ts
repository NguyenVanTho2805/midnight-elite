// KiN Pro F3 "Giấy tờ có thương hiệu" (giai đoạn 1) — quy tắc THUẦN (không DB, không đồng hồ) để test từng ca biên.
// Tài liệu: docs/kin/rd/pro/tinh-nang-pro-tra-phi.md mục 9-F3 và 10.
//
// Nguyên tắc:
//  • Màu nhấn chỉ chọn từ danh sách KHOÁ → token --kin-*; KHÔNG nhận mã hex hay tên màu tự do.
//  • Thương hiệu KHÔNG che được nhãn "ghi trên KiN" hay số liệu thật: chân trang là hằng số, không có tham số thương hiệu nào đụng tới.
//  • Chữ gia sư tự nhập (tên hiển thị, chữ ký) không được mang lời khẳng định KiN không thể bảo chứng ("đã xác minh", "đúng luật"…).
//  • Chỉ chặn TẠO MỚI bản có thương hiệu. Bản đã tạo (có ảnh chụp thương hiệu) luôn xem và in lại được, kể cả khi hết hạn Pro.

export type AccentKey = "xanh-kin" | "xanh-link" | "luc" | "muc";
export const ACCENTS: Record<AccentKey, { label: string; css: string }> = {
  "xanh-kin": { label: "Xanh đậm", css: "var(--kin-th-navy)" },
  "xanh-link": { label: "Xanh dương", css: "var(--kin-th-xanh-link)" },
  luc: { label: "Xanh lá", css: "var(--kin-tt-chu-xong)" },
  muc: { label: "Mực (đen xám)", css: "var(--kin-chu-chinh)" },
};
export const ACCENT_KEYS = Object.keys(ACCENTS) as AccentKey[];
export const DEFAULT_ACCENT: AccentKey = "xanh-kin";
export const isAccentKey = (v: unknown): v is AccentKey => typeof v === "string" && Object.prototype.hasOwnProperty.call(ACCENTS, v);

export const NAME_MAX = 60;
export const SIGNATURE_MAX = 80;

export interface BrandSettings { displayName: string; accent: AccentKey; signature: string }

/** Chân trang luôn có trên bản in (mẫu KiN lẫn có thương hiệu). Không nhận tham số: thương hiệu không thể sửa hay che. */
export const PRINT_FOOTER = "Ghi trên KiN. Số liệu lấy từ điểm danh, bài về nhà và bài kiểm tra trên KiN; gia sư đã đọc và duyệt trước khi in.";
export const PRINT_PRIVACY_HINT = "Tờ này có tên và kết quả của em. Chỉ gửi riêng cho phụ huynh, không đăng vào nhóm chung.";
export const KIN_MARK = "KiN";

/** Lời khẳng định KiN không bảo chứng được: không cho nằm trong tên hiển thị hay chữ ký. */
const FORBIDDEN = /(xác\s*minh|xac\s*minh|đúng\s*luật|dung\s*luat|miễn\s*thuế|mien\s*thue|đã\s*gửi|da\s*gui|chính\s*thức|chinh\s*thuc|được\s*cấp\s*phép|duoc\s*cap\s*phep|chứng\s*nhận|chung\s*nhan|bộ\s*giáo\s*dục|midnight\s*elite)/i;
const CONTROL = /[\u0000-\u001f\u007f<>]/g;

const clean = (s: string) => s.replace(CONTROL, " ").replace(/\s+/g, " ").trim();

export type BrandCheck = { ok: true; brand: BrandSettings } | { ok: false; error: string };

/** Làm sạch và kiểm dữ liệu thương hiệu gia sư gửi lên. */
export function sanitizeBrand(raw: unknown): BrandCheck {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { ok: false, error: "Dữ liệu không hợp lệ" };
  const r = raw as Record<string, unknown>;
  if (typeof r.displayName !== "string") return { ok: false, error: "Cần nhập tên hiển thị" };
  const displayName = clean(r.displayName);
  if (!displayName) return { ok: false, error: "Cần nhập tên hiển thị" };
  if (displayName.length > NAME_MAX) return { ok: false, error: `Tên hiển thị tối đa ${NAME_MAX} ký tự` };
  if (!isAccentKey(r.accent)) return { ok: false, error: "Màu nhấn phải chọn trong danh sách" };
  const sigRaw = r.signature === undefined || r.signature === null ? "" : r.signature;
  if (typeof sigRaw !== "string") return { ok: false, error: "Chữ ký phải là chữ" };
  const signature = clean(sigRaw);
  if (signature.length > SIGNATURE_MAX) return { ok: false, error: `Chữ ký tối đa ${SIGNATURE_MAX} ký tự` };
  if (FORBIDDEN.test(displayName) || FORBIDDEN.test(signature)) return { ok: false, error: "Tên và chữ ký không được ghi các từ như “đã xác minh”, “đúng luật”, “chính thức”, “chứng nhận”. KiN không thể bảo chứng những điều đó." };
  return { ok: true, brand: { displayName, accent: r.accent, signature } };
}

/** Đọc lại ảnh chụp thương hiệu đã lưu (Json trong DB). Hỏng hay lạ → null (in mẫu KiN, không ném lỗi). */
export function readBrandSnapshot(v: unknown): BrandSettings | null {
  const c = sanitizeBrand(v);
  return c.ok ? c.brand : null;
}

export interface PrintLook { mode: "kin" | "brand"; headline: string; accentCss: string; signature: string }
/** Dáng bản in: có ảnh chụp thương hiệu → thương hiệu; không → mẫu mặc định KiN. */
export function printLook(snapshot: BrandSettings | null): PrintLook {
  if (!snapshot) return { mode: "kin", headline: KIN_MARK, accentCss: ACCENTS[DEFAULT_ACCENT].css, signature: "" };
  return { mode: "brand", headline: snapshot.displayName, accentCss: ACCENTS[snapshot.accent].css, signature: snapshot.signature };
}

export type BrandedGate =
  | { kind: "not_approved" }       // 409: chưa duyệt thì không có gì để in
  | { kind: "existing" }           // 200: đã có bản có thương hiệu → xem lại, không tạo mới, không cần Pro
  | { kind: "pro_required" }       // 403: Free (cổng bật) tạo mới
  | { kind: "no_brand" }           // 400: chưa cài tên hiển thị
  | { kind: "create" };            // tạo mới

/** Thứ tự kiểm: chưa duyệt → đã có (luôn cho) → quyền Pro → đã cài thương hiệu → tạo. */
export function brandedGate(o: { approved: boolean; hasSnapshot: boolean; allowed: boolean; hasBrand: boolean }): BrandedGate {
  if (!o.approved) return { kind: "not_approved" };
  if (o.hasSnapshot) return { kind: "existing" };
  if (!o.allowed) return { kind: "pro_required" };
  if (!o.hasBrand) return { kind: "no_brand" };
  return { kind: "create" };
}
export const BRANDED_GATE_STATUS: Record<BrandedGate["kind"], number> = { not_approved: 409, existing: 200, pro_required: 403, no_brand: 400, create: 200 };
export const BRANDED_GATE_TEXT: Record<"not_approved" | "pro_required" | "no_brand", string> = {
  not_approved: "Duyệt báo cáo trước, rồi mới in.",
  pro_required: "Bản in có thương hiệu nằm trong KiN Pro. Bản mẫu KiN vẫn in được và vẫn miễn phí.",
  no_brand: "Cài tên hiển thị trước khi tạo bản có thương hiệu.",
};
