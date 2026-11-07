// BU-02 / BU-02-PHẲNG — phần CÓ DB của Giáo trình (phần thuần: giaoTrinh.ts, lessonStatus.ts). Mọi hàm ở đây nhận courseId ĐÃ được route kiểm chủ (requireCourseTutor); chúng KHÔNG tự tin id do client gửi:
// bài/chương phải thuộc đúng lớp (kiểm khoá ngoại), tệp KiN phải của chính gia sư. Không có tên học sinh ở đây (không đọc Enrollment/User của học sinh).
import { randomUUID } from "node:crypto";
import { prisma } from "./prisma";
import { documentUploadConfig } from "./mediaStorageServer";
import {
  buildEntries, groupsForViewer, deriveItems, isGenericTree, kinFileIdOf, MAX_ITEM_NAME, pickUngroupedChapter, placeItem, removeItem, routeInput,
  type GiaoTrinhSnapshot, type GtConfig, type GtItem, type LessonRow, type TreeSection,
} from "./giaoTrinh";
import { isLessonStatus, publishBlockFor, transitionError, type LessonStatus } from "./lessonStatus";
import { type MediaSlot } from "./mediaLink";
import { contentHref } from "./tutorRoutes";
import { claimUploadedDocuments } from "./lessonMediaServer";

export { claimUploadedDocuments };

const LESSON_COLS = { id: true, title: true, type: true, status: true, isLocked: true, isFree: true, duration: true, videoUrl: true, zoomUrl: true, azotaUrl: true, azotaDeadline: true, documents: true } as const;

/** Tổng byte tài liệu ĐÃ tải xong của một gia sư (hạn mức 500 MB). */
export async function usedDocumentBytes(ownerId: string): Promise<number> {
  const r = await prisma.fileAsset.aggregate({ where: { ownerId, kind: "document", status: "ready" }, _sum: { bytes: true } });
  return r._sum.bytes ?? 0;
}

export async function loadConfig(ownerId: string): Promise<GtConfig> {
  const d = documentUploadConfig();   // BU-02-PHẲNG: không còn khối video — giao diện gia sư không tải video
  return { document: { enabled: d.enabled, reason: d.reason, maxBytes: d.maxBytes, quotaBytes: d.quotaBytes, usedBytes: await usedDocumentBytes(ownerId), exts: d.exts } };
}

const TREE_SELECT = {
  id: true, title: true, isImplicit: true,
  chapters: {
    orderBy: { order: "asc" as const },
    select: { id: true, title: true, isImplicit: true, teacherId: true, lessons: { orderBy: { order: "asc" as const }, select: { ...LESSON_COLS, _count: { select: { assignments: { where: { mode: { not: "azota" } } } } } } } },
  },
};

/** Bản chụp Giáo trình (danh sách phẳng) của MỘT lớp (G1). null = không có lớp. Quyền do người gọi kiểm. Chủ lớp thấy cả Nháp/Ẩn. */
export async function loadGiaoTrinh(courseId: string, viewer: { userId: string; seeTeacherIds: boolean }): Promise<GiaoTrinhSnapshot | null> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, name: true, ownerId: true, sections: { orderBy: { order: "asc" }, select: TREE_SELECT } },
  });
  if (!course) return null;
  const exams = await prisma.exam.findMany({
    where: { courseId, ...(course.ownerId ? { ownerId: course.ownerId } : {}) },
    orderBy: { createdAt: "desc" }, take: 100, select: { id: true, title: true },
  });
  const assignmentsByLesson: Record<string, number> = {};
  const tree: TreeSection[] = course.sections.map(sec => ({
    id: sec.id, title: sec.title, isImplicit: sec.isImplicit,
    chapters: sec.chapters.map(ch => ({
      id: ch.id, title: ch.title, isImplicit: ch.isImplicit, teacherId: ch.teacherId,
      lessons: ch.lessons.map(l => { assignmentsByLesson[l.id] = l._count.assignments; return l; }),
    })),
  }));
  const { entries, groups: rawGroups } = buildEntries(tree, { assignmentsByLesson });
  const groups = groupsForViewer(rawGroups, viewer.userId, viewer.seeTeacherIds);   // userId giáo viên bộ môn chỉ chủ lớp / quản trị thấy; người khác nhận assignedTo
  const counts = { draft: 0, published: 0, hidden: 0 };
  for (const e of entries) counts[e.status]++;
  return {
    courseId: course.id, courseName: course.name, entries, groups, counts,
    exams: exams.map((e): GtItem => ({
      key: `exam:${e.id}`, kind: "exam", slot: null, name: e.title, url: null, label: "Bài kiểm tra", storage: "link", warning: null, broken: false,
      href: contentHref(true, `/admin/thi-thu/${e.id}`),
    })),
    config: await loadConfig(course.ownerId ?? ""),
  };
}

