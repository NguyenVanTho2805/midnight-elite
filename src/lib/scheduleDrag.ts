// TUT-lich-keo-tha — logic THUẦN của lưới khung giờ hằng tuần kéo-thả (không React, không DOM, không Prisma).
// Đặc tả: docs/kin/phong-ban/dac-ta/TUT-lich-keo-tha.md mục 3-4. Test: tools/local-e2e/t-schedule-drag-lib.ts.
//
// Đơn vị: PHÚT trong ngày (0-1440), thứ theo Date.getDay() (0 = Chủ nhật). Mọi hàm trả đối tượng MỚI, không sửa đầu vào.
// Hai khung chạm đầu (18:00-19:00 và 19:00-20:00) KHÔNG trùng — khớp slotsOverlap của sessionBook.ts.
// Máy chủ không nhận "24:00" (parseHm chỉ 00:00-23:59) nên 1440 <-> "23:59" khi đổi sang/từ API.
import { hmOf, parseHm } from "@/lib/classSessions";

export const SNAP_MIN = 15;
export const MIN_DURATION_MIN = 15;
export const DAY_END_MIN = 1440;
export const DEFAULT_DURATION_MIN = 90;
export const MAX_BLOCKS_PER_COURSE = 14;
export const NOTE_MAX = 200;
/** Thứ tự cột: Thứ Hai ... Thứ Bảy, Chủ nhật đứng CUỐI (không vòng). */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
export const WEEKDAY_NAMES = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"] as const;

export interface ScheduleBlock {
  /** id máy chủ, hoặc "tmp-<n>" khi chưa lưu. */
  id: string;
  dayOfWeek: number;
  startMin: number;
  endMin: number;
  courseId?: string;
  courseName?: string;
  note?: string | null;
  mode?: "online" | "offline" | null;
  location?: string | null;
  joinUrl?: string | null;
  /** false = đã tắt. Vắng = bật. */
  active?: boolean;
  /** SLOT cho PR đồng giảng; hôm nay luôn null. */
  teacherLabel?: string | null;
  /** Chưa lưu. */
  draft?: boolean;
}
export interface MinRange { startMin: number; endMin: number }

export type BlockPatch = Partial<Pick<ScheduleBlock, "dayOfWeek" | "startMin" | "endMin" | "note" | "mode" | "location" | "joinUrl" | "active">>;
export type ScheduleOp =
  /** `at`: vị trí chèn trong mảng (dùng khi đảo một thao tác xoá để trả đúng thứ tự). */
  | { type: "create"; block: ScheduleBlock; at?: number }
  | { type: "update"; id: string; patch: BlockPatch }
  | { type: "remove"; id: string };

export interface Conflict { otherId: string; kind: "cung-lop" | "lop-khac"; courseName: string; text: string }
export type OpResult = { ok: true } | { ok: false; error: string } | { ok: false; conflicts: Conflict[] };

const PATCH_KEYS: ReadonlyArray<keyof BlockPatch> = ["dayOfWeek", "startMin", "endMin", "note", "mode", "location", "joinUrl", "active"];

// ── Làm tròn / đổi đơn vị ──────────────────────────────────────────────────────

function clamp(n: number, lo: number, hi: number): number { return Math.min(hi, Math.max(lo, n)); }

/** Làm tròn về bội của `step` gần nhất (đúng nửa bước thì làm tròn LÊN: 7 -> 0, 8 -> 15, 7.5 -> 15), kẹp 0-1440. NaN -> 0; -Infinity -> 0; +Infinity -> 1440. Không ném. */
export function snapMin(min: number, step: number = SNAP_MIN): number {
  if (Number.isNaN(min)) return 0;
  if (min === Infinity) return DAY_END_MIN;
  if (min === -Infinity) return 0;
  const s = Number.isFinite(step) && step > 0 ? step : SNAP_MIN;
  return clamp(Math.round(min / s) * s, 0, DAY_END_MIN) + 0; // +0: đổi -0 thành 0
}

