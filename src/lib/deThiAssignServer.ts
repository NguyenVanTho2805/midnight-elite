// BU-03 P3 — phần CÓ DB của "Giao đề": đọc / sửa cấu hình, đóng / mở lại. Luật thuần ở deThiAssign.ts.
// Mọi hàm giả định người gọi đã qua requireTutor() (Q1). Quyền theo đề (Q2): không có → 404, của gia sư khác → 403, id mã đề con → 400 IS_VARIANT.
// Cài đặt của đề gốc được ĐỒNG BỘ sang mọi mã đề con trong CÙNG giao dịch (đóng / mở lại cũng nguyên tử cả nhóm — mục 6.2).
// Mật khẩu: chỉ băm (examPassword.ts) rồi ghi; GET chỉ trả hasPassword. Không đọc/ghi gì về price / activeGuest / guestCanTake.
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { computeExamStatus } from "@/lib/examData";
import { hasExamPassword, examPasswordPatch } from "@/lib/examPassword";
import { examHoldsResults } from "@/lib/quizGrade";
import { dmyFromKey, durationText, keyFromDmy, logChange, parseDurationMinutes, statusOf, todayKeyVN, type OwnedQuiz } from "@/lib/quizServer";
import { checkOwnCourse, type Fail, type Outcome } from "@/lib/deThiServer";
import { isExamMode, validateAssignPatch, type AssignWarning, type ExamMode } from "@/lib/deThiAssign";
import { variantCode } from "@/lib/deThiVariants";

const fail = (status: number, error: string, code?: string): Fail => ({ ok: false, status, error, ...(code ? { code } : {}) });

export interface AssignView {
  mode: ExamMode | null; courseId: string | null; dateKey: string | null; time: string; durationMin: number | null;
  hasPassword: boolean; maxAttempts: number | null; answerVisibility: string; hideAnswerForWrong: boolean; showLeaderboard: boolean; holdUntilPublish: boolean;
  status: "draft" | "upcoming" | "available" | "completed";
  variants: { id: string; variantNo: number; code: number }[];
  /** Ngoài hợp đồng gốc (đã báo): số lượt làm của cả nhóm mã đề — để giao diện biết khoá nào đang bị khoá. */
  attemptCount: number;
}

/** Đề gốc của đúng gia sư này + các mã con. */
async function loadRoot(tutorId: string, examId: string): Promise<Outcome<{ exam: OwnedQuiz; childIds: string[]; children: { id: string; variantNo: number | null }[] }>> {
  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam) return fail(404, "Không tìm thấy đề này.");
  if (exam.ownerId !== tutorId) return fail(403, "Đề này không thuộc lớp của cô.");
  if (exam.variantOfId) return { ...fail(400, "Đây là mã đề con. Giao đề ở đề gốc.", "IS_VARIANT"), extra: { variantOfId: exam.variantOfId } };
  const children = await prisma.exam.findMany({ where: { variantOfId: examId }, select: { id: true, variantNo: true }, orderBy: { variantNo: "asc" } });
  return { ok: true, exam, children, childIds: children.map(c => c.id) };
}

async function viewOf(exam: OwnedQuiz, children: { id: string; variantNo: number | null }[]): Promise<AssignView> {
  const ids = [exam.id, ...children.map(c => c.id)];
  const [limit, policy, essay, attemptCount] = await Promise.all([
    prisma.quizAttemptLimit.findUnique({ where: { examId: exam.id }, select: { maxAttempts: true } }),
    prisma.examPublishPolicy.findUnique({ where: { examId: exam.id }, select: { holdUntilPublish: true } }),
    prisma.examQuestion.count({ where: { examId: exam.id, type: "ESSAY" } }),
    prisma.examAttempt.count({ where: { examId: { in: ids } } }),
  ]);
  return {
    mode: isExamMode(exam.mode) ? exam.mode : null,
    courseId: exam.courseId, dateKey: keyFromDmy(exam.date), time: exam.time, durationMin: parseDurationMinutes(exam.duration),
    hasPassword: hasExamPassword(exam), maxAttempts: limit?.maxAttempts ?? null,
    answerVisibility: exam.answerVisibility, hideAnswerForWrong: exam.hideAnswerForWrong, showLeaderboard: exam.showLeaderboard,
    holdUntilPublish: examHoldsResults(policy, { hasEssay: essay > 0, createdAt: exam.createdAt }),
    status: statusOf(exam),
    variants: [{ id: exam.id, variantNo: 1, code: variantCode(1) }, ...children.map(c => ({ id: c.id, variantNo: c.variantNo ?? 0, code: variantCode(c.variantNo ?? 0) }))],
    attemptCount,
  };
}

export async function getAssign(tutorId: string, examId: string): Promise<Outcome<{ view: AssignView }>> {
  const r = await loadRoot(tutorId, examId);
  if (!r.ok) return r;
  return { ok: true, view: await viewOf(r.exam, r.children) };
}

const supersededFail = (e: { supersededById: string | null }): Fail | null =>
  e.supersededById ? { ...fail(409, "Đây là phiên bản cũ, chỉ để xem. Mở phiên bản đang dùng để giao đề.", "SUPERSEDED"), extra: { supersededById: e.supersededById } } : null;

