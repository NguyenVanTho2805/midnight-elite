import { NextRequest, NextResponse } from "next/server";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { cleanText } from "@/lib/communityRules";
import { communityError, isUniqueViolation, loadAccessibleThread, notFoundThread, NO_STORE } from "@/lib/communityServer";

// POST /api/community/threads/[id]/report — báo cáo bài vi phạm (vào hàng chờ kiểm duyệt hiện có). Mỗi người một lần mỗi bài.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;
  const { id: threadId } = await params;

  let raw: unknown;
  try { raw = (await req.json())?.reason; } catch { raw = undefined; }
  const reason = cleanText(raw, true).slice(0, 500);

  const t = await loadAccessibleThread(auth, threadId);
  if (!t) return notFoundThread();
  if (!reason) return communityError(400, "reason_empty", "Vui lòng nêu lý do báo cáo");
  if (t.authorId === auth.userId) return communityError(400, "own_post", "Không thể tự báo cáo bài viết của mình");

  try {
    // @@unique([threadId, reporterId]) chặn trùng ngay cả khi gọi song song.
    await prisma.threadReport.create({ data: { threadId, reporterId: auth.userId, reason } });
  } catch (e) {
    if (isUniqueViolation(e)) return communityError(409, "already_reported", "Bạn đã báo cáo bài viết này rồi");
    throw e;
  }
  return NextResponse.json({ success: true }, { headers: NO_STORE });
}
