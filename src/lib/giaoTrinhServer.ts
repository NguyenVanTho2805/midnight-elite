// BU-02 — phần CÓ DB của Giáo trình (phần thuần: giaoTrinh.ts). Mọi hàm ở đây nhận courseId ĐÃ được route kiểm chủ (requireCourseTutor); chúng KHÔNG tự tin id do client gửi:
// bài/chương phải thuộc đúng lớp (kiểm khoá ngoại), tệp KiN phải của chính gia sư. Không có tên học sinh ở đây (không đọc Enrollment/User của học sinh).
import { randomUUID } from "node:crypto";
import { prisma } from "./prisma";
import { documentUploadConfig, videoUploadConfig } from "./mediaStorageServer";
import { deriveItems, kinFileIdOf, MAX_ITEM_NAME, placeItem, removeItem, routeInput, type GiaoTrinhSnapshot, type GtItem, type GtLesson, type LessonRow, type GtConfig } from "./giaoTrinh";
import { uploadIdOf, type MediaSlot } from "./mediaLink";
import { contentHref } from "./tutorRoutes";
import { claimUploadedDocuments } from "./lessonMediaServer";

export { claimUploadedDocuments };

const LESSON_COLS = { id: true, title: true, type: true, isLocked: true, isFree: true, duration: true, videoUrl: true, zoomUrl: true, azotaUrl: true, azotaDeadline: true, documents: true } as const;

/** Tổng byte tài liệu ĐÃ tải xong của một gia sư (hạn mức 500 MB). */
export async function usedDocumentBytes(ownerId: string): Promise<number> {
  const r = await prisma.fileAsset.aggregate({ where: { ownerId, kind: "document", status: "ready" }, _sum: { bytes: true } });
  return r._sum.bytes ?? 0;
}

export async function loadConfig(ownerId: string): Promise<GtConfig> {
  const v = videoUploadConfig(), d = documentUploadConfig();
  return {
    video: { enabled: v.enabled, reason: v.reason, maxBytes: v.maxBytes },
    document: { enabled: d.enabled, reason: d.reason, maxBytes: d.maxBytes, quotaBytes: d.quotaBytes, usedBytes: await usedDocumentBytes(ownerId), exts: d.exts },
  };
}

/** Bản chụp Giáo trình của MỘT lớp (G1). null = không có lớp. Quyền do người gọi kiểm. */
export async function loadGiaoTrinh(courseId: string): Promise<GiaoTrinhSnapshot | null> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      id: true, name: true, ownerId: true,
      sections: {
        orderBy: { order: "asc" },
        select: {
          id: true, title: true,
          chapters: {
            orderBy: { order: "asc" },
            select: { id: true, title: true, lessons: { orderBy: { order: "asc" }, select: { ...LESSON_COLS, _count: { select: { assignments: { where: { mode: { not: "azota" } } } } } } } },
          },
        },
      },
    },
  });
  if (!course) return null;
  const exams = await prisma.exam.findMany({
    where: { courseId, ...(course.ownerId ? { ownerId: course.ownerId } : {}) },
    orderBy: { createdAt: "desc" }, take: 100, select: { id: true, title: true },
  });
  return {
    courseId: course.id, courseName: course.name,
    sections: course.sections.map(s => ({
      id: s.id, title: s.title,
      chapters: s.chapters.map(c => ({
        id: c.id, title: c.title,
        lessons: c.lessons.map((l): GtLesson => ({
          id: l.id, title: l.title, type: l.type, isLocked: l.isLocked, isFree: l.isFree, duration: l.duration, azotaDeadline: l.azotaDeadline,
          items: deriveItems(l, { assignments: l._count.assignments }),
        })),
      })),
    })),
    exams: exams.map((e): GtItem => ({
      key: `exam:${e.id}`, kind: "exam", slot: null, name: e.title, url: null, label: "Bài kiểm tra", storage: "link", warning: null, broken: false,
      href: contentHref(true, `/admin/thi-thu/${e.id}`),
    })),
    config: await loadConfig(course.ownerId ?? ""),
  };
}

