// BU-04 — phần THUẦN của phòng thi một cột (khác examRoom.ts = chữ trên thanh Navy và quizRoom.ts = giờ/số lượt/ai thấy gì):
// chip lưu + hàng đợi thử lại, ô lưới số câu, đánh dấu xem lại, chế độ xem, nhãn "Còn N ngày", sắp xếp danh sách đề.
// Không prisma, không React, không đọc đồng hồ ngầm (giờ luôn truyền vào). Máy chủ vẫn là nơi quyết định hết giờ / lưu được hay không.
import { vnDateKeyOf, vnMinutesOfDay, hmOf } from "@/lib/classSessions";
import { submitConfirmMessage, type UnansweredItem } from "@/lib/quizRoom";
import type { AssignmentState, SaveAnswerBody } from "@/lib/examRoomApi";

// ── Chip lưu + hàng đợi ──────────────────────────────────────────────────────
export type SaveStatus = "idle" | "saving" | "saved" | "failed";
export interface QueuedAnswer { key: string; seq: number; body: SaveAnswerBody }
export interface SaveState {
  status: SaveStatus;
  /** Mỗi câu / mỗi ý chỉ giữ bản MỚI NHẤT chưa lưu được — không phát lại bản cũ. */
  queue: QueuedAnswer[];
  /** Giờ MÁY CHỦ của lần lưu thành công gần nhất (ISO) — chip hiện giờ này, không phải giờ máy học sinh. */
  savedAt: string | null;
  /** Số lần thất bại liên tiếp (cho lùi mũi). */
  retries: number;
  seq: number;
  /**
   * 5A (quyết định của Thọ 04/11/2026): đáp án máy chủ TỪ CHỐI bằng lỗi 4xx (vd. Phần đã khoá). Không nằm trong `queue` (thử lại tự động vô ích, không lặp mãi) nhưng KHÔNG được
   * im lặng bỏ đi: chip phải nói "Chưa lưu được" thay vì "Đã lưu". Bấm "Thử lại" (retryRejected) đưa chúng về hàng đợi; em đổi đáp án câu đó thì bản bị từ chối cũ bị thay.
   */
  rejected: QueuedAnswer[];
}
export const initialSaveState = (): SaveState => ({ status: "idle", queue: [], savedAt: null, retries: 0, seq: 0, rejected: [] });

/** Chip theo hàng đợi + đáp án bị từ chối: còn gửi → "saving"; hết gửi mà còn bị từ chối → "failed" (không bao giờ "saved" giả); hết sạch → "saved" nếu từng lưu. */
function settleStatus(queue: readonly QueuedAnswer[], rejected: readonly QueuedAnswer[], savedAt: string | null): SaveStatus {
  if (queue.length > 0) return "saving";
  if (rejected.length > 0) return "failed";
  return savedAt ? "saved" : "idle";
}

/** Khoá gộp: câu trắc nghiệm / tự luận theo câu; từng ý Đúng–Sai / ô nhiều đáp án theo ý. */
export function answerKey(b: SaveAnswerBody): string {
  return b.kind === "bool" ? `b:${b.optionId}` : `q:${b.questionId}`;
}

/** Có đáp án mới: thay bản cũ cùng khoá bằng bản mới, chip → "Đang lưu". */
export function enqueue(s: SaveState, body: SaveAnswerBody): SaveState {
  const key = answerKey(body);
  const seq = s.seq + 1;
  // Đáp án mới của cùng câu / ý thay luôn bản bị từ chối trước đó (em đã đổi ý: đây là lần thử mới).
  return { ...s, status: "saving", seq, queue: [...s.queue.filter(q => q.key !== key), { key, seq, body }], rejected: s.rejected.filter(r => r.key !== key) };
}

/**
 * Máy chủ đã nhận `seq` của `key`. Nếu trong lúc gửi học sinh đã đổi sang đáp án mới hơn (seq lớn hơn) thì GIỮ bản mới trong hàng đợi.
 * Hàng đợi hết → "Đã lưu <giờ máy chủ>".
 */
export function markSaved(s: SaveState, key: string, seq: number, serverNowIso: string): SaveState {
  const queue = s.queue.filter(q => !(q.key === key && q.seq <= seq));
  return { ...s, queue, retries: 0, savedAt: serverNowIso, status: settleStatus(queue, s.rejected, serverNowIso) };
}

