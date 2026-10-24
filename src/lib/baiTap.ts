// "Bài tập và kiểm tra" của gia sư (Figma 299:113312) — phần THUẦN: xếp một bài tập / đề thi vào nhóm và dựng chữ dòng phụ. Không DB, không React.
// Phần có DB: src/lib/baiTapServer.ts. Giao diện: src/components/tutor/BaiTap.tsx.
//
// Nhóm (loại trừ nhau, để số trên các tab cộng lại đúng bằng "Tất cả"):
//   cho  — còn bài nộp chưa chấm (việc của gia sư, đứng đầu)
//   giao — đang nhận bài (còn hạn hoặc không đặt hạn) / đề thi đã lên lịch hoặc đang mở
//   xong — hết hạn mà không còn bài chờ chấm / đề đã đóng
import { shortDate } from "@/lib/library";

export type BaiTapGroup = "cho" | "giao" | "xong";
export type BaiTapTone = "xong" | "cho" | "loi" | "mo";

export interface BaiTapItem {
  id: string;
  kind: "assignment" | "exam";
  courseId: string | null;
  courseName: string;
  title: string;
  /** "file" | "interactive" (bài làm trực tiếp, chấm từng câu ở trang lớp) — chỉ với kind=assignment. */
  mode: string;
  maxPoints: number;
  submitted: number;
  ungraded: number;
  group: BaiTapGroup;
  statusLabel: string;
  statusTone: BaiTapTone;
  /** Dòng phụ đã dựng sẵn, ví dụ "1/2 đã nộp · Trần Gia Bảo · 22/10 lúc 20:40". */
  sub: string;
  /** Trang mở bài/đề: bài tập → tab Chương và bài của lớp; đề thi → trang đề. */
  href: string;
}

const VN_OFFSET_MS = 7 * 3_600_000;
const pad = (n: number) => String(n).padStart(2, "0");
/** "22/10 lúc 20:40" theo giờ Việt Nam (tính tay, không phụ thuộc ICU của máy chủ). */
export function dayAt(d: Date): string {
  const v = new Date(d.getTime() + VN_OFFSET_MS);
  return `${shortDate(d)} lúc ${pad(v.getUTCHours())}:${pad(v.getUTCMinutes())}`;
}
/** "23/10 · 23:59" */
export function dueText(d: Date): string {
  const v = new Date(d.getTime() + VN_OFFSET_MS);
  return `${shortDate(d)} · ${pad(v.getUTCHours())}:${pad(v.getUTCMinutes())}`;
}

export function classifyAssignment(a: { submitted: number; ungraded: number; dueAt: Date | null }, now: Date): { group: BaiTapGroup; label: string; tone: BaiTapTone } {
  if (a.ungraded > 0) return { group: "cho", label: `${a.ungraded} bài chờ chấm`, tone: "cho" };
  if (a.dueAt && a.dueAt.getTime() < now.getTime()) return { group: "xong", label: "Đã hoàn tất", tone: "xong" };
  return { group: "giao", label: "Đang nhận bài", tone: "mo" };
}

export function assignmentSub(a: { submitted: number; enrolled: number; dueAt: Date | null; last: { name: string; at: Date } | null }): string {
  const parts: string[] = [];
  if (a.dueAt) parts.push(`Hạn ${dueText(a.dueAt)}`);
  parts.push(a.enrolled >= a.submitted && a.enrolled > 0 ? `${a.submitted}/${a.enrolled} đã nộp` : `${a.submitted} bài nộp`);
  if (a.last) parts.push(a.last.name, dayAt(a.last.at));
  return parts.join(" · ");
}

/** Đề thi: gia sư chỉ cần biết sắp tới, đang mở hay đã đóng. Trạng thái tính từ computeExamStatus (không đọc cột status đứng yên trong DB). "draft" (QZ-04) = bản nháp chưa phát hành. */
export function classifyExam(status: "upcoming" | "available" | "completed" | "draft"): { group: BaiTapGroup; label: string; tone: BaiTapTone } {
  if (status === "draft") return { group: "giao", label: "Bản nháp · chưa phát hành", tone: "cho" };
  if (status === "completed") return { group: "xong", label: "Đã đóng", tone: "xong" };
  if (status === "available") return { group: "giao", label: "Đang mở", tone: "mo" };
  return { group: "giao", label: "Đã lên lịch", tone: "mo" };
}

export function countGroups(items: readonly { group: BaiTapGroup }[]): Record<BaiTapGroup | "all", number> {
  const c = { all: items.length, cho: 0, giao: 0, xong: 0 };
  for (const i of items) c[i.group]++;
  return c;
}

/** Thứ tự trong một lớp: chờ chấm trước, rồi đang giao, rồi đã xong; cùng nhóm giữ thứ tự đưa vào. */
export const GROUP_ORDER: Record<BaiTapGroup, number> = { cho: 0, giao: 1, xong: 2 };
