// QZ-08 / QZ-06: phần chạm DB của chấm quiz hỗn hợp, công bố và theo dõi/phân tích. Quy tắc thuần ở quizGrade.ts.
// Quyền: CHỈ gia sư chủ đề (Exam.ownerId === userId). Đề không có / không phải của mình: không có → 404, của gia sư khác → 403.
// Bất biến: không sửa model Exam*/ExamQuestion; điểm chỉ ghi vào ExamAnswer.pointsAwarded/teacherComment (cột có sẵn) rồi regradeAttempt,
// mỗi lần lưu có một dòng ExamGradeEdit; học sinh chỉ thấy điểm khi đề có chính sách giữ điểm VÀ lượt đã công bố (xem examHold.ts).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import type { SessionPayload } from "@/lib/session";
import { computeRawEarned, regradeAttempt } from "@/lib/examGrading";
import { logAction } from "@/lib/auditLog";
import {
  buildQuizAnalytics, essayNeedsGrading, gradeState, normalizeComment, planPublishBatch, validateEssayPoints,
  type GradeState,
} from "@/lib/quizGrade";

const MAX_ATTEMPTS = 500;

export async function requireQuizTutor(): Promise<SessionPayload | NextResponse> {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;
  if (auth.role !== "admin" || auth.adminRole !== "teacher") {
    return NextResponse.json({ error: "Chỉ gia sư mới chấm quiz" }, { status: 403 });
  }
  return auth;
}

const examSelect = { id: true, title: true, ownerId: true, totalPoints: true, date: true, time: true, duration: true, courseId: true, course: { select: { name: true } } } as const;
export type OwnedExam = NonNullable<Awaited<ReturnType<typeof findExam>>>;
function findExam(examId: string) { return prisma.exam.findUnique({ where: { id: examId }, select: examSelect }); }

export async function requireOwnedExam(examId: string): Promise<{ auth: SessionPayload; exam: OwnedExam } | NextResponse> {
  const auth = await requireQuizTutor();
  if (isNextResponse(auth)) return auth;
  const exam = await findExam(examId);
  if (!exam) return NextResponse.json({ error: "Không tìm thấy đề" }, { status: 404 });
  if (exam.ownerId !== auth.userId) return NextResponse.json({ error: "Đề này không phải của bạn" }, { status: 403 });
  return { auth, exam };
}

async function loadQuestions(examId: string) {
  return prisma.examQuestion.findMany({ where: { examId }, orderBy: { order: "asc" }, include: { options: { orderBy: { order: "asc" } } } });
}