/** Gửi thất bại nhưng thử lại được (mạng / 5xx): giữ nguyên hàng đợi, chip "Chưa lưu được". */
export function markFailed(s: SaveState): SaveState {
  return { ...s, status: s.queue.length > 0 ? "failed" : s.status, retries: s.retries + 1 };
}

/** Bỏ một mục khỏi hàng đợi (lỗi không thể thử lại như phần đã khoá) để không lặp mãi. Phòng thi dùng markRejected (giữ lại để báo "Chưa lưu được"), không dùng hàm này. */
export function dropQueued(s: SaveState, key: string, seq: number): SaveState {
  const queue = s.queue.filter(q => !(q.key === key && q.seq <= seq));
  return { ...s, queue, status: queue.length === 0 ? settleStatus(queue, s.rejected, s.savedAt) : s.status };
}

/**
 * 5A: máy chủ từ chối `key` bằng lỗi 4xx (không thử lại được): chuyển mục đó từ hàng đợi sang `rejected`. Chip → "failed" ngay khi hàng đợi hết (còn mục khác đang gửi thì vẫn "saving"
 * cho tới khi chúng xong). Không tăng `retries` (không phải lỗi mạng, không lùi mũi).
 */
export function markRejected(s: SaveState, key: string, seq: number): SaveState {
  const gone = s.queue.filter(q => q.key === key && q.seq <= seq);
  if (gone.length === 0) return s;
  const queue = s.queue.filter(q => !(q.key === key && q.seq <= seq));
  const rejected = [...s.rejected.filter(r => r.key !== key), gone[gone.length - 1]];
  return { ...s, queue, rejected, status: settleStatus(queue, rejected, s.savedAt) };
}

/** Nút "Thử lại" ở chip: đưa mọi đáp án bị từ chối về hàng đợi với `seq` MỚI (lớn hơn mọi seq cũ), chip → "saving". Không có gì bị từ chối → không đổi. */
export function retryRejected(s: SaveState): SaveState {
  if (s.rejected.length === 0) return s;
  let seq = s.seq;
  const again: QueuedAnswer[] = s.rejected.map(r => ({ key: r.key, seq: ++seq, body: r.body }));
  const queue = [...s.queue.filter(q => !again.some(a => a.key === q.key)), ...again];
  return { ...s, queue, rejected: [], seq, status: "saving" };
}

/** 1s, 2s, 4s, 8s, rồi trần 15s. */
export function backoffMs(retries: number): number {
  const r = Number.isFinite(retries) ? Math.max(0, Math.floor(retries)) : 0;
  return Math.min(15_000, 1000 * 2 ** Math.min(r, 10));
}

export type SaveFailureKind = "retry" | "time_up" | "drop";
/** Lỗi lưu thuộc loại nào: hết giờ / đã nộp ⇒ chuyển màn (không phải lỗi mạng); lỗi dữ liệu 4xx ⇒ bỏ; còn lại ⇒ thử lại. */
export function classifySaveFailure(status: number, code: string | undefined): SaveFailureKind {
  if (code === "expired" || code === "finished") return "time_up";
  if (status === 0 || status >= 500 || status === 429 || status === 408) return "retry";
  if (status >= 400 && status < 500) return "drop";
  return "retry";
}

function clockOf(iso: string | null): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const m = vnMinutesOfDay(new Date(t));
  const s = Math.floor(t / 1000) % 60;
  return `${hmOf(m)}:${String(s).padStart(2, "0")}`;
}

/** Chữ trên chip (kèm biểu tượng ở giao diện; không chỉ dựa vào màu). */
export function chipLabel(s: SaveState): string {
  if (s.status === "saving") return "Đang lưu…";
  if (s.status === "failed") return `Chưa lưu được · ${s.queue.length + s.rejected.length} câu · Thử lại`;
  if (s.status === "saved") { const c = clockOf(s.savedAt); return c ? `Đã lưu ${c}` : "Đã lưu"; }
  return "";
}

