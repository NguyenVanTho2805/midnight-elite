// SCL đợt 5 — học thử có hạn (docs/kin/rd/HOC-THU-VA-DANG-KY.md D5–D8). THUẦN: không DB, không Node — tệp trình duyệt và máy chủ dùng chung.
//   • trialDays null ⇒ ghi danh chính thức, không hạn.
//   • trialStartedAt null ⇒ em chưa mở lớp, CHƯA tính ngày (tình huống 9).
//   • Hết hạn khi now ≥ trialStartedAt + trialDays ngày (mốc đúng giây, không làm tròn theo ngày VN).
export const TRIAL_DAYS = 14;
export const TRIAL_EXTEND_DAYS = 7;
/** Còn ≤ chừng này ngày ⇒ băng nhắc chuyển tone cảnh báo (tình huống 10). */
export const TRIAL_WARN_DAYS = 3;
const DAY_MS = 86_400_000;

export interface TrialFields { trialDays?: number | null; trialStartedAt?: Date | string | null }
export type TrialState =
  | { kind: "khong_phai_thu" }
  | { kind: "chua_bat_dau" }
  | { kind: "dang_thu"; daysLeft: number }
  | { kind: "het_han" };

const toDate = (d: Date | string): Date => (d instanceof Date ? d : new Date(d));

/** Mốc hết hạn, hoặc null khi không phải học thử / chưa bắt đầu. */
export function trialEndsAt(e: TrialFields): Date | null {
  if (e.trialDays == null || e.trialStartedAt == null) return null;
  return new Date(toDate(e.trialStartedAt).getTime() + e.trialDays * DAY_MS);
}

/** daysLeft = số ngày còn lại làm tròn LÊN (còn 1 giây vẫn là "còn 1 ngày"). */
export function trialState(e: TrialFields, now: Date = new Date()): TrialState {
  if (e.trialDays == null) return { kind: "khong_phai_thu" };
  const end = trialEndsAt(e);
  if (!end) return { kind: "chua_bat_dau" };
  const left = end.getTime() - now.getTime();
  if (left <= 0) return { kind: "het_han" };
  return { kind: "dang_thu", daysLeft: Math.ceil(left / DAY_MS) };
}

export const isTrialExpired = (e: TrialFields, now: Date = new Date()): boolean => trialState(e, now).kind === "het_han";

/** SCL5: hình dạng gửi cho giao diện học sinh — còn hạn (kèm mốc hết hạn ISO, để ghi giờ tuyệt đối) hoặc chưa bắt đầu. Hết hạn / chính thức ⇒ null. */
/** `trialDays` = số ngày học thử THẬT của ghi danh này (Enrollment.trialDays), để chữ trên màn không ghi cứng 14. */
export function trialView(e: TrialFields, now: Date = new Date()): { kind: "dang_thu"; daysLeft: number; endsAt: string; trialDays: number } | { kind: "chua_bat_dau"; trialDays: number } | null {
  const s = trialState(e, now);
  if (s.kind === "chua_bat_dau") return { ...s, trialDays: e.trialDays! };
  if (s.kind === "dang_thu") return { ...s, endsAt: trialEndsAt(e)!.toISOString(), trialDays: e.trialDays! };
  return null;
}

/** Nhãn ngắn cho danh sách học sinh của gia sư. */
export function trialLabel(e: TrialFields & { trialConvertRequestedAt?: Date | string | null }, now: Date = new Date()): string | null {
  const s = trialState(e, now);
  if (s.kind === "khong_phai_thu") return null;
  if (e.trialConvertRequestedAt) return "Chờ xác nhận chính thức";
  if (s.kind === "chua_bat_dau") return "Chưa bắt đầu";
  if (s.kind === "het_han") return "Hết hạn";
  return `Học thử · còn ${s.daysLeft} ngày`;
}

/** D9: chỉ Khối 11, 12 được KiN tự tạo tài khoản. */
export const intakeGradeAllowed = (khoi: string): boolean => /(^|\D)(11|12)(\D|$)/.test(khoi);
