// Hồ sơ học sinh của gia sư (HS-03/04/10/11, LO-18): kiểm dữ liệu vào, che dữ liệu khi chưa đủ đồng ý. Hàm THUẦN.
// Test: tools/local-e2e/t-student-profile-lib.ts. Quy tắc đồng ý: src/lib/consentPolicy.ts.
//
// Dữ liệu chia hai nhóm theo phạm vi đồng ý:
//  • cơ bản   (scope "basic")   : tên, nhóm tuổi, trạng thái, lớp, tên + số phụ huynh, gia đình;
//  • mở rộng  (scope "extended"): ngày sinh, địa chỉ, SĐT em, SĐT thứ ba, email, email bổ sung, ngày bắt đầu, môn, ghi chú, trường tuỳ chỉnh.
// Chưa đủ đồng ý ⇒ KHÔNG nhận và KHÔNG hiện nhóm tương ứng (maskProfile).
import { cleanText } from "@/lib/tutorArea";
import { normalizeZaloPhone } from "@/lib/zaloShare";
import { isValidDateKey, vnDateKeyOf } from "@/lib/classSessions";
import { isAgeGroup, type AgeGroup, type ConsentState } from "@/lib/consentPolicy";

export const PROFILE_STATUSES = ["active", "inactive", "waitlist"] as const;
export type ProfileStatus = (typeof PROFILE_STATUSES)[number];
export const STATUS_LABEL: Record<ProfileStatus, string> = { active: "Hoạt động", inactive: "Không hoạt động", waitlist: "Đang chờ xếp lớp" };
export const isProfileStatus = (v: unknown): v is ProfileStatus => typeof v === "string" && (PROFILE_STATUSES as readonly string[]).includes(v);

export const NAME_MAX = 60;
export const LABEL_MAX = 40;
export const ADDRESS_MAX = 200;
export const NOTES_MAX = 500;
export const SUBJECT_MAX = 30;
export const SUBJECTS_MAX = 5;
export const CUSTOM_VALUE_MAX = 200;
export const EMAIL_MAX = 120;
export const MIN_BIRTH_YEAR = 1950;
/** Ký tự điều khiển / vô hình / đổi chiều chữ trong ghi chú (dựng từ chuỗi thoát để mã nguồn chỉ có ASCII). Giữ xuống dòng. */
const NOTE_BAD = new RegExp("[\\u0000-\\u0008\\u000b-\\u001f\\u007f-\\u009f\\u200b-\\u200f\\u2028-\\u202e\\u2060-\\u2064\\u2066-\\u2069\\ufeff]", "g");

/** Số trường tuỳ chỉnh tối đa mỗi gia sư (LO-18). Cấu hình bằng KIN_CUSTOM_FIELDS_MAX, mặc định 3, giới hạn 0 đến 10. */
export function customFieldsMax(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.KIN_CUSTOM_FIELDS_MAX);
  return Number.isInteger(n) && n >= 0 && n <= 10 ? n : 3;
}
/** Số dòng tối đa mỗi lần nhập hàng loạt (LO-06/LO-17). Cấu hình bằng KIN_IMPORT_MAX_ROWS, mặc định 100, giới hạn 1 đến 500. */
export function importMaxRows(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.KIN_IMPORT_MAX_ROWS);
  return Number.isInteger(n) && n >= 1 && n <= 500 ? n : 100;
}

export const BASIC_FIELDS = ["name", "ageGroup", "status", "courseId", "guardianName", "guardianPhone", "familyId", "userId"] as const;
export const EXTENDED_FIELDS = ["birthDate", "address", "phone", "phoneExtra", "email", "emailExtra", "startDate", "subjects", "notes", "customData"] as const;
export type ExtendedField = (typeof EXTENDED_FIELDS)[number];
const isExtended = (k: string): boolean => (EXTENDED_FIELDS as readonly string[]).includes(k);

