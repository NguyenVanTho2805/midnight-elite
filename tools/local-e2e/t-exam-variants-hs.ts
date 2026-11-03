// BU-04 — nhiều mã đề phía HỌC SINH (D2-b/c của BU-03): chia mã ổn định, đếm lượt/điểm theo NHÓM, ẩn mã con, id mã con quy về gốc, không lộ variantNo.
// Cần máy chủ dev (BASE) + DB RIÊNG; wipe() ở đầu bài. Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-exam-variants-hs.ts
// Ca phá bằng thiết kế: start bỏ pickMember (dùng id được truyền) → ca 'cùng học sinh luôn cùng mã' và 'phân tán' đỏ; đếm lượt theo examId thay vì nhóm → ca 'maxAttempts' đỏ;
//   upsertBestResult ghi theo id mã con → ca 'một dòng ExamResult' đỏ; GET /api/exams bỏ variantOfId:null → ca 'danh sách' đỏ; trả variantNo ở start/gate → ca 'không lộ' đỏ.
import { api, mkTutor, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { pickVariantNo } from "@/lib/deThiVariantPick";
import { mkExam, mkMcQuestion } from "./exam-room-fx";

type U = Awaited<ReturnType<typeof mkUser>>;

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");
  const C = await mkCourse(T.id, { name: "Toán 9" });
  const answers = new Map<string, { ok: string; no: string }>(); // questionId → đáp án đúng/sai (chỉ bài test biết)

  async function mkGroup(prefix: string, n: number, maxAttempts: number | null, mode: "practice" | "test" | null = null) {
    const ids: string[] = [];
    for (let k = 1; k <= n; k++) {
      const id = k === 1 ? `${prefix}-root` : `${prefix}-v${k}`;
      await mkExam({ id, ownerId: T.id, courseId: C.id, mode, variantNo: k, variantOfId: k === 1 ? null : `${prefix}-root`, maxAttempts, title: `Đề ${prefix}` });
      const qk = `${prefix}${"abcdefgh"[k - 1]}`; // id câu KHÔNG chứa id mã con → quét rò id mã con không bị nhiễu
      const q = await mkMcQuestion(id, qk);
      answers.set(q.q, { ok: q.ok, no: q.no });
      ids.push(id);
    }
    return { rootId: `${prefix}-root`, ids };
  }
  async function studentFor(g: { rootId: string }, n: number, no: number, enrol = true): Promise<U> {
    for (let i = 0; i < 80; i++) {
      const u = await mkUser({ name: `HS ${g.rootId} ${i}` });
      if (pickVariantNo(g.rootId, u.id, n) === no) { if (enrol) await prisma.enrollment.create({ data: { userId: u.id, courseId: C.id, status: "active" } }); return u; }
    }
    throw new Error("không tìm được học sinh cho mã " + no);
  }
  const startAs = (u: U, id: string) => api("POST", `/api/exams/${id}/start`, { as: u, body: {} });
  const finish = async (u: U, attemptId: string, questionId: string, correct: boolean) => {
    const a = answers.get(questionId)!;
    await api("PATCH", `/api/exams/attempts/${attemptId}/answer`, { as: u, body: { questionId, optionId: correct ? a.ok : a.no } });
    return api("POST", `/api/exams/attempts/${attemptId}/submit`, { as: u });
  };

  const G = await mkGroup("g3", 3, 2);
  const [h1, h2, h3] = [await studentFor(G, 3, 1), await studentFor(G, 3, 2), await studentFor(G, 3, 3)];

  section("Chia mã: học sinh khác nhau nhận mã khác nhau, mã ổn định, không lộ số mã");
  const s1 = await startAs(h1, G.rootId), s2 = await startAs(h2, G.rootId), s3 = await startAs(h3, G.rootId);
  const exOf = async (aid: string) => (await prisma.examAttempt.findUnique({ where: { id: aid } }))!.examId;
  check("ba học sinh (chọn đúng theo pickVariantNo) vào ba đề khác nhau: gốc, v2, v3", [await exOf(s1.json.attemptId), await exOf(s2.json.attemptId), await exOf(s3.json.attemptId)].join() === "g3-root,g3-v2,g3-v3");
  check("variantCode = 101/102/103 theo mã được chia", [s1, s2, s3].map(r => r.json.variantCode).join() === "101,102,103", [s1, s2, s3].map(r => r.json.variantCode));
  check("start luôn trả examId = ĐỀ GỐC", [s1, s2, s3].every(r => r.json.examId === G.rootId));
  check("câu hỏi nhận được là câu của ĐÚNG mã được chia", s2.json.questions.length === 1 && s2.json.questions[0].id === "g3b-q" && s3.json.questions[0].id === "g3c-q", [s2.json.questions, s3.json.questions]);
  check("KHÔNG lộ variantNo, id mã con, isCorrect, lời giải ở start", ![s1, s2, s3].some(r => /variantNo|variantOfId|g3-v[23]|isCorrect|LỜI-GIẢI/.test(r.text)));
  const again = await startAs(h2, G.rootId);
  check("vào lại (tiếp tục) → cùng lượt, cùng mã 102", again.json.attemptId === s2.json.attemptId && again.json.variantCode === 102);
  const viaChild = await startAs(h2, "g3-v3");
  check("học sinh gõ id MÃ CON khác (v3) vào start → vẫn nhận mã của MÌNH (102), cùng lượt, không đổi mã", viaChild.status === 200 && viaChild.json.attemptId === s2.json.attemptId && viaChild.json.variantCode === 102 && viaChild.json.examId === G.rootId, [viaChild.status, viaChild.json?.variantCode]);

  section("Gate / GET [id] bằng id mã con → hành xử như gốc, không lộ mã");
  const gChild = await api("GET", "/api/exams/g3-v2/gate", { as: h1 });
  check("gate(v2): exam.id = gốc, đếm lượt cả nhóm, không có variantNo / id mã con", gChild.status === 200 && gChild.json.exam.id === G.rootId && gChild.json.attempts.used === 1 && !/variantNo|variantOfId|g3-v[23]/.test(gChild.text), gChild.json);
  const gRoot = await api("GET", `/api/exams/${G.rootId}/gate`, { as: h1 });
  check("gate(gốc) giống gate(v2) về lượt/khả năng vào", gRoot.json.attempts.used === gChild.json.attempts.used && gRoot.json.canStart === gChild.json.canStart);
  const exChild = await api("GET", "/api/exams/g3-v2", { as: h1 });
  check("GET /api/exams/g3-v2 (học sinh) trả ĐỀ GỐC, không variantNo/variantOfId/blueprintId", exChild.status === 200 && exChild.json.id === G.rootId && !("variantNo" in exChild.json) && !("variantOfId" in exChild.json), exChild.json);
  const exRoot = await api("GET", `/api/exams/${G.rootId}`, { as: h1 });
  check("GET gốc (học sinh) cũng không có variantNo", exRoot.status === 200 && !("variantNo" in exRoot.json));
  const exStaff = await api("GET", "/api/exams/g3-v2", { as: T });
  check("gia sư xem đúng mã con mình hỏi (có variantNo)", exStaff.status === 200 && exStaff.json.id === "g3-v2" && exStaff.json.variantNo === 2);

  section("Số lượt đếm theo NHÓM (maxAttempts=2)");
  const r1 = await finish(h1, s1.json.attemptId, "g3a-q", true);
  check("nộp lượt 1 (mã 101) → 200", r1.status === 200 && r1.json.status === "submitted", r1.json);
  const s1b = await startAs(h1, G.rootId);
  check("lượt 2: CÙNG mã 101 (không có chuyện làm lại để gặp đề khác)", s1b.status === 200 && s1b.json.variantCode === 101 && (await exOf(s1b.json.attemptId)) === "g3-root");
  await finish(h1, s1b.json.attemptId, "g3a-q", false);
  const s1c = await startAs(h1, G.rootId);
  check("lượt 3 → 409 attempts_exhausted", s1c.status === 409 && s1c.json.code === "attempts_exhausted", s1c.json);
  const s1d = await startAs(h1, "g3-v2");
  check("PHÁ: thử lượt 3 bằng id mã con → vẫn 409 (không né được bằng mã khác)", s1d.status === 409 && s1d.json.code === "attempts_exhausted", s1d.json);
  check("DB: đúng 2 lượt của h1 trong cả nhóm", (await prisma.examAttempt.count({ where: { userId: h1.id, examId: { in: G.ids } } })) === 2);

  section("maxAttempts=1, lượt đầu ở MÃ KHÁC → lượt hai vẫn 409 (đếm theo nhóm, không theo examId)");
  const G1 = await mkGroup("g1", 3, 1);
  const hx = await studentFor(G1, 3, 3);
  const other = G1.ids.find(id => id !== "g1-v3")!;
  await prisma.examAttempt.create({ data: { userId: hx.id, examId: other, expiresAt: new Date(Date.now() - 3600_000), startedAt: new Date(Date.now() - 7200_000), status: "submitted", submittedAt: new Date(Date.now() - 3600_000), score: 1, totalPoints: 1 } });
  const sx = await startAs(hx, G1.rootId);
  check("đã làm 1 lượt ở mã khác với mã được chia → start 409 attempts_exhausted", sx.status === 409 && sx.json.code === "attempts_exhausted", sx.json);
  const gx = await api("GET", `/api/exams/${G1.rootId}/gate`, { as: hx });
  check("gate báo hết lượt (cả nhóm)", gx.json.canStart === false && gx.json.blockReason === "attempts_exhausted" && gx.json.attempts.used === 1, gx.json);

  section("Điểm / xếp hạng gộp theo nhóm");
  check("h1 làm 2 lượt ở mã 101 → đúng MỘT ExamResult, gắn với ĐỀ GỐC, giữ điểm tốt nhất", (await prisma.examResult.count({ where: { userId: h1.id } })) === 1 && !!(await prisma.examResult.findUnique({ where: { userId_examId: { userId: h1.id, examId: G.rootId } } })));
  const best = await prisma.examResult.findUnique({ where: { userId_examId: { userId: h1.id, examId: G.rootId } } });
  check("điểm giữ là lượt đúng (lượt 2 sai không hạ điểm)", (best?.score ?? 0) > 0, best?.score);
  const r2 = await finish(h2, s2.json.attemptId, "g3b-q", true);
  const r3 = await finish(h3, s3.json.attemptId, "g3c-q", true);
  check("h2 (mã 102), h3 (mã 103) nộp xong; mỗi người có ExamResult ở GỐC, không ở mã con", r2.status === 200 && r3.status === 200 && (await prisma.examResult.count({ where: { examId: { in: ["g3-v2", "g3-v3"] } } })) === 0 && (await prisma.examResult.count({ where: { examId: G.rootId } })) === 3);
  check("participants của GỐC tăng 1 cho mỗi học sinh (3), mã con không tăng", (await prisma.exam.findUnique({ where: { id: G.rootId } }))!.participants === 3 && (await prisma.exam.findUnique({ where: { id: "g3-v2" } }))!.participants === 0);
  check("submit trả hạng thật (có rank số) cho kiểm tra mode=null", typeof r2.json.rank === "number" && r2.json.rank >= 1, r2.json);
  const mineAll = await api("GET", "/api/exam-results?mine=true", { as: h1 });
  const rows = (mineAll.json as any[]).filter(r => r.examId === G.rootId);
  check("exam-results?mine: một dòng cho cả nhóm, examId = gốc", rows.length === 1 && !(mineAll.json as any[]).some(r => /g3-v/.test(r.examId)), mineAll.json);
  const lbRoot = await api("GET", `/api/exam-results?examId=${G.rootId}`, { as: h1 });
  const lbChild = await api("GET", "/api/exam-results?examId=g3-v2", { as: h1 });
  check("xếp hạng: gọi bằng gốc hay bằng mã con ra cùng một bảng (3 học sinh)", lbRoot.json.length === 3 && lbChild.json.length === 3);
  const histRoot = await api("GET", `/api/exams/${G.rootId}/attempts?mine=true`, { as: h1 });
  const histChild = await api("GET", "/api/exams/g3-v2/attempts?mine=true", { as: h1 });
  check("bài của tôi (attempts?mine): gộp cả nhóm, gốc = mã con", histRoot.json.length === 2 && histChild.json.length === 2 && !/examId|variant/.test(histRoot.text), [histRoot.json.length, histChild.json.length]);

  section("Danh sách: học sinh không thấy mã con; gia sư vẫn thấy");
  const listS = await api("GET", "/api/exams?active=true", { as: h1 });
  check("học sinh: có đề gốc g3-root, KHÔNG có g3-v2 / g3-v3", (listS.json as any[]).some(e => e.id === "g3-root") && !(listS.json as any[]).some(e => /^g3-v/.test(e.id)), (listS.json as any[]).map(e => e.id));
  const listG = await api("GET", "/api/exams?activeGuest=true");
  check("khách: không có mã con", listG.status === 200 && !(listG.json as any[]).some(e => e.variantOfId || /-v\d$/.test(e.id)));
  check("học sinh: đề trong danh sách không có variantNo/variantOfId", !/variantNo|variantOfId/.test(listS.text));
  const listT = await api("GET", "/api/exams", { as: T });
  check("gia sư: thấy cả mã con (để quản lý)", (listT.json as any[]).some(e => e.id === "g3-v2" && e.variantNo === 2));
  const dt = await api("GET", "/api/student/de-thi", { as: h1 });
  const mine = (dt.json.items as any[]).filter(i => /^g3/.test(i.id));
  check("student/de-thi: một dòng g3-root (không mã con), lượt đã dùng = 2 (cả nhóm), không lộ mã", mine.length === 1 && mine[0].id === "g3-root" && mine[0].attempts.used === 2 && !/variantNo|g3-v/.test(dt.text), mine);

  section("Chữa bài của lượt ở mã 102 (NV-188 theo lượt, không đụng nhóm)");
  const G2 = await mkGroup("g2", 2, null);
  const hy = await studentFor(G2, 2, 2);
  const sy = await startAs(hy, G2.rootId);
  check("học sinh được chia mã 102", sy.json.variantCode === 102, sy.json?.variantCode);
  await finish(hy, sy.json.attemptId, "g2b-q", false);
  const cor = await api("GET", `/api/exams/attempts/${sy.json.attemptId}/correction`, { as: hy });
  check("chữa bài của lượt mã 102: có 1 câu sai để chữa, lời giải chưa lộ", cor.status === 200 && cor.json.available === true && cor.json.items.length === 1 && cor.json.items[0].answer === null, cor.json);
  const rv = await api("GET", `/api/exams/attempts/${sy.json.attemptId}/review`, { as: hy });
  check("review: exam.id là GỐC, không lộ mã con; câu sai chưa chữa giấu đáp án", rv.status === 200 && rv.json.exam.id === G2.rootId && !/g2-v2|variantNo/.test(rv.text) && rv.json.questions[0].correctionPending === true, rv.json.exam);

  await done();
})();
