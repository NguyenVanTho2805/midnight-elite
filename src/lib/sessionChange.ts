// Gia sư dời / huỷ một buổi (hoàn thiện NV-189: dòng gợi ý loại 4 "buổi gia sư dời/huỷ"). THUẦN (không Prisma, không đọc đồng hồ).
//
// Định danh một buổi = (scheduleId, ngày GỐC theo lịch tuần). Dời vẫn giữ định danh gốc nên báo nghỉ / nhắc lịch của buổi đó
// không bị mồ côi; thời điểm HIỆU LỰC (nơi buổi thật sự diễn ra) lấy từ newDateKey / newStartTime / newEndTime.
//   cancel — buổi huỷ: nằm ở ngày gốc, đánh dấu "đã huỷ"; không nhắc lịch, phụ huynh không báo nghỉ được nữa
//   move   — buổi dời: hiện ở ngày/giờ mới, kèm "dời từ …"
// KHÔNG đụng tiền (học phí vẫn tính theo số buổi gia sư nhập; nối "không tính phí" vào phiếu là GD-25, chưa làm).
import {
  addDaysKey, dayOfWeekOfKey, expandOccurrences, hmOf, instantOf, isValidDateKey, normalizeHm, parseHm, tutorTitle,
  vnDateKeyOf, vnMinutesOfDay, type Occurrence, type ScheduleRule,
} from "@/lib/classSessions";

export const CHANGE_REASON_MAX = 300;
export const MOVE_MAX_DAYS_AHEAD = 60;
export const DEFAULT_SESSION_MINUTES = 60;

export type ChangeKind = "cancel" | "move";
export interface SessionChange {
  id?: string;
  scheduleId: string;
  courseId?: string;
  /** Ngày GỐC theo lịch tuần (định danh buổi). */
  dateKey: string;
  kind: ChangeKind;
  newDateKey: string | null;
  newStartTime: string | null;
  newEndTime: string | null;
  reason: string | null;
  zaloOpenedAt?: Date | null;
}

export interface EffectiveOccurrence extends Occurrence {
  /** Ngày GỐC = định danh buổi (khoá của báo nghỉ, nhắc lịch). `dateKey` (kế thừa) là ngày HIỆU LỰC sau khi dời. */
  originalDateKey: string;
  status: "scheduled" | "cancelled" | "moved";
  movedFrom: { dateKey: string; startAt: Date; endAt: Date } | null;
  change: SessionChange | null;
}