/** Bài để "Xem như học sinh": cột đầy đủ của MỘT bài, chỉ khi bài thuộc đúng lớp. Người gọi tự đưa qua lessonFor() để dựng hai góc nhìn. `status` đi kèm để hiện băng Nháp/Ẩn. */
export async function loadLessonPreview(courseId: string, lessonId: string) {
  const l = await prisma.lesson.findFirst({
    where: { id: lessonId, chapter: { section: { courseId } } },
    select: { ...LESSON_COLS, chapter: { select: { section: { select: { courseId: true, course: { select: { name: true, ownerId: true } } } } } } },
  });
  if (!l) return null;
  const { chapter, ...lesson } = l;
  return { courseId, courseName: chapter.section.course.name, courseOwnerId: chapter.section.course.ownerId, lesson };
}

// ── chương ngầm / nhóm (dùng trong giao dịch có khoá `course_tree:<id>`) ────────────────────────────────

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
const lockTree = (tx: Tx, courseId: string) => tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`course_tree:${courseId}`}))`;
const lockLesson = (tx: Tx, lessonId: string) => tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`lesson:${lessonId}`}))`;

async function readTree(tx: Tx, courseId: string): Promise<TreeSection[]> {
  const secs = await tx.section.findMany({
    where: { courseId }, orderBy: { order: "asc" },
    select: { id: true, title: true, isImplicit: true, chapters: { orderBy: { order: "asc" }, select: { id: true, title: true, isImplicit: true } } },
  });
  return secs.map(s => ({ ...s, chapters: s.chapters.map(c => ({ ...c, lessons: [] })) }));
}

/** Phần ngầm của lớp (tạo nếu chưa có, order nhỏ nhất ⇒ đứng đầu). Phải gọi trong giao dịch đã khoá cây lớp. */
async function ensureImplicitSection(tx: Tx, courseId: string): Promise<string> {
  const have = await tx.section.findFirst({ where: { courseId, isImplicit: true }, orderBy: { order: "asc" }, select: { id: true } });
  if (have) return have.id;
  const min = await tx.section.aggregate({ where: { courseId }, _min: { order: true } });
  const created = await tx.section.create({ data: { id: `sec-${randomUUID()}`, title: "Nội dung lớp", order: min._min.order === null || min._min.order === undefined ? 0 : min._min.order - 1, courseId, isImplicit: true }, select: { id: true } });
  return created.id;
}

/** Chương không nhóm của lớp (quy tắc 4 mục 3): chương ngầm → chương của cây "chung" → tạo phần ngầm + chương ngầm. Trong giao dịch đã khoá cây lớp. */
async function ensureUngroupedChapter(tx: Tx, courseId: string): Promise<string> {
  const picked = pickUngroupedChapter(await readTree(tx, courseId));
  if (picked) return picked.chapterId;
  const sectionId = await ensureImplicitSection(tx, courseId);
  const min = await tx.chapter.aggregate({ where: { sectionId }, _min: { order: true } });
  const ch = await tx.chapter.create({ data: { id: `ch-${randomUUID()}`, title: "Bài học", order: min._min.order === null || min._min.order === undefined ? 0 : min._min.order - 1, sectionId, isImplicit: true }, select: { id: true } });
  return ch.id;
}

const GROUP_TITLE_MAX = 120;
export const cleanGroupTitle = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t && t.length <= GROUP_TITLE_MAX ? t : null;
};

export type GroupResult<T = object> = ({ ok: true } & T) | { ok: false; status: 400 | 404; error: string };
const gfail = (status: 400 | 404, error: string): { ok: false; status: 400 | 404; error: string } => ({ ok: false, status, error });

