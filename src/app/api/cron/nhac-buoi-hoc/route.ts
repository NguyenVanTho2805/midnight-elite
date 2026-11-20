// DG-HOC-ONLINE (14/11/2026) — email nhắc học sinh TRƯỚC giờ học (gia sư chọn ở lớp → Cài đặt → Học online: 15 phút / 1 giờ / 1 ngày).
// KHÔNG có trong vercel.json: gói Vercel thường chỉ cho cron hằng ngày. cron-job.org gọi mỗi 15 phút — hướng dẫn: docs/kin/van-hanh/cron-nhac-buoi-hoc.md.
// Khoá: header `Authorization: Bearer <CRON_SECRET>` (thiếu biến ⇒ 503, sai ⇒ 401) — checkCronAuth như mọi cron khác. GET và POST như nhau
// (cron-job.org mặc định GET). `?dryRun=1` (vẫn cần khoá): không ghi ClassLessonReminderLog, không gửi thư — chỉ đếm sẽ gửi bao nhiêu.
// Phản hồi chỉ có mã lớp, khoá buổi và số đếm: không tên, không email, không số tiền.
import { NextRequest, NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/cronAuth";
import { recordCronRun } from "@/lib/adminOpsServer";
import { runLessonReminders } from "@/lib/lessonReminderServer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(req: NextRequest) {
  const cronAuth = checkCronAuth(process.env.CRON_SECRET, req.headers.get("authorization"));
  if (!cronAuth.ok) return NextResponse.json({ error: cronAuth.error }, { status: cronAuth.status });
  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";
  if (!dryRun) await recordCronRun("nhac-buoi-hoc"); // Triển khai → "lần gọi gần nhất" (chạy khô không tính là đã chạy thật)
  try {
    return NextResponse.json(await runLessonReminders(new Date(), { dryRun }), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[cron/nhac-buoi-hoc]", e instanceof Error ? e.name : "lỗi");
    return NextResponse.json({ error: "Không chạy được" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
