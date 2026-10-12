// PH-209 — dữ liệu để soạn bài đăng tìm học sinh: lấy từ hồ sơ + sổ lớp của chính gia sư.
// Số buổi đã dạy lấy từ sổ lớp (gia sư không sửa được). KiN không tự đăng vào nhóm Facebook — chỉ soạn sẵn.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { ENROLLMENT_STATUS } from "@/lib/enrollment";
import { readPreferences } from "@/lib/userPreferences";
import { guessPronoun } from "@/lib/funnel";

export async function GET() {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  const me = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, name: true, subjects: true, tutorVerified: true, profileLockedAt: true, preferences: true },
  });
  if (!me) return NextResponse.json({ error: "Không tìm thấy tài khoản" }, { status: 404 });
  const courses = await prisma.course.findMany({
    where: { ownerId: auth.userId, status: true, classStatus: "open" },
    select: { id: true, name: true, capacity: true },
    orderBy: { sortOrder: "asc" },
  });
  const ids = courses.map(c => c.id);
  const [active, sessionsTaught] = await Promise.all([
    ids.length === 0 ? [] : prisma.enrollment.groupBy({ by: ["courseId"], where: { courseId: { in: ids }, status: ENROLLMENT_STATUS.ACTIVE }, _count: { _all: true } }),
    prisma.attendanceSession.count({ where: { course: { ownerId: auth.userId } } }),
  ]);
  const activeBy = new Map(active.map(a => [a.courseId, a._count._all]));
  return NextResponse.json({
    tutorId: me.id,
    name: me.name,
    pronoun: guessPronoun(me.name),
    subjects: me.subjects,
    // Hồ sơ công khai chỉ mở khi đã được duyệt và không bị khoá; nếu không thì link trong bài sẽ không mở được.
    profilePublic: me.tutorVerified && !me.profileLockedAt,
    profileLocked: !!me.profileLockedAt,
    classes: courses.map(c => ({ id: c.id, name: c.name, seatsLeft: c.capacity === null ? null : Math.max(0, c.capacity - (activeBy.get(c.id) ?? 0)) })),
    sessionsTaught,
    groups: readPreferences(me.preferences).connections?.groups ?? [],
  });
}
