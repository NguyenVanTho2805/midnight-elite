// Vercel Cron: mỗi ngày lấy tối đa 6 bài mới từ các nguồn RSS của VOA Learning English (public domain).
// Nguồn đặt ở biến môi trường ENGLISH_VOA_FEEDS (danh sách URL RSS cách nhau bằng dấu phẩy; lấy ở learningenglish.voanews.com/rssfeeds).
// Authorization: Bearer CRON_SECRET (giống các cron khác).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchFeed, fetchArticle } from "@/lib/english/voa";
import { countWords } from "@/lib/english/text";
import { checkCronAuth } from "@/lib/cronAuth";
import { recordCronRun } from "@/lib/adminOpsServer";
import { featureOn } from "@/lib/features";

export const maxDuration = 60;
const MAX_NEW = 6;

export async function GET(req: NextRequest) {
  const cronAuth = checkCronAuth(process.env.CRON_SECRET, req.headers.get("authorization"));
  if (!cronAuth.ok) return NextResponse.json({ error: cronAuth.error }, { status: cronAuth.status });
  await recordCronRun("english-voa"); // QT-03: dấu "lần gọi gần nhất" cho trang Triển khai và hạn mức
  // DG (14/11/2026): Tiếng Anh tự học đang ẩn (cờ TIENG_ANH, mặc định) ⇒ không kéo bài mới. Cron trong vercel.json giữ nguyên; vẫn ghi dấu lần gọi để trang
  // Triển khai không báo "chạy chậm". Bật lại NEXT_PUBLIC_KIN_MO_TIENG_ANH=1 là chạy như cũ.
  if (!featureOn("TIENG_ANH")) return NextResponse.json({ skipped: "TIENG_ANH tắt" }, { headers: { "Cache-Control": "no-store" } });
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
