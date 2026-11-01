// BU-04 — dựng dữ liệu cho các bài API phòng thi (t-exam-attack, t-exam-practice, t-exam-variants-hs, t-assign-contract). Chỉ tạo bằng prisma, không qua API.
import { prisma } from "@/lib/prisma";

export const SEC = {
  expl: (k: string) => `LỜI-GIẢI-${k}`,
  hint: (k: string) => `GỢI-Ý-${k}`,
  short: "ĐÁP-ÁN-ĐIỀN-NGẮN-5518",
};

const vn = (d: Date) => new Date(d.getTime() + 7 * 3600_000);
const p2 = (n: number) => String(n).padStart(2, "0");
/** dd/mm/yyyy + HH:mm theo giờ VN của một thời điểm (đúng định dạng cột Exam.date / Exam.time). */
export function dmyHm(d: Date) {
  const v = vn(d);
  return { date: `${p2(v.getUTCDate())}/${p2(v.getUTCMonth() + 1)}/${v.getUTCFullYear()}`, time: `${p2(v.getUTCHours())}:${p2(v.getUTCMinutes())}` };
}
export const minutesFromNow = (m: number) => new Date(Date.now() + m * 60_000);

export interface ExamOpts {
  id: string; ownerId: string; courseId?: string | null; mode?: "practice" | "test" | null;
  opensAt?: Date; durationMin?: number; answerVisibility?: string; hideAnswerForWrong?: boolean; active?: boolean;
  createdAt?: string; variantOfId?: string | null; variantNo?: number | null; maxAttempts?: number | null; title?: string; totalPoints?: number;
}
/** Đề với createdAt "2020" mặc định → KHÔNG giữ điểm dù có tự luận (hành vi cũ). Muốn đề mới có tự luận bị giữ: createdAt "2026-10-24". */
export async function mkExam(o: ExamOpts) {
  const { date, time } = dmyHm(o.opensAt ?? minutesFromNow(-10));
  const ex = await prisma.exam.create({
    data: {
      id: o.id, code: o.id, title: o.title ?? `Đề ${o.id}`, category: "Toán", date, time, duration: `${o.durationMin ?? 60} phút`, questions: 0, status: "available",
      createdAt: o.createdAt ?? "2020", ownerId: o.ownerId, courseId: o.courseId ?? null, totalPoints: o.totalPoints ?? 10,
      answerVisibility: o.answerVisibility ?? "after_submit", hideAnswerForWrong: o.hideAnswerForWrong ?? false, active: o.active ?? true,
      mode: o.mode ?? null, variantOfId: o.variantOfId ?? null, variantNo: o.variantNo ?? null,
    },
  });
  if (o.maxAttempts) await prisma.quizAttemptLimit.create({ data: { examId: ex.id, maxAttempts: o.maxAttempts } });
  return ex;
}

let seq = 0;
export interface Qs { mc: string; mcOk: string; mcNo: string; multi: string; multiOk: [string, string]; multiNo: string; tf: string; tfOpts: string[]; tfTruth: boolean[]; short: string; essay: string }
/** Đủ 5 loại câu cho một đề. `key` làm tiền tố id (duy nhất toàn DB). Lời giải / gợi ý mồi theo SEC. */
export async function mkFiveQuestions(examId: string, key: string): Promise<Qs> {
  seq++;
  const id = (s: string) => `${key}-${s}`;
  const mk = (s: string, order: number, type: string, o: { text?: string; explanation?: string | null; hint?: string | null } = {}) =>
    prisma.examQuestion.create({ data: { id: id(s), examId, order, type, text: o.text ?? `Câu ${s} (${key})`, points: 2, explanation: o.explanation ?? SEC.expl(id(s)), hint: o.hint === undefined ? SEC.hint(id(s)) : o.hint } });
  const opt = (q: string, s: string, order: number, text: string, isCorrect: boolean, subLabel?: string) =>
    prisma.examOption.create({ data: { id: id(s), questionId: id(q), order, text, isCorrect, subLabel: subLabel ?? null } });

  await mk("mc", 1, "MC");
  await opt("mc", "mc-ok", 0, "Đáp án đúng MC", true); await opt("mc", "mc-no", 1, "Đáp án sai MC", false);
  await mk("multi", 2, "MC_MULTI");
  await opt("multi", "mu-1", 0, "Đúng 1", true); await opt("multi", "mu-2", 1, "Đúng 2", true); await opt("multi", "mu-3", 2, "Sai 3", false);
  await mk("tf", 3, "TRUE_FALSE_CLUSTER");
  const truth = [true, false, true, false];
  for (let i = 0; i < 4; i++) await opt("tf", `tf-${"abcd"[i]}`, i, `Ý ${"abcd"[i]}`, truth[i], "abcd"[i]);
  await mk("short", 4, "SHORT_ANSWER");
  await opt("short", "sh-ok", 0, SEC.short, true);
  await mk("essay", 5, "ESSAY", { explanation: null, hint: null });
  return {
    mc: id("mc"), mcOk: id("mc-ok"), mcNo: id("mc-no"),
    multi: id("multi"), multiOk: [id("mu-1"), id("mu-2")], multiNo: id("mu-3"),
    tf: id("tf"), tfOpts: ["a", "b", "c", "d"].map(l => id(`tf-${l}`)), tfTruth: truth,
    short: id("short"), essay: id("essay"),
  };
}

/** Một câu MC đơn giản cho đề nhiều mã (mỗi mã con có câu RIÊNG, id riêng). */
export async function mkMcQuestion(examId: string, key: string, order = 1) {
  await prisma.examQuestion.create({ data: { id: `${key}-q`, examId, order, text: `Câu ${key}`, type: "MC", points: 1, explanation: SEC.expl(key) } });
  await prisma.examOption.create({ data: { id: `${key}-ok`, questionId: `${key}-q`, order: 0, text: "Đúng", isCorrect: true } });
  await prisma.examOption.create({ data: { id: `${key}-no`, questionId: `${key}-q`, order: 1, text: "Sai", isCorrect: false } });
  return { q: `${key}-q`, ok: `${key}-ok`, no: `${key}-no` };
}

/** Dấu hiệu rò rỉ trong MỘT phản hồi dành cho người đang làm bài. Trả danh sách lý do (rỗng = sạch). */
export function leaksIn(text: string, o: { allowHint?: boolean } = {}): string[] {
  const out: string[] = [];
  if (/LỜI-GIẢI-/.test(text)) out.push("lời giải mồi");
  if (text.includes(SEC.short)) out.push("đáp án điền ngắn");
  if (!o.allowHint && /GỢI-Ý-/.test(text)) out.push("gợi ý mồi");
  if (/"isCorrect"\s*:/.test(text)) out.push("isCorrect");
  if (/"correctOption/.test(text)) out.push("correctOption*");
  if (/"graderGuide"/.test(text)) out.push("graderGuide");
  if (/"passwordHash"\s*:/.test(text) || /"password"\s*:/.test(text)) out.push("mật khẩu/băm");
  return out;
}