/** Dữ liệu hồ sơ đã kiểm (khớp cột của StudentProfile). */
export interface ProfileData {
  name?: string;
  ageGroup?: AgeGroup;
  status?: ProfileStatus;
  courseId?: string | null;
  familyId?: string | null;
  guardianName?: string | null;
  guardianPhone?: string | null;
  birthDate?: string | null;
  address?: string | null;
  phone?: string | null;
  phoneExtra?: string | null;
  email?: string | null;
  emailExtra?: string | null;
  startDate?: string | null;
  subjects?: string[];
  notes?: string | null;
  customData?: Record<string, string> | null;
}

export interface ProfileParse {
  data: ProfileData;
  /** Lỗi theo trường (chữ tiếng Việt, hiện cạnh ô). */
  errors: Record<string, string>;
  /** Các trường người dùng ĐÃ gửi (để ghi nhật ký sửa: chỉ TÊN trường, không ghi giá trị). */
  fields: string[];
  /** Có trường thuộc nhóm mở rộng có giá trị (khác rỗng) không — để đòi phạm vi "extended". */
  touchesExtended: boolean;
}

const str = (v: unknown, max: number): string | null | undefined => {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== "string") return undefined;
  const t = cleanText(v);
  return t ? t.slice(0, max + 1) : null; // +1 để báo lỗi quá dài thay vì cắt im lặng
};

