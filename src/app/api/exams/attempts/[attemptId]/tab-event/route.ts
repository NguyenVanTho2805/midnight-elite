import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { attemptWriteBlock } from "@/lib/attemptAccess";

// PATCH /api/exams/attempts/[attemptId]/tab-event — học viên: ghi nhận 1 lần
// rời màn hình/chuyển tab khi đang thi (visibilitychange/blur phía client).
// Chỉ đếm sự kiện, không quay màn hình/webcam — giống cơ chế Azota.
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { attemptId } = await params;

  try {
    const attempt = await prisma.examAttempt.findUnique({ where: { id: attemptId } });
    // 404 (không phải 403) để tránh lộ thông tin attempt có tồn tại hay không
    if (!attempt || attempt.userId !== session.userId) {
      return NextResponse.json({ error: "Không tìm thấy bài thi" }, { status: 404 });
    }
    // Học sinh bị tạm dừng ở lớp giữa chừng thì không ghi thêm vào lượt (cùng quy tắc với /start).
    const blocked = await attemptWriteBlock(session.userId, attempt.examId);
    if (blocked) return NextResponse.json({ error: blocked, code: "enrollment_suspended" }, { status: 403 });
    if (attempt.status !== "in_progress") {
      return NextResponse.json({ success: true, tabSwitchCount: attempt.tabSwitchCount });
    }

    const log = Array.isArray(attempt.tabSwitchLog) ? (attempt.tabSwitchLog as string[]) : [];
    log.push(new Date().toISOString());

    const updated = await prisma.examAttempt.update({
      where: { id: attemptId },
      data: { tabSwitchCount: { increment: 1 }, tabSwitchLog: log },
      select: { tabSwitchCount: true },
    });

    return NextResponse.json({ success: true, tabSwitchCount: updated.tabSwitchCount });
  } catch (e) {
    console.error("[PATCH /api/exams/attempts/[attemptId]/tab-event]", e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}
