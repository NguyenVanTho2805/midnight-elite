// Ca phá bổ sung: imageMimeFromMagic bỏ kiểm một byte (vd 0x0a cuối PNG) → ca 'PNG cụt'/'WAVE' đỏ; wordAnalyseAllowed đổi `<` thành `<=` → ca 'đúng 20 → hết' đỏ.
// BU-03 P2 — nhiều mã đề (src/lib/deThiVariants.ts) + tách tệp gốc (deThiSourceFile.ts) + cờ cổng (deThiAssign.ts). THUẦN, không DB. Ca phá cố ý ở từng mục.
import { check, section, done } from "./h";
import { makeRng } from "@/lib/deThiBlueprint";
import {
  buildVariantPlan, optionsShuffleUnsafe, publishGate, questionsWithFormulaPlaceholder, shuffleWarnings, shuffleWithFixed, variantCode, variantKey, variantMatchesRoot,
  VARIANT_MAX, VARIANT_MIN, type KeyQuestion, type PlanQuestion,
} from "@/lib/deThiVariants";
import { isAllowedSourceUrl, looksLikeDocx, imageMimeFromMagic, wordAnalyseAllowed, WORD_ANALYSE_PER_HOUR } from "@/lib/deThiSourceFile";
import { AUDIENCE_LINK_READY, VARIANT_STUDENT_SUPPORT } from "@/lib/deThiAssign";
import { FORMULA_PLACEHOLDER } from "@/lib/ommlLatex";

const ABCD = (correct = 0) => ["Một", "Hai", "Ba", "Bốn"].map((t, i) => ({ text: t, isCorrect: i === correct }));
const mkQ = (text: string, o: Partial<KeyQuestion> = {}): KeyQuestion => ({ type: "MC", text, options: ABCD(), ...o });

