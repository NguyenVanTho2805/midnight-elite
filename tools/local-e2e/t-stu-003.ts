// STU-003 (DB thật) — hạng của em tính ở cơ sở dữ liệu (src/lib/rankServer.ts) phải CHO KẾT QUẢ Y HỆT cách cũ (tải hết bảng điểm rồi gộp trong bộ nhớ),
// kể cả khi có đề đang giữ điểm và lượt đã công bố, và GET /api/users/me/stats trả đúng hạng. Cần Postgres (DATABASE_URL) và máy chủ (BASE) cho phần API.
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-stu-003.ts
//
// CA PHÁ CỐ Ý (mỗi lần một thứ rồi hoàn lại):
//   - Đổi `gt: myBest` thành `gte: myBest` trong countUsersWithBetterBest → ca "đồng điểm cùng hạng" đỏ.
//   - Bỏ nhánh `holding.size === 0` (luôn dùng đường nhanh) → ca "có đề giữ điểm" đỏ (người chưa được công bố bị tính điểm).
//   - Bỏ `dropHeldResults(heldRows)` → ca "lượt chưa công bố không tính" đỏ.
import { prisma } from "@/lib/prisma";
import { api, mkTutor, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { countUsersWithBetterBest, countUsersWithBetterBestLegacy } from "@/lib/rankServer";

const mkExam = (id: string, o: Record<string, unknown> = {}) => prisma.exam.create({ data: { id, code: id, title: id, category: "toan", date: "01/01/2030", time: "08:00", duration: "15 phút", questions: 1, status: "available", totalPoints: 10, ...o } as never });
const res = (userId: string, examId: string, score: number) => prisma.examResult.create({ data: { userId, examId, score, totalPoints: 10 } });

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");
  const C = await mkCourse(T.id, { name: "Toán 9" });
  const U = [] as { id: string }[];
  for (let i = 0; i < 8; i++) { const u = await mkUser({ name: `Em ${i}` }); U.push(u); await prisma.enrollment.create({ data: { userId: u.id, courseId: C.id, status: "active" } }); }

  section("Không có đề giữ điểm: khớp cách cũ ở mọi mốc điểm");
  await mkExam("p1", { createdAt: "2026-10-24", ownerId: T.id, courseId: C.id });
  await mkExam("p2", { createdAt: "2026-10-24", ownerId: T.id, courseId: C.id });
  for (const q of ["p1", "p2"]) await prisma.examQuestion.create({ data: { id: `${q}-q`, examId: q, order: 1, text: "?", type: "MC", points: 1 } });
  // điểm tốt nhất: U0=9, U1=9 (đồng), U2=7 (7 ở p1, 4 ở p2), U3=7, U4=5, U5=5, U6=2, U7 chưa có điểm
  const plain: [number, string, number][] = [[0, "p1", 9], [1, "p2", 9], [2, "p1", 7], [2, "p2", 4], [3, "p2", 7], [4, "p1", 5], [5, "p1", 5], [6, "p2", 2]];
  for (const [i, e, s] of plain) await res(U[i].id, e, s);
  const sweep = async (label: string) => {
    let ok = true; const bad: unknown[] = [];
    for (const b of [0.5, 1, 2, 2.5, 4, 5, 6, 7, 8, 9, 9.5, 10, 100]) {
      const [a, l] = [await countUsersWithBetterBest(b), await countUsersWithBetterBestLegacy(b)];
      if (a !== l) { ok = false; bad.push({ b, a, l }); }
    }
    check(label, ok, bad);
  };
  await sweep("mọi mốc điểm 0,5…100: số người 'hơn' bằng cách cũ");
  check("U0 (9, đồng điểm với U1) có 0 người hơn → hạng 1; U2 (7) có 2 người hơn; U6 (2) có 6 người hơn", (await countUsersWithBetterBest(9)) === 0 && (await countUsersWithBetterBest(7)) === 2 && (await countUsersWithBetterBest(2)) === 6);
  check("đồng điểm cùng hạng: mốc 9 không đếm chính những người điểm 9", (await countUsersWithBetterBest(9)) === 0 && (await countUsersWithBetterBest(8.99)) === 2);
  check("bảng trống điểm cao hơn mọi người → 0", (await countUsersWithBetterBest(10)) === 0);

  section("Có đề đang giữ điểm (tự luận chờ công bố) và lượt đã công bố");
  await mkExam("h1", { createdAt: "2026-10-30", ownerId: T.id, courseId: C.id });
  await prisma.examQuestion.create({ data: { id: "h1-q", examId: "h1", order: 1, text: "Tự luận", type: "ESSAY", points: 5 } });
  // U7 điểm cao ở đề giữ nhưng CHƯA công bố; U6 cũng có điểm ở đề giữ và ĐÃ công bố (một lượt)
  await res(U[7].id, "h1", 10); await res(U[6].id, "h1", 8);
  const att = await prisma.examAttempt.create({ data: { userId: U[6].id, examId: "h1", status: "submitted", startedAt: new Date(), expiresAt: new Date(), submittedAt: new Date() } as never });
  await prisma.examAttemptPublish.create({ data: { attemptId: att.id, examId: "h1", publishedById: T.id } as never });
  await sweep("có đề giữ điểm: mọi mốc điểm vẫn khớp cách cũ");
  check("U7 (10, chưa công bố) KHÔNG làm ai tụt hạng: mốc 9 vẫn 0 người hơn", (await countUsersWithBetterBest(9)) === 0);
  check("U6 (8 đã công bố) được tính: mốc 7 có 3 người hơn (U0, U1, U6)", (await countUsersWithBetterBest(7)) === 3, await countUsersWithBetterBest(7));

  section("Dữ liệu ngẫu nhiên: nhiều người, nhiều đề, điểm trùng");
  await wipe();
  const T2 = await mkTutor("Thầy Hai");
  const users: { id: string }[] = []; for (let i = 0; i < 25; i++) users.push(await mkUser({ name: `Em R${i}` }));
  for (let e = 0; e < 5; e++) {
    await mkExam(`r${e}`, { createdAt: "2026-10-24", ownerId: T2.id });
    await prisma.examQuestion.create({ data: { id: `r${e}-q`, examId: `r${e}`, order: 1, text: "?", type: e === 4 ? "ESSAY" : "MC", points: 1 } });
  }
  let seed = 12345; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (const u of users) for (let e = 0; e < 5; e++) if (rnd() < 0.6) await res(u.id, `r${e}`, Math.round(rnd() * 20) / 2);
  const some = users.slice(0, 6); let pub = 0;
  for (const u of some) {
    const has = await prisma.examResult.findUnique({ where: { userId_examId: { userId: u.id, examId: "r4" } } });
    if (!has) continue;
    const a = await prisma.examAttempt.create({ data: { userId: u.id, examId: "r4", status: "submitted", startedAt: new Date(), expiresAt: new Date(), submittedAt: new Date() } as never });
    await prisma.examAttemptPublish.create({ data: { attemptId: a.id, examId: "r4", publishedById: T2.id } as never }); pub++;
  }
  let same = true; const diffs: unknown[] = [];
  for (let b = 0; b <= 10; b += 0.5) { const [x, y] = [await countUsersWithBetterBest(b), await countUsersWithBetterBestLegacy(b)]; if (x !== y) { same = false; diffs.push({ b, x, y }); } }
  check(`25 người × 5 đề (1 đề tự luận giữ điểm, ${pub} lượt đã công bố): mọi mốc 0–10 khớp cách cũ`, same, diffs);

  section("API: GET /api/users/me/stats");
  const U0 = users[0];
  const best0 = Math.max(0, ...(await prisma.examResult.findMany({ where: { userId: U0.id } })).map(r => r.score));
  const st = await api("GET", "/api/users/me/stats", { as: U0 as never });
  const expectedRank = best0 > 0 ? (await countUsersWithBetterBestLegacy(best0)) + 1 : null;
  check("trả 200, rank bằng cách cũ, có totalStudents", st.status === 200 && st.json?.rank === expectedRank && typeof st.json?.totalStudents === "number", { st: st.json, expectedRank });
  check("không lộ mã/tên người khác trong phản hồi", Object.keys(st.json ?? {}).sort().join() === "exp,gpa,rank,streak,totalStudents", Object.keys(st.json ?? {}));
  const none = await mkUser({ name: "Em Chưa Có Điểm" });
  const st2 = await api("GET", "/api/users/me/stats", { as: none });
  check("em chưa có điểm → rank null", st2.status === 200 && st2.json?.rank === null, st2.json);
  const anon = await api("GET", "/api/users/me/stats");
  check("chưa đăng nhập → 401", anon.status === 401, anon.status);
  done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
