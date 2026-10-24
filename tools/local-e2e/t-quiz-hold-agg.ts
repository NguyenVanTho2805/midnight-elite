// Hợp nhất công bố (QZ-08 + QZ-11): các phép TỔNG HỢP điểm (bảng xếp hạng, hạng + GPA của em, bảng vinh danh, báo cáo tháng, bảng điểm đề)
// chỉ tính điểm của đề không giữ hoặc lượt đã công bố. Số của đề KHÔNG giữ phải y nguyên khi có thêm điểm đang giữ.
// Dữ liệu dựng trực tiếp trong DB (kể cả dòng ExamResult "cũ" của đề đang giữ — trường hợp gia sư bật giữ điểm sau khi đã có điểm).
// Cần máy chủ đang chạy (BASE). Mỗi bài wipe() DB riêng.
import { api, mkTutor, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { loadStudentMonth } from "@/lib/monthlyReportServer";
import { holdingExamIds, dropHeldResults, heldAttemptIdsAmong } from "@/lib/examHold";
import { vnMonthKey } from "@/lib/revenue";

const mkExam = (id: string, o: Record<string, unknown>) => prisma.exam.create({ data: { id, code: id, title: id, category: "toan", date: "01/01/2030", time: "08:00", duration: "15 phút", questions: 1, status: "available", totalPoints: 10, ...o } as never });
const mkResult = (userId: string, examId: string, score: number) => prisma.examResult.create({ data: { userId, examId, score, totalPoints: 10 } });

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");
  const A = await mkUser({ name: "Em An" });
  const B = await mkUser({ name: "Em Bình" });
  const C = await mkCourse(T.id, { name: "Toán 9" });
  for (const u of [A, B]) await prisma.enrollment.create({ data: { userId: u.id, courseId: C.id, status: "active" } });
  const YM = vnMonthKey(new Date());

  // Đề KHÔNG giữ: trắc nghiệm, tạo mới. A 6/10, B 4/10.
  await mkExam("agg-plain", { createdAt: "2026-10-24", ownerId: T.id, courseId: C.id });
  await prisma.examQuestion.create({ data: { id: "agg-plain-q", examId: "agg-plain", order: 1, text: "?", type: "MC", points: 1 } });
  await mkResult(A.id, "agg-plain", 6); await mkResult(B.id, "agg-plain", 4);

  const snapshot = async () => {
    const lb = await api("GET", "/api/leaderboard");
    const stA = await api("GET", "/api/users/me/stats", { as: A });
    const stB = await api("GET", "/api/users/me/stats", { as: B });
    const honor = await api("GET", "/api/honor-leaderboard");
    const board = await api("GET", "/api/exam-results?examId=agg-plain", { as: A });
    const month = await loadStudentMonth(T.id, A.id, YM);
    const rank = await api("GET", "/api/exam-results?mine=true", { as: A });
    const norm = (v: unknown) => JSON.stringify(v, (_k, x) => (x && typeof x === "object" && "completedAt" in (x as object)) ? { ...(x as object), completedAt: 0, id: 0 } : x);
    return JSON.stringify({
      lb: lb.json.map((r: { userId: string; best: number; avg: number; count: number }) => [r.userId, r.best, r.avg, r.count]),
      stA: [stA.json.gpa, stA.json.rank], stB: [stB.json.gpa, stB.json.rank],
      honor: honor.json.map((r: { id: string; gpa: number; lastExamScore: number }) => [r.id, r.gpa, r.lastExamScore]),
      board: board.json.map((r: { userId: string; score: number }) => [r.userId, r.score]),
      month: month?.subjects.map(s => s.mastery),
      rank: norm(rank.json.filter((r: { examId: string }) => r.examId === "agg-plain")),
    });
  };

  section("Đường cơ sở: chỉ có đề không giữ");
  const base = await snapshot();
  const stA0 = await api("GET", "/api/users/me/stats", { as: A });
  check("cơ sở: A đang hạng 1 (6 > 4), GPA 6", stA0.json.rank === 1 && stA0.json.gpa === 6, stA0.json);

  section("Thêm đề có tự luận ĐANG GIỮ với điểm dở dang rất cao của B");
  await mkExam("agg-held", { createdAt: "2026-10-24", ownerId: T.id, courseId: C.id, questions: 2 });
  await prisma.examQuestion.create({ data: { id: "agg-held-q1", examId: "agg-held", order: 1, text: "?", type: "MC", points: 1 } });
  await prisma.examQuestion.create({ data: { id: "agg-held-q2", examId: "agg-held", order: 2, text: "Tự luận", type: "ESSAY", points: 9 } });
  const attB = await prisma.examAttempt.create({ data: { examId: "agg-held", userId: B.id, status: "submitted", submittedAt: new Date(), score: 10, totalPoints: 10, expiresAt: new Date(Date.now() + 1000) } as never });
  await mkResult(B.id, "agg-held", 10); // dòng cũ còn sót
  check("hàm dùng chung: đề tự luận mới đang giữ, đề trắc nghiệm không giữ", (await holdingExamIds(["agg-held", "agg-plain"])).has("agg-held") && !(await holdingExamIds(["agg-held", "agg-plain"])).has("agg-plain"));
  check("dropHeldResults bỏ dòng của B ở đề giữ, giữ dòng ở đề không giữ", (await dropHeldResults(await prisma.examResult.findMany({ select: { userId: true, examId: true } }))).length === 2);
  check("heldAttemptIdsAmong: lượt của B đang giữ", (await heldAttemptIdsAmong([{ id: attB.id, examId: "agg-held" }])).has(attB.id));
  const held = await snapshot();
  check("CHỨNG MINH: bảng xếp hạng, hạng/GPA, vinh danh, báo cáo tháng, bảng điểm đề KHÔNG ĐỔI khi có điểm đang giữ", held === base, { base, held });

  section("Công bố lượt của B → điểm đó mới được tính");
  await prisma.examAttemptPublish.create({ data: { attemptId: attB.id, examId: "agg-held", publishedById: T.id } });
  const pub = await snapshot();
  check("sau công bố: số liệu đổi (điểm 10 của B vào) — PHÁ: không phải bộ lọc bỏ hết mọi thứ", pub !== base);
  const stA1 = await api("GET", "/api/users/me/stats", { as: A });
  check("A giờ hạng 2 (B có 10 đã công bố)", stA1.json.rank === 2, stA1.json);

  section("Đề cũ có tự luận (trước mốc) không bị giữ: điểm tính như trước");
  await mkExam("agg-old", { createdAt: "2020", ownerId: T.id, courseId: C.id, questions: 2 });
  await prisma.examQuestion.create({ data: { id: "agg-old-q", examId: "agg-old", order: 1, text: "Tự luận", type: "ESSAY", points: 10 } });
  await mkResult(A.id, "agg-old", 9);
  check("đề cũ không nằm trong tập đang giữ", !(await holdingExamIds(["agg-old"])).has("agg-old"));
  const stA2 = await api("GET", "/api/users/me/stats", { as: A });
  check("điểm 9 của A ở đề cũ được tính (hạng vẫn 2 vì B có 10; GPA của A đổi)", stA2.json.rank === 2 && stA2.json.gpa !== stA1.json.gpa, stA2.json);

  await done();
})();