(async () => {
section("Mã đề");
check("variantCode: 1→101, 2→102, 8→108 (chủ chốt 101,102,…)", variantCode(1) === 101 && variantCode(2) === 102 && variantCode(8) === 108);
check("PHÁ: không phải 1,2,3", variantCode(1) !== 1);
check("giới hạn mã: 2..8", VARIANT_MIN === 2 && VARIANT_MAX === 8);

section("shuffleWithFixed");
const order = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const sh = shuffleWithFixed(order, [0, 4, 9], makeRng("a"));
check("vị trí cố định giữ nguyên, phần còn lại là hoán vị của chính nó", sh[0] === 0 && sh[4] === 4 && sh[9] === 9 && [...sh].sort((a, b) => a - b).join() === order.join());
check("đảo thật (không còn nguyên thứ tự với 7 vị trí tự do)", sh.join() !== order.join());
check("không sửa mảng gốc", order.join() === "0,1,2,3,4,5,6,7,8,9");
check("cùng hạt → cùng thứ tự", shuffleWithFixed(order, [2], makeRng("k")).join() === shuffleWithFixed(order, [2], makeRng("k")).join());
check("PHÁ: ghim hết mọi vị trí → giữ nguyên hoàn toàn", shuffleWithFixed(order, order, makeRng("a")).join() === order.join());
check("chỉ số cố định ngoài phạm vi / âm / lẻ / lặp bị bỏ qua, không ném", (() => { const r = shuffleWithFixed(order, [99, -1, 1.5, 3, 3], makeRng("a")); return r[3] === 3 && [...r].sort((a, b) => a - b).join() === order.join(); })());
check("theo Phần: câu không rời Phần của nó", (() => {
  const items = ["a1", "a2", "a3", "b1", "b2", "b3", "b4"]; const groups = ["A", "A", "A", "B", "B", "B", "B"];
  for (const s of ["1", "2", "3", "4", "5"]) {
    const r = shuffleWithFixed(items, [], makeRng(s), groups);
    if (!r.slice(0, 3).every(x => x.startsWith("a")) || !r.slice(3).every(x => x.startsWith("b"))) return false;
  }
  return true;
})());
check("theo Phần + cố định: câu ghim trong Phần vẫn ở yên", (() => { const items = ["a1", "a2", "a3", "b1", "b2"]; const r = shuffleWithFixed(items, [1, 3], makeRng("q"), ["A", "A", "A", "B", "B"]); return r[1] === "a2" && r[3] === "b1"; })());
check("rỗng / 1 phần tử không ném", shuffleWithFixed([], [], makeRng("x")).length === 0 && shuffleWithFixed([7], [], makeRng("x")).join() === "7");

section("Phương án không đảo được");
const T = (...t: string[]) => t.map(text => ({ text }));
check("an toàn: bốn phương án thường", !optionsShuffleUnsafe(T("1", "2", "3", "4")) && !optionsShuffleUnsafe(T("x = 2", "x = -2", "x = 0", "x = 1")));
check("\"Cả A và B đúng\" → không đảo", optionsShuffleUnsafe(T("a", "b", "c", "Cả A và B đúng")));
check("\"Tất cả các đáp án trên\" → không đảo", optionsShuffleUnsafe(T("a", "b", "c", "Tất cả các đáp án trên")));
check("\"Không có đáp án nào đúng\" → không đảo", optionsShuffleUnsafe(T("a", "b", "c", "Không có đáp án nào đúng")));
check("\"A và C\", \"A, B\" (chỉ chữ cái HOA) → không đảo", optionsShuffleUnsafe(T("1", "2", "3", "A và C")) && optionsShuffleUnsafe(T("1", "2", "3", "A, B")));
check("\"Tất cả đều đúng\" / \"Cả hai đều sai\" → không đảo", optionsShuffleUnsafe(T("1", "2", "3", "Tất cả đều đúng")) && optionsShuffleUnsafe(T("1", "2", "3", "Cả hai đều sai")));
check("PHÁ: \"a và b\" chữ thường trong toán KHÔNG bị nhận nhầm", !optionsShuffleUnsafe(T("a và b", "a + b", "ab", "b − a")));
check("PHÁ: \"Tất cả các số nguyên\" (không nhắc phương án khác) KHÔNG bị nhận nhầm", !optionsShuffleUnsafe(T("Tất cả các số nguyên", "Số hữu tỉ", "Số thực", "Số phức")));
check("không phân biệt dấu/hoa thường: \"TAT CA CAC DAP AN TREN\"", optionsShuffleUnsafe(T("1", "TAT CA CAC DAP AN TREN")));
check("danh sách rỗng → an toàn", !optionsShuffleUnsafe([]));

section("variantKey xuyên mã đề");
const q0 = mkQ("Giải  phương trình x² = 4", { options: [{ text: "x=2", isCorrect: false }, { text: "x=±2", isCorrect: true }, { text: "x=4", isCorrect: false }] });
check("đảo thứ tự phương án KHÔNG đổi khoá", variantKey(q0) === variantKey({ ...q0, options: [...q0.options].reverse() }));
check("khoảng trắng/hoa thường không đổi khoá", variantKey(q0) === variantKey({ ...q0, text: " giải phương trình   X² = 4 " }));
check("PHÁ: đổi đáp án đúng → đổi khoá", variantKey(q0) !== variantKey({ ...q0, options: q0.options.map(o => ({ ...o, isCorrect: !o.isCorrect })) }));
check("PHÁ: đổi chữ đề / đổi loại câu → đổi khoá", variantKey(q0) !== variantKey({ ...q0, text: "Giải phương trình x² = 9" }) && variantKey(q0) !== variantKey({ ...q0, type: "MC_MULTI" }));
check("khoá 16 ký tự thập lục phân", /^[0-9a-f]{16}$/.test(variantKey(q0)));

section("Kế hoạch dựng mã đề");
const mkPlanQs = (k: number): PlanQuestion[] => Array.from({ length: k }, (_, i) => ({ type: i === 3 ? "TRUE_FALSE_CLUSTER" : i === 5 ? "SHORT_ANSWER" : "MC", sectionLabel: i < 6 ? "Phần I" : "Phần II", options: i === 5 ? [{ text: "7" }] : [{ text: "A1" }, { text: "B1" }, { text: "C1" }, { text: "D1" }] }));
const qs10 = mkPlanQs(10);
const plan = buildVariantPlan(qs10, { count: 4, shuffleQuestions: true, shuffleOptions: true, fixed: [0], seed: "P" });
check("count=4 → ba mã con, số 2,3,4 → mã 102,103,104", plan.variants.map(v => v.variantNo).join() === "2,3,4" && plan.variants.map(v => v.code).join() === "102,103,104");
check("mỗi mã con: order là hoán vị đủ 10 câu", plan.variants.every(v => [...v.order].sort((a, b) => a - b).join() === "0,1,2,3,4,5,6,7,8,9"));
check("câu cố định (vị trí 0) giữ ở vị trí 0 ở mọi mã", plan.variants.every(v => v.order[0] === 0));
check("câu không rời Phần: 6 câu đầu (Phần I) vẫn là câu 0..5, 4 câu cuối là 6..9", plan.variants.every(v => v.order.slice(0, 6).every(i => i < 6) && v.order.slice(6).every(i => i >= 6)));
check("mỗi mã con khác đề gốc (có gì đó được đảo)", plan.variants.every(v => v.order.join() !== "0,1,2,3,4,5,6,7,8,9" || v.optionOrders.some(o => o.join() !== o.map((_, i) => i).join())));
check("các mã con khác nhau", new Set(plan.variants.map(v => v.order.join() + "|" + v.optionOrders.map(o => o.join("")).join("/"))).size === 3);
check("optionOrders: hoán vị đủ phương án; Đ/S và trả lời ngắn KHÔNG đảo phương án (v1)", plan.variants.every(v => v.optionOrders.every((o, i) => [...o].sort().join() === o.map((_, k) => k).join() && (i === 3 || i === 5 ? o.join() === o.map((_, k) => k).join() : true))));
check("cùng hạt → cùng kế hoạch; hạt khác → khác", JSON.stringify(plan) === JSON.stringify(buildVariantPlan(qs10, { count: 4, shuffleQuestions: true, shuffleOptions: true, fixed: [0], seed: "P" })) && JSON.stringify(plan) !== JSON.stringify(buildVariantPlan(qs10, { count: 4, shuffleQuestions: true, shuffleOptions: true, fixed: [0], seed: "P2" })));
const onlyOpts = buildVariantPlan(qs10, { count: 2, shuffleQuestions: false, shuffleOptions: true, fixed: [], seed: "P" });
check("chỉ đảo phương án: thứ tự câu giữ nguyên", onlyOpts.variants[0].order.join() === "0,1,2,3,4,5,6,7,8,9" && onlyOpts.variants[0].optionOrders.some(o => o.join() !== o.map((_, i) => i).join()));
const onlyQs = buildVariantPlan(qs10, { count: 2, shuffleQuestions: true, shuffleOptions: false, fixed: [], seed: "P" });
check("chỉ đảo câu: phương án giữ nguyên", onlyQs.variants[0].optionOrders.every(o => o.join() === o.map((_, i) => i).join()) && onlyQs.variants[0].order.join() !== "0,1,2,3,4,5,6,7,8,9");
const unsafeQs: PlanQuestion[] = [{ type: "MC", sectionLabel: null, options: T("1", "2", "3", "Cả A và B") }, { type: "MC", sectionLabel: null, options: T("1", "2", "3", "4") }];
const pu = buildVariantPlan(unsafeQs, { count: 3, shuffleQuestions: false, shuffleOptions: true, fixed: [], seed: "U" });
check("câu có \"Cả A và B\": giữ nguyên phương án ở mọi mã + có cảnh báo cho câu đó", pu.variants.every(v => v.optionOrders[0].join() === "0,1,2,3") && pu.warnings.length === 1 && pu.warnings[0].questionIndex === 0 && pu.warnings[0].code === "OPTIONS_NOT_SHUFFLED" && /Câu 1/.test(pu.warnings[0].message));
check("shuffleWarnings độc lập với kế hoạch (màn hiện cảnh báo cả khi chưa tạo)", shuffleWarnings(unsafeQs).length === 1);
check("PHÁ: đề 1 câu, ghim hết, không đảo được gì → vẫn trả đủ mã, không treo/ném", (() => { const p = buildVariantPlan([{ type: "ESSAY", sectionLabel: null, options: [] }], { count: 3, shuffleQuestions: true, shuffleOptions: true, fixed: [0], seed: "x" }); return p.variants.length === 2 && p.variants.every(v => v.order.join() === "0"); })());
check("đề rỗng → không ném", buildVariantPlan([], { count: 3, shuffleQuestions: true, shuffleOptions: true, fixed: [], seed: "x" }).variants.length === 2);

section("Mã con còn khớp đề gốc?");
const rootQs = [mkQ("Câu một"), mkQ("Câu hai", { options: ABCD(2) })];
const childOk: KeyQuestion[] = [{ ...rootQs[1], options: [...rootQs[1].options].reverse() }, { ...rootQs[0], options: [...rootQs[0].options].reverse() }];
check("đảo câu + đảo phương án vẫn khớp", variantMatchesRoot(rootQs, childOk));
check("PHÁ: gốc đổi đáp án đúng sau khi tạo mã → không khớp (VARIANTS_STALE)", !variantMatchesRoot([rootQs[0], mkQ("Câu hai", { options: ABCD(3) })], childOk));
check("PHÁ: gốc thêm câu / bớt câu → không khớp", !variantMatchesRoot([...rootQs, mkQ("Câu ba")], childOk) && !variantMatchesRoot(rootQs.slice(0, 1), childOk));

section("Cổng phát hành");
const gq = (text: string, extra: Partial<{ explanation: string; options: { text: string }[] }> = {}) => ({ text, explanation: null, options: [{ text: "A" }, { text: "B" }], ...extra });
const gate = (o: Partial<Parameters<typeof publishGate>[0]> = {}) => publishGate({ questions: [gq("Câu 1")], variantCount: 1, variantStudentSupport: false, mode: null, hasSchedule: true, ...o });
check("đề thường sạch → qua cổng (cờ mã đề không ảnh hưởng đề 1 mã)", gate() === null);
check("còn ⟦công thức⟧ trong đề → 422 FORMULA_UNREAD, nêu số câu", (() => { const g = gate({ questions: [gq("ok"), gq(`Tính ${FORMULA_PLACEHOLDER}`)] }); return g?.status === 422 && g.code === "FORMULA_UNREAD" && /câu 2/.test(g.error); })());
check("⟦công thức⟧ trong phương án hoặc lời giải cũng bị chặn", gate({ questions: [gq("ok", { options: [{ text: `x = ${FORMULA_PLACEHOLDER}` }] })] })?.code === "FORMULA_UNREAD" && gate({ questions: [gq("ok", { explanation: FORMULA_PLACEHOLDER })] })?.code === "FORMULA_UNREAD");
check("PHÁ: chữ gần giống (⟦công thức⟧ thiếu ngoặc) KHÔNG bị chặn", gate({ questions: [gq("Công thức ⟦ không đóng")] }) === null);
check("questionsWithFormulaPlaceholder trả đúng chỉ số 1-based", questionsWithFormulaPlaceholder([gq("a"), gq(FORMULA_PLACEHOLDER), gq("c"), gq(FORMULA_PLACEHOLDER)]).join() === "2,4");
check("đề 3 mã khi cờ VARIANT_STUDENT_SUPPORT=false → 422 VARIANTS_NOT_READY", (() => { const g = gate({ variantCount: 3 }); return g?.status === 422 && g.code === "VARIANTS_NOT_READY"; })());
check("cùng đề 3 mã khi cờ = true → qua cổng", gate({ variantCount: 3, variantStudentSupport: true }) === null);
check("CỜ sau BU-04: VARIANT_STUDENT_SUPPORT=true, AUDIENCE_LINK_READY=true", VARIANT_STUDENT_SUPPORT === true && AUDIENCE_LINK_READY === true);
check("mode=test thiếu giờ → NEED_SCHEDULE; có giờ → qua; mode=practice không cần giờ", gate({ mode: "test", hasSchedule: false })?.code === "NEED_SCHEDULE" && gate({ mode: "test", hasSchedule: true }) === null && gate({ mode: "practice", hasSchedule: false }) === null);
check("mã con cũ không khớp gốc → VARIANTS_STALE (kiểm trước VARIANTS_NOT_READY)", gate({ variantCount: 3, variantsStale: true, variantStudentSupport: true })?.code === "VARIANTS_STALE" && gate({ variantCount: 3, variantsStale: true })?.code === "VARIANTS_STALE");
check("PHÁ: variantsStale với đề 1 mã không chặn", gate({ variantCount: 1, variantsStale: true }) === null);
check("công thức thắng mọi lý do khác (gia sư sửa công thức trước)", gate({ questions: [gq(FORMULA_PLACEHOLDER)], variantCount: 3, mode: "test", hasSchedule: false })?.code === "FORMULA_UNREAD");
// BU-04 rà soát: đề N>1 mã mà có câu tự luận → học sinh làm mã con kẹt "chờ chấm", gia sư không thấy bài (màn chấm chỉ đọc đề gốc) → chặn phát hành.
check("đề 3 mã CÓ tự luận (cờ = true) → 422 VARIANTS_ESSAY, nói rõ lý do", (() => { const g = gate({ variantCount: 3, variantStudentSupport: true, hasEssay: true }); return g?.status === 422 && g.code === "VARIANTS_ESSAY" && /tự luận/.test(g.error); })());
check("PHÁ: đề 1 mã CÓ tự luận vẫn qua cổng; đề 3 mã KHÔNG tự luận vẫn qua", gate({ variantCount: 1, hasEssay: true }) === null && gate({ variantCount: 3, variantStudentSupport: true, hasEssay: false }) === null);
check("thứ tự lý do: VARIANTS_STALE và NOT_READY thắng VARIANTS_ESSAY", gate({ variantCount: 3, variantsStale: true, hasEssay: true, variantStudentSupport: true })?.code === "VARIANTS_STALE" && gate({ variantCount: 3, hasEssay: true })?.code === "VARIANTS_NOT_READY");

section("Tệp đề gốc: chống SSRF");
check("Cloudinary https → cho phép", isAllowedSourceUrl("https://res.cloudinary.com/demo/raw/upload/v1/de.docx"));
for (const bad of [
  "http://res.cloudinary.com/x.docx", "https://evil.com/x.docx", "https://res.cloudinary.com.evil.com/x.docx", "https://evilres.cloudinary.com/x.docx",
  "https://res.cloudinary.com@evil.com/x.docx", "https://user:pw@res.cloudinary.com/x.docx", "https://res.cloudinary.com:8443/x.docx",
  "http://169.254.169.254/latest/meta-data", "https://localhost/x", "file:///etc/passwd", "ftp://res.cloudinary.com/x", "//res.cloudinary.com/x", "res.cloudinary.com/x", "", "https://api.cloudinary.com/x",
]) check(`chặn: ${bad || "(rỗng)"}`, !isAllowedSourceUrl(bad));
check("không phải chuỗi → chặn, không ném", !isAllowedSourceUrl(null) && !isAllowedSourceUrl(42) && !isAllowedSourceUrl("https://res.cloudinary.com/" + "a".repeat(2100)));
check("nhận .docx theo tên hoặc loại; .doc/.docm/pdf không nhận", looksLikeDocx({ fileName: "De.DOCX", fileType: "" }) && looksLikeDocx({ fileName: "x", fileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }) && !looksLikeDocx({ fileName: "De.doc", fileType: "application/msword" }) && !looksLikeDocx({ fileName: "De.docm", fileType: "" }) && !looksLikeDocx({ fileName: "a.pdf", fileType: "application/pdf" }));

section("Hình trong Word: kiểm magic byte (đuôi tệp không đáng tin)");
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const jpg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const gif = Uint8Array.from(Buffer.from("GIF89a....", "latin1"));
const webp = Uint8Array.from(Buffer.from("RIFF\x10\x00\x00\x00WEBPVP8 ", "latin1"));
check("png / jpeg / gif / webp nhận đúng loại", imageMimeFromMagic(png) === "image/png" && imageMimeFromMagic(jpg) === "image/jpeg" && imageMimeFromMagic(gif) === "image/gif" && imageMimeFromMagic(webp) === "image/webp");
check("PHÁ: tệp .exe/ZIP/HTML đổi đuôi .png → null (không tải lên)", imageMimeFromMagic(Uint8Array.from(Buffer.from("MZ\x90\x00"))) === null && imageMimeFromMagic(Uint8Array.from(Buffer.from("PK\x03\x04"))) === null && imageMimeFromMagic(Uint8Array.from(Buffer.from("<html><script>"))) === null);
check("PHÁ: rỗng / quá ngắn / PNG cụt không ném lỗi, trả null", imageMimeFromMagic(new Uint8Array(0)) === null && imageMimeFromMagic(png.slice(0, 4)) === null && imageMimeFromMagic(jpg.slice(0, 2)) === null && imageMimeFromMagic(webp.slice(0, 8)) === null);
check("RIFF không phải WEBP (WAVE) → null", imageMimeFromMagic(Uint8Array.from(Buffer.from("RIFF\x10\x00\x00\x00WAVEfmt "))) === null);

section("Hạn mức phân tích Word: 20 lần/giờ/gia sư");
check(`đã dùng ${WORD_ANALYSE_PER_HOUR - 1} → còn được; đúng ${WORD_ANALYSE_PER_HOUR} → hết (429)`, wordAnalyseAllowed(WORD_ANALYSE_PER_HOUR - 1) && !wordAnalyseAllowed(WORD_ANALYSE_PER_HOUR));
check("PHÁ: 0 → được; vượt xa / NaN / Infinity → không được", wordAnalyseAllowed(0) && !wordAnalyseAllowed(500) && !wordAnalyseAllowed(NaN) && !wordAnalyseAllowed(Infinity));

await done();
})();
