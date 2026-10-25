// Vercel Cron: mỗi ngày lấy tối đa 6 bài mới từ các nguồn RSS của VOA Learning English (public domain).
// Nguồn đặt ở biến môi trường ENGLISH_VOA_FEEDS (danh sách URL RSS cách nhau bằng dấu phẩy; lấy ở learningenglish.voanews.com/rssfeeds).
// Authorization: Bearer CRON_SECRET (giống các cron khác).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchFeed, fetchArticle } from "@/lib/english/voa";
import { countWords } from "@/lib/english/text";
import { checkCronAuth } from "@/lib/cronAuth";

export const maxDuration = 60;
const MAX_NEW = 6;

export async function GET(req: NextRequest) {
  const cronAuth = checkCronAuth(process.env.CRON_SECRET, req.headers.get("authorization"));
  if (!cronAuth.ok) return NextResponse.json({ error: cronAuth.error }, { status: cronAuth.status });
  const feeds = (process.env.ENGLISH_VOA_FEEDS ?? "").split(",").map(s => s.trim()).filter(Boolean);
  if (!feeds.length) return NextResponse.json({ added: 0, message: "Chưa cấu hình ENGLISH_VOA_FEEDS" });

  let added = 0;
  const errors: string[] = [];
  for (const feed of feeds) {
    if (added >= MAX_NEW) break;
    let items;
    try { items = await fetchFeed(feed); } catch (e) { errors.push(`${feed}: ${e instanceof Error ? e.message : "lỗi"}`); continue; }
    for (const it of items) {
      if (added >= MAX_NEW) break;
      if (await prisma.engText.findFirst({ where: { source: "voa", sourceUrl: it.link }, select: { id: true } })) continue;
      try {
        const a = await fetchArticle(it.link);
        const wc = countWords(a.body);
        if (wc < 120) continue;
        await prisma.engText.create({
          data: { ownerId: null, source: "voa", sourceUrl: it.link, title: (a.title || it.title).slice(0, 200), body: a.body, audioUrl: a.audioUrl, wordCount: wc, license: "public-domain", publishedAt: it.pubDate ? new Date(it.pubDate) : null },
        });
        added++;
      } catch (e) { errors.push(`${it.link}: ${e instanceof Error ? e.message : "lỗi"}`); }
    }
  }
  return NextResponse.json({ added, errors: errors.slice(0, 10) });
}
