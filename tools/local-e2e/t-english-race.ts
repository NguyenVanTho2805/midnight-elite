// Tiếng Anh tự học: nhiều yêu cầu CÙNG LÚC của một người học không được gây 500 (01/11/2026).
//
// Lỗi cũ: `prisma.<model>.upsert` KHÔNG phải lúc nào cũng là INSERT … ON CONFLICT nguyên tử — nó tìm trước rồi mới chèn. Hai yêu cầu cùng thấy "chưa có" rồi cùng chèn thì bên
// thua nhận P2002 (UniqueConstraintViolation) → 500. Trang Tiếng Anh gọi API ngay khi mở (StrictMode ở dev gọi hai lần; người dùng bấm hai lần, mở hai tab cũng vậy), nên đây không
// chỉ là chuyện của test: ui-english đỏ chập chờn "không có lỗi console … 500" đúng vì vậy (log dev: P2002 ở ensureWordCard, src/lib/english/server.ts).
//
// Bài này bắn N yêu cầu song song vào từng đường ghi với người dùng MỚI TINH ở mỗi vòng (cửa sổ tranh chấp rộng nhất), rồi kiểm: (1) không yêu cầu nào lỗi; (2) dữ liệu cuối cùng
// đúng — mỗi bản ghi duy nhất đúng một, và các bộ đếm TĂNG DẦN (attempts, items) đủ N: yêu cầu thua đua phải chạy lại thành "cập nhật", không được nuốt mất lượt ghi.
// Quy tắc đã kiểm bằng log SQL Postgres: `upsert` có `update: {}` RỖNG chạy SELECT rồi INSERT (đua được); có `update` nội dung (increment…) thì Prisma chạy INSERT … ON CONFLICT nguyên tử
// (không đua). Nên chỉ upsert `update` rỗng được bọc retryOnUnique; các ca logStudy / làm bài / thẻ "làm lại" ở đây là CA BẢO VỆ cho tính nguyên tử đó (đếm đủ N lượt, không 500).
// Ca phá cố ý: với src/ bản cũ các ca "không yêu cầu nào lỗi" đỏ; bẻ riêng từng chốt (hồ sơ, thẻ, từ, sổ từ, bộ nhớ đệm tra từ) đều làm đúng ca tương ứng đỏ.
import { prisma } from "@/lib/prisma";
import { api, check, done, mkUser, section, wipe } from "./h";
import { allListEntries } from "@/lib/english/lexicon";
import { vnDay } from "@/lib/english/day";
import { addUserWord, ensureWordCard, getProfile, logStudy } from "@/lib/english/server";

const N = Number(process.env.RACE_N) || 8; // RACE_N=25 để ép mạnh hơn
const ROUNDS = 3;
const burst = <T,>(n: number, f: (i: number) => Promise<T>) => Promise.all(Array.from({ length: n }, (_, i) => f(i)));
const statuses = (rs: { status: number }[]) => rs.map(r => r.status);
const allOk = (rs: { status: number }[]) => rs.every(r => r.status === 200);