/** Pixel -> phút (CHƯA làm tròn, đã kẹp 0-1440). `pxPerHour <= 0` hoặc không hữu hạn là lỗi lập trình -> ném RangeError. px NaN -> `originMin`. */
export function pxToMin(px: number, pxPerHour: number, originMin: number = 0): number {
  if (!Number.isFinite(pxPerHour) || pxPerHour <= 0) throw new RangeError(`pxPerHour phải > 0, nhận ${pxPerHour}`);
  const o = Number.isFinite(originMin) ? originMin : 0;
  if (Number.isNaN(px)) return clamp(o, 0, DAY_END_MIN);
  return clamp(o + (px / pxPerHour) * 60, 0, DAY_END_MIN);
}
/** Phút -> pixel tính từ `originMin`. Ném RangeError như pxToMin. */
export function minToPx(min: number, pxPerHour: number, originMin: number = 0): number {
  if (!Number.isFinite(pxPerHour) || pxPerHour <= 0) throw new RangeError(`pxPerHour phải > 0, nhận ${pxPerHour}`);
  const m = Number.isFinite(min) ? min : 0;
  return ((m - (Number.isFinite(originMin) ? originMin : 0)) / 60) * pxPerHour;
}

// ── Khoảng giờ ─────────────────────────────────────────────────────────────────

/** Kéo trên ô trống: neo + con trỏ (thứ tự bất kỳ). Ngắn hơn 15' (kể cả bấm không kéo) -> dài mặc định 90'. Kẹp 0-1440, tối thiểu 15'. */
export function createRange(anchorMin: number, pointerMin: number): MinRange {
  const a = snapMin(anchorMin), b = snapMin(pointerMin);
  const lo = Math.min(a, b), hi = Math.max(a, b);
  const end0 = hi - lo < MIN_DURATION_MIN ? lo + DEFAULT_DURATION_MIN : hi;
  const endMin = Math.min(DAY_END_MIN, end0);
  const startMin = Math.min(lo, endMin - MIN_DURATION_MIN);
  return { startMin, endMin };
}

/** Dời giữ độ dài; delta làm tròn 15'; kẹp để 0 <= start và end <= 1440. delta NaN/Infinity -> không dời. */
export function moveRange(r: MinRange, deltaMin: number): MinRange {
  const len = r.endMin - r.startMin;
  const d = Number.isFinite(deltaMin) ? Math.round(deltaMin / SNAP_MIN) * SNAP_MIN : 0;
  const startMin = clamp(r.startMin + d, 0, Math.max(0, DAY_END_MIN - len));
  return { startMin, endMin: startMin + len };
}

/** Kéo một mép tới `pointerMin`. Không cho dài dưới 15'; mép vượt mép đối diện thì DỪNG ở ±15', không hoán đổi. */
export function resizeRange(r: MinRange, edge: "start" | "end", pointerMin: number): MinRange {
  const p = snapMin(pointerMin);
  if (edge === "end") {
    return { startMin: r.startMin, endMin: Math.min(DAY_END_MIN, Math.max(p, r.startMin + MIN_DURATION_MIN)) };
  }
  return { startMin: Math.max(0, Math.min(p, r.endMin - MIN_DURATION_MIN)), endMin: r.endMin };
}

/** Chỉ số cột (0-6) của một thứ trong WEEK_ORDER. */
function colOf(day: number): number { return WEEK_ORDER.indexOf(day as typeof WEEK_ORDER[number]); }

/** Kẹp một giá trị `toDay` về thứ hợp lệ, theo thứ tự cột (không vòng): < 0 -> Thứ Hai (cột đầu); > 6 -> Chủ nhật (cột cuối); số lẻ làm tròn; NaN -> null (giữ nguyên). */
function clampDay(d: number): number | null {
  if (Number.isNaN(d)) return null;
  if (d < 0) return WEEK_ORDER[0];
  if (d > 6) return WEEK_ORDER[WEEK_ORDER.length - 1];
  return Math.round(d);
}

/** Dời khối + (tuỳ chọn) sang thứ khác. `toDay` ngoài 0-6 hoặc NaN: xem clampDay. */
export function moveBlock(b: ScheduleBlock, o: { deltaMin?: number; toDay?: number }): ScheduleBlock {
  const r = moveRange(b, o.deltaMin ?? 0);
  const day = o.toDay === undefined ? null : clampDay(o.toDay);
  return { ...b, ...r, dayOfWeek: day ?? b.dayOfWeek };
}

// ── Trùng giờ ──────────────────────────────────────────────────────────────────

/** Giao nhau: cùng thứ và a.start < b.end && b.start < a.end. Chạm đầu = KHÔNG trùng. Khoảng rỗng/ngược coi là 1 phút (như slotsOverlap). */
export function overlaps(a: ScheduleBlock, b: ScheduleBlock): boolean {
  if (a.dayOfWeek !== b.dayOfWeek) return false;
  const ae = Math.max(a.endMin, a.startMin + 1), be = Math.max(b.endMin, b.startMin + 1);
  return a.startMin < be && b.startMin < ae;
}

