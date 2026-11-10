// BU-HS-NOP-TEP — cron dọn tệp nộp bài hết hạn 60 ngày. Chạy MỖI NGÀY 18:30 UTC (01:30 giờ VN) theo vercel.json.
// Xác thực như các cron khác (Bearer CRON_SECRET; thiếu khoá → 503, sai → 401): cron hỏng ồn ào hơn là mở cửa.
// MẶC ĐỊNH CHẠY KHÔ (đếm + liệt kê fileId, không chạm kho, không ghi DB ngoài recordCronRun). CHỈ xoá thật khi có `?xoa=1`.
// Phạm vi xoá, thứ tự xoá an toàn và giới hạn mỗi lần: xem src/lib/nopTepExpiryServer.ts. Phản hồi + log chỉ có số đếm và fileId (không tên tệp, không id học sinh).
import { NextRequest, NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/cronAuth";
import { recordCronRun } from "@/lib/adminOpsServer";
import { runNopTepExpiry } from "@/lib/nopTepExpiryServer";
import { logAction } from "@/lib/auditLog";

export async function GET(req: NextRequest) {
  const cronAuth = checkCronAuth(process.env.CRON_SECRET, req.headers.get("authorization"));
  if (!cronAuth.ok) return NextResponse.json({ error: cronAuth.error }, { status: cronAuth.status });
  await recordCronRun("het-han-tep-nop-bai");
  const dryRun = new URL(req.url).searchParams.get("xoa") !== "1";
  try {
    const result = await runNopTepExpiry({ now: new Date(), dryRun });
    // Nhật ký kiểm toán MỖI lượt chạy (cả chạy khô): chỉ số đếm + fileId, KHÔNG tên tệp, KHÔNG id học sinh. actorId null = hệ thống.
    await logAction(null, dryRun ? "submission_file.expire_dry_run" : "submission_file.expire_run", "SubmissionFile", "cron", JSON.parse(JSON.stringify(result)));
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[cron/het-han-tep-nop-bai]", (e as Error)?.name);
    return NextResponse.json({ error: "Không chạy được" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
