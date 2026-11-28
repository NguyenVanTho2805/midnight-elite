// KiN lớp — hạn lưu nhật ký của Lớp ôn (src/lib/lop/server/nhat-ky.ts donNhatKy). MỖI NGÀY 18:40 UTC (01:40 giờ VN) theo vercel.json.
// Xác thực như các cron khác (Bearer CRON_SECRET). Cờ LOP_ON tắt ⇒ không đụng CSDL. Phản hồi chỉ có SỐ ĐẾM.
import { NextRequest, NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/cronAuth";
import { recordCronRun } from "@/lib/adminOpsServer";
import { LOP_ON } from "@/lib/features";
import { donNhatKy } from "@/lib/lop/server/nhat-ky";

export async function GET(req: NextRequest) {
  const cronAuth = checkCronAuth(process.env.CRON_SECRET, req.headers.get("authorization"));
  if (!cronAuth.ok) return NextResponse.json({ error: cronAuth.error }, { status: cronAuth.status });
  await recordCronRun("lop-don-nhat-ky"); // ghi mốc cả khi cờ tắt: trang Triển khai không báo "chậm so với lịch"
  if (!LOP_ON) return NextResponse.json({ bo_qua: "LOP_ON tắt" }, { headers: { "Cache-Control": "no-store" } });
  try {
    return NextResponse.json(await donNhatKy(), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[cron/lop-don-nhat-ky]", (e as Error)?.name);
    return NextResponse.json({ error: "Không chạy được" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