/** Khung trùng với `block`: các khung cùng lớp (`own`) và các khung lớp khác (`ghosts`). Bỏ qua chính nó và khung tắt. Chữ KHÔNG chứa tên học sinh. */
export function findConflicts(block: ScheduleBlock, own: readonly ScheduleBlock[], ghosts: readonly ScheduleBlock[] = []): Conflict[] {
  if (block.active === false) return [];
  const out: Conflict[] = [];
  const add = (o: ScheduleBlock, kind: Conflict["kind"]) => {
    if (o.id === block.id || o.active === false || !overlaps(block, o)) return;
    const courseName = kind === "lop-khac" ? (o.courseName?.trim() || "một lớp khác") : (o.courseName?.trim() || "lớp này");
    const who = kind === "lop-khac" ? courseName : "một khung khác của lớp này";
    out.push({ otherId: o.id, kind, courseName, text: `Trùng giờ với ${who} (${hmOf(o.startMin)}–${hmOf(o.endMin)})` });
  };
  for (const o of own) add(o, "cung-lop");
  for (const g of ghosts) add(g, "lop-khac");
  return out;
}

/** Chia làn cho khối chồng nhau trong cùng ngày (như Google Calendar). Trả theo id: `lane` (0..), `lanes` = số làn của cả cụm chồng nhau. Không phụ thuộc thứ tự mảng. */
export function layoutDayLanes(blocks: readonly ScheduleBlock[]): Record<string, { lane: number; lanes: number }> {
  const out: Record<string, { lane: number; lanes: number }> = {};
  const byDay = new Map<number, ScheduleBlock[]>();
  for (const b of blocks) { const l = byDay.get(b.dayOfWeek); if (l) l.push(b); else byDay.set(b.dayOfWeek, [b]); }
  for (const list of byDay.values()) {
    const sorted = [...list].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    let cluster: string[] = [];
    let laneEnds: number[] = [];
    let clusterEnd = -Infinity;
    const flush = () => { for (const id of cluster) out[id].lanes = laneEnds.length; cluster = []; laneEnds = []; clusterEnd = -Infinity; };
    for (const b of sorted) {
      const end = Math.max(b.endMin, b.startMin + 1);
      if (cluster.length && b.startMin >= clusterEnd) flush();
      let lane = laneEnds.findIndex(e => e <= b.startMin);
      if (lane < 0) { lane = laneEnds.length; laneEnds.push(end); } else laneEnds[lane] = end;
      out[b.id] = { lane, lanes: 1 };
      cluster.push(b.id);
      clusterEnd = Math.max(clusterEnd, end);
    }
    flush();
  }
  return out;
}

// ── Đổi sang / từ API ──────────────────────────────────────────────────────────

export interface ApiSlot {
  dayOfWeek: number; startTime: string; endTime: string;
  note: string | null; mode: "online" | "offline" | null; location: string | null; joinUrl: string | null;
}
/** Khối -> thân gửi API. 1440 -> "23:59" (máy chủ không nhận 24:00). */
export function toApiSlot(b: ScheduleBlock): ApiSlot {
  return {
    dayOfWeek: b.dayOfWeek,
    startTime: hmOf(Math.min(b.startMin, DAY_END_MIN - 1)),
    endTime: b.endMin >= DAY_END_MIN ? "23:59" : hmOf(b.endMin),
    note: b.note ?? null, mode: b.mode ?? null, location: b.location ?? null, joinUrl: b.joinUrl ?? null,
  };
}
/** Dòng API -> khối. "23:59" của giờ kết thúc -> 1440. Giờ sai định dạng ("25:00", "24:00", "abc", null), thứ ngoài 0-6 hoặc end <= start -> null (bỏ khung, không ném). */
export function fromApiRow(row: unknown): ScheduleBlock | null {
  if (typeof row !== "object" || row === null) return null;
  const r = row as Record<string, unknown>;
  const s = parseHm(typeof r.startTime === "string" ? r.startTime : null);
  let e = parseHm(typeof r.endTime === "string" ? r.endTime : null);
  if (s === null || e === null) return null;
  if (e === DAY_END_MIN - 1) e = DAY_END_MIN;
  if (typeof r.dayOfWeek !== "number" || !Number.isInteger(r.dayOfWeek) || r.dayOfWeek < 0 || r.dayOfWeek > 6) return null;
  if (e <= s || typeof r.id !== "string") return null;
  const mode = r.mode === "online" || r.mode === "offline" ? r.mode : null;
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  return {
    id: r.id, dayOfWeek: r.dayOfWeek, startMin: s, endMin: e,
    ...(typeof r.courseId === "string" ? { courseId: r.courseId } : {}),
    ...(typeof r.courseName === "string" ? { courseName: r.courseName } : {}),
    note: str(r.note), mode, location: str(r.location), joinUrl: str(r.joinUrl),
    active: r.active === false ? false : true,
  };
}

