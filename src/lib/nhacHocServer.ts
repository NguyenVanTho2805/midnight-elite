// LOI-04 — phần có DB của "Nhắc học": đọc danh sách, kiểm gắn lớp/bài, đọc thân yêu cầu có giới hạn, tóm tắt sáng (cron nhac-hoc-sang).
// Phần thuần: src/lib/nhacHoc.ts. Đặc tả: docs/kin/phong-ban/dac-ta/LOI-04.md mục 4.2 + 7.
//
// Quyền nằm TRONG `where`: mọi truy vấn StudentReminder có `userId` của chủ phiên. Gắn lớp chỉ khi Enrollment của CHÍNH em `active`
// và bài `published` (ĐÓNG KHI LẠ). Kiểm lại cả lúc ĐỌC: bài chuyển nháp / em nghỉ lớp ⇒ `lop: null`, không lộ tên bài.
// Mục tự động theo lớp = loadHomNay của LOI-03 (không viết truy vấn bài thứ hai cho giao diện).
// Ghi chú / tiêu đề là dữ liệu cá nhân: không vào log, không vào thông báo. Log lỗi chỉ ghi tên lỗi.
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { loadHomNay } from "@/lib/studentLopServer";
import { lessonHref, vnWindow } from "@/lib/studentLop";
import {
  NHAC_MAX_PER_USER, NHAC_BODY_MAX_BYTES, NHAC_ATTACH_ERROR, NHAC_BAD_JSON_ERROR, NHAC_TOO_BIG_ERROR, NHAC_HREF,
  nhacItemOf, studyTodayText, reminderDueText,
  type NhacItem, type NhacLop, type NhacResp, type NhacRow,
} from "@/lib/nhacHoc";

const ACTIVE = "active";

/** Cột được đọc ra — KHÔNG có userId, notifiedAt. courseId/lessonId chỉ dùng nội bộ để dựng `lop` đã kiểm quyền. */
export const NHAC_SELECT = {
  id: true, title: true, note: true, tags: true, dueAt: true, dueHasTime: true, doneAt: true, createdAt: true, courseId: true, lessonId: true,
} as const;
type Row = NhacRow & { courseId: string | null; lessonId: string | null };

/** Tên lỗi an toàn để log (không message: lỗi Prisma có thể chép lại giá trị dữ liệu). */
export function errName(e: unknown): string {
  if (e && typeof e === "object") {
    const code = (e as { code?: unknown }).code;
    const name = e instanceof Error ? e.name : "Error";
    return typeof code === "string" ? `${name} ${code}` : name;
  }
  return "lỗi không rõ";
}

// ── Gắn lớp khi ĐỌC: hai truy vấn cho mọi mục (không N+1) ─────────────────────────

/** Dựng `lop` cho từng hàng. Lớp phải còn Enrollment `active` của em; bài phải `published` VÀ thuộc lớp đó — ngược lại `lop: null`. */
export async function resolveLops(userId: string, rows: readonly { courseId: string | null; lessonId: string | null }[]): Promise<(NhacLop | null)[]> {
  const courseRefs = new Set<string>();
  const lessonRefs = new Set<string>();
  for (const r of rows) {
    if (r.courseId) courseRefs.add(r.courseId);
    if (r.lessonId) lessonRefs.add(r.lessonId);
  }
  if (courseRefs.size === 0 && lessonRefs.size === 0) return rows.map(() => null);

  const [lessons, enrolls] = await Promise.all([
    lessonRefs.size === 0 ? [] : prisma.lesson.findMany({
      where: { id: { in: [...lessonRefs] }, status: "published" },
      select: { id: true, title: true, chapter: { select: { section: { select: { courseId: true } } } } },
    }),
    // Lớp của bài cũng phải được kiểm ⇒ tra enrollment theo CẢ courseId lưu sẵn lẫn lớp của bài (một truy vấn: lọc lớp của em, không lọc theo danh sách).
    prisma.enrollment.findMany({
      where: { userId, status: ACTIVE },
      select: { courseId: true, course: { select: { name: true } } },
    }),
  ]);
  const activeName = new Map(enrolls.map(e => [e.courseId, e.course.name]));
  const lessonBy = new Map(lessons.map(l => [l.id, { title: l.title, courseId: l.chapter.section.courseId }]));

  return rows.map(r => {
    if (r.lessonId) {
      const l = lessonBy.get(r.lessonId);
      const name = l ? activeName.get(l.courseId) : undefined;
      if (!l || name === undefined) return null;
      return { courseId: l.courseId, courseName: name, lessonId: r.lessonId, lessonTitle: l.title, href: lessonHref(r.lessonId) };
    }
    if (r.courseId) {
      const name = activeName.get(r.courseId);
      if (name === undefined) return null;
      return { courseId: r.courseId, courseName: name, lessonId: null, lessonTitle: null, href: `/student/hoc-tap?course=${encodeURIComponent(r.courseId)}` };
    }
    return null;
  });
}

export async function toItems(userId: string, rows: readonly Row[]): Promise<NhacItem[]> {
  const lops = await resolveLops(userId, rows);
  return rows.map((r, i) => nhacItemOf(r, lops[i]));
}