/** G6 POST. "Thêm chương": nếu lớp ở trạng thái "chung" thì lật cờ ngầm cho Phần 1/Chương 1 cũ (không dời bài), rồi tạo chương có tên trong phần ngầm. */
export async function createGroup(courseId: string, title: string): Promise<GroupResult<{ id: string; title: string }>> {
  const t = cleanGroupTitle(title);
  if (!t) return gfail(400, `Tên chương cần từ 1 đến ${GROUP_TITLE_MAX} ký tự.`);
  return prisma.$transaction(async (tx) => {
    await lockTree(tx, courseId);
    const tree = await readTree(tx, courseId);
    if (isGenericTree(tree)) {
      await tx.section.update({ where: { id: tree[0].id }, data: { isImplicit: true } });
      await tx.chapter.update({ where: { id: tree[0].chapters[0].id }, data: { isImplicit: true } });
    }
    const sectionId = await ensureImplicitSection(tx, courseId);
    const max = await tx.chapter.aggregate({ where: { sectionId }, _max: { order: true } });
    const ch = await tx.chapter.create({ data: { id: `ch-${randomUUID()}`, title: t, order: (max._max.order ?? 0) + 1, sectionId, isImplicit: false }, select: { id: true, title: true } });
    return { ok: true as const, id: ch.id, title: ch.title };
  }, { timeout: 15000 });
}

/** G6 PATCH. Đổi tên nhóm. */
export async function renameGroup(courseId: string, chapterId: string, title: string): Promise<GroupResult<{ id: string; title: string }>> {
  const t = cleanGroupTitle(title);
  if (!t) return gfail(400, `Tên chương cần từ 1 đến ${GROUP_TITLE_MAX} ký tự.`);
  return prisma.$transaction(async (tx) => {
    await lockTree(tx, courseId);
    const ch = await tx.chapter.findFirst({ where: { id: chapterId, section: { courseId } }, select: { id: true, isImplicit: true } });
    if (!ch) return gfail(404, "Không tìm thấy chương trong lớp này.");
    if (ch.isImplicit) return gfail(400, "Đây không phải nhóm.");
    const u = await tx.chapter.update({ where: { id: chapterId }, data: { title: t }, select: { id: true, title: true } });
    return { ok: true as const, id: u.id, title: u.title };
  }, { timeout: 15000 });
}

/** G6 DELETE = "Bỏ nhóm": mọi mục chuyển về chương không nhóm rồi xoá chương (đã trống). KHÔNG BAO GIỜ xoá Lesson. */
export async function ungroup(courseId: string, chapterId: string): Promise<GroupResult<{ moved: number }>> {
  return prisma.$transaction(async (tx) => {
    await lockTree(tx, courseId);
    const tree = await readTree(tx, courseId);
    const ch = await tx.chapter.findFirst({ where: { id: chapterId, section: { courseId } }, select: { id: true, isImplicit: true } });
    if (!ch) return gfail(404, "Không tìm thấy chương trong lớp này.");
    if (ch.isImplicit || isGenericTree(tree)) return gfail(400, "Đây không phải nhóm.");
    const target = await ensureUngroupedChapter(tx, courseId);
    if (target === chapterId) return gfail(400, "Đây không phải nhóm.");
    const lessons = await tx.lesson.findMany({ where: { chapterId }, orderBy: { order: "asc" }, select: { id: true } });
    const max = await tx.lesson.aggregate({ where: { chapterId: target }, _max: { order: true } });
    let o = max._max.order ?? 0;
    for (const l of lessons) await tx.lesson.update({ where: { id: l.id }, data: { chapterId: target, order: ++o } });
    const left = await tx.lesson.count({ where: { chapterId } });
    if (left === 0) await tx.chapter.delete({ where: { id: chapterId } });
    return { ok: true as const, moved: lessons.length };
  }, { timeout: 15000 });
}

// ── trạng thái (G4, G5) ─────────────────────────────────────────────────────────────────────────────────

export type SetResult =
  | { ok: true; id: string; status: LessonStatus; groupId: string | null; changed: boolean }
  | { ok: false; status: 404 | 409; error: string };

