// QZ-05 — lưu các câu đã RÀ SOÁT từ bước nhập đề thành bản NHÁP (quiz mới) hoặc thêm vào một quiz nháp có sẵn.
// Nội dung trong thân yêu cầu là dữ liệu của gia sư vừa duyệt từng câu; vẫn kiểm lại ở máy chủ (loại câu, độ dài, điểm, ảnh https).
// Luật LỎNG của bản nháp: câu thiếu đáp án vẫn lưu được để làm tiếp, nhưng KHÔNG phát hành được cho tới khi sửa (xem publish).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { coerceQuestionInput, validateForDraft, type QuizQuestionInput } from "@/lib/quizQuestion";
import { QUIZ_CATEGORY, appendQuestions, dmyFromKey, durationText, loadOwnedQuiz, logChange, newExamCode, newExamId, supersededBlock, syncQuizTotals, todayKeyVN, tutorOwnsCourse } from "@/lib/quizServer";

const MAX = 200, TITLE_MAX = 150;

export async function POST(req: NextRequest) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  try {
    const body = await req.json().catch(() => ({})) as { title?: unknown; courseId?: unknown; targetExamId?: unknown; fileName?: unknown; questions?: unknown };
    if (!Array.isArray(body.questions) || body.questions.length === 0) return NextResponse.json({ error: "Chưa có câu nào để lưu." }, { status: 400 });
    if (body.questions.length > MAX) return NextResponse.json({ error: `Một lần lưu tối đa ${MAX} câu.` }, { status: 400 });

    const qs: QuizQuestionInput[] = [];
    for (let i = 0; i < body.questions.length; i++) {
      const q = coerceQuestionInput(body.questions[i]);
      if ("error" in q) return NextResponse.json({ error: `Câu ${i + 1}: ${q.error}` }, { status: 400 });
      const err = validateForDraft(q);
      if (err) return NextResponse.json({ error: `Câu ${i + 1}: ${err}` }, { status: 400 });
      qs.push(q);
    }
    const fileName = typeof body.fileName === "string" ? body.fileName.trim().slice(0, 150) : "";
    const note = `Nhập ${qs.length} câu từ tệp${fileName ? ` "${fileName}"` : ""}`;

    if (typeof body.targetExamId === "string" && body.targetExamId) {
      const got = await loadOwnedQuiz(auth.userId, body.targetExamId);
      if (isNextResponse(got)) return got;
      const sup = supersededBlock(got.exam); if (sup) return sup;
      if (!got.exam.isDraft) return NextResponse.json({ error: "Chỉ thêm được vào quiz nháp. Quiz đã phát hành cần tạo phiên bản mới trước." }, { status: 409 });
      if (got.exam.questions + qs.length > MAX) return NextResponse.json({ error: `Một quiz tối đa ${MAX} câu.` }, { status: 400 });
      await prisma.$transaction(async tx => {
        await appendQuestions(tx, got.exam.id, qs);
        await syncQuizTotals(tx, got.exam.id);
        await logChange(tx, { examId: got.exam.id, rootExamId: got.exam.rootExamId, actorId: auth.userId, kind: "import", note });
      });
      return NextResponse.json({ id: got.exam.id, added: qs.length });
    }

    let title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) title = fileName.replace(/\.[^.]+$/, "").trim();
    if (!title) return NextResponse.json({ error: "Cô đặt tên cho quiz nháp trước nhé." }, { status: 400 });
    if (title.length > TITLE_MAX) return NextResponse.json({ error: `Tên quiz tối đa ${TITLE_MAX} ký tự.` }, { status: 400 });
    let courseId: string | null = null;
    if (typeof body.courseId === "string" && body.courseId) {
      if (!(await tutorOwnsCourse(auth.userId, body.courseId))) return NextResponse.json({ error: "Không tìm thấy lớp này trong lớp của cô." }, { status: 404 });
      courseId = body.courseId;
    }
    const id = await prisma.$transaction(async tx => {
      const newId = newExamId();
      await tx.exam.create({
        data: {
          id: newId, code: await newExamCode(tx), title, category: QUIZ_CATEGORY, date: dmyFromKey(todayKeyVN()), time: "19:00", duration: durationText(15),
          questions: 0, status: "upcoming", participants: 0, active: false, activeGuest: false, guestCanTake: false, createdAt: new Date().toLocaleDateString("vi-VN"),
          ownerId: auth.userId, courseId, isDraft: true, versionNo: 1, totalPoints: 10,
        },
      });
      await appendQuestions(tx, newId, qs);
      await syncQuizTotals(tx, newId);
      await logChange(tx, { examId: newId, rootExamId: null, actorId: auth.userId, kind: "import", note });
      return newId;
    });
    return NextResponse.json({ id, added: qs.length }, { status: 201 });
  } catch (e) {
    console.error("[POST /api/tutor/quiz/import-save]", e);
    return NextResponse.json({ error: "Chưa lưu được bản nháp. Thử lại sau ít phút." }, { status: 500 });
  }
}
