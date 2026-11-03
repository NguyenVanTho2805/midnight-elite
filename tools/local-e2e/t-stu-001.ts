// STU-001 — API + DB. Đề thi thử công khai (không gắn lớp) chưa cài gì: 2 lượt, đáp án chỉ hiện khi hết lượt / hết hạn; gia sư đã cài → tôn trọng; đề lớp → không đổi.
// Cần máy chủ đang chạy (BASE). Bài tự wipe() DB. Không chạy khi đang sửa src/ — giao kin-kiem-thu.
// Mỗi kịch bản dùng học sinh riêng để số lượt không dây sang nhau.
import { api, mkTutor, mkUser, mkCourse, wipe, check, section, done, type TUser } from "./h";
import { prisma } from "@/lib/prisma";

const SECRET = "LỜI-GIẢI-BÍ-MẬT";

/** Đề 2 câu MC: q1 (lời giải bí mật) học sinh làm ĐÚNG; q2 bỏ trống = SAI. createdAt "2020" để không bị examHold. */
async function mkExam(id: string, o: { ownerId: string; courseId?: string | null; date?: string; answerVisibility?: string; hideAnswerForWrong?: boolean; limit?: number }) {
  await prisma.exam.create({ data: {
    id, code: id, title: `Đề ${id}`, category: "Toán", date: o.date ?? "01/01/2030", time: "08:00", duration: "30 phút", questions: 2, status: "available",
    createdAt: "2020", ownerId: o.ownerId, courseId: o.courseId ?? null, totalPoints: 10,
    answerVisibility: o.answerVisibility ?? "after_submit", hideAnswerForWrong: o.hideAnswerForWrong ?? false,
  } });
  const q1 = await prisma.examQuestion.create({ data: { id: `${id}-q1`, examId: id, order: 1, text: "2 + 2 = ?", type: "MC", points: 5, explanation: SECRET } });
  await prisma.examOption.create({ data: { id: `${id}-q1-ok`, questionId: q1.id, order: 0, text: "4", isCorrect: true } });
  await prisma.examOption.create({ data: { id: `${id}-q1-no`, questionId: q1.id, order: 1, text: "5", isCorrect: false } });
  const q2 = await prisma.examQuestion.create({ data: { id: `${id}-q2`, examId: id, order: 2, text: "3 + 3 = ?", type: "MC", points: 5, explanation: "LỜI-GIẢI-CÂU-HAI" } });
  await prisma.examOption.create({ data: { id: `${id}-q2-ok`, questionId: q2.id, order: 0, text: "6", isCorrect: true } });
  await prisma.examOption.create({ data: { id: `${id}-q2-no`, questionId: q2.id, order: 1, text: "7", isCorrect: false } });
  if (o.limit !== undefined) await prisma.quizAttemptLimit.create({ data: { examId: id, maxAttempts: o.limit } });
  return { id, q1: q1.id, q1Ok: `${id}-q1-ok`, q2: q2.id };
}
type Ex = Awaited<ReturnType<typeof mkExam>>;

/** Bắt đầu một lượt, trả lời q1 ĐÚNG (q2 bỏ trống), nộp. Trả attemptId hoặc kết quả start nếu bị chặn. */
async function takeAttempt(ex: Ex, u: TUser) {
  const st = await api("POST", `/api/exams/${ex.id}/start`, { as: u, body: {} });
  if (st.status !== 200) return { st, attemptId: null as string | null };
  const aid: string = st.json.attemptId;
  await api("PATCH", `/api/exams/attempts/${aid}/answer`, { as: u, body: { questionId: ex.q1, optionId: ex.q1Ok } });
  const sub = await api("POST", `/api/exams/attempts/${aid}/submit`, { as: u });
  return { st, attemptId: sub.status === 200 ? aid : null, sub };
}