/** Một mục: kiểm thuộc lớp, đọc trạng thái hiện tại TRONG giao dịch (đã khoá bài), kiểm luật chuyển + publishBlock, ghi. Bằng trạng thái hiện tại ⇒ ok, không ghi. */
async function applyStatus(tx: Tx, courseId: string, lessonId: string, to: LessonStatus): Promise<SetResult> {
  const l = await tx.lesson.findFirst({
    where: { id: lessonId, chapter: { section: { courseId } } },
    select: { ...LESSON_COLS, chapterId: true, chapter: { select: { isImplicit: true } }, _count: { select: { assignments: { where: { mode: { not: "azota" } } } } } },
  });
  if (!l) return { ok: false, status: 404, error: "Không tìm thấy mục trong lớp này." };
  const from: LessonStatus = isLessonStatus(l.status) ? l.status : "draft";
  const groupId = l.chapter.isImplicit ? null : l.chapterId;
  if (from === to && isLessonStatus(l.status)) return { ok: true, id: l.id, status: from, groupId, changed: false };
  const bad = transitionError(from, to);
  if (bad) return { ok: false, status: 409, error: bad };
  if (to === "published") {
    const block = publishBlockFor({ items: deriveItems(l, { assignments: l._count.assignments }), selfSubmitCount: l._count.assignments });
    if (block) return { ok: false, status: 409, error: block };
  }
  await tx.lesson.update({ where: { id: lessonId }, data: { status: to } });
  return { ok: true, id: l.id, status: to, groupId, changed: true };
}

/** G4. `status` và/hoặc `groupId` (null = đưa về không nhóm). Khoá advisory `lesson:<id>`; trạng thái đọc lại trong giao dịch. */
export async function patchLesson(courseId: string, lessonId: string, input: { status?: LessonStatus; groupId?: string | null }): Promise<SetResult> {
  return prisma.$transaction(async (tx) => {
    if (input.groupId !== undefined) await lockTree(tx, courseId);
    await lockLesson(tx, lessonId);
    const exists = await tx.lesson.findFirst({ where: { id: lessonId, chapter: { section: { courseId } } }, select: { id: true } });
    if (!exists) return { ok: false as const, status: 404 as const, error: "Không tìm thấy mục trong lớp này." };
    // Thứ tự: kiểm nhóm đích tồn tại → đổi trạng thái (có thể 409, chưa ghi gì) → rồi mới tạo chương không nhóm (nếu cần) và dời bài.
    let namedTarget: string | null = null;
    if (typeof input.groupId === "string") {
      const g = await tx.chapter.findFirst({ where: { id: input.groupId, section: { courseId }, isImplicit: false }, select: { id: true } });
      if (!g) return { ok: false as const, status: 404 as const, error: "Không tìm thấy nhóm trong lớp này." };
      namedTarget = g.id;
    }
    let r: SetResult = { ok: true, id: lessonId, status: "draft", groupId: null, changed: false };
    if (input.status !== undefined) {
      r = await applyStatus(tx, courseId, lessonId, input.status);
      if (!r.ok) return r;
    }
    if (input.groupId !== undefined) {
      const target = namedTarget ?? await ensureUngroupedChapter(tx, courseId);
      const cur = await tx.lesson.findUnique({ where: { id: lessonId }, select: { chapterId: true } });
      if (cur && cur.chapterId !== target) {
        const max = await tx.lesson.aggregate({ where: { chapterId: target }, _max: { order: true } });
        await tx.lesson.update({ where: { id: lessonId }, data: { chapterId: target, order: (max._max.order ?? 0) + 1 } });
      }
    }
    const after = await tx.lesson.findUnique({ where: { id: lessonId }, select: { status: true, chapterId: true, chapter: { select: { isImplicit: true } } } });
    return { ok: true as const, id: lessonId, status: (isLessonStatus(after?.status) ? after.status : "draft") as LessonStatus, groupId: after && !after.chapter.isImplicit ? after.chapterId : null, changed: r.ok ? r.changed : false };
  }, { timeout: 15000 });
}

