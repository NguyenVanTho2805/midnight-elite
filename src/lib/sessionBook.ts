// BU-01..BU-07, LI-10, LI-11, LI-16, LI-17, DD-03 — quy tắc THUẦN của "trang buổi học" (không Prisma, không đọc đồng hồ ngầm).
// Test: tools/local-e2e/t-session-book-lib.ts. Phần chạm DB ở sessionBookServer.ts.
//
// BẤT BIẾN TIỀN: chốt buổi / mở lại buổi chỉ ghi TRẠNG THÁI của buổi (state/closedAt). Không hàm nào ở đây sinh, sửa hay xoá dòng học phí;
// học phí vẫn do đường điểm danh sẵn có (PUT /api/attendance-sessions/[id] → syncSessionCharges) quyết định, theo trạng thái điểm danh từng em.
import { addDaysKey, hmOf, isValidDateKey, normalizeJoinUrl, parseHm, vnDateKeyOf } from "@/lib/classSessions";

// ── Hình thức, loại buổi ─────────────────────────────────────────────────────────
export const SESSION_MODES = ["online", "offline"] as const;
export type SessionMode = (typeof SESSION_MODES)[number];
export const MODE_LABEL: Record<SessionMode, string> = { online: "Online", offline: "Offline" };
export const isSessionMode = (v: unknown): v is SessionMode => typeof v === "string" && (SESSION_MODES as readonly string[]).includes(v);

export const SESSION_KINDS = ["regular", "extra", "makeup", "adhoc"] as const;
export type SessionKind = (typeof SESSION_KINDS)[number];
export const KIND_LABEL: Record<SessionKind, string> = { regular: "Theo lịch tuần", extra: "Buổi lẻ", makeup: "Dạy bù", adhoc: "Phát sinh" };
export const isSessionKind = (v: unknown): v is SessionKind => typeof v === "string" && (SESSION_KINDS as readonly string[]).includes(v);
/** Loại buổi có giờ riêng và hiện trên Lịch dù không có khung giờ tuần. */
export const isOffScheduleKind = (k: unknown): k is Exclude<SessionKind, "regular"> => k === "extra" || k === "makeup" || k === "adhoc";

// ── Ghi chép 3 phần (BU-04) + hình thức (LI-16) + link riêng buổi (LI-17) ─────────
export const NOTE_MAX = 2000;
export const LOCATION_MAX = 300;
export interface SessionPatch {
  taught?: string | null; homework?: string | null; summary?: string | null;
  mode?: SessionMode | null; location?: string | null; joinUrl?: string | null;
}
const NOTE_LABEL = { taught: "Nội dung đã dạy", homework: "Bài tập về nhà", summary: "Nhận xét chung" } as const;

/** Nghiêm: một trường sai là từ chối cả yêu cầu. Trường vắng mặt = giữ nguyên; chuỗi rỗng / null = xoá. */
export function parseSessionPatch(body: unknown): { ok: true; value: SessionPatch } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return { ok: false, error: "Dữ liệu không hợp lệ" };
  const b = body as Record<string, unknown>;
  const out: SessionPatch = {};
  for (const k of ["taught", "homework", "summary"] as const) {
    if (!(k in b)) continue;
    const v = b[k];
    if (v === null || v === undefined) { out[k] = null; continue; }
    if (typeof v !== "string") return { ok: false, error: `${NOTE_LABEL[k]} phải là chữ` };
    const t = v.replace(/\r\n/g, "\n").trim();
    if (t.length > NOTE_MAX) return { ok: false, error: `${NOTE_LABEL[k]} tối đa ${NOTE_MAX} ký tự` };
    out[k] = t === "" ? null : t;
  }
  if ("mode" in b) {
    if (b.mode === null || b.mode === "") out.mode = null;
    else if (isSessionMode(b.mode)) out.mode = b.mode;
    else return { ok: false, error: "Hình thức phải là Online hoặc Offline" };
  }
  if ("location" in b) {
    if (b.location === null || b.location === undefined) out.location = null;
    else if (typeof b.location !== "string") return { ok: false, error: "Địa chỉ phải là chữ" };
    else {
      const t = b.location.replace(/\s+/g, " ").trim();
      if (t.length > LOCATION_MAX) return { ok: false, error: `Địa chỉ tối đa ${LOCATION_MAX} ký tự` };
      out.location = t === "" ? null : t;
    }
  }
  if ("joinUrl" in b) {
    const j = normalizeJoinUrl(b.joinUrl);
    if (!j.ok) return { ok: false, error: "Link vào lớp phải là địa chỉ http(s) hợp lệ" };
    out.joinUrl = j.value;
  }
  return { ok: true, value: out };
}

