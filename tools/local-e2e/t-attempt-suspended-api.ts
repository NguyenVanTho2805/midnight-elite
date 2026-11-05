// Việc P2 (học sinh): lượt làm bài đang mở, học sinh bị chuyển Enrollment.status='suspended' giữa chừng → submit/answer/answer-bool/tab-event đều 403.
// Cùng quy tắc với /start: đề gắn lớp chỉ ghi danh ĐANG HỌC mới ghi được (đề thu phí còn đường ExamGuestAccess); đề không gắn lớp không bị chặn.
// Chạy (cần máy chủ BASE): source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-attempt-suspended-api.ts
//
// Chính sách XEM chặt (06/11): chặn cả khi KHÔNG CÒN bản ghi ghi danh mà đề gắn lớp (thông điệp riêng, mã enrollment_removed); điểm lượt ĐÃ NỘP giữ nguyên (xem cuối bài).
// CA PHÁ CỐ Ý (mỗi lần một thứ rồi hoàn lại):
//   - attemptAccess.ts viewBlockKind: bỏ dòng `if (!i.enrollment) return "left"` → các ca "không còn ghi danh" (thuần + GET/review/correction) đỏ.
//   - attemptAccess.ts writeBlockKind: trả luôn "suspended" → ca "thông điệp GHI không nói 'tạm dừng'" đỏ.
//   - examAssignmentsServer.ts: bỏ khối enrollmentOf/gated → ca "de-thi: không còn ghi danh" đỏ.
//   - attempts/[id]/route.ts: chuyển khối attemptViewBlock lên TRƯỚC nhánh `status !== "in_progress"` → ca "ĐIỂM của lượt đã nộp" đỏ.
//   - submit/route.ts: xoá khối `attemptWriteBlock` → ca "submit: suspended → 403" đỏ (và lượt bị chấm dù đã tạm dừng).
//   - attemptAccess.ts canWriteAttempt: bỏ dòng `if (!i.courseId) return true` → ca "đề không gắn lớp" đỏ.
//   - attemptAccess.ts: đổi `isEnrollmentActive(i.enrollment)` thành `!!i.enrollment` → ca thuần 'suspended' đỏ.
//   - STU-đọc: gỡ từng khối chặn → ca tương ứng đỏ: examPracticeServer.ts (attemptWriteBlock) → "/check"; attempts/[id]/route.ts (attemptViewBlock) → "GET lượt dở";
//     review/route.ts → "review"; examCorrectionServer.ts loadContext → "correction GET/POST"; examAssignmentsServer.ts (suspendedCourseIds) → "de-thi";
//     gate/route.ts (suspended ? "enrollment_suspended") → "gate"; start/route.ts (khối ATTEMPT_SUSPENDED_MESSAGE) → "start miễn phí / thu phí".
import { api, mkTutor, mkSuper, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { canWriteAttempt, isSuspendedForView, viewBlockKind, writeBlockKind, viewBlockOf, writeBlockOf } from "@/lib/attemptAccess";
import { ATTEMPT_SUSPENDED_MESSAGE, ATTEMPT_BLOCKED_MESSAGE, ATTEMPT_LEFT_CLASS_MESSAGE, ATTEMPT_LEFT_CLASS_BLOCKED_MESSAGE, ENROLLMENT_REMOVED_CODE } from "@/lib/enrollmentMessages";

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

  section("Hàm thuần isSuspendedForView (chặn XEM khi đã nghỉ lớp)");
  check("suspended → chặn xem", isSuspendedForView({ courseId: "c", price: null, enrollment: sus, hasGuestAccess: false }));
  check("active → không chặn", !isSuspendedForView({ courseId: "c", price: null, enrollment: act, hasGuestAccess: false }));
  check("không còn ghi danh (enrollment null) + đề gắn lớp → chặn xem (chính sách chặt 06/11)", isSuspendedForView({ courseId: "c", price: null, enrollment: null, hasGuestAccess: false }));
  check("pending_consent → không chặn xem ở đây", !isSuspendedForView({ courseId: "c", price: null, enrollment: { status: "pending_consent" }, hasGuestAccess: false }));
  check("enrollment null + đề không gắn lớp → không chặn", !isSuspendedForView({ courseId: null, price: null, enrollment: null, hasGuestAccess: false }));
  check("enrollment null + đề thu phí có quyền khách → không chặn", !isSuspendedForView({ courseId: "c", price: 100, enrollment: null, hasGuestAccess: true }));
  check("enrollment null + đề MIỄN PHÍ + quyền khách → vẫn chặn (như /start)", isSuspendedForView({ courseId: "c", price: 0, enrollment: null, hasGuestAccess: true }));
  check("kind: suspended → 'suspended', null → 'left', active → null", viewBlockKind({ courseId: "c", price: null, enrollment: sus, hasGuestAccess: false }) === "suspended" && viewBlockKind({ courseId: "c", price: null, enrollment: null, hasGuestAccess: false }) === "left" && viewBlockKind({ courseId: "c", price: null, enrollment: act, hasGuestAccess: false }) === null);
  check("ghi: suspended → 'suspended'; không còn ghi danh → 'left'; active → null", writeBlockKind({ courseId: "c", price: null, enrollment: sus, hasGuestAccess: false }) === "suspended" && writeBlockKind({ courseId: "c", price: null, enrollment: null, hasGuestAccess: false }) === "left" && writeBlockKind({ courseId: "c", price: null, enrollment: act, hasGuestAccess: false }) === null);
  check("thông điệp XEM khi không còn ghi danh đúng văn bản chủ chốt, khác thông điệp nghỉ lớp", ATTEMPT_LEFT_CLASS_MESSAGE === "Bạn không còn trong lớp này nên chưa xem được bài thi. Liên hệ gia sư nếu cần tham gia lại." && ATTEMPT_LEFT_CLASS_MESSAGE !== ATTEMPT_SUSPENDED_MESSAGE && viewBlockOf("left")?.error === ATTEMPT_LEFT_CLASS_MESSAGE && viewBlockOf("left")?.code === ENROLLMENT_REMOVED_CODE);
  check("thông điệp GHI khi không còn ghi danh KHÔNG nói 'tạm dừng', không số/tên", !/tạm dừng/.test(ATTEMPT_LEFT_CLASS_BLOCKED_MESSAGE) && /KiN/.test(ATTEMPT_LEFT_CLASS_BLOCKED_MESSAGE) && !/\d/.test(ATTEMPT_LEFT_CLASS_BLOCKED_MESSAGE) && writeBlockOf("left")?.error === ATTEMPT_LEFT_CLASS_BLOCKED_MESSAGE && writeBlockOf("suspended")?.error === ATTEMPT_BLOCKED_MESSAGE);
  check("không gắn lớp → không chặn", !isSuspendedForView({ courseId: null, price: null, enrollment: sus, hasGuestAccess: false }));
  check("đề thu phí + quyền khách → vẫn xem được", !isSuspendedForView({ courseId: "c", price: 100, enrollment: sus, hasGuestAccess: true }));
  check("đề miễn phí + quyền khách → vẫn chặn", isSuspendedForView({ courseId: "c", price: 0, enrollment: sus, hasGuestAccess: true }));
  check("thông điệp nghỉ lớp giọng KiN, không số", /Liên hệ gia sư/.test(ATTEMPT_SUSPENDED_MESSAGE) && !/\d/.test(ATTEMPT_SUSPENDED_MESSAGE));

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
  // ───────── Đọc / xem lại / chữa bài / danh sách / cổng / start (chủ chọn chặt 06/11) ─────────
  const susView = (r: { status: number; json: any }) => r.status === 403 && r.json?.code === "enrollment_suspended" && r.json?.error === ATTEMPT_SUSPENDED_MESSAGE;
  const [V1, V2, V3] = [await mk("Em Sáu"), await mk("Em Bảy"), await mk("Em Tám")];
  for (const u of [V1, V2, V3]) await prisma.enrollment.create({ data: { userId: u.id, courseId: C.id, status: "active" } });
  const PR = await mkExam("sus-luyen", { courseId: C.id, mode: "practice", answerVisibility: "immediate" });
  const PAID = await mkExam("sus-thu-phi", { courseId: C.id, price: 100000 });
  const suspendV = (u: typeof S1) => prisma.enrollment.update({ where: { userId_courseId: { userId: u.id, courseId: C.id } }, data: { status: "suspended" } });
  const activeV = (u: typeof S1) => prisma.enrollment.update({ where: { userId_courseId: { userId: u.id, courseId: C.id } }, data: { status: "active" } });

  section("/check (chấm từng câu luyện tập) và GET lượt đang làm");
  const b1 = await start(V1, "sus-luyen");
  await api("PATCH", `/api/exams/attempts/${b1}/answer`, { as: V1, body: { questionId: PR.mc, optionId: PR.ok } });
  const chkOk = await api("POST", `/api/exams/attempts/${b1}/check`, { as: V1, body: { questionId: PR.mc } });
  check("/check khi còn học: 200", chkOk.status === 200, chkOk.json);
  const getOk = await api("GET", `/api/exams/attempts/${b1}`, { as: V1 });
  check("GET lượt dở khi còn học: 200 có câu hỏi", getOk.status === 200 && Array.isArray(getOk.json?.questions) && getOk.json.questions.length === 2, getOk.json);
  await suspendV(V1);
  const chk = await api("POST", `/api/exams/attempts/${b1}/check`, { as: V1, body: { questionId: PR.mc } });
  check("/check: suspended → 403 enrollment_suspended", chk.status === 403 && chk.json?.code === "enrollment_suspended", chk.json);
  check("/check: JSON không lộ đáp án đúng", !/correctOptionIds|correctOptionId|isCorrect/.test(JSON.stringify(chk.json)), chk.json);
  const rev0 = await api("POST", `/api/exams/attempts/${b1}/check`, { as: V1, body: { questionId: PR.mc, action: "reveal" } });
  check("/check reveal: suspended → 403", rev0.status === 403 && rev0.json?.code === "enrollment_suspended", rev0.json);
  const getSus = await api("GET", `/api/exams/attempts/${b1}`, { as: V1 });
  check("GET lượt dở: suspended → 403 thông điệp KiN, không có questions", susView(getSus) && !("questions" in (getSus.json ?? {})), getSus.json);
  check("GET lượt dở: người lạ vẫn 404, chưa đăng nhập 401", (await api("GET", `/api/exams/attempts/${b1}`, { as: V2 })).status === 404 && (await api("GET", `/api/exams/attempts/${b1}`)).status === 401);
  await activeV(V1);
  check("mở lại → GET lượt dở 200", (await api("GET", `/api/exams/attempts/${b1}`, { as: V1 })).status === 200);

  section("review / correction của bài ĐÃ NỘP");
  const c2 = await start(V2, "sus-lop");
  await api("PATCH", `/api/exams/attempts/${c2}/answer`, { as: V2, body: { questionId: E.mc, optionId: "sus-lop-no" } });
  check("V2 nộp bài", (await api("POST", `/api/exams/attempts/${c2}/submit`, { as: V2 })).status === 200);
  check("trước khi nghỉ lớp: review 200", (await api("GET", `/api/exams/attempts/${c2}/review`, { as: V2 })).status === 200);
  check("trước khi nghỉ lớp: correction GET 200", (await api("GET", `/api/exams/attempts/${c2}/correction`, { as: V2 })).status === 200);
  await suspendV(V2);
  const rv = await api("GET", `/api/exams/attempts/${c2}/review`, { as: V2 });
  check("review: suspended → 403 enrollment_suspended", susView(rv), rv.json);
  check("review: JSON không chứa câu hỏi/đáp án/điểm", !/questions|isCorrect|explanation|score/.test(JSON.stringify(rv.json)), rv.json);
  const cg = await api("GET", `/api/exams/attempts/${c2}/correction`, { as: V2 });
  check("correction GET: suspended → 403", susView(cg), cg.json);
  const cp = await api("POST", `/api/exams/attempts/${c2}/correction/${E.mc}`, { as: V2, body: { action: "reveal" } });
  check("correction POST: suspended → 403 (không lộ đáp án)", susView(cp) && !/correctOption|explanation/.test(JSON.stringify(cp.json)), cp.json);
  check("review của người khác: vẫn 404", (await api("GET", `/api/exams/attempts/${c2}/review`, { as: V3 })).status === 404);
  await activeV(V2);
  check("mở lại → review 200", (await api("GET", `/api/exams/attempts/${c2}/review`, { as: V2 })).status === 200);
  const cpOk = await api("POST", `/api/exams/attempts/${c2}/correction/${E.mc}`, { as: V2, body: { action: "reveal" } });
  check("mở lại → correction POST không còn là enrollment_suspended", cpOk.json?.code !== "enrollment_suspended" && cpOk.status !== 401, cpOk.json);

  section("GET /api/student/de-thi và /gate");
  const list1 = await api("GET", "/api/student/de-thi", { as: V2 });
  check("còn học: thấy đề sus-lop (em đã làm)", (list1.json?.items ?? []).some((i: any) => i.id === "sus-lop"), list1.json);
  await suspendV(V2);
  const list2 = await api("GET", "/api/student/de-thi", { as: V2 });
  check("nghỉ lớp: KHÔNG liệt kê đề của lớp (kể cả đề đã làm)", list2.status === 200 && !(list2.json?.items ?? []).some((i: any) => ["sus-lop", "sus-luyen", "sus-thu-phi"].includes(i.id)), list2.json);
  const listPub = await api("GET", "/api/student/de-thi", { as: S5 });
  check("đề không gắn lớp em đã làm vẫn liệt kê", (listPub.json?.items ?? []).some((i: any) => i.id === "sus-cong-khai"), listPub.json);
  const g1 = await api("GET", "/api/exams/sus-lop/gate", { as: V2 });
  check("gate: suspended → blockReason enrollment_suspended, canStart false", g1.status === 200 && g1.json?.blockReason === "enrollment_suspended" && g1.json?.canStart === false, g1.json);
  check("gate: đề thu phí + suspended → enrollment_suspended (không phải payment_required)", (await api("GET", "/api/exams/sus-thu-phi/gate", { as: V2 })).json?.blockReason === "enrollment_suspended");
  const NE = await mk("Em Chín");
  check("gate: chưa ghi danh vẫn not_enrolled", (await api("GET", "/api/exams/sus-lop/gate", { as: NE })).json?.blockReason === "not_enrolled");
  check("gate: đề thu phí chưa ghi danh vẫn payment_required", (await api("GET", "/api/exams/sus-thu-phi/gate", { as: NE })).json?.blockReason === "payment_required");
  check("gate: active → canStart", (await api("GET", "/api/exams/sus-lop/gate", { as: V3 })).json?.canStart === true);

  section("POST /start với học sinh nghỉ lớp");
  const st1 = await api("POST", "/api/exams/sus-lop/start", { as: V2, body: {} });
  check("start đề MIỄN PHÍ: 403 enrollment_suspended + thông điệp KiN", susView(st1), st1.json);
  const st2 = await api("POST", "/api/exams/sus-thu-phi/start", { as: V2, body: {} });
  check("start đề THU PHÍ: 403 enrollment_suspended (không phải 402)", susView(st2), st2.json);
  const st3 = await api("POST", "/api/exams/sus-lop/start", { as: NE, body: {} });
  check("chưa ghi danh vẫn 403 'chỉ dành cho học viên đã ghi danh'", st3.status === 403 && st3.json?.code !== "enrollment_suspended" && /ghi danh/.test(st3.json?.error ?? ""), st3.json);
  const st4 = await api("POST", "/api/exams/sus-thu-phi/start", { as: NE, body: {} });
  check("chưa ghi danh đề thu phí vẫn 402", st4.status === 402, st4.json);
  await prisma.examGuestAccess.create({ data: { userId: V2.id, examId: "sus-thu-phi", grantedBy: T.id } });
  const st5 = await api("POST", "/api/exams/sus-thu-phi/start", { as: V2, body: {} });
  check("đề thu phí + quyền khách gia sư duyệt tay → vào được dù nghỉ lớp (đường cũ)", st5.status === 200, st5.json);
  check("start đề không gắn lớp: không bị chặn", (await api("POST", "/api/exams/sus-cong-khai/start", { as: V2, body: {} })).status === 200);
  check("start khi active: 200", (await api("POST", "/api/exams/sus-lop/start", { as: V3, body: {} })).status === 200);
  check("khách chưa đăng nhập: start/gate/de-thi 401", (await api("POST", "/api/exams/sus-lop/start", { body: {} })).status === 401 && (await api("GET", "/api/exams/sus-lop/gate")).status === 401 && (await api("GET", "/api/student/de-thi")).status === 401);
  const stT = await api("POST", "/api/exams/sus-lop/start", { as: T, body: {} });
  check("gia sư chủ lớp: cổng không coi là nghỉ lớp (giữ hành vi cũ)", stT.json?.code !== "enrollment_suspended", stT.json);
  const AD = await mkSuper("Quản trị");
  check("admin: gate đề lớp không báo enrollment_suspended", (await api("GET", "/api/exams/sus-lop/gate", { as: AD })).json?.blockReason !== "enrollment_suspended");
  check("admin: de-thi 200", (await api("GET", "/api/student/de-thi", { as: AD })).status === 200);

  section("Bị xoá hẳn khỏi lớp (không còn bản ghi ghi danh): chặn XEM và GHI, thông điệp đúng, không nói 'tạm dừng'");
  const removeV = (u: typeof S1) => prisma.enrollment.delete({ where: { userId_courseId: { userId: u.id, courseId: C.id } } });
  const leftView = (r: { status: number; json: any }) => r.status === 403 && r.json?.code === "enrollment_removed" && r.json?.error === ATTEMPT_LEFT_CLASS_MESSAGE;
  const [R1, R2] = [await mk("Em Mười"), await mk("Em Mười Một")];
  for (const u of [R1, R2]) await prisma.enrollment.create({ data: { userId: u.id, courseId: C.id, status: "active" } });
  const r1 = await start(R1, "sus-luyen");
  await api("PATCH", `/api/exams/attempts/${r1}/answer`, { as: R1, body: { questionId: PR.mc, optionId: PR.ok } });
  const r2 = await start(R2, "sus-lop");
  await api("PATCH", `/api/exams/attempts/${r2}/answer`, { as: R2, body: { questionId: E.mc, optionId: "sus-lop-no" } });
  check("R2 nộp bài khi còn trong lớp", (await api("POST", `/api/exams/attempts/${r2}/submit`, { as: R2 })).status === 200);
  await removeV(R1); await removeV(R2);
  check("đã xoá ghi danh thật sự (không còn bản ghi)", (await prisma.enrollment.count({ where: { userId: { in: [R1.id, R2.id] }, courseId: C.id } })) === 0);
  const gOpen = await api("GET", `/api/exams/attempts/${r1}`, { as: R1 });
  check("GET lượt dở: không còn ghi danh → 403 thông điệp 'không còn trong lớp', không có questions", leftView(gOpen) && !("questions" in (gOpen.json ?? {})), gOpen.json);
  check("thông điệp XEM khác hẳn thông điệp nghỉ lớp", gOpen.json?.error !== ATTEMPT_SUSPENDED_MESSAGE && !/nghỉ lớp/.test(gOpen.json?.error ?? ""), gOpen.json);
  const rvL = await api("GET", `/api/exams/attempts/${r2}/review`, { as: R2 });
  check("review: không còn ghi danh → 403 'không còn trong lớp'", leftView(rvL) && !/questions|isCorrect|explanation|score/.test(JSON.stringify(rvL.json)), rvL.json);
  const cgL = await api("GET", `/api/exams/attempts/${r2}/correction`, { as: R2 });
  check("correction GET: không còn ghi danh → 403", leftView(cgL), cgL.json);
  const cpL = await api("POST", `/api/exams/attempts/${r2}/correction/${E.mc}`, { as: R2, body: { action: "reveal" } });
  check("correction POST: không còn ghi danh → 403, không lộ đáp án", leftView(cpL) && !/correctOption|explanation/.test(JSON.stringify(cpL.json)), cpL.json);
  const listL = await api("GET", "/api/student/de-thi", { as: R2 });
  check("de-thi: không còn ghi danh → KHÔNG liệt kê đề của lớp dù đã làm", listL.status === 200 && !(listL.json?.items ?? []).some((i: any) => ["sus-lop", "sus-luyen", "sus-thu-phi"].includes(i.id)), listL.json);
  const wAns = await api("PATCH", `/api/exams/attempts/${r1}/answer`, { as: R1, body: { questionId: PR.mc, optionId: PR.ok } });
  check("answer: không còn ghi danh → 403, thông điệp GHI không nói 'tạm dừng'", wAns.status === 403 && wAns.json?.error === ATTEMPT_LEFT_CLASS_BLOCKED_MESSAGE && !/tạm dừng/.test(wAns.json?.error ?? ""), wAns.json);
  const wSub = await api("POST", `/api/exams/attempts/${r1}/submit`, { as: R1 });
  check("submit: không còn ghi danh → 403, lượt không bị chấm", wSub.status === 403 && !/tạm dừng/.test(wSub.json?.error ?? "") && (await prisma.examAttempt.findUnique({ where: { id: r1 } }))?.status === "in_progress", wSub.json);
  const wChk = await api("POST", `/api/exams/attempts/${r1}/check`, { as: R1, body: { questionId: PR.mc } });
  check("/check: không còn ghi danh → 403, không lộ đáp án", wChk.status === 403 && !/tạm dừng/.test(wChk.json?.error ?? "") && !/correctOptionIds|correctOptionId|isCorrect/.test(JSON.stringify(wChk.json)), wChk.json);
  check("người lạ vẫn 404 (không lộ lượt)", (await api("GET", `/api/exams/attempts/${r1}`, { as: R2 })).status === 404);

  section("ĐIỂM của lượt ĐÃ NỘP giữ nguyên cho học sinh nghỉ lớp / bị xoá ghi danh (lịch sử điểm của chính em; vẫn không có questions)");
  for (const [who, att] of [["V2 (suspended)", { u: V2, id: c2 }], ["R2 (bị xoá ghi danh)", { u: R2, id: r2 }]] as const) {
    const g = await api("GET", `/api/exams/attempts/${att.id}`, { as: att.u });
    check(`${who}: GET lượt đã nộp → 200, status submitted, có score + totalPoints`, g.status === 200 && g.json?.status === "submitted" && "score" in (g.json ?? {}) && typeof g.json?.totalPoints === "number", g.json);
    check(`${who}: không có câu hỏi/đáp án trong JSON`, !/questions|isCorrect|correctOption|explanation/.test(JSON.stringify(g.json)), g.json);
  }
  done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
