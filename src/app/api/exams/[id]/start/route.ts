import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStudentRole } from "@/lib/studentOnly";
import { PUBLIC_EXAM_CLOSED_CODE, PUBLIC_EXAM_CLOSED_MESSAGE } from "@/lib/features";
import { closedPublicExam } from "@/lib/publicExamGate";
import type { Prisma } from "@/generated/prisma/client";
import { finalizeAttempt, parseDurationMinutes, shuffleArray, shuffleQuestionOrderBySections, computeSectionWindows, applyAttemptOrder, loadAnswerState } from "@/lib/examGrading";
import { isEnrollmentActive } from "@/lib/enrollment";
import { ATTEMPT_SUSPENDED_MESSAGE, ENROLLMENT_SUSPENDED_CODE } from "@/lib/enrollmentMessages";
import { examPasswordPatch, hasExamPassword, verifyExamPassword } from "@/lib/examPassword";
import { loadEffectivePolicy } from "@/lib/quizPublication";
import { attemptsGate } from "@/lib/quizRoom";
import { DEADLINE_PASSED_MESSAGE, canStartByDeadline } from "@/lib/quizDeadline";
import { getOwnDeadline } from "@/lib/quizDeadlineServer";
import { examHolds } from "@/lib/examHold";
import { isExamMode } from "@/lib/deThiAssign";
import { clampExpiresAt, examWindowOf, startVerdict } from "@/lib/examWindow";
import { pickMember, variantCodeOf } from "@/lib/examVariantRoute";
import { findInProgressInGroup, loadGroup } from "@/lib/examVariantServer";
import { practicePolicy } from "@/lib/examPracticeLib";

