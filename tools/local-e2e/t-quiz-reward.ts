// Thưởng Coin làm bài — API + DB: /api/exams/[id]/start → /submit, và việc chặn học sinh nạp Coin.
import { api, mkTutor, mkUser, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { MAX_QUIZ_REWARDS_PER_DAY, QUIZ_REWARD_BASE, QUIZ_REWARD_FAST_BONUS } from "@/lib/wallet-constants";

let seq = 0;
const nid = (p: string) => `${p}-${Date.now().toString(36)}-${++seq}`;
const bal = async (id: string) => (await prisma.wallet.findUnique({ where: { userId: id } }))?.balance ?? 0;
const rewards = (id: string) => prisma.coinTransaction.findMany({ where: { userId: id, reason: "quiz_reward" } });

// Đề 2 câu MC, 10 phút; trả về id câu + đáp án đúng/sai.
async function mkExam(ownerId: string) {
  const eid = nid("ex");
  await prisma.exam.create({ data: { id: eid, code: eid, title: "Quiz thử", category: "Toán", date: "01/01/2020", time: "08:00", duration: "10 phút", questions: 2, status: "available", createdAt: "2020-01-01", ownerId, totalPoints: 10 } });
  const qs: { id: string; right: string; wrong: string }[] = [];
  for (let i = 0; i < 2; i++) {
    const qid = nid("q"), right = nid("o"), wrong = nid("o");
    await prisma.examQuestion.create({ data: { id: qid, examId: eid, order: i + 1, text: `Câu ${i + 1}`, type: "MC" } });
    await prisma.examOption.create({ data: { id: right, questionId: qid, order: 0, text: "đúng", isCorrect: true } });
    await prisma.examOption.create({ data: { id: wrong, questionId: qid, order: 1, text: "sai", isCorrect: false } });
    qs.push({ id: qid, right, wrong });
  }
  return { id: eid, qs };
}
async function take(as: any, exam: { id: string; qs: { id: string; right: string; wrong: string }[] }, pick: "right" | "wrong" | "half", opts: { tabSwitches?: number } = {}) {
  const st = await api("POST", `/api/exams/${exam.id}/start`, { as, body: {} });
  if (st.status !== 200 && st.status !== 201) throw new Error(`start ${st.status} ${JSON.stringify(st.json)}`);
  const aid = st.json.attemptId ?? st.json.attempt?.id ?? st.json.id;
  if (opts.tabSwitches) await prisma.examAttempt.update({ where: { id: aid }, data: { tabSwitchCount: opts.tabSwitches } });
  for (let i = 0; i < exam.qs.length; i++) {
    const q = exam.qs[i];
    const optionId = pick === "right" ? q.right : pick === "wrong" ? q.wrong : (i === 0 ? q.right : q.wrong);
    await prisma.examAnswer.upsert({ where: { attemptId_questionId: { attemptId: aid, questionId: q.id } }, update: { optionId }, create: { attemptId: aid, questionId: q.id, optionId } });
  }
  return { aid, submit: () => api("POST", `/api/exams/attempts/${aid}/submit`, { as }) };
}

(async () => {
  await wipe();
  const tutor = await mkTutor("Cô Lan");
  const S = await mkUser({ name: "Em An" });
  const exam = await mkExam(tutor.id);

  section("Nộp đúng hết, nhanh → cơ bản + nhanh");
  let t = await take(S, exam, "right");
  // Lùi giờ bắt đầu 60 giây về trước để vượt mức tối thiểu 30 giây mà vẫn còn trong 50% thời gian.
  await prisma.examAttempt.update({ where: { id: t.aid }, data: { startedAt: new Date(Date.now() - 60_000) } });
  let r = await t.submit();
  check("nộp → 200, có điểm", r.status === 200 && typeof r.json.score === "number", r.json);
  check(`coinsEarned = ${QUIZ_REWARD_BASE + QUIZ_REWARD_FAST_BONUS}`, r.json.coinsEarned === QUIZ_REWARD_BASE + QUIZ_REWARD_FAST_BONUS, r.json);
  check("ví cộng đúng, có 1 giao dịch quiz_reward gắn mã đề, loại reward", (await bal(S.id)) === QUIZ_REWARD_BASE + QUIZ_REWARD_FAST_BONUS && (await rewards(S.id)).length === 1 && (await rewards(S.id))[0].refId === exam.id && (await rewards(S.id))[0].sourceType === "reward");

  section("Nộp lại cùng lượt và làm lại đề: không thưởng thêm");
  const again = await t.submit();
  check("nộp lại cùng lượt → 200, coinsEarned = 0, ví không đổi", again.status === 200 && again.json.coinsEarned === 0 && (await bal(S.id)) === QUIZ_REWARD_BASE + QUIZ_REWARD_FAST_BONUS);
  t = await take(S, exam, "right");
  r = await t.submit();
  check("làm lại cùng đề → coinsEarned = 0, vẫn chỉ 1 giao dịch", r.json.coinsEarned === 0 && (await rewards(S.id)).length === 1, r.json);

  section("Đúng dưới 50%, hết giờ, rời tab nhiều: không thưởng");
  const S2 = await mkUser({ name: "Em Bình" });
  const ex2 = await mkExam(tutor.id);
  r = await (await take(S2, ex2, "wrong")).submit();
  check("sai hết → 0 Coin", r.status === 200 && r.json.coinsEarned === 0 && (await bal(S2.id)) === 0, r.json);
  const ex3 = await mkExam(tutor.id);
  r = await (await take(S2, ex3, "right", { tabSwitches: 4 })).submit();
  check("rời tab 4 lần → 0 Coin dù đúng hết", r.json.coinsEarned === 0 && (await bal(S2.id)) === 0, r.json);
  const ex4 = await mkExam(tutor.id);
  const exp = await take(S2, ex4, "right");
  await prisma.examAttempt.update({ where: { id: exp.aid }, data: { expiresAt: new Date(Date.now() - 1000), startedAt: new Date(Date.now() - 700_000) } });
  r = await exp.submit();
  check("nộp sau hạn → 0 Coin", r.json.coinsEarned === 0 && (await bal(S2.id)) === 0, r.json);

  section("Điểm vừa đủ → chỉ cơ bản; trần mỗi ngày");
  const S3 = await mkUser({ name: "Em Chi" });
  const half = await mkExam(tutor.id);
  r = await (await take(S3, half, "half")).submit();
  check("đúng 50%, nộp vội → chỉ cơ bản", r.json.coinsEarned === QUIZ_REWARD_BASE, r.json);
  for (let i = 1; i < MAX_QUIZ_REWARDS_PER_DAY; i++) await (await take(S3, await mkExam(tutor.id), "half")).submit();
  check(`đủ ${MAX_QUIZ_REWARDS_PER_DAY} lượt thưởng trong ngày`, (await rewards(S3.id)).length === MAX_QUIZ_REWARDS_PER_DAY);
  const over = await (await take(S3, await mkExam(tutor.id), "half")).submit();
  check("lượt thứ vượt trần → nộp vẫn thành công, coinsEarned = 0, không thêm giao dịch", over.status === 200 && over.json.coinsEarned === 0 && (await rewards(S3.id)).length === MAX_QUIZ_REWARDS_PER_DAY, over.json);

  section("Gia sư làm đề của mình hoặc đề khác: không thưởng");
  const own = await mkExam(tutor.id);
  r = await (await take(tutor, own, "right")).submit();
  check("gia sư (không phải học sinh) → 0 Coin, ví gia sư không đổi", r.json.coinsEarned === 0 && (await rewards(tutor.id)).length === 0);

  section("Học sinh không nạp Coin bằng tiền");
  const tp = await api("POST", "/api/wallet/topups", { as: S, body: { amountVnd: 100000, bankRef: "FTQ" } });
  check("học sinh gửi yêu cầu nạp → 403 kèm lời giải thích", tp.status === 403 && /không nạp bằng tiền/.test(tp.json.error), tp.json);
  check("không tạo yêu cầu nạp nào", (await prisma.coinTopupRequest.count({ where: { userId: S.id } })) === 0);
  check("học sinh vẫn xem được ví và danh sách yêu cầu nạp", (await api("GET", "/api/wallet", { as: S })).status === 200 && (await api("GET", "/api/wallet/topups", { as: S })).status === 200);
  const tt = await api("POST", "/api/wallet/topups", { as: tutor, body: { amountVnd: 100000, bankRef: "FTQ2" } });
  check("gia sư vẫn gửi được yêu cầu nạp (để mua VIP) → 201", tt.status === 201, tt.json);
  await done();
})();
