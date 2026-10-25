// Tiện ích phía máy chủ dùng chung cho các route /api/english/*.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, type SessionPayload } from "@/lib/session";
import { allListEntries, freqRank, listEntry, lemmatize } from "./lexicon";
import { enrichWords } from "./ai";
import { newCardRow } from "./srs";
import { vnDay } from "./day";

export function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Mọi tài khoản đã đăng nhập đều dùng được phần tự học (học sinh, gia sư, quản trị). Dữ liệu luôn theo userId của phiên. */
export async function requireUser(): Promise<SessionPayload | NextResponse> {
  const s = await getSession();
  if (!s) return bad("Vui lòng đăng nhập", 401);
  return s;
}
export const isResp = (v: unknown): v is NextResponse => v instanceof NextResponse;

let seeded = false;
/** Nạp NGSL + NAWL vào eng_words lần đầu dùng (idempotent, skipDuplicates). */
export async function ensureWordsSeeded(): Promise<void> {
  if (seeded) return;
  const n = await prisma.engWord.count({ where: { list: { in: ["ngsl", "sup", "nawl"] } } });
  const entries = allListEntries();
  if (n < entries.length) {
    for (let i = 0; i < entries.length; i += 1000) {
      await prisma.engWord.createMany({
        data: entries.slice(i, i + 1000).map(e => ({ lemma: e.lemma, list: e.list, listRank: e.listRank, freqRank: e.freqRank })),
        skipDuplicates: true,
      });
    }
  }
  seeded = true;
}

export async function getProfile(userId: string) {
  return prisma.engProfile.upsert({ where: { userId }, create: { userId }, update: {} });
}

/** Lemma người học đã biết hoặc đang học — nền để tính độ phủ bài đọc. */
export async function familiarLemmas(userId: string): Promise<Set<string>> {
  const rows = await prisma.engUserWord.findMany({
    where: { userId, status: { in: ["known", "learning"] } },
    select: { word: { select: { lemma: true } } },
  });
  return new Set(rows.map(r => r.word.lemma));
}

export async function logStudy(userId: string, module: string, d: { items?: number; correct?: number; total?: number; seconds?: number }) {
  const day = vnDay();
  const inc = { items: d.items ?? 0, correct: d.correct ?? 0, total: d.total ?? 0, seconds: Math.min(d.seconds ?? 0, 3 * 3600) };
  await prisma.engStudyLog.upsert({
    where: { userId_day_module: { userId, day, module } },
    create: { userId, day, module, ...inc },
    update: { items: { increment: inc.items }, correct: { increment: inc.correct }, total: { increment: inc.total }, seconds: { increment: inc.seconds } },
  });
}

/** Bổ sung nghĩa tiếng Việt / ví dụ cho các từ còn thiếu (gọi AI theo lô 20 từ). Lỗi AI không chặn việc học: thẻ vẫn tạo, nghĩa bổ sung sau. */
export async function enrichMissing(wordIds: string[]): Promise<void> {
  if (!wordIds.length) return;
  const words = await prisma.engWord.findMany({ where: { id: { in: wordIds }, meaningVi: null }, select: { id: true, lemma: true } });
  for (let i = 0; i < words.length; i += 20) {
    const batch = words.slice(i, i + 20);
    try {
      const info = await enrichWords(batch.map(w => w.lemma));
      const byLemma = new Map(info.map(x => [x.lemma, x]));
      await Promise.all(batch.map(w => {
        const x = byLemma.get(w.lemma);
        if (!x) return null;
        return prisma.engWord.update({ where: { id: w.id }, data: { pos: x.pos?.slice(0, 20) || null, meaningVi: x.meaningVi?.slice(0, 200) || null, definitionEn: x.definitionEn?.slice(0, 300) || null, example: x.example?.slice(0, 300) || null } });
      }));
    } catch (e) {
      console.error("[english.enrichMissing]", e);
    }
  }
}

/** Thẻ cho một từ. Từ mới bắt đầu bằng thẻ nhận diện; thẻ nhớ chủ động mở khi thẻ nhận diện "tốt nghiệp" (xem /api/english/review). */
export function wordCardKey(wordId: string, cardType: string) { return `w:${wordId}:${cardType}`; }

export async function ensureWordCard(userId: string, wordId: string, cardType: "recognize" | "recall" | "listen" | "cloze", due?: Date) {
  const key = wordCardKey(wordId, cardType);
  const base = newCardRow(due ?? new Date());
  await prisma.engCard.upsert({
    where: { userId_key: { userId, key } },
    create: { userId, key, kind: "word", cardType, wordId, ...base },
    update: {},
  });
}

/** Thêm (hoặc cập nhật) một từ vào sổ từ của người học. Trả về id từ. */
export async function addUserWord(userId: string, rawWord: string, opts: { source: string; status?: "known" | "learning"; context?: string | null; contextVi?: string | null; textId?: string | null }) {
  const lemma = lemmatize(rawWord.trim().toLowerCase()).slice(0, 60);
  if (!/^[a-z][a-z'-]*$/.test(lemma)) throw new Error("Từ không hợp lệ");
  const entry = listEntry(lemma);
  const word = await prisma.engWord.upsert({
    where: { lemma },
    create: { lemma, list: entry?.list ?? "own", listRank: entry?.listRank ?? null, freqRank: entry?.freqRank ?? freqRank(lemma) ?? null },
    update: {},
  });
  const status = opts.status ?? "learning";
  await prisma.engUserWord.upsert({
    where: { userId_wordId: { userId, wordId: word.id } },
    create: { userId, wordId: word.id, status, source: opts.source, context: opts.context ?? null, contextVi: opts.contextVi ?? null, textId: opts.textId ?? null },
    update: {
      // bắt lại một từ đã "biết" trong bài đọc = thật ra chưa chắc → chuyển về đang học
      ...(status === "learning" ? { status: "learning" } : {}),
      ...(opts.context ? { context: opts.context, contextVi: opts.contextVi ?? null, textId: opts.textId ?? null } : {}),
    },
  });
  if (status === "learning") await ensureWordCard(userId, word.id, "recognize");
  return word;
}
