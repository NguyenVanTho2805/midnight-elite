// MD-02 / MD-17 / BC-03 — dữ liệu giả: bản ghi gắn buổi cho lớp đầu của gia sư chính, video bài giảng có tiến độ xem, bài Azota để báo cáo tháng có số.
import type { MockFn } from "../mock-seed";

const mock: MockFn = async ({ prisma, tutor, student }) => {
  // Ưu tiên lớp của gia sư chính mà học sinh chính ĐÃ ghi danh; nếu chưa có thì ghi danh học sinh thử vào lớp đầu (dữ liệu giả).
  const enr0 = await prisma.enrollment.findFirst({ where: { userId: student.id, status: "active", course: { ownerId: tutor.id } }, select: { course: { select: { id: true, name: true } } } });
  const course = enr0?.course ?? await prisma.course.findFirst({ where: { ownerId: tutor.id }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } });
  if (course && !enr0) await prisma.enrollment.upsert({ where: { userId_courseId: { userId: student.id, courseId: course.id } }, update: {}, create: { userId: student.id, courseId: course.id, status: "active" } });
  if (!course) return ["MD-02: gia sư chính chưa có lớp nên chưa dựng bản ghi."];
  const sessions = await prisma.attendanceSession.findMany({ where: { courseId: course.id }, orderBy: { date: "desc" }, take: 2, select: { id: true } });
  if (!(await prisma.classRecording.count({ where: { courseId: course.id } }))) {
    await prisma.classRecording.createMany({ data: [
      { courseId: course.id, sessionId: sessions[0]?.id ?? null, title: "Bản ghi buổi gần nhất (YouTube thử)", url: "https://youtu.be/dQw4w9WgXcQ", kind: "youtube", createdBy: tutor.id },
      { courseId: course.id, sessionId: sessions[1]?.id ?? null, title: "Bản ghi Zoom (link thử)", url: "https://us02web.zoom.us/rec/share/abc123", kind: "zoom_record", createdBy: tutor.id },
      { courseId: course.id, sessionId: null, title: "Bản ghi ôn tập chưa gắn buổi", url: "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view", kind: "drive", createdBy: tutor.id },
    ] });
  }
  const sec = await prisma.section.upsert({ where: { id: `md02-s-${course.id}` }, update: {}, create: { id: `md02-s-${course.id}`, title: "Học liệu thử MD-02", courseId: course.id, order: 90 } });
  const ch = await prisma.chapter.upsert({ where: { id: `md02-c-${course.id}` }, update: {}, create: { id: `md02-c-${course.id}`, title: "Chương thử", sectionId: sec.id, order: 0 } });
  const mk = (key: string, order: number, data: Record<string, unknown>) => prisma.lesson.upsert({ where: { id: `md02-${key}-${course.id}` }, update: {},
    create: { id: `md02-${key}-${course.id}`, code: key, title: `Bài thử ${key}`, type: "record", chapterId: ch.id, order, isLocked: false, ...data } as never });
  const l1 = await mk("v1", 0, { videoUrl: "https://youtu.be/dQw4w9WgXcQ" });
  const l2 = await mk("v2", 1, { videoUrl: "https://vimeo.com/76979871" });
  await mk("az", 2, { type: "quiz", azotaUrl: "https://azota.vn/de-thi/thu" });
  const enrolled = await prisma.enrollment.findFirst({ where: { courseId: course.id, userId: student.id } });
  if (enrolled) {
    await prisma.lessonProgress.upsert({ where: { userId_lessonId: { userId: student.id, lessonId: l1.id } }, update: {}, create: { userId: student.id, lessonId: l1.id, completed: true, watchedSeconds: 400 } });
    await prisma.lessonProgress.upsert({ where: { userId_lessonId: { userId: student.id, lessonId: l2.id } }, update: {}, create: { userId: student.id, lessonId: l2.id, completed: false, watchedSeconds: 45 } });
  }
  return [
    `MD-02 · ${tutor.email}: /lop-cua-toi/${course.id}/ban-ghi → 3 bản ghi (2 gắn buổi, 1 chưa gắn), form dán link có ô tick cam kết bản quyền; nút "Bản ghi của lớp" ở đầu trang chi tiết lớp.`,
    `MD-17 · cùng trang, phần "Ai đã xem video bài giảng": 2 video thử, em ${student.name} ${enrolled ? "đã xem xong video 1 và đang xem video 2" : "chưa ghi danh nên chưa có dòng"}.`,
    `MD-07 · ${student.email}: /student/hoc-tap?course=${course.id} → tab "Tài liệu & bản ghi" thấy 3 bản ghi theo buổi.`,
    `BC-03 · ${tutor.email}: /lop-cua-toi/bao-cao-thang → chọn em ${student.name}: dưới tên môn có "Học liệu trên KiN: đã xem 1/2 video bài giảng; 1/1 bài Azota chưa báo đã làm".`,
  ];
};
export default mock;