/** G5. Mọi id phải thuộc lớp, nếu không ⇒ null (route trả 404, KHÔNG ghi gì). Mỗi id theo luật G4; id không đổi được vào `skipped`. */
export async function patchStatusBulk(courseId: string, lessonIds: string[], to: LessonStatus): Promise<{ changed: string[]; skipped: { id: string; reason: string }[] } | null> {
  const ids = [...new Set(lessonIds)].sort();
  return prisma.$transaction(async (tx) => {
    for (const id of ids) await lockLesson(tx, id);
    const own = await tx.lesson.count({ where: { id: { in: ids }, chapter: { section: { courseId } } } });
    if (own !== ids.length) return null;
    const changed: string[] = [], skipped: { id: string; reason: string }[] = [];
    for (const id of ids) {
      const r = await applyStatus(tx, courseId, id, to);
      if (!r.ok) skipped.push({ id, reason: r.error });
      else if (r.changed) changed.push(id);
      else skipped.push({ id, reason: "Đã ở trạng thái này." });
    }
    return { changed, skipped };
  }, { timeout: 20000 });
}

// ── G2 ──────────────────────────────────────────────────────────────────────────────────────────────────

/** `slot` (tuỳ chọn) = ô mà giao diện MUỐN đặt vào; có thì link phải hợp ô đó. Không có ⇒ máy chủ tự chọn ô bằng routeInput. `publish` chỉ có nghĩa khi TẠO mục mới (mặc định Nháp). */
export type AddItemInput = { lessonId?: string; chapterId?: string; newLessonTitle?: string; url: string; name?: string; from?: "library"; slot?: MediaSlot; publish?: boolean };
export type AddItemResult =
  | { ok: true; status: 200 | 201; duplicate: boolean; item: GtItem; lessonId: string; lessonStatus: LessonStatus; created: { lesson: boolean }; warning: string | null }
  | { ok: false; status: 400 | 403 | 404; code: "link" | "gioi-han" | "quyen" | "khong-co"; error: string; moveTo?: string };

const NO_CFG: GtConfig = { document: { enabled: false, reason: null, maxBytes: 0, quotaBytes: 0, usedBytes: 0, exts: [] } };
const limitMsg = (e: string) => /tối đa/i.test(e);
const lessonRow = (l: { videoUrl: string | null; zoomUrl: string | null; azotaUrl: string | null; documents: string | null; title: string }): LessonRow => l;
const EMPTY_ROW: LessonRow = { videoUrl: null, zoomUrl: null, azotaUrl: null, documents: "[]" };

/**
 * G2. Trong MỘT giao dịch có khoá advisory theo bài (hoặc theo cây lớp khi tạo mục mới): link sai/độc KHÔNG tạo gì (kể cả chương ngầm).
 * Không `lessonId` ⇒ tạo MỤC MỚI (một Lesson) ở `chapterId` hoặc chương không nhóm, `status` = publish ? published : draft. Có `lessonId` ⇒ gắn thêm, không đổi status.
 * `courseId` đã được người gọi chứng minh là của gia sư `userId`.
 */
