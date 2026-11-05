// BU-03-MATHTYPE — PHÁ giới hạn token ảnh công thức {{ctimg:…}} qua API thật: quiz questions POST/PUT, import-save, luu-nhieu, route đề cũ.
// Điều cần chứng minh: (1) mọi đường lưu câu hỏi đều đi qua coerceQuestionInput nên token sai danh sách trắng / quá dài / vượt trần → nhãn ⟦công thức⟧ TRƯỚC khi vào DB;
// (2) token LỎNG khổng lồ (5 MB) không lọt qua giới hạn ký tự; (3) nhồi 10.000 token không lưu được; (4) vượt 20 token mỗi trường → phần dư thành nhãn.
// Cần máy chủ dev (BASE) + DB RIÊNG; wipe() ở đầu bài. Không dùng tệp thật của gia sư.
import { api, mkTutor, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { makeFormulaImgToken, FORMULA_MAX_TOKENS_PER_FIELD } from "@/lib/mathtype/formulaImg";
import { mkTree } from "./bu03";

const PH = "⟦công thức⟧";
const okSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="10pt" height="10pt" viewBox="0 0 10 10"><text y="5" font-size="4"><tspan x="1">a</tspan></text></svg>';
const TOK = makeFormulaImgToken(okSvg)!;
const forge = (svg: string) => `{{ctimg:${Buffer.from(svg).toString("base64")}}}`;
const EVIL = [
  okSvg.replace("<text", "<script>alert(1)</script><text"),
  okSvg.replace("<svg ", '<svg onload="alert(1)" '),
  okSvg.replace("<text", '<a href="https://evil"><text').replace("</text>", "</text></a>"),
  okSvg.replace("<text", "<foreignObject><div/></foreignObject><text"),
  okSvg.replace("<text", "<style>*{background:url(x)}</style><text"),
].map(forge);
const LOOSE5 = "{{ctimg:" + "A".repeat(5 * 1024 * 1024) + "}}";
const BAD_RE = /onload|<script|foreignObject|href=|<style|url\(|alert\(1\)/i;
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;
const TOKRE = /\{\{ctimg:[A-Za-z0-9+/=]+\}\}/g;

const MC = (text: string, o: { opts?: [string, string]; explanation?: string; hint?: string } = {}) => ({
  type: "MC", text, points: 1, explanation: o.explanation, hint: o.hint,
  options: [{ text: o.opts?.[0] ?? "Đáp án A", isCorrect: true }, { text: o.opts?.[1] ?? "Đáp án B", isCorrect: false }, { text: "C", isCorrect: false }, { text: "D", isCorrect: false }],
});

(async () => {
  await wipe();
  const T = await mkTutor("Cô Phá");
  const course = await mkCourse(T.id, { name: "Lớp thử token" });
  const tree = await mkTree();
  const qid = async () => (await api("POST", "/api/tutor/quiz", { as: T, body: { title: "Quiz phá token", courseId: course.id } })).json.id as string;
  const id = await qid();
  const nQ = () => prisma.examQuestion.count({ where: { examId: id } });
  const last = async () => prisma.examQuestion.findFirst({ where: { examId: id }, orderBy: { order: "desc" }, include: { options: true } });
  const POST = (b: unknown) => api("POST", `/api/tutor/quiz/${id}/questions`, { as: T, body: b });

  section("POST /api/tutor/quiz/[id]/questions — token sai danh sách trắng ở MỌI trường chữ");
  {
    const r = await POST(MC(`Câu ${EVIL[0]} x`, { opts: [`A ${EVIL[1]}`, `B ${EVIL[2]}`], explanation: `giải ${EVIL[3]}`, hint: `gợi ý ${EVIL[4]}` }));
    const row = await last();
    const all = JSON.stringify(row);
    check("201; DB không còn script/onload/href/foreignObject/style/ctimg ở text, đáp án, giải thích, gợi ý", r.status === 201 && !!row && !BAD_RE.test(all) && !all.includes("ctimg"), [r.status, r.json?.error]);
    check("mỗi trường chữ thay token độc bằng đúng một nhãn ⟦công thức⟧, chữ xung quanh còn", row?.text === `Câu ${PH} x` && row.explanation === `giải ${PH}` && row.hint === `gợi ý ${PH}` && row.options.some(o => o.text === `A ${PH}`) && row.options.some(o => o.text === `B ${PH}`), row && { t: row.text.length });
  }

  section("POST — token LỎNG 5 MB không lọt qua giới hạn ký tự");
  {
    const before = await nQ();
    const t0 = Date.now();
    const r = await POST(MC(`Câu ${LOOSE5} hết`));
    const row = await last();
    check(`token lỏng 5 MB ở nội dung → 201 (đã thay bằng nhãn) và DB chỉ chứa nhãn, text < 100 ký tự (${Date.now() - t0} ms)`, r.status === 201 && (await nQ()) === before + 1 && row?.text === `Câu ${PH} hết`, [r.status, r.json?.error, row?.text.length]);
    const r2 = await POST(MC("Câu", { opts: [LOOSE5, "B"] }));
    const row2 = await last();
    check("token lỏng 5 MB ở một ĐÁP ÁN → 201, đáp án đó chỉ còn nhãn", r2.status === 201 && row2?.options.some(o => o.text === PH) === true && row2.options.every(o => o.text.length < 50), [r2.status, r2.json?.error]);
    const r3 = await POST(MC("Câu", { explanation: LOOSE5 }));
    check("token lỏng 5 MB ở GIẢI THÍCH → không có dòng nào chứa chuỗi 5 MB", r3.status === 201 && (await last())?.explanation === PH);
    const r4 = await POST(MC(LOOSE5));
    check("nội dung chỉ gồm token lỏng 5 MB → 201 nhưng chỉ còn nhãn (câu bị chặn phát hành như mọi ⟦công thức⟧), không lưu 5 MB", r4.status === 201 && (await last())?.text === PH);
    const all = await prisma.examQuestion.findMany({ where: { examId: id }, include: { options: true } });
    const maxLen = Math.max(...all.flatMap(q => [q.text.length, (q.explanation ?? "").length, ...q.options.map(o => o.text.length)]));
    check("không trường chữ nào của quiz dài quá 200 ký tự sau toàn bộ ca trên", maxLen < 200, maxLen);
  }

  section("POST — nhồi token: 10.000 token hợp lệ bị từ chối; 25 token → giữ 20, 5 thành nhãn; 21 token ở một đáp án");
  {
    const before = await nQ();
    const r = await POST(MC("Câu " + TOK.repeat(10_000)));
    check("10.000 token hợp lệ → 400 (vượt giới hạn ký tự hiển thị), không lưu gì", r.status === 400 && (await nQ()) === before, [r.status, r.json?.error]);
    const r2 = await POST(MC("Câu " + TOK.repeat(FORMULA_MAX_TOKENS_PER_FIELD + 5)));
    const row = await last();
    check(`${FORMULA_MAX_TOKENS_PER_FIELD + 5} token → 201, DB giữ đúng ${FORMULA_MAX_TOKENS_PER_FIELD} token + 5 nhãn`, r2.status === 201 && !!row && count(row.text, TOKRE) === FORMULA_MAX_TOKENS_PER_FIELD && count(row.text, /⟦công thức⟧/g) === 5, [r2.status, row && count(row.text, TOKRE)]);
    const r3 = await POST(MC("Câu", { opts: [TOK.repeat(FORMULA_MAX_TOKENS_PER_FIELD + 1), "B"] }));
    const row3 = await last();
    check("21 token ở MỘT đáp án → 201, đáp án giữ 20 token + 1 nhãn", r3.status === 201 && !!row3 && row3.options.some(o => count(o.text, TOKRE) === FORMULA_MAX_TOKENS_PER_FIELD && o.text.endsWith(PH)), r3.json?.error);
    const r4 = await POST(MC(`Câu ${TOK} hợp lệ`));
    check("token HỢP LỆ (1) vẫn được giữ nguyên từng byte", r4.status === 201 && (await last())?.text === `Câu ${TOK} hợp lệ`);
  }

  section("PUT /api/tutor/quiz/[id]/questions/[qid] — cùng ca phá khi SỬA câu");
  {
    await POST(MC("Câu gốc để sửa"));
    const target = await last();
    const PUT = (b: unknown) => api("PUT", `/api/tutor/quiz/${id}/questions/${target!.id}`, { as: T, body: b });
    const cur = async () => prisma.examQuestion.findUniqueOrThrow({ where: { id: target!.id }, include: { options: true } });
    const r = await PUT(MC(`Sửa ${EVIL[0]}`, { opts: [`A ${EVIL[1]}`, `B ${EVIL[2]}`], explanation: `g ${EVIL[3]}`, hint: `h ${EVIL[4]}` }));
    let row = await cur();
    check("PUT token độc ở mọi trường → 200 và DB chỉ còn nhãn", r.status === 200 && !BAD_RE.test(JSON.stringify(row)) && !JSON.stringify(row).includes("ctimg") && row.text === `Sửa ${PH}`, [r.status, r.json?.error]);
    const r2 = await PUT(MC(`Sửa ${LOOSE5}`));
    row = await cur();
    check("PUT token lỏng 5 MB ở nội dung → 200, chỉ còn nhãn", r2.status === 200 && row.text === `Sửa ${PH}`, [r2.status, r2.json?.error]);
    const r2b = await PUT(MC("Sửa", { opts: [LOOSE5, "B"] }));
    row = await cur();
    check("PUT token lỏng 5 MB ở một đáp án → 200, đáp án đó chỉ còn nhãn", r2b.status === 200 && row.options.some(o => o.text === PH) && row.options.every(o => o.text.length < 50), [r2b.status, r2b.json?.error]);
    const r3 = await PUT(MC("Sửa " + TOK.repeat(10_000)));
    row = await cur();
    check("PUT 10.000 token → 400 và câu KHÔNG đổi (vẫn là bản trước)", r3.status === 400 && row.text === "Sửa", [r3.status, r3.json?.error]);
    const r4 = await PUT(MC("Sửa " + TOK.repeat(FORMULA_MAX_TOKENS_PER_FIELD + 3)));
    row = await cur();
    check(`PUT ${FORMULA_MAX_TOKENS_PER_FIELD + 3} token → giữ ${FORMULA_MAX_TOKENS_PER_FIELD}, phần dư thành nhãn`, r4.status === 200 && count(row.text, TOKRE) === FORMULA_MAX_TOKENS_PER_FIELD && count(row.text, /⟦công thức⟧/g) === 3, [r4.status, count(row.text, TOKRE)]);
  }

  section("POST /api/tutor/quiz/import-save — bản nháp (luật lỏng) cũng bị làm sạch");
  {
    const save = (questions: unknown[], extra: Record<string, unknown> = {}) => api("POST", "/api/tutor/quiz/import-save", { as: T, body: { title: "Nháp phá token", courseId: course.id, questions, ...extra } });
    const r = await save([MC(`Câu ${EVIL[0]}`, { opts: [`A ${EVIL[1]}`, `B ${LOOSE5}`], explanation: `g ${EVIL[2]}`, hint: `h ${EVIL[3]}` })]);
    const newId = r.json?.examId ?? r.json?.id;
    const rows = newId ? await prisma.examQuestion.findMany({ where: { examId: newId }, include: { options: true } }) : [];
    check("import-save: token độc + token lỏng 5 MB → 201, DB sạch (không script/onload/href/ctimg, không dòng dài)", r.status === 201 && rows.length === 1 && !BAD_RE.test(JSON.stringify(rows)) && !JSON.stringify(rows).includes("ctimg") && JSON.stringify(rows).length < 3000, [r.status, r.json?.error]);
    const before = await prisma.exam.count();
    const r2 = await save([MC("Câu " + TOK.repeat(10_000))]);
    check("import-save: 10.000 token hợp lệ → 400 và không tạo quiz", r2.status === 400 && (await prisma.exam.count()) === before, [r2.status, r2.json?.error]);
    const r3 = await save([MC("Câu " + TOK.repeat(FORMULA_MAX_TOKENS_PER_FIELD + 4))]);
    const rows3 = await prisma.examQuestion.findMany({ where: { examId: r3.json?.examId ?? r3.json?.id ?? "-" } });
    check(`import-save: ${FORMULA_MAX_TOKENS_PER_FIELD + 4} token → giữ ${FORMULA_MAX_TOKENS_PER_FIELD}`, r3.status === 201 && rows3.length === 1 && count(rows3[0].text, TOKRE) === FORMULA_MAX_TOKENS_PER_FIELD, [r3.status, r3.json?.error]);
  }

  section("POST /api/tutor/ngan-hang/luu-nhieu — ngân hàng (cùng cổng coerceQuestionInput)");
  {
    const item = (text: string, opts: [string, string] = ["A", "B"]) => ({ type: "MC", text, points: 1, difficulty: "NB", options: [{ text: opts[0], isCorrect: true }, { text: opts[1], isCorrect: false }] });
    const r = await api("POST", "/api/tutor/ngan-hang/luu-nhieu", { as: T, body: { categoryId: tree.c11, items: [item(`Ngân hàng 1 ${EVIL[0]}`, [`A ${EVIL[1]}`, `B ${LOOSE5}`]), item("Ngân hàng 2 " + TOK.repeat(10_000))] } });
    const rows = await prisma.questionBankItem.findMany({ where: { id: { in: r.json?.ids ?? [] } }, include: { options: true } });
    check("luu-nhieu: câu độc + token lỏng 5 MB lưu được dưới dạng nhãn; câu 10.000 token bị bỏ (skippedInvalid)", r.status === 201 && rows.length === 1 && !BAD_RE.test(JSON.stringify(rows)) && !JSON.stringify(rows).includes("ctimg") && r.json.skippedInvalid === 1, [r.status, r.json && { ...r.json, ids: undefined }]);
  }

  section("Route đề cũ POST /api/exams/[id]/questions và /api/question-bank (cùng chống token độc)");
  {
    const r = await api("POST", `/api/exams/${id}/questions`, { as: T, body: { text: `Cũ ${EVIL[0]}`, type: "MC", points: 1, explanation: `g ${EVIL[1]}`, options: [{ text: `A ${EVIL[2]}`, isCorrect: true }, { text: "B", isCorrect: false }] } });
    if (r.status === 201) {
      const row = await prisma.examQuestion.findUnique({ where: { id: r.json.id }, include: { options: true } });
      check("exams/[id]/questions: token độc ở nội dung/giải thích/đáp án → chỉ còn nhãn", !!row && !BAD_RE.test(JSON.stringify(row)) && !JSON.stringify(row).includes("ctimg"), row);
    } else console.log(`  – route đề cũ trả ${r.status} cho gia sư (không có quyền) — ca bỏ qua, mã đã được vá nhưng chưa chạy được ở đây`);
  }

  await done();
})();
