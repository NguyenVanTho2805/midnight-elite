import { NextResponse } from "next/server";
import { loadSidebar } from "@/lib/communityServer";
import { getSession } from "@/lib/session";

// GET /api/community/sidebar — cột phải: gia sư nổi bật + câu hỏi chưa trả lời. Chỉ bài chung đã duyệt.
// 3A (04/11/2026): câu hỏi CŨ (bảng Question) chỉ có trong bản của người đã đăng nhập; khách không thấy (xem loadFeedPage).
//   - KHÁCH: nội dung giống nhau với mọi khách nên cache công khai 5 phút được.
//   - ĐÃ ĐĂNG NHẬP: bản có câu hỏi cũ, `private, no-store` — không bao giờ để bộ nhớ đệm dùng chung giữ bản này rồi phát cho khách. (Ngược lại — CDN phát bản của khách cho người đã đăng nhập —
//     chỉ làm họ thiếu vài câu hỏi cũ trong cột phải, không lộ gì.)
export async function GET() {
  const member = !!(await getSession());
  return NextResponse.json(await loadSidebar(member), { headers: { "Cache-Control": member ? "private, no-store" : "public, s-maxage=300" } });
}