// POST /api/exams/[id]/start — tạo attempt mới hoặc resume attempt in_progress đang có.
// Idempotent: gọi lại nhiều lần (vd sau khi refresh trang) sẽ trả về cùng 1 attempt
// kèm các câu trả lời đã lưu, cho tới khi attempt đó submit hoặc hết giờ.
//
// BE-080 (chốt 06/10/2026): ExamGuestAccess giữ nguyên là công cụ cho gia
// sư gửi đề cho khách hàng dùng thử, NHƯNG khách BẮT BUỘC đăng ký tài
// khoản trước mới thi được — dòng `if (!session) return 401` dưới là chốt
// kiểm soát điểm vào duy nhất; mọi mã guest-access đều gắn vào userId của
// tài khoản thật, không có "khách ẩn danh làm bài".
//
// BU-04 (D2 của BU-03): máy chủ tự ép những gì giao đề chỉ mới GHI.
//  • Id mã con quy về đề GỐC; học sinh được chia mã bằng pickMember (ổn định theo gốc + học sinh); số lượt đếm theo CẢ NHÓM mã đề.
//  • Đề đã đóng (active=false) không mở lượt mới (lượt đang làm dở vẫn tiếp tục).
//  • mode=test: ép khung giờ [mở, mở + thời lượng] (409 not_open / closed), hạn lượt bị cắt ở cuối khung (đề chia Phần có giờ riêng thì không cắt).
//  • mode=practice / mode=null (đề cũ): không ép khung giờ.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireStudentRole();
  if (session instanceof NextResponse) return session;

  const { id: requestedId } = await params;

  try {
    const group = await loadGroup(requestedId);
    if (!group) return NextResponse.json({ error: "Không tìm thấy đề thi" }, { status: 404 });
    const examId = group.rootId; // mọi chính sách (lớp, giá, mật khẩu, khung giờ, hạn riêng, số lượt) đọc ở ĐỀ GỐC

    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) return NextResponse.json({ error: "Không tìm thấy đề thi" }, { status: 404 });
    // QZ-04: bản nháp chưa phát hành — học sinh không vào thi được dù biết địa chỉ. (Đề cũ có isDraft = false nên không đổi gì.)
    if (exam.isDraft) {
      return NextResponse.json({ error: "Quiz này chưa được phát hành." }, { status: 409 });
    }
    const mode = isExamMode(exam.mode) ? exam.mode : null;
    const win = examWindowOf(exam);

    let attempt = await findInProgressInGroup(session.userId, group.ids);

    // Gia sư đóng bài (active=false): không mở lượt MỚI. Lượt đang làm dở vẫn được tiếp tục.
    // DG: thi thử công khai đang đóng (cờ THI_THU_CONG_KHAI) ⇒ không mở lượt MỚI qua link trực tiếp; lượt đang làm dở vẫn tiếp tục được.
    if (!attempt && await closedPublicExam(exam)) {
      return NextResponse.json({ error: PUBLIC_EXAM_CLOSED_MESSAGE, code: PUBLIC_EXAM_CLOSED_CODE }, { status: 403 });
    }
    if (!attempt && !exam.active) {
      return NextResponse.json({ error: "Bài này đã đóng.", code: "closed" }, { status: 409 });
    }

    if ((await prisma.examQuestion.count({ where: { examId } })) === 0) {
      return NextResponse.json(
        { error: "Đề thi này chưa có câu hỏi trong platform" },
        { status: 409 }
      );
    }

    // Đề gắn courseId: chỉ học viên đã ghi danh ĐÚNG khoá đó mới thi được —
    // áp dụng bất kể đề có thu phí hay không (trước đây chỉ check khi
    // price>0, khiến đề MIỄN PHÍ gắn khoá vẫn mở cho mọi học viên bất kỳ khoá
    // nào). Đề thu phí vẫn giữ đường thoát ExamGuestAccess (thủ công, tái
    // dùng quy trình sales hiện có — không có cổng thanh toán tự động, xem
    // reports/2026-07-13.md Giai đoạn 3); đề miễn phí gắn khoá thì chặn thẳng,
    // không có đường thoát trả phí.
    if (exam.courseId) {
      const enrollmentRow = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId: session.userId, courseId: exam.courseId } },
      });
      const isEnrolledInExamCourse = isEnrollmentActive(enrollmentRow);

      if (!isEnrolledInExamCourse) {
        // Đã nghỉ lớp (suspended): báo đúng lý do, kể cả đề thu phí hay miễn phí — không nhập nhằng với "chưa ghi danh" / "yêu cầu phí".
        // Đề thu phí đã được gia sư duyệt tay quyền khách (ExamGuestAccess) thì vẫn theo đường cũ.
        const granted = exam.price && exam.price > 0
          ? await prisma.examGuestAccess.findUnique({ where: { userId_examId: { userId: session.userId, examId } } })
          : null;
        if (enrollmentRow?.status === "suspended" && !granted) {
          return NextResponse.json({ error: ATTEMPT_SUSPENDED_MESSAGE, code: ENROLLMENT_SUSPENDED_CODE }, { status: 403 });
        }
        if (exam.price && exam.price > 0) {
          if (!granted) {
            return NextResponse.json(
              { error: "Đề thi này yêu cầu phí — liên hệ tư vấn để được duyệt quyền vào thi" },
              { status: 402 }
            );
          }
        } else {
          return NextResponse.json(
            { error: "Đề thi này chỉ dành cho học viên đã ghi danh khoá học liên quan" },
            { status: 403 }
          );
        }
      }
    }

    // QZ-07: phiên bản cũ đã bị bản mới thay — không mở lượt MỚI nữa (học sinh đang làm dở vẫn tiếp tục và nộp vào đúng bản này).
    if (!attempt && exam.supersededById) {
      return NextResponse.json({ error: "Quiz này đã có phiên bản mới. Vào danh sách bài để mở bản mới nhất.", code: "SUPERSEDED", supersededById: exam.supersededById }, { status: 409 });
    }

    // Kiểm khung giờ (chỉ mode=test) rồi hạn nộp riêng. Chạy cho lượt MỚI; chạy lại nếu lượt dở vừa bị chấm hết giờ ở dưới.
    // Kiểm trước mật khẩu để em chưa tới giờ / quá hạn không phải nhập mật khẩu rồi mới biết.
    const blockedNewAttempt = async (): Promise<NextResponse | null> => {
      if (mode === "test") {
        const v = startVerdict(exam, new Date());
        if (v === "not_open") return NextResponse.json({ error: "Chưa tới giờ mở bài.", code: "not_open", opensAt: win.opensAt?.toISOString() ?? null }, { status: 409 });
        if (v === "closed") return NextResponse.json({ error: "Bài đã đóng.", code: "closed", closedAt: win.closesAt?.toISOString() ?? null }, { status: 409 });
      }
      // Hạn nộp RIÊNG của học sinh này (gia sư đặt, không đổi lịch chung của đề): quá hạn thì không mở lượt MỚI; lượt đang làm dở không bị cắt.
      if (!canStartByDeadline(await getOwnDeadline(examId, session.userId), new Date(), false)) {
        return NextResponse.json({ error: DEADLINE_PASSED_MESSAGE, code: "past_deadline" }, { status: 409 });
      }
      return null;
    };
    let newAttemptChecked = false;
    if (!attempt) {
      newAttemptChecked = true;
      const blocked = await blockedNewAttempt();
      if (blocked) return blocked;
    }

    // Mật khẩu đề thi: chỉ kiểm tra lúc bắt đầu lượt MỚI (không hỏi lại khi
    // resume/refresh trang giữa chừng — đã vào phòng thi rồi thì không hỏi nữa).
    if (hasExamPassword(exam) && !attempt) {
      const { password } = await req.json().catch(() => ({})) as { password?: string };
      const check = await verifyExamPassword(exam, password);
      if (!check.ok) {
        return NextResponse.json({ error: "Sai mật khẩu đề thi" }, { status: 403 });
      }
      if (check.needsUpgrade && typeof password === "string") {
        // Đề cũ còn mật khẩu thô: nâng lên băm ngay lần nhập đúng đầu tiên (lỗi ở đây không được làm hỏng việc vào thi).
        await prisma.exam.update({ where: { id: examId }, data: await examPasswordPatch(password) }).catch(e => console.error("[exams start] nâng băm mật khẩu", e));
      }
    }

    // Lazy-expiry: attempt cũ đã hết giờ nhưng chưa được chấm — chấm luôn rồi tạo attempt mới
    if (attempt && attempt.expiresAt.getTime() <= Date.now()) {
      await finalizeAttempt(attempt.id, { status: "expired", at: attempt.expiresAt });
      attempt = null;
    }

    if (!attempt) {
      // Lượt cũ vừa bị chấm hết giờ ở trên rồi mới tạo lượt mới: kiểm lại đóng bài / khung giờ / hạn riêng (lần kiểm đầu chỉ chạy khi chưa có lượt dở).
      if (!newAttemptChecked) {
        if (!exam.active) return NextResponse.json({ error: "Bài này đã đóng.", code: "closed" }, { status: 409 });
        const blocked = await blockedNewAttempt();
        if (blocked) return blocked;
      }

      // Chọn mã đề: ổn định theo (gốc, học sinh) — lượt sau luôn cùng mã. Học sinh KHÔNG chọn được và KHÔNG biết mã khác.
      const picked = pickMember(examId, session.userId, group.members);
      const pickedExam = picked.id === examId
        ? exam
        : await prisma.exam.findUnique({ where: { id: picked.id } });
      if (!pickedExam) return NextResponse.json({ error: "Không tìm thấy đề thi" }, { status: 404 });
      const questionsOfPicked = await prisma.examQuestion.findMany({
        where: { examId: picked.id }, orderBy: { order: "asc" }, include: { options: { orderBy: { order: "asc" } } },
      });
      if (questionsOfPicked.length === 0) {
        return NextResponse.json({ error: "Đề thi này chưa có câu hỏi trong platform" }, { status: 409 });
      }

      const totalPoints = questionsOfPicked.reduce((sum, q) => sum + q.points, 0);
      const minutes = parseDurationMinutes(exam.duration);
      // STU-001: số lượt HIỆU LỰC — đề thi thử công khai chưa cài gì → KiN áp 2 lượt (chặn dò đáp án rồi thi lại đẩy điểm lên bảng xếp hạng).
      // BU-04: `exam` là đề GỐC; chính sách đọc theo gốc, lượt đếm theo cả nhóm mã đề (giao dịch bên dưới đếm lại dưới khoá).
      const maxAttempts = (await loadEffectivePolicy(exam, session.userId, { examIds: group.ids })).maxAttempts;
      const windowClosesAt = mode === "test" ? win.closesAt : null;

      // Xáo thứ tự câu hỏi + đáp án riêng cho lượt này, cố định suốt attempt
      // (chống chép bài — học sinh ngồi cạnh nhau thấy thứ tự khác nhau).
      // Chỉ xáo TRONG PHẠM VI TỪNG PHẦN — giữ nguyên thứ tự các Phần.
      const questionOrder = shuffleQuestionOrderBySections(questionsOfPicked);
      const optionOrderByQuestion: Record<string, string[]> = {};
      for (const q of questionsOfPicked) {
        optionOrderByQuestion[q.id] = shuffleArray(q.options.map(o => o.id));
      }

      // QZ-11: kiểm số lượt + tạo lượt trong MỘT giao dịch có khoá theo (học sinh, đề GỐC), để hai yêu cầu đồng thời không cùng lọt qua
      // (vượt số lượt, hoặc sinh hai lượt đang làm). Lượt đang làm dở (do yêu cầu kia vừa tạo) được dùng lại, không tạo thêm.
      // BU-04: đếm lượt theo CẢ NHÓM mã đề (maxAttempts=1 thì làm mã 101 rồi không làm được mã 102).
      const outcome = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${session.userId + ":" + examId}))`;
        const existing = await tx.examAttempt.findFirst({ where: { userId: session.userId, examId: { in: group.ids }, status: "in_progress" }, orderBy: { startedAt: "desc" } });
        if (existing) return { attempt: existing, blocked: false as const };
        const used = await tx.examAttempt.count({ where: { userId: session.userId, examId: { in: group.ids } } });
        if (!attemptsGate({ used, max: maxAttempts, hasInProgress: false }).canStart) return { attempt: null, blocked: true as const };
        const startedAt = new Date();
        // Giờ riêng từng Phần (vd đề ĐGNL HSA) — chỉ bật khi mọi Phần trong đề
        // đều có sectionMinutes, ngược lại null và dùng lại đồng hồ chung như cũ.
        const sectionWindows = computeSectionWindows(questionsOfPicked, startedAt);
        const expiresAt = sectionWindows
          ? new Date(sectionWindows[sectionWindows.length - 1].endsAt) // đề chia Phần có giờ riêng: KHÔNG cắt theo cuối khung
          : clampExpiresAt(startedAt, minutes, windowClosesAt);
        const created = await tx.examAttempt.create({
          data: {
            userId: session.userId,
            examId: picked.id,
            startedAt,
            expiresAt,
            totalPoints,
            questionOrder,
            optionOrderByQuestion,
            sectionWindows: (sectionWindows ?? undefined) as Prisma.InputJsonValue | undefined,
          },
        });
        return { attempt: created, blocked: false as const };
      });
      if (outcome.blocked || !outcome.attempt) {
        return NextResponse.json({ error: `Em đã dùng hết ${maxAttempts} lượt làm bài của đề này.`, code: "attempts_exhausted" }, { status: 409 });
      }
      attempt = outcome.attempt;
    }

    // Câu hỏi của đúng mã đề mà lượt này thuộc về (lượt tiếp tục có thể ở mã con).
    const attemptExamId = attempt.examId;
    const attemptQuestions = await prisma.examQuestion.findMany({
      where: { examId: attemptExamId }, orderBy: { order: "asc" }, include: { options: { orderBy: { order: "asc" } } },
    });
    const { answers, textAnswers, boolAnswersByOption } = await loadAnswerState(attempt.id);
    const questions = applyAttemptOrder(attemptQuestions, attempt);
    const attemptMember = group.members.find(m => m.id === attemptExamId);
    const held = await examHolds(prisma, attemptExamId);

    return NextResponse.json({
      attemptId: attempt.id,
      examId, // ID GỐC — không bao giờ trả id mã con
      mode,
      feedback: practicePolicy({ mode, answerVisibility: exam.answerVisibility, hideAnswerForWrong: exam.hideAnswerForWrong }, held).feedback,
      variantCode: attemptMember ? variantCodeOf(group.members.length, attemptMember.variantNo) : null,
      windowClosesAt: mode === "test" ? win.closesAt?.toISOString() ?? null : null,
      // QZ-11: giờ máy chủ để trình duyệt tính đồng hồ theo máy chủ (không tin đồng hồ máy học sinh).
      serverNow: new Date().toISOString(),
      expiresAt: attempt.expiresAt,
      sectionWindows: attempt.sectionWindows,
      questions,
      answers,
      textAnswers,
      boolAnswers: boolAnswersByOption,
      tabSwitchCount: attempt.tabSwitchCount ?? 0,
    });
  } catch (e) {
    console.error("[POST /api/exams/[id]/start]", e);
    return NextResponse.json({ error: "Không thể bắt đầu bài thi" }, { status: 500 });
  }
}
