// FE-099 — điểm chuẩn công khai: chỉ dòng đã xuất bản, mỗi dòng kèm nguồn. Không cần đăng nhập.
import { NextResponse } from "next/server";
import { loadPublicScores } from "@/lib/admissionScoreServer";

export const dynamic = "force-dynamic";

export async function GET() {
  const { rows, source } = await loadPublicScores();
  return NextResponse.json({ rows, source }, { headers: { "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300" } });
}
