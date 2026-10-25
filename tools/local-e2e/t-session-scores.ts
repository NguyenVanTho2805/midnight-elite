// BU-11 điểm 0-10 + % BTVN từng em mỗi buổi — API thật: chỉ ghi khi hồ sơ có đồng ý phạm vi "scores"; chỉ gia sư chủ lớp và phụ huynh của ĐÚNG em thấy;
// thu hồi đồng ý → ẩn ngay cả với phụ huynh; học sinh không có đường đọc; nhật ký không ghi điểm hay tên.
// Chạy (máy chủ dev bật): source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-session-scores.ts
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { api, check, done, mkCourse, mkTutor, mkUser, section, wipe } from "./h";

const stamp = Date.now().toString(36);

(async () => {
  await wipe();
  const A = await mkTutor("Gia sư A"), B = await mkTutor("Gia sư B");
  const cA = await mkCourse(A.id, { name: "Toán 9" }), cB = await mkCourse(B.id, { name: "Lý 9 của B" });
  const S1 = await mkUser({ name: `Em Đủ Đồng Ý ${stamp}` }), S2 = await mkUser({ name: `Em Thiếu Đồng Ý ${stamp}` }), S3 = await mkUser({ name: `Em Chưa Có Hồ Sơ ${stamp}` }), S4 = await mkUser({ name: "Em Lớp Khác" });
  for (const s of [S1, S2, S3]) await prisma.enrollment.create({ data: { userId: s.id, courseId: cA.id, status: "active" } });
  await prisma.enrollment.create({ data: { userId: S4.id, courseId: cB.id, status: "active" } });
  const sess = await prisma.attendanceSession.create({ data: { courseId: cA.id, date: new Date(Date.UTC(2026, 9, 20)), createdBy: A.id } });
  const sessB = await prisma.attendanceSession.create({ data: { courseId: cB.id, date: new Date(Date.UTC(2026, 9, 20)), createdBy: B.id } });
  const mkProfile = async (u: { id: string; name: string }, scopes: string[]) => {
    const r = await api("POST", "/api/tutor/ho-so", { as: A, body: { name: u.name, ageGroup: "16plus", userId: u.id, consent: { self: true, scopes } } });
    if (r.status !== 201) throw new Error("tạo hồ sơ lỗi " + JSON.stringify(r.json));
    return r.json.id as string;
  };
  const p1 = await mkProfile(S1, ["basic", "scores"]);
  const p2 = await mkProfile(S2, ["basic"]); // KHÔNG có phạm vi scores
  const URL_ = `/api/attendance-sessions/${sess.id}/diem`;

  section("Quyền");
  check("chưa đăng nhập → 401", (await api("GET", URL_)).status === 401);
  check("học sinh → 403", (await api("GET", URL_, { as: S1 })).status === 403 && (await api("PUT", URL_, { as: S1, body: { scores: [{ userId: S1.id, score: 10 }] } })).status === 403);
  check("gia sư KHÁC → 403 (GET, PUT), không lộ tên", await (async () => { const g = await api("GET", URL_, { as: B }); const p = await api("PUT", URL_, { as: B, body: { scores: [{ userId: S1.id, score: 1 }] } }); return g.status === 403 && p.status === 403 && !g.text.includes(stamp); })());
  check("buổi không tồn tại → 404", (await api("GET", "/api/attendance-sessions/khong-co/diem", { as: A })).status === 404);

  section("Ai ghi được điểm");
  const g = await api("GET", URL_, { as: A });
  const by = Object.fromEntries((g.json.roster as { userId: string }[]).map(r => [r.userId, r]));
  check("3 em đang học lớp hiện ra; em lớp khác KHÔNG hiện", g.status === 200 && g.json.roster.length === 3 && !by[S4.id]);
  check("em có đồng ý 'scores' → canRecord", by[S1.id].canRecord === true && by[S1.id].reason === null);
  check("em có hồ sơ nhưng thiếu 'scores' → không ghi được, lý do no_consent, kèm id hồ sơ để đi xác nhận", by[S2.id].canRecord === false && by[S2.id].reason === "no_consent" && by[S2.id].profileId === p2);
  check("em chưa có hồ sơ riêng → không ghi được, lý do no_profile", by[S3.id].canRecord === false && by[S3.id].reason === "no_profile" && by[S3.id].profileId === null);

  section("Ghi điểm: kiểm giá trị, đủ đồng ý mới lưu, tất cả hoặc không");
  for (const [name, body] of [["điểm 11", { score: 11 }], ["điểm âm", { score: -1 }], ["điểm 7.3 (sai bước 0,25)", { score: 7.3 }], ["chữ", { score: "abc" }], ["BTVN 101", { homeworkPct: 101 }], ["BTVN 80.5", { homeworkPct: 80.5 }]] as const) {
    check(`${name} → 400, không lưu`, (await api("PUT", URL_, { as: A, body: { scores: [{ userId: S1.id, ...body }] } })).status === 400);
  }
  check("sau các lần sai: chưa có dòng điểm nào", (await prisma.sessionStudentScore.count()) === 0);
  const mixed = await api("PUT", URL_, { as: A, body: { scores: [{ userId: S1.id, score: 9, homeworkPct: 90 }, { userId: S2.id, score: 5 }] } });
  check("gửi cả em đủ lẫn em thiếu đồng ý → 422 nêu em bị chặn, KHÔNG lưu cả em đủ đồng ý (tất cả hoặc không)", mixed.status === 422 && mixed.json.needsConsent && mixed.json.blocked.join() === S2.id && (await prisma.sessionStudentScore.count()) === 0, mixed.json);
  check("em chưa có hồ sơ → 422", (await api("PUT", URL_, { as: A, body: { scores: [{ userId: S3.id, score: 5 }] } })).status === 422);
  check("em KHÔNG học lớp này (lớp của B) → 400", (await api("PUT", URL_, { as: A, body: { scores: [{ userId: S4.id, score: 5 }] } })).status === 400);
  const okPut = await api("PUT", URL_, { as: A, body: { scores: [{ userId: S1.id, score: "7,5", homeworkPct: "80" }] } });
  const row = await prisma.sessionStudentScore.findFirst({ where: { userId: S1.id } });
  check("em đủ đồng ý: lưu 7,5 điểm và 80%, ghi tutorId = chủ lớp", okPut.status === 200 && row?.score === 7.5 && row?.homeworkPct === 80 && row?.tutorId === A.id, okPut.json);
  check("GET lại hiện đúng điểm", (await api("GET", URL_, { as: A })).json.roster.find((r: { userId: string }) => r.userId === S1.id).score === 7.5);
  const log = await prisma.auditLog.findFirst({ where: { action: "session_score.update" } });
  check("nhật ký chỉ ghi số lượng: KHÔNG có điểm, tên, id học sinh", !!log && JSON.stringify(log.metadata) === '{"count":1}' && !JSON.stringify(log).includes(S1.id));
  await api("PUT", URL_, { as: A, body: { scores: [{ userId: S1.id, score: null, homeworkPct: null }] } });
  check("gửi cả hai trống → xoá dòng điểm", (await prisma.sessionStudentScore.count()) === 0);
  await api("PUT", URL_, { as: A, body: { scores: [{ userId: S1.id, score: 8, homeworkPct: 100 }] } });

  section("Phụ huynh của ĐÚNG em đó thấy (Sổ của con), người khác thì không");
  const mkToken = async (student: { id: string }, name: string) => {
    const par = await mkUser({ name });
    const token = randomBytes(16).toString("hex");
    await prisma.parentLink.create({ data: { parentId: par.id, studentId: student.id, status: "verified", verifiedAt: new Date(), portalToken: token } });
    return token;
  };
  const t1 = await mkToken(S1, "Phụ huynh S1"), t2 = await mkToken(S2, "Phụ huynh S2"), t3 = await mkToken(S3, "Phụ huynh S3");
  await prisma.sessionStudentScore.create({ data: { sessionId: sess.id, userId: S2.id, tutorId: A.id, score: 3, homeworkPct: 33 } }); // dòng tồn dư của em thiếu đồng ý
  const j1 = await api("GET", `/api/parent-portal/${t1}`);
  check("API: phụ huynh S1 thấy đúng điểm của S1 (8 điểm, 100%)", j1.status === 200 && j1.json.scores.length === 1 && j1.json.scores[0].score === 8 && j1.json.scores[0].homeworkPct === 100 && j1.json.scores[0].courseName === "Toán 9" && j1.json.scores[0].dateKey === "2026-10-20", j1.json.scores);
  check("API: không lộ điểm của em khác trong phản hồi của S1", !JSON.stringify(j1.json).includes('"score":3') && !JSON.stringify(j1.json).includes(S2.id));
  const j2 = await api("GET", `/api/parent-portal/${t2}`);
  check("API: phụ huynh S2 (dòng điểm còn tồn nhưng THIẾU đồng ý) → không có điểm nào", j2.status === 200 && j2.json.scores.length === 0);
  check("API: phụ huynh S3 (không có điểm) → rỗng", (await api("GET", `/api/parent-portal/${t3}`)).json.scores.length === 0);
  const clean = (h: string) => h.replace(/<!-- -->/g, ""); // React chèn dấu phân cách giữa các đoạn chữ khi dựng sẵn
  const page1 = await api("GET", `/so-cua-con/${t1}`); page1.text = clean(page1.text);
  check("Trang Sổ của con của S1: mục 'Điểm từng buổi', 'Điểm 8/10', 'Hoàn thành BTVN 100%', ngày 20/10", page1.status === 200 && page1.text.includes("Điểm từng buổi") && page1.text.includes("Điểm 8/10") && page1.text.includes("Hoàn thành BTVN 100%") && page1.text.includes("20/10"));
  const page2 = await api("GET", `/so-cua-con/${t2}`); page2.text = clean(page2.text);
  check("Trang của S2: KHÔNG có mục điểm, không có '33%'", !page2.text.includes("Điểm từng buổi") && !page2.text.includes("33%"));
  check("Học sinh S1 xem các đường của chính mình: không có điểm buổi", await (async () => { const urls = ["/api/users/me", "/api/users/me/stats", "/api/users/me/activity"]; for (const u of urls) { const r = await api("GET", u, { as: S1 }); if (/homeworkPct|session_student|"score":8/.test(r.text)) return false; } return true; })());

  section("Thu hồi đồng ý → ẩn ngay, cả với phụ huynh");
  const rv = await api("POST", `/api/tutor/ho-so/${p1}/thu-hoi`, { as: A, body: { party: "self" } });
  check("thu hồi đồng ý của S1", rv.status === 200);
  check("phụ huynh S1 không còn thấy điểm (API và trang)", (await api("GET", `/api/parent-portal/${t1}`)).json.scores.length === 0 && !(await api("GET", `/so-cua-con/${t1}`)).text.includes("Điểm từng buổi"));
  const g2 = await api("GET", URL_, { as: A });
  const r1 = g2.json.roster.find((r: { userId: string }) => r.userId === S1.id);
  check("gia sư cũng không thấy điểm cũ của S1 nữa; canRecord=false", r1.canRecord === false && r1.score === null && r1.homeworkPct === null);
  check("PUT cho S1 sau thu hồi → 422", (await api("PUT", URL_, { as: A, body: { scores: [{ userId: S1.id, score: 5 }] } })).status === 422);
  await api("POST", `/api/tutor/ho-so/${p1}/dong-y`, { as: A, body: { self: true, scopes: ["basic", "scores"] } });
  check("đồng ý lại → phụ huynh lại thấy", (await api("GET", `/api/parent-portal/${t1}`)).json.scores.length === 1);

  section("Xoá hồ sơ → xoá điểm gia sư đã ghi cho em đó");
  await prisma.sessionStudentScore.create({ data: { sessionId: sessB.id, userId: S4.id, tutorId: B.id, score: 6 } }); // điểm của gia sư KHÁC về em khác: không được đụng
  const del = await api("DELETE", `/api/tutor/ho-so/${p1}`, { as: A });
  check("xoá hồ sơ S1 → xoá điểm S1; điểm của gia sư B giữ nguyên", del.status === 200 && (await prisma.sessionStudentScore.count({ where: { userId: S1.id } })) === 0 && (await prisma.sessionStudentScore.count({ where: { userId: S4.id } })) === 1);

  await done();
})();