// ── LI-17: ba cách đặt link online, ưu tiên riêng buổi > theo khung giờ > chung lớp ─
export type JoinSource = "session" | "schedule" | "class";
export const JOIN_SOURCE_LABEL: Record<JoinSource, string> = { session: "link riêng buổi này", schedule: "link của khung giờ", class: "link chung của lớp" };
export function resolveJoinUrl(i: { sessionUrl?: string | null; scheduleUrl?: string | null; classUrl?: string | null }): { url: string; source: JoinSource } | null {
  const t = (v: string | null | undefined) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const s = t(i.sessionUrl), sc = t(i.scheduleUrl), c = t(i.classUrl);
  if (s) return { url: s, source: "session" };
  if (sc) return { url: sc, source: "schedule" };
  if (c) return { url: c, source: "class" };
  return null;
}

/** LI-16: hình thức hiệu lực — riêng buổi thắng khung giờ. null = chưa chọn (hiểu như cũ, không hiện nhãn). */
export function effectiveMode(i: { sessionMode?: string | null; scheduleMode?: string | null }): SessionMode | null {
  if (isSessionMode(i.sessionMode)) return i.sessionMode;
  if (isSessionMode(i.scheduleMode)) return i.scheduleMode;
  return null;
}
/** Địa chỉ chỉ có nghĩa khi học offline. */
export function effectiveLocation(i: { mode: SessionMode | null; sessionLocation?: string | null; scheduleLocation?: string | null }): string | null {
  if (i.mode !== "offline") return null;
  const t = (v: string | null | undefined) => (typeof v === "string" && v.trim() ? v.trim() : null);
  return t(i.sessionLocation) ?? t(i.scheduleLocation);
}

// ── Trạng thái buổi, chốt, mở lại (BU-02, BU-03) ────────────────────────────────
export type SessionState = "open" | "closed";
export const isClosed = (state: string | null | undefined) => state === "closed";

export interface StatusLabel { text: string; tone: "xong" | "cho" | "mo" | "loi" }
/** Chữ trạng thái luôn kèm chữ (không chỉ màu). `dateKey` là ngày VN của buổi. */
export function sessionStatusLabel(i: { dateKey: string; state: string | null | undefined; now: Date; cancelled?: boolean }): StatusLabel {
  if (i.cancelled) return { text: "Đã huỷ", tone: "mo" };
  if (isClosed(i.state)) return { text: "Đã dạy xong", tone: "xong" };
  const today = vnDateKeyOf(i.now);
  if (i.dateKey > today) return { text: "Sắp diễn ra", tone: "mo" };
  if (i.dateKey === today) return { text: "Hôm nay · chưa chốt", tone: "cho" };
  return { text: "Đã qua · chưa chốt", tone: "cho" };
}

export type CloseCheck = { ok: true; already: boolean } | { ok: false; error: string };
/** Chỉ chốt buổi đã tới ngày (ngày VN ≤ hôm nay). Chốt lần hai thì bỏ qua (không đổi thời điểm chốt). */
export function closeCheck(i: { dateKey: string; state: string | null | undefined; now: Date }): CloseCheck {
  if (!isValidDateKey(i.dateKey)) return { ok: false, error: "Ngày buổi học không hợp lệ" };
  if (i.dateKey > vnDateKeyOf(i.now)) return { ok: false, error: "Buổi này chưa tới ngày, chưa chốt được" };
  return { ok: true, already: isClosed(i.state) };
}

/**
 * BU-03: cảnh báo khi mở lại buổi đã chốt mà phiếu tháng đã lập. KHÔNG tự sửa phiếu — chỉ nói thật cho gia sư biết.
 * `invoicedCharges`: số dòng phí của buổi này đã vào phiếu (đóng băng). `invoices`: số phiếu (chưa huỷ) của các em trong lớp ở tháng của buổi.
 */
export function reopenWarning(i: { invoicedCharges: number; invoices: number; yearMonth: string }): string | null {
  if (i.invoicedCharges <= 0 && i.invoices <= 0) return null;
  const mm = `${i.yearMonth.slice(5, 7)}/${i.yearMonth.slice(0, 4)}`;
  const parts: string[] = [];
  if (i.invoicedCharges > 0) parts.push(`${i.invoicedCharges} dòng học phí của buổi này đã nằm trong phiếu`);
  if (i.invoices > 0) parts.push(`đã có ${i.invoices} phiếu tháng ${mm} của học sinh trong lớp`);
  return `Phiếu tháng ${mm} đã lập: ${parts.join("; ")}. Mở lại buổi KHÔNG tự sửa phiếu hay số tiền đã chốt; nếu cần chỉnh, bạn sửa ở trang Học phí.`;
}

