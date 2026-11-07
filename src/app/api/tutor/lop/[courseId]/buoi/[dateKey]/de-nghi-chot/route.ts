// TUT-dong-giang — POST de-nghi-chot: đồng giảng / giáo viên bộ môn BÁO chủ lớp chốt buổi mình dạy. CHỈ gửi thông báo (có dedupe) + ghi nhật ký:
// KHÔNG ghi gì vào AttendanceSession (state, closedAt...) và KHÔNG chạm bảng phí — chốt buổi sinh phí là TIỀN, chỉ chủ lớp bấm (phương án A, Q2).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidDateKey } from "@/lib/classSessions";
import { requireCourseAccess, sessionTeacherOf } from "@/lib/courseAccessServer";
import { requestSessionClose } from "@/lib/courseTeacherServer";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function POST(_req: NextRequest, { params }: { params: Promise<{ courseId: string; dateKey: string }> }) {
  const { courseId, dateKey } = await params;
  const acc = await requireCourseAccess(courseId, "session.request_close");
  if (!acc.ok) return acc.res;
  if (!isValidDateKey(dateKey)) return NextResponse.json({ error: "Ngày không hợp lệ (YYYY-MM-DD)" }, { status: 400, headers: NO_STORE });

  const session = await prisma.attendanceSession.findUnique({
    where: { courseId_date: { courseId, date: new Date(`${dateKey}T00:00:00Z`) } },
    select: { courseId: true, date: true, taughtBy: true, startTime: true, state: true, _count: { select: { records: true } } },
  });
  if (!session) return NextResponse.json({ error: "Buổi này chưa có điểm danh", code: "NO_ATTENDANCE" }, { status: 409, headers: NO_STORE });
  const teacher = await sessionTeacherOf(session, acc.course.ownerId);
  if (teacher !== acc.session.userId) return NextResponse.json({ error: "Buổi này không phải buổi bạn dạy", code: "NOT_YOUR_SESSION" }, { status: 403, headers: NO_STORE });
  if (session._count.records === 0) return NextResponse.json({ error: "Buổi này chưa có điểm danh", code: "NO_ATTENDANCE" }, { status: 409, headers: NO_STORE });
  if (session.state === "closed") return NextResponse.json({ error: "Buổi đã chốt", code: "ALREADY_CLOSED" }, { status: 409, headers: NO_STORE });

  const created = await requestSessionClose(acc.course, dateKey, acc.session.userId);
  return NextResponse.json({ ok: true, notified: created }, { headers: NO_STORE });
}