(async () => {
  await wipe();
  // Máy chủ nạp kho từ một lần mỗi tiến trình (cờ trong bộ nhớ); wipe() đã xoá bảng nên nạp lại ở đây (như t-english).
  const entries = allListEntries();
  for (let i = 0; i < entries.length; i += 1000) {
    await prisma.engWord.createMany({ data: entries.slice(i, i + 1000).map(e => ({ lemma: e.lemma, list: e.list, listRank: e.listRank, freqRank: e.freqRank })), skipDuplicates: true });
  }

  section(`GET song song × ${N}, người học mới tinh, ${ROUNDS} vòng: ôn tập / tiến độ / hôm nay / hồ sơ`);
  for (const path of ["/api/english/review", "/api/english/progress", "/api/english/today", "/api/english/profile"]) {
    const bad: number[][] = []; let profiles = 0, usersWithProfile = 0;
    for (let r = 0; r < ROUNDS; r++) {
      const u = await mkUser({ name: `Học ${r}` });
      const rs = await burst(N, () => api("GET", path, { as: u }));
      if (!allOk(rs)) bad.push(statuses(rs));
      const p = await prisma.engProfile.count({ where: { userId: u.id } });
      profiles += p; usersWithProfile += p === 1 ? 1 : 0;
    }
    check(`${path}: ${N} yêu cầu song song × ${ROUNDS} vòng — không yêu cầu nào lỗi`, bad.length === 0, bad);
    check(`${path}: mỗi người học đúng MỘT hồ sơ`, usersWithProfile === ROUNDS && profiles === ROUNDS, { usersWithProfile, profiles });
  }

  section("Ôn tập: thẻ mở cho từ mới không trùng, đủ số từ");
  {
    const u = await mkUser({ name: "Ôn tập" });
    const rs = await burst(N, () => api("GET", "/api/english/review", { as: u }));
    check("không yêu cầu nào lỗi", allOk(rs), statuses(rs));
    const words = await prisma.engUserWord.count({ where: { userId: u.id, source: "list" } });
    const cards = await prisma.engCard.count({ where: { userId: u.id, cardType: "recognize" } });
    check("có từ mới được mở", words > 0, words);
    check("mỗi từ mới có đúng MỘT thẻ nhận diện (số thẻ = số từ)", cards === words, { words, cards });
  }

  section(`Hàm thư viện gọi THẲNG song song × ${N} (cả ${N} cùng chạm bản ghi chưa có: cửa sổ tranh chấp rộng nhất — đường HTTP lệch pha nên không phủ được logStudy)`);
  {
    const u = await mkUser({ name: "Hàm thẳng" });
    const word = await prisma.engWord.findFirstOrThrow({ select: { id: true } });
    const safe = async (f: () => Promise<unknown>) => { try { await f(); return null; } catch (e) { return String((e as Error).message).slice(0, 80); } };
    const prof = (await burst(N, () => safe(() => getProfile(u.id)))).filter(Boolean);
    check("getProfile: không lần gọi nào ném lỗi; đúng MỘT hồ sơ", prof.length === 0 && (await prisma.engProfile.count({ where: { userId: u.id } })) === 1, prof);
    const card = (await burst(N, () => safe(() => ensureWordCard(u.id, word.id, "recognize")))).filter(Boolean);
    check("ensureWordCard: không lần gọi nào ném lỗi; đúng MỘT thẻ", card.length === 0 && (await prisma.engCard.count({ where: { userId: u.id } })) === 1, card);
    const log = (await burst(N, () => safe(() => logStudy(u.id, "nghe", { items: 1, correct: 1, total: 2, seconds: 3 })))).filter(Boolean);
    const row = await prisma.engStudyLog.findMany({ where: { userId: u.id, module: "nghe", day: vnDay() } });
    check(`logStudy: không lần gọi nào ném lỗi; MỘT dòng, đếm ĐỦ ${N} lượt (items, correct, total, seconds)`,
      log.length === 0 && row.length === 1 && row[0].items === N && row[0].correct === N && row[0].total === 2 * N && row[0].seconds === 3 * N, { log, row });
    // "Đã biết" + không ngữ cảnh → `update` của upsert sổ từ RỖNG (khác "đang học": update có status) → đây mới là ca đua ở eng_user_words
    // Tạo sẵn từ trong kho: nếu không, bước tạo eng_words làm N lần gọi lệch pha và không còn cùng lúc chạm eng_user_words.
    await prisma.engWord.create({ data: { lemma: "numbat", list: "own" } });
    const known = (await burst(N, () => safe(() => addUserWord(u.id, "numbat", { source: "reader", status: "known" })))).filter(Boolean);
    const nb = await prisma.engWord.findUnique({ where: { lemma: "numbat" } });
    check("addUserWord 'đã biết' (update rỗng): không lần gọi nào ném lỗi; MỘT dòng sổ từ", known.length === 0 && !!nb && (await prisma.engUserWord.count({ where: { userId: u.id, wordId: nb.id } })) === 1, known);
    const uw = (await burst(N, () => safe(() => addUserWord(u.id, "wombat", { source: "reader" })))).filter(Boolean);
    const w = await prisma.engWord.findUnique({ where: { lemma: "wombat" } });
    check("addUserWord: không lần gọi nào ném lỗi; đúng MỘT từ trong kho, MỘT dòng sổ từ, MỘT thẻ",
      uw.length === 0 && !!w && (await prisma.engUserWord.count({ where: { userId: u.id, wordId: w.id } })) === 1 && (await prisma.engCard.count({ where: { userId: u.id, wordId: w.id } })) === 1, uw);
  }

  section(`POST /api/english/words song song × ${N} cùng một từ (từ ngoài kho → đua cả ở eng_words, sổ từ, thẻ, nhật ký học)`);
  {
    const u = await mkUser({ name: "Thêm từ" });
    const rs = await burst(N, () => api("POST", "/api/english/words", { as: u, body: { word: "quokka", status: "learning" } }));
    check("không yêu cầu nào lỗi", allOk(rs), rs.map(r => [r.status, (r.json?.error ?? "").slice(0, 60)]));
    check("đúng MỘT từ 'quokka' trong kho", (await prisma.engWord.count({ where: { lemma: "quokka" } })) === 1);
    check("đúng MỘT dòng trong sổ từ của người học", (await prisma.engUserWord.count({ where: { userId: u.id } })) === 1);
    check("đúng MỘT thẻ nhận diện", (await prisma.engCard.count({ where: { userId: u.id } })) === 1);
    const log = await prisma.engStudyLog.findMany({ where: { userId: u.id, module: "doc", day: vnDay() } });
    check(`nhật ký học: một dòng và đếm ĐỦ ${N} lượt (yêu cầu thua đua chạy lại thành cập nhật, không mất lượt)`, log.length === 1 && log[0].items === N, log);
  }

  section(`POST làm bài song song × ${N} (sai đáp án → thẻ làm lại, tiến độ unit, nhật ký)`);
  {
    const u = await mkUser({ name: "Làm bài" });
    const book = await prisma.engBook.create({ data: { ownerId: u.id, title: "Sách thử", kind: "grammar", fileName: "thu.pdf" } });
    const unit = await prisma.engUnit.create({ data: { bookId: book.id, ownerId: u.id, order: 1, title: "Unit 1", pageStart: 1, pageEnd: 2 } });
    const ex = await prisma.engExercise.create({ data: { ownerId: u.id, unitId: unit.id, type: "gap", prompt: "She ___ to school.", answers: ["goes"], origin: "book" } });
    const rs = await burst(N, () => api("POST", `/api/english/exercises/${ex.id}/answer`, { as: u, body: { answer: "wrong", seconds: 5 } }));
    check("không yêu cầu nào lỗi", allOk(rs), statuses(rs));
    check("đúng MỘT thẻ 'làm lại' cho câu sai", (await prisma.engCard.count({ where: { userId: u.id, key: `x:${ex.id}` } })) === 1);
    const prog = await prisma.engUnitProgress.findMany({ where: { userId: u.id, unitId: unit.id } });
    check(`tiến độ unit: một dòng và attempts = ${N} (không mất lượt)`, prog.length === 1 && prog[0].attempts === N, prog);
    check(`đã ghi đủ ${N} lượt làm`, (await prisma.engAttempt.count({ where: { userId: u.id, exerciseId: ex.id } })) === N);
    const log = await prisma.engStudyLog.findMany({ where: { userId: u.id, module: "lop-hoc", day: vnDay() } });
    check(`nhật ký học: một dòng, items = ${N}`, log.length === 1 && log[0].items === N, log);
  }

  section(`POST tra từ song song × ${N} cùng một câu (bộ nhớ đệm tra từ)`);
  {
    const u = await mkUser({ name: "Tra từ" });
    const rs = await burst(N, () => api("POST", "/api/english/lookup", { as: u, body: { word: "quokka", sentence: `The quokka smiled at me ${Date.now()}.` } }));
    check("không yêu cầu nào lỗi (200; cả bản đã có sẵn trong bộ nhớ đệm)", rs.every(r => r.status === 200), rs.map(r => [r.status, r.json?.aiError ? "aiError" : ""]));
    check("không có yêu cầu nào báo aiError (bản cũ: upsert thua đua rơi vào catch)", rs.every(r => !r.json?.aiError), rs.map(r => r.json?.aiError));
  }

  await done();
})().catch(e => { console.error(e); process.exit(1); });
