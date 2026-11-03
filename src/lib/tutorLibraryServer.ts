// BU-02 (4.4) — "Thư viện của tôi" của gia sư: tài liệu dùng lại giữa các lớp. Chỉ lớp có ownerId = gia sư; KHÔNG đọc Enrollment / tên học sinh.
// Không sửa libraryServer.ts (dùng chung với học sinh). Gộp thuần ở giaoTrinh.mergeLibrary (có test).
import { prisma } from "./prisma";
import { DOCUMENT_QUOTA_BYTES } from "./mediaStorage";
import { mergeLibrary, type LibUse, type TutorLibrary } from "./giaoTrinh";
import { usedDocumentBytes } from "./giaoTrinhServer";

const MAX_COURSES = 100, MAX_LESSONS = 2000, MAX_ASSETS = 500, MAX_EXAM_FILES = 200;

export interface TutorLibCourse { id: string; name: string; chapters: { id: string; title: string; lessons: { id: string; title: string }[] }[] }
/** Thư viện + cây lớp để chọn đích "Dùng ở lớp khác" + dung lượng kho. */
export interface TutorLibraryData extends TutorLibrary { courses: TutorLibCourse[]; usedBytes: number; quotaBytes: number }

export async function loadTutorLibrary(userId: string): Promise<TutorLibraryData> {
  const courses = await prisma.course.findMany({
    where: { ownerId: userId }, take: MAX_COURSES, orderBy: { createdAt: "desc" },
    select: { id: true, name: true, sections: { orderBy: { order: "asc" }, select: { chapters: { orderBy: { order: "asc" }, select: { id: true, title: true, lessons: { orderBy: { order: "asc" }, select: { id: true, title: true, documents: true } } } } } } },
  });
  const [assets, examFiles, usedBytes] = await Promise.all([
    prisma.fileAsset.findMany({ where: { ownerId: userId, kind: "document", status: "ready" }, orderBy: { createdAt: "desc" }, take: MAX_ASSETS, select: { id: true, originalName: true, bytes: true } }),
    prisma.examFile.findMany({ where: { ownerId: userId }, orderBy: { createdAt: "desc" }, take: MAX_EXAM_FILES, select: { id: true, fileName: true } }),
    usedDocumentBytes(userId),
  ]);

  const lessons: (LibUse & { documents: string | null })[] = [];
  const tree: TutorLibCourse[] = [];
  for (const c of courses) {
    const chapters = c.sections.flatMap(s => s.chapters.map(ch => ({ id: ch.id, title: ch.title, lessons: ch.lessons.map(l => ({ id: l.id, title: l.title })) })));
    tree.push({ id: c.id, name: c.name, chapters });
    for (const s of c.sections) for (const ch of s.chapters) for (const l of ch.lessons) {
      if (lessons.length >= MAX_LESSONS) break;
      lessons.push({ courseId: c.id, courseName: c.name, lessonId: l.id, lessonTitle: l.title, documents: l.documents });
    }
  }
  const merged = mergeLibrary({
    lessons,
    assets: assets.map(a => ({ id: a.id, name: a.originalName, bytes: a.bytes })),
    examFiles: examFiles.map(e => ({ id: e.id, name: e.fileName })),
  });
  return { ...merged, courses: tree, usedBytes, quotaBytes: DOCUMENT_QUOTA_BYTES };
}
