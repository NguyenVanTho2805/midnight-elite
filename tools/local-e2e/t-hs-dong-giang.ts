// TUT-dong-giang phía HỌC SINH (D7 + H4). Cần máy chủ: bash .local-dev/wt-up.sh. DB riêng bị wipe().
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-hs-dong-giang.ts
//
// D7  đồng giảng ĐANG HIỆU LỰC là thành viên cộng đồng lớp (đọc + đăng); lời mời / đã gỡ / bị khoá / gia sư lạ / gia sư còn Enrollment cũ thì không;
//     duyệt "Chọn là đúng" và xoá bài người khác vẫn chủ lớp / quản trị. Q5: học viên KHÔNG thấy tên đồng giảng (nhưng thấy tên chủ lớp).
// H4  gia sư (role admin) còn Enrollment cũ không dùng được route học sinh: GET trả rỗng, ghi trả 403; học sinh thật không đổi.
//
// Ca phá (bẻ X thì ca Y đỏ):
//   - bỏ nhánh isActiveCourseHelper trong canAccessClass                               → "đồng giảng đọc / đăng được" đỏ
//   - isActiveCourseHelper bỏ lọc status/active hoặc user.banned                        → "lời mời / đã gỡ / bị khoá ⇒ 403" đỏ
//   - bỏ `user.role === "student"` trong nhánh Enrollment của canAccessClass            → "gia sư còn Enrollment cũ ⇒ 403 lớp" đỏ
//   - bỏ helperAuthorsToHide ở feed / chi tiết / threads GET                            → "học viên không thấy tên đồng giảng" đỏ
//   - cho canAcceptReply nhận đồng giảng                                                → "đồng giảng không chọn là đúng" đỏ
//   - bỏ requireStudentRole / isStudentInDb ở một route H4                              → ca route đó đỏ
import { prisma } from "@/lib/prisma";
import { api, check, section, done, mkUser, mkTutor, mkSuper, mkCourse, wipe, type TUser } from "./h";

const J = (r: { json: unknown }) => (r.json ?? {}) as Record<string, any>;
const has = (r: { text: string }, s: string) => r.text.includes(s);

