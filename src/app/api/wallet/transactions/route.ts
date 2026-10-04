import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, isNextResponse } from "@/lib/auth-guard";

// GET /api/wallet/transactions?classId=&sourceType=&cursor=&limit=
// Lịch sử ví của chính session hiện tại, có lọc theo lớp và nguồn — dùng cho
// trang Lịch sử ví của học viên lẫn Gia sư Dashboard khi xem thu nhập 1 lớp.
// Pagination theo cursor (id của giao dịch cuối trang) để tránh offset lệch
// khi có giao dịch mới chen vào giữa 2 lượt scroll.
export async function GET(req: NextRequest) {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;

  const { searchParams } = new URL(req.url);
  const classId    = searchParams.get("classId");
  const sourceType = searchParams.get("sourceType");
  const cursor     = searchParams.get("cursor");
  const limitRaw   = parseInt(searchParams.get("limit") ?? "20", 10);
  const limit      = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 20;

  const rows = await prisma.coinTransaction.findMany({
    where: {
      userId: auth.userId,
      ...(classId    ? { classId }    : {}),
      ...(sourceType ? { sourceType } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1, // lấy dư 1 để biết còn trang sau không
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore    = rows.length > limit;
  const items      = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

  return NextResponse.json({ items, nextCursor });
}