// ── Thao tác ───────────────────────────────────────────────────────────────────

const same = (a: unknown, b: unknown) => (a ?? null) === (b ?? null);

/** Tập thao tác tối thiểu đưa `before` thành `after` (khớp theo id; đổi thứ tự mảng KHÔNG là thay đổi). Thứ tự kết quả: thêm/sửa theo `after`, rồi xoá theo `before`. */
export function diffBlocks(before: readonly ScheduleBlock[], after: readonly ScheduleBlock[]): ScheduleOp[] {
  const ops: ScheduleOp[] = [];
  const old = new Map(before.map(b => [b.id, b]));
  const keep = new Set<string>();
  for (const a of after) {
    keep.add(a.id);
    const b = old.get(a.id);
    if (!b) { ops.push({ type: "create", block: a }); continue; }
    const patch: Record<string, unknown> = {};
    for (const k of PATCH_KEYS) {
      const av = k === "active" ? a.active !== false : a[k];
      const bv = k === "active" ? b.active !== false : b[k];
      if (!same(av, bv)) patch[k] = a[k] ?? (k === "active" ? true : null);
    }
    if (Object.keys(patch).length) ops.push({ type: "update", id: a.id, patch: patch as BlockPatch });
  }
  for (const b of before) if (!keep.has(b.id)) ops.push({ type: "remove", id: b.id });
  return ops;
}

/** Áp một thao tác lên danh sách (trả mảng mới, giữ thứ tự). id không có -> update/remove không làm gì; create trùng id thì thay. */
export function applyOp(blocks: readonly ScheduleBlock[], op: ScheduleOp): ScheduleBlock[] {
  if (op.type === "create") {
    const without = blocks.filter(b => b.id !== op.block.id);
    const at = op.at === undefined ? without.length : clamp(Math.trunc(op.at) || 0, 0, without.length);
    return [...without.slice(0, at), { ...op.block }, ...without.slice(at)];
  }
  if (op.type === "update") return blocks.map(b => (b.id === op.id ? { ...b, ...op.patch } : { ...b }));
  return blocks.filter(b => b.id !== op.id).map(b => ({ ...b }));
}

/** Thao tác ĐẢO của `op` khi danh sách là `before`. `remote` (khung đã lưu trên máy chủ): create đảo bằng TẮT khung (không xoá cứng, tránh id mồ côi); remove KHÔNG hoàn tác được -> null.
 *  Cục bộ (mặc định): create đảo bằng remove; remove đảo bằng create đúng vị trí cũ, nên applyOp(applyOp(s, op), invertOp(op, s)) ≡ s. */
export function invertOp(op: ScheduleOp, before: readonly ScheduleBlock[], o: { remote?: boolean } = {}): ScheduleOp | null {
  if (op.type === "create") {
    return o.remote ? { type: "update", id: op.block.id, patch: { active: false } } : { type: "remove", id: op.block.id };
  }
  const idx = before.findIndex(b => b.id === op.id);
  if (idx < 0) return null;
  const was = before[idx];
  if (op.type === "remove") return o.remote ? null : { type: "create", block: { ...was }, at: idx };
  const patch: Record<string, unknown> = {};
  for (const k of Object.keys(op.patch) as Array<keyof BlockPatch>) patch[k] = was[k];
  return { type: "update", id: op.id, patch: patch as BlockPatch };
}

/** Phím mũi tên -> khối mới (mục 3.4). Không phím sửa: ↑/↓ dời ±15', ←/→ sang thứ liền kề (không vòng).
 *  Shift: ↑/↓ đổi mép DƯỚI ±15'. Alt+Shift: ↑/↓ đổi mép TRÊN ±15'. Khác -> trả bản sao không đổi. Luôn kẹp 0-1440 và dài >= 15'. */
