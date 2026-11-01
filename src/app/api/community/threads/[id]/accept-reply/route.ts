import { NextRequest, NextResponse } from "next/server";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { notificationText, threadLink } from "@/lib/communityRules";
import { canAcceptReply, communityError, loadAccessibleThread, notFoundThread, NO_STORE } from "@/lib/communityServer";

// POST /api/community/threads/[id]/accept-reply { replyId } — chọn trả lời đúng cho câu hỏi. Không có tiền. Đổi được; gọi lại cùng replyId là idempotent.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;
  const { id: threadId } = await params;

  const t = await loadAccessibleThread(auth, threadId);
  if (!t) return notFoundThread();
  if (t.kind !== "question") return communityError(400, "not_a_question", "Chỉ chọn trả lời đúng cho câu hỏi");
  if (!(await canAcceptReply(auth, t))) return communityError(403, "not_allowed", "Bạn không có quyền chọn trả lời đúng");

  let replyId: unknown;
  try { replyId = (await req.json())?.replyId; } catch { replyId = undefined; }
  if (typeof replyId !== "string" || !replyId) return communityError(400, "reply_invalid", "Trả lời không hợp lệ");
  const reply = await prisma.threadReply.findUnique({ where: { id: replyId }, select: { id: true, threadId: true, authorId: true, deletedAt: true } });
  if (!reply || reply.threadId !== threadId || reply.deletedAt) return communityError(400, "reply_invalid", "Trả lời không hợp lệ");

  // Một lệnh UPDATE: gọi song song thì giá trị cuối là một trong các replyId hợp lệ, không lỗi.
  const changed = await prisma.thread.updateMany({
    where: { id: threadId, deletedAt: null, status: "published", OR: [{ acceptedReplyId: null }, { acceptedReplyId: { not: replyId } }] }, // NOT(col = x) bỏ sót hàng NULL trong SQL: lần chọn đầu sẽ không bao giờ ghi
    data: { acceptedReplyId: replyId },
  });
  if (changed.count > 0 && reply.authorId !== auth.userId) {
    const n = notificationText("reply_accepted");
    await notify(reply.authorId, { type: n.type, title: n.title, message: n.message, link: threadLink(threadId, replyId) });
  }
  return NextResponse.json({ acceptedReplyId: replyId }, { headers: NO_STORE });
}
