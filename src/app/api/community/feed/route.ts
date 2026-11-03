import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { decodeCursor } from "@/lib/communityFeed";
import { communityError, loadFeedPage, NO_STORE, parseLimit, parseTab } from "@/lib/communityServer";

// GET /api/community/feed — bảng tin hợp nhất (bài + câu hỏi mới + câu hỏi cũ), phân trang bằng con trỏ mờ. Khách xem được bài chung.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const tab = parseTab(sp.get("tab"));
  if (!tab) return communityError(400, "tab_invalid", "Chủ đề không hợp lệ");
  const limit = parseLimit(sp.get("limit"));
  if (limit === null) return communityError(400, "limit_invalid", "Số bài mỗi trang phải từ 1 đến 50");
  const rawCursor = sp.get("cursor");
  const cursor = rawCursor ? decodeCursor(rawCursor) : null;
  if (rawCursor && !cursor) return communityError(400, "cursor_invalid", "Con trỏ không hợp lệ");
  const scope = sp.get("scope") || "all";

  const session = await getSession();
  const page = await loadFeedPage({ session, tab, scope, cursor, limit });
  if ("forbidden" in page) return communityError(403, "not_member", "Bạn không còn là thành viên của lớp này");
  return NextResponse.json(page, { headers: NO_STORE });
}