export async function addItem(courseId: string, userId: string, input: AddItemInput): Promise<AddItemResult> {
  const url = typeof input.url === "string" ? input.url.trim() : "";
  const fail = (status: 400 | 403 | 404, code: "link" | "gioi-han" | "quyen" | "khong-co", error: string, moveTo?: string): AddItemResult => ({ ok: false, status, code, error, ...(moveTo ? { moveTo } : {}) });
  if (!url) return fail(400, "link", "Chưa dán link hoặc chọn tệp.");

  // 1) nhận diện + kiểm quyền với tệp KiN (trước mọi ghi). Video chỉ là YouTube: routeInput từ chối kin-media:/Vimeo/Zoom-bản-ghi.
  const kinId = kinFileIdOf(url);
  const routed = routeInput({ text: url }, NO_CFG);
  if (!routed.ok) return fail(400, "link", routed.error, routed.moveTo);
  if (kinId) {
    const a = await prisma.fileAsset.findUnique({ where: { id: kinId }, select: { ownerId: true, kind: true, status: true } });
    if (!a || a.kind !== "document" || a.status !== "ready") return fail(404, "khong-co", "Tệp này không còn trên KiN hoặc chưa tải xong.");
    if (a.ownerId !== userId) return fail(403, "quyen", "Tệp này do người khác tải lên, không dùng cho lớp của bạn được.");
  }

  const name = typeof input.name === "string" ? input.name.trim().slice(0, MAX_ITEM_NAME) : "";
  const slot = input.slot ?? routed.slot;

  return prisma.$transaction(async (tx): Promise<AddItemResult> => {
    if (input.lessonId) {
      await lockLesson(tx, input.lessonId);
      // Kiểm khoá ngoại: bài phải thuộc lớp trong đường dẫn (id từ client không đáng tin).
      const lesson = await tx.lesson.findFirst({ where: { id: input.lessonId, chapter: { section: { courseId } } }, select: { id: true, title: true, status: true, videoUrl: true, zoomUrl: true, azotaUrl: true, documents: true } });
      if (!lesson) return fail(404, "khong-co", "Không tìm thấy bài trong lớp này.");
      const placed = placeItem(lessonRow(lesson), { slot, url, name: name || routed.suggestedName });
      if (!placed.ok) return fail(400, limitMsg(placed.error) ? "gioi-han" : "link", placed.error, placed.moveTo);
      const st: LessonStatus = isLessonStatus(lesson.status) ? lesson.status : "draft";
      if (placed.duplicate) return { ok: true, status: 200, duplicate: true, item: placed.item, lessonId: lesson.id, lessonStatus: st, created: { lesson: false }, warning: null };
      await tx.lesson.update({ where: { id: lesson.id }, data: placed.patch as Record<string, string> });
      if (kinId) await tx.fileAsset.updateMany({ where: { id: kinId, lessonId: null }, data: { lessonId: lesson.id } });
      return { ok: true, status: 201, duplicate: false, item: placed.item, lessonId: lesson.id, lessonStatus: st, created: { lesson: false }, warning: routed.warning };
    }

    // Mục mới: khoá cây lớp để hai yêu cầu đầu tiên không cùng tạo chương ngầm. Kiểm link TRƯỚC mọi ghi (placeItem thuần trên bài rỗng).
    await lockTree(tx, courseId);
    const placed = placeItem(EMPTY_ROW, { slot, url, name: name || routed.suggestedName });
    if (!placed.ok) return fail(400, limitMsg(placed.error) ? "gioi-han" : "link", placed.error, placed.moveTo);
    let chapterId: string;
    if (input.chapterId) {
      const ch = await tx.chapter.findFirst({ where: { id: input.chapterId, section: { courseId } }, select: { id: true } });
      if (!ch) return fail(404, "khong-co", "Không tìm thấy chương trong lớp này.");
      chapterId = ch.id;
    } else chapterId = await ensureUngroupedChapter(tx, courseId);
    const title = (typeof input.newLessonTitle === "string" ? input.newLessonTitle.trim() : "").slice(0, MAX_ITEM_NAME) || name || routed.suggestedName || "Mục mới";
    const max = await tx.lesson.aggregate({ where: { chapterId }, _max: { order: true } });
    const status: LessonStatus = input.publish === true ? "published" : "draft";
    const created = await tx.lesson.create({
      data: { id: `l-${randomUUID()}`, code: `L${Date.now()}`, title, type: "document", documents: "[]", isLocked: true, isFree: false, order: (max._max.order ?? 0) + 1, chapterId, status, ...(placed.patch as Record<string, string>) },
      select: { id: true },
    });
    if (kinId) await tx.fileAsset.updateMany({ where: { id: kinId, lessonId: null }, data: { lessonId: created.id } });
    return { ok: true, status: 201, duplicate: false, item: placed.item, lessonId: created.id, lessonStatus: status, created: { lesson: true }, warning: routed.warning };
  }, { timeout: 15000 });
}

/** G3. Gỡ một mục khỏi bài (theo khoá). Gỡ hai lần ⇒ removed:false, không lỗi. KHÔNG xoá FileAsset (có thể đang dùng ở lớp khác). null = bài không thuộc lớp. */
export async function removeItemFromLesson(courseId: string, lessonId: string, key: string): Promise<{ removed: boolean } | null> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`lesson:${lessonId}`}))`;
    const l = await tx.lesson.findFirst({ where: { id: lessonId, chapter: { section: { courseId } } }, select: { id: true, videoUrl: true, zoomUrl: true, azotaUrl: true, documents: true } });
    if (!l) return null;
    const r = removeItem(l, key);
    if (r.removed) await tx.lesson.update({ where: { id: lessonId }, data: r.patch as Record<string, string> });
    return { removed: r.removed };
  }, { timeout: 15000 });
}