export interface AttemptRow {
  attemptId: string;
  studentName: string;
  attemptNo: number;          // lượt thứ mấy của học sinh này ở đề này
  status: string;
  submittedAt: string | null;
  objectiveRaw: number; objectiveMax: number;
  essayRaw: number; essayMax: number;
  pendingEssays: number; blankEssays: number;
  rawTotal: number | null;    // ExamAttempt.totalPoints (điểm thô tối đa lúc bắt đầu)
  score: number | null;       // điểm quy đổi theo thang của đề (ExamAttempt.score)
  state: GradeState;
  publishedAt: string | null;
  tabSwitchCount: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Danh sách lượt đã nộp của đề kèm điểm khách quan / tự luận và trạng thái chấm. Có TÊN học sinh: chỉ gọi sau requireOwnedExam. */
export async function loadAttemptRows(exam: OwnedExam) {
  const [questions, attempts, policy] = await Promise.all([
    loadQuestions(exam.id),
    prisma.examAttempt.findMany({
      where: { examId: exam.id, status: { not: "in_progress" } },
      orderBy: { submittedAt: "asc" }, take: MAX_ATTEMPTS,
      select: { id: true, userId: true, status: true, score: true, totalPoints: true, submittedAt: true, startedAt: true, tabSwitchCount: true, user: { select: { name: true } } },
    }),
    prisma.examPublishPolicy.findUnique({ where: { examId: exam.id } }),
  ]);
  const ids = attempts.map(a => a.id);
  const [answers, pubs] = await Promise.all([
    prisma.examAnswer.findMany({ where: { attemptId: { in: ids } }, select: { attemptId: true, questionId: true, textAnswer: true, pointsAwarded: true } }),
    prisma.examAttemptPublish.findMany({ where: { attemptId: { in: ids } } }),
  ]);
  const essayQ = new Map(questions.filter(q => q.type === "ESSAY").map(q => [q.id, q]));
  const essayMax = r2([...essayQ.values()].reduce((s, q) => s + q.points, 0));
  const objectiveMax = r2(questions.filter(q => q.type !== "ESSAY").reduce((s, q) => s + q.points, 0));
  const pubBy = new Map(pubs.map(p => [p.attemptId, p]));
  const ordinal = new Map<string, number>();

  const rows: AttemptRow[] = [];
  for (const a of attempts) {
    const mine = answers.filter(x => x.attemptId === a.id && essayQ.has(x.questionId));
    const essayRaw = r2(mine.reduce((s, x) => s + (x.pointsAwarded ?? 0), 0));
    const pending = mine.filter(essayNeedsGrading).length;
    const blank = [...essayQ.keys()].filter(qid => !mine.find(x => x.questionId === qid)?.textAnswer?.trim()).length;
    const rawEarned = await prisma.$transaction(tx => computeRawEarned(tx, { id: a.id, examId: exam.id }));
    const no = (ordinal.get(a.userId) ?? 0) + 1; ordinal.set(a.userId, no);
    const pub = pubBy.get(a.id);
    rows.push({
      attemptId: a.id, studentName: a.user?.name ?? "Học viên", attemptNo: no, status: a.status,
      submittedAt: a.submittedAt?.toISOString() ?? null,
      objectiveRaw: r2(rawEarned - essayRaw), objectiveMax, essayRaw, essayMax,
      pendingEssays: pending, blankEssays: blank, rawTotal: a.totalPoints, score: a.score,
      state: gradeState({ pendingEssays: pending, published: !!pub }),
      publishedAt: pub?.publishedAt.toISOString() ?? null,
      tabSwitchCount: a.tabSwitchCount,
    });
  }
  return { rows, hasEssay: essayQ.size > 0, hold: !!policy?.holdUntilPublish, objectiveMax, essayMax };
}

/** Chi tiết một lượt cho màn chấm: các câu tự luận (bài làm, điểm, nhận xét, đáp án tham khảo — chỉ gia sư thấy). */
export async function loadAttemptDetail(exam: OwnedExam, attemptId: string) {
  const attempt = await prisma.examAttempt.findUnique({
    where: { id: attemptId },
    select: { id: true, examId: true, status: true, score: true, totalPoints: true, submittedAt: true, user: { select: { name: true } } },
  });
  if (!attempt || attempt.examId !== exam.id) return null;
  const questions = (await loadQuestions(exam.id));
  const [answers, pub, edits] = await Promise.all([
    prisma.examAnswer.findMany({ where: { attemptId }, select: { questionId: true, textAnswer: true, pointsAwarded: true, teacherComment: true } }),
    prisma.examAttemptPublish.findUnique({ where: { attemptId } }),
    prisma.examGradeEdit.count({ where: { attemptId } }),
  ]);
  const by = new Map(answers.map(a => [a.questionId, a]));
  const essays = questions.map((q, i) => ({ q, order: i + 1 })).filter(x => x.q.type === "ESSAY").map(({ q, order }) => {
    const a = by.get(q.id) ?? null;
    return {
      questionId: q.id, order, text: q.text, points: q.points,
      textAnswer: a?.textAnswer ?? null, blank: !a?.textAnswer?.trim(),
      pointsAwarded: a?.pointsAwarded ?? null, teacherComment: a?.teacherComment ?? null,
      reference: q.explanation ?? null,
    };
  });
  const pending = essays.filter(e => !e.blank && e.pointsAwarded === null).length;
  return {
    attemptId, studentName: attempt.user?.name ?? "Học viên", status: attempt.status, submittedAt: attempt.submittedAt?.toISOString() ?? null,
    score: attempt.score, rawTotal: attempt.totalPoints, essays, pendingEssays: pending, editCount: edits,
    state: gradeState({ pendingEssays: pending, published: !!pub }), publishedAt: pub?.publishedAt.toISOString() ?? null,
  };
}

export type SaveResult = { ok: true; score: number | null; changed: number } | { ok: false; status: number; error: string };

/** Lưu điểm + nhận xét nhiều câu tự luận của một lượt. Kiểm hết trước khi ghi (không ghi nửa chừng); chỉ ghi lịch sử khi có thay đổi thật. */
export async function saveEssayGrades(exam: OwnedExam, attemptId: string, editorId: string, grades: unknown): Promise<SaveResult> {
  if (!Array.isArray(grades) || grades.length === 0) return { ok: false, status: 400, error: "Chưa có điểm nào để lưu." };
  const attempt = await prisma.examAttempt.findUnique({ where: { id: attemptId }, select: { id: true, examId: true, status: true, userId: true } });
  if (!attempt || attempt.examId !== exam.id) return { ok: false, status: 404, error: "Không tìm thấy bài nộp" };
  if (attempt.status === "in_progress") return { ok: false, status: 409, error: "Học sinh chưa nộp bài." };

  const essays = await prisma.examQuestion.findMany({ where: { examId: exam.id, type: "ESSAY" }, select: { id: true, points: true } });
  const pointsOf = new Map(essays.map(q => [q.id, q.points]));
  const plan: { questionId: string; points: number; comment: string | null }[] = [];
  const seen = new Set<string>();
  for (const g of grades as { questionId?: unknown; points?: unknown; comment?: unknown }[]) {
    const qid = typeof g?.questionId === "string" ? g.questionId : "";
    const max = pointsOf.get(qid);
    if (max === undefined) return { ok: false, status: 400, error: "Có câu không phải tự luận của đề này." };
    if (seen.has(qid)) return { ok: false, status: 400, error: "Một câu được gửi hai lần." };
    seen.add(qid);
    const p = validateEssayPoints(g.points, max);
    if (!p.ok) return { ok: false, status: 400, error: p.error };
    const c = normalizeComment(g.comment);
    if (!c.ok) return { ok: false, status: 400, error: c.error };
    plan.push({ questionId: qid, points: p.value, comment: c.value });
  }

  let changed = 0;
  await prisma.$transaction(async tx => {
    for (const g of plan) {
      const prev = await tx.examAnswer.findUnique({ where: { attemptId_questionId: { attemptId, questionId: g.questionId } }, select: { pointsAwarded: true, teacherComment: true } });
      if (prev && prev.pointsAwarded === g.points && (prev.teacherComment ?? null) === g.comment) continue;
      await tx.examAnswer.upsert({
        where: { attemptId_questionId: { attemptId, questionId: g.questionId } },
        create: { attemptId, questionId: g.questionId, pointsAwarded: g.points, teacherComment: g.comment },
        update: { pointsAwarded: g.points, teacherComment: g.comment },
      });
      await tx.examGradeEdit.create({
        data: { examId: exam.id, attemptId, questionId: g.questionId, editedById: editorId, prevPoints: prev?.pointsAwarded ?? null, newPoints: g.points, prevComment: prev?.teacherComment ?? null, newComment: g.comment },
      });
      changed++;
    }
  });
  const updated = await regradeAttempt(attemptId);
  if (changed > 0) await logAction(editorId, "exam_answer.grade", "ExamAttempt", attemptId, { examId: exam.id, userId: attempt.userId, questions: plan.map(p => p.questionId), changed });
  return { ok: true, score: updated?.score ?? null, changed };
}

/** Dùng cho API chấm một câu có sẵn (/api/exams/attempts/[id]/answers/[qid]/grade) để lịch sử sửa điểm không bị hụt. */
export async function recordGradeEdit(d: { examId: string; attemptId: string; questionId: string; editedById: string; prevPoints: number | null; newPoints: number; prevComment: string | null; newComment: string | null }) {
  if (d.prevPoints === d.newPoints && d.prevComment === d.newComment) return;
  try { await prisma.examGradeEdit.create({ data: d }); } catch (e) { console.error("[recordGradeEdit]", e); }
}

export type PublishResult = { published: string[]; alreadyPublished: string[]; skipped: { id: string; reason: string }[] };

/** Công bố điểm cho các lượt (null = mọi lượt đã nộp của đề). Lượt còn tự luận chưa chấm bị bỏ qua và nêu lý do; chạy lại không công bố đôi. */
export async function publishAttempts(exam: OwnedExam, editorId: string, attemptIds: string[] | null): Promise<PublishResult | { error: string; status: number }> {
  const attempts = await prisma.examAttempt.findMany({
    where: { examId: exam.id, ...(attemptIds ? { id: { in: attemptIds } } : {}) },
    select: { id: true, status: true }, take: MAX_ATTEMPTS,
  });
  if (attemptIds && attempts.length !== new Set(attemptIds).size) return { status: 404, error: "Có bài nộp không thuộc đề này" };
  const ids = attempts.map(a => a.id);
  const [pubs, ans] = await Promise.all([
    prisma.examAttemptPublish.findMany({ where: { attemptId: { in: ids } }, select: { attemptId: true } }),
    prisma.examAnswer.findMany({ where: { attemptId: { in: ids }, question: { type: "ESSAY" } }, select: { attemptId: true, textAnswer: true, pointsAwarded: true } }),
  ]);
  const pubSet = new Set(pubs.map(p => p.attemptId));
  const pendingBy = new Map<string, number>();
  for (const a of ans) if (essayNeedsGrading(a)) pendingBy.set(a.attemptId, (pendingBy.get(a.attemptId) ?? 0) + 1);
  const plan = planPublishBatch(attempts.map(a => ({ id: a.id, attemptStatus: a.status, pendingEssays: pendingBy.get(a.id) ?? 0, published: pubSet.has(a.id) })));
  // Bài lượt đang làm dở không phải "lỗi" của lô: bỏ qua im lặng trong lô "tất cả", nhưng nêu rõ khi gia sư chọn đúng lượt đó.
  const skipped = attemptIds ? plan.skipped : plan.skipped.filter(s => s.reason !== "Học sinh chưa nộp bài.");

  if (plan.toPublish.length > 0) {
    await prisma.examAttemptPublish.createMany({ data: plan.toPublish.map(id => ({ attemptId: id, examId: exam.id, publishedById: editorId })), skipDuplicates: true });
    // Giờ lượt không còn bị giữ: chấm lại để điểm vào ExamResult (bảng xếp hạng) đúng một lần.
    for (const id of plan.toPublish) await regradeAttempt(id);
    await logAction(editorId, "exam_attempt.publish", "Exam", exam.id, { count: plan.toPublish.length, attemptIds: plan.toPublish });
  }
  return { published: plan.toPublish, alreadyPublished: plan.alreadyPublished, skipped };
}

export async function setHoldPolicy(examId: string, editorId: string, hold: boolean) {
  return prisma.examPublishPolicy.upsert({
    where: { examId }, create: { examId, holdUntilPublish: hold, updatedById: editorId }, update: { holdUntilPublish: hold, updatedById: editorId },
  });
}

/** Lịch sử cho tab "Lịch sử công bố": công bố theo lượt + mỗi lần sửa điểm. Có tên học sinh; chỉ cho gia sư chủ. */
export async function loadHistory(exam: OwnedExam) {
  const [pubs, edits, questions] = await Promise.all([
    prisma.examAttemptPublish.findMany({ where: { examId: exam.id }, orderBy: { publishedAt: "desc" }, take: 200 }),
    prisma.examGradeEdit.findMany({ where: { examId: exam.id }, orderBy: { createdAt: "desc" }, take: 300 }),
    prisma.examQuestion.findMany({ where: { examId: exam.id }, orderBy: { order: "asc" }, select: { id: true } }),
  ]);
  const attemptIds = [...new Set([...pubs.map(p => p.attemptId), ...edits.map(e => e.attemptId)])];
  const attempts = await prisma.examAttempt.findMany({ where: { id: { in: attemptIds }, examId: exam.id }, select: { id: true, user: { select: { name: true } } } });
  const nameOf = new Map(attempts.map(a => [a.id, a.user?.name ?? "Học viên"]));
  const orderOf = new Map(questions.map((q, i) => [q.id, i + 1]));
  return {
    publishes: pubs.filter(p => nameOf.has(p.attemptId)).map(p => ({ attemptId: p.attemptId, studentName: nameOf.get(p.attemptId)!, at: p.publishedAt.toISOString() })),
    edits: edits.filter(e => nameOf.has(e.attemptId)).map(e => ({
      id: e.id, attemptId: e.attemptId, studentName: nameOf.get(e.attemptId)!, questionOrder: orderOf.get(e.questionId) ?? null,
      prevPoints: e.prevPoints, newPoints: e.newPoints, prevComment: e.prevComment, newComment: e.newComment, at: e.createdAt.toISOString(),
    })),
  };
}

/** QZ-06: số liệu phân tích (không tên). Tính ĐÚNG từ các hàng gốc rồi đưa qua buildQuizAnalytics. */
export async function loadAnalytics(exam: OwnedExam) {
  const questions = await loadQuestions(exam.id);
  const attempts = await prisma.examAttempt.findMany({
    where: { examId: exam.id }, take: MAX_ATTEMPTS,
    select: { id: true, userId: true, status: true, score: true, totalPoints: true, tabSwitchCount: true, startedAt: true, submittedAt: true },
  });
  const answers = await prisma.examAnswer.findMany({ where: { attemptId: { in: attempts.map(a => a.id) } }, select: { attemptId: true, questionId: true, optionId: true, textAnswer: true, pointsAwarded: true } });
  return buildQuizAnalytics({
    examTotal: exam.totalPoints,
    questions: questions.map(q => ({ id: q.id, type: q.type, points: q.points, options: q.options.map(o => ({ id: o.id, isCorrect: o.isCorrect, text: o.text })) })),
    attempts, answers,
  });
}

/** QZ-06: theo dõi lượt làm theo học sinh (có tên): số lượt, lượt gần nhất, đang làm dở, rời tab, và học sinh trong lớp của đề chưa làm. */
export async function loadTracking(exam: OwnedExam, tutorId: string) {
  const attempts = await prisma.examAttempt.findMany({
    where: { examId: exam.id }, orderBy: { startedAt: "asc" }, take: MAX_ATTEMPTS,
    select: { id: true, userId: true, status: true, startedAt: true, submittedAt: true, tabSwitchCount: true, user: { select: { name: true } } },
  });
  const byUser = new Map<string, typeof attempts>();
  for (const a of attempts) byUser.set(a.userId, [...(byUser.get(a.userId) ?? []), a]);
  const students = [...byUser.entries()].map(([userId, list]) => {
    const last = list[list.length - 1];
    return {
      userId, name: last.user?.name ?? "Học viên", attemptCount: list.length,
      submittedCount: list.filter(a => a.status !== "in_progress").length,
      inProgress: list.some(a => a.status === "in_progress"),
      lastAt: (last.submittedAt ?? last.startedAt).toISOString(),
      tabSwitches: list.reduce((s, a) => s + a.tabSwitchCount, 0),
    };
  }).sort((a, b) => a.name.localeCompare(b.name, "vi"));

  let notStarted: { userId: string; name: string }[] = [];
  if (exam.courseId) {
    const course = await prisma.course.findUnique({ where: { id: exam.courseId }, select: { ownerId: true } });
    if (course?.ownerId === tutorId) {
      const enr = await prisma.enrollment.findMany({ where: { courseId: exam.courseId, status: "active" }, select: { userId: true, user: { select: { name: true } } }, take: 300 });
      notStarted = enr.filter(e => !byUser.has(e.userId)).map(e => ({ userId: e.userId, name: e.user?.name ?? "Học viên" }));
    }
  }
  return { students, notStarted, enrolledKnown: !!exam.courseId };
}