export function nudge(b: ScheduleBlock, key: string, mods: { shift?: boolean; alt?: boolean } = {}): ScheduleBlock {
  const up = key === "ArrowUp", down = key === "ArrowDown", left = key === "ArrowLeft", right = key === "ArrowRight";
  const step = up ? -SNAP_MIN : down ? SNAP_MIN : 0;
  if (!mods.shift && !mods.alt) {
    if (up || down) return moveBlock(b, { deltaMin: step });
    if (left || right) {
      const c = colOf(b.dayOfWeek) + (left ? -1 : 1);
      return moveBlock(b, { toDay: WEEK_ORDER[clamp(c, 0, WEEK_ORDER.length - 1)] });
    }
    return { ...b };
  }
  if (mods.shift && (up || down)) {
    return { ...b, ...resizeRange(b, mods.alt ? "start" : "end", (mods.alt ? b.startMin : b.endMin) + step) };
  }
  return { ...b };
}

// ── Kiểm trước khi gửi ─────────────────────────────────────────────────────────

/** Lỗi tiếng Việt đầu tiên hoặc null. Kiểm: trần 14 khung, thứ, giờ nguyên 0-1440 và end > start, ghi chú <= 200, hai khung bật TRÙNG CHÍNH XÁC (cùng thứ + giờ). Chồng nhau một phần KHÔNG là lỗi. */
export function validateBlocks(blocks: readonly ScheduleBlock[]): string | null {
  if (blocks.length > MAX_BLOCKS_PER_COURSE) return `Một lớp có tối đa ${MAX_BLOCKS_PER_COURSE} khung giờ.`;
  const seen = new Set<string>();
  for (const b of blocks) {
    if (!Number.isInteger(b.dayOfWeek) || b.dayOfWeek < 0 || b.dayOfWeek > 6) return "Ngày trong tuần không hợp lệ.";
    if (!Number.isInteger(b.startMin) || !Number.isInteger(b.endMin) || b.startMin < 0 || b.endMin > DAY_END_MIN) return "Giờ học chưa hợp lệ.";
    if (b.endMin <= b.startMin) return "Giờ kết thúc phải sau giờ bắt đầu.";
    if ((b.note ?? "").length > NOTE_MAX) return `Ghi chú tối đa ${NOTE_MAX} ký tự.`;
    if (b.active === false) continue;
    const k = `${b.dayOfWeek}|${b.startMin}|${b.endMin}`;
    if (seen.has(k)) return "Có hai khung giờ trùng nhau.";
    seen.add(k);
  }
  return null;
}

// ── Chữ ────────────────────────────────────────────────────────────────────────

/** "4 giờ 30 phút", "1 giờ", "45 phút", "0 phút". */
export function formatDuration(min: number): string {
  const m = Math.max(0, Math.round(Number.isFinite(min) ? min : 0));
  const h = Math.floor(m / 60), r = m % 60;
  if (h && r) return `${h} giờ ${r} phút`;
  return h ? `${h} giờ` : `${r} phút`;
}

/** Chuỗi aria: "Toán 9, Thứ Ba, 19:00 đến 20:30, 90 phút". Chỉ tên lớp/khung — KHÔNG có tên học sinh. */
export function describeBlock(b: ScheduleBlock): string {
  const name = b.courseName?.trim() || b.note?.trim() || "Khung giờ";
  const day = WEEKDAY_NAMES[b.dayOfWeek] ?? "";
  return `${name}, ${day}, ${hmOf(b.startMin)} đến ${hmOf(b.endMin)}, ${b.endMin - b.startMin} phút`;
}

/** Tổng phút mỗi tuần của các khung đang bật. */
export function weeklyMinutes(blocks: readonly ScheduleBlock[]): number {
  return blocks.reduce((n, b) => (b.active === false ? n : n + Math.max(0, b.endMin - b.startMin)), 0);
}

/** Khối -> WizardSlot (cho previewSessionCount / validateSlots), chỉ khung bật; 1440 -> "23:59". */
export function toWizardSlots(blocks: readonly ScheduleBlock[]): Array<{ dayOfWeek: number; startTime: string; endTime: string }> {
  return blocks.filter(b => b.active !== false).map(b => { const s = toApiSlot(b); return { dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime }; });
}
