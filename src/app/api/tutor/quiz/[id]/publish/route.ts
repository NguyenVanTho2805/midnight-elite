// QZ-04 / QZ-07 — PHÁT HÀNH một bản nháp. Chạy lại luật kiểm cho TỪNG câu (câu thiếu đáp án từ bản nháp nhập tệp bị chặn ở đây).
// Nếu bản nháp là phiên bản mới của một quiz đã có: bản đang dùng được đánh dấu "đã bị thay" (supersededById) — câu hỏi, đáp án,
// bài làm và điểm của bản cũ KHÔNG bị đụng; học sinh đang làm dở bản cũ vẫn nộp được vào bản cũ.
// BU-03 (mục 6.2): đề gốc có mã đề con → phát hành NGUYÊN TỬ cả nhóm (một $transaction); chặn (422) khi còn nhãn ⟦công thức⟧ (FORMULA_UNREAD),
// khi mode=test thiếu giờ (NEED_SCHEDULE), khi mã con không còn khớp đề gốc (VARIANTS_STALE), và khi đề N>1 mã mà phòng thi học sinh chưa hỗ trợ
// (VARIANTS_NOT_READY — cờ VARIANT_STUDENT_SUPPORT ở deThiAssign.ts). Mã đề con không tự phát hành riêng (400 IS_VARIANT) và không sinh thông báo riêng.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { notifyMany } from "@/lib/notify";
import { ENROLLMENT_STATUS } from "@/lib/enrollment";
import { computeExamStatus } from "@/lib/examData";
import { describeValidity } from "@/lib/quizQuestion";
import { keyFromDmy, loadOwnedQuiz, loadQuestions, logChange, parseDurationMinutes, supersededBlock, toInput, tutorOwnsCourse } from "@/lib/quizServer";
import { VARIANT_STUDENT_SUPPORT } from "@/lib/deThiAssign";
import { publishGate } from "@/lib/deThiVariants";
import { loadVariantGroup, lockExam } from "@/lib/deThiServer";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  try {
    const { id } = await params;
    const got = await loadOwnedQuiz(auth.userId, id);
    if (isNextResponse(got)) return got;
    const sup = supersededBlock(got.exam); if (sup) return sup;
    const e = got.exam;
    if (e.variantOfId) return NextResponse.json({ error: "Đây là mã đề con — phát hành cùng đề gốc, không phát hành riêng.", code: "IS_VARIANT", variantOfId: e.variantOfId }, { status: 400 });
    if (!e.isDraft) return NextResponse.json({ error: "Quiz này đã phát hành rồi." }, { status: 409 });

    if (!e.title.trim() || !e.courseId || !(await tutorOwnsCourse(auth.userId, e.courseId))) {
      const early: string[] = [];
      if (!e.title.trim()) early.push("Quiz chưa có tên.");
      if (!e.courseId || !(await tutorOwnsCourse(auth.userId, e.courseId))) early.push("Chọn lớp sẽ làm quiz này.");
      return NextResponse.json({ error: "Chưa phát hành được. " + early[0], problems: early }, { status: 400 });
    }

    const now = new Date();
    const status = computeExamStatus(e.date, e.time, true);
    // Khoá theo đề gốc (chung khoá với tạo mã đề): kiểm lại nháp, đọc lại câu + nhóm mã đề BÊN TRONG giao dịch, rồi mới phát hành.
    // Cổng updateMany({isDraft:true}) → phát hành lần hai thấy count=0 → không làm gì và không báo học sinh lần hai.
    const outcome = await prisma.$transaction(async (tx): Promise<{ res: NextResponse } | { published: boolean }> => {
      await lockExam(tx, id);
      const problems: string[] = [];
      if (!keyFromDmy(e.date)) problems.push("Ngày mở bài chưa đúng.");
      const questions = await loadQuestions(id, tx);
      if (questions.length === 0) problems.push("Quiz chưa có câu nào.");
      questions.forEach((q, i) => { const v = describeValidity(toInput(q)); if (!v.ok) problems.push(`Câu ${i + 1}: ${v.message}.`); });
      if (problems.length) return { res: NextResponse.json({ error: "Chưa phát hành được. " + problems[0], problems }, { status: 400 }) };

      // BU-03: cổng phát hành (công thức chưa đọc, giờ của bài kiểm tra, mã đề).
      const group = await loadVariantGroup(id, tx);
      const gated = [questions, ...group.questionsOfChildren].flat();
      const blocked = publishGate({
        questions: gated.map(q => ({ text: q.text, explanation: q.explanation, options: q.options })),
        variantCount: group.childIds.length > 0 ? group.childIds.length + 1 : 1,
        variantStudentSupport: VARIANT_STUDENT_SUPPORT,
        mode: e.mode,
        hasSchedule: /^\d{1,2}:\d{2}$/.test((e.time ?? "").trim()) && (parseDurationMinutes(e.duration) ?? 0) > 0,
        variantsStale: group.stale,
        hasEssay: questions.some(q => q.type === "ESSAY"), // mã con sao chép câu của gốc nên xét gốc là đủ
      });
      if (blocked) return { res: NextResponse.json({ error: blocked.error, code: blocked.code }, { status: blocked.status }) };

      const claimed = await tx.exam.updateMany({ where: { id, isDraft: true, supersededById: null }, data: { isDraft: false, active: true, status } });
      if (claimed.count === 0) return { published: false };
      if (group.childIds.length > 0) {
        // Mã con đi cùng nhóm: đồng bộ cài đặt của đề gốc (gia sư có thể đã đổi giờ/lớp/xem đáp án sau khi tạo mã đề) rồi phát hành cùng lúc.
        await tx.exam.updateMany({
          where: { variantOfId: id },
          data: {
            isDraft: false, active: true, status, title: e.title, date: e.date, time: e.time, duration: e.duration, courseId: e.courseId, mode: e.mode,
            answerVisibility: e.answerVisibility, hideAnswerForWrong: e.hideAnswerForWrong, showLeaderboard: e.showLeaderboard, password: e.password, passwordHash: e.passwordHash,
          },
        });
      }
      if (e.rootExamId) {
        // Thay bản đang dùng của cùng chuỗi (nếu có). updateMany để không ném lỗi khi chuỗi chưa có bản nào đang dùng.
        await tx.exam.updateMany({
          where: { OR: [{ id: e.rootExamId }, { rootExamId: e.rootExamId }], id: { not: id }, supersededById: null, isDraft: false },
          data: { supersededById: id, supersededAt: now },
        });
      }
      await logChange(tx, { examId: id, rootExamId: e.rootExamId, actorId: auth.userId, kind: e.rootExamId ? "version_published" : "publish", note: e.rootExamId ? `Phát hành phiên bản v${e.versionNo}` : "Phát hành quiz" });
      return { published: true };
    });
    if ("res" in outcome) return outcome.res;
    if (!outcome.published) return NextResponse.json({ error: "Quiz này đã phát hành rồi." }, { status: 409 });

    // Báo học sinh trong lớp khi quiz ĐẦU TIÊN ra mắt (phiên bản mới không báo lại: tránh nhắn một nội dung hai lần). Chữ không có tên học sinh.
    if (!e.rootExamId && e.courseId) {
      const enr = await prisma.enrollment.findMany({ where: { courseId: e.courseId, status: ENROLLMENT_STATUS.ACTIVE }, select: { userId: true } });
      await notifyMany([...new Set(enr.map(x => x.userId))], {
        type: "exam_new", title: e.mode === "practice" ? "Bài luyện tập mới" : "Bài kiểm tra mới", message: `Quiz mới trong lớp: "${e.title}"`, link: `/student/thi-thu/${id}`,
      });
    }
    return NextResponse.json({ success: true, id });
  } catch (err) {
    console.error("[POST /api/tutor/quiz/[id]/publish]", err);
    return NextResponse.json({ error: "Chưa phát hành được. Thử lại sau ít phút." }, { status: 500 });
  }
}
