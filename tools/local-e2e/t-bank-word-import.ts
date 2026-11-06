// BU-03 P1 — API Nhập Word → Ngân hàng câu hỏi: POST /api/tutor/ngan-hang/nhap-word (xem trước, không ghi, không AI) và POST /api/tutor/ngan-hang/luu-nhieu.
// Cần máy chủ dev (BASE) + DB RIÊNG; wipe() ở đầu bài. Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-bank-word-import.ts
// Điều phải chứng minh: (1) đường Word KHÔNG tăng bộ đếm AI (UsageEvent kind=ai_extract) và không ghi gì vào DB; (2) tệp độc hại bị chặn QUA HTTP bằng mã đúng;
// (3) lưu hàng loạt bỏ trùng contentHash, chỉ so với kho gia sư THẤY (nháp người khác không lộ); (4) quyền.
// Ca phá bằng thiết kế (mỗi kiểm chứng có thể thất bại — sửa mã thì đúng ca đó đỏ):
//   - nhap-word gọi reserveAiExtract / ghi ngân hàng → ca "bộ đếm AI không đổi" và "DB không đổi" đỏ; ca ĐỐI CHỨNG gọi reserveAiExtract trực tiếp chứng minh bộ đếm CÓ nhúc nhích;
//   - bỏ kiểm DOCTYPE / vbaProject / giới hạn giải nén trong readDocx → ca tương ứng trả 200 thay vì 400/413;
//   - luu-nhieu bỏ so contentHash → "lưu lại lần hai" saved>0; so cả nháp người khác → ca "B lưu trùng nháp của A vẫn lưu được" đỏ;
//   - luu-nhieu đoán mức khi thiếu → ca "câu không có mức" saved thay vì skippedInvalid.
import { api, mkTutor, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { reserveAiExtract, releaseAiExtract } from "@/lib/planServer";
import { DOCX_MAX_BYTES } from "@/lib/azotaDocxRead";
import { AZOTA_MAX_QUESTIONS } from "@/lib/azotaDocx";
import { mkActors, mkTree, mkBank, mkDocx, azotaDocx, uploadDocx, roleMatrix, snap, MCQ } from "./bu03";

const NW = "/api/tutor/ngan-hang/nhap-word", LN = "/api/tutor/ngan-hang/luu-nhieu";
const aiCount = () => prisma.usageEvent.count({ where: { kind: "ai_extract" } });
const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

(async () => {
  await wipe();
  const a = await mkActors();
  const { A, B, S } = a;
  const tree = await mkTree();

  section("ĐỐI CHỨNG: bộ đếm AI có nhúc nhích được (để ca 'không đổi' bên dưới không đậu giả)");
  {
    const before = await aiCount();
    const hold = await reserveAiExtract(A.id);
    const mid = await aiCount();
    check("reserveAiExtract trực tiếp → bộ đếm +1 (nếu ca này đỏ, mọi ca 'không tăng bộ đếm AI' đều vô giá trị)", hold.ok && mid === before + 1, [before, mid, hold]);
    if (hold.ok) await releaseAiExtract(hold.eventId);
    check("trả lượt → về lại như cũ", (await aiCount()) === before);
  }

  section("Quyền (nhap-word, luu-nhieu): khách 401 · học sinh 403 · chờ duyệt 403 · admin 403");
  {
    const docx = await azotaDocx(2);
    const s0 = await snap();
    await roleMatrix("nhap-word", a, u => uploadDocx(NW, u, docx));
    await roleMatrix("luu-nhieu", a, u => api("POST", LN, { as: u, body: { categoryId: tree.c11, defaultDifficulty: "NB", items: [MCQ("Câu quyền thử")] } }));
    check("bị từ chối thì KHÔNG ghi gì (ngân hàng, đề, bộ đếm AI, nhật ký)", (await snap()) === s0);
  }

  section("nhap-word: tệp hợp lệ → xem trước, KHÔNG ghi, KHÔNG tăng bộ đếm AI");
  {
    const s0 = await snap(), ai0 = await aiCount();
    const r = await uploadDocx(NW, A, await azotaDocx(3));
    check("200 + 3 câu", r.status === 200 && Array.isArray(r.json?.questions) && r.json.questions.length === 3, [r.status, r.text.slice(0, 300)]);
    check("mỗi câu có 4 phương án và đúng 1 đáp án đúng (đọc từ dấu *)", (r.json?.questions ?? []).every((q: any) => q.options?.length === 4 && q.options.filter((o: any) => o.isCorrect).length === 1), r.json?.questions?.[0]);
    check("có stats và không có lỗi chí tử (fatal)", !!r.json?.stats && !r.json?.fatal, r.json?.fatal);
    check("Cache-Control: no-store", /no-store/.test(r.headers.get("cache-control") ?? ""));
    check("bộ đếm AI (UsageEvent ai_extract) KHÔNG tăng", (await aiCount()) === ai0);
    check("DB không đổi: không câu ngân hàng, không đề, không UsageEvent nào (trừ word_analyse: bộ đếm hạn mức Word, cố ý ghi), không nhật ký", (await snap()) === s0);
    const emb = await prisma.$queryRawUnsafe<{ n: bigint }[]>(`select count(*)::bigint as n from question_bank_items where embedding is not null`);
    check("không tính nhúng (embedding) nào", Number(emb[0].n) === 0);
  }

  section("nhap-word: tệp độc hại / sai bị chặn QUA HTTP bằng mã đúng, và vẫn không tăng bộ đếm AI");
  {
    const ai0 = await aiCount(), s0 = await snap();
    const pdf = await uploadDocx(NW, A, Buffer.from("%PDF-1.7 không phải docx"), "gia-mao.docx");
    check("magic sai (PDF đổi đuôi .docx) → 400 NOT_DOCX", pdf.status === 400 && pdf.json?.code === "NOT_DOCX", [pdf.status, pdf.json]);
    const tiny = await uploadDocx(NW, A, Buffer.from("PK"));
    check("tệp 2 byte 'PK' → 400 NOT_DOCX (không 500)", tiny.status === 400 && tiny.json?.code === "NOT_DOCX", [tiny.status, tiny.json]);
    const docm = await uploadDocx(NW, A, await mkDocx(`<w:p><w:r><w:t>x</w:t></w:r></w:p>`, { files: { "word/vbaProject.bin": Buffer.from("MACRO") } }), "macro.docm");
    check(".docm (có vbaProject.bin) → 400 NOT_DOCX", docm.status === 400 && docm.json?.code === "NOT_DOCX", [docm.status, docm.json]);
    const dt = await uploadDocx(NW, A, await mkDocx("", { rawDoc: `<?xml version="1.0"?><!DOCTYPE d [<!ENTITY a "aaaa">]><w:document ${NS}><w:body><w:p><w:r><w:t>&a;</w:t></w:r></w:p></w:body></w:document>` }));
    check("XML có DOCTYPE/ENTITY → 400 NOT_DOCX (chống XXE, billion laughs)", dt.status === 400 && dt.json?.code === "NOT_DOCX", [dt.status, dt.json]);
    const bomb = await mkDocx("", { rawDoc: `<?xml version="1.0"?><w:document ${NS}><w:body>` + "<w:p/>".repeat(1_600_000) + "</w:body></w:document>" });
    check("PHÁ zip bomb: tệp nén < 200 KB nhưng giải nén 9 MB → 413 TOO_LARGE", bomb.length < 200_000 && (await uploadDocx(NW, A, bomb)).status === 413, bomb.length);
    const big = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(DOCX_MAX_BYTES + 1)]);
    const rb = await uploadDocx(NW, A, big);
    check("> 4 MB → 413 TOO_LARGE", rb.status === 413 && rb.json?.code === "TOO_LARGE", [rb.status, rb.json]);
    const huge = await uploadDocx(NW, A, Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(5 * 1024 * 1024)]));
    check("5 MB (qua cả ngưỡng content-length) → 413", huge.status === 413, huge.status);
    const many = await uploadDocx(NW, A, await azotaDocx(AZOTA_MAX_QUESTIONS + 1, "nhieu"));
    check(`> ${AZOTA_MAX_QUESTIONS} câu → 422 TOO_MANY`, many.status === 422 && many.json?.code === "TOO_MANY", [many.status, many.json]);
    const edge = await uploadDocx(NW, A, await azotaDocx(AZOTA_MAX_QUESTIONS, "bien"));
    check(`đúng ${AZOTA_MAX_QUESTIONS} câu vẫn đọc được (không chặn nhầm ở ngưỡng)`, edge.status === 200 && edge.json?.questions?.length === AZOTA_MAX_QUESTIONS, [edge.status, edge.json?.questions?.length]);
    const noField = await uploadDocx(NW, A, await azotaDocx(1), "de.docx", "khac");
    check("không có trường 'file' → 400 NOT_DOCX", noField.status === 400 && noField.json?.code === "NOT_DOCX", [noField.status, noField.json]);
    const txt = new FormData(); txt.append("file", "đây là chữ chứ không phải tệp");
    const rt = await api("POST", NW, { as: A, raw: txt });
    check("'file' là chuỗi chữ, không phải tệp → 400 NOT_DOCX", rt.status === 400 && rt.json?.code === "NOT_DOCX", [rt.status, rt.json]);
    const nobody = await api("POST", NW, { as: A, raw: "không phải multipart", headers: { "content-type": "text/plain" } });
    check("thân không phải multipart → 400 (không 500)", nobody.status === 400, nobody.status);
    check("toàn bộ các ca độc hại: bộ đếm AI không đổi, DB không đổi", (await aiCount()) === ai0 && (await snap()) === s0);
    check("mọi lỗi trên đều có thông điệp tiếng Việt (error là chuỗi không rỗng), không lộ stack", [pdf, docm, dt, rb].every(x => typeof x.json?.error === "string" && x.json.error.length > 5 && !/at \w+ \(/.test(x.text)));
  }

  section("luu-nhieu: kiểm thân yêu cầu");
  {
    const s0 = await snap();
    const ok = [MCQ("Một câu hợp lệ")];
    check("không có items → 400 EMPTY", (await api("POST", LN, { as: A, body: { categoryId: tree.c11, items: [], defaultDifficulty: "NB" } })).json?.code === "EMPTY");
    check("items không phải mảng → 400 EMPTY", (await api("POST", LN, { as: A, body: { categoryId: tree.c11, items: "x" } })).json?.code === "EMPTY");
    const tooMany = await api("POST", LN, { as: A, body: { categoryId: tree.c11, defaultDifficulty: "NB", items: Array.from({ length: 201 }, (_, i) => MCQ(`Câu ${i}`)) } });
    check("201 câu → 400 TOO_MANY", tooMany.status === 400 && tooMany.json?.code === "TOO_MANY", [tooMany.status, tooMany.json]);
    check("thiếu categoryId → 400 NO_CATEGORY", (await api("POST", LN, { as: A, body: { items: ok, defaultDifficulty: "NB" } })).json?.code === "NO_CATEGORY");
    const bc = await api("POST", LN, { as: A, body: { categoryId: "khong-co-nut", items: ok, defaultDifficulty: "NB" } });
    check("nút ngân hàng không tồn tại → 404", bc.status === 404, [bc.status, bc.json]);
    check("mức mặc định lạ ('XX') → 400 BAD_DIFFICULTY", (await api("POST", LN, { as: A, body: { categoryId: tree.c11, items: ok, defaultDifficulty: "XX" } })).json?.code === "BAD_DIFFICULTY");
    const bi = await api("POST", LN, { as: A, body: { categoryId: tree.c11, defaultDifficulty: "NB", items: [{ ...MCQ("Câu trỏ nút lạ"), categoryId: "nut-la" }] } });
    check("một câu trỏ nút riêng không tồn tại → 404", bi.status === 404, [bi.status, bi.json]);
    check("thân không đọc được → 400", (await api("POST", LN, { as: A, raw: "{khong-phai-json", headers: { "content-type": "application/json" } })).status === 400);
    check("các ca lỗi trên không ghi gì", (await snap()) === s0);
  }

  section("luu-nhieu: lưu, trạng thái, bỏ trùng contentHash, không đoán mức");
  let firstIds: string[] = [];
  {
    const items = [MCQ("Lưu nhiều: câu một về đạo hàm"), MCQ("Lưu nhiều: câu hai về tích phân", 2), MCQ("Lưu nhiều: câu ba về giới hạn", 1)];
    const r = await api("POST", LN, { as: A, body: { categoryId: tree.c11, defaultDifficulty: "TH", items } });
    check("201 + saved 3, không trùng, không hỏng", r.status === 201 && r.json?.saved === 3 && r.json?.skippedDuplicate === 0 && r.json?.skippedInvalid === 0 && r.json?.ids?.length === 3, [r.status, r.json]);
    firstIds = r.json?.ids ?? [];
    const rows = await prisma.questionBankItem.findMany({ where: { id: { in: firstIds } }, include: { options: { orderBy: { order: "asc" } } } });
    check("gia sư lưu → status 'draft' (riêng chủ, chưa vào kho chung), chủ = A, mức TH, đúng nút", rows.length === 3 && rows.every(x => x.status === "draft" && x.ownerId === A.id && x.difficulty === "TH" && x.categoryId === tree.c11), rows.map(x => [x.status, x.ownerId, x.difficulty]));
    check("câu 2 giữ đáp án đúng là C (index 2); mỗi câu 4 phương án, đúng 1 đúng; contentHash đã tính", rows.every(x => x.options.length === 4 && x.options.filter(o => o.isCorrect).length === 1 && !!x.contentHash)
      && rows.find(x => x.text.includes("câu hai"))!.options[2].isCorrect === true);
    const emb = await prisma.$queryRawUnsafe<{ n: bigint }[]>(`select count(*)::bigint as n from question_bank_items where embedding is not null`);
    check("không gọi nhúng/AI khi lưu (embedding vẫn null hết)", Number(emb[0].n) === 0);
    check("bộ đếm AI vẫn 0 sau cả lượt lưu", (await aiCount()) === 0);

    const again = await api("POST", LN, { as: A, body: { categoryId: tree.c11, defaultDifficulty: "TH", items } });
    check("lưu LẠI đúng lô đó → 200 (không 201), saved 0, skippedDuplicate 3", again.status === 200 && again.json?.saved === 0 && again.json?.skippedDuplicate === 3, [again.status, again.json]);
    check("DB vẫn đúng 3 câu của A (không nhân đôi)", (await prisma.questionBankItem.count({ where: { ownerId: A.id } })) === 3);

    const sameBatch = await api("POST", LN, { as: A, body: { categoryId: tree.c11, defaultDifficulty: "NB", items: [MCQ("Trùng trong cùng lô"), MCQ("Trùng trong cùng lô"), MCQ("  TRÙNG  trong cùng lô  ")] } });
    check("trùng ngay trong một lô (kể cả khác hoa-thường/khoảng trắng) → lưu 1, bỏ 2", sameBatch.json?.saved === 1 && sameBatch.json?.skippedDuplicate === 2, sameBatch.json);

    const otherNode = await api("POST", LN, { as: A, body: { categoryId: tree.c2, defaultDifficulty: "TH", items: [items[0]] } });
    check("cùng chữ nhưng NÚT khác thì không bị coi là trùng (trùng chỉ tính trong cùng nút)", otherNode.json?.saved === 1 && otherNode.json?.skippedDuplicate === 0, otherNode.json);

    const noKey = { ...MCQ("Không đáp án đúng"), options: MCQ("x").options.map(o => ({ ...o, isCorrect: false })) };
    const two = { ...MCQ("Hai đáp án đúng cho MC"), options: MCQ("x").options.map(o => ({ ...o, isCorrect: true })) };
    const mix = await api("POST", LN, { as: A, body: { categoryId: tree.c11, items: [noKey, two, { ...MCQ("Có mức riêng"), difficulty: "vdc" }, MCQ("Không có mức nào"), { type: "HACK", text: "loại lạ", points: 1, options: [] }, "không phải đối tượng"] } });
    check("không có defaultDifficulty: chỉ câu có mức riêng ('vdc' → VDC) được lưu; thiếu đáp án/2 đáp án/không mức/loại lạ/rác → skippedInvalid 5",
      mix.json?.saved === 1 && mix.json?.skippedInvalid === 5, mix.json);
    const vdc = mix.json?.ids?.[0] ? await prisma.questionBankItem.findUnique({ where: { id: mix.json.ids[0] } }) : null;
    check("mức riêng thắng, chữ thường được chuẩn hoá thành VDC", vdc?.difficulty === "VDC");
    const only = await api("POST", LN, { as: A, body: { categoryId: tree.c11, items: [MCQ("Chỉ có câu không mức")] } });
    check("toàn câu hỏng → 200, saved 0 (không 201), skippedInvalid 1", only.status === 200 && only.json?.saved === 0 && only.json?.skippedInvalid === 1, [only.status, only.json]);
  }

  section("Cô lập: nháp của A không thấy ở B, không lọt vào so trùng của B");
  {
    const draftText = "Lưu nhiều: câu một về đạo hàm"; // y hệt câu nháp của A ở c11
    const rb = await api("POST", LN, { as: B, body: { categoryId: tree.c11, defaultDifficulty: "TH", items: [MCQ(draftText)] } });
    check("B lưu cùng chữ với NHÁP của A → vẫn lưu được (không bị bỏ trùng, cũng không bị nói 'trùng với nháp của người khác')", rb.status === 201 && rb.json?.saved === 1 && rb.json?.skippedDuplicate === 0, [rb.status, rb.json]);
    check("phản hồi cho B không chứa id câu nào của A", !(rb.text.includes(firstIds[0]) || rb.text.includes(A.id)));
    const shared = await mkBank({ ownerId: A.id, categoryId: tree.c11, difficulty: "NB", status: "approved", text: "Câu ĐÃ DUYỆT của A trong kho chung" });
    const rb2 = await api("POST", LN, { as: B, body: { categoryId: tree.c11, defaultDifficulty: "NB", items: [MCQ("Câu ĐÃ DUYỆT của A trong kho chung")] } });
    check("còn câu ĐÃ DUYỆT (kho chung) thì B bị bỏ trùng đúng", rb2.json?.saved === 0 && rb2.json?.skippedDuplicate === 1, rb2.json);
    void shared;
    const own = async (as: typeof A, scope: string) => {
      const st = await api("GET", `/api/tutor/ngan-hang/thong-ke?root=${tree.c11}&scope=${scope}`, { as });
      return { status: st.status, n: (st.json?.nodes ?? []).find((x: any) => x.id === tree.c11)?.own?.total as number | undefined, text: st.text };
    };
    const [bMine, bAll, bShared, aMine, aAll] = [await own(B, "mine"), await own(B, "all"), await own(B, "shared"), await own(A, "mine"), await own(A, "all")];
    check("thong-ke của B: mine = 1 (chỉ câu của B)", bMine.n === 1, bMine);
    check("thong-ke của B: all = 2 (1 của B + 1 đã duyệt của A) — KHÔNG đếm 5 nháp của A", bAll.n === 2, bAll);
    check("thong-ke: shared = 1 (chỉ câu đã duyệt) với cả B lẫn A", bShared.n === 1 && (await own(A, "shared")).n === 1, bShared);
    check("thong-ke của A: mine = 6, all = 6 (A thấy nháp của chính mình)", aMine.n === 6 && aAll.n === 6, [aMine.n, aAll.n]);
    check("thong-ke không trả tên người, email, id người dùng hay nội dung câu", ![A.name, B.name, A.email, B.email, A.id, B.id, "đạo hàm"].some(x => bAll.text.includes(x)));
    check("scope lạ → 400 BAD_SCOPE; nút không có → 404", (await api("GET", "/api/tutor/ngan-hang/thong-ke?scope=hack", { as: B })).json?.code === "BAD_SCOPE" && (await api("GET", "/api/tutor/ngan-hang/thong-ke?root=khong-co", { as: B })).status === 404);
    check("B có đúng 1 câu của mình trong DB", (await prisma.questionBankItem.count({ where: { ownerId: B.id } })) === 1);
  }

  section("nhap-word: mục LỜI GIẢI CHI TIẾT (không 'Câu N.') → đáp án + lời giải kèm cờ answer_from_solution; QUA HTTP, không ghi DB");
  {
    const para = (t: string, u?: boolean) => `<w:p><w:r>${u ? '<w:rPr><w:u w:val="single"/></w:rPr>' : ""}<w:t xml:space="preserve">${t}</w:t></w:r></w:p>`;
    const optsXml = (corr: number) => `<w:p>${["Tập rỗng", "Một điểm duy nhất", "Hai điểm phân biệt", "Vô số điểm"].map((t, i) => `<w:r>${i === corr ? '<w:rPr><w:u w:val="single"/></w:rPr>' : ""}<w:t xml:space="preserve">${"ABCD"[i]}</w:t></w:r><w:r><w:t xml:space="preserve">. ${t}${i < 3 ? "\t" : ""}</w:t></w:r>`).join("")}</w:p>`;
    const stem = "Đường thẳng cắt đường tròn bán kính 5 tại bao nhiêu điểm khi khoảng cách từ tâm là 3?";
    const P1 = "PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn. Thí sinh trả lời từ câu 1 đến câu 1.";
    const body = para(P1) + para(`Câu 1.\t${stem}`) + `<w:p><w:r><w:t xml:space="preserve">${["Tập rỗng", "Một điểm duy nhất", "Hai điểm phân biệt", "Vô số điểm"].map((t, i) => `${"ABCD"[i]}. ${t}`).join("\t")}</w:t></w:r></w:p>`
      + para("PHIẾU TRẢ LỜI") + para("LỜI GIẢI CHI TIẾT") + para(P1) + para(stem) + optsXml(2) + para("Lời giải") + para("Khoảng cách 3 nhỏ hơn bán kính 5 nên cắt tại hai điểm.");
    const s0 = await snap(), ai0 = await aiCount();
    const r = await uploadDocx(NW, A, await mkDocx(body));
    const q = r.json?.questions?.[0];
    check("200 + 1 câu, đáp án C lấy từ nhãn gạch chân trong lời giải (nguồn loi-giai)", r.status === 200 && q?.options?.[2]?.isCorrect === true && q.options.filter((o: any) => o.isCorrect).length === 1 && q.answerSource === "loi-giai", [r.status, q]);
    check("cờ answer_from_solution có (cảnh báo) và KHÔNG có answer_missing/answer_conflict", q?.flags?.includes("answer_from_solution") && !q.flags.includes("answer_missing") && !q.flags.includes("answer_conflict"), q?.flags);
    check("lời giải vào explanation; 'PHIẾU TRẢ LỜI' không dính vào câu", q?.explanation === "Khoảng cách 3 nhỏ hơn bán kính 5 nên cắt tại hai điểm." && !String(q?.text).includes("PHIẾU"), [q?.explanation, q?.text]);
    check("solutionStats ghép 1/1 và có cảnh báo tổng solution_summary", r.json?.solutionStats?.matched === 1 && r.json.warnings?.some((w: any) => w.code === "solution_summary"), r.json?.solutionStats);
    check("bộ đếm AI không tăng, DB không đổi", (await aiCount()) === ai0 && (await snap()) === s0);
    const at = body.lastIndexOf(stem); // đầu đề trong mục lời giải (lần xuất hiện cuối)
    const bad = await uploadDocx(NW, A, await mkDocx(body.slice(0, at) + stem.replace("bán kính 5", "bán kính 6") + body.slice(at + stem.length)));
    const bq = bad.json?.questions?.[0];
    check("lời giải có đầu đề lệch một con số (5→6) → bỏ: không đáp án, cảnh báo solution_unmatched kèm mã câu s1-1", bq?.answerSource === "khong-co" && bq.flags?.includes("answer_missing") && bad.json?.warnings?.some((w: any) => w.code === "solution_unmatched" && w.question === "s1-1"), [bq?.answerSource, bad.json?.warnings?.filter((w: any) => /solution/.test(w.code))]);
  }

  void mkTutor;
  await done();
})().catch(e => { console.error(e); process.exit(1); });
