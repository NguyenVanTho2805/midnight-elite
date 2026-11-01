// Phần THUẦN của giao diện phòng thi (không React, không fetch) — dễ kiểm bằng tsx. Khớp mục 5 của BU-04.
// TẠM: khi `src/lib/examRoomLib.ts` (stu-code) vào nhánh, các hàm trùng tên ở đây nên chuyển sang import từ đó.
import type { AssignmentItem, ExamMode, SavePayload } from "./roomApi";

// ── Hàng đợi lưu ──────────────────────────────────────────────────────────────
export interface QueueItem { key: string; v: number; payload: SavePayload }
/** Khoá hàng đợi: một câu trắc nghiệm/tự luận = một mục; mỗi ý Đúng–Sai (theo id ý) = một mục. Bản mới đè bản cũ cùng khoá. */
export const queueKey = (p: SavePayload) => (p.kind === "bool" ? `b:${p.optionId}` : `q:${p.questionId}`);
/** Lùi mũi 1s, 2s, 4s, 8s, trần 15s. */
export const backoffMs = (failures: number) => Math.min(15000, 1000 * 2 ** Math.max(0, failures));
export const queueStorageKey = (attemptId: string) => `kin.room.queue.${attemptId}`;
export const flagStorageKey = (attemptId: string) => `kin.room.flag.${attemptId}`;
export const VIEW_STORAGE_KEY = "kin.room.view";
/** Số CÂU (không phải số mục) còn chờ lưu. */
export const pendingQuestionCount = (items: Iterable<QueueItem>) => new Set([...items].map(i => i.payload.questionId)).size;

export type SaveChip = { kind: "idle" } | { kind: "saving" } | { kind: "saved"; at: string } | { kind: "failed"; count: number };
export function chipLabel(c: SaveChip): string {
  switch (c.kind) {
    case "saving": return "Đang lưu…";
    case "saved": return `Đã lưu ${c.at}`;
    case "failed": return `Chưa lưu được · ${c.count} câu`;
    default: return "";
  }
}

// ── Bảng số câu ───────────────────────────────────────────────────────────────
export type CellState = "empty" | "answered" | "flagged" | "flagged-answered";
export const cellState = (answered: boolean, flagged: boolean): CellState => flagged ? (answered ? "flagged-answered" : "flagged") : answered ? "answered" : "empty";
export function cellLabel(n: number, s: CellState, current: boolean, practice?: "correct" | "wrong" | null): string {
  const parts = [s === "empty" ? "chưa trả lời" : s === "answered" ? "đã trả lời" : s === "flagged" ? "chưa trả lời, đánh dấu xem lại" : "đã trả lời, đánh dấu xem lại"];
  if (practice) parts.push(practice === "correct" ? "đúng" : "chưa đúng");
  if (current) parts.push("đang xem");
  return `Câu ${n}, ${parts.join(", ")}`;
}

// ── Chế độ xem ────────────────────────────────────────────────────────────────
export type ViewMode = "per-question" | "whole";
/** Luyện tập luôn từng câu; kiểm tra: nhớ lựa chọn của em, chưa có thì Cả đề ở ≥1024 và Từng câu ở màn nhỏ. */
export function resolveView(mode: ExamMode, saved: string | null, width: number): ViewMode {
  if (mode === "practice") return "per-question";
  if (saved === "per-question" || saved === "whole") return saved;
  return width >= 1024 ? "whole" : "per-question";
}

// ── Ngày giờ Việt Nam (tính tay, không phụ thuộc múi giờ trình duyệt) ──────────
const VN = 7 * 3_600_000;
const p2 = (n: number) => String(n).padStart(2, "0");
const vn = (iso: string) => new Date(Date.parse(iso) + VN);
export const hm = (iso: string) => { const d = vn(iso); return `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`; };
export const dm = (iso: string) => { const d = vn(iso); return `${p2(d.getUTCDate())}/${p2(d.getUTCMonth() + 1)}`; };
const dayNo = (iso: string) => Math.floor((Date.parse(iso) + VN) / 86_400_000);

/** "Còn 3 ngày" · "Hết hạn hôm nay 21:00" · "Đã quá hạn" — tính theo NGÀY LỊCH giờ Việt Nam từ giờ máy chủ, không phải bội 24 giờ. */
export function daysLeftLabel(dueIso: string | null, serverNowIso: string): string | null {
  if (!dueIso || !Number.isFinite(Date.parse(dueIso)) || !Number.isFinite(Date.parse(serverNowIso))) return null;
  if (Date.parse(dueIso) <= Date.parse(serverNowIso)) return "Đã quá hạn";
  const diff = dayNo(dueIso) - dayNo(serverNowIso);
  return diff <= 0 ? `Hết hạn hôm nay ${hm(dueIso)}` : `Còn ${diff} ngày`;
}
/** "Đáp án mở lúc 21:05 hôm nay" / "…ngày 05/11". */
export function answersOpenLabel(openIso: string, serverNowIso: string): string {
  const same = dayNo(openIso) === dayNo(serverNowIso);
  return `Đáp án mở lúc ${hm(openIso)} ${same ? "hôm nay" : `ngày ${dm(openIso)}`}`;
}
/** "Mở 19:00 – 19:45 ngày 05/11" (khung giờ của bài kiểm tra). */
export function windowLabel(opensAt: string, closesAt: string | null): string {
  return `Mở ${hm(opensAt)}${closesAt ? ` – ${hm(closesAt)}` : ""} ngày ${dm(opensAt)}`;
}
export function countdownLabel(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h > 0 ? `${h} giờ ${m} phút` : m > 0 ? `${m} phút ${p2(r)} giây` : `${r} giây`;
}

// ── Danh sách đề được giao ────────────────────────────────────────────────────
const RANK: Record<AssignmentItem["state"], number> = { "dang-lam": 0, "dang-mo": 1, "chua-mo": 2, "da-dong": 3, "cho-cong-bo": 4, "da-lam": 5 };
const at = (iso: string | null, fallback: number) => (iso && Number.isFinite(Date.parse(iso)) ? Date.parse(iso) : fallback);
/** dang-lam → dang-mo (hạn gần nhất) → chua-mo (giờ mở) → da-dong chưa làm → chờ công bố → da-lam mới nhất. Ổn định: bằng nhau giữ thứ tự cũ. */
export function sortAssignments(items: AssignmentItem[]): AssignmentItem[] {
  return items.map((it, i) => ({ it, i })).sort((a, b) => {
    const ra = RANK[a.it.state] - RANK[b.it.state];
    if (ra) return ra;
    const s = a.it.state;
    const d = s === "dang-lam" || s === "dang-mo" ? at(a.it.dueAt, Infinity) - at(b.it.dueAt, Infinity)
      : s === "chua-mo" ? at(a.it.opensAt, Infinity) - at(b.it.opensAt, Infinity)
      : at(b.it.dueAt, 0) - at(a.it.dueAt, 0);
    return d || a.i - b.i;
  }).map(x => x.it);
}
export const ASSIGNMENT_STATE_LABEL: Record<AssignmentItem["state"], string> = {
  "chua-mo": "Chưa mở", "dang-mo": "Đang mở", "da-dong": "Đã đóng", "dang-lam": "Đang làm dở", "cho-cong-bo": "Chờ công bố", "da-lam": "Đã làm",
};
export const ASSIGNMENT_ACTION: Record<AssignmentItem["state"], string | null> = {
  "chua-mo": null, "dang-mo": "Vào làm", "da-dong": null, "dang-lam": "Tiếp tục", "cho-cong-bo": "Xem kết quả", "da-lam": "Xem kết quả",
};
