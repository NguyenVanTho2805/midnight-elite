// TT-203 + TK-167 — lựa chọn giao diện LƯU THEO TÀI KHOẢN (User.preferences, JSON).
// Thuần (không Prisma) để test. Đọc thì khoan dung (bỏ khoá lạ/giá trị hỏng, không
// bao giờ ném lỗi làm hỏng trang), ghi thì nghiêm (khoá lạ hay sai kiểu → từ chối).
import { KIN_THEMES, KIN_MODES, type KinTheme, type KinMode } from "@/lib/kinTheme";
import { parseRail, type RailState } from "@/lib/railState";
import { readTeaching, type TutorTeaching } from "@/lib/tutorArea";
import { readPushPrefs, type PushTypes } from "@/lib/pushRules";
import { readProfilePrefs, type TutorProfilePrefs } from "@/lib/tutorVisibility";
import { patchCalendarPrefs, readCalendarPrefs, type CalendarPrefs } from "@/lib/sessionBook";

/** Module gia sư bật/tắt được. Lịch và Học phí luôn bật nên không nằm ở đây. */
export const OPTIONAL_TUTOR_MODULES = ["hop-viec", "lop", "bai-kt", "thu-vien"] as const;
export type OptionalTutorModule = (typeof OPTIONAL_TUTOR_MODULES)[number];

export interface TutorModuleDef {
  key: OptionalTutorModule | "lich" | "hoc-phi";
  label: string;
  href: string;
  /** Luôn bật, không tắt được (TT-203). */
  always: boolean;
  /** Mô tả ngắn ở trang Cài đặt → Module hiển thị. */
  hint: string;
}

/** Thứ tự thanh module của gia sư theo bo-cuc-outlook.md mục 3. */
export const TUTOR_MODULES: readonly TutorModuleDef[] = [
  { key: "hop-viec", label: "Hộp việc",  href: "/lop-cua-toi",                          always: false, hint: "Việc cần xử lý: đối soát, báo cáo, bài chưa chấm…" },
  { key: "lich",     label: "Lịch",      href: "/lop-cua-toi/lich",                     always: true,  hint: "Lịch tuần, nhắc lịch, báo nghỉ sát giờ" },
  { key: "lop",      label: "Lớp",       href: "/lop-cua-toi/lop",                      always: false, hint: "Danh sách lớp, học viên, mã mời" },
  { key: "bai-kt",   label: "Bài tập",   href: "/lop-cua-toi/bai-tap",                  always: false, hint: "Bài tập, đề thi và bài kiểm tra" },
  { key: "thu-vien", label: "Thư viện",  href: "/thu-vien",                             always: false, hint: "Bản ghi và tài liệu của các lớp bạn dạy" },
  { key: "hoc-phi",  label: "Học phí",   href: "/lop-cua-toi/hoc-phi",                  always: true,  hint: "Phiếu học phí và đối soát chuyển khoản" },
];

export interface UserPreferences {
  /** Module gia sư bật thêm. Vắng mặt = chưa chọn = chế độ gọn (chỉ Lịch + Học phí). */
  modules?: OptionalTutorModule[];
  theme?: KinTheme;
  mode?: KinMode;
  /** Thanh bên trái: "thu" = thụt vào, "mo" = hiện. Vắng mặt = hiện (mặc định). Lưu theo tài khoản, máy khác lấy về khi đăng nhập. */
  rail?: RailState;
  /** Gia sư tắt/bật tin nhắc lịch từng bên. Vắng mặt = bật cả hai. */
  reminders?: { parent: boolean; student: boolean };
  /** PH-215 Kết nối: `showZalo` hiện số Zalo trên hồ sơ công khai (TẮT sẵn vì zalo.me/<số> để lộ số); `messenger` là tên trang m.me. */
  connections?: { showZalo?: boolean; messenger?: string; groups?: string[] };
  /**
   * ĐX-06: khu vực / hình thức / trường + bằng cấp / giá tham khảo của gia sư (tự khai). CHỈ ghi được qua PUT /api/users/me/tutor-profile
   * (có kiểm dữ liệu riêng), KHÔNG qua API giao diện này: `applyPreferencesPatch` từ chối khoá "teaching" nhưng GIỮ nguyên giá trị đang có,
   * nên đổi chủ đề hay module không làm mất khu vực đã khai.
   */
  teaching?: TutorTeaching;
  /**
   * ĐX-02: công tắc từng LOẠI thông báo đẩy của gia sư (vắng = dùng mặc định của loại đó). Như `teaching`, chỉ ghi qua API riêng
   * (PUT /api/push/settings, có kiểm dữ liệu và khoá giao dịch `prefsLockKey`); API giao diện từ chối khoá "push" nhưng giữ nguyên giá trị đang có.
   * Danh sách thiết bị đã bật nằm ở bảng push_subscriptions, không nằm ở đây.
   */
  push?: { types: Partial<PushTypes> };
  /**
   * NC2-022: công tắc Hiện / Ẩn hồ sơ công khai (`profile.hidden`). Vắng = HIỆN. Như `teaching`, chỉ ghi qua PUT /api/users/me/tutor-profile
   * (khoá giao dịch `prefsLockKey`); API giao diện từ chối khoá "profile" nhưng giữ nguyên giá trị đang có.
   */
  profile?: TutorProfilePrefs;
  /** LI-03: bộ lọc hiển thị Lịch dạy — ẩn buổi đã huỷ, và lớp đang lọc (vắng = tất cả lớp, hiện cả buổi huỷ). */
  calendar?: CalendarPrefs;
}

