import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import { isEnrollmentActive } from "@/lib/enrollment";
import { enrollmentDeniedBody } from "@/lib/suspendedContent";
import { isLearnerVisible } from "@/lib/lessonStatus";
import { validateWorkLink } from "@/lib/mediaLink";
import { removeStoredFiles } from "@/lib/nopTepServer";

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
      select: { mode: true, lesson: { select: { status: true, chapter: { select: { section: { select: { courseId: true } } } } } } },
    });
    // BU-02-PHẲNG (R10): bài tập thuộc mục Nháp/Ẩn ⇒ 404 TRƯỚC kiểm ghi danh.
    if (!assignment || !isLearnerVisible(assignment.lesson.status) || assignment.mode === "azota" || assignmentId.startsWith("azota-")) return NextResponse.json({ error: "Không tìm thấy bài tập" }, { status: 404 });

    const courseId = assignment.lesson.chapter.section.courseId;
    const enrolled = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: auth.userId, courseId } },
    });
    if (!isEnrollmentActive(enrolled)) {
      return NextResponse.json(enrollmentDeniedBody(enrolled, "Bạn chưa ghi danh khoá học này"), { status: 403 });
    }

    const body = await req.json().catch(() => ({})) as { linkUrl?: string };

    // MD-14: học sinh có thể nộp bằng LINK bài làm Azota thay vì tệp. Chỉ nhận link dạng chữ trên azota.vn; KHÔNG nhận ảnh bài làm
    // (em dưới 16 tuổi, chưa có ý kiến pháp lý: HIEN-CO-VA-DINH-VI.md mục 6.2) nên không có đường nào đưa ảnh vào đây qua `linkUrl`.
    // BU-HS-NOP-TEP: đường này KHÔNG còn nhận `fileUrl`/`fileName` do trình duyệt gửi (trước đây tin nguyên chuỗi URL, tệp lên Cloudinary bằng preset không ký ⇒ công khai, nhận cả ảnh).
    // Nộp tệp Word/PDF đi qua /api/media/nop-bai/* + POST /api/student/nop-bai/<bài>/nop (riêng tư, kiểm nội dung). Còn lại ở đây: link Azota. Bài nộp cũ kind "file" giữ nguyên (không đụng).
    let fileUrl: string, fileName: string | null, kind: "link";
    if (typeof body.linkUrl === "string" && body.linkUrl.trim()) {
      const w = validateWorkLink(body.linkUrl);
      if (!w.ok || !w.url) return NextResponse.json({ error: w.error ?? "Link bài làm chưa đúng" }, { status: 400 });
      fileUrl = w.url; fileName = null; kind = "link";
    } else {
      return NextResponse.json({ error: "Hãy dùng chức năng nộp tệp mới" }, { status: 400 });
    }

    // Đang có bài nộp bằng TỆP mà nộp lại bằng link Azota: bỏ bộ tệp cũ (và tệp gia sư đã trả) khỏi kho, vì điểm/nhận xét cũ cũng bị xoá ngay dưới đây.
    const prior = await prisma.assignmentSubmission.findUnique({ where: { assignmentId_userId: { assignmentId, userId: auth.userId } }, select: { id: true } });
    const oldFiles = prior ? await prisma.submissionFile.findMany({ where: { submissionId: prior.id, status: { in: ["pending", "ready"] } }, select: { id: true, driver: true, storageKey: true } }) : [];

    const submission = await prisma.assignmentSubmission.upsert({
      where: { assignmentId_userId: { assignmentId, userId: auth.userId } },
      create: { assignmentId, userId: auth.userId, fileUrl, fileName, kind },
      update: {
        fileUrl, fileName, kind,
        submittedAt: new Date(),
        score: null, comment: null, gradedAt: null, gradedBy: null,
      },
    });

    if (oldFiles.length) {
      await prisma.submissionFile.updateMany({ where: { id: { in: oldFiles.map(f => f.id) } }, data: { status: "removed", removedAt: new Date() } });
      await removeStoredFiles(oldFiles);
    }
    return NextResponse.json(submission);
  } catch (e) {
    console.error("[POST /api/assignments/[id]/submit]", assignmentId, e);
    return NextResponse.json({ error: "Nộp bài thất bại" }, { status: 400 });
  }
}