/** Hàng đợi ↔ localStorage (`kin.room.queue.<attemptId>`). Dữ liệu hỏng → rỗng, không ném lỗi. */
export function serializeQueue(q: readonly QueuedAnswer[]): string {
  return JSON.stringify(q.map(x => ({ key: x.key, seq: x.seq, body: x.body })));
}
export function parseQueue(raw: string | null | undefined): QueuedAnswer[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    const out: QueuedAnswer[] = [];
    for (const it of v) {
      if (!it || typeof it !== "object") continue;
      const o = it as Record<string, unknown>; const b = o.body as Record<string, unknown> | undefined;
      if (typeof o.key !== "string" || typeof o.seq !== "number" || !b || typeof b !== "object") continue;
      if (b.kind === "option" && typeof b.questionId === "string" && typeof b.optionId === "string") out.push({ key: o.key, seq: o.seq, body: { kind: "option", questionId: b.questionId, optionId: b.optionId } });
      else if (b.kind === "text" && typeof b.questionId === "string" && typeof b.textAnswer === "string") out.push({ key: o.key, seq: o.seq, body: { kind: "text", questionId: b.questionId, textAnswer: b.textAnswer } });
      else if (b.kind === "bool" && typeof b.optionId === "string" && typeof b.answerTrue === "boolean") out.push({ key: o.key, seq: o.seq, body: { kind: "bool", optionId: b.optionId, answerTrue: b.answerTrue } });
    }
    return out;
  } catch { return []; }
}

// ── Ô lưới số câu + đánh dấu xem lại ─────────────────────────────────────────
export interface GridCell {
  index: number; // 1-based
  answered: boolean; flagged: boolean; current: boolean;
  /** Dấu hiệu KHÔNG phải màu: "current" > "flag" > "dot" (đã làm) > "dash" (chưa). */
  marker: "current" | "flag" | "dot" | "dash";
  ariaLabel: string;
}
export function gridCell(index: number, answered: boolean, flagged: boolean, current: boolean): GridCell {
  const parts = [`Câu ${index}`, answered ? "đã làm" : "chưa làm"];
  if (flagged) parts.push("đánh dấu xem lại");
  if (current) parts.push("đang xem");
  return { index, answered, flagged, current, marker: current ? "current" : flagged ? "flag" : answered ? "dot" : "dash", ariaLabel: parts.join(", ") };
}

export function toggleFlag(flags: readonly string[], questionId: string): string[] {
  return flags.includes(questionId) ? flags.filter(f => f !== questionId) : [...flags, questionId];
}
export function parseFlags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try { const v: unknown = JSON.parse(raw); return Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string"))] : []; } catch { return []; }
}
/** Chỉ giữ cờ của câu còn trong đề (đề đổi / dữ liệu cũ). */
export function pruneFlags(flags: readonly string[], questionIds: readonly string[]): string[] {
  const ok = new Set(questionIds);
  return flags.filter(f => ok.has(f));
}

/** Hộp xác nhận nộp: lời cũ + "N câu đánh dấu xem lại: Câu 3, 5". `flaggedIndexes` là số câu (1-based). */
export function submitConfirmWithFlags(items: UnansweredItem[], hasEssay: boolean, hiddenUnopened: number, flaggedIndexes: readonly number[]): string {
  const base = submitConfirmMessage(items, hasEssay, hiddenUnopened);
  const idx = [...new Set(flaggedIndexes)].sort((a, b) => a - b);
  if (idx.length === 0) return base;
  const shown = idx.slice(0, 8).join(", ");
  const rest = idx.length - 8;
  const flagLine = `${idx.length} câu đánh dấu xem lại: Câu ${shown}${rest > 0 ? ` và ${rest} câu nữa` : ""}.`;
  // Chèn trước câu chốt "Nộp rồi thì không sửa lại được." để câu chốt vẫn là câu cuối.
  const tail = "Nộp rồi thì không sửa lại được.";
  return base.endsWith(tail) ? `${base.slice(0, base.length - tail.length)}${flagLine} ${tail}` : `${base} ${flagLine}`;
}

// ── Chế độ xem ───────────────────────────────────────────────────────────────
export type RoomView = "per-question" | "whole";
export const WIDE_VIEWPORT_PX = 1024;
/** Luyện tập luôn "Từng câu". Kiểm tra: ≥1024px mặc định "Cả đề", hẹp hơn "Từng câu". */
export function defaultView(mode: string | null, widthPx: number): RoomView {
  if (mode === "practice") return "per-question";
  return widthPx >= WIDE_VIEWPORT_PX ? "whole" : "per-question";
}
/** Giá trị đã nhớ (`kin.room.view`) thắng mặc định, trừ luyện tập (bị ép). */
export function resolveView(stored: string | null | undefined, mode: string | null, widthPx: number): RoomView {
  if (mode === "practice") return "per-question";
  return stored === "whole" || stored === "per-question" ? stored : defaultView(mode, widthPx);
}

// ── Nhãn hạn / giờ mở ────────────────────────────────────────────────────────
const dayNumber = (iso: string): number | null => {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.floor(Date.parse(`${vnDateKeyOf(new Date(t))}T00:00:00Z`) / 86_400_000);
};
const hmVn = (iso: string) => hmOf(vnMinutesOfDay(new Date(Date.parse(iso))));