const WEEKDAY = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
const ddmm = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}`;
const sessionKey = (scheduleId: string, dateKey: string) => `${scheduleId}|${dateKey}`;

type RuleTimes = Pick<ScheduleRule, "dayOfWeek" | "startTime" | "endTime">;

/** Giờ bắt đầu / kết thúc theo lịch tuần của một ngày; giờ bắt đầu sai định dạng → null. */
function baseSlot(rule: RuleTimes, dateKey: string): { startAt: Date; endAt: Date } | null {
  const s = parseHm(rule.startTime);
  if (s === null) return null;
  const e = parseHm(rule.endTime);
  return { startAt: instantOf(dateKey, s), endAt: instantOf(dateKey, e !== null && e > s ? e : s) };
}

/** Buổi hiệu lực của (rule, ngày gốc) sau khi áp dụng thay đổi (nếu có). null nếu dữ liệu giờ hỏng. */
export function effectiveSlot(rule: RuleTimes, dateKey: string, change: SessionChange | null): Omit<EffectiveOccurrence, "scheduleId" | "courseId" | "change"> | null {
  const base = baseSlot(rule, dateKey);
  if (!base) return null;
  if (change?.kind === "move" && change.newDateKey && isValidDateKey(change.newDateKey)) {
    const s = parseHm(change.newStartTime);
    if (s !== null) {
      const e = parseHm(change.newEndTime);
      const origLen = Math.max(0, Math.round((base.endAt.getTime() - base.startAt.getTime()) / 60000));
      const end = e !== null && e > s ? e : Math.min(24 * 60 - 1, s + (origLen > 0 ? origLen : DEFAULT_SESSION_MINUTES));
      return {
        dateKey: change.newDateKey, originalDateKey: dateKey,
        startAt: instantOf(change.newDateKey, s), endAt: instantOf(change.newDateKey, end),
        status: "moved", movedFrom: { dateKey, startAt: base.startAt, endAt: base.endAt },
      };
    }
  }
  return {
    dateKey, originalDateKey: dateKey, startAt: base.startAt, endAt: base.endAt,
    status: change?.kind === "cancel" ? "cancelled" : "scheduled", movedFrom: null,
  };
}

/**
 * Các buổi hiệu lực rơi trong [fromKey, toKey] (theo ngày HIỆU LỰC, gồm cả hai đầu), sắp theo giờ bắt đầu.
 *  • buổi huỷ: ở ngày gốc, status "cancelled"
 *  • buổi dời: ở ngày mới, status "moved" — kể cả khi ngày gốc nằm NGOÀI cửa sổ
 *  • buổi dời đi khỏi cửa sổ: không xuất hiện ở cửa sổ đó
 */
export function applyChanges(rules: ScheduleRule[], changes: SessionChange[], fromKey: string, toKey: string): EffectiveOccurrence[] {
  const changeOf = new Map(changes.map(c => [sessionKey(c.scheduleId, c.dateKey), c]));
  const ruleById = new Map(rules.map(r => [r.id, r]));
  const base = expandOccurrences(rules, fromKey, toKey);
  const seen = new Set(base.map(o => sessionKey(o.scheduleId, o.dateKey)));

  // Buổi gốc ngoài cửa sổ nhưng được dời VÀO cửa sổ: dựng thêm từ khung giờ.
  const synthetic: { scheduleId: string; courseId: string; dateKey: string }[] = [];
  for (const c of changes) {
    if (c.kind !== "move" || !c.newDateKey || c.newDateKey < fromKey || c.newDateKey > toKey) continue;
    if (seen.has(sessionKey(c.scheduleId, c.dateKey))) continue;
    const r = ruleById.get(c.scheduleId);
    if (!r || r.active === false || !isValidDateKey(c.dateKey) || dayOfWeekOfKey(c.dateKey) !== r.dayOfWeek) continue;
    synthetic.push({ scheduleId: r.id, courseId: r.courseId, dateKey: c.dateKey });
  }

  const out: EffectiveOccurrence[] = [];
  for (const o of [...base.map(b => ({ scheduleId: b.scheduleId, courseId: b.courseId, dateKey: b.dateKey })), ...synthetic]) {
    const rule = ruleById.get(o.scheduleId);
    if (!rule) continue;
    const change = changeOf.get(sessionKey(o.scheduleId, o.dateKey)) ?? null;
    const slot = effectiveSlot(rule, o.dateKey, change);
    if (!slot) continue;
    if (slot.dateKey < fromKey || slot.dateKey > toKey) continue;
    out.push({ ...slot, scheduleId: o.scheduleId, courseId: o.courseId, change });
  }
  return out.sort((a, b) => a.startAt.getTime() - b.startAt.getTime() || a.scheduleId.localeCompare(b.scheduleId));
}

// ── Kiểm dữ liệu gia sư gửi lên ─────────────────────────────────────────────────

export interface ChangeContext {
  rule: RuleTimes;
  /** Ngày GỐC của buổi cần đổi. */
  dateKey: string;
  now: Date;
}
export interface ParsedChange {
  kind: ChangeKind;
  newDateKey: string | null;
  newStartTime: string | null;
  newEndTime: string | null;
  reason: string | null;
}
export type ChangeParse = { ok: true; value: ParsedChange } | { ok: false; error: string };

/**
 * Nghiêm: sai là từ chối cả yêu cầu. Chỉ đổi được buổi CHƯA bắt đầu; dời phải sang thời điểm ở tương lai (tối đa 60 ngày);
 * không dời sang một ngày mà khung giờ này đã có buổi theo lịch tuần (trừ chính ngày gốc: đổi giờ trong ngày).
 */
export function parseChangeInput(body: unknown, ctx: ChangeContext): ChangeParse {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return { ok: false, error: "Dữ liệu không hợp lệ" };
  const b = body as Record<string, unknown>;
  if (!isValidDateKey(ctx.dateKey)) return { ok: false, error: "Ngày buổi học không hợp lệ" };
  if (dayOfWeekOfKey(ctx.dateKey) !== ctx.rule.dayOfWeek) return { ok: false, error: "Ngày này không có buổi học theo lịch của lớp" };
  const orig = baseSlot(ctx.rule, ctx.dateKey);
  if (!orig) return { ok: false, error: "Giờ học của khung này chưa đặt đúng, hãy sửa ở tab Lịch học trước" };
  if (orig.startAt.getTime() <= ctx.now.getTime()) return { ok: false, error: "Buổi này đã bắt đầu hoặc đã qua, không đổi được nữa" };

  if (b.kind !== "cancel" && b.kind !== "move") return { ok: false, error: "kind phải là cancel hoặc move" };
  if (b.reason !== undefined && b.reason !== null && typeof b.reason !== "string") return { ok: false, error: "Lý do phải là chữ" };
  const reason = typeof b.reason === "string" ? b.reason.replace(/\s+/g, " ").trim() : "";
  if (reason.length > CHANGE_REASON_MAX) return { ok: false, error: `Lý do tối đa ${CHANGE_REASON_MAX} ký tự` };

  if (b.kind === "cancel") return { ok: true, value: { kind: "cancel", newDateKey: null, newStartTime: null, newEndTime: null, reason: reason || null } };

  if (typeof b.newDateKey !== "string" || !isValidDateKey(b.newDateKey)) return { ok: false, error: "Ngày mới không hợp lệ (YYYY-MM-DD)" };
  const newStart = normalizeHm(b.newStartTime);
  if (newStart === null) return { ok: false, error: "Giờ bắt đầu mới không hợp lệ (HH:mm)" };
  const s = parseHm(newStart)!;
  let e: number;
  if (b.newEndTime === undefined || b.newEndTime === null || b.newEndTime === "") {
    const origLen = Math.max(0, Math.round((orig.endAt.getTime() - orig.startAt.getTime()) / 60000));
    e = s + (origLen > 0 ? origLen : DEFAULT_SESSION_MINUTES);
    if (e > 24 * 60 - 1) return { ok: false, error: "Buổi dời kết thúc sau 24:00 — hãy chọn giờ bắt đầu sớm hơn hoặc nhập giờ kết thúc" };
  } else {
    const n = normalizeHm(b.newEndTime);
    if (n === null) return { ok: false, error: "Giờ kết thúc mới không hợp lệ (HH:mm)" };
    e = parseHm(n)!;
    if (e <= s) return { ok: false, error: "Giờ kết thúc phải sau giờ bắt đầu" };
  }
  const newStartAt = instantOf(b.newDateKey, s);
  if (newStartAt.getTime() <= ctx.now.getTime()) return { ok: false, error: "Thời điểm mới phải ở tương lai" };
  if (b.newDateKey > addDaysKey(vnDateKeyOf(ctx.now), MOVE_MAX_DAYS_AHEAD)) return { ok: false, error: `Chỉ dời tới tối đa ${MOVE_MAX_DAYS_AHEAD} ngày nữa` };
  const sameDay = b.newDateKey === ctx.dateKey;
  if (!sameDay && dayOfWeekOfKey(b.newDateKey) === ctx.rule.dayOfWeek) return { ok: false, error: `Ngày ${ddmm(b.newDateKey)} đã là ngày học theo lịch tuần của khung giờ này — hãy chọn ngày khác` };
  const sameTime = sameDay && newStart === hmOf(vnMinutesOfDay(orig.startAt)) && e === vnMinutesOfDay(orig.endAt);
  if (sameTime) return { ok: false, error: "Ngày và giờ mới trùng với lịch hiện tại — chưa có gì để đổi" };
  return { ok: true, value: { kind: "move", newDateKey: b.newDateKey, newStartTime: newStart, newEndTime: hmOf(e), reason: reason || null } };
}

// ── Văn bản ──────────────────────────────────────────────────────────────────────

const weekdayOf = (k: string) => { const w = WEEKDAY[dayOfWeekOfKey(k)]; return w.charAt(0).toLowerCase() + w.slice(1); };
const when = (t: Date) => `${hmOf(vnMinutesOfDay(t))} ${weekdayOf(vnDateKeyOf(t))} ${ddmm(vnDateKeyOf(t))}`;

/**
 * Tin báo đổi lịch CHUNG cho cả lớp (dùng được cho nhóm Zalo lẫn gửi riêng): không tên em, không điểm, không số tiền, không link.
 * Gia sư vẫn sửa được trước khi gửi.
 */
export function sessionChangeMessage(i: {
  kind: ChangeKind; subject: string; originalStartAt: Date; newStartAt?: Date | null; reason?: string | null; tutorName?: string | null;
}): string {
  const reason = i.reason?.trim() ? ` Lý do: ${i.reason.trim().replace(/[.。]+$/, "")}.` : "";
  const sign = tutorTitle(i.tutorName) ? `\n${tutorTitle(i.tutorName)}` : "";
  if (i.kind === "cancel") {
    return `KiN báo lịch: buổi ${i.subject} lúc ${when(i.originalStartAt)} được HUỶ.${reason}\nNếu có lịch học bù, gia sư sẽ báo thêm.${sign}`;
  }
  const to = i.newStartAt ? when(i.newStartAt) : "(chưa rõ)";
  return `KiN báo lịch: buổi ${i.subject} lúc ${when(i.originalStartAt)} được DỜI sang ${to}.${reason}\nAnh/chị và các em lưu ý giúp.${sign}`;
}

/** Tin báo buổi đã đổi được khôi phục về lịch tuần (chung cho cả lớp, giống sessionChangeMessage). */
export function sessionRestoredMessage(i: { subject: string; originalStartAt: Date; tutorName?: string | null }): string {
  const sign = tutorTitle(i.tutorName) ? `\n${tutorTitle(i.tutorName)}` : "";
  return `KiN báo lịch: buổi ${i.subject} lúc ${when(i.originalStartAt)} GIỮ NGUYÊN lịch như cũ, không dời hay huỷ nữa.${sign}`;
}

/** "19:00 thứ ba 14/10" — cách ghi thời điểm trong các tin báo đổi lịch. */
export const whenText = when;

/** Một dòng ngắn mô tả thay đổi, dùng cho thông báo trong ứng dụng. */
export function describeChange(i: { kind: ChangeKind; originalStartAt: Date; newStartAt?: Date | null }): string {
  return i.kind === "cancel"
    ? `buổi ${when(i.originalStartAt)} được huỷ`
    : `buổi ${when(i.originalStartAt)} dời sang ${i.newStartAt ? when(i.newStartAt) : "giờ khác"}`;
}

/** Chuyển các thay đổi trong một tháng thành đầu vào của dòng gợi ý loại 4 trong báo cáo tháng (theo NGÀY GỐC của buổi). */
export function changesToTutorChanged(changes: { dateKey: string; kind: string; courseName: string }[]): { dateKey: string; courseName: string; action: "doi" | "huy" }[] {
  return [...changes]
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.courseName.localeCompare(b.courseName, "vi"))
    .map(c => ({ dateKey: c.dateKey, courseName: c.courseName, action: c.kind === "cancel" ? "huy" as const : "doi" as const }));
}
