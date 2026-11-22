// SCL đợt 5 — API mới của màn học sinh, CÔ LẬP giữa hai học sinh: /api/student/nhat-ky (điểm danh của chính em) và /api/student/ket-qua?courseId=
// (nay gồm cả lớp học thử hết hạn). Hai em cùng lớp, mỗi em một bộ điểm danh / điểm riêng: không lẫn; courseId của lớp em không ghi danh / đã nghỉ (suspended)
// ⇒ classes rỗng; khách ⇒ 401; gia sư ⇒ 403.
// Ca phá cố ý (đã chạy 23/11/2026): bỏ `userId: s.userId` khỏi where của nhat-ky ⇒ ca "A chỉ thấy 3 buổi của A" và "B không thấy buổi vắng của A" đỏ; trả lại ⇒ xanh.
// Chạy: source tools/local-e2e/env.sh && TZ=Asia/Ho_Chi_Minh npx tsx tools/local-e2e/t-scl5-api.ts
import { prisma } from "@/lib/prisma";
import { api, mkCourse, mkTutor, mkUser, wipe, check, section, done } from "./h";

const D = 86_400_000;

(async () => {
  await wipe();
  const T = await mkTutor("Anh Thanh");
  const A = await mkUser({ name: "Em A" }), B = await mkUser({ name: "Em B" });
  const C = await mkCourse(T.id, { name: "Toán 12" }), OTHER = await mkCourse(T.id, { name: "Lớp không vào" }), SUS = await mkCourse(T.id, { name: "Lớp đã nghỉ" });
  const EXP = await mkCourse(T.id, { name: "Lớp hết thử" });
  await prisma.enrollment.createMany({ data: [
    { userId: A.id, courseId: C.id, status: "active" }, { userId: B.id, courseId: C.id, status: "active" },
    { userId: A.id, courseId: SUS.id, status: "suspended" },
    { userId: A.id, courseId: EXP.id, status: "trial_expired", trialDays: 14, trialStartedAt: new Date(Date.now() - 20 * D) },
  ] });
  // Điểm danh: A có 3 buổi ở lớp C (có mặt, vắng, nghỉ có báo), B có 1 buổi (có mặt). A còn 1 bản ghi ở lớp đã nghỉ + 1 ở lớp B chưa vào: không được hiện.
  const mkSess = (courseId: string, daysAgo: number) => prisma.attendanceSession.create({ data: { courseId, date: new Date(Date.now() - daysAgo * D), createdBy: T.id } });
  const s1 = await mkSess(C.id, 9), s2 = await mkSess(C.id, 6), s3 = await mkSess(C.id, 3), sSus = await mkSess(SUS.id, 2), sOther = await mkSess(OTHER.id, 1);
  await prisma.attendanceRecord.createMany({ data: [
    { sessionId: s1.id, userId: A.id, status: "present" }, { sessionId: s2.id, userId: A.id, status: "absent" }, { sessionId: s3.id, userId: A.id, status: "excused", note: "Ghi chú riêng của gia sư" },
    { sessionId: s1.id, userId: B.id, status: "present" },
    { sessionId: sSus.id, userId: A.id, status: "present" }, { sessionId: sOther.id, userId: A.id, status: "present" },
  ] });
  // Điểm: mỗi em một bài nộp đã chấm ở lớp C (A 8, B 3); lớp hết thử có bài A đã chấm 9.
  await prisma.section.create({ data: { id: "s-api", title: "P", courseId: C.id } });
  await prisma.chapter.create({ data: { id: "c-api", title: "C", sectionId: "s-api" } });
  await prisma.lesson.create({ data: { id: "l-api", code: "l-api", title: "Bài 1", type: "document", chapterId: "c-api" } });
  await prisma.assignment.create({ data: { id: "bt-api", lessonId: "l-api", title: "Bài tập 1", maxPoints: 10 } });
  await prisma.assignmentSubmission.create({ data: { assignmentId: "bt-api", userId: A.id, fileUrl: "/u/a.pdf", score: 8, gradedAt: new Date() } });
  await prisma.assignmentSubmission.create({ data: { assignmentId: "bt-api", userId: B.id, fileUrl: "/u/b.pdf", score: 3, gradedAt: new Date() } });
  await prisma.section.create({ data: { id: "s-exp", title: "P", courseId: EXP.id } });
  await prisma.chapter.create({ data: { id: "c-exp", title: "C", sectionId: "s-exp" } });
  await prisma.lesson.create({ data: { id: "l-exp", code: "l-exp", title: "Bài E", type: "document", chapterId: "c-exp" } });
  await prisma.assignment.create({ data: { id: "bt-exp", lessonId: "l-exp", title: "Bài tập E", maxPoints: 10 } });
  await prisma.assignmentSubmission.create({ data: { assignmentId: "bt-exp", userId: A.id, fileUrl: "/u/e.pdf", score: 9, gradedAt: new Date() } });

  section("/api/student/nhat-ky — chỉ điểm danh của CHÍNH em, ở lớp em đang học");
  const nA = await api("GET", "/api/student/nhat-ky", { as: A }), nB = await api("GET", "/api/student/nhat-ky", { as: B });
  const itemsA = (nA.json?.items ?? []) as { dateKey: string; courseName: string; status: string }[];
  const itemsB = (nB.json?.items ?? []) as { dateKey: string; courseName: string; status: string }[];
  check("A chỉ thấy 3 buổi của A ở Toán 12, cũ → mới: có mặt, vắng, nghỉ có báo", nA.status === 200 && itemsA.map(i => i.status).join(",") === "co-mat,vang,nghi-bao" && itemsA.every(i => i.courseName === "Toán 12"), itemsA);
  check("B chỉ thấy 1 buổi của B (không thấy buổi vắng / nghỉ của A)", nB.status === 200 && itemsB.length === 1 && itemsB[0].status === "co-mat", itemsB);
  check("không lộ lớp đã nghỉ / lớp chưa vào", !nA.text.includes("Lớp đã nghỉ") && !nA.text.includes("Lớp không vào"));
  check("không lộ ghi chú của gia sư, mã người dùng, mã buổi", !nA.text.includes("Ghi chú riêng") && !nA.text.includes(A.id) && !nA.text.includes(B.id) && !nA.text.includes(s1.id), nA.text.slice(0, 200));
  check("khách ⇒ 401", (await api("GET", "/api/student/nhat-ky")).status === 401);
  check("gia sư ⇒ 403", (await api("GET", "/api/student/nhat-ky", { as: T })).status === 403);
  check("Cache-Control private, no-store", (nA.headers.get("cache-control") ?? "").includes("no-store"));

  section("/api/student/ket-qua?courseId= — điểm của CHÍNH em");
  const kA = await api("GET", `/api/student/ket-qua?courseId=${C.id}`, { as: A }), kB = await api("GET", `/api/student/ket-qua?courseId=${C.id}`, { as: B });
  const scoreOf = (r: typeof kA) => r.json?.classes?.[0]?.items?.find((i: { id: string }) => i.id === "bt-api")?.score;
  check("cùng lớp: A thấy 8, B thấy 3 (không lẫn)", scoreOf(kA) === 8 && scoreOf(kB) === 3, { a: scoreOf(kA), b: scoreOf(kB) });
  check("không lộ tên / mã của bạn khác", !kA.text.includes(B.id) && !kA.text.includes("Em B") && !kB.text.includes(A.id));
  const notMine = await api("GET", `/api/student/ket-qua?courseId=${OTHER.id}`, { as: A });
  check("courseId của lớp em KHÔNG ghi danh ⇒ classes []", notMine.status === 200 && Array.isArray(notMine.json?.classes) && notMine.json.classes.length === 0, notMine.json);
  const sus = await api("GET", `/api/student/ket-qua?courseId=${SUS.id}`, { as: A });
  check("courseId của lớp đã nghỉ (suspended) ⇒ classes []", sus.status === 200 && sus.json?.classes?.length === 0, sus.json);
  const bExp = await api("GET", `/api/student/ket-qua?courseId=${EXP.id}`, { as: B });
  check("B hỏi lớp hết thử của A (B không ghi danh) ⇒ classes []", bExp.json?.classes?.length === 0, bExp.json);
  const aExp = await api("GET", `/api/student/ket-qua?courseId=${EXP.id}`, { as: A });
  const e0 = aExp.json?.classes?.[0];
  check("A hỏi lớp hết thử của chính mình ⇒ có điểm 9, href rỗng (không mở bài)", e0?.courseId === EXP.id && e0.items?.[0]?.score === 9 && e0.items.every((i: { href: string | null }) => i.href === null), e0);
  const all = await api("GET", "/api/student/ket-qua", { as: A });
  check("không courseId ⇒ chỉ lớp đang học (không gồm lớp hết thử / đã nghỉ)", (all.json?.classes ?? []).map((c: { courseId: string }) => c.courseId).join(",") === C.id, all.json?.classes?.map((c: { courseId: string }) => c.courseId));
  check("khách ⇒ 401", (await api("GET", `/api/student/ket-qua?courseId=${C.id}`)).status === 401);
  check("gia sư ⇒ 403", (await api("GET", `/api/student/ket-qua?courseId=${C.id}`, { as: T })).status === 403);
  await done();
})();
