// BU-03 P3 — API Giao đề: GET/PATCH/POST /api/tutor/de-thi/[id]/giao. Cần máy chủ dev (BASE) + DB RIÊNG; wipe() ở đầu bài.
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-assign.ts
// Điều phải chứng minh: (1) giá/khách bị 400 FORBIDDEN_FIELD và KHÔNG ghi gì; (2) mật khẩu KHÔNG BAO GIỜ trả về (GET/PATCH, không thô, không băm) và chỉ lưu dạng băm;
// (3) QuizAttemptLimit upsert/xoá đúng, đồng bộ sang mọi mã con; (4) đã có lượt làm → chế độ/lớp/thời lượng bị khoá 409 HAS_ATTEMPTS nhưng mật khẩu/số lần/đáp án vẫn đổi được;
// (5) mặc định theo chế độ chỉ áp khi ĐỔI chế độ; (6) đóng/mở lại nguyên tử cả nhóm; (7) mã con 400 IS_VARIANT.
// Ca phá bằng thiết kế (sửa mã → đúng ca đó đỏ): bỏ FORBIDDEN_FIELDS → ca price/activeGuest/guestCanTake đỏ (và DB đổi); trả view có passwordHash → ca "không lộ" đỏ;
//   LOCKED_WHEN_ATTEMPTS bỏ mode → ca HAS_ATTEMPTS(mode) đỏ; chặn cả khi gửi lại ĐÚNG giá trị cũ → ca "gửi lại cùng giá trị vô hại" đỏ;
//   áp mặc định mỗi lần PATCH mode → ca "gửi lại cùng chế độ không đè visibility" đỏ; updateMany bỏ → ca đồng bộ mã con đỏ.
import { api, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { verifyExamPassword, MAX_EXAM_PASSWORD_LEN } from "@/lib/examPassword";
import { AUDIENCE_LINK_READY } from "@/lib/deThiAssign";
import { mkActors, mkDraft, mkPublished, snap } from "./bu03";

const G = (id: string) => `/api/tutor/de-thi/${id}/giao`;
const MD = (id: string) => `/api/tutor/de-thi/${id}/ma-de`;
const row = (id: string) => prisma.exam.findUniqueOrThrow({ where: { id } });
const limit = (id: string) => prisma.quizAttemptLimit.findUnique({ where: { examId: id } });

(async () => {
  await wipe();
  const a = await mkActors();
  const { A, B, S, courseA } = a;
  const courseA2 = await mkCourse(A.id, { name: "Lớp thứ hai của A" });
  const D = await mkDraft(A, { n: 3, courseId: courseA.id });

  section("GET giao: cấu hình hiện tại, không lộ mật khẩu / giá / quyền khách");
  {
    const g = await api("GET", G(D), { as: A });
    const v = g.json;
    check("200 + đủ khoá: mode,courseId,dateKey,time,durationMin,hasPassword,maxAttempts,answerVisibility,hideAnswerForWrong,showLeaderboard,holdUntilPublish,status,variants,attemptCount",
      g.status === 200 && ["mode", "courseId", "dateKey", "time", "durationMin", "hasPassword", "maxAttempts", "answerVisibility", "hideAnswerForWrong", "showLeaderboard", "holdUntilPublish", "status", "variants", "attemptCount"].every(k => k in v), Object.keys(v ?? {}));
    check("đề mới: chưa có chế độ (mode null), 15 phút, 19:00, ngày hôm nay, chưa mật khẩu, chưa giới hạn lần, status 'draft', 0 lượt", v.mode === null && v.durationMin === 15 && v.time === "19:00" && /^\d{4}-\d{2}-\d{2}$/.test(v.dateKey) && v.hasPassword === false && v.maxAttempts === null && v.status === "draft" && v.attemptCount === 0, v);
    check("variants: chỉ mã gốc { id: D, variantNo: 1, code: 101 }", v.variants?.length === 1 && v.variants[0].id === D && v.variants[0].code === 101);
    check("JSON KHÔNG có các khoá password / passwordHash / price / activeGuest / guestCanTake", !/"(password|passwordHash|price|activeGuest|guestCanTake)"/.test(g.text), g.text);
    check("Cache-Control: no-store", /no-store/.test(g.headers.get("cache-control") ?? ""));
  }

  section("PATCH giao: giá và quyền khách bị TỪ CHỐI 400 FORBIDDEN_FIELD, không ghi gì");
  {
    const s0 = await snap();
    for (const body of [{ price: 100000 }, { price: 0 }, { price: null }, { activeGuest: true }, { guestCanTake: true }, { mode: "practice", price: 1000 }, { time: "20:00", activeGuest: false }]) {
      const r = await api("PATCH", G(D), { as: A, body });
      check(`${JSON.stringify(body)} → 400 FORBIDDEN_FIELD`, r.status === 400 && r.json?.code === "FORBIDDEN_FIELD", [r.status, r.json]);
    }
    check("sau cả loạt: DB y nguyên — kể cả khoá HỢP LỆ đi kèm (mode, time) không bị áp một nửa", (await snap()) === s0);
    const e = await row(D);
    check("đề vẫn price = null, không mở cho khách", e.price === null && e.activeGuest === false && e.guestCanTake === false);
  }

  section("PATCH giao: kiểm giá trị");
  {
    const s0 = await snap();
    const bad = async (label: string, body: unknown, code: string, status = 400) => {
      const r = await api("PATCH", G(D), { as: A, body });
      check(`${label} → ${status} ${code}`, r.status === status && r.json?.code === code, [r.status, r.json]);
    };
    await bad("khoá lạ", { colour: "red" }, "UNKNOWN_FIELD");
    await bad("thân rỗng {}", {}, "EMPTY");
    await bad("thân là mảng", [], "BAD_BODY");
    await bad("mode lạ", { mode: "exam" }, "BAD_MODE");
    await bad("mode = null", { mode: null }, "BAD_MODE");
    await bad("ngày 2026-13-45", { dateKey: "2026-13-45" }, "BAD_DATE");
    await bad("ngày sai dạng 24/10/2026", { dateKey: "24/10/2026" }, "BAD_DATE");
    await bad("giờ 25:00", { time: "25:00" }, "BAD_TIME");
    await bad("thời lượng 0", { durationMin: 0 }, "BAD_DURATION");
    await bad("thời lượng 301", { durationMin: 301 }, "BAD_DURATION");
    await bad("thời lượng 1.5", { durationMin: 1.5 }, "BAD_DURATION");
    await bad("thời lượng dạng chữ '15'", { durationMin: "15" }, "BAD_DURATION");
    await bad("mật khẩu là số", { password: 1234 }, "BAD_PASSWORD");
    await bad(`mật khẩu dài ${MAX_EXAM_PASSWORD_LEN + 1} ký tự`, { password: "x".repeat(MAX_EXAM_PASSWORD_LEN + 1) }, "BAD_PASSWORD");
    await bad("số lần 0", { maxAttempts: 0 }, "BAD_ATTEMPTS");
    await bad("số lần 21", { maxAttempts: 21 }, "BAD_ATTEMPTS");
    await bad("số lần 1.5", { maxAttempts: 1.5 }, "BAD_ATTEMPTS");
    await bad("số lần dạng chữ '2'", { maxAttempts: "2" }, "BAD_ATTEMPTS");
    await bad("cách hiện đáp án lạ", { answerVisibility: "always" }, "BAD_VISIBILITY");
    await bad("cờ không phải boolean ('true')", { showLeaderboard: "true" }, "BAD_FLAG");
    await bad("holdUntilPublish = 1", { holdUntilPublish: 1 }, "BAD_FLAG");
    await bad("courseId là số", { courseId: 5 }, "BAD_COURSE");
    const rb = await api("PATCH", G(D), { as: A, body: { courseId: a.courseB.id } });
    check("lớp của gia sư KHÁC → 403 NOT_YOUR_CLASS", rb.status === 403 && rb.json?.code === "NOT_YOUR_CLASS", [rb.status, rb.json]);
    check("lớp không có → 404", (await api("PATCH", G(D), { as: A, body: { courseId: "khong-co-lop" } })).status === 404);
    check("thân không phải JSON → 400 BAD_BODY", (await api("PATCH", G(D), { as: A, raw: "{hỏng", headers: { "content-type": "application/json" } })).json?.code === "BAD_BODY");
    check("mọi ca lỗi trên: DB y nguyên", (await snap()) === s0);
  }

  section("Mặc định theo chế độ — chỉ áp khi ĐỔI chế độ; khoá gửi rõ ràng luôn thắng");
  {
    const p = await api("PATCH", G(D), { as: A, body: { mode: "practice" } });
    let e = await row(D);
    check("practice: 200, mode=practice, đáp án 'after_submit', không giấu đáp án sai, không bảng xếp hạng, không giới hạn lần", p.status === 200 && p.json?.mode === "practice" && e.mode === "practice" && e.answerVisibility === "after_submit" && e.hideAnswerForWrong === false && e.showLeaderboard === false && (await limit(D)) === null, [p.status, p.json]);
    const t = await api("PATCH", G(D), { as: A, body: { mode: "test" } });
    e = await row(D);
    check("đổi sang test: 1 lần làm (QuizAttemptLimit = 1), đáp án 'after_exam_ends', giấu đáp án sai", t.status === 200 && (await limit(D))?.maxAttempts === 1 && e.answerVisibility === "after_exam_ends" && e.hideAnswerForWrong === true && t.json?.maxAttempts === 1, [t.status, t.json]);
    const back = await api("PATCH", G(D), { as: A, body: { mode: "practice", maxAttempts: 3, answerVisibility: "never" } });
    e = await row(D);
    check("đổi lại practice kèm maxAttempts=3, answerVisibility='never' GỬI RÕ → khoá gửi rõ thắng mặc định (3 lần, 'never'), phần còn lại theo practice", back.status === 200 && (await limit(D))?.maxAttempts === 3 && e.answerVisibility === "never" && e.hideAnswerForWrong === false, [back.status, back.json]);
    const same = await api("PATCH", G(D), { as: A, body: { mode: "practice" } });
    e = await row(D);
    check("gửi lại CÙNG chế độ không đè lại mặc định (vẫn 'never' và 3 lần)", same.status === 200 && e.answerVisibility === "never" && (await limit(D))?.maxAttempts === 3);
    const none = await api("PATCH", G(D), { as: A, body: { maxAttempts: null } });
    check("maxAttempts=null → XOÁ giới hạn (không còn dòng QuizAttemptLimit)", none.status === 200 && (await limit(D)) === null && none.json?.maxAttempts === null);
  }

  section("Kiểm tra cần đủ ngày, giờ, thời lượng → 400 NEED_SCHEDULE; luyện tập thì bỏ qua ô rỗng");
  {
    const s0 = await snap();
    for (const body of [{ mode: "test", time: "" }, { mode: "test", dateKey: "" }, { mode: "test", durationMin: null }, { mode: "test", time: null }]) {
      const r = await api("PATCH", G(D), { as: A, body });
      check(`${JSON.stringify(body)} → 400 NEED_SCHEDULE`, r.status === 400 && r.json?.code === "NEED_SCHEDULE", [r.status, r.json]);
    }
    check("các ca NEED_SCHEDULE không ghi gì (chế độ vẫn practice)", (await snap()) === s0 && (await row(D)).mode === "practice");
    const ok = await api("PATCH", G(D), { as: A, body: { mode: "test", dateKey: "2030-05-06", time: "7:05", durationMin: 45 } });
    const e = await row(D);
    check("ĐỐI CHỨNG: test đủ ngày giờ thời lượng → 200; ngày lưu dd/mm/yyyy, giờ chuẩn hoá '07:05', thời lượng 45 phút", ok.status === 200 && e.date === "06/05/2030" && e.time === "07:05" && ok.json?.durationMin === 45, [ok.status, e.date, e.time, ok.json?.durationMin]);
    const pr = await api("PATCH", G(D), { as: A, body: { mode: "practice", time: "" } });
    check("practice + giờ rỗng → 200 và giữ giờ cũ (cột không nhận rỗng)", pr.status === 200 && (await row(D)).time === "07:05", [pr.status, pr.json]);
    const past = await api("PATCH", G(D), { as: A, body: { dateKey: "2020-01-01" } });
    check("ngày đã qua → 200 kèm cảnh báo PAST_DATE (vẫn lưu)", past.status === 200 && past.json?.warnings?.some((w: any) => w.code === "PAST_DATE") && past.json.dateKey === "2020-01-01", [past.status, past.json?.warnings]);
  }

  section("Mật khẩu: chỉ lưu dạng băm, KHÔNG BAO GIỜ trả về (GET, PATCH, không hash, không thô)");
  {
    const secret = "Bi mat 123!";
    const p = await api("PATCH", G(D), { as: A, body: { password: `  ${secret}  ` } });
    const e = await row(D);
    check("PATCH → 200, hasPassword = true", p.status === 200 && p.json?.hasPassword === true, [p.status, p.json]);
    check("DB: cột password thô = null; passwordHash có (dài, không bằng chữ thô)", e.password === null && !!e.passwordHash && e.passwordHash.length > 20 && e.passwordHash !== secret);
    check("băm khớp mật khẩu ĐÃ CẮT khoảng trắng (không phải bản có dấu cách), và sai mật khẩu thì không khớp", (await verifyExamPassword({ password: e.password, passwordHash: e.passwordHash }, secret)).ok === true && (await verifyExamPassword({ password: null, passwordHash: e.passwordHash }, "sai")).ok === false);
    const g = await api("GET", G(D), { as: A });
    const hash = e.passwordHash ?? "";
    for (const [label, r] of [["PATCH", p], ["GET", g]] as const) {
      check(`${label}: phản hồi không chứa mật khẩu thô, không chứa giá trị băm, không có khoá password/passwordHash`, !r.text.includes("Bi mat 123") && !r.text.includes(hash) && !/"password(Hash)?"/.test(r.text), r.text.slice(0, 300));
    }
    const wrong = await api("PATCH", G(D), { as: A, body: { password: "   " } });
    check("mật khẩu toàn dấu cách → coi là BỎ mật khẩu (hasPassword false, hash null)", wrong.status === 200 && wrong.json?.hasPassword === false && (await row(D)).passwordHash === null);
    await api("PATCH", G(D), { as: A, body: { password: "lai-dat" } });
    const clear = await api("PATCH", G(D), { as: A, body: { password: null } });
    check("password=null → bỏ mật khẩu", clear.status === 200 && clear.json?.hasPassword === false && (await row(D)).passwordHash === null);
    const exam = await api("GET", `/api/exams/${D}`, { as: A });
    await api("PATCH", G(D), { as: A, body: { password: "lai-dat-2" } });
    const exam2 = await api("GET", `/api/exams/${D}`, { as: A });
    check("đường API chung GET /api/exams/[id] cũng không lộ băm/thô của mật khẩu vừa đặt", exam.status === 200 && !exam2.text.includes("lai-dat-2") && !exam2.text.includes((await row(D)).passwordHash ?? "@@") && /"hasPassword":true/.test(exam2.text), exam2.text.slice(0, 200));
  }

  section("Đồng bộ nhóm mã đề + QuizAttemptLimit cho mọi mã");
  {
    const V = await mkDraft(A, { n: 4, courseId: courseA.id });
    await api("POST", MD(V), { as: A, body: { count: 3 } });
    const kids = await prisma.exam.findMany({ where: { variantOfId: V }, orderBy: { variantNo: "asc" } });
    const ids = [V, ...kids.map(k => k.id)];
    const r = await api("PATCH", G(V), { as: A, body: { mode: "test", dateKey: "2031-02-03", time: "20:15", durationMin: 50, password: "chung-nhom", maxAttempts: 2, answerVisibility: "after_submit", showLeaderboard: true } });
    check("PATCH đề gốc có 2 mã con → 200; view.variants = 3 mã (101..103)", r.status === 200 && r.json?.variants?.map((x: any) => x.code).join() === "101,102,103", [r.status, r.json?.variants]);
    const rows = await Promise.all(ids.map(row));
    check("MỌI mã (gốc + 2 con) cùng chế độ, ngày, giờ, thời lượng, đáp án, bảng xếp hạng", rows.every(e => e.mode === "test" && e.date === "03/02/2031" && e.time === "20:15" && e.duration === rows[0].duration && e.answerVisibility === "after_submit" && e.showLeaderboard === true), rows.map(e => [e.mode, e.date, e.time]));
    check("MỌI mã cùng một passwordHash (học sinh nhập một mật khẩu cho mọi mã)", rows.every(e => !!e.passwordHash && e.passwordHash === rows[0].passwordHash && e.password === null));
    check("QuizAttemptLimit = 2 cho CẢ 3 mã (upsert, không nhân dòng)", (await prisma.quizAttemptLimit.findMany({ where: { examId: { in: ids } } })).length === 3 && (await Promise.all(ids.map(limit))).every(l => l?.maxAttempts === 2));
    await api("PATCH", G(V), { as: A, body: { maxAttempts: 5 } });
    check("sửa maxAttempts 2→5: vẫn 3 dòng (upsert), cả ba = 5", (await prisma.quizAttemptLimit.count({ where: { examId: { in: ids } } })) === 3 && (await Promise.all(ids.map(limit))).every(l => l?.maxAttempts === 5));
    await api("PATCH", G(V), { as: A, body: { maxAttempts: null } });
    check("maxAttempts=null: xoá dòng của cả 3 mã", (await prisma.quizAttemptLimit.count({ where: { examId: { in: ids } } })) === 0);
    const h = await api("PATCH", G(V), { as: A, body: { holdUntilPublish: true } });
    check("holdUntilPublish=true: view báo true; ExamPublishPolicy có dòng cho cả 3 mã", h.json?.holdUntilPublish === true && (await prisma.examPublishPolicy.count({ where: { examId: { in: ids } } })) === 3, h.json?.holdUntilPublish);
    const kid = kids[0].id;
    const ck = [await api("GET", G(kid), { as: A }), await api("PATCH", G(kid), { as: A, body: { time: "08:00" } }), await api("POST", G(kid), { as: A, body: { action: "close" } })];
    check("GET/PATCH/POST giao trên MÃ CON → 400 IS_VARIANT kèm variantOfId", ck.every(x => x.status === 400 && x.json?.code === "IS_VARIANT" && x.json?.variantOfId === V), ck.map(x => [x.status, x.json?.code]));
    check("PATCH bị từ chối ở mã con không đổi giờ của con", (await row(kid)).time === "20:15");
  }

  section("Gửi lại nguyên đối tượng GET: các khoá chỉ-đọc bị bỏ qua, không lỗi");
  {
    const E = await mkDraft(A, { n: 2, courseId: courseA.id });
    await api("PATCH", G(E), { as: A, body: { mode: "practice" } });
    const view = (await api("GET", G(E), { as: A })).json;
    const echo = await api("PATCH", G(E), { as: A, body: view });
    check("PATCH với chính đối tượng GET (có hasPassword/status/variants/attemptCount) → 200, không UNKNOWN_FIELD", echo.status === 200, [echo.status, echo.json]);
    const withOwn = await api("PATCH", G(E), { as: A, body: { ...view, hasPassword: true, status: "available", variants: [], attemptCount: 99 } });
    check("sửa giá trị khoá chỉ-đọc không có tác dụng (hasPassword vẫn false, attemptCount vẫn 0)", withOwn.status === 200 && withOwn.json?.hasPassword === false && withOwn.json?.attemptCount === 0, withOwn.json);
  }

  section("Đã có lượt làm: khoá chế độ / lớp / thời lượng (409 HAS_ATTEMPTS); mật khẩu, số lần, đáp án vẫn đổi được");
  {
    const P = await mkPublished(A, courseA.id, { n: 3, title: "Đề đã có lượt làm" });
    await api("PATCH", G(P), { as: A, body: { mode: "practice" } });
    await prisma.examAttempt.create({ data: { userId: S.id, examId: P, expiresAt: new Date(Date.now() + 3_600_000), status: "submitted", submittedAt: new Date(), score: 2, totalPoints: 6 } });
    const before = await row(P);
    const g = await api("GET", G(P), { as: A });
    check("GET báo attemptCount = 1, status mở", g.json?.attemptCount === 1 && ["available", "upcoming"].includes(g.json?.status), g.json);
    const locked = async (label: string, body: unknown) => {
      const r = await api("PATCH", G(P), { as: A, body });
      check(`${label} → 409 HAS_ATTEMPTS`, r.status === 409 && r.json?.code === "HAS_ATTEMPTS", [r.status, r.json]);
    };
    await locked("đổi chế độ practice→test", { mode: "test" });
    await locked("đổi lớp", { courseId: courseA2.id });
    await locked("đổi thời lượng 15→20", { durationMin: 20 });
    await locked("xoá thời lượng (null)", { durationMin: null });
    const after = await row(P);
    check("cả 4 ca khoá: chế độ, lớp, thời lượng KHÔNG đổi", after.mode === before.mode && after.courseId === before.courseId && after.duration === before.duration);
    const same = await api("PATCH", G(P), { as: A, body: { mode: "practice", courseId: courseA.id, durationMin: 15 } });
    check("gửi lại ĐÚNG giá trị cũ của chế độ/lớp/thời lượng → 200 (vô hại, không bị khoá)", same.status === 200, [same.status, same.json]);
    const okF = await api("PATCH", G(P), { as: A, body: { password: "doi-khi-co-luot", maxAttempts: 2, answerVisibility: "never", showLeaderboard: true, hideAnswerForWrong: true, holdUntilPublish: true } });
    check("vẫn đổi được: mật khẩu, số lần, cách hiện đáp án, bảng xếp hạng, giữ điểm", okF.status === 200 && okF.json?.hasPassword === true && okF.json?.maxAttempts === 2 && okF.json?.answerVisibility === "never", [okF.status, okF.json]);
    const pastOk = await api("PATCH", G(P), { as: A, body: { dateKey: "2019-01-01" } });
    check("ngày quá khứ khi đã có lượt làm: 200 và KHÔNG cảnh báo PAST_DATE (cảnh báo chỉ khi chưa ai làm)", pastOk.status === 200 && !(pastOk.json?.warnings ?? []).some((w: any) => w.code === "PAST_DATE"), pastOk.json?.warnings);

    section("Đóng / mở lại cả nhóm mã đề");
    const cl = await api("POST", G(P), { as: A, body: { action: "close" } });
    check("close → 200 và đề không còn active", cl.status === 200 && (await row(P)).active === false);
    const cl2 = await api("POST", G(P), { as: A, body: { action: "close" } });
    check("close lần hai → 200 (lặp lại là không-làm-gì)", cl2.status === 200);
    const logs0 = await prisma.examChangeLog.count({ where: { examId: P } });
    await api("POST", G(P), { as: A, body: { action: "close" } });
    check("lặp lại close không ghi thêm nhật ký", (await prisma.examChangeLog.count({ where: { examId: P } })) === logs0);
    const re = await api("POST", G(P), { as: A, body: { action: "reopen" } });
    check("reopen → 200 và active trở lại", re.status === 200 && (await row(P)).active === true);
    check("nhật ký có 'Đóng bài' và 'Mở lại bài'", (await prisma.examChangeLog.count({ where: { examId: P, note: { in: ["Đóng bài", "Mở lại bài"] } } })) === 2);
    check("action lạ → 400 BAD_ACTION", (await api("POST", G(P), { as: A, body: { action: "delete" } })).json?.code === "BAD_ACTION" && (await api("POST", G(P), { as: A, body: {} })).json?.code === "BAD_ACTION");
    const draft = await api("POST", G(D), { as: A, body: { action: "close" } });
    check("đóng đề còn NHÁP → 409 NOT_PUBLISHED", draft.status === 409 && draft.json?.code === "NOT_PUBLISHED", [draft.status, draft.json]);
  }

  section("Giao theo link (bỏ lớp) chưa mở khi đề đã phát hành — cờ AUDIENCE_LINK_READY");
  {
    const P2 = await mkPublished(A, courseA.id, { n: 2 });
    const r = await api("PATCH", G(P2), { as: A, body: { courseId: null } });
    if (!AUDIENCE_LINK_READY) check("đề đã phát hành, bỏ lớp → 422 AUDIENCE_LINK_NOT_READY và lớp không đổi", r.status === 422 && r.json?.code === "AUDIENCE_LINK_NOT_READY" && (await row(P2)).courseId === courseA.id, [r.status, r.json]);
    else check("cờ AUDIENCE_LINK_READY = true: bỏ lớp được (200)", r.status === 200, [r.status, r.json]);
    const Dr = await mkDraft(A, { n: 2, courseId: courseA.id });
    const rd = await api("PATCH", G(Dr), { as: A, body: { courseId: null } });
    check("ĐỐI CHỨNG: đề còn NHÁP thì bỏ lớp được (200)", rd.status === 200 && (await row(Dr)).courseId === null, [rd.status, rd.json]);
  }

  section("Gia sư khác (đầy đủ ở t-bu03-quyen)");
  {
    const X = await mkDraft(A, { n: 2, courseId: courseA.id });
    const s0 = await snap();
    const r = [await api("PATCH", G(X), { as: B, body: { mode: "practice" } }), await api("GET", G(X), { as: B }), await api("POST", G(X), { as: B, body: { action: "close" } })];
    check("B trên đề của A: PATCH/GET/POST đều 403 và không ghi gì", r.every(x => x.status === 403) && (await snap()) === s0, r.map(x => x.status));
  }

  await done();
})().catch(e => { console.error(e); process.exit(1); });
