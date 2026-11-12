// LOI-04 — cron tóm tắt sáng "Nhắc học" của học sinh. Vercel Cron gọi GET mỗi ngày 00:05 UTC (07:05 giờ VN — sau remind-class 07:00, ngoài giờ yên lặng 22:00–07:00).
// Khoá Bearer CRON_SECRET (thiếu ⇒ 503, sai ⇒ 401). `?dryRun=1` (vẫn cần khoá): không ghi Notification, không ghi notifiedAt — chỉ trả danh sách sẽ báo.
// CHỈ thông báo trong ứng dụng (chuông). study_today / reminder_due ngoài PUSH_TYPES ⇒ notify() không đẩy ra điện thoại (đặc tả mục 7).
// Phản hồi chỉ có id + số đếm: không tên, không tiêu đề, không ghi chú, không tên lớp/bài.
import { NextRequest, NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/cronAuth";
import { recordCronRun } from "@/lib/adminOpsServer";
import { runMorningDigest, errName } from "@/lib/nhacHocServer";

export async function GET(req: NextRequest) {
  const cronAuth = checkCronAuth(process.env.CRON_SECRET, req.headers.get("authorization"));
  if (!cronAuth.ok) return NextResponse.json({ error: cronAuth.error }, { status: cronAuth.status });
  await recordCronRun("nhac-hoc-sang");
  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";
  try {
    return NextResponse.json(await runMorningDigest(new Date(), { dryRun }), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[cron/nhac-hoc-sang]", errName(e));
    return NextResponse.json({ error: "Không chạy được" }, { status: 500 });
  }
}
