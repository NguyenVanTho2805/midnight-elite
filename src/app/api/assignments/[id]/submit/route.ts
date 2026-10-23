import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import { isEnrollmentActive } from "@/lib/enrollment";
import { validateWorkLink } from "@/lib/mediaLink";

// POST /api/assignments/[id]/submit — học viên nộp/nộp lại bài. Nộp lại GHI
// ĐÈ bản cũ (unique [assignmentId, userId]) — nếu bài cũ đã được chấm, xoá
// sạch score/gradedAt/comment cũ để bắt giáo viên chấm lại (tránh điểm cũ
// gắn nhầm với nội dung đã sửa).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;
  if (auth.role !== "student") {
    return NextResponse.json({ error: "Chỉ học viên mới nộp được bài tập" }, { status: 403 });
  }

  const { id: assignmentId } = await params;

  try {
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: { lesson: { select: { chapter: { select: { section: { select: { courseId: true } } } } } } },
    });
    if (!assignment) return NextResponse.json({ error: "Không tìm thấy bài tập" }, { status: 404 });

    const courseId = assignment.lesson.chapter.section.courseId;
    const enrolled = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: auth.userId, courseId } },
    });
    if (!isEnrollmentActive(enrolled)) {
      return NextResponse.json({ error: "Bạn chưa ghi danh khoá học này" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({})) as { fileUrl?: string; fileName?: string; linkUrl?: string };

    // MD-14: học sinh có thể nộp bằng LINK bài làm Azota thay vì tệp. Chỉ nhận link dạng chữ trên azota.vn; KHÔNG nhận ảnh bài làm
    // (em dưới 16 tuổi, chưa có ý kiến pháp lý: HIEN-CO-VA-DINH-VI.md mục 6.2) nên không có đường nào đưa ảnh vào đây qua `linkUrl`.
    let fileUrl: string, fileName: string | null, kind: "file" | "link";
    if (typeof body.linkUrl === "string" && body.linkUrl.trim()) {
      const w = validateWorkLink(body.linkUrl);
      if (!w.ok || !w.url) return NextResponse.json({ error: w.error ?? "Link bài làm chưa đúng" }, { status: 400 });
      fileUrl = w.url; fileName = null; kind = "link";
    } else {
      if (!body.fileUrl?.trim()) return NextResponse.json({ error: "Thiếu file bài làm" }, { status: 400 });
      fileUrl = body.fileUrl.trim(); fileName = body.fileName?.trim() || null; kind = "file";
    }

    const submission = await prisma.assignmentSubmission.upsert({
      where: { assignmentId_userId: { assignmentId, userId: auth.userId } },
      create: { assignmentId, userId: auth.userId, fileUrl, fileName, kind },
      update: {
        fileUrl, fileName, kind,
        submittedAt: new Date(),
        score: null, comment: null, gradedAt: null, gradedBy: null,
      },
    });

    return NextResponse.json(submission);
  } catch (e) {
    console.error("[POST /api/assignments/[id]/submit]", assignmentId, e);
    return NextResponse.json({ error: "Nộp bài thất bại" }, { status: 400 });
  }
}