/** Duyệt JSON đệ quy: mọi khoá isCorrect / explanation / correctAnswer phải là null. Trả đường dẫn các chỗ vi phạm. */
function leaks(node: unknown, path = "$"): string[] {
  if (Array.isArray(node)) return node.flatMap((v, i) => leaks(v, `${path}[${i}]`));
  if (node && typeof node === "object") {
    return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
      (["isCorrect", "explanation", "correctAnswer"].includes(k) && v !== null) ? [`${path}.${k}=${JSON.stringify(v)}`] : leaks(v, `${path}.${k}`));
  }
  return [];
}
const findQ = (rv: any, id: string) => (rv.json.questions as any[]).find(q => q.id === id);

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");

  // ── Kịch bản 1: đề công khai chưa cài gì ────────────────────────────────────
  const pub = await mkExam("pub-default", { ownerId: T.id });
  const A = await mkUser({ name: "Em An" });
  const B = await mkUser({ name: "Em Bình" });

  section("Cổng: đề công khai chưa cài → 2 lượt");
  check("chưa đăng nhập → gate/start/review đều 401",
    (await api("GET", `/api/exams/${pub.id}/gate`)).status === 401
    && (await api("POST", `/api/exams/${pub.id}/start`, { body: {} })).status === 401
    && (await api("GET", `/api/exams/attempts/khong-co/review`)).status === 401);
  const g = await api("GET", `/api/exams/${pub.id}/gate`, { as: A });
  check("gate: attempts.max === 2, nhãn 'Lượt 1/2', canStart", g.status === 200 && g.json.attempts.max === 2 && g.json.attempts.label === "Lượt 1/2" && g.json.canStart === true, g.json);
  check("gate báo policy.guarded = true, answersLockedReason until_exam_ends", g.json.policy?.guarded === true && g.json.policy?.answersLockedReason === "until_exam_ends", g.json.policy);
  check("gate KHÔNG chứa password/passwordHash/lời giải/isCorrect", !/"password"|passwordHash|LỜI-GIẢI|isCorrect/.test(g.text), g.text.slice(0, 300));

  section("Lượt 1: nộp xong vẫn bị khoá đáp án");
  const a1 = await takeAttempt(pub, A);
  check("start lượt 1 → 200, không chứa password/passwordHash", a1.st.status === 200 && !/"password"|passwordHash/.test(a1.st.text));
  check("câu hỏi gửi lúc làm bài không có isCorrect / lời giải", !/isCorrect|LỜI-GIẢI|explanation/.test(a1.st.text));
  const rv1 = await api("GET", `/api/exams/attempts/${a1.attemptId}/review`, { as: A });
  check("review lượt 1: 200, canSeeAnswers=false, answersLockedReason until_exam_ends, publicGuarded, attemptsMax 2",
    rv1.status === 200 && rv1.json.canSeeAnswers === false && rv1.json.answersLockedReason === "until_exam_ends" && rv1.json.publicGuarded === true && rv1.json.attemptsMax === 2, { c: rv1.json.canSeeAnswers, r: rv1.json.answersLockedReason });
  check("review lượt 1 vẫn có điểm của em (điểm không bị khoá)", typeof rv1.json.score === "number", rv1.json.score);
  check("PHÁ: duyệt đệ quy — không có isCorrect/explanation/correctAnswer khác null, không chữ 'LỜI-GIẢI'", leaks(rv1.json).length === 0 && !rv1.text.includes("LỜI-GIẢI"), leaks(rv1.json));
  check("review không chứa password/passwordHash", !/"password"|passwordHash/.test(rv1.text));
  const cor1 = await api("GET", `/api/exams/attempts/${a1.attemptId}/correction`, { as: A });
  check("chữa bài lượt 1: available=false, không câu nào; correctableCount ở review = 0", cor1.status === 200 && cor1.json.available === false && cor1.json.items.length === 0 && rv1.json.correctableCount === 0, cor1.json);
  const corQ = await api("POST", `/api/exams/attempts/${a1.attemptId}/correction/${pub.q2}`, { as: A, body: { action: "reveal" } });
  check("PHÁ: gọi thẳng 'reveal' chữa bài khi bị khoá → 403, không lộ đáp án", corQ.status === 403 && !corQ.text.includes("LỜI-GIẢI"), corQ.json);

  section("Lượt 2 rồi lượt 3");
  const gMid = await api("GET", `/api/exams/${pub.id}/gate`, { as: A });
  check("gate sau lượt 1: nhãn 'Lượt 2/2', còn vào được", gMid.json.attempts.label === "Lượt 2/2" && gMid.json.canStart === true, gMid.json.attempts);
  const a2 = await takeAttempt(pub, A);
  check("lượt 2 start 200 và nộp được", a2.st.status === 200 && !!a2.attemptId);
  const a3 = await api("POST", `/api/exams/${pub.id}/start`, { as: A, body: {} });
  check("lượt 3 → 409 code attempts_exhausted, thông điệp tiếng Việt có '2 lượt'", a3.status === 409 && a3.json.code === "attempts_exhausted" && /2 lượt/.test(a3.json.error), a3.json);
  check("không có lượt thứ 3 trong DB", (await prisma.examAttempt.count({ where: { userId: A.id, examId: pub.id } })) === 2);
  const gEnd = await api("GET", `/api/exams/${pub.id}/gate`, { as: A });
  check("gate hết lượt: canStart=false, blockReason attempts_exhausted", gEnd.json.canStart === false && gEnd.json.blockReason === "attempts_exhausted", gEnd.json);

  section("Hết lượt → xem được đáp án");
  for (const [name, aid] of [["lượt 2", a2.attemptId], ["lượt 1", a1.attemptId]] as const) {
    const rv = await api("GET", `/api/exams/attempts/${aid}/review`, { as: A });
    const q1 = findQ(rv, pub.q1);
    check(`review ${name}: canSeeAnswers=true, answersLockedReason null, câu làm đúng có isCorrect:true và lời giải`,
      rv.status === 200 && rv.json.canSeeAnswers === true && rv.json.answersLockedReason === null && q1.options.some((o: any) => o.isCorrect === true) && q1.explanation === SECRET, { c: rv.json.canSeeAnswers, r: rv.json.answersLockedReason });
  }
  const cor2 = await api("GET", `/api/exams/attempts/${a2.attemptId}/correction`, { as: A });
  check("hết lượt: chữa bài mở (available=true, có câu sai cần chữa)", cor2.json.available === true && cor2.json.items.length === 1, cor2.json);

  section("Cô lập: B không xem được lượt của A");
  check("PHÁ: B GET review lượt của A → 404", (await api("GET", `/api/exams/attempts/${a1.attemptId}/review`, { as: B })).status === 404);
  check("PHÁ: B GET correction lượt của A → 404", (await api("GET", `/api/exams/attempts/${a1.attemptId}/correction`, { as: B })).status === 404);
  const bAttempt = await takeAttempt(pub, B);
  check("B vẫn có đủ 2 lượt riêng (số lượt tính theo từng học sinh)", bAttempt.st.status === 200 && (await api("GET", `/api/exams/${pub.id}/gate`, { as: B })).json.attempts.used === 1);

  // ── Kịch bản 2: đề công khai, hạn đề không hợp lệ ───────────────────────────
  section("Đề công khai, ngày rỗng: hiện ngay nhưng ẩn đáp án câu sai tới khi hết lượt");
  const bad = await mkExam("pub-nodate", { ownerId: T.id, date: "" });
  const C = await mkUser({ name: "Em Cúc" });
  const c1 = await takeAttempt(bad, C);
  const rvBad = await api("GET", `/api/exams/attempts/${c1.attemptId}/review`, { as: C });
  const bq1 = findQ(rvBad, bad.q1), bq2 = findQ(rvBad, bad.q2);
  check("canSeeAnswers=true nhưng answersLockedReason until_attempts_exhausted", rvBad.json.canSeeAnswers === true && rvBad.json.answersLockedReason === "until_attempts_exhausted" && rvBad.json.attemptsMax === 2, { c: rvBad.json.canSeeAnswers, r: rvBad.json.answersLockedReason });
  check("PHÁ: câu SAI (bỏ trống) isCorrect null và explanation null; không lộ chữ lời giải câu hai",
    bq2.options.every((o: any) => o.isCorrect === null) && bq2.explanation === null && !rvBad.text.includes("LỜI-GIẢI-CÂU-HAI"), bq2);
  check("câu làm đúng thì có ✓ (isCorrect:true)", bq1.options.some((o: any) => o.isCorrect === true));
  const c2 = await takeAttempt(bad, C);
  check("lượt 2 vẫn được; lượt 3 bị 409", c2.st.status === 200 && (await api("POST", `/api/exams/${bad.id}/start`, { as: C, body: {} })).status === 409);
  const rvBad2 = await api("GET", `/api/exams/attempts/${c1.attemptId}/review`, { as: C });
  check("hết lượt: hiện hết (answersLockedReason null)", rvBad2.json.answersLockedReason === null && rvBad2.json.canSeeAnswers === true);

  // ── Kịch bản 3: gia sư đã cài limit 5 → tôn trọng ───────────────────────────
  section("Gia sư đặt limit 5 trên đề công khai → tôn trọng, không ép 2 lượt");
  const lim = await mkExam("pub-limit5", { ownerId: T.id, limit: 5 });
  const D = await mkUser({ name: "Em Dũng" });
  const gl = await api("GET", `/api/exams/${lim.id}/gate`, { as: D });
  check("gate max = 5, policy.guarded=false", gl.json.attempts.max === 5 && gl.json.attempts.label === "Lượt 1/5" && gl.json.policy?.guarded === false, gl.json.attempts);
  const d1 = await takeAttempt(lim, D);
  const rvl = await api("GET", `/api/exams/attempts/${d1.attemptId}/review`, { as: D });
  check("review sau nộp có đáp án ngay (after_submit của gia sư được giữ), publicGuarded=false, attemptsMax 5",
    rvl.json.canSeeAnswers === true && rvl.json.answersLockedReason === null && rvl.json.publicGuarded === false && rvl.json.attemptsMax === 5 && findQ(rvl, lim.q1).explanation === SECRET);

  // ── Kịch bản 4: gia sư đặt never → attemptsExhausted không mở khoá ──────────
  section("Gia sư đặt 'không hiện đáp án' + limit 1 → hết lượt vẫn không hiện");
  const nev = await mkExam("pub-never", { ownerId: T.id, answerVisibility: "never", limit: 1 });
  const E = await mkUser({ name: "Em Em" });
  const e1 = await takeAttempt(nev, E);
  const rvn = await api("GET", `/api/exams/attempts/${e1.attemptId}/review`, { as: E });
  check("PHÁ: hết lượt nhưng never → canSeeAnswers=false, reason never, không rò đệ quy", rvn.json.canSeeAnswers === false && rvn.json.answersLockedReason === "never" && leaks(rvn.json).length === 0 && !rvn.text.includes("LỜI-GIẢI"), leaks(rvn.json));

  // ── Kịch bản 5: đề gắn lớp, không giới hạn ──────────────────────────────────
  section("Đề gắn lớp: giữ nguyên hành vi cũ (3 lượt vẫn vào, có đáp án, không giới hạn)");
  const C1 = await mkCourse(T.id, { name: "Toán 9" });
  const cls = await mkExam("class-default", { ownerId: T.id, courseId: C1.id });
  const F = await mkUser({ name: "Em Phương" });
  await prisma.enrollment.create({ data: { userId: F.id, courseId: C1.id, status: "active" } });
  const gc = await api("GET", `/api/exams/${cls.id}/gate`, { as: F });
  check("gate đề lớp: max null, policy.guarded=false", gc.json.attempts.max === null && gc.json.policy?.guarded === false && gc.json.canStart === true, gc.json);
  const f = [await takeAttempt(cls, F), await takeAttempt(cls, F), await takeAttempt(cls, F)];
  check("lượt 1, 2, 3 đều start 200", f.every(x => x.st.status === 200 && !!x.attemptId), f.map(x => x.st.status));
  const rvc = await api("GET", `/api/exams/attempts/${f[0].attemptId}/review`, { as: F });
  check("review đề lớp có đáp án ngay, publicGuarded=false, attemptsMax null", rvc.json.canSeeAnswers === true && rvc.json.publicGuarded === false && rvc.json.attemptsMax === null && findQ(rvc, cls.q1).explanation === SECRET);
  const nonMember = await mkUser({ name: "Em Xa" });
  check("PHÁ: không thuộc lớp → start đề lớp vẫn 403 (không vì policy mới mà mở cửa)", (await api("POST", `/api/exams/${cls.id}/start`, { as: nonMember, body: {} })).status === 403);

  // ── Kịch bản 6: tương tranh — 3 start song song ────────────────────────────
  section("Tương tranh: 3 start song song → chỉ 1 lượt đang làm; sau khi nộp, bắn lại vẫn tối đa 2 lượt");
  const conc = await mkExam("pub-concurrent", { ownerId: T.id });
  const G = await mkUser({ name: "Em Giang" });
  const burst1 = await Promise.all([1, 2, 3].map(() => api("POST", `/api/exams/${conc.id}/start`, { as: G, body: {} })));
  check("3 start song song đều 200", burst1.every(r => r.status === 200), burst1.map(r => r.status));
  const ids1 = [...new Set(burst1.map(r => r.json?.attemptId))];
  check("cả 3 trả về CÙNG một attemptId (dùng lại lượt đang làm)", ids1.length === 1 && !!ids1[0], ids1);
  check("DB: đúng 1 examAttempt của học sinh/đề này", (await prisma.examAttempt.count({ where: { userId: G.id, examId: conc.id } })) === 1);
  const subG1 = await api("POST", `/api/exams/attempts/${ids1[0]}/submit`, { as: G });
  check("nộp lượt đang làm → 200", subG1.status === 200, subG1.json);
  const burst2 = await Promise.all([1, 2, 3].map(() => api("POST", `/api/exams/${conc.id}/start`, { as: G, body: {} })));
  const ok2 = burst2.filter(r => r.status === 200);
  check("bắn lại 3 start sau khi nộp: không 5xx; các lệnh 200 cùng một lượt mới, còn lại 409 attempts_exhausted",
    ok2.length >= 1 && new Set(ok2.map(r => r.json.attemptId)).size === 1 && burst2.every(r => r.status === 200 || (r.status === 409 && r.json.code === "attempts_exhausted")), burst2.map(r => r.status));
  const totalG = await prisma.examAttempt.count({ where: { userId: G.id, examId: conc.id } });
  check("DB: tổng đúng 2 lượt (không ra lượt thứ 3)", totalG === 2, totalG);
  const inProgG = await prisma.examAttempt.count({ where: { userId: G.id, examId: conc.id, status: "in_progress" } });
  check("DB: chỉ 1 lượt đang làm", inProgG === 1, inProgG);
  await api("POST", `/api/exams/attempts/${ok2[0]?.json.attemptId}/submit`, { as: G });
  const burst3 = await Promise.all([1, 2, 3].map(() => api("POST", `/api/exams/${conc.id}/start`, { as: G, body: {} })));
  check("hết 2 lượt: 3 start song song đều 409 attempts_exhausted", burst3.every(r => r.status === 409 && r.json.code === "attempts_exhausted"), burst3.map(r => r.status));
  check("DB: vẫn đúng 2 lượt", (await prisma.examAttempt.count({ where: { userId: G.id, examId: conc.id } })) === 2);

  // ── Kịch bản 7: lượt cuối đang làm dở ───────────────────────────────────────
  section("Lượt cuối làm dở: chưa quá hạn thì vẫn khoá đáp án; quá expiresAt thì tính là đã dùng → mở khoá");
  const mid = await mkExam("pub-midattempt", { ownerId: T.id });
  const H = await mkUser({ name: "Em Hà" });
  const h1 = await takeAttempt(mid, H);
  check("lượt 1 nộp được", h1.st.status === 200 && !!h1.attemptId);
  const h2 = await api("POST", `/api/exams/${mid.id}/start`, { as: H, body: {} });
  check("start lượt 2 → 200 và KHÔNG nộp", h2.status === 200 && !!h2.json.attemptId, h2.status);
  const rvH = await api("GET", `/api/exams/attempts/${h1.attemptId}/review`, { as: H });
  check("PHÁ: lượt 2 còn hạn đang làm → review lượt 1 canSeeAnswers=false, until_exam_ends, không rò đệ quy",
    rvH.status === 200 && rvH.json.canSeeAnswers === false && rvH.json.answersLockedReason === "until_exam_ends" && leaks(rvH.json).length === 0 && !rvH.text.includes("LỜI-GIẢI"), { c: rvH.json.canSeeAnswers, r: rvH.json.answersLockedReason, l: leaks(rvH.json) });
  await prisma.examAttempt.update({ where: { id: h2.json.attemptId }, data: { expiresAt: new Date(Date.now() - 60_000) } });
  const rvH2 = await api("GET", `/api/exams/attempts/${h1.attemptId}/review`, { as: H });
  check("lượt 2 đã quá expiresAt (chưa nộp) → tính đã dùng: review lượt 1 canSeeAnswers=true, answersLockedReason null, có lời giải",
    rvH2.status === 200 && rvH2.json.canSeeAnswers === true && rvH2.json.answersLockedReason === null && findQ(rvH2, mid.q1)?.explanation === SECRET, { c: rvH2.json.canSeeAnswers, r: rvH2.json.answersLockedReason });

  await done();
})().catch(e => { console.error(e); process.exit(1); });
