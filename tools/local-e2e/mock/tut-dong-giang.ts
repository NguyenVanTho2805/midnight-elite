// Dữ liệu giả cho TUT-dong-giang (đồng giảng) — giao diện. Tên thử có "(thử)"; chạy lặp lại được (xoá lô thử cũ rồi dựng lại).
// Gồm: lớp của giasu@kin.local có 1 đồng giảng đang dạy + 1 lời mời chờ nhận; hai lớp của "Cô Mai (thử)" mà giasu là đồng giảng / vừa được mời.
import { mkCourse, mkTutor } from "../h";
import type { MockCtx } from "../mock-seed";

const TAG = "(thử)";

export default async function mock(ctx: MockCtx): Promise<string[]> {
  const { prisma, tutor } = ctx;
  const old = await prisma.course.findMany({ where: { name: { contains: TAG }, ownerId: { not: tutor.id } }, select: { id: true } });
  await prisma.courseTeacher.deleteMany({ where: { OR: [{ courseId: { in: old.map(c => c.id) } }, { user: { name: { contains: TAG } } }] } });
  await prisma.attendanceSession.deleteMany({ where: { courseId: { in: old.map(c => c.id) } } });
  await prisma.course.deleteMany({ where: { id: { in: old.map(c => c.id) } } });
  await prisma.user.deleteMany({ where: { name: { contains: TAG }, email: { endsWith: "@test.local" } } });

  const mai = await mkTutor(`Cô Mai ${TAG}`), hung = await mkTutor(`Thầy Hùng ${TAG}`);
  const mine = await prisma.course.findFirst({ where: { ownerId: tutor.id }, orderBy: { sortOrder: "asc" } });
  const out: string[] = [];
  if (mine) {
    await prisma.courseTeacher.deleteMany({ where: { courseId: mine.id, userId: { in: [mai.id, hung.id] } } });
    await prisma.courseTeacher.create({ data: { courseId: mine.id, userId: mai.id, role: "co_teacher", subjects: ["Văn"], status: "active", invitedBy: tutor.id, respondedAt: new Date() } });
    await prisma.courseTeacher.create({ data: { courseId: mine.id, userId: hung.id, role: "subject_teacher", subjects: ["Lý"], status: "invited", invitedBy: tutor.id } });
    out.push(`giasu@kin.local → Lớp → «${mine.name}» → tab Giáo viên: Cô Mai (thử) đang dạy (Đồng giảng), Thầy Hùng (thử) chờ nhận lời (nút Gỡ/Huỷ lời mời/Mời giáo viên).`);
  }
  const vanLop = await mkCourse(mai.id, { name: `Văn 9 cô Mai ${TAG}` });
  const lyLop = await mkCourse(mai.id, { name: `Lý 8 cô Mai ${TAG}` });
  await prisma.courseTeacher.create({ data: { courseId: vanLop.id, userId: tutor.id, role: "co_teacher", subjects: ["Văn"], status: "active", invitedBy: mai.id, respondedAt: new Date() } });
  await prisma.courseTeacher.create({ data: { courseId: lyLop.id, userId: tutor.id, role: "subject_teacher", subjects: ["Lý"], status: "invited", invitedBy: mai.id } });
  const em = await prisma.user.create({ data: { name: `Em Văn ${TAG}`, email: `em-van-${Date.now()}@test.local`, password: "x", role: "student", emailVerified: true } });
  await prisma.enrollment.create({ data: { userId: em.id, courseId: vanLop.id, status: "active" } });
  const yesterday = new Date(Date.now() - 86_400_000);
  const s = await prisma.attendanceSession.create({ data: { courseId: vanLop.id, date: new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate())), createdBy: mai.id, taughtBy: tutor.id } });
  await prisma.attendanceRecord.create({ data: { sessionId: s.id, userId: em.id, status: "present" } });
  out.push(`giasu@kin.local → Hộp việc / Lớp: nhóm «Lớp tôi đồng giảng» (Văn 9 cô Mai, huy hiệu Đồng giảng) và thẻ «Bạn có 1 lời mời đồng giảng» → /lop-cua-toi/dong-giang (Nhận lời / Từ chối lớp Lý 8).`);
  out.push(`Mở «Văn 9 cô Mai (thử)» bằng giasu: không có tab Mã mời/Học phí, không nút Sửa/Xoá lớp; trang buổi có «Đề nghị chủ chốt buổi».`);
  return out;
}