/** GET /api/student/nhac-hoc. Mốc "hôm nay" do máy chủ cấp qua `now`/`todayKey`. */
export async function loadNhac(userId: string, now: Date): Promise<NhacResp> {
  const [rows, used, lop] = await Promise.all([
    prisma.studentReminder.findMany({ where: { userId }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: NHAC_MAX_PER_USER, select: NHAC_SELECT }),
    prisma.studentReminder.count({ where: { userId } }),
    loadHomNay(userId, now),
  ]);
  return { now: now.toISOString(), todayKey: lop.todayKey, items: await toItems(userId, rows), lop, used, max: NHAC_MAX_PER_USER };
}

// ── Gắn lớp khi GHI ─────────────────────────────────────────────────────────────

export type AttachResult = { ok: true; courseId: string | null; lessonId: string | null } | { ok: false; error: string };

/** lessonId ⇒ bài `published` thuộc lớp có Enrollment `active` của em; courseId suy từ bài (gửi kèm mà lệch ⇒ lỗi).
 *  Chỉ courseId ⇒ Enrollment `active`. Sai mọi kiểu ⇒ CÙNG một lỗi (không lộ là bài nháp hay không tồn tại). */
export async function checkAttach(userId: string, courseId?: string | null, lessonId?: string | null): Promise<AttachResult> {
  const fail = { ok: false as const, error: NHAC_ATTACH_ERROR };
  if (lessonId) {
    const l = await prisma.lesson.findFirst({
      where: { id: lessonId, status: "published", chapter: { section: { course: { enrollments: { some: { userId, status: ACTIVE } } } } } },
      select: { chapter: { select: { section: { select: { courseId: true } } } } },
    });
    if (!l) return fail;
    const cid = l.chapter.section.courseId;
    if (courseId && courseId !== cid) return fail;
    return { ok: true, courseId: cid, lessonId };
  }
  if (courseId) {
    const e = await prisma.enrollment.findFirst({ where: { userId, courseId, status: ACTIVE }, select: { id: true } });
    return e ? { ok: true, courseId, lessonId: null } : fail;
  }
  return { ok: true, courseId: null, lessonId: null };
}

// ── Đọc thân yêu cầu có giới hạn ─────────────────────────────────────────────────

export type BodyResult = { ok: true; value: unknown } | { ok: false; status: 400 | 413; error: string };

/** Thân > NHAC_BODY_MAX_BYTES ⇒ 413 (xét Content-Length trước, rồi số byte thật); JSON hỏng/rỗng ⇒ 400. */
export async function readNhacBody(req: Request): Promise<BodyResult> {
  const declared = Number(req.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > NHAC_BODY_MAX_BYTES) return { ok: false, status: 413, error: NHAC_TOO_BIG_ERROR };
  let text: string;
  try { text = await req.text(); } catch { return { ok: false, status: 400, error: NHAC_BAD_JSON_ERROR }; }
  if (Buffer.byteLength(text, "utf8") > NHAC_BODY_MAX_BYTES) return { ok: false, status: 413, error: NHAC_TOO_BIG_ERROR };
  try { return { ok: true, value: JSON.parse(text) as unknown }; } catch { return { ok: false, status: 400, error: NHAC_BAD_JSON_ERROR }; }
}

// ── Tóm tắt sáng (cron nhac-hoc-sang, 07:05 VN) ─────────────────────────────────

/** Tối đa bấy nhiêu học sinh một lượt; quá thì `partial: true` (người có id lớn hơn chờ lượt sau). */
export const DIGEST_MAX_USERS = 5000;
/** Trần bài có hẹn trong một ngày VN trên toàn hệ thống (chống quét vô hạn). */
const DIGEST_MAX_LESSONS = 5000;

const ELIGIBLE_STUDENT = { role: "student", banned: false, deletedAt: null } as const;

export interface DigestCount { userId: string; count: number }
export interface DigestPlan {
  dateKey: string;
  /** Đã trừ người đã có `study_today` từ 00:00 VN hôm nay. */
  studyToday: DigestCount[];
  /** Mục chưa xong, chưa báo, hẹn trong ngày VN hôm nay. `ids` chỉ dùng nội bộ (giành chỗ), không trả ra ngoài. */
  reminderDue: (DigestCount & { ids: string[] })[];
  alreadySent: { studyToday: number };
  partial: boolean;
}

