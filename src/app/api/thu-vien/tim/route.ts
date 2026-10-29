// GET /api/thu-vien/tim?q=… — tìm trong KHO CÔNG KHAI (NC2-046): tài liệu của bài miễn phí + video YouTube do quản trị chọn. Khách gọi được.
// Chỉ trả thứ đã công khai sẵn (xem src/lib/libraryKho.ts). Tài liệu riêng của lớp KHÔNG ở đây: học sinh trong lớp tìm trong dữ liệu đã tải theo phiên của chính mình.
import { NextResponse } from "next/server";
import { limitOrBlock, getClientIp } from "@/lib/rate-limit";
import { QUERY_MAX, queryTokens } from "@/lib/librarySearch";
import { searchKho } from "@/lib/libraryKho";
import { loadPublicDocs, loadPublishedVideos } from "@/lib/libraryKhoServer";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const blocked = limitOrBlock(getClientIp(req), "thu-vien-tim", 30, 60_000);
  if (blocked) return blocked;

  const q = new URL(req.url).searchParams.get("q") ?? "";
  if (q.length > QUERY_MAX) return NextResponse.json({ error: `Từ khoá tối đa ${QUERY_MAX} ký tự` }, { status: 400 });
  if (queryTokens(q).length === 0) return NextResponse.json({ error: "Gõ ít nhất 2 ký tự" }, { status: 400 });

  try {
    const [docs, videos] = await Promise.all([loadPublicDocs(), loadPublishedVideos()]);
    return NextResponse.json(searchKho(docs, videos, q), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[thu-vien/tim]", e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}
