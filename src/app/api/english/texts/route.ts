// GET  /api/english/texts — bài đọc/nghe tôi xem được (VOA công khai + bài của tôi), kèm độ phủ từ vựng CỦA TÔI.
// POST /api/english/texts — { title, body } (dán bài, chỉ tôi thấy) hoặc { url } (link bài VOA Learning English).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResp, bad, familiarLemmas } from "@/lib/english/server";
import { tokenize, coverage, coverageLevel, countWords } from "@/lib/english/text";
import { lemmatize } from "@/lib/english/lexicon";
import { fetchArticle, isVoaUrl } from "@/lib/english/voa";

export const maxDuration = 30;

export async function GET() {
  const s = await requireUser();
  if (isResp(s)) return s;
  const texts = await prisma.engText.findMany({
    where: { OR: [{ ownerId: null }, { ownerId: s.userId }], source: { not: "book" } },
    orderBy: { createdAt: "desc" }, take: 60,
    select: { id: true, title: true, body: true, wordCount: true, source: true, ownerId: true, audioUrl: true, topic: true, createdAt: true, publishedAt: true },
  });
  const familiar = await familiarLemmas(s.userId);
  return NextResponse.json({
    items: texts.map(t => {
      const c = coverage(tokenize(t.body, lemmatize), familiar);
      return {
        id: t.id, title: t.title, wordCount: t.wordCount, source: t.source, mine: t.ownerId === s.userId, hasAudio: !!t.audioUrl,
        topic: t.topic, date: t.publishedAt ?? t.createdAt, coverage: Math.round(c.ratio * 1000) / 10, level: coverageLevel(c.ratio), newWords: c.unknown.length,
      };
    }),
  });
}

export async function POST(req: NextRequest) {
  const s = await requireUser();
  if (isResp(s)) return s;
  const b = await req.json().catch(() => null) as { title?: string; body?: string; url?: string } | null;
  if (!b) return bad("Dữ liệu không hợp lệ");

  if (b.url) {
    const url = b.url.trim();
    if (!isVoaUrl(url)) return bad("Hiện chỉ nhận link bài của VOA Learning English (nội dung public domain). Bài từ nguồn khác: dán chữ vào ô bên dưới.");
    const existing = await prisma.engText.findFirst({ where: { source: "voa", sourceUrl: url }, select: { id: true } });
    if (existing) return NextResponse.json({ id: existing.id, existed: true });
    try {
      const a = await fetchArticle(url);
      if (countWords(a.body) < 60) return bad("Không đọc được nội dung bài này. Hãy dán chữ của bài vào ô bên dưới.");
      const t = await prisma.engText.create({ data: { ownerId: null, source: "voa", sourceUrl: url, title: a.title.slice(0, 200) || "Bài VOA", body: a.body, audioUrl: a.audioUrl, wordCount: countWords(a.body), license: "public-domain" } });
      return NextResponse.json({ id: t.id });
    } catch (e) {
      console.error("[english.texts.url]", e);
      return bad("Không tải được bài từ VOA lúc này. Dán chữ của bài vào ô bên dưới cũng được.");
    }
  }

  const title = (b.title ?? "").trim().slice(0, 200);
  const body = (b.body ?? "").replace(/\r/g, "").trim();
  if (!title) return bad("Đặt tên cho bài");
  const wc = countWords(body);
  if (wc < 30) return bad("Bài quá ngắn (cần ít nhất 30 từ)");
  if (body.length > 40000) return bad("Bài quá dài (tối đa khoảng 6.000 từ)");
  const t = await prisma.engText.create({ data: { ownerId: s.userId, source: "paste", title, body, wordCount: wc, license: "private" } });
  return NextResponse.json({ id: t.id });
}
