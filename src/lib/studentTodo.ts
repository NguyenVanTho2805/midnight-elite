// "Việc của tôi" của học sinh (Figma "Vỏ — Học sinh" 11:98, bo-cuc-outlook.md mục 10). PHẦN THUẦN: nhận dữ liệu đã đọc
// từ cơ sở dữ liệu, trả danh sách việc + chi tiết để khung đọc hiện. Không đụng cơ sở dữ liệu ở đây để test được từng quy tắc.
//
// Quy tắc "một việc = một hàng dữ liệu có thật": mọi dòng sinh từ một bài tập có hạn, một buổi học trong lịch, hoặc một hạn nộp ngoài.
// Badge đỏ CHỈ đếm việc cần học sinh ra tay (chưa nộp mà sắp tới hạn / quá hạn), không đếm mục chưa đọc.
import { DAY_LABELS_VI } from "@/lib/types";
import { addDaysKey, dayOfWeekOfKey, hmOf, instantOf, parseHm, vnDateKeyOf, vnMinutesOfDay } from "@/lib/classSessions";
import { placeLabel } from "@/lib/sessionBook";

const H = 3_600_000;
export const DUE_SOON_MS = 24 * H;           // còn dưới 24 giờ → "Sắp hết hạn"
export const ACTION_WINDOW_MS = 3 * 24 * H;  // chưa nộp mà hạn trong 3 ngày → cần ra tay (tính vào badge)
export const OVERDUE_KEEP_MS = 14 * 24 * H;  // quá hạn quá 14 ngày thì thôi hiện (đỡ rối)
export const DONE_KEEP_MS = 14 * 24 * H;     // đã nộp / đã chấm giữ 14 ngày
export const SESSION_AHEAD_DAYS = 3;         // buổi học sắp tới trong 3 ngày
export const DEADLINE_AHEAD_DAYS = 7;        // hạn nộp ngoài (Azota) trong 7 ngày
export const MAX_ITEMS = 50;

export interface TodoAssignment {
  id: string;
  title: string;
  instructions: string | null;
  fileUrl: string | null;
  maxPoints: number;
  dueDate: Date | null;
  mode: string; // "file" | "interactive"
  createdAt: Date;
  lessonId: string;
  courseName: string;
  teacher: string;
  /** Học sinh đã nộp file (mode "file"). */
  submission: { submittedAt: Date; score: number | null; gradedAt: Date | null; comment: string | null } | null;
  /** Số câu học sinh đã trả lời (mode "interactive"). */
  answeredCount: number;
}

export interface TodoEvent {
  id: string;
  type: "exam" | "deadline" | "class";
  subject: string;
  topic: string;
  time: string;
  isoDate: string;
  link?: string;
  endTime?: string;
  meta?: string;
  /** Chỉ buổi học (cùng nghĩa với ScheduleEvent): hình thức, địa chỉ, link học online. */
  mode?: "online" | "offline";
  location?: string;
  joinUrl?: string;
}

export type TodoTone = "cho" | "loi" | "mo" | "xong";
export interface TodoCommand { label: string; href: string; kind: "primary" | "secondary"; external?: boolean }
export interface TodoSection { title: string; text: string }

/** Bài tập (kind "bai-tap"): các mảnh chữ đã định dạng sẵn để màn hình dựng dòng Figma, chỉ gồm dữ liệu học sinh vốn thấy về chính bài của mình. */
export interface TodoTask {
  phase: "chua-nop" | "cho-cham" | "da-cham";
  name: string;
  /** "Toán 9 · Cô Lan" */
  courseLine: string;
  /** "hạn hôm nay, 23:59" */
  dueText: string;
  href: string;
  interactive: boolean;
  /** "Nộp 22/10 lúc 20:40" (đã nộp / đã làm). */
  sentText?: string;
  /** Đã chấm: "8,5/10", "Đã chấm 20/10", nhận xét (có thể rỗng). */
  scoreText?: string;
  gradedText?: string;
  comment?: string | null;
}

/** Buổi học (kind "buoi-hoc"): giờ, tên lớp, ghi chú của lớp (có thể rỗng). */
export interface TodoSession { courseLine: string; range: string; topic: string; dayText: string; href: string; cancelled: boolean; place?: string; joinUrl?: string }

export interface StudentTodoItem {
  id: string;
  kind: "bai-tap" | "han-nop" | "buoi-hoc";
  title: string;
  subtitle: string;
  /** Mốc thời gian chính (hạn nộp / giờ bắt đầu), ISO. */
  at: string;
  /** Nhãn ngắn bên phải dòng: "Hôm nay", "Ngày mai", "Thứ 5", "22/09". */
  when: string;
  status: { label: string; tone: TodoTone };
  /** Việc cần học sinh ra tay → tính vào badge. */
  needsAction: boolean;
  /** Dòng đã xong / chỉ để biết. */
  done: boolean;
  detail: { heading: string; meta: string; commands: TodoCommand[]; sections: TodoSection[] };
  task?: TodoTask;
  session?: TodoSession;
}