export async function patchAssign(tutorId: string, examId: string, body: unknown): Promise<Outcome<{ view: AssignView; warnings: AssignWarning[] }>> {
  const r = await loadRoot(tutorId, examId);
  if (!r.ok) return r;
  const { exam, children, childIds } = r;
  const sup = supersededFail(exam); if (sup) return sup;

  const ids = [exam.id, ...childIds];
  const attemptCount = await prisma.examAttempt.count({ where: { examId: { in: ids } } });
  const check = validateAssignPatch(body, {
    attemptCount, isDraft: exam.isDraft, todayKey: todayKeyVN(),
    current: { mode: isExamMode(exam.mode) ? exam.mode : null, courseId: exam.courseId, dateKey: keyFromDmy(exam.date), time: exam.time, durationMin: parseDurationMinutes(exam.duration) },
  });
  if (!check.ok) return fail(check.status, check.error, check.code);
  const p = check.patch;

  if (typeof p.courseId === "string") { const bad = await checkOwnCourse(tutorId, p.courseId); if (bad) return bad; }

  const data: Prisma.ExamUncheckedUpdateInput = {};
  if (p.mode !== undefined) data.mode = p.mode;
  if (p.courseId !== undefined) data.courseId = p.courseId;
  if (p.dateKey !== undefined) data.date = dmyFromKey(p.dateKey);
  if (p.time !== undefined) data.time = p.time;
  if (p.durationMin !== undefined) data.duration = durationText(p.durationMin);
  if (p.answerVisibility !== undefined) data.answerVisibility = p.answerVisibility;
  if (p.hideAnswerForWrong !== undefined) data.hideAnswerForWrong = p.hideAnswerForWrong;
  if (p.showLeaderboard !== undefined) data.showLeaderboard = p.showLeaderboard;
  if (p.password !== undefined) Object.assign(data, await examPasswordPatch(p.password)); // băm; bản thô luôn bị xoá

  const next = { date: (data.date as string | undefined) ?? exam.date, time: (data.time as string | undefined) ?? exam.time };
  await prisma.$transaction(async tx => {
    const hasData = Object.keys(data).length > 0;
    await tx.exam.update({ where: { id: exam.id }, data: { ...data, ...(hasData ? { status: computeExamStatus(next.date, next.time, exam.active) } : {}) } });
    if (childIds.length > 0 && hasData) {
      await tx.exam.updateMany({ where: { variantOfId: exam.id }, data: { ...data, status: computeExamStatus(next.date, next.time, exam.active) } });
    }
    if (p.maxAttempts !== undefined) {
      for (const id of ids) {
        if (p.maxAttempts === null) await tx.quizAttemptLimit.deleteMany({ where: { examId: id } });
        else await tx.quizAttemptLimit.upsert({ where: { examId: id }, create: { examId: id, maxAttempts: p.maxAttempts }, update: { maxAttempts: p.maxAttempts } });
      }
    }
    if (p.holdUntilPublish !== undefined) {
      for (const id of ids) {
        await tx.examPublishPolicy.upsert({ where: { examId: id }, create: { examId: id, holdUntilPublish: p.holdUntilPublish, updatedById: tutorId }, update: { holdUntilPublish: p.holdUntilPublish, updatedById: tutorId } });
      }
    }
    await logChange(tx, { examId: exam.id, rootExamId: exam.rootExamId, actorId: tutorId, kind: "edit", note: "Sửa cài đặt giao đề" + (check.modeDefaultsApplied ? " (áp mặc định theo chế độ)" : "") });
  });

  const fresh = await prisma.exam.findUnique({ where: { id: exam.id } });
  return { ok: true, view: await viewOf(fresh ?? exam, children), warnings: check.warnings };
}

/** Đóng / mở lại cả nhóm mã đề trong MỘT giao dịch. Đề nháp → 409 NOT_PUBLISHED. Lặp lại cùng hành động là không-làm-gì (200). */
export async function setAssignActive(tutorId: string, examId: string, action: unknown): Promise<Outcome<{ view: AssignView }>> {
  if (action !== "close" && action !== "reopen") return fail(400, "Hành động phải là close hoặc reopen.", "BAD_ACTION");
  const r = await loadRoot(tutorId, examId);
  if (!r.ok) return r;
  const { exam, children } = r;
  const sup = supersededFail(exam); if (sup) return sup;
  if (exam.isDraft) return fail(409, "Đề còn là bản nháp. Phát hành đề trước đã.", "NOT_PUBLISHED");
  const active = action === "reopen";
  if (exam.active === active) return { ok: true, view: await viewOf(exam, children) };
  const status = computeExamStatus(exam.date, exam.time, active);
  await prisma.$transaction(async tx => {
    await tx.exam.update({ where: { id: exam.id }, data: { active, status } });
    await tx.exam.updateMany({ where: { variantOfId: exam.id }, data: { active, status } });
    await logChange(tx, { examId: exam.id, rootExamId: exam.rootExamId, actorId: tutorId, kind: "edit", note: active ? "Mở lại bài" : "Đóng bài" });
  });
  const fresh = await prisma.exam.findUnique({ where: { id: exam.id } });
  return { ok: true, view: await viewOf(fresh ?? exam, children) };
}
