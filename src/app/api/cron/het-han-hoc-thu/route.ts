// SCL đợt 5 (D7) — cron lật ghi danh HỌC THỬ đã quá hạn (chưa được xác nhận chính thức) từ active → trial_expired. MỖI NGÀY 17:10 UTC (00:10 giờ VN) theo vercel.json.
// Xác thực như các cron khác (Bearer CRON_SECRET; thiếu khoá → 503, sai → 401). Phản hồi + nhật ký chỉ có SỐ ĐẾM (không id học sinh, không tên).
// Ngoài cron, vỏ học sinh cũng lật riêng em đó khi em mở (src/app/(student)/layout.tsx), và isEnrollmentActive đã chặn ngay cả khi chưa lật.
import { NextRequest, NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/cronAuth";
import { recordCronRun } from "@/lib/adminOpsServer";
import { expireTrials } from "@/lib/trialServer";
import { logAction } from "@/lib/auditLog";

export async function GET(req: NextRequest) {
  const cronAuth = checkCronAuth(process.env.CRON_SECRET, req.headers.get("authorization"));
  if (!cronAuth.ok) return NextResponse.json({ error: cronAuth.error }, { status: cronAuth.status });
  await recordCronRun("het-han-hoc-thu");
  try {
    const rows = await expireTrials();
    await logAction(null, "enrollment.trial_expire_run", "Enrollment", "cron", { expired: rows.length });
    return NextResponse.json({ expired: rows.length }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[cron/het-han-hoc-thu]", (e as Error)?.name);
    return NextResponse.json({ error: "Không chạy được" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