const dm = (key: string) => `${key.slice(8, 10)}/${key.slice(5, 7)}`;

/** Số điểm theo cách viết Việt: dấu phẩy thập phân, bỏ ",0" thừa. */
export function fmtScore(n: number): string {
  return String(Math.round(n * 100) / 100).replace(".", ",");
}

/** "Hôm nay" / "Ngày mai" / "Thứ 5" (trong 6 ngày tới) / "22/09". */
export function whenLabel(at: Date, now: Date): string {
  const k = vnDateKeyOf(at), today = vnDateKeyOf(now);
  if (k === today) return "Hôm nay";
  if (k === addDaysKey(today, 1)) return "Ngày mai";
  for (let i = 2; i <= 6; i++) if (k === addDaysKey(today, i)) return DAY_LABELS_VI[dayOfWeekOfKey(k)];
  return dm(k);
}

/** "còn 3 giờ 50 phút" / "còn 2 ngày" / "quá hạn 1 ngày". */
export function remainingText(due: Date, now: Date): string {
  const ms = due.getTime() - now.getTime();
  const abs = Math.abs(ms);
  const d = Math.floor(abs / (24 * H)), h = Math.floor((abs % (24 * H)) / H), m = Math.floor((abs % H) / 60_000);
  const body = d >= 1 ? `${d} ngày${h ? ` ${h} giờ` : ""}` : h >= 1 ? `${h} giờ${m ? ` ${m} phút` : ""}` : `${Math.max(1, m)} phút`;
  return ms >= 0 ? `còn ${body}` : `quá hạn ${body}`;
}

/** "hạn hôm nay, 23:59" / "hạn Chủ nhật 25/10, 21:00" (dạng Figma Học sinh). */
export function dueTextOf(due: Date, now: Date): string {
  const w = whenLabel(due, now);
  const day = w === "Hôm nay" ? "hôm nay" : w === "Ngày mai" ? "ngày mai" : /^\d/.test(w) ? w : `${w} ${dm(vnDateKeyOf(due))}`;
  return `hạn ${day}, ${hmOf(vnMinutesOfDay(due))}`;
}
const timeOf = (t: Date) => hmOf(vnMinutesOfDay(t));
const dueLabel = (due: Date, now: Date) => {
  const w = whenLabel(due, now);
  return w === "Hôm nay" ? `hạn ${timeOf(due)} hôm nay` : w === "Ngày mai" ? `hạn ${timeOf(due)} ngày mai` : `hạn ${timeOf(due)} ${dm(vnDateKeyOf(due))}`;
};