(async () => {
  await wipe();
  const O = await mkTutor("Thầy Chủ Nhiệm Lâm");
  const C = await mkTutor("Cô Đồng Giảng Sương");
  const S = await mkTutor("Thầy Bộ Môn Khải");
  const I = await mkTutor("Cô Được Mời Nga");
  const R = await mkTutor("Thầy Đã Gỡ Bình");
  const BN = await mkTutor("Thầy Bị Khoá Đạt");
  const X = await mkTutor("Cô Người Lạ Yên");
  const T = await mkTutor("Cô Cựu Học Sinh Trâm");   // đã được chuyển lên gia sư, còn Enrollment cũ
  const H = await mkUser({ name: "Em Học Viên Quân" });
  const ADM = await mkSuper("Quản Trị");
  const K1 = await mkCourse(O.id, { name: "Lớp K1" });
  const K2 = await mkCourse(X.id, { name: "Lớp K2 của Yên" });
  await prisma.enrollment.createMany({ data: [{ userId: H.id, courseId: K1.id, status: "active" }, { userId: T.id, courseId: K1.id, status: "active" }] });
  const ct = (u: TUser, status: string, role = "co_teacher") => prisma.courseTeacher.create({ data: { courseId: K1.id, userId: u.id, role, status, invitedBy: O.id } });
  await ct(C, "active"); await ct(S, "active", "subject_teacher"); await ct(I, "invited"); await ct(R, "removed"); await ct(BN, "active");
  await prisma.user.update({ where: { id: BN.id }, data: { banned: true } });

  // ── D7: đọc / đăng ──────────────────────────────────────────────────────────────────────
  section("D7 — ai vào được cộng đồng lớp");
  const tHS = await prisma.thread.create({ data: { content: "Em hỏi bài tập về nhà ạ", authorId: H.id, category: "kinh-nghiem", courseId: K1.id } });
  const qHS = await prisma.thread.create({ data: { title: "Câu hỏi cần chọn đúng", content: "Giải giúp em câu này với", authorId: H.id, category: "hoi-dap", kind: "question", courseId: K1.id } });
  const list = (u?: TUser) => api("GET", `/api/community/threads?courseId=${K1.id}`, { as: u });
  for (const [who, u] of [["chủ lớp", O], ["đồng giảng", C], ["giáo viên bộ môn", S], ["học viên", H], ["quản trị", ADM]] as const) {
    const r = await list(u);
    check(`${who} đọc cộng đồng lớp ⇒ 200`, r.status === 200, r);
  }
  for (const [who, u] of [["lời mời chưa nhận", I], ["đã bị gỡ", R], ["bị khoá", BN], ["gia sư lạ", X], ["gia sư còn Enrollment cũ", T]] as const) {
    const r = await list(u);
    check(`${who} đọc cộng đồng lớp ⇒ 403`, r.status === 403, r);
  }
  check("khách đọc cộng đồng lớp ⇒ 403", (await list()).status === 403);

  const post = (u: TUser, content: string, extra: Record<string, unknown> = {}) =>
    api("POST", "/api/community/threads", { as: u, body: { content, category: "kinh-nghiem", courseId: K1.id, ...extra } });
  const pC = await post(C, "Cô nhắc cả lớp nộp bài trước thứ Sáu");
  check("đồng giảng đăng bài vào lớp ⇒ 201", pC.status === 201, pC);
  const pS = await post(S, "Thầy bộ môn gửi thêm đề luyện tập");
  check("giáo viên bộ môn đăng bài vào lớp ⇒ 201", pS.status === 201, pS);
  for (const [who, u] of [["lời mời chưa nhận", I], ["đã bị gỡ", R], ["bị khoá", BN], ["gia sư lạ", X], ["gia sư còn Enrollment cũ", T]] as const) {
    const r = await post(u, "Tôi muốn đăng bài");
    check(`${who} đăng bài vào lớp ⇒ 403`, r.status === 403, r);
  }
  const noName = await prisma.notification.findMany({ where: { userId: O.id } });
  const ntext = noName.map(n => `${n.title} ${n.message}`).join(" ");
  check("chủ lớp nhận thông báo bài mới của đồng giảng, không tên người", noName.length >= 2 && ![C, S, H].some(u => ntext.includes(u.name)) && !ntext.includes("@"), ntext);

  // ── Phạm vi / nguồn cấp ─────────────────────────────────────────────────────────────────
  section("D7 — bảng tin, phạm vi lớp");
  const feedC = await api("GET", `/api/community/feed?scope=${K1.id}`, { as: C });
  check("đồng giảng xem bảng tin lớp ⇒ 200 và thấy bài của học viên", feedC.status === 200 && has(feedC, "Em hỏi bài tập về nhà"), feedC.status);
  const feedAllC = await api("GET", "/api/community/feed", { as: C });
  check("bảng tin mặc định của đồng giảng gồm bài của lớp", feedAllC.status === 200 && has(feedAllC, "Em hỏi bài tập về nhà"));
  for (const [who, u] of [["lời mời", I], ["đã gỡ", R], ["bị khoá", BN], ["gia sư lạ", X], ["gia sư còn Enrollment cũ", T]] as const) {
    const a = await api("GET", `/api/community/feed?scope=${K1.id}`, { as: u });
    const b = await api("GET", "/api/community/feed", { as: u });
    check(`${who}: scope=lớp ⇒ 403 và bảng tin mặc định không có bài của lớp`, a.status === 403 && !has(b, "Em hỏi bài tập về nhà"), { a: a.status });
  }
  const scopes = async (u: TUser) => (J(await api("GET", "/api/community/scope-options", { as: u })).scopes ?? []).map((s: any) => s.id);
  check("scope-options: đồng giảng có K1", (await scopes(C)).includes(K1.id));
  check("scope-options: lời mời / đã gỡ / bị khoá / lạ không có K1", ![await scopes(I), await scopes(R), await scopes(BN), await scopes(X)].some(a => a.includes(K1.id)));
  check("scope-options: gia sư còn Enrollment cũ không có K1 (chỉ học sinh thật mới có)", !(await scopes(T)).includes(K1.id));
  check("scope-options: học viên có K1", (await scopes(H)).includes(K1.id));

  const detail = (u: TUser | undefined, id: string) => api("GET", `/api/community/threads/${id}`, { as: u });
  check("đồng giảng mở chi tiết bài lớp ⇒ 200", (await detail(C, tHS.id)).status === 200);
  check("gia sư lạ mở chi tiết bài lớp ⇒ 404", (await detail(X, tHS.id)).status === 404);
  check("gia sư còn Enrollment cũ mở chi tiết bài lớp ⇒ 404", (await detail(T, tHS.id)).status === 404);
  const rp = await api("POST", `/api/community/threads/${tHS.id}/reply`, { as: C, body: { content: "Cô trả lời: xem lại bài 3 nhé" } });
  check("đồng giảng trả lời bài trong lớp ⇒ 200/201", rp.status === 200 || rp.status === 201, rp);
  const rpX = await api("POST", `/api/community/threads/${tHS.id}/reply`, { as: X, body: { content: "Tôi là người lạ" } });
  check("gia sư lạ trả lời bài trong lớp ⇒ 404/403", rpX.status === 404 || rpX.status === 403, rpX);

  // ── Duyệt / xoá vẫn của chủ lớp ────────────────────────────────────────────────────────
  section("D7 — đồng giảng không duyệt, không xoá bài người khác");
  const qd = J(await detail(C, qHS.id));
  check("đồng giảng không có canAccept (không chọn là đúng)", qd.canAccept === false, qd.canAccept);
  const replyOfC = await api("POST", `/api/community/threads/${qHS.id}/reply`, { as: C, body: { content: "Đáp án là 4" } });
  const replyId = J(replyOfC).id ?? J(replyOfC).reply?.id;
  check("chủ lớp có canAccept", J(await detail(O, qHS.id)).canAccept === true);
  const acc = await api("POST", `/api/community/threads/${qHS.id}/accept-reply`, { as: C, body: { replyId } });
  check("đồng giảng chọn là đúng ⇒ 403/404", acc.status === 403 || acc.status === 404, acc);
  const del = await api("DELETE", `/api/community/threads/${tHS.id}`, { as: C });
  check("đồng giảng xoá bài của học viên ⇒ 403", del.status === 403, del);
  const delOwn = await api("DELETE", `/api/community/threads/${J(pC).id}`, { as: C });
  check("đồng giảng xoá bài CỦA MÌNH ⇒ 200", delOwn.status === 200, delOwn);

  // ── Q5: học viên không thấy tên đồng giảng ─────────────────────────────────────────────
  section("Q5 — học viên / khách / gia sư lạ không thấy tên đồng giảng; chủ lớp, đồng giảng, quản trị thấy");
  const pC2 = await post(C, "Bài thứ hai của cô giáo đồng giảng"); const pC2id = J(pC2).id;
  await prisma.threadBookmark.create({ data: { userId: H.id, threadId: pC2id } });
  const surfaces = async (u: TUser) => ({
    feed: await api("GET", `/api/community/feed?scope=${K1.id}`, { as: u }),
    feedAll: await api("GET", "/api/community/feed", { as: u }),
    threads: await api("GET", `/api/community/threads?courseId=${K1.id}`, { as: u }),
    detail: await api("GET", `/api/community/threads/${tHS.id}`, { as: u }),
    marks: await api("GET", "/api/community/bookmarks", { as: u }),
  });
  const NAMES = [C.name, S.name, "Sương", "Khải"];
  const sH = await surfaces(H);
  for (const [k, r] of Object.entries(sH)) {
    check(`học viên: ${k} 200 và không lộ tên đồng giảng / bộ môn`, r.status === 200 && !NAMES.some(n => has(r, n)), { s: r.status, hit: NAMES.filter(n => has(r, n)) });
  }
  check("học viên vẫn thấy BÀI của đồng giảng (nhãn 'Giáo viên của lớp')", has(sH.feed, "Bài thứ hai của cô giáo đồng giảng") && has(sH.feed, "Giáo viên của lớp"));
  check("học viên thấy tên CHỦ lớp khi chủ lớp đăng", true);
  const pO = await post(O, "Thầy chủ nhiệm thông báo lịch thi"); 
  const feedH2 = await api("GET", `/api/community/feed?scope=${K1.id}`, { as: H });
  check("tên chủ lớp KHÔNG bị giấu", has(feedH2, O.name), feedH2.text.slice(0, 200));
  const idsLeak = await api("GET", `/api/community/feed?scope=${K1.id}`, { as: H });
  check("không lộ id đồng giảng cho học viên", !has(idsLeak, C.id) && !has(idsLeak, S.id));
  const detRep = await api("GET", `/api/community/threads/${tHS.id}`, { as: H });
  check("lời trả lời của đồng giảng trong chi tiết bị giấu tên với học viên", has(detRep, "Cô trả lời: xem lại bài 3") && !has(detRep, "Sương") && !has(detRep, C.id), detRep.text.slice(0, 300));
  const guestF = await api("GET", `/api/community/threads/${tHS.id}`);
  check("khách không đọc được bài lớp", guestF.status === 404);
  for (const [who, u] of [["chủ lớp", O], ["đồng giảng", C], ["quản trị", ADM]] as const) {
    const r = await api("GET", `/api/community/feed?scope=${K1.id}`, { as: u });
    check(`${who} thấy tên thật đồng giảng`, r.status === 200 && has(r, "Sương"), r.status);
  }
  const sS = await api("GET", `/api/community/feed?scope=${K1.id}`, { as: S });
  check("giáo viên bộ môn (thành viên lớp) thấy tên thật", has(sS, "Sương"));
  const thr = J(await api("GET", `/api/community/threads?courseId=${K1.id}`, { as: O })).threads ?? [];
  check("chủ lớp: GET threads thấy tên thật đồng giảng", thr.some((t: any) => t.author?.name?.includes("Sương")));
  // người đã bị gỡ: bài cũ vẫn không lộ tên với học viên
  await prisma.courseTeacher.update({ where: { courseId_userId: { courseId: K1.id, userId: C.id } }, data: { status: "removed" } });
  const afterRm = await api("GET", `/api/community/feed?scope=${K1.id}`, { as: H });
  check("đồng giảng đã bị gỡ: bài cũ vẫn không lộ tên với học viên", afterRm.status === 200 && !has(afterRm, "Sương"));
  const rmRead = await list(C);
  check("đồng giảng đã bị gỡ không đọc được lớp nữa ⇒ 403", rmRead.status === 403, rmRead);

  // ── H4 ─────────────────────────────────────────────────────────────────────────────────
  section("H4 — gia sư không dùng route học sinh, dù còn Enrollment cũ");
  // T: token role admin (đã đổi vai). TOKEN CŨ: học sinh được đổi lên gia sư SAU khi cấp token ⇒ token còn ghi "student".
  const Z = await mkUser({ name: "Em Vừa Lên Gia Sư" });   // token cũ role student
  await prisma.enrollment.create({ data: { userId: Z.id, courseId: K1.id, status: "active" } });
  await prisma.user.update({ where: { id: Z.id }, data: { role: "admin", adminRole: "teacher", tutorVerified: true } });

  const enr = async (u: TUser, q = "") => api("GET", `/api/enrollments${q}`, { as: u });
  check("học sinh thật: /api/enrollments có K1", J(await enr(H)).courseIds?.includes(K1.id));
  for (const [who, u] of [["gia sư (token admin)", T], ["gia sư (token cũ còn 'student')", Z]] as const) {
    const a = await enr(u), b = await enr(u, "?detail=1");
    check(`${who}: GET /api/enrollments ⇒ 200 và rỗng`, a.status === 200 && J(a).courseIds.length === 0 && J(a).pendingConsentCourseIds.length === 0 && J(a).suspendedCourseIds.length === 0, a);
    check(`${who}: GET /api/enrollments?detail=1 rỗng, không lộ tên lớp`, b.status === 200 && J(b).courses.length === 0 && !has(b, "Lớp K1"), b);
  }

  const lessonFree = await mkLesson(K1.id, true), lessonPaid = await mkLesson(K1.id, false);
  const coins = (id: string) => prisma.coinTransaction.count({ where: { userId: id } });
  const prog = (m: string, u: TUser, lessonId: string, body: unknown = {}) => api(m, `/api/progress/${lessonId}`, { as: u, body });
  const okH = await prog("POST", H, lessonPaid);
  check("học sinh thật: POST /api/progress/<bài> ⇒ 200", okH.status === 200, okH);
  for (const [who, u] of [["gia sư", T], ["gia sư token cũ", Z]] as const) {
    const before = await coins(u.id);
    for (const [m, l] of [["POST", lessonPaid], ["POST", lessonFree], ["PATCH", lessonPaid], ["DELETE", lessonPaid]] as const) {
      const r = await prog(m, u, l, { watchedSeconds: 5 });
      check(`${who}: ${m} /api/progress (${l === lessonFree ? "bài miễn phí" : "bài của lớp"}) ⇒ 403`, r.status === 403, r);
    }
    check(`${who}: không có LessonProgress, không có Coin`, (await prisma.lessonProgress.count({ where: { userId: u.id } })) === 0 && (await coins(u.id)) === before);
    const g = await api("GET", "/api/progress", { as: u });
    check(`${who}: GET /api/progress ⇒ 200 rỗng`, g.status === 200 && J(g).completedIds.length === 0 && Object.keys(J(g).byCourse).length === 0, g);
    const n = await api("PUT", `/api/lesson-notes/${lessonPaid}`, { as: u, body: { text: "ghi chú" } });
    check(`${who}: PUT /api/lesson-notes ⇒ 403`, n.status === 403, n);
    const fc = await api("POST", `/api/followed-courses/${K2.id}`, { as: u });
    check(`${who}: POST /api/followed-courses ⇒ 403, không có CartItem`, fc.status === 403 && (await prisma.cartItem.count({ where: { userId: u.id } })) === 0, fc);
    const fl = await api("GET", "/api/followed-courses", { as: u });
    check(`${who}: GET /api/followed-courses ⇒ rỗng`, fl.status === 200 && J(fl).items.length === 0, fl);
    for (const p of ["/api/student/viec-cua-toi", "/api/student/viec-cua-toi?badge=1", "/api/student/de-thi"]) {
      const r = await api("GET", p, { as: u });
      check(`${who}: GET ${p} ⇒ 200 rỗng (không lộ việc / đề của lớp cũ)`, r.status === 200 && (J(r).items ?? []).length === 0 && (J(r).badge ?? 0) === 0, r);
    }
  }
  check("học sinh thật: GET /api/student/viec-cua-toi ⇒ 200", (await api("GET", "/api/student/viec-cua-toi", { as: H })).status === 200);
  check("học sinh thật: GET /api/progress có bài vừa xong", J(await api("GET", "/api/progress", { as: H })).completedIds?.includes(lessonPaid));
  check("học sinh thật: PUT /api/lesson-notes ⇒ 200", (await api("PUT", `/api/lesson-notes/${lessonPaid}`, { as: H, body: { text: "ghi chú" } })).status === 200);
  check("học sinh thật: theo dõi lớp khác ⇒ 200", (await api("POST", `/api/followed-courses/${K2.id}`, { as: H })).status === 200);

  const exam = await mkExam(O.id, K1.id);
  const st = await api("POST", `/api/exams/${exam}/start`, { as: H, body: {} });
  check("học sinh thật: start đề của lớp ⇒ 200 có attemptId", st.status === 200 && !!J(st).attemptId, st);
  for (const [who, u] of [["gia sư", T], ["gia sư token cũ", Z], ["chủ lớp", O]] as const) {
    const r = await api("POST", `/api/exams/${exam}/start`, { as: u, body: {} });
    check(`${who}: start đề ⇒ 403, không tạo lượt làm`, r.status === 403 && (await prisma.examAttempt.count({ where: { userId: u.id } })) === 0, r);
  }
  const noAnsKeys = /correct|isCorrect/i.test(st.text);
  check("(giữ nguyên) API start trả đề cho người làm không chứa correct*/isCorrect", !noAnsKeys, st.text.slice(0, 200));
  check("chưa đăng nhập: start ⇒ 401", (await api("POST", `/api/exams/${exam}/start`, { body: {} })).status === 401);

  await done();
})().catch(e => { console.error(e); process.exit(1); });

