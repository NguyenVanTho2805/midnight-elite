import { NextRequest, NextResponse } from "next/server";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import { decodeCursor } from "@/lib/communityFeed";
import { communityError, loadBookmarksPage, NO_STORE, parseLimit } from "@/lib/communityServer";

// GET /api/community/bookmarks — "Đã lưu". Chỉ bài còn công khai và lớp mà người gọi còn là thành viên.
export async function GET(req: NextRequest) {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;
  const sp = req.nextUrl.searchParams;
  const limit = parseLimit(sp.get("limit"));
  if (limit === null) return communityError(400, "limit_invalid", "Số bài mỗi trang phải từ 1 đến 50");
  const rawCursor = sp.get("cursor");
  const cursor = rawCursor ? decodeCursor(rawCursor) : null;
  if (rawCursor && !cursor) return communityError(400, "cursor_invalid", "Con trỏ không hợp lệ");
  return NextResponse.json(await loadBookmarksPage(auth, cursor, limit), { headers: NO_STORE });
}