// ── BU-07: nhận xét riêng từng em ───────────────────────────────────────────────
export const STUDENT_NOTE_MAX = 500;
export function cleanStudentNote(v: unknown): { ok: true; value: string | null } | { ok: false } {
  if (v === null || v === undefined) return { ok: true, value: null };
  if (typeof v !== "string") return { ok: false };
  const t = v.replace(/\s+/g, " ").trim();
  if (t.length > STUDENT_NOTE_MAX) return { ok: false };
  return { ok: true, value: t === "" ? null : t };
}

// ── DD-03: bộ đếm có mặt / vắng / có phép ───────────────────────────────────────
export interface AttendanceTally { present: number; late: number; excused: number; absent: number; none: number; total: number; dirty: number }
export function tallyAttendance(rows: ReadonlyArray<{ status: string | null; dirty?: boolean }>): AttendanceTally {
  const t: AttendanceTally = { present: 0, late: 0, excused: 0, absent: 0, none: 0, total: rows.length, dirty: 0 };
  for (const r of rows) {
    if (r.dirty) t.dirty++;
    if (r.status === "present") t.present++;
    else if (r.status === "late") t.late++;
    else if (r.status === "excused") t.excused++;
    else if (r.status === "absent") t.absent++;
    else t.none++;
  }
  return t;
}

// ── LI-10: kiểm xung đột lịch ───────────────────────────────────────────────────
export interface SlotLite { key: string; courseId: string; courseName: string; dateKey: string; startMin: number; endMin: number }
export type SlotWithStudents = SlotLite & { studentIds: readonly string[] };
export interface SlotConflict {
  /** "gia-su": gia sư đã có buổi khác cùng giờ. "hoc-sinh": có em học cả hai lớp (số em, KHÔNG trả tên). */
  kind: "gia-su" | "hoc-sinh";
  other: Pick<SlotLite, "key" | "courseId" | "courseName" | "dateKey" | "startMin" | "endMin">;
  sharedStudents: number;
}
/** Hai khoảng giờ chồng nhau (chạm đầu mút không tính). Khoảng rỗng/ngược được coi là 1 phút. */
export function slotsOverlap(a: Pick<SlotLite, "startMin" | "endMin">, b: Pick<SlotLite, "startMin" | "endMin">): boolean {
  const ae = Math.max(a.endMin, a.startMin + 1), be = Math.max(b.endMin, b.startMin + 1);
  return a.startMin < be && b.startMin < ae;
}
/** Xung đột của `cand` với các buổi `others` (đã lọc buổi huỷ). Bỏ qua buổi cùng `key` (chính buổi đang sửa). Một buổi khác cho tối đa một dòng "gia-su" và (nếu có em chung) một dòng "hoc-sinh". */
export function findSlotConflicts(cand: SlotWithStudents, others: ReadonlyArray<SlotWithStudents>): SlotConflict[] {
  const out: SlotConflict[] = [];
  const mine = new Set(cand.studentIds);
  for (const o of others) {
    if (o.key === cand.key || o.dateKey !== cand.dateKey || !slotsOverlap(cand, o)) continue;
    const other = { key: o.key, courseId: o.courseId, courseName: o.courseName, dateKey: o.dateKey, startMin: o.startMin, endMin: o.endMin };
    out.push({ kind: "gia-su", other, sharedStudents: 0 });
    const shared = o.studentIds.filter(id => mine.has(id)).length;
    if (shared > 0 && o.courseId !== cand.courseId) out.push({ kind: "hoc-sinh", other, sharedStudents: shared });
  }
  return out;
}
/** Chữ báo xung đột, ngắn, không tên em. */
export function conflictText(c: SlotConflict): string {
  const when = `${hmOf(c.other.startMin)}–${hmOf(Math.max(c.other.endMin, c.other.startMin))}`;
  return c.kind === "gia-su"
    ? `Trùng giờ với buổi ${c.other.courseName} (${when} ngày ${c.other.dateKey.slice(8, 10)}/${c.other.dateKey.slice(5, 7)})`
    : `${c.sharedStudents} học sinh cũng học lớp ${c.other.courseName} cùng giờ (${when})`;
}

