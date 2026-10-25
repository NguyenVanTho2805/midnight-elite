// KiN Pro — cron nhắc gia hạn T-7 / T-3 / T-0 (xem src/lib/proRenewal.ts). Vercel Cron gọi GET mỗi ngày 00:30 UTC (07:30 giờ VN), khoá Bearer CRON_SECRET.
// Production thiếu CRON_SECRET thì ĐÓNG (503), giống các cron khác. Phản hồi chỉ có số đếm, không tên người, không số tiền.
import { NextRequest, NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/cronAuth";
import { recordCronRun } from "@/lib/adminOpsServer";
import { runProRenewalReminders } from "@/lib/proRenewalServer";

export async function GET(req: NextRequest) {
  const cronAuth = checkCronAuth(process.env.CRON_SECRET, req.headers.get("authorization"));
  if (!cronAuth.ok) return NextResponse.json({ error: cronAuth.error }, { status: cronAuth.status });
  await recordCronRun("pro-renewal-reminders");
  try {
    return NextResponse.json(await runProRenewalReminders(), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[cron/pro-renewal-reminders]", e);
    return NextResponse.json({ error: "Không chạy được" }, { status: 500 });
  }
}
