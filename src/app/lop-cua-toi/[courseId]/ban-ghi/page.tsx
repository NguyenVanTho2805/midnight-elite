// MD-02 + MD-17 — Bản ghi của lớp: gia sư dán link bản ghi sau buổi học, gắn vào đúng buổi; và bảng ai đã xem video bài giảng của lớp.
// Quyền: gia sư CHỦ lớp (và quản trị cấp 1/nội dung) vào được; gia sư lớp khác và người lạ thấy 404 (không lộ lớp có tồn tại); học sinh của lớp
// được chuyển sang tab "Tài liệu & bản ghi" trong Lớp của tôi. Tên học sinh trong bảng "ai đã xem" CHỈ hiện cho gia sư chủ lớp.
import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { recordingAccess, listCourseRecordings } from "@/lib/classRecordingsServer";
import { buildWatchTable, groupRecordingsBySession } from "@/lib/classRecordings";
import { firstPlayableVideo } from "@/lib/mediaLink";
import BanGhiClient from "./BanGhiClient";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ courseId: string }>; searchParams: Promise<{ ok?: string; loi?: string; "da-go"?: string; buoi?: string }> };

export default async function BanGhiPage({ params, searchParams }: Props) {
  const { courseId } = await params;
  const sp = await searchParams;
  const session = await getSession();
  if (!session) redirect(`/dang-nhap?redirect=/lop-cua-toi/${courseId}/ban-ghi`);
  const acc = await recordingAccess(session, courseId);
  if (!acc.ok) notFound();
  if (acc.role === "student") redirect(`/student/hoc-tap?course=${encodeURIComponent(courseId)}`);

  const isOwner = session.role === "admin" && session.adminRole === "teacher" && acc.course.ownerId === session.userId;
  const { rows, sessions } = await listCourseRecordings(courseId);
  const grouped = groupRecordingsBySession(rows, sessions);

  // MD-17: video của lớp = bài có link video đọc được. Chỉ em ghi danh active/suspended của CHÍNH lớp này; gia sư chủ lớp mới thấy tên.
  const lessons = await prisma.lesson.findMany({
    where: { chapter: { section: { courseId } } },
    orderBy: [{ chapter: { section: { order: "asc" } } }, { chapter: { order: "asc" } }, { order: "asc" }],
    select: { id: true, title: true, videoUrl: true },
  });
  const watchLessons = lessons.map(l => ({ id: l.id, title: l.title, hasVideo: firstPlayableVideo(l.videoUrl) !== null }));
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

  return (
    <BanGhiClient
      courseId={courseId}
      courseName={acc.course.name}
      isOwner={isOwner}
      flash={{ ok: sp.ok === "1", removed: sp["da-go"] === "1", error: typeof sp.loi === "string" ? sp.loi.slice(0, 300) : "" }}
      preselectSession={typeof sp.buoi === "string" ? sp.buoi : ""}
      bySession={grouped.bySession.map(g => ({ session: g.session, recordings: g.recordings.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })) }))}
      unattached={grouped.unattached.map(r => ({ ...r, createdAt: r.createdAt.toISOString() }))}
      studentCount={enrolled.length}
      watch={{
        videoCount: watch.videoCount,
        lessons: watch.lessons,
        // Quản trị không phải chủ lớp chỉ nhận số tổng, không nhận tên / dòng từng em.
        students: isOwner ? watch.students : [],
      }}
    />
  );
}