/** "dd/mm/yyyy", "d-m-yyyy", "yyyy-mm-dd" → "yyyy-mm-dd"; sai → null. */
export function parseDateInput(raw: string): string | null {
  const t = raw.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  let y: number, mo: number, d: number;
  if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else if ((m = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/.exec(t))) { d = +m[1]; mo = +m[2]; y = +m[3]; }
  else return null;
  const key = `${String(y).padStart(4, "0")}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return isValidDateKey(key) ? key : null;
}

export function validEmail(s: string): boolean { return s.length <= EMAIL_MAX && /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/.test(s); }

/**
 * Kiểm một thân yêu cầu (tạo hoặc sửa). `partial` = sửa: chỉ trường có mặt được kiểm; tạo thì `name` và `ageGroup` bắt buộc.
 * `customIds` = id các trường tuỳ chỉnh CỦA CHÍNH gia sư này (id lạ bị từ chối, không lưu im lặng).
 */
export function parseProfileInput(body: unknown, o: { partial: boolean; customIds: ReadonlySet<string>; now: Date }): ProfileParse {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const data: ProfileData = {}, errors: Record<string, string> = {}, fields: string[] = [];
  const has = (k: string) => k in b && b[k] !== undefined;
  const todayKey = vnDateKeyOf(o.now);
  const take = (k: string) => { if (has(k)) fields.push(k); return has(k); };

  if (take("name")) {
    const v = str(b.name, NAME_MAX);
    if (!v || !/\p{L}/u.test(v)) errors.name = "Nhập tên em";
    else if (v.length > NAME_MAX) errors.name = `Tên tối đa ${NAME_MAX} ký tự`;
    else data.name = v;
  } else if (!o.partial) errors.name = "Nhập tên em";

  if (take("ageGroup")) {
    if (isAgeGroup(b.ageGroup)) data.ageGroup = b.ageGroup; else errors.ageGroup = "Chọn nhóm tuổi của em";
  } else if (!o.partial) errors.ageGroup = "Chọn nhóm tuổi của em";

  if (take("status")) { if (isProfileStatus(b.status)) data.status = b.status; else errors.status = "Trạng thái không hợp lệ"; }

  if (take("courseId")) { data.courseId = typeof b.courseId === "string" && b.courseId ? b.courseId : null; }
  if (take("familyId")) { data.familyId = typeof b.familyId === "string" && b.familyId ? b.familyId : null; }

  if (take("guardianName")) {
    const v = str(b.guardianName, NAME_MAX);
    if (v && v.length > NAME_MAX) errors.guardianName = `Tên phụ huynh tối đa ${NAME_MAX} ký tự`; else data.guardianName = v ?? null;
  }
  const phoneField = (k: "guardianPhone" | "phone" | "phoneExtra", label: string) => {
    if (!take(k)) return;
    const v = str(b[k], 20);
    if (!v) { data[k] = null; return; }
    const p = normalizeZaloPhone(v);
    if (p) data[k] = p; else errors[k] = `${label} phải đủ 10 chữ số`;
  };
  phoneField("guardianPhone", "Số điện thoại phụ huynh");
  phoneField("phone", "Số điện thoại của em");
  phoneField("phoneExtra", "Số điện thoại thứ ba");

  const emailField = (k: "email" | "emailExtra", label: string) => {
    if (!take(k)) return;
    const v = str(b[k], EMAIL_MAX);
    if (!v) { data[k] = null; return; }
    const low = v.toLowerCase();
    if (validEmail(low)) data[k] = low; else errors[k] = `${label} chưa đúng dạng`;
  };
  emailField("email", "Email");
  emailField("emailExtra", "Email bổ sung");

  if (take("birthDate")) {
    const v = str(b.birthDate, 12);
    if (!v) data.birthDate = null;
    else {
      const key = parseDateInput(v);
      if (!key) errors.birthDate = "Ngày sinh chưa đúng (ví dụ 15/03/2014)";
      else if (key > todayKey) errors.birthDate = "Ngày sinh không được ở tương lai";
      else if (Number(key.slice(0, 4)) < MIN_BIRTH_YEAR) errors.birthDate = "Ngày sinh quá xa";
      else data.birthDate = key;
    }
  }
  if (take("startDate")) {
    const v = str(b.startDate, 12);
    if (!v) data.startDate = null;
    else { const key = parseDateInput(v); if (key) data.startDate = key; else errors.startDate = "Ngày bắt đầu chưa đúng (ví dụ 01/11/2026)"; }
  }
  if (take("address")) {
    const v = str(b.address, ADDRESS_MAX);
    if (v && v.length > ADDRESS_MAX) errors.address = `Địa chỉ tối đa ${ADDRESS_MAX} ký tự`; else data.address = v ?? null;
  }
  if (take("notes")) {
    const raw = typeof b.notes === "string" ? b.notes.normalize("NFC").replace(/\r\n?/g, "\n").replace(NOTE_BAD, "").trim() : "";
    if (raw.length > NOTES_MAX) errors.notes = `Ghi chú tối đa ${NOTES_MAX} ký tự`; else data.notes = raw || null;
  }
  if (take("subjects")) {
    const arr = Array.isArray(b.subjects) ? b.subjects : typeof b.subjects === "string" ? b.subjects.split(/[,;|]/) : [];
    const out: string[] = [];
    for (const x of arr) {
      const t = typeof x === "string" ? cleanText(x) : "";
      if (!t) continue;
      if (t.length > SUBJECT_MAX) { errors.subjects = `Mỗi môn tối đa ${SUBJECT_MAX} ký tự`; break; }
      if (!out.some(y => y.toLowerCase() === t.toLowerCase())) out.push(t);
    }
    if (!errors.subjects) { if (out.length > SUBJECTS_MAX) errors.subjects = `Tối đa ${SUBJECTS_MAX} môn`; else data.subjects = out; }
  }
  if (take("customData")) {
    const cd = b.customData;
    if (cd === null) data.customData = null;
    else if (cd && typeof cd === "object" && !Array.isArray(cd)) {
      const out: Record<string, string> = {};
      for (const [id, val] of Object.entries(cd as Record<string, unknown>)) {
        if (!o.customIds.has(id)) { errors.customData = "Có trường tuỳ chỉnh không thuộc danh sách của bạn"; break; }
        const t = typeof val === "string" ? cleanText(val) : "";
        if (t.length > CUSTOM_VALUE_MAX) { errors.customData = `Mỗi trường tuỳ chỉnh tối đa ${CUSTOM_VALUE_MAX} ký tự`; break; }
        if (t) out[id] = t;
      }
      if (!errors.customData) data.customData = Object.keys(out).length ? out : null;
    } else errors.customData = "Trường tuỳ chỉnh không hợp lệ";
  }

  const touchesExtended = fields.some(k => {
    if (!isExtended(k)) return false;
    const v = (data as Record<string, unknown>)[k];
    return Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined;
  });
  return { data, errors, fields, touchesExtended };
}

/** Dòng hồ sơ như lưu trong DB (chỉ các cột dùng ở đây). */
export interface ProfileRow {
  id: string; name: string; ageGroup: string; status: string; courseId: string | null; userId: string | null; familyId: string | null;
  guardianName: string | null; guardianPhone: string | null;
  birthDate: string | null; address: string | null; phone: string | null; phoneExtra: string | null; email: string | null; emailExtra: string | null;
  startDate: string | null; subjects: string[]; notes: string | null; customData: unknown;
  source: string; waitlistedAt: Date | string | null; createdAt: Date | string;
}

export type ConsentLevel = "full" | "basic_only" | "locked";
export interface ProfileView extends Partial<Omit<ProfileRow, "customData">> {
  id: string; name: string;
  /** full = đủ cơ bản + mở rộng; basic_only = chỉ cơ bản (thiếu mở rộng); locked = thiếu cả cơ bản (chỉ còn tên để gia sư tìm mà xoá / xin đồng ý lại). */
  consentLevel: ConsentLevel;
  customData?: Record<string, string> | null;
}

/**
 * MẶC ĐỊNH AN TOÀN: chưa đủ đồng ý ⇒ không hiện. Thiếu "basic" → chỉ còn id + tên (+ nhãn khoá). Thiếu "extended" → bỏ nhóm mở rộng.
 * Mọi nơi trả hồ sơ cho giao diện / API / xuất tệp PHẢI đi qua hàm này.
 */
export function maskProfile(row: ProfileRow, state: ConsentState): ProfileView {
  if (!state.ok.basic) return { id: row.id, name: row.name, consentLevel: "locked" };
  const { customData, birthDate, address, phone, phoneExtra, email, emailExtra, startDate, subjects, notes, ...basic } = row;
  if (!state.ok.extended) return { ...basic, consentLevel: "basic_only" };
  return {
    ...basic, birthDate, address, phone, phoneExtra, email, emailExtra, startDate, subjects, notes,
    customData: customData && typeof customData === "object" && !Array.isArray(customData) ? (customData as Record<string, string>) : null,
    consentLevel: "full",
  };
}

/** Ai đứng tên thanh toán (HS-11), dùng cho chữ hiển thị. */
export const profileKind = (g: string): "child" | "adult" => (g === "16plus" ? "adult" : "child");

/** So hai hồ sơ → tên các trường thật sự đổi (nhật ký sửa chỉ ghi TÊN trường, không ghi giá trị). */
export function changedFields(before: Record<string, unknown>, data: ProfileData): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(data)) {
    const a = before[k];
    if (JSON.stringify(a ?? null) !== JSON.stringify(v ?? null)) out.push(k);
  }
  return out;
}

/** Tên trường → nhãn tiếng Việt cho nhật ký sửa. */
export const FIELD_LABEL: Record<string, string> = {
  name: "Tên", ageGroup: "Nhóm tuổi", status: "Trạng thái", courseId: "Lớp", familyId: "Gia đình", guardianName: "Tên phụ huynh", guardianPhone: "SĐT phụ huynh",
  birthDate: "Ngày sinh", address: "Địa chỉ", phone: "SĐT của em", phoneExtra: "SĐT thứ ba", email: "Email", emailExtra: "Email bổ sung",
  startDate: "Ngày bắt đầu", subjects: "Môn học", notes: "Ghi chú", customData: "Trường tuỳ chỉnh",
};
