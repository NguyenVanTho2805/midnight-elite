import { NextResponse } from "next/server";
import { loadSidebar } from "@/lib/communityServer";

// GET /api/community/sidebar — cột phải: gia sư nổi bật + câu hỏi chưa trả lời. Chỉ bài chung đã duyệt, không có dữ liệu theo người dùng
// (không đọc phiên) nên cache công khai 5 phút được.
export async function GET() {
  return NextResponse.json(await loadSidebar(), { headers: { "Cache-Control": "public, s-maxage=300" } });
}
