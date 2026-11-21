// SCL-D (P2-4) — dữ liệu chung của "Bản ghi của lớp" (/lop-cua-toi/[id]/ban-ghi) và tab "Video" của lớp gia sư (/lop-cua-toi/quan-lop/[id]/video):
// video bài giảng (bài có link video đọc được) + bản ghi theo buổi + bảng ai đã xem. Quyền kiểm ở nơi gọi (recordingAccess). Tên học sinh chỉ trả khi `isOwner`.
import { prisma } from "@/lib/prisma";
import { listCourseRecordings } from "@/lib/classRecordingsServer";
import { buildWatchTable, groupRecordingsBySession } from "@/lib/classRecordings";
import { firstPlayableVideo } from "@/lib/mediaLink";

export async function loadClassVideoView(courseId: string, isOwner: boolean) {
  const { rows, sessions } = await listCourseRecordings(courseId);
  const grouped = groupRecordingsBySession(rows, sessions);

  // MD-17: video của lớp = bài có link video đọc được. Chỉ em ghi danh active/suspended của CHÍNH lớp này; gia sư chủ lớp mới thấy tên.
  const lessons = await prisma.lesson.findMany({
    where: { chapter: { section: { courseId } } },
    orderBy: [{ chapter: { section: { order: "asc" } } }, { chapter: { order: "asc" } }, { order: "asc" }],
    select: { id: true, title: true, videoUrl: true, status: true },
  });
  const withVideo = lessons.map(l => ({ ...l, video: firstPlayableVideo(l.videoUrl) }));
  const watchLessons = withVideo.map(l => ({ id: l.id, title: l.title, hasVideo: l.video !== null }));
  const enrolled = await prisma.enrollment.findMany({
    where: { courseId, status: { in: ["active", "suspended"] } },
    select: { userId: true, user: { select: { name: true } } },
    orderBy: { user: { name: "asc" } },
  });
  const progress = watchLessons.some(l => l.hasVideo) && enrolled.length
    ? await prisma.lessonProgress.findMany({
        where: { userId: { in: enrolled.map(e => e.userId) }, lessonId: { in: watchLessons.filter(l => l.hasVideo).map(l => l.id) } },
        select: { userId: true, lessonId: true, completed: true, watchedSeconds: true },
      })
    : [];
  const watch = buildWatchTable(watchLessons, enrolled.map(e => ({ id: e.userId, name: e.user.name })), progress);

  return {
    bySession: grouped.bySession.map(g => ({ session: g.session, recordings: g.recordings.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })) })),
    unattached: grouped.unattached.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })),
    studentCount: enrolled.length,
    lessonVideos: withVideo.filter(l => l.video).map(l => ({ id: l.id, title: l.title, status: l.status, label: l.video!.label })),
    watch: {
      videoCount: watch.videoCount,
      lessons: watch.lessons,
      // Quản trị không phải chủ lớp chỉ nhận số tổng, không nhận tên / dòng từng em.
      students: isOwner ? watch.students : [],
    },
  };
}
