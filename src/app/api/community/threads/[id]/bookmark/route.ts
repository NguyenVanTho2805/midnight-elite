import { NextRequest, NextResponse } from "next/server";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import { isUniqueViolation, loadAccessibleThread, notFoundThread, NO_STORE, withLock } from "@/lib/communityServer";

// POST /api/community/threads/[id]/bookmark — bật/tắt lưu. Cùng cách xử lý song song như like.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;
  const { id: threadId } = await params;

  const t = await loadAccessibleThread(auth, threadId);
  if (!t) return notFoundThread();

  let bookmarkedByMe: boolean;
  try {
    bookmarkedByMe = await withLock(`tbm:${auth.userId}:${threadId}`, async tx => {
      const existing = await tx.threadBookmark.findUnique({ where: { userId_threadId: { userId: auth.userId, threadId } } });
      if (existing) await tx.threadBookmark.deleteMany({ where: { userId: auth.userId, threadId } });
      else await tx.threadBookmark.create({ data: { userId: auth.userId, threadId } });
      return !existing;
    });
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    bookmarkedByMe = true;
  }
  return NextResponse.json({ bookmarkedByMe }, { headers: NO_STORE });
}