/** Ai cần báo sáng nay. Chỉ ĐỌC. Hai truy vấn cho (a) (bài + enrollment), một cho (b), một cho chống trùng. */
export async function planMorningDigest(now: Date): Promise<DigestPlan> {
  const { todayKey, from, until } = vnWindow(now, 0);

  // (a) Buổi học hôm nay: bài published có scheduledAt trong ngày VN hôm nay, đếm theo enrollment active.
  const lessons = await prisma.lesson.findMany({
    where: { status: "published", scheduledAt: { gte: from, lt: until } },
    select: { id: true, chapter: { select: { section: { select: { courseId: true } } } } },
    orderBy: { id: "asc" },
    take: DIGEST_MAX_LESSONS,
  });
  const perCourse = new Map<string, number>();
  for (const l of lessons) {
    const cid = l.chapter.section.courseId;
    perCourse.set(cid, (perCourse.get(cid) ?? 0) + 1);
  }
  const enrolls = perCourse.size === 0 ? [] : await prisma.enrollment.findMany({
    where: { courseId: { in: [...perCourse.keys()] }, status: ACTIVE, user: ELIGIBLE_STUDENT },
    select: { userId: true, courseId: true },
  });
  const studyBy = new Map<string, number>();
  const seenPair = new Set<string>();
  for (const e of enrolls) {
    const k = `${e.userId}\u0000${e.courseId}`;
    if (seenPair.has(k)) continue;
    seenPair.add(k);
    studyBy.set(e.userId, (studyBy.get(e.userId) ?? 0) + (perCourse.get(e.courseId) ?? 0));
  }

  // (b) Nhắc việc đến hạn hôm nay: chưa xong, chưa báo.
  const due = await prisma.studentReminder.findMany({
    where: { doneAt: null, notifiedAt: null, dueAt: { gte: from, lt: until }, user: ELIGIBLE_STUDENT },
    select: { id: true, userId: true },
    orderBy: { id: "asc" },
  });
  const dueBy = new Map<string, string[]>();
  for (const r of due) {
    const arr = dueBy.get(r.userId) ?? [];
    arr.push(r.id);
    dueBy.set(r.userId, arr);
  }

  // Trần người/lượt: theo id tăng để chạy ổn định.
  const allUsers = [...new Set([...studyBy.keys(), ...dueBy.keys()])].sort();
  const partial = allUsers.length > DIGEST_MAX_USERS;
  const inRun = new Set(allUsers.slice(0, DIGEST_MAX_USERS));

  // Chống trùng (a): bỏ người đã có study_today từ 00:00 VN hôm nay (mẫu unmarkedDailyServer.ts:30-34).
  const studyCandidates = [...studyBy.keys()].filter(u => inRun.has(u));
  const sent = studyCandidates.length === 0 ? [] : await prisma.notification.findMany({
    where: { type: "study_today", userId: { in: studyCandidates }, createdAt: { gte: from } },
    select: { userId: true },
  });
  const sentSet = new Set(sent.map(n => n.userId));

  const studyToday = studyCandidates.filter(u => !sentSet.has(u)).sort().map(userId => ({ userId, count: studyBy.get(userId) ?? 0 }));
  const reminderDue = [...dueBy.keys()].filter(u => inRun.has(u)).sort().map(userId => {
    const ids = dueBy.get(userId) ?? [];
    return { userId, count: ids.length, ids };
  });
  return { dateKey: todayKey, studyToday, reminderDue, alreadySent: { studyToday: sentSet.size }, partial };
}

export interface DigestResult {
  dryRun: boolean;
  dateKey: string;
  studyToday: DigestCount[];
  reminderDue: DigestCount[];
  alreadySent: { studyToday: number };
  notified?: { studyToday: number; reminderDue: number };
  partial?: true;
}

/** dryRun ⇒ không ghi gì (không Notification, không notifiedAt). Chạy thật ⇒ (a) notify study_today; (b) GIÀNH CHỖ notifiedAt trước rồi mới notify.
 *  Chạy lại cùng ngày ⇒ 0 tin mới. Phản hồi chỉ có id + số. Không đẩy web push: hai loại này ngoài PUSH_TYPES (notify.ts:38). */
export async function runMorningDigest(now: Date, o: { dryRun: boolean }): Promise<DigestResult> {
  const plan = await planMorningDigest(now);
  const base = {
    dateKey: plan.dateKey,
    alreadySent: plan.alreadySent,
    ...(plan.partial ? { partial: true as const } : {}),
  };
  if (o.dryRun) {
    return { dryRun: true, ...base, studyToday: plan.studyToday, reminderDue: plan.reminderDue.map(({ userId, count }) => ({ userId, count })) };
  }

  let nStudy = 0;
  for (const s of plan.studyToday) {
    await notify(s.userId, { type: "study_today", ...studyTodayText(s.count), link: NHAC_HREF });
    nStudy++;
  }

  let nDue = 0;
  const dueOut: DigestCount[] = [];
  for (const r of plan.reminderDue) {
    // Giành chỗ: chỉ mục còn notifiedAt null mới được đánh dấu ⇒ hai lượt chạy chồng nhau không báo hai lần cùng mục.
    const claimed = await prisma.studentReminder.updateMany({
      where: { id: { in: r.ids }, userId: r.userId, notifiedAt: null, doneAt: null },
      data: { notifiedAt: now },
    });
    if (claimed.count === 0) continue;
    await notify(r.userId, { type: "reminder_due", ...reminderDueText(claimed.count), link: NHAC_HREF });
    dueOut.push({ userId: r.userId, count: claimed.count });
    nDue++;
  }
  return { dryRun: false, ...base, studyToday: plan.studyToday, reminderDue: dueOut, notified: { studyToday: nStudy, reminderDue: nDue } };
}