/** Bài để "Xem như học sinh": cột đầy đủ của MỘT bài, chỉ khi bài thuộc đúng lớp. Người gọi tự đưa qua lessonFor() để dựng hai góc nhìn. */
export async function loadLessonPreview(courseId: string, lessonId: string) {
  const l = await prisma.lesson.findFirst({
    where: { id: lessonId, chapter: { section: { courseId } } },
    select: { ...LESSON_COLS, chapter: { select: { section: { select: { courseId: true, course: { select: { name: true, ownerId: true } } } } } } },
  });
  if (!l) return null;
  const { chapter, ...lesson } = l;
  return { courseId, courseName: chapter.section.course.name, courseOwnerId: chapter.section.course.ownerId, lesson };
}

/** `slot` (tuỳ chọn) = ô mà giao diện MUỐN đặt vào; có thì link phải hợp ô đó (vd link lạ giả youtube.com bị từ chối ở ô video, kèm moveTo). Không có ⇒ máy chủ tự chọn ô bằng routeInput. */
export type AddItemInput = { lessonId?: string; chapterId?: string; newLessonTitle?: string; url: string; name?: string; from?: "library"; slot?: MediaSlot };
export type AddItemResult =
  | { ok: true; status: 200 | 201; duplicate: boolean; item: GtItem; lessonId: string; created: { lesson: boolean }; warning: string | null }
  | { ok: false; status: 400 | 403 | 404; code: "link" | "gioi-han" | "quyen" | "khong-co"; error: string; moveTo?: string };

const NO_CFG: GtConfig = { video: { enabled: false, reason: null, maxBytes: 0 }, document: { enabled: false, reason: null, maxBytes: 0, quotaBytes: 0, usedBytes: 0, exts: [] } };
const limitMsg = (e: string) => /tối đa/i.test(e);
const lessonRow = (l: { videoUrl: string | null; zoomUrl: string | null; azotaUrl: string | null; documents: string | null; title: string }): LessonRow => l;

/**
 * G2. Trong MỘT giao dịch có khoá advisory theo bài (hoặc theo cây lớp khi tạo bài mới): đọc bài, routeInput/placeItem, ghi cột — hai yêu cầu song song vào một bài
 * đều có mặt, không mất cập nhật. Link sai/độc không đụng vào cột nào. `courseId` đã được người gọi chứng minh là của gia sư `userId`.
 */