/** Khoá khoá-giao-dịch quanh đọc-sửa-ghi `User.preferences` (dùng chung API giao diện và API hồ sơ gia sư, để hai nơi không ghi đè nhau). */
export const prefsLockKey = (userId: string) => `prefs:${userId}`;

export const MAX_GROUPS = 20;
export const GROUP_NAME_MAX = 60;
/** Tên nhóm Facebook gia sư hay đăng: bỏ trùng không phân biệt hoa thường, bỏ rỗng, tối đa 20 nhóm × 60 ký tự. */
export function normalizeGroupNames(raw: unknown): string[] | null {
  if (!Array.isArray(raw) || raw.some(x => typeof x !== "string")) return null;
  const seen = new Set<string>(), out: string[] = [];
  for (const x of raw as string[]) {
    const n = x.replace(/\s+/g, " ").trim();
    if (!n) continue;
    if (n.length > GROUP_NAME_MAX) return null;
    const k = n.toLocaleLowerCase("vi");
    if (seen.has(k)) continue;
    seen.add(k); out.push(n);
  }
  return out.length <= MAX_GROUPS ? out : null;
}

/** Tên trang Messenger (m.me/<tên>): chữ, số, chấm, gạch dưới, gạch ngang; 1–64 ký tự. Nhận cả dán nguyên link m.me. */
export function normalizeMessengerHandle(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let s = raw.trim();
  const url = /^https?:\/\/(www\.)?(m\.me|messenger\.com\/t)\//i;
  // Dán nguyên link thì bỏ phần đường dẫn/tham số phía sau; gõ tay thì giữ nguyên để "a/b" bị từ chối chứ không bị cắt âm thầm.
  if (url.test(s)) s = s.replace(url, "").replace(/[/?#].*$/, "");
  return /^[A-Za-z0-9._-]{1,64}$/.test(s) ? s : null;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const inList = <T extends string>(list: readonly T[], v: unknown): v is T => typeof v === "string" && (list as readonly string[]).includes(v);

function canonicalModules(arr: unknown[]): OptionalTutorModule[] {
  const set = new Set(arr.filter((x): x is OptionalTutorModule => inList(OPTIONAL_TUTOR_MODULES, x)));
  return OPTIONAL_TUTOR_MODULES.filter(m => set.has(m)); // thứ tự cố định, không trùng
}

/** Đọc giá trị trong DB. Hỏng/khoá lạ thì bỏ qua từng phần. */
export function readPreferences(raw: unknown): UserPreferences {
  if (!isObj(raw)) return {};
  const out: UserPreferences = {};
  if (Array.isArray(raw.modules)) out.modules = canonicalModules(raw.modules);
  if (inList(KIN_THEMES, raw.theme)) out.theme = raw.theme;
  if (inList(KIN_MODES, raw.mode)) out.mode = raw.mode;
  const rail = parseRail(raw.rail);
  if (rail) out.rail = rail;
  if (isObj(raw.reminders)) {
    out.reminders = {
      parent: typeof raw.reminders.parent === "boolean" ? raw.reminders.parent : true,
      student: typeof raw.reminders.student === "boolean" ? raw.reminders.student : true,
    };
  }
  if (isObj(raw.connections)) {
    const c: NonNullable<UserPreferences["connections"]> = {};
    if (typeof raw.connections.showZalo === "boolean") c.showZalo = raw.connections.showZalo;
    const m = normalizeMessengerHandle(raw.connections.messenger);
    if (m) c.messenger = m;
    const gs = normalizeGroupNames(raw.connections.groups);
    if (gs && gs.length) c.groups = gs;
    if (Object.keys(c).length) out.connections = c;
  }
  const teaching = readTeaching(raw.teaching);
  if (teaching) out.teaching = teaching;
  const push = readPushPrefs(raw.push);
  if (push) out.push = push;
  const profile = readProfilePrefs(raw.profile);
  if (profile) out.profile = profile;
  if (isObj(raw.calendar)) { const c = readCalendarPrefs(raw.calendar); if (c.hideCancelled || c.courseId) out.calendar = c; }
  return out;
}

export type PatchResult = { ok: true; value: UserPreferences } | { ok: false; error: string };

/**
 * Gộp một bản vá từ client vào giá trị hiện có. Mỗi khoá trong bản vá thay thế khoá cũ;
 * `null` xoá khoá về mặc định. Khoá lạ hoặc sai kiểu → từ chối cả bản vá (không ghi dở).
 * "lich"/"hoc-phi" trong `modules` được bỏ qua (luôn bật), module lạ thì từ chối.
 */
export function applyPreferencesPatch(current: UserPreferences, patch: unknown): PatchResult {
  if (!isObj(patch)) return { ok: false, error: "Dữ liệu không hợp lệ" };
  const next: UserPreferences = { ...current };
  for (const [k, v] of Object.entries(patch)) {
    switch (k) {
      case "modules": {
        if (v === null) { delete next.modules; break; }
        if (!Array.isArray(v) || v.length > 20) return { ok: false, error: "modules phải là danh sách" };
        const bad = v.find(x => typeof x !== "string" || (!inList(OPTIONAL_TUTOR_MODULES, x) && x !== "lich" && x !== "hoc-phi"));
        if (bad !== undefined) return { ok: false, error: `Module không tồn tại: ${String(bad).slice(0, 40)}` };
        next.modules = canonicalModules(v);
        break;
      }
      case "theme":
        if (v === null) { delete next.theme; break; }
        if (!inList(KIN_THEMES, v)) return { ok: false, error: "Chủ đề không hợp lệ" };
        next.theme = v; break;
      case "mode":
        if (v === null) { delete next.mode; break; }
        if (!inList(KIN_MODES, v)) return { ok: false, error: "Chế độ sáng/tối không hợp lệ" };
        next.mode = v; break;
      case "rail": {
        if (v === null) { delete next.rail; break; }
        const r = parseRail(v);
        if (!r) return { ok: false, error: "Thanh bên chỉ nhận 'mo', 'rong' hoặc 'thu'" };
        next.rail = r; break;
      }
      case "reminders": {
        if (v === null) { delete next.reminders; break; }
        if (!isObj(v)) return { ok: false, error: "reminders không hợp lệ" };
        const base = next.reminders ?? { parent: true, student: true };
        const r = { ...base };
        for (const [rk, rv] of Object.entries(v)) {
          if ((rk !== "parent" && rk !== "student") || typeof rv !== "boolean") return { ok: false, error: "reminders chỉ nhận parent/student kiểu đúng-sai" };
          r[rk] = rv;
        }
        next.reminders = r; break;
      }
      case "connections": {
        if (v === null) { delete next.connections; break; }
        if (!isObj(v)) return { ok: false, error: "connections không hợp lệ" };
        const c = { ...(next.connections ?? {}) };
        for (const [ck, cv] of Object.entries(v)) {
          if (ck === "showZalo") {
            if (cv === null) { delete c.showZalo; continue; }
            if (typeof cv !== "boolean") return { ok: false, error: "showZalo phải là đúng-sai" };
            c.showZalo = cv;
          } else if (ck === "messenger") {
            if (cv === null || cv === "") { delete c.messenger; continue; }
            const h = normalizeMessengerHandle(cv);
            if (!h) return { ok: false, error: "Tên trang Messenger chỉ gồm chữ, số, dấu chấm, gạch dưới, gạch ngang (tối đa 64 ký tự)" };
            c.messenger = h;
          } else if (ck === "groups") {
            if (cv === null) { delete c.groups; continue; }
            const gs = normalizeGroupNames(cv);
            if (!gs) return { ok: false, error: `Danh sách nhóm: tối đa ${MAX_GROUPS} nhóm, mỗi tên tối đa ${GROUP_NAME_MAX} ký tự` };
            if (gs.length) c.groups = gs; else delete c.groups;
          } else return { ok: false, error: `connections không có "${ck.slice(0, 40)}"` };
        }
        if (Object.keys(c).length) next.connections = c; else delete next.connections;
        break;
      }
      case "calendar": {
        if (v === null) { delete next.calendar; break; }
        const c = patchCalendarPrefs(next.calendar ?? { hideCancelled: false, courseId: null }, v);
        if (!c.ok) return c;
        if (c.value.hideCancelled || c.value.courseId) next.calendar = c.value; else delete next.calendar;
        break;
      }
      default:
        return { ok: false, error: `Không có tuỳ chọn "${k.slice(0, 40)}"` };
    }
  }
  return { ok: true, value: next };
}

/** Module hiển thị ở thanh bên của gia sư: luôn có Lịch + Học phí, thêm phần đã bật. */
export function visibleTutorModules(prefs: UserPreferences): TutorModuleDef[] {
  const on = new Set<string>(prefs.modules ?? []);
  return TUTOR_MODULES.filter(m => m.always || on.has(m.key));
}

export function isTutorModuleVisible(prefs: UserPreferences, key: TutorModuleDef["key"]): boolean {
  return visibleTutorModules(prefs).some(m => m.key === key);
}

export function reminderChannels(prefs: UserPreferences): { parent: boolean; student: boolean } {
  return { parent: prefs.reminders?.parent ?? true, student: prefs.reminders?.student ?? true };
}