function assignmentItem(a: TodoAssignment, now: Date): StudentTodoItem | null {
  const due = a.dueDate;
  if (!due) return null; // bài không có hạn không nằm trong "Việc của tôi"
  const interactive = a.mode === "interactive";
  const sub = a.submission;
  const link = `/student/bai-giang/${a.lessonId}`;
  const teacherLine = `${a.courseName}${a.teacher ? ` · ${a.teacher}` : ""} giao ${dm(vnDateKeyOf(a.createdAt))}`;
  const doneAt = sub ? (sub.gradedAt ?? sub.submittedAt) : null;
  const courseLine = `${a.courseName}${a.teacher ? ` · ${a.teacher}` : ""}`;
  const baseTask = { name: a.title, courseLine, dueText: dueTextOf(due, now), href: link, interactive };

  // Đã chấm
  if (sub && sub.score !== null && sub.gradedAt) {
    if (now.getTime() - sub.gradedAt.getTime() > DONE_KEEP_MS) return null;
    const total = a.maxPoints;
    return {
      id: `bai-tap:${a.id}`, kind: "bai-tap", title: `Đã chấm ${a.title}`, subtitle: `${fmtScore(sub.score)}/${fmtScore(total)} · ${a.courseName}`,
      at: sub.gradedAt.toISOString(), when: whenLabel(sub.gradedAt, now), status: { label: "Đã chấm", tone: "xong" }, needsAction: false, done: true,
      task: { ...baseTask, phase: "da-cham", scoreText: `${fmtScore(sub.score)}/${fmtScore(total)}`, gradedText: `Đã chấm ${dm(vnDateKeyOf(sub.gradedAt))}`, comment: sub.comment?.trim() || null },
      detail: {
        heading: a.title, meta: `${teacherLine} · đã chấm ${dm(vnDateKeyOf(sub.gradedAt))}`,
        commands: [{ label: "Xem bài", href: link, kind: "primary" }],
        sections: [
          { title: `Điểm ${fmtScore(sub.score)}/${fmtScore(total)}`, text: sub.comment?.trim() ? sub.comment.trim() : "Thầy/cô chưa ghi nhận xét." },
        ],
      },
    };
  }
  // Đã nộp (file) hoặc đã làm (trực tiếp trên web), chưa chấm
  if (sub || (interactive && a.answeredCount > 0)) {
    const at = doneAt ?? due;
    if (now.getTime() - at.getTime() > DONE_KEEP_MS) return null;
    const verb = interactive ? "làm" : "nộp";
    return {
      id: `bai-tap:${a.id}`, kind: "bai-tap", title: `Đã ${verb} ${a.title}`, subtitle: `${a.courseName} · chờ thầy/cô chấm`,
      at: at.toISOString(), when: whenLabel(at, now), status: { label: `Đã ${verb}`, tone: "mo" }, needsAction: false, done: true,
      task: { ...baseTask, phase: "cho-cham", sentText: sub ? `Nộp ${dm(vnDateKeyOf(sub.submittedAt))} lúc ${timeOf(sub.submittedAt)}` : "Đã có câu trả lời" },
      detail: {
        heading: a.title, meta: `${teacherLine} · ${dueLabel(due, now)}`,
        commands: [{ label: interactive ? "Xem lại bài làm" : "Xem bài đã nộp", href: link, kind: "primary" }],
        sections: [
          { title: sub ? `Đã nộp lúc ${timeOf(sub.submittedAt)} ${dm(vnDateKeyOf(sub.submittedAt))}` : "Đã có câu trả lời", text: "Đang chờ thầy/cô chấm." },
          ...(due.getTime() > now.getTime() && !interactive ? [{ title: "Muốn sửa?", text: "Nộp lại sẽ ghi đè bản cũ." }] : []),
        ],
      },
    };
  }
  // Chưa nộp
  const ms = due.getTime() - now.getTime();
  if (ms < -OVERDUE_KEEP_MS) return null;
  const overdue = ms < 0;
  const soon = !overdue && ms <= DUE_SOON_MS;
  const needsAction = overdue || ms <= ACTION_WINDOW_MS;
  const status = overdue ? { label: "Quá hạn", tone: "loi" as const } : soon ? { label: "Sắp hết hạn", tone: "cho" as const } : { label: "Cần nộp", tone: "mo" as const };
  const commands: TodoCommand[] = [{ label: interactive ? "Làm bài" : "Nộp bài", href: link, kind: "primary" }];
  if (a.fileUrl) commands.push({ label: "Xem đề", href: a.fileUrl, kind: "secondary", external: true });
  return {
    id: `bai-tap:${a.id}`, kind: "bai-tap", title: `${a.title} ${dueLabel(due, now)}`, subtitle: teacherLine,
    at: due.toISOString(), when: whenLabel(due, now), status, needsAction, done: false,
    task: { ...baseTask, phase: "chua-nop" },
    detail: {
      heading: `${a.title} ${dueLabel(due, now)}`,
      meta: `${a.courseName}${a.teacher ? ` · ${a.teacher}` : ""} giao ${dm(vnDateKeyOf(a.createdAt))} · ${remainingText(due, now)}`,
      commands,
      sections: [
        { title: interactive ? "Làm trực tiếp trên web" : "Cách nộp", text: a.instructions?.trim() || (interactive ? "Trả lời các câu hỏi ngay trong bài." : "Nộp ảnh chụp hoặc file PDF.") },
        { title: interactive ? "Chưa làm" : "Chưa nộp lần nào", text: interactive ? "Bài khoá lại khi hết hạn." : "Nộp lại sẽ ghi đè bản cũ." },
      ],
    },
  };
}

function eventAt(e: TodoEvent): Date | null {
  const m = parseHm(e.time);
  return m === null ? null : instantOf(e.isoDate, m);
}

