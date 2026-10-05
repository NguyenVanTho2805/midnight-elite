import { NextResponse } from "next/server";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

// GET /api/admin/thread-reports — danh sách report bài viết cộng đồng đang
// chờ duyệt. Hai nhóm được xem:
//   - admin_super, admin_content: thấy tất cả report (quyền MANAGE_COMMUNITY).
//   - teacher: chỉ thấy report của thread thuộc lớp do mình sở hữu
//     (thread.course.ownerId = userId). Teacher không có MANAGE_COMMUNITY,
//     nên trước đây bị 403; mở rộng ở đây (BE-072) để GVCN tự xử lý report
//     trong lớp mình mà không cần nhờ admin cấp trên.
// Report của thread "cộng đồng chung" (courseId = null) chỉ admin cấp trên
// xử lý, vì không có owner để scope.
export async function GET() {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;
  if (auth.role !== "admin") {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }

  const isCenterAdmin = auth.adminRole === "admin_super" || auth.adminRole === "admin_content";
  const isTeacher     = auth.adminRole === "teacher";
  if (!isCenterAdmin && !isTeacher) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }

  const reports = await prisma.threadReport.findMany({
    where: {
      status: "pending",
      // Teacher: chỉ report của thread trong lớp do mình owner.
      ...(isTeacher ? { thread: { course: { ownerId: auth.userId } } } : {}),
    },
    orderBy: { createdAt: "asc" },
    include: {
      reporter: { select: { id: true, name: true } },
      thread: {
        select: {
          id: true, content: true,
          author: { select: { id: true, name: true } },
          course: { select: { id: true, name: true, ownerId: true } },
        },
      },
    },
  });

  return NextResponse.json(reports);
}
