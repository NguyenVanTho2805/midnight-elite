// Việc P2 (học sinh): lượt làm bài đang mở, học sinh bị chuyển Enrollment.status='suspended' giữa chừng → submit/answer/answer-bool/tab-event đều 403.
// Cùng quy tắc với /start: đề gắn lớp chỉ ghi danh ĐANG HỌC mới ghi được (đề thu phí còn đường ExamGuestAccess); đề không gắn lớp không bị chặn.
// Chạy (cần máy chủ BASE): source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-attempt-suspended-api.ts
//
// CA PHÁ CỐ Ý (mỗi lần một thứ rồi hoàn lại):
//   - submit/route.ts: xoá khối `attemptWriteBlock` → ca "submit: suspended → 403" đỏ (và lượt bị chấm dù đã tạm dừng).
//   - attemptAccess.ts canWriteAttempt: bỏ dòng `if (!i.courseId) return true` → ca "đề không gắn lớp" đỏ.
//   - attemptAccess.ts: đổi `isEnrollmentActive(i.enrollment)` thành `!!i.enrollment` → ca thuần 'suspended' đỏ.
import { api, mkTutor, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { canWriteAttempt, ATTEMPT_BLOCKED_MESSAGE } from "@/lib/attemptAccess";

(async () => {
  section("Hàm thuần canWriteAttempt");
  const act = { status: "active" }, sus = { status: "suspended" };
  check("active → được", canWriteAttempt({ courseId: "c", price: null, enrollment: act, hasGuestAccess: false }));
  check("suspended → không", !canWriteAttempt({ courseId: "c", price: null, enrollment: sus, hasGuestAccess: false }));
  check("pending_consent → không", !canWriteAttempt({ courseId: "c", price: null, enrollment: { status: "pending_consent" }, hasGuestAccess: false }));
  check("không ghi danh → không", !canWriteAttempt({ courseId: "c", price: null, enrollment: null, hasGuestAccess: false }));
  check("không gắn lớp → được (đề công khai)", canWriteAttempt({ courseId: null, price: null, enrollment: null, hasGuestAccess: false }));
  check("đề thu phí + có quyền khách → được dù suspended", canWriteAttempt({ courseId: "c", price: 100, enrollment: sus, hasGuestAccess: true }));
  check("đề MIỄN PHÍ + quyền khách → không (như /start)", !canWriteAttempt({ courseId: "c", price: 0, enrollment: sus, hasGuestAccess: true }));
  check("thông điệp giọng KiN, không số tiền/tên", /KiN/.test(ATTEMPT_BLOCKED_MESSAGE) && !/\d/.test(ATTEMPT_BLOCKED_MESSAGE));

  await wipe();
  const T = await mkTutor("Cô Lan");
  const C = await mkCourse(T.id, { name: "Toán 9" });
  const mk = (n: string) => mkUser({ name: n });
  const [S1, S2, S3, S4, S5] = [await mk("Em Một"), await mk("Em Hai"), await mk("Em Ba"), await mk("Em Bốn"), await mk("Em Năm")];
  for (const u of [S1, S2, S3, S4]) await prisma.enrollment.create({ data: { userId: u.id, courseId: C.id, status: "active" } });

  const mkExam = async (id: string, extra: Record<string, unknown>) => {
    await prisma.exam.create({ data: { id, code: id, title: "Bài " + id, category: "Toán", date: "01/01/2030", time: "08:00", duration: "15 phút", questions: 2, status: "available", createdAt: "2026-10-24", ownerId: T.id, totalPoints: 10, ...extra } });
    const q = await prisma.examQuestion.create({ data: { id: id + "-mc", examId: id, order: 1, text: "2 + 2 = ?", type: "MC", points: 1 } });
    await prisma.examOption.create({ data: { id: id + "-ok", questionId: q.id, order: 0, text: "4", isCorrect: true } });
    await prisma.examOption.create({ data: { id: id + "-no", questionId: q.id, order: 1, text: "5", isCorrect: false } });
    const tf = await prisma.examQuestion.create({ data: { id: id + "-tf", examId: id, order: 2, text: "Đúng sai", type: "TRUE_FALSE_CLUSTER", points: 1 } });
    await prisma.examOption.create({ data: { id: id + "-tfa", questionId: tf.id, order: 0, text: "ý a", isCorrect: true } });
    return { mc: q.id, ok: id + "-ok", tfOpt: id + "-tfa" };
  };
  const E = await mkExam("sus-lop", { courseId: C.id });
  const P = await mkExam("sus-cong-khai", {});

  async function start(u: typeof S1, examId: string) {
    const r = await api("POST", `/api/exams/${examId}/start`, { as: u, body: {} });
    check(`start ${examId} bởi ${u.name} → 200`, r.status === 200 && !!r.json?.attemptId, r.json);
    return r.json.attemptId as string;
  }
  const suspend = (u: typeof S1) => prisma.enrollment.update({ where: { userId_courseId: { userId: u.id, courseId: C.id } }, data: { status: "suspended" } });

  section("Học sinh active bắt đầu làm rồi bị tạm dừng giữa chừng");
  const a1 = await start(S1, "sus-lop");
  const pre = await api("PATCH", `/api/exams/attempts/${a1}/answer`, { as: S1, body: { questionId: E.mc, optionId: E.ok } });
  check("trước khi tạm dừng: lưu đáp án 200", pre.status === 200, pre.json);
  await suspend(S1);
  const ans = await api("PATCH", `/api/exams/attempts/${a1}/answer`, { as: S1, body: { questionId: E.mc, optionId: E.ok } });
  check("answer: suspended → 403", ans.status === 403, ans.json);
  check("thông điệp giọng KiN, không tên/số tiền", ans.json?.error === ATTEMPT_BLOCKED_MESSAGE && ans.json?.code === "enrollment_suspended", ans.json);
  const bool = await api("PATCH", `/api/exams/attempts/${a1}/answer-bool`, { as: S1, body: { optionId: E.tfOpt, answerTrue: true } });
  check("answer-bool: suspended → 403", bool.status === 403, bool.json);
  const tab = await api("PATCH", `/api/exams/attempts/${a1}/tab-event`, { as: S1 });
  check("tab-event: suspended → 403", tab.status === 403, tab.json);
  const sub = await api("POST", `/api/exams/attempts/${a1}/submit`, { as: S1 });
  check("submit: suspended → 403", sub.status === 403, sub.json);
  const row = await prisma.examAttempt.findUnique({ where: { id: a1 } });
  check("lượt vẫn in_progress, tab chưa tăng (không bị ghi gì)", row?.status === "in_progress" && row.tabSwitchCount === 0, row);
  const cnt = await prisma.examAnswer.count({ where: { attemptId: a1 } });
  check("chỉ còn đáp án lưu từ trước khi tạm dừng (1)", cnt === 1, cnt);

  section("Mở lại (active) thì nộp được");
  await prisma.enrollment.update({ where: { userId_courseId: { userId: S1.id, courseId: C.id } }, data: { status: "active" } });
  const again = await api("POST", `/api/exams/attempts/${a1}/submit`, { as: S1 });
  check("active lại: submit 200", again.status === 200 && again.json?.status === "submitted", again.json);

  section("Học sinh active không bị chặn");
  const a2 = await start(S2, "sus-lop");
  check("answer 200", (await api("PATCH", `/api/exams/attempts/${a2}/answer`, { as: S2, body: { questionId: E.mc, optionId: E.ok } })).status === 200);
  check("answer-bool 200", (await api("PATCH", `/api/exams/attempts/${a2}/answer-bool`, { as: S2, body: { optionId: E.tfOpt, answerTrue: true } })).status === 200);
  check("tab-event 200", (await api("PATCH", `/api/exams/attempts/${a2}/tab-event`, { as: S2 })).status === 200);
  const s2 = await api("POST", `/api/exams/attempts/${a2}/submit`, { as: S2 });
  check("submit 200 và idempotent (gọi lại 200)", s2.status === 200 && (await api("POST", `/api/exams/attempts/${a2}/submit`, { as: S2 })).status === 200, s2.json);

  section("Tạm dừng một em không ảnh hưởng em khác; người lạ vẫn 404");
  const a3 = await start(S3, "sus-lop"); await suspend(S4);
  check("em Ba (active) nộp 200 dù em Bốn tạm dừng", (await api("POST", `/api/exams/attempts/${a3}/submit`, { as: S3 })).status === 200);
  check("em Bốn không có lượt của em Ba: 404", (await api("POST", `/api/exams/attempts/${a3}/submit`, { as: S4 })).status === 404);
  check("chưa đăng nhập: 401", (await api("POST", `/api/exams/attempts/${a3}/submit`)).status === 401);

  section("Đề không gắn lớp: không chặn theo ghi danh");
  const a5 = await start(S5, "sus-cong-khai");
  check("học sinh không ghi danh lớp nào: answer 200", (await api("PATCH", `/api/exams/attempts/${a5}/answer`, { as: S5, body: { questionId: P.mc, optionId: P.ok } })).status === 200);
  check("submit 200", (await api("POST", `/api/exams/attempts/${a5}/submit`, { as: S5 })).status === 200);
  done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
