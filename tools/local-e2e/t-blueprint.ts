// BU-03 P2 — API Ma trận đề: CRUD (/api/tutor/de-thi/ma-tran), bốc / đổi câu (rut, doi-cau — chỉ xem trước), tạo đề từ câu đã bốc (tao-tu-ma-tran).
// Cần máy chủ dev (BASE) + DB RIÊNG; wipe() ở đầu bài. Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-blueprint.ts
// Phần ma trận quyền đầy đủ của từng route nằm ở t-bu03-quyen; ở đây chỉ kiểm quyền gắn với LUẬT BỐC (kho thấy được).
// Ca phá bằng thiết kế (sửa mã → đúng ca đó đỏ):
//   - loadPool bỏ visibleBankWhere (bốc cả nháp người khác) → ca "B không bao giờ bốc nháp của A" đỏ và have_B = have_A;
//   - drawFromBlueprint bỏ khử trùng contentHash giữa các dòng → ca "không trùng nội dung giữa dòng" đỏ;
//   - tao-tu-ma-tran bỏ allowShort/422 → ca SHORTAGE đỏ; sao chép thay vì tham chiếu → ca "sửa đề không đổi ngân hàng" đỏ;
//   - rut/doi-cau ghi DB → snap() đổi → ca "chỉ xem trước" đỏ; validateBlueprintRows nhận khoá lạ → ca "đúng ba khoá" đỏ.
import { api, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { mkActors, mkTree, mkBank, snap } from "./bu03";

const BP = "/api/tutor/de-thi/ma-tran", RUT = `${BP}/rut`, DOI = `${BP}/doi-cau`, TAO = "/api/tutor/de-thi/tao-tu-ma-tran";
const ids = (r: any): string[] => (r.json?.picks ?? []).flatMap((p: any) => p.itemIds as string[]);

(async () => {
  await wipe();
  const a = await mkActors();
  const { A, B, courseA, courseB } = a;
  const t = await mkTree();

  // Kho: B soạn & đã duyệt (kho chung); A có nháp riêng + câu đã duyệt riêng ở chương khác.
  const approvedNB = [] as string[], approvedTH = [] as string[], draftsA = [] as string[];
  for (let i = 0; i < 4; i++) approvedNB.push((await mkBank({ ownerId: B.id, categoryId: t.c11, difficulty: "NB" })).id);
  for (let i = 0; i < 2; i++) approvedTH.push((await mkBank({ ownerId: B.id, categoryId: t.c11, difficulty: "TH" })).id);
  for (let i = 0; i < 3; i++) draftsA.push((await mkBank({ ownerId: A.id, categoryId: t.c11, difficulty: "NB", status: "draft" })).id);
  const x1 = await mkBank({ ownerId: B.id, categoryId: t.c11, difficulty: "NB", text: "Câu trùng nội dung giữa hai nút" });
  const x2 = await mkBank({ ownerId: B.id, categoryId: t.c1, difficulty: "NB", text: "Câu trùng nội dung giữa hai nút" });
  await mkBank({ ownerId: A.id, categoryId: t.c2, difficulty: "VD" }); await mkBank({ ownerId: A.id, categoryId: t.c2, difficulty: "VD" });
  const hashOf = async (idList: string[]) => (await prisma.questionBankItem.findMany({ where: { id: { in: idList } }, select: { id: true, contentHash: true } })).map(x => x.contentHash);

  section("CRUD ma trận: kiểm thân yêu cầu");
  const rowsOK = [{ categoryId: t.c1, difficulty: "NB", count: 3 }, { categoryId: t.c11, difficulty: "NB", count: 3 }];
  const bad = async (label: string, body: unknown, code?: string, status = 400) => {
    const r = await api("POST", BP, { as: A, body });
    check(`POST ma-tran: ${label} → ${status}${code ? " " + code : ""}`, r.status === status && (!code || r.json?.code === code), [r.status, r.json]);
  };
  {
    const s0 = await snap();
    await bad("thiếu tên", { rows: rowsOK }, "BAD_NAME");
    await bad("tên toàn dấu cách", { name: "   ", rows: rowsOK }, "BAD_NAME");
    await bad(`tên 101 ký tự`, { name: "x".repeat(101), rows: rowsOK }, "BAD_NAME");
    await bad("không có dòng nào", { name: "M", rows: [] }, "EMPTY");
    await bad("rows không phải mảng", { name: "M", rows: "x" }, "EMPTY");
    await bad("dòng có số câu 0", { name: "M", rows: [{ categoryId: t.c11, difficulty: "NB", count: 0 }] }, "BAD_ROW");
    await bad("dòng có số câu 101", { name: "M", rows: [{ categoryId: t.c11, difficulty: "NB", count: 101 }] }, "BAD_ROW");
    await bad("dòng có số câu 1.5", { name: "M", rows: [{ categoryId: t.c11, difficulty: "NB", count: 1.5 }] }, "BAD_ROW");
    await bad("dòng có số câu dạng chữ '3'", { name: "M", rows: [{ categoryId: t.c11, difficulty: "NB", count: "3" }] }, "BAD_ROW");
    await bad("mức 'XX'", { name: "M", rows: [{ categoryId: t.c11, difficulty: "XX", count: 1 }] }, "BAD_ROW");
    await bad("thiếu categoryId", { name: "M", rows: [{ difficulty: "NB", count: 1 }] }, "BAD_ROW");
    await bad("dòng không phải đối tượng", { name: "M", rows: [null] }, "BAD_ROW");
    await bad("51 dòng", { name: "M", rows: Array.from({ length: 51 }, () => ({ categoryId: t.c11, difficulty: "NB", count: 1 })) }, "TOO_MANY_ROWS");
    await bad("tổng 300 câu (3 × 100)", { name: "M", rows: Array.from({ length: 3 }, () => ({ categoryId: t.c11, difficulty: "NB", count: 100 })) }, "TOO_MANY_TOTAL");
    const nf = await api("POST", BP, { as: A, body: { name: "M", rows: [...rowsOK, { categoryId: "nut-khong-co", difficulty: "TH", count: 1 }] } });
    check("POST ma-tran: nút ngân hàng không có → 404 kèm rowIndex dòng lỗi (2)", nf.status === 404 && nf.json?.rowIndex === 2, [nf.status, nf.json]);
    check("thân không đọc được → 400", (await api("POST", BP, { as: A, raw: "{hỏng", headers: { "content-type": "application/json" } })).status === 400);
    check("mọi ca lỗi trên không tạo ma trận nào", (await snap()) === s0);
  }

  section("CRUD ma trận: tạo, đọc, sửa, xoá");
  let bpId = "";
  {
    const c = await api("POST", BP, { as: A, body: { name: "  Ma   trận   mẫu  ", rows: rowsOK.map(r => ({ ...r, evil: 1, ownerId: B.id })) } });
    bpId = c.json?.id;
    check("tạo → 201 {id}", c.status === 201 && !!bpId, [c.status, c.json]);
    const row = await prisma.examBlueprint.findUnique({ where: { id: bpId } });
    check("tên được chuẩn hoá khoảng trắng; chủ = A (bỏ ownerId trong thân)", row?.name === "Ma trận mẫu" && row.ownerId === A.id, [row?.name, row?.ownerId]);
    check("rows lưu ĐÚNG ba khoá { categoryId, difficulty, count } — khoá lạ bị bỏ", JSON.stringify((row?.rows as any[])?.map(r => Object.keys(r).sort())) === JSON.stringify([["categoryId", "count", "difficulty"], ["categoryId", "count", "difficulty"]]), row?.rows);
    const g = await api("GET", `${BP}/${bpId}`, { as: A });
    check("GET một ma trận: {id,name,rows,total=6,updatedAt}", g.status === 200 && g.json?.id === bpId && g.json?.total === 6 && g.json?.rows?.length === 2 && typeof g.json?.updatedAt === "string", g.json);
    const lst = await api("GET", BP, { as: A });
    check("GET danh sách: có ma trận của A", lst.json?.items?.some((x: any) => x.id === bpId && x.total === 6), lst.json);
    const lb = await api("GET", BP, { as: B });
    check("GET danh sách của B: rỗng (cô lập)", lb.status === 200 && lb.json?.items?.length === 0, lb.json);
    const u = await api("PUT", `${BP}/${bpId}`, { as: A, body: { name: "Ma trận mẫu v2", rows: [{ categoryId: t.c11, difficulty: "TH", count: 2 }] } });
    check("PUT → 200 cùng id; nội dung đã đổi (không sinh bản mới)", u.status === 200 && u.json?.id === bpId && (await prisma.examBlueprint.count()) === 1 && (await prisma.examBlueprint.findUnique({ where: { id: bpId } }))?.name === "Ma trận mẫu v2");
    const ub = await api("PUT", `${BP}/${bpId}`, { as: A, body: { name: "x", rows: [] } });
    check("PUT thân sai → 400 và nội dung cũ còn nguyên", ub.status === 400 && (await prisma.examBlueprint.findUnique({ where: { id: bpId } }))?.name === "Ma trận mẫu v2");
    const ub2 = await api("PUT", `${BP}/${bpId}`, { as: A, body: { name: "y", rows: [{ categoryId: "nut-la", difficulty: "NB", count: 1 }] } });
    check("PUT trỏ nút không có → 404, nội dung cũ còn nguyên", ub2.status === 404 && (await prisma.examBlueprint.findUnique({ where: { id: bpId } }))?.name === "Ma trận mẫu v2");
    await api("PUT", `${BP}/${bpId}`, { as: A, body: { name: "Ma trận mẫu", rows: rowsOK } });
  }

  section("rut: bốc đủ, cùng hạt cùng kết quả, không trùng giữa dòng, chỉ xem trước");
  {
    const s0 = await snap();
    const r1 = await api("POST", RUT, { as: A, body: { rows: rowsOK, seed: "hat-1" } });
    check("200 + hai dòng + không thiếu + trả lại hạt", r1.status === 200 && r1.json?.picks?.length === 2 && r1.json?.shortages?.length === 0 && r1.json?.seed === "hat-1", [r1.status, r1.json?.shortages]);
    const pick = ids(r1);
    check("đủ 3 + 3 = 6 câu, 6 id khác nhau", pick.length === 6 && new Set(pick).size === 6, pick);
    check("mỗi câu có bản xem trước (text, type, difficulty, categoryId)", (r1.json?.picks ?? []).every((p: any) => p.items?.length === p.itemIds.length && p.items.every((i: any) => typeof i.text === "string" && i.difficulty === "NB")));
    check("KHÔNG trùng nội dung giữa các dòng: hai câu cùng contentHash (x1 ở c11, x2 ở c1) không bao giờ cùng xuất hiện", !(pick.includes(x1.id) && pick.includes(x2.id)) && new Set(await hashOf(pick)).size === 6);
    check("câu bốc đều nằm trong nhánh Chương 1 và là mức NB", (await prisma.questionBankItem.findMany({ where: { id: { in: pick } } })).every(i => [t.c1, t.c11].includes(i.categoryId) && i.difficulty === "NB"));
    const r1b = await api("POST", RUT, { as: A, body: { rows: rowsOK, seed: "hat-1" } });
    check("cùng hạt → CÙNG kết quả", JSON.stringify(ids(r1b)) === JSON.stringify(pick));
    const seeds = ["a", "b", "c", "d", "e", "f"];
    const outs = new Set<string>();
    for (const s of seeds) outs.add(JSON.stringify(ids(await api("POST", RUT, { as: A, body: { rows: rowsOK, seed: s } }))));
    check("khác hạt → có khác kết quả (6 hạt không thể cùng ra một bộ)", outs.size > 1, [...outs].length);
    const noSeed = await api("POST", RUT, { as: A, body: { rows: rowsOK } });
    check("không gửi hạt → máy chủ sinh hạt mới, trả lại", typeof noSeed.json?.seed === "string" && noSeed.json.seed.length > 8);
    check("rut CHỈ XEM TRƯỚC: DB không đổi sau mọi lần bốc", (await snap()) === s0);
  }

  section("rut: thiếu → shortages (không tự hạ mức); kho của B không có nháp của A");
  {
    const th = await api("POST", RUT, { as: A, body: { rows: [{ categoryId: t.c11, difficulty: "TH", count: 5 }], seed: "s" } });
    check("cần 5 TH chỉ có 2 → shortages [{rowIndex 0, need 5, have 2}] và bốc được 2 (không lấy mức khác bù)", th.json?.shortages?.length === 1 && th.json.shortages[0].need === 5 && th.json.shortages[0].have === 2 && ids(th).length === 2 && ids(th).every(i => approvedTH.includes(i)), th.json?.shortages);
    const want = { rows: [{ categoryId: t.c11, difficulty: "NB", count: 8 }], seed: "k" };
    const ra = await api("POST", RUT, { as: A, body: want }), rb = await api("POST", RUT, { as: B, body: want });
    check("A (thấy 3 nháp của mình + 5 đã duyệt) bốc đủ 8, không thiếu", ra.status === 200 && ra.json?.shortages?.length === 0 && ids(ra).length === 8, [ra.json?.shortages, ids(ra).length]);
    check("A bốc cả nháp của chính mình (đúng thiết kế: kho thấy được)", draftsA.every(d => ids(ra).includes(d)));
    check("B chỉ thấy câu đã duyệt: thiếu (need 8, have 5) và KHÔNG câu nháp nào của A lọt vào", rb.json?.shortages?.[0]?.need === 8 && rb.json.shortages[0].have === 5 && !ids(rb).some(i => draftsA.includes(i)), [rb.json?.shortages, ids(rb)]);
    check("phản hồi cho B không chứa id nháp của A hay tên/email/id A", !draftsA.some(d => rb.text.includes(d)) && ![A.name, A.email, A.id].some(x => rb.text.includes(x)));
    const sc = await api("POST", RUT, { as: A, body: { ...want, scope: "shared" } });
    check("scope=shared: A cũng chỉ bốc câu đã duyệt (không nháp riêng)", !ids(sc).some(i => draftsA.includes(i)) && sc.json?.shortages?.[0]?.have === 5, sc.json?.shortages);
    const mine = await api("POST", RUT, { as: A, body: { ...want, scope: "mine" } });
    check("scope=mine: A chỉ bốc câu của mình → thiếu (3 nháp)", mine.json?.shortages?.[0]?.have === 3 && ids(mine).every(i => draftsA.includes(i)), mine.json?.shortages);
  }

  section("rut: giữ lại (locked) và bỏ (exclude) luôn được tôn trọng");
  {
    const rows1 = [{ categoryId: t.c11, difficulty: "NB", count: 3 }];
    const base = ids(await api("POST", RUT, { as: A, body: { rows: rows1, seed: "g0" } }));
    let lockedOk = true, excludeOk = true;
    for (const s of ["g1", "g2", "g3", "g4", "g5"]) {
      const l = ids(await api("POST", RUT, { as: A, body: { rows: rows1, seed: s, locked: [base[0]] } }));
      if (!l.includes(base[0]) || l.length !== 3) lockedOk = false;
      const e = ids(await api("POST", RUT, { as: A, body: { rows: rows1, seed: s, exclude: base } }));
      if (e.some(i => base.includes(i)) || e.length !== 3) excludeOk = false;
    }
    check("locked: câu giữ lại có mặt trong MỌI lần bốc lại (5 hạt), vẫn đủ 3 câu", lockedOk);
    check("exclude: câu đã bỏ không bao giờ quay lại (5 hạt), vẫn đủ 3 câu từ phần còn lại", excludeOk);
    const lockedNB = await api("POST", RUT, { as: B, body: { rows: rows1, seed: "z", locked: [draftsA[0]] } });
    check("B 'giữ lại' một nháp của A: câu đó KHÔNG lọt vào kết quả (không ngoài kho thấy được)", !ids(lockedNB).includes(draftsA[0]), ids(lockedNB));
  }

  section("rut / doi-cau: kiểm thân yêu cầu");
  {
    const s0 = await snap();
    const rr = (body: unknown, as = A) => api("POST", RUT, { as, body });
    check("rut: rows rỗng → 400 EMPTY", (await rr({ rows: [] })).json?.code === "EMPTY");
    check("rut: scope lạ → 400 BAD_SCOPE", (await rr({ rows: rowsOK, scope: "tat-ca" })).json?.code === "BAD_SCOPE");
    check("rut: locked không phải mảng chuỗi → 400 BAD_LIST", (await rr({ rows: rowsOK, locked: [1, 2] })).json?.code === "BAD_LIST" && (await rr({ rows: rowsOK, exclude: "x" })).json?.code === "BAD_LIST");
    check("rut: nút không có → 404 kèm rowIndex", (await rr({ rows: [{ categoryId: "la", difficulty: "NB", count: 1 }] })).status === 404);
    const dd = (body: Record<string, unknown>) => api("POST", DOI, { as: A, body: { rows: [{ categoryId: t.c11, difficulty: "NB", count: 3 }], rowIndex: 0, itemId: approvedNB[0], current: approvedNB.slice(0, 3), seed: "d", ...body } });
    check("doi-cau: rowIndex ngoài khoảng → 400 BAD_ROW_INDEX", (await dd({ rowIndex: 5 })).json?.code === "BAD_ROW_INDEX" && (await dd({ rowIndex: -1 })).json?.code === "BAD_ROW_INDEX" && (await dd({ rowIndex: 0.5 })).json?.code === "BAD_ROW_INDEX");
    check("doi-cau: thiếu itemId → 400 BAD_ITEM", (await dd({ itemId: "" })).json?.code === "BAD_ITEM");
    check("doi-cau: current sai dạng → 400 BAD_LIST; scope lạ → 400 BAD_SCOPE", (await dd({ current: [3] })).json?.code === "BAD_LIST" && (await dd({ scope: "x" })).json?.code === "BAD_SCOPE");
    check("các ca lỗi không ghi gì", (await snap()) === s0);
  }

  section("doi-cau: đổi đúng một câu, không trùng câu hiện có, hết lựa chọn → 409 NO_ALTERNATIVE");
  {
    const s0 = await snap();
    const rows1 = [{ categoryId: t.c11, difficulty: "NB", count: 3 }];
    const cur = ids(await api("POST", RUT, { as: A, body: { rows: rows1, seed: "d0" } }));
    const sw = await api("POST", DOI, { as: A, body: { rows: rows1, rowIndex: 0, itemId: cur[0], current: cur, seed: "d1" } });
    check("200 {itemId, item}", sw.status === 200 && typeof sw.json?.itemId === "string" && sw.json?.item?.id === sw.json.itemId, [sw.status, sw.json]);
    check("câu mới KHÁC mọi câu hiện có và khác câu bị đổi; vẫn là NB trong c11", !cur.includes(sw.json?.itemId) && (await prisma.questionBankItem.findUnique({ where: { id: sw.json.itemId } }))?.difficulty === "NB");
    const all = (await prisma.questionBankItem.findMany({ where: { categoryId: t.c11, difficulty: "NB", OR: [{ status: "approved" }, { ownerId: A.id }] }, select: { id: true } })).map(x => x.id);
    const none = await api("POST", DOI, { as: A, body: { rows: rows1, rowIndex: 0, itemId: cur[0], current: cur, seed: "d1", exclude: all.filter(i => !cur.includes(i)) } });
    check("loại hết ứng viên → 409 NO_ALTERNATIVE (không trả bừa câu đã có)", none.status === 409 && none.json?.code === "NO_ALTERNATIVE", [none.status, none.json]);
    const ex = await api("POST", DOI, { as: A, body: { rows: rows1, rowIndex: 0, itemId: cur[0], current: cur, seed: "d2", exclude: [sw.json.itemId] } });
    check("exclude: câu vừa bị loại không được trả lại", ex.status !== 200 || ex.json.itemId !== sw.json.itemId, ex.json);
    const swB = await api("POST", DOI, { as: B, body: { rows: rows1, rowIndex: 0, itemId: approvedNB[0], current: approvedNB.slice(0, 3), seed: "q" } });
    check("B đổi câu: không bao giờ nhận nháp của A", swB.status === 409 || !draftsA.includes(swB.json?.itemId), swB.json);
    check("doi-cau CHỈ XEM TRƯỚC: DB không đổi", (await snap()) === s0);
  }

  section("tao-tu-ma-tran: kiểm thân yêu cầu");
  {
    const s0 = await snap();
    const tt = (body: Record<string, unknown>) => api("POST", TAO, { as: A, body: { title: "Đề thử", itemIds: approvedNB.slice(0, 2), ...body } });
    check("thiếu tên → 400 NO_TITLE; tên 151 ký tự → 400 TITLE_TOO_LONG", (await tt({ title: " " })).json?.code === "NO_TITLE" && (await tt({ title: "x".repeat(151) })).json?.code === "TITLE_TOO_LONG");
    check("mode lạ → 400 BAD_MODE", (await tt({ mode: "hack" })).json?.code === "BAD_MODE");
    check("itemIds rỗng/không phải mảng chuỗi → 400 EMPTY", (await tt({ itemIds: [] })).json?.code === "EMPTY" && (await tt({ itemIds: [1] })).json?.code === "EMPTY");
    check("201 id → 400 TOO_MANY (trần 200 câu/đề)", (await tt({ itemIds: Array.from({ length: 201 }, (_, i) => `x${i}`) })).json?.code === "TOO_MANY");
    check("chọn một câu hai lần → 400 DUPLICATE_ITEM", (await tt({ itemIds: [approvedNB[0], approvedNB[0]] })).json?.code === "DUPLICATE_ITEM");
    check("các ca lỗi không tạo đề", (await snap()) === s0);
  }

  section("tao-tu-ma-tran: sao chép độc lập, giá luôn null, không mở cho khách");
  let examId = "", srcIds: string[] = [];
  {
    const picked = await api("POST", RUT, { as: A, body: { rows: rowsOK, seed: "tao" } });
    srcIds = ids(picked);
    const r = await api("POST", TAO, { as: A, body: { title: "Đề từ ma trận", courseId: courseA.id, blueprintId: bpId, itemIds: srcIds, mode: "test", price: 99000, activeGuest: true, guestCanTake: true } });
    examId = r.json?.examId;
    check("201 {examId, shortages: []} (ma trận 3+3 đủ)", r.status === 201 && !!examId && Array.isArray(r.json?.shortages) && r.json.shortages.length === 0, [r.status, r.json]);
    const e = await prisma.exam.findUnique({ where: { id: examId } });
    check("đề NHÁP của A, gắn lớp A, ma trận, chế độ test", !!e && e.isDraft && !e.active && e.ownerId === A.id && e.courseId === courseA.id && e.blueprintId === bpId && e.mode === "test", e && [e.isDraft, e.active, e.ownerId, e.blueprintId, e.mode]);
    check("PHÁ: price/activeGuest/guestCanTake gửi lên bị BỎ — đề gia sư không bán, không mở cho khách (price null, hai cờ false)", e?.price === null && e.activeGuest === false && e.guestCanTake === false, e && [e.price, e.activeGuest, e.guestCanTake]);
    const qs = await prisma.examQuestion.findMany({ where: { examId }, orderBy: { order: "asc" }, include: { options: { orderBy: { order: "asc" } } } });
    check("6 câu, thứ tự 1..6, mỗi câu nhớ nguồn (sourceBankItemId) đúng id đã bốc", qs.length === 6 && qs.map(q => q.order).join() === "1,2,3,4,5,6" && qs.map(q => q.sourceBankItemId).sort().join() === [...srcIds].sort().join(), qs.map(q => q.sourceBankItemId));
    const bank = await prisma.questionBankItem.findMany({ where: { id: { in: srcIds } }, include: { options: { orderBy: { order: "asc" } } } });
    const bankById = new Map(bank.map(b => [b.id, b]));
    check("nội dung và đáp án đúng được sao chép nguyên (text, 4 phương án, đúng 1 đáp án đúng)", qs.every(q => { const b = bankById.get(q.sourceBankItemId!)!; return q.text === b.text && q.options.length === 4 && q.options.map(o => o.isCorrect).join() === b.options.map(o => o.isCorrect).join(); }));
    check("tổng điểm đề = tổng điểm các câu (6)", e?.totalPoints === 6 && e.questions === 6, [e?.totalPoints, e?.questions]);
    check("có dòng nhật ký 'create' cho đề", (await prisma.examChangeLog.count({ where: { examId, kind: "create" } })) === 1);
    // độc lập
    const q0 = qs[0], b0 = bankById.get(q0.sourceBankItemId!)!;
    const put = await api("PUT", `/api/tutor/quiz/${examId}/questions/${q0.id}`, { as: A, body: { type: "MC", text: "Đã sửa trong đề", points: 1, options: ["a", "b", "c", "d"].map((x, i) => ({ text: x, isCorrect: i === 0 })) } });
    check("dựng: sửa câu trong đề → 200", put.status === 200, put.text.slice(0, 160));
    check("sửa đề KHÔNG đổi ngân hàng (text câu ngân hàng vẫn như cũ)", (await prisma.questionBankItem.findUnique({ where: { id: b0.id } }))?.text === b0.text);
    const q1 = qs[1], b1 = bankById.get(q1.sourceBankItemId!)!;
    await prisma.questionBankItem.update({ where: { id: b1.id }, data: { text: "Ngân hàng bị đổi sau khi tạo đề" } });
    check("sửa ngân hàng KHÔNG đổi đề đã tạo", (await prisma.examQuestion.findUnique({ where: { id: q1.id } }))?.text === b1.text);
    await prisma.questionBankItem.update({ where: { id: b1.id }, data: { text: b1.text } });
  }

  section("tao-tu-ma-tran: thiếu câu → 422 SHORTAGE; allowShort; không ma trận; xoá ma trận không xoá đề");
  {
    const bp2 = await api("POST", BP, { as: A, body: { name: "Cần 5 TH", rows: [{ categoryId: t.c11, difficulty: "TH", count: 5 }] } });
    const before = await prisma.exam.count();
    const r = await api("POST", TAO, { as: A, body: { title: "Đề thiếu", blueprintId: bp2.json.id, itemIds: approvedTH } });
    check("ma trận cần 5, chọn 2 → 422 SHORTAGE kèm shortages [{need 5, have 2}]", r.status === 422 && r.json?.code === "SHORTAGE" && r.json?.shortages?.[0]?.need === 5 && r.json.shortages[0].have === 2, [r.status, r.json]);
    check("422 thì KHÔNG tạo đề", (await prisma.exam.count()) === before);
    const ok = await api("POST", TAO, { as: A, body: { title: "Đề thiếu vẫn tạo", blueprintId: bp2.json.id, itemIds: approvedTH, allowShort: true } });
    check("allowShort:true → 201 và vẫn trả shortages", ok.status === 201 && ok.json?.shortages?.length === 1, [ok.status, ok.json]);
    const strict = await api("POST", TAO, { as: A, body: { title: "Đề thiếu", blueprintId: bp2.json.id, itemIds: approvedTH, allowShort: "true" } });
    check("allowShort phải đúng boolean true (chuỗi 'true' không đủ) → vẫn 422", strict.status === 422, strict.status);
    const free = await api("POST", TAO, { as: A, body: { title: "Đề tự chọn", itemIds: approvedNB.slice(0, 2) } });
    const fe = await prisma.exam.findUnique({ where: { id: free.json?.examId } });
    check("không ma trận: 201, blueprintId null, không shortages, mode null", free.status === 201 && fe?.blueprintId === null && free.json.shortages.length === 0 && fe.mode === null, [free.status, fe?.mode]);
    const del = await api("DELETE", `${BP}/${bpId}`, { as: A });
    check("xoá ma trận → 200 {success}", del.status === 200 && del.json?.success === true);
    const e = await prisma.exam.findUnique({ where: { id: examId } });
    check("đề tạo từ ma trận đó vẫn còn, blueprintId về null (SetNull), câu còn đủ 6", !!e && e.blueprintId === null && (await prisma.examQuestion.count({ where: { examId } })) === 6);
    check("xoá lại → 404", (await api("DELETE", `${BP}/${bpId}`, { as: A })).status === 404);
    void courseB;
  }

  await done();
})().catch(e => { console.error(e); process.exit(1); });
