// KiN Pro — cron nhắc gia hạn T-7 / T-3 / T-0 (xem src/lib/proRenewal.ts). Vercel Cron gọi GET mỗi ngày 00:30 UTC (07:30 giờ VN), khoá Bearer CRON_SECRET.
// Production thiếu CRON_SECRET thì ĐÓNG (503), giống các cron khác. Phản hồi chỉ có số đếm, không tên người, không số tiền.
import { NextRequest, NextResponse } from "next/server";
import { cronSecretMissingIsFatal } from "@/lib/adminOps";
import { recordCronRun } from "@/lib/adminOpsServer";
import { runProRenewalReminders } from "@/lib/proRenewalServer";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    if (req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 401 });
  } else if (cronSecretMissingIsFatal()) {
    return NextResponse.json({ error: "Chưa cấu hình CRON_SECRET" }, { status: 503 });
  }
  await recordCronRun("pro-renewal-reminders");
  try {
    return NextResponse.json(await runProRenewalReminders(), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[cron/pro-renewal-reminders]", e);
    return NextResponse.json({ error: "Không chạy được" }, { status: 500 });
  }
}
