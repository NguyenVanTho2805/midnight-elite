// LO-09 / LO-03: gia sư THÊM học sinh ĐÃ CÓ vào lớp của mình. Body: { userIds: string[] }.
// Chỉ nhận em đang/đã học một lớp khác CỦA CHÍNH GIA SƯ NÀY (đã có quan hệ với gia sư): không thêm người lạ, không thu thêm dữ liệu nào.
// Em chưa từng học với bạn → vào lớp bằng mã mời. Trạng thái ghi danh mới đi qua deriveStatusForNewEnrollment (công tắc đồng ý của phụ huynh vẫn áp dụng).
// Lớp của gia sư khác 403, không có 404. Thông báo cho em dựng từ tên lớp, không tên người.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { logAction } from "@/lib/auditLog";
import { notify } from "@/lib/notify";
import { deriveStatusForNewEnrollment } from "@/lib/enrollment";
import { ADD_STUDENTS_MAX } from "@/lib/tutorStudentView";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  const { courseId } = await params;
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true, name: true, ownerId: true } });
  if (!course) return NextResponse.json({ error: "Không tìm thấy lớp" }, { status: 404 });
  if (course.ownerId !== auth.userId) return NextResponse.json({ error: "Lớp này không phải của bạn" }, { status: 403 });
  const b = await req.json().catch(() => null) as { userIds?: unknown } | null;
  if (!Array.isArray(b?.userIds) || !b.userIds.every((x): x is string => typeof x === "string" && !!x)) return NextResponse.json({ error: "Chọn học sinh cần thêm" }, { status: 400 });
  const ids = [...new Set(b.userIds)];
  if (!ids.length) return NextResponse.json({ error: "Chọn học sinh cần thêm" }, { status: 400 });
  if (ids.length > ADD_STUDENTS_MAX) return NextResponse.json({ error: `Mỗi lần thêm tối đa ${ADD_STUDENTS_MAX} em` }, { status: 400 });
  const known = await prisma.enrollment.findMany({
    where: { userId: { in: ids }, status: { in: ["active", "suspended"] }, course: { ownerId: auth.userId, NOT: { id: courseId } } }, select: { userId: true },
  });
  const knownSet = new Set(known.map(k => k.userId));
  const stranger = ids.filter(i => !knownSet.has(i));
  if (stranger.length) {
    return NextResponse.json({ error: "Chỉ thêm được học sinh đã học lớp khác của bạn. Em mới thì gửi mã mời để em tự vào lớp.", rejected: stranger.length }, { status: 403, headers: NO_STORE });
  }
  const already = await prisma.enrollment.findMany({ where: { courseId, userId: { in: ids } }, select: { userId: true } });
  const alreadySet = new Set(already.map(a => a.userId));
  const added: string[] = [];
  for (const userId of ids) {
    if (alreadySet.has(userId)) continue;
    const status = await deriveStatusForNewEnrollment(userId);
    await prisma.enrollment.upsert({ where: { userId_courseId: { userId, courseId } }, create: { userId, courseId, status }, update: {} });
    added.push(userId);
    await notify(userId, { type: "enrollment", title: "Bạn đã được thêm vào lớp", message: `Bạn đã được thêm vào lớp "${course.name}"`, link: `/student/hoc-tap?course=${courseId}` });
  }
  if (added.length) await logAction(auth.userId, "course.add_students", "Course", courseId, { added: added.length });
  return NextResponse.json({ ok: true, added: added.length, alreadyIn: ids.length - added.length }, { status: added.length ? 201 : 200, headers: NO_STORE });
}
