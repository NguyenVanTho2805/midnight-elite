// Test API đầu-cuối cho phần Tiếng Anh tự học (Postgres thử + Next dev cổng 3100, máy chủ chạy với ENGLISH_AI_FAKE=1).
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-english.ts
import { prisma } from "@/lib/prisma";
import { api, check, done, mkUser, section, wipe } from "./h";
import { vnDay, addDays } from "@/lib/english/day";
import { allListEntries } from "@/lib/english/lexicon";

const FILLER = "The students in the small town go to school every morning. They read books, write short stories and talk with their teachers about the world. ";

async function main() {
  await wipe();
  // Máy chủ chỉ nạp kho từ một lần mỗi tiến trình (cờ trong bộ nhớ); wipe() đã xoá bảng nên nạp lại ở đây như DB thật sau lần đầu.
  const entries0 = allListEntries();
  for (let i = 0; i < entries0.length; i += 1000) {
    await prisma.engWord.createMany({ data: entries0.slice(i, i + 1000).map(e => ({ lemma: e.lemma, list: e.list, listRank: e.listRank, freqRank: e.freqRank })), skipDuplicates: true });
  }
  const a = await mkUser({ name: "Thọ" });
  const b = await mkUser({ name: "Người khác" });

  section("đăng nhập + Hôm nay");
  check("chưa đăng nhập → 401", (await api("GET", "/api/english/today")).status === 401);
  let t = await api("GET", "/api/english/today", { as: a });
  check("today 200", t.status === 200, t.text.slice(0, 300));
  check("kho từ đủ 3.807 từ NGSL/NAWL", (await prisma.engWord.count()) === 3807);
  check("chưa xếp lớp, chưa có ngày thi", t.json.profile.placementDone === false && t.json.plan.hasExam === false);

  const exam = addDays(vnDay(), 7 * 17 + 3); // còn ~17,5 tuần → tuần 9 của lộ trình
  let r = await api("PATCH", "/api/english/profile", { as: a, body: { examDate: exam, targetBand: 6.5, dailyNew: 10 } });
  check("đặt ngày thi + mục tiêu", r.status === 200 && r.json.examDate === exam && r.json.dailyNew === 10, r.json);
  check("band mục tiêu sai bước bị chặn", (await api("PATCH", "/api/english/profile", { as: a, body: { targetBand: 6.3 } })).status === 400);
  t = await api("GET", "/api/english/today", { as: a });
  check("lộ trình: tuần 9 chặng Tăng tốc, mốc kế tiếp tuần 14 (≥ 5.0)", t.json.plan.week === 9 && t.json.plan.phase.key === "tang-toc" && t.json.plan.nextGate.week === 14 && t.json.plan.nextGate.min === 5, t.json.plan);
  check("khối hôm nay có đường dẫn", typeof t.json.plan.today.href === "string" && t.json.plan.today.label.length > 0);

  section("xếp lớp từ vựng");
  r = await api("GET", "/api/english/placement", { as: a });
  check("đề 106 từ (96 thật + 10 giả)", r.json.items.length === 106, r.json.items.length);
  const entries = await prisma.engWord.findMany({ where: { lemma: { in: r.json.items.map((i: { lemma: string }) => i.lemma) } }, select: { lemma: true, list: true, listRank: true } });
  const rank = new Map(entries.map(e => [e.lemma, e]));
  const answers = r.json.items.map((i: { lemma: string }) => { const e = rank.get(i.lemma); return { lemma: i.lemma, known: !!e && e.list === "ngsl" && (e.listRank ?? 9999) <= 1000 }; });
  r = await api("POST", "/api/english/placement", { as: a, body: { answers } });
  check("nhóm NGSL 1–1000 thuộc, nhóm sau chưa", r.json.bands[0].mastered && r.json.bands[1].mastered && !r.json.bands[2].mastered, r.json.bands);
  check("đánh dấu ~1.000 từ đã biết", r.json.markedKnown >= 990 && r.json.markedKnown <= 1100, r.json.markedKnown);
  check("đề quá ngắn bị chặn", (await api("POST", "/api/english/placement", { as: a, body: { answers: answers.slice(0, 5) } })).status === 400);

  section("ôn thẻ FSRS");
  r = await api("GET", "/api/english/review", { as: a });
  check("mở 10 từ mới (dailyNew)", r.json.cards.filter((c: { isNew: boolean }) => c.isNew).length === 10, r.json.cards.length);
  check("từ mới không thuộc nhóm đã biết", r.json.cards.every((c: { word: { lemma: string } }) => !answers.find((x: { lemma: string; known: boolean }) => x.lemma === c.word.lemma && x.known)));
  check("thẻ có nghĩa tiếng Việt + nút xem trước lịch", r.json.cards[0].word.meaningVi && r.json.cards[0].preview["3"], r.json.cards[0]);
  const card = r.json.cards[0];
  r = await api("POST", "/api/english/review", { as: a, body: { cardId: card.id, rating: 3, durationMs: 4000 } });
  check("chấm Nhớ → xếp lịch", r.status === 200 && r.json.ok && !r.json.duplicate, r.json);
  check("bấm hai lần trong 3 giây không xếp lịch lần nữa", (await api("POST", "/api/english/review", { as: a, body: { cardId: card.id, rating: 3 } })).json.duplicate === true);
  check("người khác không chấm được thẻ của tôi", (await api("POST", "/api/english/review", { as: b, body: { cardId: card.id, rating: 3 } })).status === 404);
  check("mức nhớ sai bị chặn", (await api("POST", "/api/english/review", { as: a, body: { cardId: r.json.cardId ?? card.id, rating: 7 } })).status === 400);
  check("có nhật ký ôn", (await prisma.engReviewLog.count({ where: { userId: a.id } })) === 1);

  section("đọc: bài dán, tra nghĩa, bắt từ, câu hỏi, đọc xong");
  r = await api("POST", "/api/english/texts", { as: a, body: { title: "A small town", body: FILLER.repeat(3) + "Researchers believe the phenomenon is ubiquitous." } });
  check("dán bài → tạo bài riêng", r.status === 200 && r.json.id, r.json);
  const textId = r.json.id;
  check("bài quá ngắn bị chặn", (await api("POST", "/api/english/texts", { as: a, body: { title: "x", body: "too short" } })).status === 400);
  check("link không phải VOA bị chặn", (await api("POST", "/api/english/texts", { as: a, body: { url: "https://example.com/a" } })).status === 400);
  r = await api("GET", "/api/english/texts", { as: a });
  const item = r.json.items.find((i: { id: string }) => i.id === textId);
  check("danh sách có độ phủ từ vựng của tôi", item && item.coverage > 50 && item.coverage < 100 && ["nhe", "hoc", "kho"].includes(item.level), item);
  check("bài riêng: người khác không thấy", (await api("GET", `/api/english/texts/${textId}`, { as: b })).status === 404);
  r = await api("GET", `/api/english/texts/${textId}`, { as: a });
  check("bài có câu, token kèm lemma, độ phủ", r.json.sentences.length >= 6 && r.json.tokens.length > 50 && typeof r.json.coverage === "number", { s: r.json.sentences?.length });
  r = await api("POST", "/api/english/lookup", { as: a, body: { word: "phenomenon", sentence: "Researchers believe the phenomenon is ubiquitous." } });
  check("tra nghĩa theo câu", r.status === 200 && r.json.meaningVi && r.json.lemma === "phenomenon", r.json);
  check("tra lần 2 lấy từ bộ nhớ đệm", (await api("POST", "/api/english/lookup", { as: a, body: { word: "phenomenon", sentence: "Researchers believe the phenomenon is ubiquitous." } })).json.cached === true);
  r = await api("POST", "/api/english/words", { as: a, body: { word: "ubiquitous", context: "Researchers believe the phenomenon is ubiquitous.", contextVi: "có mặt khắp nơi", textId } });
  check("bắt từ → vào sổ + mở thẻ nhận diện", r.status === 200 && r.json.word.lemma === "ubiquitous", r.json);
  const ubi = await prisma.engWord.findUnique({ where: { lemma: "ubiquitous" } });
  check("thẻ của từ vừa bắt tồn tại", !!ubi && (await prisma.engCard.count({ where: { userId: a.id, wordId: ubi.id } })) === 1);
  r = await api("POST", `/api/english/texts/${textId}/questions`, { as: a });
  check("soạn câu hỏi đọc hiểu", r.status === 200 && r.json.created === 2, r.json);
  check("gọi lại không soạn trùng", (await api("POST", `/api/english/texts/${textId}/questions`, { as: a })).json.created === 0);
  r = await api("GET", `/api/english/texts/${textId}`, { as: a });
  const q1 = r.json.exercises.find((e: { type: string }) => e.type === "tfng");
  check("câu hỏi không lộ đáp án", q1 && !("answers" in q1), q1);
  r = await api("POST", `/api/english/exercises/${q1.id}/answer`, { as: a, body: { answer: "TRUE", seconds: 20 } });
  check("trả lời đúng TRUE", r.json.correct === true, r.json);
  r = await api("POST", `/api/english/texts/${textId}/finish`, { as: a, body: { lemmas: ["town", "notinthetext", "morning"], seconds: 300 } });
  check("đọc xong: chỉ nhận lemma có trong bài", r.status === 200 && r.json.marked <= 2, r.json);

  section("nghe: chép chính tả");
  check("ghi kết quả chép chính tả", (await api("POST", "/api/english/dictation", { as: a, body: { textId, correct: 8, total: 10, seconds: 60 } })).status === 200);
  check("dữ liệu sai bị chặn", (await api("POST", "/api/english/dictation", { as: a, body: { textId, correct: 11, total: 10 } })).status === 400);

  section("lớp học từ sách");
  const pages = [
    "Contents\nUnit 1 Present continuous\nUnit 2 Present simple\nUnit 3 Past simple\nUnit 4 Future",
    "Unit 1 Present continuous\nWe use am/is/are + -ing for something happening now. She is eating.",
    "Exercises 1.1 Complete: Please be quiet. I ____ (work).",
    "Unit 2 Present simple\nWe use the present simple for habits. She thinks a lot. See Unit 1.",
    "Exercises 2.1 Complete: He ____ (go) to school every day.",
    "Unit 3 Past simple\nWe use the past simple for finished actions. I went home.",
    "Exercises 3.1 Complete: Yesterday I ____ (go) to the cinema.",
    "Unit 4 Future\nWe use will for decisions. I will help you.",
    "Exercises 4.1 Complete: I think it ____ (rain) tomorrow.",
    "Key to Exercises\nUnit 1\n1.1 2 am working\nUnit 2\n2.1 2 goes",
    "Unit 3\n3.1 2 went\nUnit 4\n4.1 2 will rain",
    "Index of grammar points and irregular verbs for this book",
  ];
  r = await api("POST", "/api/english/books", { as: a, body: { title: "Essential Grammar in Use", kind: "grammar", fileName: "egu.pdf", pageCount: pages.length } });
  check("tạo sách rỗng", r.status === 200 && r.json.id, r.json);
  const bookId = r.json.id;
  check("sách quá dài bị chặn", (await api("POST", "/api/english/books", { as: a, body: { title: "x", pageCount: 5000 } })).status === 400);
  r = await api("POST", `/api/english/books/${bookId}/pages`, { as: a, body: { pages: pages.slice(0, 6).map((text, i) => ({ pageNo: i + 1, text })) } });
  check("gửi 6 trang đầu", r.json.uploaded === 6, r.json);
  check("chưa đủ trang thì chưa xử lý", (await api("POST", `/api/english/books/${bookId}/process`, { as: a, body: {} })).status === 409);
  await api("POST", `/api/english/books/${bookId}/pages`, { as: a, body: { pages: pages.slice(6).map((text, i) => ({ pageNo: i + 7, text })) } });
  check("gửi lại trang cũ không nhân đôi", (await api("POST", `/api/english/books/${bookId}/pages`, { as: a, body: { pages: [{ pageNo: 1, text: "dup" }] } })).json.uploaded === 12);
  check("người khác không xử lý được sách của tôi", (await api("POST", `/api/english/books/${bookId}/process`, { as: b, body: {} })).status === 404);
  let status = "pages";
  for (let i = 0; i < 10 && status !== "ready"; i++) {
    r = await api("POST", `/api/english/books/${bookId}/process`, { as: a, body: {} });
    status = r.json.status;
  }
  check("xử lý xong sách", status === "ready", r.json);
  r = await api("GET", `/api/english/books/${bookId}`, { as: a });
  check("chia đúng 4 unit, đều sẵn sàng", r.json.units.length === 4 && r.json.units.every((u: { status: string; exercises: number }) => u.status === "ready" && u.exercises > 0), r.json.units);
  check("ghi nhận trang đáp án", /trang 10/.test(r.json.statusNote ?? ""), r.json.statusNote);
  const unitId = r.json.units[0].id;
  check("người khác không mở được unit", (await api("GET", `/api/english/units/${unitId}`, { as: b })).status === 404);
  r = await api("GET", `/api/english/units/${unitId}`, { as: a });
  check("unit có tóm tắt + bài tập (không lộ đáp án)", r.json.summaryVi && r.json.exercises.length > 0 && !("answers" in r.json.exercises[0]), r.json);
  const exId = r.json.exercises[0].id;
  check("người khác không làm được câu trong sách tôi", (await api("POST", `/api/english/exercises/${exId}/answer`, { as: b, body: { answer: "x" } })).status === 404);
  r = await api("POST", `/api/english/exercises/${exId}/answer`, { as: a, body: { answer: "are", seconds: 15 } });
  check("làm sai → chấm sai + điểm unit", r.json.correct === false && r.json.unitScore === 0, r.json);
  check("câu sai thành thẻ làm lại", (await prisma.engCard.count({ where: { userId: a.id, key: `x:${exId}` } })) === 1);
  r = await api("POST", `/api/english/exercises/${exId}/answer`, { as: a, body: { answer: "is" } });
  check("đáp án 'is / 's' chấp nhận 'is'", r.json.correct === true && r.json.unitScore === 100, r.json);
  r = await api("POST", `/api/english/units/${unitId}/variants`, { as: a });
  check("AI soạn bài biến thể đã tự kiểm chứng", r.status === 200 && r.json.created === 10, r.json);
  r = await api("POST", "/api/english/ask", { as: a, body: { question: "When do we use the present continuous?", bookId } });
  check("hỏi sách: trả lời kèm trích dẫn trang", r.status === 200 && r.json.found && r.json.citations.length > 0 && r.json.citations[0].pageNo >= 1, r.json);
  check("người khác hỏi trong sách tôi → 404", (await api("POST", "/api/english/ask", { as: b, body: { question: "present continuous", bookId } })).status === 404);
  check("người chưa có sách → 409", (await api("POST", "/api/english/ask", { as: b, body: { question: "present continuous" } })).status === 409);
  check("ẩn câu sai (chỉ câu của mình)", (await api("POST", `/api/english/exercises/${exId}/flag`, { as: a })).status === 200 && (await api("POST", `/api/english/exercises/${q1.id}/flag`, { as: b })).status === 404);

  section("viết: góp ý 4 tiêu chí");
  const essay = "Some people think that students should study at home. " + "I believe that studying at school is better because students can talk with teachers and friends every day. ".repeat(4);
  r = await api("POST", "/api/english/writing", { as: a, body: { taskType: "task2", prompt: "Some people think students should study at home. Discuss.", body: essay, seconds: 1800 } });
  check("góp ý có khoảng band + 4 tiêu chí", r.status === 200 && r.json.bandLow <= r.json.bandHigh && r.json.feedback.criteria.length === 4, r.json);
  check("bài quá ngắn bị chặn", (await api("POST", "/api/english/writing", { as: a, body: { taskType: "task2", prompt: "Discuss something here.", body: "Too short." } })).status === 400);
  check("viết lại phải trỏ bài của mình", (await api("POST", "/api/english/writing", { as: b, body: { taskType: "task2", prompt: "Discuss something here.", body: essay, revisionOfId: r.json.id } })).status === 404);

  section("thi thử IELTS");
  const key = Array.from({ length: 40 }, (_, i) => `${i + 1} ${i % 3 === 0 ? "TRUE" : i % 3 === 1 ? "B" : "(the) river"}`).join("\n");
  const mine = Array.from({ length: 40 }, (_, i) => (i < 30 ? (i % 3 === 0 ? "T" : i % 3 === 1 ? "b" : "river") : "wrong"));
  r = await api("POST", "/api/english/mock", { as: a, body: { skill: "listening", title: "Cambridge 18 — Test 1", answers: mine, keyText: key, seconds: 1900 } });
  check("Listening 30/40 → band 7.0", r.status === 200 && r.json.raw === 30 && r.json.band === 7, { s: r.status, raw: r.json?.raw, band: r.json?.band, e: r.json?.error });
  check("trả từng câu đúng/sai", r.json.items.length === 40 && r.json.items[39].correct === false);
  const mockId = r.json.id;
  r = await api("POST", "/api/english/mock", { as: a, body: { skill: "reading", module: "academic", title: "Cambridge 18 — Test 1", answers: mine.map((x, i) => (i < 27 ? x : "")), keyText: key, seconds: 3500 } });
  check("Reading 27/40 → 6.5", r.json.raw === 27 && r.json.band === 6.5, r.json);
  r = await api("POST", "/api/english/mock", { as: a, body: { skill: "reading", title: "Đề thiếu đáp án", answers: mine, keyText: "1 A\n2 B" } });
  check("đáp án thiếu câu → báo rõ câu nào", r.status === 400 && /câu 3/.test(r.json.error), r.json);
  check("phiếu thiếu ô bị chặn", (await api("POST", "/api/english/mock", { as: a, body: { skill: "listening", title: "x", answers: ["a"], keyText: key } })).status === 400);
  check("nhập band Writing", (await api("POST", "/api/english/mock", { as: a, body: { skill: "writing", title: "Cô X chấm", band: 6 } })).status === 200);
  check("band Speaking sai bước bị chặn", (await api("POST", "/api/english/mock", { as: a, body: { skill: "speaking", title: "x", band: 6.2 } })).status === 400);
  await api("POST", "/api/english/mock", { as: a, body: { skill: "speaking", title: "Nói thử", band: 6 } });
  r = await api("GET", "/api/english/mock", { as: a });
  check("band tổng = 6.5 (7.0, 6.5, 6.0, 6.0)", r.json.overall === 6.5 && r.json.latest.listening.band === 7, { overall: r.json.overall });
  check("mục tiêu thành phần + số câu cần", r.json.targets.listening === 7 && r.json.rawTargets.listening === 30 && r.json.rawTargets.reading === 27, r.json.rawTargets);
  check("người khác không thấy lịch sử của tôi", (await api("GET", "/api/english/mock", { as: b })).json.items.length === 0);
  check("người khác không mở / xoá được bài của tôi", (await api("GET", `/api/english/mock/${mockId}`, { as: b })).status === 404 && (await api("DELETE", `/api/english/mock/${mockId}`, { as: b })).status === 404);
  r = await api("GET", `/api/english/mock/${mockId}`, { as: a });
  check("xem lại phiếu đã chấm", r.json.items.length === 40 && r.json.items[0].correct === true, r.json.items?.[0]);

  section("tiến độ + sổ lỗi");
  r = await api("GET", "/api/english/progress", { as: a });
  check("tiến độ 200", r.status === 200, r.text.slice(0, 300));
  check("12 tuần, có phút học tuần này", r.json.weeks.length === 12 && r.json.weeks[11].minutes > 0, r.json.weeks?.[11]);
  check("kế hoạch 312 giờ (120 phút/ngày)", r.json.hours.planned === 312 && r.json.hours.total > 1, r.json.hours);
  check("chép chính tả 8/10 vào tuần này", r.json.weeks[11].dictation.correct === 8 && r.json.weeks[11].dictation.total === 10, r.json.weeks[11].dictation);
  check("thi thử có trong tiến độ", r.json.mocks.length >= 4);
  check("sổ lỗi: câu đã làm lại đúng / đã ẩn không còn", r.json.errors.total === 0, r.json.errors);
  // tạo một lỗi còn mở ở unit 2
  const u2 = await api("GET", `/api/english/units/${(await prisma.engUnit.findFirst({ where: { bookId, order: 2 } }))!.id}`, { as: a });
  await api("POST", `/api/english/exercises/${u2.json.exercises[0].id}/answer`, { as: a, body: { answer: "goed" } });
  r = await api("GET", "/api/english/progress", { as: a });
  check("sổ lỗi gom theo unit, kèm đáp án đúng", r.json.errors.total === 1 && /Unit 2/.test(r.json.errors.groups[0].label) && r.json.errors.groups[0].items[0].yourAnswer === "goed", r.json.errors);
  check("sổ lỗi của người khác trống", (await api("GET", "/api/english/progress", { as: b })).json.errors.total === 0);

  section("Hôm nay sau một ngày học");
  t = await api("GET", "/api/english/today", { as: a });
  check("chuỗi: hôm nay đã học, có phút học", t.json.streak.activeToday && t.json.minutesToday > 0, { streak: t.json.streak, m: t.json.minutesToday });
  check("lộ trình thấy band thi thử gần nhất", t.json.plan.lastMock.listening === 7 && t.json.plan.lastMock.reading === 6.5, t.json.plan.lastMock);
  check("unit kế tiếp gợi ý từ lớp học", t.json.nextUnit && t.json.nextUnit.bookTitle === "Essential Grammar in Use", t.json.nextUnit);
  check("đã xếp lớp", t.json.profile.placementDone === true);

  section("dọn dẹp + cron");
  check("cron VOA không có nguồn → 0 bài, không lỗi", (await api("GET", "/api/cron/english-voa")).json.added === 0);
  check("xoá bài thi thử", (await api("DELETE", `/api/english/mock/${mockId}`, { as: a })).status === 200 && !(await prisma.engMock.findUnique({ where: { id: mockId } })));
  check("người khác không xoá được sách", (await api("DELETE", `/api/english/books/${bookId}`, { as: b })).status === 404);
  check("xoá sách → xoá cả unit, trang, đoạn, bài tập", (await api("DELETE", `/api/english/books/${bookId}`, { as: a })).status === 200
    && (await prisma.engUnit.count({ where: { bookId } })) === 0 && (await prisma.engChunk.count({ where: { bookId } })) === 0 && (await prisma.engBookPage.count({ where: { bookId } })) === 0);
  check("xoá bài dán của mình", (await api("DELETE", `/api/english/texts/${textId}`, { as: a })).status === 200);

  await done();
}

main().catch(async e => { console.error(e); process.exit(1); });
