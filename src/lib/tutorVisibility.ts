// NC2-022 — công tắc Hiện / Ẩn hồ sơ công khai của gia sư. Hàm THUẦN: kiểm dữ liệu, đọc, ghi khoá `User.preferences.profile.hidden`.
//
//  • Mặc định HIỆN: không có khoá = hiện. Chỉ lưu khi ẨN (`profile: { hidden: true }`); bật lại Hiện thì XOÁ khoá (và xoá cả `profile`),
//    nên không ai đổi gì nếu không động vào công tắc.
//  • Ẩn chỉ ảnh hưởng nơi công khai (trang Gia sư, link hồ sơ, thẻ xem trước). Lớp, học sinh, sổ lớp của gia sư không bị đụng.
//  • Q11: trường/bằng cấp TUỲ CHỌN. Không có điều kiện nào để bật Hiện.
//  • Chỉ ghi qua PUT /api/users/me/tutor-profile (cùng khoá giao dịch `prefsLockKey` với phần `teaching`); API giao diện từ chối khoá "profile"
//    nhưng giữ nguyên giá trị đang có (xem applyPreferencesPatch).

export interface TutorProfilePrefs {
  /** Chỉ có mặt (và luôn là true) khi gia sư chọn Ẩn. */
  hidden?: true;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Đọc từ DB: khoan dung. Chỉ `hidden === true` (đúng kiểu boolean) mới tính là ẩn; chuỗi "true", 1, null… đều coi như HIỆN. */
export function readProfilePrefs(raw: unknown): TutorProfilePrefs | undefined {
  if (!isObj(raw)) return undefined;
  return raw.hidden === true ? { hidden: true } : undefined;
}

export const isProfileHidden = (p: { profile?: TutorProfilePrefs } | null | undefined): boolean => p?.profile?.hidden === true;

export type ProfileParse = { hidden?: boolean; error?: string };
/**
 * Kiểm dữ liệu gia sư gửi lên: `profile` KHÔNG gửi → {} (giữ nguyên). Phải là đối tượng chỉ có khoá `hidden` kiểu đúng-sai.
 * Khoá lạ hoặc sai kiểu → lỗi, không ghi dở.
 */
export function parseProfileInput(raw: unknown): ProfileParse {
  if (raw === undefined) return {};
  if (!isObj(raw)) return { error: "profile không hợp lệ" };
  for (const k of Object.keys(raw)) if (k !== "hidden") return { error: `profile không có "${k.slice(0, 40)}"` };
  if (raw.hidden === undefined) return {};
  if (typeof raw.hidden !== "boolean") return { error: "hidden phải là đúng-sai" };
  return { hidden: raw.hidden };
}

/** Áp kết quả đã kiểm vào bộ tuỳ chọn (không đổi bản gốc). `hidden` vắng → giữ nguyên; false → xoá khoá; true → ghi. Khoá khác không bị đụng. */
export function applyProfileHidden<P extends { profile?: TutorProfilePrefs }>(prefs: P, hidden: boolean | undefined): P {
  if (hidden === undefined) return prefs;
  const next = { ...prefs };
  if (hidden) next.profile = { hidden: true }; else delete next.profile;
  return next;
}
