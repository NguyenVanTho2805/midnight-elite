import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { decodeCursor } from "@/lib/communityFeed";
import { communityError, loadProfile, NO_STORE, parseLimit } from "@/lib/communityServer";

// GET /api/community/profiles/[id] — hồ sơ công khai. Chỉ gia sư đã xác minh và chưa bị khoá; học sinh → 404 trừ chính họ.
// Không bao giờ trả email, điện thoại, Zalo, trường, lớp, thành phố, ngày sinh.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sp = req.nextUrl.searchParams;
  const limit = parseLimit(sp.get("limit"));
  if (limit === null) return communityError(400, "limit_invalid", "Số bài mỗi trang phải từ 1 đến 50");
  const rawCursor = sp.get("cursor");
  const cursor = rawCursor ? decodeCursor(rawCursor) : null;
  if (rawCursor && !cursor) return communityError(400, "cursor_invalid", "Con trỏ không hợp lệ");
  const data = await loadProfile(await getSession(), id, cursor, limit);
  if (!data) return communityError(404, "not_found", "Không tìm thấy hồ sơ");
  return NextResponse.json(data, { headers: NO_STORE });
}
