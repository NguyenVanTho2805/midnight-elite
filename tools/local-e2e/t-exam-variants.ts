// BU-03 P2 — API Mã đề: GET/POST /api/tutor/de-thi/[id]/ma-de, khoá nội dung mã đề con (409 VARIANT_LOCKED ở questions / reorder / import-save / PATCH quiz),
// cổng phát hành (FORMULA_UNREAD, NEED_SCHEDULE, VARIANTS_STALE, VARIANTS_NOT_READY), mã con không lọt danh sách.
// Cần máy chủ dev (BASE) + DB RIÊNG; wipe() ở đầu bài. Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-exam-variants.ts
// Ca phá bằng thiết kế (sửa mã → đúng ca đó đỏ): mỗi ca VARIANT_LOCKED có ĐỐI CHỨNG cùng thao tác trên đề GỐC phải thành công (nên 409 không đậu giả vì thân sai);
//   - makeVariants bỏ deleteMany → "tạo lại" làm số con nhân đôi; bỏ kiểm NOT_DRAFT → ca đề đã phát hành đỏ;
//   - variantMatchesRoot luôn true → ca VARIANTS_STALE đỏ; publish bỏ publishGate → ca FORMULA_UNREAD/NEED_SCHEDULE/NOT_READY đỏ;
//   - cờ VARIANT_STUDENT_SUPPORT bật (BU-04 xong) → ca NOT_READY tự đổi sang kiểm phát hành nguyên tử cả nhóm (đọc cờ từ mã, không cứng).
import { api, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { VARIANT_STUDENT_SUPPORT } from "@/lib/deThiAssign";
import { variantKey, variantCode } from "@/lib/deThiVariants";
import { mkActors, mkDraft, mkPublished, questionsOf, snap, skip, MCQ } from "./bu03";

const MD = (id: string) => `/api/tutor/de-thi/${id}/ma-de`;
const keyOf = (q: Awaited<ReturnType<typeof questionsOf>>[number]) => variantKey({ type: q.type, text: q.text, options: q.options.map(o => ({ text: o.text, isCorrect: o.isCorrect })) });
const keysOf = async (id: string) => (await questionsOf(id)).map(keyOf);
const childrenOf = (rootId: string) => prisma.exam.findMany({ where: { variantOfId: rootId }, orderBy: { variantNo: "asc" } });

(async () => {
  await wipe();
  const a = await mkActors();
  const { A, B, courseA } = a;

  section("ma-de POST: kiểm thân yêu cầu (không tạo gì khi sai)");
  const D = await mkDraft(A, { n: 8, courseId: courseA.id, points: 1 });
  {
    const post = (body: unknown) => api("POST", MD(D), { as: A, body });
    for (const [label, c] of [["1", 1], ["9", 9], ["0", 0], ["-2", -2], ["2.5", 2.5], ["chuỗi '3'", "3"], ["thiếu", undefined], ["null", null]] as const) {
      const r = await post({ count: c });
      check(`count = ${label} → 400 BAD_COUNT`, r.status === 400 && r.json?.code === "BAD_COUNT", [r.status, r.json]);
    }
    const nothing = await post({ count: 3, shuffleQuestions: false, shuffleOptions: false });
    check("tắt cả hai kiểu đảo → 400 NOTHING_TO_SHUFFLE (các mã đề sẽ giống hệt nhau)", nothing.status === 400 && nothing.json?.code === "NOTHING_TO_SHUFFLE", [nothing.status, nothing.json]);
    for (const [label, f] of [["0 (đánh số từ 1)", [0]], ["9 (ngoài 8 câu)", [9]], ["1.5", [1.5]], ["chữ", ["a"]], ["không phải mảng", "1"]] as const) {
      const r = await post({ count: 3, fixed: f });
      check(`fixed = ${label} → 400 BAD_FIXED`, r.status === 400 && r.json?.code === "BAD_FIXED", [r.status, r.json]);
    }
    check("thân không phải đối tượng → 400", (await api("POST", MD(D), { as: A, raw: "null", headers: { "content-type": "application/json" } })).status === 400);
    const empty = (await api("POST", "/api/tutor/quiz", { as: A, body: { title: "Đề rỗng" } })).json.id as string;
    const rn = await api("POST", MD(empty), { as: A, body: { count: 3 } });
    check("đề chưa có câu → 400 NO_QUESTIONS", rn.status === 400 && rn.json?.code === "NO_QUESTIONS", [rn.status, rn.json]);
    check("mọi ca lỗi trên: đề D vẫn không có mã con nào", (await childrenOf(D)).length === 0);
    const pub = await mkPublished(A, courseA.id, { n: 3 });
    const rp = await api("POST", MD(pub), { as: A, body: { count: 2 } });
    check("đề đã phát hành → 409 NOT_DRAFT, không tạo mã con", rp.status === 409 && rp.json?.code === "NOT_DRAFT" && (await childrenOf(pub)).length === 0, [rp.status, rp.json]);
    const g = await api("GET", MD(D), { as: A });
    check("GET ma-de khi chưa có con: chỉ mã gốc (101), hasVariants=false", g.status === 200 && g.json?.hasVariants === false && g.json?.variants?.length === 1 && g.json.variants[0].code === 101 && g.json.variants[0].id === D, g.json);
  }

  section("ma-de POST: tạo N mã — đủ câu, cùng bộ câu, đáp án đúng giữ đúng, mã 101..");
  {
    const rootKeys = await keysOf(D);
    const r = await api("POST", MD(D), { as: A, body: { count: 4 } });
    check("201 + 4 mã (gốc + 3 con), codes 101..104, variantNo 1..4", r.status === 201 && r.json?.variants?.map((v: any) => v.code).join() === "101,102,103,104" && r.json.variants.map((v: any) => v.variantNo).join() === "1,2,3,4" && r.json.hasVariants === true, [r.status, r.json?.variants]);
    check("mỗi mã báo đủ 8 câu; studentSupport phản ánh đúng cờ VARIANT_STUDENT_SUPPORT của mã nguồn", r.json?.variants?.every((v: any) => v.questionCount === 8) && r.json.studentSupport === VARIANT_STUDENT_SUPPORT, [r.json?.studentSupport, VARIANT_STUDENT_SUPPORT]);
    check("variantCode() khớp: 100 + số thứ tự", [1, 2, 3, 4].every((n, i) => r.json?.variants?.[i]?.code === variantCode(n)));
    const kids = await childrenOf(D);
    check("DB: 3 con, variantOfId = D, variantNo 2..4, đều NHÁP và chưa mở (không tới học sinh)", kids.length === 3 && kids.map(k => k.variantNo).join() === "2,3,4" && kids.every(k => k.isDraft && !k.active && k.variantOfId === D));
    check("con thừa hưởng chủ, lớp, tiêu đề, tổng điểm của gốc; không giá, không mở khách", kids.every(k => k.ownerId === A.id && k.courseId === courseA.id && k.title === "Đề thử BU-03" && k.price === null && !k.activeGuest && !k.guestCanTake && k.totalPoints === 8));
    let sameSet = true, oneRight = true, anyOrderDiff = false, anyOptDiff = false;
    const rootQs = await questionsOf(D);
    for (const k of kids) {
      const ks = await keysOf(k.id), kq = await questionsOf(k.id);
      if ([...ks].sort().join() !== [...rootKeys].sort().join()) sameSet = false;
      if (ks.join() !== rootKeys.join()) anyOrderDiff = true;
      if (!kq.every(q => q.options.length === 4 && q.options.filter(o => o.isCorrect).length === 1)) oneRight = false;
      for (const q of kq) { const rq = rootQs.find(x => keyOf(x) === keyOf(q))!; if (rq.options.map(o => o.text).join() !== q.options.map(o => o.text).join()) anyOptDiff = true; }
    }
    check("mọi mã con có CÙNG bộ câu với gốc (so theo variantKey: chữ + đáp án đúng, không phụ thuộc thứ tự)", sameSet);
    check("đáp án đúng giữ nguyên sau khi đảo phương án (mỗi câu đúng 1 đáp án đúng; variantKey không đổi ở trên)", oneRight);
    check("có thật sự đảo: ít nhất một mã con khác thứ tự câu, và ít nhất một câu bị đảo phương án (kiểm có thể đỏ nếu không đảo gì)", anyOrderDiff && anyOptDiff, [anyOrderDiff, anyOptDiff]);
    check("đề GỐC không bị đụng: vẫn 8 câu đúng thứ tự cũ", (await keysOf(D)).join() === rootKeys.join());
    const g = await api("GET", MD(D), { as: A });
    check("GET ma-de: hasVariants=true và 4 mã", g.json?.hasVariants === true && g.json.variants.length === 4);
    const oldIds = kids.map(k => k.id);

    section("ma-de POST: TẠO LẠI thay thế (không nhân đôi) + câu cố định + chỉ đảo câu / chỉ đảo phương án");
    const re = await api("POST", MD(D), { as: A, body: { count: 3, fixed: [1, 8], shuffleQuestions: true, shuffleOptions: false } });
    const kids2 = await childrenOf(D);
    check("tạo lại count=3 → 201, còn đúng 2 con (không cộng dồn với 3 con cũ)", re.status === 201 && kids2.length === 2 && kids2.map(k => k.variantNo).join() === "2,3", [re.status, kids2.length]);
    check("con cũ bị xoá hẳn (id cũ không còn trong DB)", (await prisma.exam.count({ where: { id: { in: oldIds } } })) === 0);
    check("câu thuộc con cũ cũng không còn mồ côi (tổng số câu = gốc 8 + 2 con × 8)", (await prisma.examQuestion.count({ where: { examId: { in: [D, ...kids2.map(k => k.id)] } } })) === 24 && (await prisma.examQuestion.count({ where: { examId: { in: oldIds } } })) === 0);
    let fixedOk = true, optSame = true;
    const rk = await keysOf(D), rootQs2 = await questionsOf(D);
    for (const k of kids2) {
      const ks = await keysOf(k.id), kq = await questionsOf(k.id);
      if (ks[0] !== rk[0] || ks[7] !== rk[7]) fixedOk = false;
      for (const q of kq) { const rq = rootQs2.find(x => keyOf(x) === keyOf(q))!; if (rq.options.map(o => o.text).join() !== q.options.map(o => o.text).join()) optSame = false; }
    }
    check("fixed [1,8] (đánh số từ 1): câu 1 và câu 8 đứng nguyên chỗ ở MỌI mã con", fixedOk);
    check("shuffleOptions=false: thứ tự phương án của mọi câu giống gốc", optSame);

    const onlyOpt = await api("POST", MD(D), { as: A, body: { count: 2, shuffleQuestions: false, shuffleOptions: true } });
    const k3 = await childrenOf(D);
    check("shuffleQuestions=false: thứ tự câu của mã con GIỐNG gốc", onlyOpt.status === 201 && k3.length === 1 && (await keysOf(k3[0].id)).join() === rk.join());

    section("ma-de: mã đề con không tự có mã đề; câu có phương án tham chiếu ('Cả A và B') giữ nguyên thứ tự");
    const kid = k3[0].id;
    const gc = await api("GET", MD(kid), { as: A }), pc = await api("POST", MD(kid), { as: A, body: { count: 2 } });
    check("GET/POST ma-de trên MÃ CON → 400 IS_VARIANT kèm variantOfId", gc.status === 400 && gc.json?.code === "IS_VARIANT" && gc.json.variantOfId === D && pc.status === 400 && pc.json?.code === "IS_VARIANT", [gc.json, pc.json]);
    const U = await mkDraft(A, { n: 0, courseId: courseA.id });
    await api("POST", `/api/tutor/quiz/${U}/questions`, { as: A, body: { type: "MC", text: "Câu có phương án tham chiếu", points: 1, options: [{ text: "Cả A và B", isCorrect: true }, { text: "Chỉ A", isCorrect: false }, { text: "Chỉ B", isCorrect: false }, { text: "Không đáp án nào đúng", isCorrect: false }] } });
    for (let i = 1; i <= 3; i++) await api("POST", `/api/tutor/quiz/${U}/questions`, { as: A, body: MCQ(`Câu thường ${i}`, i % 4) });
    const ru = await api("POST", MD(U), { as: A, body: { count: 4 } });
    check("201 và có cảnh báo OPTIONS_NOT_SHUFFLED cho câu 1", ru.status === 201 && ru.json?.warnings?.some((w: any) => w.code === "OPTIONS_NOT_SHUFFLED" && w.questionIndex === 0), ru.json?.warnings);
    const rootU = await questionsOf(U);
    let ref = true;
    for (const k of await childrenOf(U)) { const q = (await questionsOf(k.id)).find(x => x.text.startsWith("Câu có phương án"))!; if (q.options.map(o => o.text).join() !== rootU[0].options.map(o => o.text).join()) ref = false; }
    check("câu tham chiếu giữ NGUYÊN thứ tự phương án ở mọi mã con (đảo sẽ làm 'Cả A và B' sai nghĩa)", ref);
  }

  section("Mã con khoá nội dung: 409 VARIANT_LOCKED ở questions / PUT / DELETE / reorder / import-save / PATCH quiz");
  {
    const L = await mkDraft(A, { n: 4, courseId: courseA.id });
    await api("POST", MD(L), { as: A, body: { count: 2 } });
    const C = (await childrenOf(L))[0].id;
    const cq = await questionsOf(C), before = JSON.stringify(cq.map(q => [q.id, q.order, q.text, q.options.map(o => o.text)]));
    const lock = (r: { status: number; json: any }) => r.status === 409 && r.json?.code === "VARIANT_LOCKED" && r.json?.variantOfId === L;
    const t1 = await api("POST", `/api/tutor/quiz/${C}/questions`, { as: A, body: MCQ("Thêm vào con") });
    const t2 = await api("PUT", `/api/tutor/quiz/${C}/questions/${cq[0].id}`, { as: A, body: MCQ("Sửa con") });
    const t3 = await api("DELETE", `/api/tutor/quiz/${C}/questions/${cq[0].id}`, { as: A });
    const t4 = await api("POST", `/api/tutor/quiz/${C}/questions/reorder`, { as: A, body: { ids: [...cq].reverse().map(q => q.id) } });
    const t5 = await api("POST", "/api/tutor/quiz/import-save", { as: A, body: { targetExamId: C, questions: [MCQ("Nhập vào con")] } });
    const t6 = await api("PATCH", `/api/tutor/quiz/${C}`, { as: A, body: { title: "Đổi tên con" } });
    check("POST câu vào con → 409 VARIANT_LOCKED", lock(t1), [t1.status, t1.json]);
    check("PUT sửa câu con → 409 VARIANT_LOCKED", lock(t2), [t2.status, t2.json]);
    check("DELETE câu con → 409 VARIANT_LOCKED", lock(t3), [t3.status, t3.json]);
    check("reorder câu con → 409 VARIANT_LOCKED", lock(t4), [t4.status, t4.json]);
    check("import-save vào con (targetExamId) → 409 VARIANT_LOCKED", lock(t5), [t5.status, t5.json]);
    check("PATCH quiz con → 409 VARIANT_LOCKED", lock(t6), [t6.status, t6.json]);
    check("sau cả loạt: các câu của con y nguyên, tên con y nguyên", JSON.stringify((await questionsOf(C)).map(q => [q.id, q.order, q.text, q.options.map(o => o.text)])) === before && (await prisma.exam.findUnique({ where: { id: C } }))?.title === "Đề thử BU-03");
    // ĐỐI CHỨNG: đúng các thao tác đó trên đề GỐC thành công
    const rq = await questionsOf(L);
    const o1 = await api("POST", `/api/tutor/quiz/${L}/questions`, { as: A, body: MCQ("Thêm vào gốc") });
    const o2 = await api("PUT", `/api/tutor/quiz/${L}/questions/${rq[0].id}`, { as: A, body: MCQ("Sửa gốc") });
    const o3 = await api("POST", `/api/tutor/quiz/${L}/questions/reorder`, { as: A, body: { ids: [...(await questionsOf(L))].reverse().map(q => q.id) } });
    const o4 = await api("POST", "/api/tutor/quiz/import-save", { as: A, body: { targetExamId: L, questions: [MCQ("Nhập vào gốc")] } });
    const o5 = await api("PATCH", `/api/tutor/quiz/${L}`, { as: A, body: { title: "Đổi tên gốc" } });
    const o6 = await api("DELETE", `/api/tutor/quiz/${L}/questions/${(await questionsOf(L))[0].id}`, { as: A });
    check("ĐỐI CHỨNG đề gốc: thêm 201, sửa 200, đổi thứ tự 200, nhập 200, đổi tên 200, xoá 200 (nên 409 ở trên là do KHOÁ, không do thân sai)", [o1, o2, o3, o4, o5, o6].map(x => x.status).join() === "201,200,200,200,200,200", [o1, o2, o3, o4, o5, o6].map(x => x.status));
    const pc = await api("POST", `/api/tutor/quiz/${C}/publish`, { as: A });
    check("phát hành riêng một mã con → 400 IS_VARIANT (phát hành cùng đề gốc)", pc.status === 400 && pc.json?.code === "IS_VARIANT", [pc.status, pc.json]);
    check("sau khi sửa gốc, mã con KHÔNG tự đổi theo (chỉ 'tạo lại' mới đồng bộ) — con vẫn 4 câu cũ, không câu mới nào của gốc", (await questionsOf(C)).length === 4 && (await questionsOf(C)).every(q => !/Sửa gốc|Nhập vào gốc|Thêm vào gốc/.test(q.text)));
  }

  section("Mã con không lọt vào danh sách của gia sư");
  {
    const E = await mkDraft(A, { n: 4, courseId: courseA.id, title: "Đề có mã con (danh sách)" });
    await api("POST", MD(E), { as: A, body: { count: 3 } });
    const kids = (await childrenOf(E)).map(k => k.id);
    const list = await api("GET", "/api/tutor/de-thi", { as: A });
    const row = list.json?.items?.find((x: any) => x.id === E);
    check("GET de-thi: đề gốc có variants = 3 (gộp), không hàng nào là mã con", row?.variants === 3 && kids.every(k => !list.text.includes(k)), row);
    const picker = await api("GET", "/api/tutor/quiz", { as: A });
    check("GET /api/tutor/quiz (bộ chọn thêm câu): không liệt kê mã con", picker.status === 200 && kids.every(k => !picker.text.includes(k)) && picker.text.includes(E));
    const sl = await api("GET", "/api/exams?active=true", { as: a.S });
    check("danh sách đề của học sinh: không có đề nháp lẫn mã con", sl.status === 200 && kids.every(k => !sl.text.includes(k)) && !sl.text.includes(E));
    check("học sinh mở thẳng mã con → 404 (bản nháp không tới học sinh)", (await api("GET", `/api/exams/${kids[0]}`, { as: a.S })).status === 404);
  }

  section("Cổng phát hành: FORMULA_UNREAD, NEED_SCHEDULE, VARIANTS_STALE, VARIANTS_NOT_READY");
  {
    const isDraft = async (id: string) => (await prisma.exam.findUnique({ where: { id } }))?.isDraft === true;
    // 1) công thức chưa đọc: ở đề, ở phương án, ở lời giải
    const F = await mkDraft(A, { n: 2, courseId: courseA.id });
    const fq = await api("POST", `/api/tutor/quiz/${F}/questions`, { as: A, body: MCQ("Tính ⟦công thức⟧ bằng bao nhiêu?") });
    const pf = await api("POST", `/api/tutor/quiz/${F}/publish`, { as: A });
    check("câu còn nhãn ⟦công thức⟧ trong ĐỀ → 422 FORMULA_UNREAD, đề vẫn nháp", pf.status === 422 && pf.json?.code === "FORMULA_UNREAD" && await isDraft(F), [pf.status, pf.json]);
    const fqid = (await questionsOf(F)).find(q => q.text.includes("⟦"))!.id;
    await api("PUT", `/api/tutor/quiz/${F}/questions/${fqid}`, { as: A, body: { ...MCQ("Câu đã gõ lại"), options: [{ text: "x ⟦công thức⟧", isCorrect: true }, { text: "b", isCorrect: false }, { text: "c", isCorrect: false }, { text: "d", isCorrect: false }] } });
    check("còn nhãn trong PHƯƠNG ÁN → vẫn 422 FORMULA_UNREAD", (await api("POST", `/api/tutor/quiz/${F}/publish`, { as: A })).json?.code === "FORMULA_UNREAD");
    await api("PUT", `/api/tutor/quiz/${F}/questions/${fqid}`, { as: A, body: { ...MCQ("Câu đã gõ lại"), explanation: "Xem ⟦công thức⟧" } });
    check("còn nhãn trong LỜI GIẢI → vẫn 422 FORMULA_UNREAD", (await api("POST", `/api/tutor/quiz/${F}/publish`, { as: A })).json?.code === "FORMULA_UNREAD");
    await api("PUT", `/api/tutor/quiz/${F}/questions/${fqid}`, { as: A, body: { ...MCQ("Câu đã gõ lại sạch nhãn"), explanation: "" } });
    const okf = await api("POST", `/api/tutor/quiz/${F}/publish`, { as: A });
    check("ĐỐI CHỨNG: gõ lại hết nhãn thì phát hành được (200) — cổng không chặn nhầm", okf.status === 200 && !(await isDraft(F)), [okf.status, okf.json]);
    void fq;

    // 2) bài kiểm tra thiếu giờ
    const N = await mkDraft(A, { n: 3, courseId: courseA.id });
    const pm = await api("PATCH", `/api/tutor/de-thi/${N}/giao`, { as: A, body: { mode: "test" } });
    check("dựng: đặt chế độ kiểm tra (đủ giờ mặc định) → 200", pm.status === 200, pm.text.slice(0, 200));
    await prisma.exam.update({ where: { id: N }, data: { time: "" } });
    const pn = await api("POST", `/api/tutor/quiz/${N}/publish`, { as: A });
    check("mode=test mà thiếu giờ mở → 422 NEED_SCHEDULE, đề vẫn nháp", pn.status === 422 && pn.json?.code === "NEED_SCHEDULE" && await isDraft(N), [pn.status, pn.json]);
    await prisma.exam.update({ where: { id: N }, data: { time: "19:30" } });
    const pn2 = await api("POST", `/api/tutor/quiz/${N}/publish`, { as: A });
    check("ĐỐI CHỨNG: có đủ giờ thì phát hành được", pn2.status === 200, [pn2.status, pn2.json]);

    // 3) mã đề: lỗi thời, rồi cổng phòng thi học sinh
    const V = await mkDraft(A, { n: 4, courseId: courseA.id });
    await api("POST", MD(V), { as: A, body: { count: 2 } });
    const rq = await questionsOf(V);
    await api("PUT", `/api/tutor/quiz/${V}/questions/${rq[0].id}`, { as: A, body: MCQ("Câu 1 đã sửa sau khi tạo mã đề") });
    const ps = await api("POST", `/api/tutor/quiz/${V}/publish`, { as: A });
    check("sửa đề gốc SAU khi tạo mã đề → 422 VARIANTS_STALE (mã con không còn khớp)", ps.status === 422 && ps.json?.code === "VARIANTS_STALE", [ps.status, ps.json]);
    check("422 thì cả nhóm vẫn nháp (không phát hành nửa chừng)", await isDraft(V) && (await childrenOf(V)).every(k => k.isDraft));
    await api("POST", MD(V), { as: A, body: { count: 2 } });
    const pr = await api("POST", `/api/tutor/quiz/${V}/publish`, { as: A });
    if (!VARIANT_STUDENT_SUPPORT) {
      check("tạo lại mã đề (khớp lại) → 422 VARIANTS_NOT_READY (phòng thi học sinh chưa hỗ trợ mã đề; cờ = false)", pr.status === 422 && pr.json?.code === "VARIANTS_NOT_READY", [pr.status, pr.json]);
      check("422 thì gốc và mọi con vẫn nháp, không active", await isDraft(V) && (await childrenOf(V)).every(k => k.isDraft && !k.active));
      skip("phát hành nguyên tử cả nhóm mã đề — chỉ kiểm được khi VARIANT_STUDENT_SUPPORT = true (chờ BU-04)");
    } else {
      check("cờ VARIANT_STUDENT_SUPPORT = true: phát hành được (200)", pr.status === 200, [pr.status, pr.json]);
      const all = [await prisma.exam.findUnique({ where: { id: V } }), ...(await childrenOf(V))];
      check("phát hành NGUYÊN TỬ: gốc và mọi con cùng !isDraft, active, cùng status", all.every(e => e && !e.isDraft && e.active && e.status === all[0]!.status), all.map(e => [e?.isDraft, e?.active, e?.status]));
    }
    // 4) đề một mã không bị cổng mã đề chặn
    const one = await mkPublished(A, courseA.id, { n: 2 });
    check("ĐỐI CHỨNG: đề MỘT mã phát hành bình thường (cổng mã đề chỉ chặn khi N>1)", !!one);
  }

  section("Quyền gắn với mã đề (đầy đủ ở t-bu03-quyen)");
  {
    const X = await mkDraft(A, { n: 3, courseId: courseA.id });
    const s0 = await snap();
    const rb = await api("POST", MD(X), { as: B, body: { count: 3 } });
    check("gia sư B tạo mã đề cho đề của A → 403 và không tạo gì", rb.status === 403 && (await childrenOf(X)).length === 0 && (await snap()) === s0, [rb.status, rb.json]);
    check("gia sư B xem ma-de của A → 403; id không có → 404", (await api("GET", MD(X), { as: B })).status === 403 && (await api("GET", MD("khong-co"), { as: A })).status === 404);
  }

  await done();
})().catch(e => { console.error(e); process.exit(1); });
