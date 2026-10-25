// Test thuần cho phần Tiếng Anh (không cần DB, không cần máy chủ): npx tsx tools/local-e2e/t-english-lib.ts
import { lemmatize, bandOf, listEntry, allListEntries } from "@/lib/english/lexicon";
import { splitSentences, tokenize, coverage, coverageLevel, countWords } from "@/lib/english/text";
import { checkDictation, editDistance } from "@/lib/english/dictation";
import { gradeAnswer, normalizeAnswer } from "@/lib/english/grading";
import { computeStreak, vnDay, addDays } from "@/lib/english/day";
import { newCardRow, review, previewIntervals, newWordsAllowed, formatInterval } from "@/lib/english/srs";
import { scorePlacement, seededSample, PLACEMENT_BANDS } from "@/lib/english/placement";
import { splitUnits, keySegment, chunkPages, findKeyStart } from "@/lib/english/bookSplit";
import { cleanExercise } from "@/lib/english/ai";
import { bandFromRaw, rawNeeded, overallBand, componentTargets, parseAnswerKey, gradeMockAnswer, gradeSheet } from "@/lib/english/mock";
import { planPosition, dayBlock, PHASES, GATES, plannedHours } from "@/lib/english/plan";
import { weekStart } from "@/lib/english/day";

let pass = 0, fail = 0;
function check(name: string, cond: unknown, extra?: unknown) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}`, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : ""); }
}

console.log("lexicon");
check("có 3.807 từ trong danh sách", allListEntries().length === 3807, allListEntries().length);
check("NGSL 2.801 từ", allListEntries().filter(e => e.list === "ngsl").length === 2801);
check("NAWL 959 từ", allListEntries().filter(e => e.list === "nawl").length === 959);
const L: [string, string][] = [
  ["studies", "study"], ["studied", "study"], ["running", "run"], ["stopped", "stop"], ["went", "go"], ["children", "child"],
  ["boxes", "box"], ["making", "make"], ["better", "good"], ["cities", "city"], ["class", "class"], ["analyses", "analysis"],
  ["was", "be"], ["isn't", "isn't"], ["teacher", "teacher"], ["hoped", "hope"], ["bigger", "big"], ["data", "data"],
  ["researchers", "researcher"], ["quickly", "quickly"], ["Government's", "government"], ["focus", "focus"], ["bus", "bus"],
];
for (const [w, want] of L) check(`lemma ${w} → ${want}`, lemmatize(w) === want, lemmatize(w));
check("bandOf the = 1", bandOf("the") === 1);
check("bandOf từ lạ = 9", bandOf("qwertyzz") === 9);
check("listEntry authority là NAWL", listEntry("authority")?.list === "nawl");

console.log("text");
const s = splitSentences("Mr. Smith lives in the U.S. now. He earns 3.5 million dollars! Does he? Yes.\nNew paragraph here");
check("tách câu đúng 5 câu", s.length === 5, s);
check("không tách ở Mr.", s[0].startsWith("Mr. Smith"), s[0]);
const toks = tokenize("The children went to London. They didn't like it.", lemmatize);
const words = toks.filter(t => t.isWord);
check("tách được 9 từ", words.length === 9, words.map(w => w.text));
check("London là tên riêng", words.find(w => w.text === "London")?.proper === true);
check("The đầu câu không phải tên riêng", words[0].proper === false);
check("They đầu câu 2 không phải tên riêng", words.find(w => w.text === "They")?.proper === false);
check("children → child", words.find(w => w.text === "children")?.lemma === "child");
const cov = coverage(toks, new Set(["the", "go", "to", "they", "like", "it", "do", "didn't"]));
check("độ phủ đếm 8 từ (bỏ London)", cov.counted === 8, cov);
check("child là từ chưa biết", cov.unknown.includes("child"), cov.unknown);
check("coverageLevel 0.99 = nhe", coverageLevel(0.99) === "nhe" && coverageLevel(0.96) === "hoc" && coverageLevel(0.9) === "kho");
check("countWords", countWords("It's a test, isn't it?") === 5);

console.log("dictation");
const d1 = checkDictation("The weather is getting warmer.", "the weather is geting warmer");
check("chép gần đúng: 4/5 đúng", d1.correct === 4 && d1.total === 5, d1);
check("geting = gõ sai chính tả getting", d1.words[3].status === "wrong" && d1.words[3].typed === "geting", d1.words);
const d2 = checkDictation("I have lived here for two years.", "I lived here for 2 years");
check("bỏ sót have", d2.words[1].status === "missing", d2.words);
check("2 = two", d2.words[5].status === "ok", d2.words);
const d3 = checkDictation("She went home.", "she went to home");
check("từ thừa to", d3.extra.includes("to") && d3.score === 100, d3);
check("editDistance", editDistance("kitten", "sitting") === 3);

console.log("grading");
check("chuẩn hoá", normalizeAnswer("  Is Not. ") === "is not");
check("isn't = is not", gradeAnswer(["isn't"], "is not"));
check("đáp án có lựa chọn /", gradeAnswer(["has been / 's been"], "has been") && gradeAnswer(["has been / 's been"], "'s been"));
check("phần tuỳ chọn ()", gradeAnswer(["(I) don't know"], "don't know") && gradeAnswer(["(I) don't know"], "I do not know"));
check("sai thì sai", !gradeAnswer(["went"], "goed"));
check("rỗng là sai", !gradeAnswer(["went"], "   "));
check("nhiều đáp án", gradeAnswer(["a", "the"], "THE"));

console.log("day / streak");
check("vnDay 23:30 UTC = ngày hôm sau ở VN", vnDay(new Date("2026-10-14T23:30:00Z")) === "2026-10-15");
check("addDays", addDays("2026-03-01", -1) === "2026-02-28");
const today = "2026-10-15";
check("chuỗi 3 ngày liền", computeStreak(["2026-10-13", "2026-10-14", "2026-10-15"], today).days === 3);
check("hôm nay chưa học vẫn giữ chuỗi hôm qua", computeStreak(["2026-10-13", "2026-10-14"], today).days === 2);
const withRest = computeStreak(["2026-10-11", "2026-10-12", "2026-10-14", "2026-10-15"], today);
check("bỏ 1 ngày không đứt chuỗi", withRest.days === 4 && withRest.restUsedThisWeek, withRest);
check("bỏ 2 ngày liền thì đứt", computeStreak(["2026-10-11", "2026-10-12", "2026-10-15"], today).days === 1);
check("bỏ 2 ngày cách nhau trong 1 tuần thì đứt ở ngày thứ 2", computeStreak(["2026-10-09", "2026-10-11", "2026-10-13", "2026-10-14", "2026-10-15"], today).days === 4);
check("chưa học ngày nào = 0", computeStreak([], today).days === 0);

console.log("srs");
const now = new Date("2026-10-15T01:00:00Z");
const c0 = newCardRow(now);
check("thẻ mới state 0", c0.state === 0 && c0.reps === 0);
const r1 = review(c0, 3, now);
check("ôn lần đầu Nhớ → reps 1", r1.row.reps === 1, r1.row);
check("due sau thời điểm ôn", r1.row.due.getTime() > now.getTime());
const p = previewIntervals(c0, now);
check("preview có 4 mức, Quên ngắn nhất", Object.keys(p).length === 4 && typeof p[1] === "string", p);
let row = c0; let t = now;
for (let k = 0; k < 4; k++) { const r = review(row, 3, t); row = r.row; t = new Date(row.due.getTime() + 60_000); }
check("4 lần Nhớ → đã vào Review", row.state === 2, row);
const easyRow = review(row, 4, t).row, goodRow = review(row, 3, t).row;
check("Dễ cho khoảng cách dài hơn Nhớ", easyRow.scheduledDays >= goodRow.scheduledDays, [easyRow.scheduledDays, goodRow.scheduledDays]);
check("formatInterval", formatInterval(10 * 60_000) === "10 phút" && formatInterval(3 * 86400_000) === "3 ngày");
check("hàng ôn vượt trần → 0 từ mới", newWordsAllowed({ dailyNew: 15, reviewCap: 150, dueCount: 160, newDoneToday: 0 }) === 0);
check("gần trần → giảm nửa", newWordsAllowed({ dailyNew: 15, reviewCap: 150, dueCount: 120, newDoneToday: 0 }) === 8);
check("đã học 10 → còn 5", newWordsAllowed({ dailyNew: 15, reviewCap: 150, dueCount: 20, newDoneToday: 10 }) === 5);

console.log("placement");
check("mẫu có hạt giống tái lập", JSON.stringify(seededSample([1, 2, 3, 4, 5, 6], 3, 42)) === JSON.stringify(seededSample([1, 2, 3, 4, 5, 6], 3, 42)));
const ans = [
  ...Array.from({ length: 16 }, (_, i) => ({ lemma: "w" + i, band: "n1", known: true })),
  ...Array.from({ length: 16 }, (_, i) => ({ lemma: "x" + i, band: "n2", known: i < 10 })),
  ...Array.from({ length: 10 }, (_, i) => ({ lemma: "f" + i, band: "fake" as const, known: i < 1 })),
];
const sc = scorePlacement(ans);
check("nhóm 1 thuộc", sc.bands[0].mastered, sc.bands[0]);
check("nhóm 2 chưa thuộc (10/16, có trừ từ giả)", !sc.bands[1].mastered && sc.bands[1].adjusted < 10 / 16, sc.bands[1]);
check("tỉ lệ khai khống 0.1", Math.abs(sc.falseAlarm - 0.1) < 1e-9);
check("6 nhóm", PLACEMENT_BANDS.length === 6 && sc.bands.length === 6);
const allYes = scorePlacement([{ lemma: "a", band: "n1", known: true }, { lemma: "f", band: "fake", known: true }]);
check("khai biết cả từ giả → không tin", allYes.bands[0].adjusted === 0);

console.log("bookSplit");
const book = [
  { pageNo: 1, text: "Contents Unit 1 Present continuous Unit 2 Present simple Unit 3 Past Unit 4 Future" },
  { pageNo: 2, text: "Unit 1 Present continuous (I am doing)\nA She is eating. B We use..." },
  { pageNo: 3, text: "Exercises 1.1 Complete the sentences. 1 She ____ (eat)." },
  { pageNo: 4, text: "Unit 2 Present simple (I do)\nWe use the present simple... see Unit 1" },
  { pageNo: 5, text: "Exercises 2.1 Write the verbs." },
  { pageNo: 6, text: "Unit 3 Past simple\nI went." },
  { pageNo: 7, text: "Exercises 3.1" },
  { pageNo: 8, text: "Unit 4 Future\nI will go." },
  { pageNo: 9, text: "Key to Exercises\nUnit 1\n1.1 2 is eating 3 are playing\nUnit 2\n2.1 2 thinks" },
  { pageNo: 10, text: "Unit 3\n3.1 2 went\nUnit 4\n4.1 2 will" },
];
const sp = splitUnits(book);
check("tìm thấy phần đáp án ở trang 9", sp.keyStart === 9, sp.keyStart);
check("4 unit, bỏ trang mục lục", sp.units.length === 4, sp.units);
check("Unit 1 gồm trang 2–3", sp.units[0].pageStart === 2 && sp.units[0].pageEnd === 3, sp.units[0]);
check("'see Unit 1' trong Unit 2 không tạo unit mới", sp.units[1].unitNo === "2", sp.units[1]);
const k1 = keySegment(book, sp.keyStart, "1");
check("đáp án Unit 1 dừng trước Unit 2", !!k1 && k1.includes("is eating") && !k1.includes("thinks"), k1);
check("đáp án Unit 3 ở trang sau", (keySegment(book, sp.keyStart, "3") ?? "").includes("went"));
check("không có đáp án → null", keySegment(book, null, "1") === null);
const flat = splitUnits([1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => ({ pageNo: n, text: "Some reading passage without headings " + n })));
check("sách không có unit → chia 4 trang/phần", flat.units.length === 3 && flat.units[0].label.startsWith("Phần 1"), flat.units);
check("findKeyStart không bắt ở nửa đầu sách", findKeyStart([{ pageNo: 1, text: "Answer key is at the back" }, { pageNo: 2, text: "x" }]) === null);
const ch = chunkPages([{ pageNo: 3, text: "A sentence here. ".repeat(200) }], 500);
check("chia đoạn ≤ ~500 ký tự và giữ số trang", ch.length > 3 && ch.every(c => c.pageNo === 3 && c.text.length <= 520), ch.map(c => c.text.length));

console.log("cleanExercise");
check("bỏ câu không có đáp án", cleanExercise({ type: "gap", prompt: "x", answers: [] }) === null);
check("tfng luôn có 3 lựa chọn chuẩn", JSON.stringify(cleanExercise({ type: "tfng", prompt: "x", answers: ["TRUE"], options: ["Yes"] })?.options) === JSON.stringify(["TRUE", "FALSE", "NOT GIVEN"]));
check("choice thiếu lựa chọn bị bỏ", cleanExercise({ type: "choice", prompt: "x", answers: ["a"], options: ["a"] }) === null);
check("type lạ → gap", cleanExercise({ type: "xyz" as never, prompt: "x", answers: ["a"] })?.type === "gap");

console.log("thi thử: quy đổi band");
check("Listening 30 → 7.0", bandFromRaw("listening", 30) === 7);
check("Listening 29 → 6.5", bandFromRaw("listening", 29) === 6.5);
check("Listening 26 → 6.5, 25 → 6.0", bandFromRaw("listening", 26) === 6.5 && bandFromRaw("listening", 25) === 6);
check("Reading Academic 27 → 6.5, 26 → 6.0", bandFromRaw("reading", 27) === 6.5 && bandFromRaw("reading", 26) === 6);
check("Reading Academic 40 → 9, 0 → 0", bandFromRaw("reading", 40) === 9 && bandFromRaw("reading", 0) === 0);
check("Reading GT 35 → 7.0, 34 → 6.5", bandFromRaw("reading", 35, "general") === 7 && bandFromRaw("reading", 34, "general") === 6.5);
check("điểm thô ngoài khoảng bị kẹp", bandFromRaw("listening", 55) === 9 && bandFromRaw("listening", -3) === 0);
check("cần 30 câu cho Listening 7.0", rawNeeded("listening", 7) === 30);
check("cần 27 câu cho Reading 6.5", rawNeeded("reading", 6.5) === 27);
check("bảng giảm dần đơn điệu", Array.from({ length: 41 }, (_, i) => bandFromRaw("reading", i)).every((b, i, a) => i === 0 || b >= a[i - 1]));

console.log("thi thử: band tổng (làm tròn kiểu IELTS)");
check("6.5 6.5 5.0 7.0 → 6.5 (6.25 lên .5)", overallBand([6.5, 6.5, 5, 7]) === 6.5);
check("4 3.5 4 4 → 4.0 (3.875 lên số nguyên)", overallBand([4, 3.5, 4, 4]) === 4);
check("7.5 8 7 7 → 7.5 (7.375 → .5)", overallBand([7.5, 8, 7, 7]) === 7.5);
check("6 6.5 5.5 6 → 6.0", overallBand([6, 6.5, 5.5, 6]) === 6);
check("6.5 6 6 6 → 6.0 (6.125 xuống)", overallBand([6.5, 6, 6, 6]) === 6);
check("7 6.5 6 6 → 6.5 (6.375)", overallBand([7, 6.5, 6, 6]) === 6.5);
check("thiếu kỹ năng → null", overallBand([7, 6.5, 6]) === null);
const tg = componentTargets(6.5);
check("mục tiêu thành phần 6.5 = L7 R6.5 W6 S6", tg.listening === 7 && tg.reading === 6.5 && tg.writing === 6 && tg.speaking === 6);
check("mục tiêu thành phần ra đúng band tổng", overallBand([tg.listening, tg.reading, tg.writing, tg.speaking]) === 6.5);

console.log("thi thử: đọc đáp án dán từ sách");
const keyLines = parseAnswerKey("1 TRUE\n2. NOT GIVEN\n3) B\n4 cars OR vehicles\n5 (the) river\n6 4\n" + Array.from({ length: 34 }, (_, i) => `${i + 7} A`).join("\n"));
check("mỗi dòng một câu: đủ 40", keyLines.filter(Boolean).length === 40, keyLines);
check("'2. NOT GIVEN' → NOT GIVEN", keyLines[1] === "NOT GIVEN", keyLines[1]);
check("'OR' → '/'", keyLines[3] === "cars / vehicles", keyLines[3]);
check("đáp án là số ('6 4') không lẫn với số câu", keyLines[5] === "4", keyLines[5]);
const keyInline = parseAnswerKey("1 A 2 C 3 NOT GIVEN 4 (the) river 5 15 6 B");
check("đoạn liền: đọc đúng 6 câu", keyInline.slice(0, 6).join("|") === "A|C|NOT GIVEN|(the) river|15|B", keyInline.slice(0, 6));
check("đoạn liền: câu không có → rỗng", keyInline[6] === "");
check("nhiều câu trên một dòng", parseAnswerKey("1 A   2 B\n3 C 4 D\n5 E 6 F\n7 G 8 H\n9 I 10 A").slice(0, 10).join("") === "ABCDEFGHIA");
check("chấm: T = TRUE, ng = NOT GIVEN", gradeMockAnswer("TRUE", "t") && gradeMockAnswer("NOT GIVEN", "ng") && !gradeMockAnswer("TRUE", "F"));
check("chấm: '/' và '(…)'", gradeMockAnswer("cars / vehicles", "Vehicles") && gradeMockAnswer("(the) river", "river") && gradeMockAnswer("(the) river", "the river"));
check("chấm: chọn 2 chữ cái không phụ thuộc thứ tự", gradeMockAnswer("A, C", "C,A") && !gradeMockAnswer("A, C", "A"));
check("chấm: bỏ trống là sai", !gradeMockAnswer("A", ""));
const gs = gradeSheet(["A", "TRUE", "(the) river", "river"], ["a", "F", "the river", "the river"]);
check("chấm phiếu: 2/4 (key không có \"(the)\" thì thêm \"the\" là sai)", gs.raw === 2 && !gs.items[1].correct && !gs.items[3].correct, gs);

console.log("lộ trình 26 tuần");
check("4 chặng phủ kín tuần 1–26", PHASES[0].from === 1 && PHASES.at(-1)!.to === 26 && PHASES.every((p, i) => i === 0 || p.from === PHASES[i - 1].to + 1));
check("chặng theo band 6.5: 3.0→4.5 … 6.0→6.5", PHASES[0].bandFrom(6.5) === 3 && PHASES[0].bandTo(6.5) === 4.5 && PHASES[3].bandTo(6.5) === 6.5);
check("mốc tuần 6/14/22 = 4.5/5.0/6.0", GATES.map(g => g.min(6.5)).join() === "4.5,5,6");
const p0 = planPosition("2027-04-14", "2026-10-14");
check("còn 182 ngày → tuần 1, chặng Nền móng", p0.week === 1 && p0.phase.key === "nen-mong" && !p0.beforeWindow, p0);
const pFar = planPosition("2027-06-01", "2026-10-14");
check("thi còn xa → trước cửa sổ, vẫn tuần 1", pFar.beforeWindow && pFar.week === 1);
const p9 = planPosition("2027-04-14", "2026-12-14");
check("2 tháng sau → tuần 9, Tăng tốc, mốc kế: tuần 14", p9.week === 9 && p9.phase.key === "tang-toc" && p9.nextGate?.week === 14 && p9.nextGate.weeksAway === 5, { w: p9.week, g: p9.nextGate?.week });
const pEnd = planPosition("2027-04-14", "2027-04-10");
check("tuần thi → tuần 26, Nước rút, hết mốc", pEnd.week === 26 && pEnd.phase.key === "nuoc-rut" && pEnd.nextGate === null);
check("ngày thi đã qua → afterExam", planPosition("2026-10-01", "2026-10-14").afterExam);
check("chưa đặt ngày thi → chưa có lộ trình", !planPosition(null, "2026-10-14").hasExam);
check("Thứ Hai = Đọc", dayBlock("2026-10-12", p9).skill === "doc");
check("Thứ Ba = Nghe, Thứ Tư = Viết", dayBlock("2026-10-13", p9).skill === "nghe" && dayBlock("2026-10-14", p9).skill === "viet");
check("Chủ nhật = nghỉ", dayBlock("2026-10-18", p9).skill === "nghi");
check("Thứ Bảy chặng Nước rút = thi thử", dayBlock("2027-04-10", pEnd).skill === "thi-thu");
check("Thứ Bảy tuần thường = viết", dayBlock("2026-10-17", p9).skill === "viet");
check("Thứ Bảy đúng tuần mốc = thi thử", dayBlock("2026-10-17", { ...p9, nextGate: { ...p9.nextGate!, weeksAway: 0 } }).skill === "thi-thu");
check("kế hoạch 120 phút/ngày = 312 giờ", plannedHours(120) === 312);
check("weekStart: thứ Tư 14/10 → thứ Hai 12/10", weekStart("2026-10-14") === "2026-10-12");
check("weekStart: Chủ nhật 18/10 → 12/10", weekStart("2026-10-18") === "2026-10-12");

console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
