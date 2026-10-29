// Kho tài liệu công khai — phần CÓ DB (NC2-046). Phần thuần: src/lib/libraryKho.ts.
import { prisma } from "@/lib/prisma";
import { parseLessonDocuments } from "@/lib/library";
import { isVideoId } from "@/lib/youtubeLink";
import type { KhoDoc, KhoVideo } from "@/lib/libraryKho";

const MAX_COURSES = 50, MAX_VIDEOS = 500;

/**
 * Tài liệu CÔNG KHAI: chỉ bài MIỄN PHÍ (`isFree`) của các khoá đang mở (`status`). Không dùng `isLocked` để quyết định: cờ đó là giá trị tĩnh trong DB và gia sư hay quên khoá,
 * nên API bài giảng đã bỏ qua nó (xem src/app/api/lessons/[id]/context/route.ts) — dùng nó ở đây từng làm lộ tài liệu của bài trả phí. Cùng quy tắc với trang /thu-vien của khách.
 */
export async function loadPublicDocs(): Promise<KhoDoc[]> {
  const courses = await prisma.course.findMany({
    where: { status: true },
    select: { name: true, sections: { select: { chapters: { select: { lessons: { select: { title: true, documents: true, isFree: true } } } } } } },
    take: MAX_COURSES,
  });
  const out: KhoDoc[] = [];
  for (const c of courses) for (const s of c.sections) for (const ch of s.chapters) for (const l of ch.lessons) {
    if (!l.isFree) continue;
    for (const d of parseLessonDocuments(l.documents)) out.push({ ...d, courseName: c.name, lessonTitle: l.title });
  }
  return out;
}

/** Video đã công khai, mới nhất trước. Dòng có mã video hỏng (sửa tay trong DB) bị bỏ qua, không làm sập trang. */
export async function loadPublishedVideos(): Promise<KhoVideo[]> {
  const rows = await prisma.libraryVideo.findMany({ where: { published: true }, orderBy: { createdAt: "desc" }, take: MAX_VIDEOS });
  return rows.filter(r => isVideoId(r.videoId)).map(r => ({ id: r.id, title: r.title, videoId: r.videoId, topics: r.topics, channel: r.channel, note: r.note }));
}
