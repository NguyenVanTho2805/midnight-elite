// BU-04 — KẺ TẤN CÔNG THEO VAI: khách / học sinh khác lớp / học sinh B dùng lượt của A / học sinh gọi API & trang của gia sư-quản trị; đề nháp & mã con không lọt payload.
// 1) khách: api/student/de-thi và mọi route lượt thi → 401/403.  2) học sinh gọi API quản trị đề → 401/403.  3) B dùng attemptId của A → 404 (không đọc/ghi/nộp được).
// 4) trang: học sinh mở /lop-cua-toi/de-thi, /lop-cua-toi/quan-lop, /admin/* bị chuyển đi (trang (tutor) redirect = 200 + NEXT_REDIRECT); khách mở /student/* xem ui-exam-guest-redirect.ts.
// 5) đề nháp + mã con + đề giao-theo-link (của lớp khác) KHÔNG xuất hiện ở GET /api/exams, /api/student/de-thi, /api/schedule (học sinh ngoài lớp); gate/start đề nháp → không vào được; gate mã con không có variantNo.
// Cần máy chủ dev (BASE) + DB RIÊNG; wipe() ở đầu bài. Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-exam-roles-attack.ts
import { api, mkTutor, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { minutesFromNow, mkExam, mkFiveQuestions, leaksIn } from "./exam-room-fx";

/** Đích chuyển hướng của một phản hồi trang: 3xx → Location; 200 có NEXT_REDIRECT/meta refresh → đích trong thân; còn lại null. */
function redirectOf(r: { status: number; text: string; headers: Headers }): string | null {
  if (r.status >= 300 && r.status < 400) return r.headers.get("location");
  const m = r.text.match(/NEXT_REDIRECT;(?:replace|push);([^;"\\]+)/) ?? r.text.match(/http-equiv="refresh"[^>]*url=([^"]+)/i);
  return m ? decodeURIComponent(m[1]) : null;
}
const ids = (j: unknown, pick: (x: any) => string) => (Array.isArray(j) ? j : (j as any)?.items ?? []).map(pick) as string[];

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");
  const T2 = await mkTutor("Thầy Hai");
  const A = await mkUser({ name: "Em An" });
  const B = await mkUser({ name: "Em Bình" });       // cùng lớp với A
  const X = await mkUser({ name: "Em Ngoài Lớp" });  // không thuộc lớp nào
  const C = await mkCourse(T.id, { name: "Toán 9" });
  for (const u of [A, B]) await prisma.enrollment.create({ data: { userId: u.id, courseId: C.id, status: "active" } });

  const E = await mkExam({ id: "ra-main", ownerId: T.id, courseId: C.id, mode: "test", opensAt: minutesFromNow(-10), durationMin: 60, title: "Đề chính ra" });
  const q = await mkFiveQuestions(E.id, "ra");
  const st = await api("POST", `/api/exams/${E.id}/start`, { as: A, body: {} });
  const att: string = st.json.attemptId;
  check("chuẩn bị: A vào được phòng thi", st.status === 200 && !!att, st.json);

  section("1 · khách (không cookie)");
  const g = await api("GET", "/api/student/de-thi");
  check("GET /api/student/de-thi → 401", g.status === 401, g.status);
  for (const [m, p, body] of [
    ["POST", `/api/exams/${E.id}/start`, {}],
    ["GET", `/api/exams/attempts/${att}`, undefined],
    ["PATCH", `/api/exams/attempts/${att}/answer`, { questionId: q.mc, optionId: q.mcOk }],
    ["PATCH", `/api/exams/attempts/${att}/answer-bool`, { optionId: q.multiOk[0], answerTrue: true }],
    ["POST", `/api/exams/attempts/${att}/check`, { questionId: q.mc }],
    ["POST", `/api/exams/attempts/${att}/submit`, undefined],
    ["PATCH", `/api/exams/attempts/${att}/tab-event`, undefined],
    ["GET", `/api/exams/attempts/${att}/review`, undefined],
  ] as const) {
    const r = await api(m, p, { body });
    check(`khách ${m} ${p.replace(att, "<att>").replace(E.id, "<exam>")} → 401/403 và không rò`, [401, 403].includes(r.status) && leaksIn(r.text).length === 0, [r.status, r.text.slice(0, 120)]);
  }
  const gate = await api("GET", `/api/exams/${E.id}/gate`);
  check("khách gate đề thuộc lớp → không 200 kèm câu hỏi/đáp án", leaksIn(gate.text).length === 0 && !/"questions"/.test(gate.text), [gate.status, gate.text.slice(0, 160)]);

  section("2 · học sinh gọi API quản trị đề");
  for (const [m, p, body] of [
    ["POST", "/api/exams", { title: "x", category: "Toán" }],
    ["PATCH", `/api/exams/${E.id}`, { title: "đổi tên" }],
    ["PUT", `/api/exams/${E.id}`, { title: "đổi tên" }],
    ["DELETE", `/api/exams/${E.id}`, undefined],
    ["GET", `/api/exams/${E.id}/attempts/admin`, undefined],
    ["GET", `/api/exams/attempts/${att}/admin`, undefined],
    ["POST", `/api/exams/${E.id}/recalculate`, {}],
    ["POST", `/api/exams/${E.id}/questions`, { text: "x", type: "MC" }],
    ["GET", `/api/exams/${E.id}/guest-access`, undefined],
    ["POST", `/api/exams/${E.id}/guest-access`, { email: "x@y.z" }],
  ] as const) {
    const r = await api(m, p, { as: B, body });
    check(`học sinh ${m} ${p.replace(att, "<att>").replace(E.id, "<exam>")} → 401/403/405`, [401, 403, 405].includes(r.status), [r.status, r.text.slice(0, 120)]);
  }
  const still = await prisma.exam.findUnique({ where: { id: E.id }, select: { title: true, active: true } });
  check("đề không bị đổi/xoá sau các lời gọi trên", still?.title === "Đề chính ra" && still.active, still);

  section("3 · học sinh B dùng lượt của A (cùng lớp)");
  for (const [m, p, body] of [
    ["GET", `/api/exams/attempts/${att}`, undefined],
    ["PATCH", `/api/exams/attempts/${att}/answer`, { questionId: q.mc, optionId: q.mcNo }],
    ["PATCH", `/api/exams/attempts/${att}/answer-bool`, { optionId: q.multiOk[0], answerTrue: false }],
    ["POST", `/api/exams/attempts/${att}/check`, { questionId: q.mc }],
    ["POST", `/api/exams/attempts/${att}/submit`, undefined],
    ["PATCH", `/api/exams/attempts/${att}/tab-event`, undefined],
    ["GET", `/api/exams/attempts/${att}/review`, undefined],
  ] as const) {
    const r = await api(m, p, { as: B, body });
    check(`B ${m} …/${p.split("/").slice(5).join("/") || "<att>"} → 403/404, không rò`, [403, 404].includes(r.status) && leaksIn(r.text).length === 0, [r.status, r.text.slice(0, 120)]);
  }
  const aAfter = await prisma.examAttempt.findUnique({ where: { id: att }, select: { status: true, tabSwitchCount: true } });
  const aAns = await prisma.examAnswer.count({ where: { attemptId: att } });
  check("lượt của A nguyên vẹn: vẫn in_progress, 0 lần chuyển tab, 0 đáp án do B ghi", aAfter?.status === "in_progress" && aAfter.tabSwitchCount === 0 && aAns === 0, { aAfter, aAns });

  section("4 · trang theo vai");
  const pageAs = (u: any | undefined, path: string) => api("GET", path, { as: u });
  for (const path of ["/lop-cua-toi/de-thi", "/lop-cua-toi/quan-lop", "/lop-cua-toi/lop", "/admin/thi-thu", "/admin/khoa-hoc"]) {
    const r = await pageAs(A, path);
    const to = redirectOf(r);
    check(`học sinh mở ${path} → bị chuyển đi (không phải trang gia sư/quản trị)`, !!to && !to.startsWith(path), { status: r.status, to });
  }
  // Khách mở /student/* : trang là vỏ khách 200 (chuyển hướng ở phía trình duyệt) → kiểm ở ui-exam-guest-redirect.ts.
  const own = await pageAs(A, "/student/bai-tap");
  check("học sinh mở /student/bai-tap của mình → 200, không bị chuyển", own.status === 200 && !redirectOf(own), own.status);

  section("5 · đề nháp / mã con / giao-theo-link của lớp khác không lọt payload");
  const D = await mkExam({ id: "ra-draft", ownerId: T.id, courseId: C.id, mode: "practice", title: "Đề NHÁP bí mật" });
  await prisma.exam.update({ where: { id: D.id }, data: { isDraft: true } }); await mkFiveQuestions(D.id, "rad");
  const old = await mkExam({ id: "ra-old", ownerId: T.id, courseId: C.id, mode: "practice", title: "Đề bản cũ" });
  await prisma.exam.update({ where: { id: old.id }, data: { supersededById: E.id } }); await mkFiveQuestions(old.id, "rao");
  for (const [k, id] of [[1, "ra-g-root"], [2, "ra-g-v2"]] as const) { await mkExam({ id, ownerId: T.id, courseId: C.id, mode: "practice", title: `Nhóm mã ${k}`, variantNo: k, variantOfId: k === 1 ? null : "ra-g-root" }); await mkFiveQuestions(id, `rag${k}`); }
  const L = await mkExam({ id: "ra-link", ownerId: T2.id, courseId: null, mode: "practice", title: "Đề chỉ giao bằng link của thầy khác" }); await mkFiveQuestions(L.id, "ral");
  const SECRET = ["ra-draft", "ra-old", "ra-g-v2", "ra-link"];

  for (const [who, u] of [["A (trong lớp)", A], ["X (ngoài lớp)", X]] as const) {
    const list = await api("GET", "/api/exams?active=true", { as: u });
    const got = ids(list.json, (e: any) => e.id);
    check(`${who}: GET /api/exams không có nháp / bản cũ / mã con / đề link của thầy khác`, SECRET.every(s => !got.includes(s)), got);
    const dt = await api("GET", "/api/student/de-thi", { as: u });
    const got2 = ids(dt.json, (i: any) => i.id);
    check(`${who}: GET /api/student/de-thi không có nháp / bản cũ / mã con / đề link`, dt.status === 200 && SECRET.every(s => !got2.includes(s)) && !/variantNo/.test(dt.text), got2);
    const sc = await api("GET", "/api/schedule", { as: u });
    const evIds: string[] = (Array.isArray(sc.json) ? sc.json : sc.json?.events ?? []).filter((e: any) => e.type === "exam").map((e: any) => String(e.id));
    check(`${who}: GET /api/schedule (Lịch thi sắp tới) không có nháp / bản cũ / mã con`, ["ra-draft", "ra-old", "ra-g-v2"].every(s => !evIds.includes(`exam-${s}`)), evIds);
    check(`${who}: GET /api/schedule không có đề giao-theo-link của thầy khác`, !evIds.includes("exam-ra-link"), evIds);
  }
  const xSched = await api("GET", "/api/schedule", { as: X });
  const xEv: string[] = (Array.isArray(xSched.json) ? xSched.json : xSched.json?.events ?? []).filter((e: any) => e.type === "exam").map((e: any) => String(e.id));
  // STU-004 (cùng luật GET /api/exams): đề của lớp em không học không hiện tên ở Lịch thi; học sinh TRONG lớp vẫn thấy.
  check("X (ngoài lớp): lịch thi không liệt kê đề của lớp Toán 9", !xEv.includes("exam-ra-main"), xEv);
  const aSched = await api("GET", "/api/schedule", { as: A });
  const aEv: string[] = (aSched.json?.events ?? []).filter((e: any) => e.type === "exam").map((e: any) => String(e.id));
  check("A (trong lớp): lịch thi VẪN liệt kê đề của lớp mình (ra-main)", aEv.includes("exam-ra-main"), aEv);

  const gd = await api("GET", `/api/exams/${D.id}/gate`, { as: A });
  check("gate đề nháp (học sinh) → không 200 / không kèm câu hỏi", gd.status !== 200 && leaksIn(gd.text).length === 0, [gd.status, gd.text.slice(0, 120)]);
  const sd = await api("POST", `/api/exams/${D.id}/start`, { as: A, body: {} });
  check("start đề nháp → không vào được, không có attempt", sd.status >= 400 && (await prisma.examAttempt.count({ where: { examId: D.id } })) === 0, [sd.status, sd.json]);
  const gv = await api("GET", "/api/exams/ra-g-v2/gate", { as: A });
  check("gate bằng id mã con: không lộ variantNo / variantOfId", !/variantNo|variantOfId/.test(gv.text) && leaksIn(gv.text).length === 0, gv.text.slice(0, 200));
  const sv = await api("POST", "/api/exams/ra-g-v2/start", { as: A, body: {} });
  check("start bằng id mã con: không lộ variantNo / variantOfId", !/variantNo|variantOfId/.test(sv.text), sv.text.slice(0, 200));

  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