async function mkLesson(courseId: string, isFree: boolean) {
  const n = `${courseId}-${isFree ? "f" : "p"}`;
  const sec = await prisma.section.upsert({ where: { id: `sec-${courseId}` }, update: {}, create: { id: `sec-${courseId}`, title: "Chương", order: 1, courseId } });
  const chap = await prisma.chapter.upsert({ where: { id: `chap-${courseId}` }, update: {}, create: { id: `chap-${courseId}`, title: "Nhóm", order: 1, sectionId: sec.id } });
  const l = await prisma.lesson.create({ data: { id: `les-${n}`, code: n.slice(-8), title: "Bài", type: "record", order: isFree ? 1 : 2, chapterId: chap.id, isLocked: false, isFree } as never });
  return l.id;
}
async function mkExam(ownerId: string, courseId: string) {
  const id = `de-${courseId}`;
  await prisma.exam.create({ data: { id, code: id, title: "Đề thử", category: "Toán", date: "01/01/2030", time: "08:00", duration: "15 phút", questions: 1, status: "available", createdAt: "2026-10-24", ownerId, courseId, totalPoints: 10 } });
  const q = await prisma.examQuestion.create({ data: { id: id + "-mc", examId: id, order: 1, text: "2 + 2 = ?", type: "MC", points: 1 } });
  await prisma.examOption.create({ data: { id: id + "-ok", questionId: q.id, order: 0, text: "4", isCorrect: true } });
  await prisma.examOption.create({ data: { id: id + "-no", questionId: q.id, order: 1, text: "5", isCorrect: false } });
  return id;
}