export async function addItem(courseId: string, userId: string, input: AddItemInput): Promise<AddItemResult> {
  const url = typeof input.url === "string" ? input.url.trim() : "";
  const fail = (status: 400 | 403 | 404, code: "link" | "gioi-han" | "quyen" | "khong-co", error: string, moveTo?: string): AddItemResult => ({ ok: false, status, code, error, ...(moveTo ? { moveTo } : {}) });
  if (!url) return fail(400, "link", "Chưa dán link hoặc chọn tệp.");

  // 1) nhận diện + kiểm quyền với tệp KiN (trước mọi ghi)
  const kinId = kinFileIdOf(url);
  const videoId = uploadIdOf(url);
  const routed = routeInput({ text: url }, NO_CFG);
  if (!routed.ok) return fail(400, "link", routed.error, routed.moveTo);
  if (kinId) {
    const a = await prisma.fileAsset.findUnique({ where: { id: kinId }, select: { ownerId: true, kind: true, status: true } });
    if (!a || a.kind !== "document" || a.status !== "ready") return fail(404, "khong-co", "Tệp này không còn trên KiN hoặc chưa tải xong.");
    if (a.ownerId !== userId) return fail(403, "quyen", "Tệp này do người khác tải lên, không dùng cho lớp của bạn được.");
  }
  if (videoId) {
    const a = await prisma.fileAsset.findUnique({ where: { id: videoId }, select: { ownerId: true, kind: true, status: true, courseId: true } });
    if (!a || a.kind !== "video") return fail(404, "khong-co", "Video tải lên không còn. Hãy tải lại.");
    if (a.status !== "ready") return fail(400, "link", "Video tải lên chưa xong. Đợi tải xong rồi thêm.");
    if (a.ownerId !== userId) return fail(403, "quyen", "Video này do người khác tải lên.");
    if (a.courseId !== courseId) return fail(403, "quyen", "Video này thuộc lớp khác, không dùng cho lớp này được.");
  }

  const name = typeof input.name === "string" ? input.name.trim().slice(0, MAX_ITEM_NAME) : "";

  return prisma.$transaction(async (tx): Promise<AddItemResult> => {
    let lesson: { id: string; title: string; videoUrl: string | null; zoomUrl: string | null; azotaUrl: string | null; documents: string | null } | null = null;
    let createdLesson = false;

    if (input.lessonId) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`lesson:${input.lessonId}`}))`;
      // Kiểm khoá ngoại: bài phải thuộc lớp trong đường dẫn (id từ client không đáng tin).
      lesson = await tx.lesson.findFirst({ where: { id: input.lessonId, chapter: { section: { courseId } } }, select: { id: true, title: true, videoUrl: true, zoomUrl: true, azotaUrl: true, documents: true } });
      if (!lesson) return fail(404, "khong-co", "Không tìm thấy bài trong lớp này.");
    } else {
      // Bài mới: khoá theo cây lớp để hai yêu cầu đầu tiên không cùng tạo "Phần 1".
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`course_tree:${courseId}`}))`;
      let chapterId: string | null = null;
      if (input.chapterId) {
        const ch = await tx.chapter.findFirst({ where: { id: input.chapterId, section: { courseId } }, select: { id: true } });
        if (!ch) return fail(404, "khong-co", "Không tìm thấy chương trong lớp này.");
        chapterId = ch.id;
      } else {
        const last = await tx.chapter.findFirst({ where: { section: { courseId } }, orderBy: [{ section: { order: "desc" } }, { order: "desc" }], select: { id: true } });
        if (last) chapterId = last.id;
        else {
          // Lớp chưa có Phần/Chương: tự tạo "Phần 1 › Chương 1" (cùng giao dịch).
          let sec = await tx.section.findFirst({ where: { courseId }, orderBy: { order: "asc" }, select: { id: true } });
          if (!sec) sec = await tx.section.create({ data: { id: `sec-${randomUUID()}`, title: "Phần 1", order: 1, courseId }, select: { id: true } });
          const ch = await tx.chapter.create({ data: { id: `ch-${randomUUID()}`, title: "Chương 1", order: 1, sectionId: sec.id }, select: { id: true } });
          chapterId = ch.id;
        }
      }
      const title = (typeof input.newLessonTitle === "string" ? input.newLessonTitle.trim() : "").slice(0, MAX_ITEM_NAME) || name || routed.suggestedName || "Bài mới";
      const max = await tx.lesson.aggregate({ where: { chapterId }, _max: { order: true } });
      const created = await tx.lesson.create({
        data: { id: `l-${randomUUID()}`, code: `L${Date.now()}`, title, type: "document", documents: "[]", isLocked: true, isFree: false, order: (max._max.order ?? 0) + 1, chapterId },
        select: { id: true, title: true, videoUrl: true, zoomUrl: true, azotaUrl: true, documents: true },
      });
      lesson = created; createdLesson = true;
    }

    const placed = placeItem(lessonRow(lesson), { slot: input.slot ?? routed.slot, url, name: name || routed.suggestedName });
    if (!placed.ok) { return fail(400, limitMsg(placed.error) ? "gioi-han" : "link", placed.error, placed.moveTo); }
    if (placed.duplicate) return { ok: true, status: 200, duplicate: true, item: placed.item, lessonId: lesson.id, created: { lesson: createdLesson }, warning: null };

    await tx.lesson.update({ where: { id: lesson.id }, data: placed.patch as Record<string, string> });
    // Tệp vừa gắn: ghi lessonId cho tệp nếu đang trống (không giành tệp đã gắn bài khác).
    if (kinId) await tx.fileAsset.updateMany({ where: { id: kinId, lessonId: null }, data: { lessonId: lesson.id } });
    if (videoId) await tx.fileAsset.updateMany({ where: { id: videoId, lessonId: null }, data: { lessonId: lesson.id } });
    return { ok: true, status: 201, duplicate: false, item: placed.item, lessonId: lesson.id, created: { lesson: createdLesson }, warning: routed.warning };
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
