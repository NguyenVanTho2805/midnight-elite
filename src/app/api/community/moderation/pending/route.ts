import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { decodeCursor, encodeCursor, sourceCursorWhere } from "@/lib/communityFeed";
import { hasPhoneOrLink } from "@/lib/communityRules";
import { communityError, NO_STORE, parseLimit } from "@/lib/communityServer";
import type { PendingPage } from "@/lib/communityTypes";
import type { Prisma } from "@/generated/prisma/client";

// GET /api/community/moderation/pending — hàng chờ duyệt câu hỏi của khách (quyền MANAGE_COMMUNITY; gia sư không có).
export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_COMMUNITY);
  if (isNextResponse(auth)) return auth;
  const sp = req.nextUrl.searchParams;
  const limit = parseLimit(sp.get("limit"));
  if (limit === null) return communityError(400, "limit_invalid", "Số mục mỗi trang phải từ 1 đến 50");
  const rawCursor = sp.get("cursor");
  const cursor = rawCursor ? decodeCursor(rawCursor) : null;
  if (rawCursor && !cursor) return communityError(400, "cursor_invalid", "Con trỏ không hợp lệ");

  const rows = await prisma.thread.findMany({
    where: { AND: [{ deletedAt: null, status: "pending", guestName: { not: null } }, sourceCursorWhere(cursor, "thread") as Prisma.ThreadWhereInput] },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: { id: true, guestName: true, title: true, content: true, createdAt: true },
  });
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  const body: PendingPage = {
    items: page.map(r => ({
      id: r.id, guestName: r.guestName ?? "", title: r.title ?? "", content: r.content, createdAt: r.createdAt.toISOString(),
      flags: { phoneOrLink: hasPhoneOrLink(`${r.guestName ?? ""}\n${r.title ?? ""}\n${r.content}`) },
    })),
    nextCursor: rows.length > limit && last ? encodeCursor({ createdAt: last.createdAt, source: "thread", id: last.id }) : null,
  };
  return NextResponse.json(body, { headers: NO_STORE });
}
