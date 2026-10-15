// GET  /api/english/writing — 20 bài viết gần nhất của tôi (kèm góp ý).
// POST /api/english/writing — { taskType, prompt, body, revisionOfId? } → góp ý 4 tiêu chí + KHOẢNG band (AI không chấm chính xác tuyệt đối).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { requireUser, isResp, bad, logStudy } from "@/lib/english/server";
import { writingFeedback } from "@/lib/english/ai";
import { countWords } from "@/lib/english/text";
import { rateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

export async function GET() {
  const s = await requireUser();
  if (isResp(s)) return s;
  const items = await prisma.engWriting.findMany({ where: { userId: s.userId }, orderBy: { createdAt: "desc" }, take: 20 });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const s = await requireUser();
  if (isResp(s)) return s;
  const b = await req.json().catch(() => null) as { taskType?: string; prompt?: string; body?: string; revisionOfId?: string; seconds?: number } | null;
  const taskType = ["task1", "task2", "paragraph"].includes(b?.taskType ?? "") ? b!.taskType! : null;
  const prompt = (b?.prompt ?? "").trim().slice(0, 2000);
  const body = (b?.body ?? "").trim();
  if (!taskType) return bad("Chọn loại bài");
  if (prompt.length < 10) return bad("Dán đề bài vào");
  const wc = countWords(body);
  if (wc < 40) return bad("Bài cần ít nhất 40 từ để góp ý có ý nghĩa");
  if (body.length > 12000) return bad("Bài quá dài");
  let revisionOfId: string | null = null;
  if (b?.revisionOfId) {
    const prev = await prisma.engWriting.findFirst({ where: { id: b.revisionOfId, userId: s.userId }, select: { id: true } });
    if (!prev) return bad("Không tìm thấy bài gốc", 404);
    revisionOfId = prev.id;
  }
  if (!rateLimit(`eng-writing:${s.userId}`, 12, 60 * 60_000)) return bad("Đã gửi nhiều bài trong giờ này, thử lại sau.", 429);
  try {
    const fb = await writingFeedback({ taskType, prompt, body, wordCount: wc });
    const w = await prisma.engWriting.create({
      data: { userId: s.userId, taskType, prompt, body, wordCount: wc, feedback: fb as unknown as Prisma.InputJsonValue, bandLow: fb.bandLow, bandHigh: fb.bandHigh, revisionOfId },
    });
    await logStudy(s.userId, "viet", { items: 1, seconds: Math.min(Number(b?.seconds) || 0, 3600) });
    return NextResponse.json(w);
  } catch (e) {
    console.error("[english.writing]", e);
    return bad("AI đang bận, bài của bạn chưa bị mất — thử gửi lại sau ít phút.", 502);
  }
}
