import { NextRequest, NextResponse } from "next/server";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

// POST /api/admin/thread-reports/[id]/resolve — duyệt report:
// { decision: "approved" | "rejected" }.
//
// Hai nhóm được resolve (BE-072):
//   - admin_super, admin_content: resolve mọi report.
//   - teacher: chỉ resolve report của thread trong lớp do mình owner
//     (thread.course.ownerId = userId). Report của thread "cộng đồng chung"
//     (courseId = null) teacher không đụng vào được.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;
  if (auth.role !== "admin") {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }

  const { id } = await params;
  const { decision } = await req.json();
  if (decision !== "approved" && decision !== "rejected") {
    return NextResponse.json({ error: "decision phải là 'approved' hoặc 'rejected'" }, { status: 400 });
  }

  const report = await prisma.threadReport.findUnique({
    where: { id },
    select: {
      status:   true,
      threadId: true,
      thread: { select: { course: { select: { ownerId: true } } } },
    },
  });
  if (!report) return NextResponse.json({ error: "Không tìm thấy report" }, { status: 404 });

  const isCenterAdmin = auth.adminRole === "admin_super" || auth.adminRole === "admin_content";
  const isOwner       = report.thread.course?.ownerId === auth.userId;
  if (!isCenterAdmin && !(auth.adminRole === "teacher" && isOwner)) {
    return NextResponse.json({ error: "Không có quyền với báo cáo này" }, { status: 403 });
  }

  // Flip status atomically — giống pattern answer-reports resolve: 2 request
  // resolve đồng thời chỉ có 1 cái qua được count=1. Cái thua count=0 bail.
  const flipped = await prisma.threadReport.updateMany({
    where: { id, status: "pending" },
    data:  { status: decision },
  });
  if (flipped.count === 0) {
    return NextResponse.json({ error: "Report này đã được xử lý" }, { status: 409 });
  }

  if (decision === "approved") {
    // Soft-delete bài viết vi phạm — không xoá cứng, giữ bằng chứng.
    await prisma.thread.update({ where: { id: report.threadId }, data: { deletedAt: new Date() } });
  }

  return NextResponse.json({ success: true });
}
