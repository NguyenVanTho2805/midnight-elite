// SCL-C (P1-1) — POST (form) nhập điểm một bài nộp ngay trong sổ điểm: submissionId, score ("8", "8,5"). Cùng luật chấm với
// PATCH /api/assignments/[id]/submissions/[id]/grade (requireAssignmentAccess "grade"; điểm 0..maxPoints). Kết quả ⇒ 303 về sổ điểm của lớp kèm ?ghi=.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAssignmentAccess } from "@/lib/courseAccessServer";
import { logAction } from "@/lib/auditLog";
import { parseScoreInput } from "@/lib/soDiem";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: NextRequest) {
  const fd = await req.formData().catch(() => null);
  const submissionId = fd?.get("submissionId");
  if (typeof submissionId !== "string" || !submissionId || submissionId.length > 100) return NextResponse.json({ error: "Thiếu bài nộp" }, { status: 400, headers: NO_STORE });
  const s = await prisma.assignmentSubmission.findUnique({
    where: { id: submissionId },
    select: { id: true, userId: true, assignmentId: true, assignment: { select: { maxPoints: true, lesson: { select: { chapter: { select: { section: { select: { courseId: true } } } } } } } } },
  });
  if (!s) return NextResponse.json({ error: "Không tìm thấy bài nộp" }, { status: 404, headers: NO_STORE });
  const acc = await requireAssignmentAccess(s.assignmentId, "grade");
  if (!acc.ok) return acc.res;
  const courseId = s.assignment.lesson.chapter.section.courseId;
  // SCL-G-GS: chấm từ Hộp việc (điện thoại) gửi kèm ve=hop-viec ⇒ về lại Hộp việc. Chỉ đúng một giá trị, không nhận đường tuỳ ý.
  const to = fd?.get("ve") === "hop-viec" ? "/lop-cua-toi/hop-viec?" : `/lop-cua-toi/so-diem?lop=${encodeURIComponent(courseId)}&`;
  const go = (ghi: string) => NextResponse.redirect(new URL(`${to}ghi=${ghi}`, req.url), { status: 303, headers: NO_STORE });
  const score = parseScoreInput(fd?.get("score"), s.assignment.maxPoints);
  if (score === null) return go("diem-sai");
  await prisma.assignmentSubmission.update({ where: { id: s.id }, data: { score, gradedAt: new Date(), gradedBy: acc.session.userId } });
  await logAction(acc.session.userId, "assignment_submission.grade", "AssignmentSubmission", s.id, { assignmentId: s.assignmentId, userId: s.userId, score, maxPoints: s.assignment.maxPoints });
  return go("da-cham");
}
