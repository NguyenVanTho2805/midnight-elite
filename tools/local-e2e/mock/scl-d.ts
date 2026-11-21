// SCL-D — dữ liệu giả: một bài có video YouTube + tài liệu cũ "công khai" (Cloudinary, link thử) để thấy nút "Chuyển sang riêng tư"; một bài tập nộp tệp để thử nộp ảnh → PDF;
// một bản ghi YouTube để xem ngay ở tab Video. Chạy lặp lại được (upsert theo id cố định).
import type { MockFn } from "../mock-seed";

const mock: MockFn = async ({ prisma, tutor, student }) => {
  const enr0 = await prisma.enrollment.findFirst({ where: { userId: student.id, status: "active", course: { ownerId: tutor.id } }, select: { course: { select: { id: true, name: true } } } });
  const course = enr0?.course ?? await prisma.course.findFirst({ where: { ownerId: tutor.id }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } });
  if (!course) return ["SCL-D: gia sư chính chưa có lớp nên chưa dựng dữ liệu."];
  if (!enr0) await prisma.enrollment.upsert({ where: { userId_courseId: { userId: student.id, courseId: course.id } }, update: {}, create: { userId: student.id, courseId: course.id, status: "active" } });
  const sec = await prisma.section.upsert({ where: { id: `scld-s-${course.id}` }, update: {}, create: { id: `scld-s-${course.id}`, title: "Thử SCL-D", courseId: course.id, order: 95 } });
  const ch = await prisma.chapter.upsert({ where: { id: `scld-c-${course.id}` }, update: {}, create: { id: `scld-c-${course.id}`, title: "Video và tài liệu", sectionId: sec.id, order: 0 } });
  const lesson = await prisma.lesson.upsert({ where: { id: `scld-l-${course.id}` }, update: {}, create: {
    id: `scld-l-${course.id}`, code: "scld", title: "Bài thử: video YouTube + tài liệu cũ", type: "record", chapterId: ch.id, order: 0, isLocked: true, isFree: false, status: "published",
    videoUrl: "https://youtu.be/dQw4w9WgXcQ",
    documents: JSON.stringify([{ name: "Đề cương cũ (thử).pdf", url: "https://res.cloudinary.com/kin-thu/raw/upload/v1/scl-d/de-cuong-thu.pdf", type: "pdf" }]),
  } });
  const asg = await prisma.assignment.findFirst({ where: { lessonId: lesson.id } }) ?? await prisma.assignment.create({ data: { lessonId: lesson.id, title: "Bài tập thử nộp ảnh", mode: "file", ownerId: tutor.id, dueDate: new Date(Date.now() + 7 * 86_400_000) } });
  if (!(await prisma.classRecording.findFirst({ where: { courseId: course.id, title: "Bản ghi thử SCL-D (YouTube)" } }))) {
    await prisma.classRecording.create({ data: { courseId: course.id, title: "Bản ghi thử SCL-D (YouTube)", url: "https://youtu.be/dQw4w9WgXcQ", kind: "youtube", createdBy: tutor.id } });
  }
  return [
    `SCL-D · ${tutor.email}: /lop-cua-toi/quan-lop/${course.id} → bấm "Chi tiết…" ở bài "${lesson.title}": ngăn chỉ còn Tên · Link video YouTube · Tài liệu (Drive/Azota/Khoá/Học thử đã ẩn).`,
    `SCL-D · ${tutor.email}: /lop-cua-toi/quan-lop/${course.id}/video → tab Video gộp video bài giảng + bản ghi; /thu-vien → "1 tài liệu cũ đang công khai" + nút "Chuyển sang riêng tư" (link thử nên sẽ báo không tải được).`,
    `SCL-D · ${student.email}: /student/hoc-tap?course=${course.id}&tab=video → bản ghi YouTube bấm "Xem" phát ngay (youtube-nocookie); /student/bai-giang/${lesson.id} → "${asg.title}": nút "Chụp ảnh bài làm" / "Chọn ảnh có sẵn" gộp ảnh thành một PDF.`,
  ];
};
export default mock;