function classItem(e: TodoEvent, now: Date): StudentTodoItem | null {
  const at = eventAt(e);
  if (!at) return null;
  const cancelled = e.topic.startsWith("[ĐÃ HUỶ]");
  const moved = e.topic.startsWith("[DỜI");
  const topic = e.topic.replace(/^\[[^\]]+\]\s*/, "");
  const nowKey = vnDateKeyOf(now);
  // Hiện buổi trong hôm nay (kể cả đã bắt đầu trong vòng 2 giờ, để vào lớp kịp) tới SESSION_AHEAD_DAYS ngày tới
  if (e.isoDate < nowKey || e.isoDate > addDaysKey(nowKey, SESSION_AHEAD_DAYS)) return null;
  if (at.getTime() < now.getTime() - 2 * H) return null;
  const prefix = cancelled ? "Buổi đã huỷ" : "Buổi";
  const status = cancelled ? { label: "Đã huỷ", tone: "loi" as const } : moved ? { label: "Đã dời", tone: "cho" as const } : { label: "Sắp tới", tone: "mo" as const };
  const link = e.link ?? "/student/lich-hoc";
  const place = placeLabel(e.mode, e.location) ?? undefined;
  const joinUrl = cancelled ? undefined : e.joinUrl;
  return {
    id: `buoi-hoc:${e.id}`, kind: "buoi-hoc", title: `${prefix} ${e.subject} ${e.time}`, subtitle: topic,
    at: at.toISOString(), when: whenLabel(at, now), status, needsAction: false, done: cancelled,
    session: { courseLine: topic.split(" — ")[0], range: e.endTime ? `${e.time}–${e.endTime}` : e.time, topic: topic.includes(" — ") ? topic.slice(topic.indexOf(" — ") + 3) : "", dayText: whenLabel(at, now), href: link, cancelled, place, joinUrl },
    detail: {
      heading: `${prefix} ${topic} ${e.time} ${whenLabel(at, now).toLowerCase()}`,
      meta: `${DAY_LABELS_VI[dayOfWeekOfKey(e.isoDate)]}, ${dm(e.isoDate)}${at.getTime() > now.getTime() ? ` · ${remainingText(at, now)}` : " · đang diễn ra hoặc vừa bắt đầu"}${place ? ` · ${place}` : ""}`,
      commands: cancelled
        ? [{ label: "Xem lịch", href: "/student/lich-hoc", kind: "primary" }]
        : [{ label: "Vào lớp", href: link, kind: "primary" }, ...(joinUrl ? [{ label: "Mở link học online", href: joinUrl, kind: "secondary" as const, external: true }] : []), { label: "Xem lịch", href: "/student/lich-hoc", kind: "secondary" }],
      sections: cancelled
        ? [{ title: "Buổi này đã huỷ", text: "Thầy/cô đã huỷ buổi này. Xem lịch để biết buổi học tiếp theo." }]
        : moved
          ? [{ title: "Buổi này đã được dời", text: "Giờ trên là giờ mới. Xem lịch để đối chiếu." }]
          : [{ title: "Chuẩn bị", text: "Vào lớp từ nút bên trên. Có bài cũ chưa nộp thì nộp trước giờ học." }],
    },
  };
}

function deadlineItem(e: TodoEvent, now: Date): StudentTodoItem | null {
  const at = eventAt(e);
  if (!at) return null;
  const nowKey = vnDateKeyOf(now);
  if (e.isoDate < nowKey || e.isoDate > addDaysKey(nowKey, DEADLINE_AHEAD_DAYS)) return null;
  const ms = at.getTime() - now.getTime();
  const soon = ms <= DUE_SOON_MS;
  const needsAction = ms <= ACTION_WINDOW_MS;
  const commands: TodoCommand[] = e.link ? [{ label: "Mở bài", href: e.link, kind: "primary", external: /^https?:/.test(e.link) }] : [{ label: "Xem lịch", href: "/student/lich-hoc", kind: "primary" }];
  return {
    id: `han-nop:${e.id}`, kind: "han-nop", title: `${e.topic} ${dueLabel(at, now)}`, subtitle: e.subject,
    at: at.toISOString(), when: whenLabel(at, now), status: soon ? { label: "Sắp hết hạn", tone: "cho" } : { label: "Có hạn nộp", tone: "mo" }, needsAction, done: false,
    detail: {
      heading: `${e.topic} ${dueLabel(at, now)}`, meta: `${e.subject} · ${remainingText(at, now)}`, commands,
      sections: [{ title: "Hạn nộp", text: "Bài này nộp ở ngoài KiN (đường dẫn trong nút trên). KiN chỉ nhắc hạn, không biết bạn đã nộp chưa." }],
    },
  };
}

/** Gộp, sắp xếp: việc cần ra tay (hạn gần nhất trước) → buổi sắp tới → việc đã xong (mới nhất trước). */
export function buildStudentTodo(input: { assignments: TodoAssignment[]; events: TodoEvent[]; now: Date }): { items: StudentTodoItem[]; badge: number } {
  const { now } = input;
  const all: StudentTodoItem[] = [];
  for (const a of input.assignments) { const it = assignmentItem(a, now); if (it) all.push(it); }
  for (const e of input.events) {
    const it = e.type === "class" ? classItem(e, now) : e.type === "deadline" ? deadlineItem(e, now) : null;
    if (it) all.push(it);
  }
  const rank = (i: StudentTodoItem) => (i.needsAction ? 0 : i.done ? 2 : 1);
  all.sort((x, y) => rank(x) - rank(y) || (rank(x) === 2 ? y.at.localeCompare(x.at) : x.at.localeCompare(y.at)) || x.id.localeCompare(y.id));
  const items = all.slice(0, MAX_ITEMS);
  return { items, badge: items.filter(i => i.needsAction).length };
}

