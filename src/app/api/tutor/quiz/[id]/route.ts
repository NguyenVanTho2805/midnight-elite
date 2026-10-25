// QZ-04 / QZ-07 — một quiz của gia sư: xem (kèm câu hỏi và đáp án), sửa cài đặt, bỏ bản nháp.
// Quyền: đề của gia sư khác → 403, không có → 404. Đề đã có lượt làm hoặc đã bị phiên bản mới thay → KHÔNG sửa đè (409, mã HAS_ATTEMPTS / SUPERSEDED).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { examPasswordPatch } from "@/lib/examPassword";
import { isValidDateKey } from "@/lib/classSessions";
import { parseHm } from "@/lib/classSessions";
import { blockIfHasAttempts, supersededBlock, dmyFromKey, durationText, loadOwnedQuiz, logChange, rootIdOf, shapeMeta, shapeQuestionForTutor, loadQuestions, tutorOwnsCourse } from "@/lib/quizServer";
import { computeExamStatus } from "@/lib/examData";

const TITLE_MAX = 150;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  try {
    const { id } = await params;
    const got = await loadOwnedQuiz(auth.userId, id);
    if (isNextResponse(got)) return got;
    const [questions, course, courses] = await Promise.all([
      loadQuestions(id),
      got.exam.courseId ? prisma.course.findUnique({ where: { id: got.exam.courseId }, select: { name: true } }) : null,
      prisma.course.findMany({ where: { ownerId: auth.userId }, select: { id: true, name: true }, orderBy: { createdAt: "desc" }, take: 50 }),
    ]);
    return NextResponse.json(
      { exam: shapeMeta(got.exam, got.attemptCount, course?.name ?? null), questions: questions.map(shapeQuestionForTutor), courses },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    console.error("[GET /api/tutor/quiz/[id]]", e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  try {
    const { id } = await params;
    const got = await loadOwnedQuiz(auth.userId, id);
    if (isNextResponse(got)) return got;
    const sup = supersededBlock(got.exam); if (sup) return sup;
    const blocked = blockIfHasAttempts(got.attemptCount); if (blocked) return blocked;

    const b = await req.json().catch(() => ({})) as Record<string, unknown>;
    const data: Record<string, unknown> = {};
    if ("title" in b) {
      const t = typeof b.title === "string" ? b.title.trim() : "";
      if (!t) return NextResponse.json({ error: "Tên quiz không được để trống." }, { status: 400 });
      if (t.length > TITLE_MAX) return NextResponse.json({ error: `Tên quiz tối đa ${TITLE_MAX} ký tự.` }, { status: 400 });
      data.title = t;
    }
    if ("courseId" in b) {
      if (b.courseId === null || b.courseId === "") data.courseId = null;
      else if (typeof b.courseId === "string" && await tutorOwnsCourse(auth.userId, b.courseId)) data.courseId = b.courseId;
      else return NextResponse.json({ error: "Không tìm thấy lớp này trong lớp của cô." }, { status: 404 });
    }
    if ("dateKey" in b) {
      if (typeof b.dateKey !== "string" || !isValidDateKey(b.dateKey)) return NextResponse.json({ error: "Ngày mở bài chưa đúng. Chọn lại ngày." }, { status: 400 });
      data.date = dmyFromKey(b.dateKey);
    }
    if ("time" in b) {
      if (typeof b.time !== "string" || parseHm(b.time) === null) return NextResponse.json({ error: "Giờ mở bài chưa đúng (ví dụ 19:00)." }, { status: 400 });
      data.time = b.time.trim().padStart(5, "0");
    }
    if ("durationMin" in b) {
      const n = Number(b.durationMin);
      if (!Number.isInteger(n) || n < 1 || n > 300) return NextResponse.json({ error: "Thời lượng làm bài từ 1 đến 300 phút." }, { status: 400 });
      data.duration = durationText(n);
    }
    if ("answerVisibility" in b) {
      if (!["never", "after_submit", "after_exam_ends"].includes(b.answerVisibility as string)) return NextResponse.json({ error: "Cách hiện đáp án không hợp lệ." }, { status: 400 });
      data.answerVisibility = b.answerVisibility;
    }
    if ("hideAnswerForWrong" in b) data.hideAnswerForWrong = b.hideAnswerForWrong === true;
    if ("showLeaderboard" in b) data.showLeaderboard = b.showLeaderboard === true;
    if ("password" in b) Object.assign(data, await examPasswordPatch(b.password));

    if (Object.keys(data).length === 0) return NextResponse.json({ error: "Không có gì để lưu." }, { status: 400 });

    const next = { date: (data.date as string) ?? got.exam.date, time: (data.time as string) ?? got.exam.time };
    const exam = await prisma.$transaction(async tx => {
      const u = await tx.exam.update({ where: { id }, data: { ...data, status: computeExamStatus(next.date, next.time, got.exam.active) } });
      if (!got.exam.isDraft) await logChange(tx, { examId: id, rootExamId: got.exam.rootExamId, actorId: auth.userId, kind: "edit", note: "Sửa cài đặt (chưa có lượt làm)" });
      return u;
    });
    return NextResponse.json({ exam: shapeMeta(exam, got.attemptCount) });
  } catch (e) {
    console.error("[PATCH /api/tutor/quiz/[id]]", e);
    return NextResponse.json({ error: "Chưa lưu được. Thử lại sau ít phút." }, { status: 500 });
  }
}

// DELETE — chỉ bỏ BẢN NHÁP chưa ai làm (kể cả bản nháp phiên bản mới = "Bỏ đề xuất"). Quiz đã phát hành không xoá được ở đây.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  try {
    const { id } = await params;
    const got = await loadOwnedQuiz(auth.userId, id);
    if (isNextResponse(got)) return got;
    if (!got.exam.isDraft) return NextResponse.json({ error: "Quiz đã phát hành không xoá ở đây. Với bài đã có người làm, cô tạo phiên bản mới thay vì xoá." }, { status: 409 });
    if (got.attemptCount > 0) return NextResponse.json({ error: "Bản này đã có lượt làm nên không xoá được.", code: "HAS_ATTEMPTS" }, { status: 409 });
    await prisma.$transaction(async tx => {
      await logChange(tx, { examId: id, rootExamId: got.exam.rootExamId, actorId: auth.userId, kind: "discard", note: got.exam.versionNo > 1 ? `Bỏ đề xuất phiên bản v${got.exam.versionNo}` : "Bỏ quiz nháp" });
      await tx.exam.delete({ where: { id } });
    });
    return NextResponse.json({ success: true, rootId: rootIdOf(got.exam) });
  } catch (e) {
    console.error("[DELETE /api/tutor/quiz/[id]]", e);
    return NextResponse.json({ error: "Chưa xoá được. Thử lại sau ít phút." }, { status: 500 });
  }
}
