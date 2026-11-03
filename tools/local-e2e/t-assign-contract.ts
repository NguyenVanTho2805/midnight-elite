// BU-03 P3 ↔ BU-04 — HỢP ĐỒNG giao đề ↔ phòng thi học sinh (D2). Tám ca của mục 8 đặc tả BU-03, gọi API học sinh THẬT (như t-quiz-hs.ts).
// BU-04 xong: READY = true, hai cờ ở src/lib/deThiAssign.ts đã bật. Cần máy chủ dev (BASE) + DB RIÊNG; wipe() ở đầu bài.
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-assign-contract.ts
// Ca phá bằng thiết kế: start bỏ startVerdict → ca 1 đỏ; đếm lượt theo examId → ca 2 đỏ; bỏ pickMember → ca 3 đỏ; ExamResult theo id mã con → ca 4 đỏ;
//   GET /api/exams bỏ variantOfId:null / isListedToStudent → ca 5, 6 đỏ; start ép khung giờ cả với practice / mode=null → ca 7 đỏ; GET /api/exams trả hash → ca 8 đỏ.
import { api, mkTutor, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { AUDIENCE_LINK_READY, VARIANT_STUDENT_SUPPORT } from "@/lib/deThiAssign";
import { examPasswordPatch } from "@/lib/examPassword";
import { pickVariantNo } from "@/lib/deThiVariantPick";
import { minutesFromNow, mkExam, mkMcQuestion } from "./exam-room-fx";

const READY = true; // BU-04 xong

(async () => {
section("Hợp đồng giao đề ↔ phòng thi (BU-04)");
check("hai cờ cổng đã bật (D2 xong)", READY && VARIANT_STUDENT_SUPPORT === true && AUDIENCE_LINK_READY === true, { VARIANT_STUDENT_SUPPORT, AUDIENCE_LINK_READY });

await wipe();
const T = await mkTutor("Cô Lan");
const C = await mkCourse(T.id, { name: "Toán 9" });
const mkStu = async (name: string, enrol = true) => { const u = await mkUser({ name }); if (enrol) await prisma.enrollment.create({ data: { userId: u.id, courseId: C.id, status: "active" } }); return u; };
const start = (u: Awaited<ReturnType<typeof mkStu>>, id: string, body: unknown = {}) => api("POST", `/api/exams/${id}/start`, { as: u, body });
const withQ = async (examId: string, key: string) => mkMcQuestion(examId, key);

// ── 1 · Ép khung giờ (mode=test) ────────────────────────────────────────────
section("1 · ép khung giờ: mode=test");
{
  const S = await mkStu("Em Giờ");
  const early = await mkExam({ id: "ct-early", ownerId: T.id, courseId: C.id, mode: "test", opensAt: minutesFromNow(30), durationMin: 45 }); await withQ(early.id, "cte");
  const late = await mkExam({ id: "ct-late", ownerId: T.id, courseId: C.id, mode: "test", opensAt: minutesFromNow(-120), durationMin: 30 }); await withQ(late.id, "ctl");
  const inwin = await mkExam({ id: "ct-in", ownerId: T.id, courseId: C.id, mode: "test", opensAt: minutesFromNow(-20), durationMin: 60 }); await withQ(inwin.id, "cti");
  const r1 = await start(S, early.id);
  check("trước giờ mở → 409 not_open, kèm opensAt", r1.status === 409 && r1.json.code === "not_open" && !!r1.json.opensAt, r1.json);
  const g1 = await api("GET", `/api/exams/${early.id}/gate`, { as: S });
  check("gate trước giờ mở: canStart=false, blockReason=not_open, window.state=not_open", g1.json.canStart === false && g1.json.blockReason === "not_open" && g1.json.window.state === "not_open", g1.json);
  const r2 = await start(S, late.id);
  check("sau giờ đóng (mở + thời lượng) → 409 closed", r2.status === 409 && r2.json.code === "closed", r2.json);
  check("không tạo lượt nào ở hai ca bị chặn", (await prisma.examAttempt.count({ where: { userId: S.id } })) === 0);
  const r3 = await start(S, inwin.id);
  const closesAt = Date.parse(r3.json.windowClosesAt);
  check("đúng khung → 200, có windowClosesAt", r3.status === 200 && Number.isFinite(closesAt), r3.json);
  check("hạn lượt ≤ cuối khung (vào muộn 20 phút ⇒ chỉ còn ~40 phút, không phải 60)", Date.parse(r3.json.expiresAt) <= closesAt + 1000 && Date.parse(r3.json.expiresAt) - Date.now() < 45 * 60_000, [r3.json.expiresAt, r3.json.windowClosesAt]);
  const noQ = await mkExam({ id: "ct-off", ownerId: T.id, courseId: C.id, mode: "test", opensAt: minutesFromNow(-5), active: false }); await withQ(noQ.id, "cto");
  const r4 = await start(S, noQ.id);
  check("gia sư đã đóng bài (active=false) → 409 closed", r4.status === 409 && r4.json.code === "closed", r4.json);
}

// ── 2/3/4 · Mã đề: số lượt theo nhóm, chia mã ổn định, gộp lượt/điểm ───────────
section("2-4 · mã đề: số lượt theo nhóm, chia mã ổn định, gộp lượt/điểm");
{
  const mkG = async (p: string, max: number) => {
    for (const [k, id] of [[1, `${p}-root`], [2, `${p}-v2`]] as const) { await mkExam({ id, ownerId: T.id, courseId: C.id, variantNo: k, variantOfId: k === 1 ? null : `${p}-root`, maxAttempts: max }); await withQ(id, `${p}${k}`); }
  };
  await mkG("cg1", 1);
  const pick = async (root: string, want: number) => { for (let i = 0; i < 60; i++) { const u = await mkStu(`HS ${root} ${i}`); if (pickVariantNo(root, u.id, 2) === want) return u; } throw new Error("không tìm được học sinh"); };
  const U = await pick("cg1-root", 2); // được chia mã 102 (cg1-v2)
  const other = "cg1-root"; // làm trước một lượt ở MÃ KHÁC
  await prisma.examAttempt.create({ data: { userId: U.id, examId: other, startedAt: new Date(Date.now() - 7200_000), expiresAt: new Date(Date.now() - 3600_000), status: "submitted", submittedAt: new Date(Date.now() - 3600_000), score: 1, totalPoints: 1 } });
  const s = await start(U, "cg1-root");
  check("2 · maxAttempts=1, lượt đầu ở mã khác → lượt hai 409 attempts_exhausted", s.status === 409 && s.json.code === "attempts_exhausted", s.json);

  await mkG("cg2", 3);
  const V = await pick("cg2-root", 2);
  const a1 = await start(V, "cg2-root"); const e1 = (await prisma.examAttempt.findUnique({ where: { id: a1.json.attemptId } }))!.examId;
  await api("PATCH", `/api/exams/attempts/${a1.json.attemptId}/answer`, { as: V, body: { questionId: a1.json.questions[0].id, optionId: `${a1.json.questions[0].id.replace(/q$/, "")}ok` } });
  const sub1 = await api("POST", `/api/exams/attempts/${a1.json.attemptId}/submit`, { as: V });
  const a2 = await start(V, "cg2-root"); const e2 = (await prisma.examAttempt.findUnique({ where: { id: a2.json.attemptId } }))!.examId;
  check("3 · cùng học sinh luôn cùng mã (hai lượt cùng đề con) và đúng mã pickVariantNo=2", e1 === e2 && e1 === "cg2-v2" && a1.json.variantCode === 102, [e1, e2]);
  const other2 = await pick("cg2-root", 1);
  const b1 = await start(other2, "cg2-root");
  check("3 · học sinh được chia mã 1 vào đề gốc (khác mã của V)", (await prisma.examAttempt.findUnique({ where: { id: b1.json.attemptId } }))!.examId === "cg2-root" && b1.json.variantCode === 101);
  await api("POST", `/api/exams/attempts/${a2.json.attemptId}/submit`, { as: V });
  check("4 · hai lượt ở mã con → MỘT dòng ExamResult của V, gắn với GỐC", (await prisma.examResult.count({ where: { userId: V.id } })) === 1 && !!(await prisma.examResult.findUnique({ where: { userId_examId: { userId: V.id, examId: "cg2-root" } } })), sub1.json);
  const mine = await api("GET", "/api/exam-results?mine=true", { as: V });
  check("4 · 'bài của tôi': một dòng, examId gốc", (mine.json as any[]).filter(r => r.examId === "cg2-root").length === 1 && !(mine.json as any[]).some(r => r.examId === "cg2-v2"));
  const lb = await api("GET", "/api/exam-results?examId=cg2-root", { as: V });
  check("4 · xếp hạng theo gốc có V đúng một lần", (lb.json as any[]).filter(r => r.userId === V.id).length === 1);

  // 5 · ẩn mã con
  const list = await api("GET", "/api/exams?active=true", { as: V });
  check("5 · GET /api/exams (học sinh): có gốc, KHÔNG có hàng mã con", (list.json as any[]).some(e => e.id === "cg2-root") && !(list.json as any[]).some(e => e.id === "cg2-v2" || e.id === "cg2-v3"), (list.json as any[]).map(e => e.id));
}

// ── 6 · Giao theo link ───────────────────────────────────────────────────────
section("6 · giao theo link: không lọt danh sách công khai, vẫn vào được bằng đường dẫn");
{
  const L = await mkExam({ id: "ct-link", ownerId: T.id, courseId: null, mode: "practice", title: "Đề giao theo link" }); await withQ(L.id, "ctk");
  const S = await mkStu("Em Link", false);
  const list = await api("GET", "/api/exams?active=true", { as: S });
  const guest = await api("GET", "/api/exams?activeGuest=true");
  check("không có trong GET /api/exams?active=true (học sinh)", !(list.json as any[]).some(e => e.id === "ct-link"), (list.json as any[]).map(e => e.id));
  check("không có trong danh sách khách (activeGuest=true)", !(guest.json as any[]).some(e => e.id === "ct-link"));
  const dt = await api("GET", "/api/student/de-thi", { as: S });
  check("không có trong student/de-thi khi chưa từng làm", !(dt.json.items as any[]).some(i => i.id === "ct-link"));
  const s = await start(S, "ct-link");
  check("nhưng start bằng id vẫn 200 (đề không gắn lớp)", s.status === 200 && !!s.json.attemptId, s.json);
  const dt2 = await api("GET", "/api/student/de-thi", { as: S });
  check("sau khi đã làm thì xuất hiện ở student/de-thi với source='link'", (dt2.json.items as any[]).some(i => i.id === "ct-link" && i.source === "link" && i.state === "dang-lam"), dt2.json.items);
}

// ── 7 · practice không ép giờ; mode=null giữ hành vi cũ ──────────────────────
section("7 · mode=practice không ép khung giờ; mode=null (đề cũ) giữ nguyên");
{
  const S = await mkStu("Em Luyện");
  const p = await mkExam({ id: "ct-prac", ownerId: T.id, courseId: C.id, mode: "practice", opensAt: minutesFromNow(60 * 48) }); await withQ(p.id, "ctp");
  const n = await mkExam({ id: "ct-null", ownerId: T.id, courseId: C.id, mode: null, opensAt: minutesFromNow(60 * 48) }); await withQ(n.id, "ctn");
  const rp = await start(S, p.id), rn = await start(S, n.id);
  check("practice với giờ mở ở TƯƠNG LAI vẫn start được (200)", rp.status === 200 && rp.json.windowClosesAt === null, rp.json);
  check("mode=null với giờ tương lai vẫn start được như trước (200)", rn.status === 200 && rn.json.windowClosesAt === null, rn.json);
  const gp = await api("GET", `/api/exams/${p.id}/gate`, { as: S });
  check("gate practice: window.state='none', canStart", gp.json.window.state === "none" && gp.json.canStart === true, gp.json);
}

// ── 8 · Mật khẩu ────────────────────────────────────────────────────────────
section("8 · mật khẩu: đúng/sai theo passwordHash; GET công khai không lộ hash");
{
  const S = await mkStu("Em Mật khẩu");
  const w = await mkExam({ id: "ct-pw", ownerId: T.id, courseId: C.id, mode: "practice" }); await withQ(w.id, "ctw");
  await prisma.exam.update({ where: { id: w.id }, data: await examPasswordPatch("mk-dung-123") });
  const bad = await start(S, w.id, { password: "mk-sai" });
  check("sai mật khẩu → 403, không tạo lượt", bad.status === 403 && (await prisma.examAttempt.count({ where: { userId: S.id, examId: w.id } })) === 0, bad.json);
  const none = await start(S, w.id);
  check("không gõ mật khẩu → 403", none.status === 403);
  const good = await start(S, w.id, { password: "mk-dung-123" });
  check("đúng mật khẩu → 200", good.status === 200 && !!good.json.attemptId, good.json);
  const resume = await start(S, w.id);
  check("vào lại (tiếp tục) không đòi mật khẩu", resume.status === 200 && resume.json.attemptId === good.json.attemptId);
  const row = await prisma.exam.findUnique({ where: { id: w.id } });
  const pub = await api("GET", "/api/exams?activeGuest=true");
  const one = await api("GET", `/api/exams/${w.id}`, { as: S });
  const gate = await api("GET", `/api/exams/${w.id}/gate`, { as: S });
  check("GET công khai / chi tiết / gate không lộ passwordHash hay mật khẩu", !pub.text.includes(row!.passwordHash ?? "§") && !one.text.includes(row!.passwordHash ?? "§") && !/passwordHash|mk-dung-123/.test(pub.text + one.text + gate.text), pub.text.slice(0, 200));
  check("gate báo hasPassword=true", gate.json.exam.hasPassword === true);
}

await done();
})();
