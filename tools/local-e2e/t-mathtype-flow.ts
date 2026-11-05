// BU-03 MathType — LUỒNG THẬT bằng tệp ~/Downloads/De_Toan12_GK1_Azota.docx (bỏ qua nếu thiếu):
// gia sư đăng nhập → POST nhap-word (xem trước thấy $..$, công thức giải được) → luu-nhieu vào ngân hàng → tao-tu-ma-tran → phát hành (200 khi không còn ⟦công thức⟧).
// Bài ngược: cùng tệp nhưng một phần công thức MathType bị phá hỏng → nhãn ⟦công thức⟧ + cờ formula_unread, lưu/tạo đề được nhưng PHÁT HÀNH bị chặn 422 FORMULA_UNREAD.
// Quyền trên nhap-word: khách 401, học sinh 403. Cần máy chủ dev (BASE) + DB RIÊNG; wipe() ở đầu bài.
import JSZip from "jszip";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { api, mkTutor, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { uploadDocx, mkTree } from "./bu03";

const FILE = `${homedir()}/Downloads/De_Toan12_GK1_Azota.docx`;
const NW = "/api/tutor/ngan-hang/nhap-word", LN = "/api/tutor/ngan-hang/luu-nhieu", TAO = "/api/tutor/de-thi/tao-tu-ma-tran", BP = "/api/tutor/de-thi/ma-tran";
const LEVELS = ["NB", "TH", "VD", "VDC"] as const;
const PH = "⟦công thức⟧";

const toItem = (q: any, i: number) => ({
  type: q.type, text: String(q.text).trim(), points: 1, imageUrl: null, explanation: String(q.explanation ?? "").trim() || null, difficulty: LEVELS[i % 4],
  options: q.type === "ESSAY" ? [] : q.options.map((o: any) => ({ text: String(o.text).trim(), isCorrect: !!o.isCorrect, subLabel: o.subLabel ?? null })),
});
const hasPh = (q: any) => q.text.includes(PH) || (q.explanation ?? "").includes(PH) || q.options.some((o: any) => o.text.includes(PH));

(async () => {
  if (!existsSync(FILE)) { console.log("  – SKIP: không có " + FILE); process.exit(0); }
  await wipe();
  const A = await mkTutor("Cô An"), B = await mkTutor("Cô Bình"), S = await mkUser({ name: "Em Sáu" });
  const course = await mkCourse(A.id, { name: "Toán 12 của A" });
  const tree = await mkTree();
  const good = readFileSync(FILE);

  section("Quyền nhap-word với tệp thật: khách 401 · học sinh 403");
  const snapN = async () => [await prisma.questionBankItem.count(), await prisma.exam.count(), await prisma.usageEvent.count({ where: { kind: "ai_extract" } })].join();
  const n0 = await snapN();
  const g = await uploadDocx(NW, undefined, good); check("khách → 401", g.status === 401, [g.status, g.text.slice(0, 120)]);
  const s = await uploadDocx(NW, S, good); check("học sinh → 403", s.status === 403, [s.status, s.text.slice(0, 120)]);
  check("các ca bị chặn không ghi gì (ngân hàng, đề, bộ đếm AI)", (await snapN()) === n0);

  section("Luồng thật: xem trước");
  const pv = await uploadDocx(NW, A, good, "De_Toan12_GK1_Azota.docx");
  const P = pv.json;
  check("200 và không lỗi nghiêm trọng", pv.status === 200 && P && P.fatal === null && P.errors.length === 0, [pv.status, P?.fatal, P?.errors?.slice?.(0, 2)]);
  const Q: any[] = P?.questions ?? [];
  check("22 câu (12 MC · 4 Đúng/Sai · 6 trả lời ngắn)", Q.length === 22 && P.stats.byType.MC === 12 && P.stats.byType.TRUE_FALSE_CLUSTER === 4 && P.stats.byType.SHORT_ANSWER === 6, P?.stats);
  check("công thức MathType giải được 107/107, không hỏng, không chưa-kiểm", P?.formulaStats?.total === 107 && P.formulaStats.decoded === 107 && P.formulaStats.failed === 0 && P.formulaStats.unverified === 0, P?.formulaStats);
  check("xem trước thấy $..$ (≥ 20 câu có LaTeX) và KHÔNG câu nào còn nhãn ⟦công thức⟧", Q.filter(q => /\$[^$]+\$/.test(q.text + q.options.map((o: any) => o.text).join(" "))).length >= 20 && Q.filter(hasPh).length === 0 && P.stats.withFormulaUnread === 0);
  check("không câu nào mang cờ formula_unread", Q.every(q => !q.flags.includes("formula_unread")));
  check("câu 1: $y=f\\left(x\\right)$ và đáp án đúng $\\left(-1;\\,0\\right).$", Q[0]?.text.includes("$y=f\\left(x\\right)$") && Q[0].options.find((o: any) => o.isCorrect)?.text === "$\\left(-1;\\,0\\right).$", Q[0]);
  check("mọi câu có đáp án (22/22) — đề mẫu có gạch chân/bảng", P?.stats?.withAnswer === 22);
  check("xem trước không ghi DB, không tăng bộ đếm AI", (await snapN()) === n0);

  section("Luồng thật: lưu vào ngân hàng → tạo đề từ ma trận → phát hành");
  const items = Q.map(toItem);
  const sv = await api("POST", LN, { as: A, body: { categoryId: tree.c11, items } });
  const ids: string[] = sv.json?.ids ?? [];
  check("luu-nhieu 201 saved=22, không trùng, không bỏ câu nào", sv.status === 201 && sv.json?.saved === 22 && sv.json.skippedInvalid === 0 && sv.json.skippedDuplicate === 0 && ids.length === 22, [sv.status, sv.json && { ...sv.json, ids: ids.length }]);
  const rows = await prisma.questionBankItem.findMany({ where: { id: { in: ids } }, include: { options: true } });
  check("DB: 22 câu nháp riêng của A, LaTeX còn nguyên ($..$), không nhãn ⟦công thức⟧", rows.length === 22 && rows.every(r => r.ownerId === A.id && r.status === "draft") && rows.filter(r => r.text.includes("$") || r.options.some(o => o.text.includes("$"))).length >= 20 && rows.every(r => !r.text.includes(PH) && r.options.every(o => !o.text.includes(PH))));
  const again = await api("POST", LN, { as: A, body: { categoryId: tree.c11, items } });
  check("lưu lại lần hai → bỏ trùng 22, saved=0", again.json?.saved === 0 && again.json?.skippedDuplicate === 22, again.json && { ...again.json, ids: undefined });
  const bp = await api("POST", BP, { as: A, body: { name: "Ma trận GK1", rows: LEVELS.map(d => ({ categoryId: tree.c11, difficulty: d, count: 2 })) } });
  check("tạo ma trận 201", bp.status === 201 && !!bp.json?.id, [bp.status, bp.json]);
  const pick = ids.slice(0, 8);
  const mk = await api("POST", TAO, { as: A, body: { title: "Đề GK1 Toán 12 (từ tệp Azota)", courseId: course.id, blueprintId: bp.json?.id, itemIds: pick, mode: "practice" } });
  const examId: string = mk.json?.examId;
  check("tao-tu-ma-tran 201 → đề nháp", mk.status === 201 && !!examId, [mk.status, mk.json]);
  const exQ = await prisma.examQuestion.findMany({ where: { examId }, include: { options: true } });
  check("đề có 8 câu, vẫn giữ $..$ và không nhãn ⟦công thức⟧", exQ.length === 8 && exQ.some(q => q.text.includes("$") || q.options.some(o => o.text.includes("$"))) && exQ.every(q => !q.text.includes(PH) && q.options.every(o => !o.text.includes(PH))));
  const bGate = await api("POST", `/api/tutor/quiz/${examId}/publish`, { as: B });
  check("gia sư B phát hành đề của A → 403/404", [403, 404].includes(bGate.status), [bGate.status, bGate.text.slice(0, 120)]);
  const pub = await api("POST", `/api/tutor/quiz/${examId}/publish`, { as: A });
  check("PHÁT HÀNH đề không còn nhãn → 200", pub.status === 200, [pub.status, pub.text.slice(0, 250)]);
  const ex = await prisma.exam.findUnique({ where: { id: examId } });
  check("DB: đề đã phát hành (isDraft=false, active=true)", ex?.isDraft === false && ex.active === true, ex && [ex.isDraft, ex.active]);

  section("Bài ngược: tệp có công thức MathType hỏng → vẫn bị chặn phát hành");
  const zip = await JSZip.loadAsync(good);
  const bins = Object.keys(zip.files).filter(n => /^word\/embeddings\/oleObject\d+\.bin$/.test(n)).sort();
  let broken = 0;
  for (const n of bins) { const num = Number(n.match(/(\d+)\.bin$/)![1]); if (num % 25 === 0) { zip.file(n, Buffer.from("KHONG-PHAI-OLE-CFB-" + n)); broken++; } }
  const badBuf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  check("dựng tệp hỏng: phá " + broken + "/" + bins.length + " đối tượng OLE", broken === 4 && bins.length === 107, [broken, bins.length]);
  const pv2 = await uploadDocx(NW, A, badBuf, "hong.docx");
  const P2 = pv2.json, Q2: any[] = P2?.questions ?? [];
  check("xem trước vẫn 200 nhưng báo hỏng: formulaStats.failed = số đã phá, decoded = phần còn lại", pv2.status === 200 && P2.formulaStats.failed === broken && P2.formulaStats.decoded === 107 - broken, P2?.formulaStats);
  const unread = Q2.filter(hasPh);
  check("các câu chứa công thức hỏng mang nhãn ⟦công thức⟧ + cờ formula_unread; stats.withFormulaUnread khớp", unread.length > 0 && unread.every(q => q.flags.includes("formula_unread")) && P2.stats.withFormulaUnread === unread.length && Q2.filter(q => q.flags.includes("formula_unread")).length === unread.length, [unread.length, P2?.stats]);
  check("câu không dính công thức hỏng vẫn giải được ($..$)", Q2.some(q => !hasPh(q) && q.text.includes("$")));
  const sv2 = await api("POST", LN, { as: A, body: { categoryId: tree.c11, items: Q2.map(toItem) } });
  const ids2: string[] = sv2.json?.ids ?? [];
  const bad = await prisma.questionBankItem.findMany({ where: { id: { in: ids2 } }, include: { options: true } });
  const badIds = bad.filter(r => r.text.includes(PH) || r.options.some(o => o.text.includes(PH))).map(r => r.id);
  check("API lưu ngân hàng cho phép nháp có nhãn (nháp riêng) — ghi lại số câu còn nhãn", sv2.status === 201 && badIds.length > 0, [sv2.status, sv2.json?.saved, badIds.length]);
  if (badIds.length) {
    const mk2 = await api("POST", TAO, { as: A, body: { title: "Đề có công thức hỏng", courseId: course.id, itemIds: [badIds[0], ...ids2.filter(i => !badIds.includes(i)).slice(0, 2)], mode: "practice" } });
    const ex2: string = mk2.json?.examId;
    check("tạo đề nháp từ câu còn nhãn → 201 (chặn ở cổng phát hành, không ở bước tạo)", mk2.status === 201 && !!ex2, [mk2.status, mk2.json]);
    const pub2 = await api("POST", `/api/tutor/quiz/${ex2}/publish`, { as: A });
    check("PHÁT HÀNH đề có nhãn ⟦công thức⟧ → 422 FORMULA_UNREAD", pub2.status === 422 && pub2.json?.code === "FORMULA_UNREAD", [pub2.status, pub2.json]);
    const e2 = await prisma.exam.findUnique({ where: { id: ex2 } });
    check("sau khi bị chặn đề vẫn là NHÁP, chưa active", e2?.isDraft === true && e2.active === false, e2 && [e2.isDraft, e2.active]);
    // gõ lại công thức (thay nhãn bằng LaTeX) → phát hành được
    const qs2 = await prisma.examQuestion.findMany({ where: { examId: ex2 }, include: { options: true } });
    for (const q of qs2) {
      await prisma.examQuestion.update({ where: { id: q.id }, data: { text: q.text.split(PH).join("$x$"), explanation: (q.explanation ?? "").split(PH).join("$x$") } });
      for (const o of q.options) if (o.text.includes(PH)) await prisma.examOption.update({ where: { id: o.id }, data: { text: o.text.split(PH).join("$x$") } });
    }
    const pub3 = await api("POST", `/api/tutor/quiz/${ex2}/publish`, { as: A });
    check("ĐỐI CHỨNG: thay nhãn bằng LaTeX thì phát hành được (200) — cổng chỉ chặn đúng nhãn", pub3.status === 200, [pub3.status, pub3.text.slice(0, 200)]);
  }
  done();
  process.exit(0);
})();