// ── LI-11: thêm buổi nhanh ──────────────────────────────────────────────────────
export interface ExtraSessionInput { dateKey: string; startTime: string; endTime: string; kind: Exclude<SessionKind, "regular">; mode: SessionMode | null; location: string | null; joinUrl: string | null }
/** Buổi lẻ / dạy bù / phát sinh: ngày hợp lệ, giờ HH:mm và kết thúc sau bắt đầu, loại hợp lệ. Không giới hạn ngày quá khứ (nhập bù). Tối đa 366 ngày tới. */
export function parseExtraSession(body: unknown, now: Date): { ok: true; value: ExtraSessionInput } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return { ok: false, error: "Dữ liệu không hợp lệ" };
  const b = body as Record<string, unknown>;
  if (typeof b.dateKey !== "string" || !isValidDateKey(b.dateKey)) return { ok: false, error: "Ngày không hợp lệ (YYYY-MM-DD)" };
  if (b.dateKey > addDaysKey(vnDateKeyOf(now), 366)) return { ok: false, error: "Chỉ thêm buổi trong vòng 1 năm tới" };
  const s = typeof b.startTime === "string" ? parseHm(b.startTime) : null, e = typeof b.endTime === "string" ? parseHm(b.endTime) : null;
  if (s === null) return { ok: false, error: "Giờ bắt đầu phải có dạng HH:mm" };
  if (e === null) return { ok: false, error: "Giờ kết thúc phải có dạng HH:mm" };
  if (e <= s) return { ok: false, error: "Giờ kết thúc phải sau giờ bắt đầu" };
  if (!isSessionKind(b.kind) || b.kind === "regular") return { ok: false, error: "Loại buổi phải là buổi lẻ, dạy bù hoặc phát sinh" };
  const p = parseSessionPatch({ mode: b.mode ?? null, location: b.location ?? null, joinUrl: b.joinUrl ?? null });
  if (!p.ok) return p;
  return { ok: true, value: { dateKey: b.dateKey, startTime: hmOf(s), endTime: hmOf(e), kind: b.kind, mode: p.value.mode ?? null, location: p.value.location ?? null, joinUrl: p.value.joinUrl ?? null } };
}

// ── LI-03: bộ lọc hiển thị lịch (lưu ở User.preferences.calendar) ────────────────
export interface CalendarPrefs { hideCancelled: boolean; courseId: string | null }
export const CALENDAR_COURSE_ID_MAX = 100;
/** Đọc khoan dung: chỉ boolean `true` mới ẩn buổi huỷ; mã lớp phải là chữ ngắn, còn lại coi như "tất cả lớp". */
export function readCalendarPrefs(raw: unknown): CalendarPrefs {
  const o = typeof raw === "object" && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const c = typeof o.courseId === "string" && o.courseId.length > 0 && o.courseId.length <= CALENDAR_COURSE_ID_MAX ? o.courseId : null;
  return { hideCancelled: o.hideCancelled === true, courseId: c };
}
/** Ghi nghiêm: khoá lạ / sai kiểu → lỗi. `null` ở từng khoá = về mặc định. */
export function patchCalendarPrefs(cur: CalendarPrefs, patch: unknown): { ok: true; value: CalendarPrefs } | { ok: false; error: string } {
  if (typeof patch !== "object" || patch === null || Array.isArray(patch)) return { ok: false, error: "calendar không hợp lệ" };
  const next = { ...cur };
  for (const [k, v] of Object.entries(patch)) {
    if (k === "hideCancelled") {
      if (v === null) next.hideCancelled = false;
      else if (typeof v === "boolean") next.hideCancelled = v;
      else return { ok: false, error: "hideCancelled phải là đúng-sai" };
    } else if (k === "courseId") {
      if (v === null || v === "") next.courseId = null;
      else if (typeof v === "string" && v.length <= CALENDAR_COURSE_ID_MAX) next.courseId = v;
      else return { ok: false, error: "courseId không hợp lệ" };
    } else return { ok: false, error: `calendar không có "${k.slice(0, 40)}"` };
  }
  return { ok: true, value: next };
}

// ── Lời nhắn chia sẻ (BU-14): CHUNG cho lớp, không tên em, không tiền ────────────
export function buildSessionShareMessage(i: { courseName: string; dateKey: string; taught?: string | null; homework?: string | null; summary?: string | null; url?: string | null }): string {
  const lines = [`KiN báo cáo buổi ${i.courseName} ngày ${i.dateKey.slice(8, 10)}/${i.dateKey.slice(5, 7)}:`];
  if (i.taught) lines.push(`• Đã dạy: ${i.taught}`);
  if (i.homework) lines.push(`• Bài tập về nhà: ${i.homework}`);
  if (i.summary) lines.push(`• Nhận xét chung: ${i.summary}`);
  if (lines.length === 1) lines.push("Gia sư chưa ghi nội dung cho buổi này.");
  if (i.url) lines.push(`Xem thêm: ${i.url}`);
  return lines.join("\n");
}