/**
 * "Còn 3 ngày" / "Hết hạn hôm nay 21:00" / "Đã quá hạn". Đếm theo NGÀY LỊCH giờ Việt Nam từ `serverNowIso`, không phải bội của 24 giờ
 * (UTC 17:30 đã là 00:30 ngày hôm sau ở Việt Nam). Hạn hôm nay mà giờ đã qua ⇒ "Đã quá hạn". Không có hạn / hạn hỏng ⇒ "".
 */
export function daysLeftLabel(dueAtIso: string | null | undefined, serverNowIso: string): string {
  if (!dueAtIso) return "";
  const due = Date.parse(dueAtIso), now = Date.parse(serverNowIso);
  const dd = dayNumber(dueAtIso), dn = dayNumber(serverNowIso);
  if (!Number.isFinite(due) || !Number.isFinite(now) || dd === null || dn === null) return "";
  if (due <= now) return "Đã quá hạn";
  const days = dd - dn;
  if (days <= 0) return `Hết hạn hôm nay ${hmVn(dueAtIso)}`;
  return `Còn ${days} ngày`;
}

/** "Mở lúc 19:00 05/11" (giờ VN). */
export function opensLabel(opensAtIso: string | null | undefined): string {
  if (!opensAtIso || !Number.isFinite(Date.parse(opensAtIso))) return "";
  const key = vnDateKeyOf(new Date(Date.parse(opensAtIso))); // YYYY-MM-DD
  return `Mở lúc ${hmVn(opensAtIso)} ${key.slice(8, 10)}/${key.slice(5, 7)}`;
}

// ── Danh sách đề của học sinh ────────────────────────────────────────────────
export interface AssignmentFacts {
  inProgress: boolean;      // có lượt đang làm còn hạn
  used: number; max: number | null;
  pendingPublish: boolean;  // đã nộp, đang chờ gia sư công bố
  windowState: "none" | "not_open" | "open" | "closed";
  active: boolean;
  mode: string | null;
}
/**
 * dang-lam > cho-cong-bo > (chưa mở) > (đã đóng: đã làm / chưa làm) > đang mở.
 * Đã nộp ít nhất một lượt thì "da-lam" khi: hết lượt, hoặc là luyện tập, hoặc bài đã đóng; còn lượt ở kiểm tra đang mở ⇒ vẫn "dang-mo".
 */
export function assignmentState(f: AssignmentFacts): AssignmentState {
  if (f.inProgress) return "dang-lam";
  if (f.pendingPublish) return "cho-cong-bo";
  const exhausted = f.max !== null && f.used >= f.max;
  const closed = !f.active || f.windowState === "closed";
  if (f.windowState === "not_open" && f.active) return "chua-mo";
  if (closed) return f.used > 0 ? "da-lam" : "da-dong";
  if (f.used > 0 && (exhausted || f.mode === "practice")) return "da-lam";
  return "dang-mo";
}

export interface SortableAssignment { id: string; title: string; state: AssignmentState; opensAt: string | null; dueAt: string | null }
const GROUP: Record<AssignmentState, number> = { "dang-lam": 0, "dang-mo": 1, "chua-mo": 2, "cho-cong-bo": 3, "da-dong": 4, "da-lam": 5 };
const ts = (iso: string | null, empty: number) => { const t = iso ? Date.parse(iso) : NaN; return Number.isFinite(t) ? t : empty; };
/** dang-lam → dang-mo (hạn gần nhất trước, không hạn xuống cuối) → chua-mo (giờ mở sớm trước) → cho-cong-bo → da-dong → da-lam (mới nhất trước). Ổn định: hòa thì theo tên, rồi id. */
export function sortAssignments<T extends SortableAssignment>(items: readonly T[]): T[] {
  const key = (a: T): number => {
    switch (a.state) {
      case "dang-mo": return ts(a.dueAt, Number.MAX_SAFE_INTEGER);
      case "chua-mo": return ts(a.opensAt, Number.MAX_SAFE_INTEGER);
      case "da-dong": case "da-lam": return -ts(a.dueAt ?? a.opensAt, 0);
      default: return 0;
    }
  };
  return [...items].sort((a, b) =>
    GROUP[a.state] - GROUP[b.state] || key(a) - key(b) || a.title.localeCompare(b.title, "vi") || a.id.localeCompare(b.id));
}
