// BU-04 — NỘP ĐỒNG THỜI (chỉ GHI NHẬN hành vi hiện tại; không sửa src/). 10 lời gọi submit song song cho MỘT lượt kiểm tra + 10 song song cho MỘT lượt luyện tập.
// Mong đợi theo đặc tả mục 8: đúng 1 ExamResult, participants +1, submittedAt không đổi sau lần đầu, mọi phản hồi cùng score, ví Coin ≤ 1 dòng, nộp lần nữa → 200 cùng kết quả, answer sau nộp → 409 finished.
// Ca nào đỏ ở đây là NỢ CHỜ CHỦ do COO bảo lưu (không tính là lỗi BU-04, không làm bài đỏ): in ⚠ NỢ CHỜ CHỦ và tổng kết cuối bài; ca đạt vẫn tính pass.
// Cần máy chủ dev (BASE) + DB RIÊNG; wipe() ở đầu bài. Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-exam-submit-race.ts
import { api, mkTutor, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { minutesFromNow, mkExam, mkFiveQuestions } from "./exam-room-fx";

const debts: string[] = [];
/** Đạt → check xanh; đỏ → ghi nợ, KHÔNG gọi check(false). */
function debt(name: string, cond: unknown, extra?: unknown) {
  if (cond) { check(name, true); return; }
  debts.push(name);
  console.log(`  ⚠ NỢ CHỜ CHỦ: ${name}`, extra !== undefined ? JSON.stringify(extra).slice(0, 400) : "");
}

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");
  const A = await mkUser({ name: "Em An" });
  const C = await mkCourse(T.id, { name: "Toán 9" });
  await prisma.enrollment.create({ data: { userId: A.id, courseId: C.id, status: "active" } });

  for (const mode of ["test", "practice"] as const) {
    section(`10 lời gọi submit đồng thời — ${mode}`);
    const id = `rc-${mode}`;
    const E = await mkExam({ id, ownerId: T.id, courseId: C.id, mode, opensAt: minutesFromNow(-10), durationMin: 60 });
    const q = await mkFiveQuestions(E.id, id);
    await prisma.examQuestion.updateMany({ where: { examId: E.id, id: { not: q.mc } }, data: { points: 0 } }); // chỉ câu MC có điểm → đúng 1 câu là đủ ≥50% để chạm nhánh thưởng Coin
    const s = await api("POST", `/api/exams/${E.id}/start`, { as: A, body: {} });
    check(`${mode}: start 200`, s.status === 200 && !!s.json.attemptId, s.json);
    const att: string = s.json.attemptId;
    await api("PATCH", `/api/exams/attempts/${att}/answer`, { as: A, body: { questionId: q.mc, optionId: q.mcOk } });
    const before = (await prisma.exam.findUnique({ where: { id: E.id }, select: { participants: true } }))!.participants;

    const rs = await Promise.all(Array.from({ length: 10 }, () => api("POST", `/api/exams/attempts/${att}/submit`, { as: A })));
    const statuses = rs.map(r => r.status);
    check(`${mode}: cả 10 phản hồi 200 (không 500)`, statuses.every(x => x === 200), statuses);
    const scores = new Set(rs.map(r => JSON.stringify(r.json?.score)));
    check(`${mode}: mọi phản hồi cùng một score`, scores.size === 1, [...scores]);
    const after = await prisma.examAttempt.findUnique({ where: { id: att } });
    check(`${mode}: lượt đã chốt (submitted)`, after?.status === "submitted", after?.status);

    const results = await prisma.examResult.count({ where: { userId: A.id, examId: E.id } });
    const partsAfter = (await prisma.exam.findUnique({ where: { id: E.id }, select: { participants: true } }))!.participants;
    if (mode === "test") {
      check("test: ExamResult tối đa 1 dòng (khoá unique userId+examId)", results === 1, results);
      debt("test: participants tăng đúng 1 sau 10 lần nộp song song", partsAfter - before === 1, { before, partsAfter });
      const coin = await prisma.coinTransaction.count({ where: { userId: A.id, reason: "quiz_reward", refId: E.id } });
      const w = await prisma.wallet.findUnique({ where: { userId: A.id } });
      check("test: ca thưởng Coin thật sự chạy (có đúng 1 dòng)", coin === 1, { coin });
      debt("test: Coin thưởng ≤ 1 dòng và số dư = tổng dòng", coin <= 1 && (w?.balance ?? 0) === ((await prisma.coinTransaction.aggregate({ where: { userId: A.id }, _sum: { amount: true } }))._sum.amount ?? 0), { coin, bal: w?.balance });
    } else {
      check("luyện tập: KHÔNG tạo ExamResult", results === 0, results);
      check("luyện tập: participants không đổi", partsAfter === before, { before, partsAfter });
    }

    const t0 = after?.submittedAt?.getTime();
    const again = await api("POST", `/api/exams/attempts/${att}/submit`, { as: A });
    const after2 = await prisma.examAttempt.findUnique({ where: { id: att } });
    check(`${mode}: nộp lần nữa → 200 cùng score`, again.status === 200 && JSON.stringify(again.json.score) === [...scores][0], again.json);
    check(`${mode}: submittedAt không đổi sau lần nộp lại`, after2?.submittedAt?.getTime() === t0, { t0, now: after2?.submittedAt });
    const late = await api("PATCH", `/api/exams/attempts/${att}/answer`, { as: A, body: { questionId: q.mc, optionId: q.mcNo } });
    check(`${mode}: answer sau nộp → 409 finished`, late.status === 409 && late.json.code === "finished", late.json);
  }

  console.log(debts.length ? `\n⚠ NỢ CHỜ CHỦ (${debts.length}): ${debts.join(" | ")}` : "\nKhông có nợ.");
  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
