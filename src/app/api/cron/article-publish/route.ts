// BU-08 / ADM-002 — cron báo bài hẹn giờ đã lên. Chạy MỖI NGÀY 00:15 UTC (07:15 giờ VN) theo vercel.json — cron hằng ngày là quy ước của kho/gói Hobby; bài vẫn hiện đúng giờ, chỉ thông báo chậm tối đa một ngày.
// Xác thực như các cron khác (Bearer CRON_SECRET; thiếu khoá → 503). Phản hồi chỉ có số đếm, không tiêu đề, không tên người.
import { NextRequest, NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/cronAuth";
import { recordCronRun } from "@/lib/adminOpsServer";
import { runArticlePublishNotices } from "@/lib/articleScheduleServer";

export async function GET(req: NextRequest) {
  const cronAuth = checkCronAuth(process.env.CRON_SECRET, req.headers.get("authorization"));
  if (!cronAuth.ok) return NextResponse.json({ error: cronAuth.error }, { status: cronAuth.status });
  await recordCronRun("article-publish");
  try {
    return NextResponse.json(await runArticlePublishNotices(new Date()), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[cron/article-publish]", e);
    return NextResponse.json({ error: "Không chạy được" }, { status: 500 });
  }
}
