// POST /api/english/texts/[id]/questions — soạn 5 câu hỏi đọc hiểu cho bài (một lần cho mỗi bài, dùng chung cho mọi người đọc bài công khai).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResp, bad } from "@/lib/english/server";
import { textQuestions } from "@/lib/english/ai";
import { rateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;
const inFlight = new Set<string>();

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireUser();
  if (isResp(s)) return s;
  const t = await prisma.engText.findFirst({ where: { id, OR: [{ ownerId: null }, { ownerId: s.userId }] }, select: { id: true, title: true, body: true, ownerId: true } });
  if (!t) return bad("Không tìm thấy bài", 404);
  const have = await prisma.engExercise.count({ where: { textId: id, flagged: false } });
  if (have > 0) return NextResponse.json({ ok: true, created: 0 });
  if (inFlight.has(id)) return bad("Đang soạn câu hỏi cho bài này, chờ vài giây rồi tải lại.", 409);
  if (!rateLimit(`eng-q:${s.userId}`, 20, 60 * 60_000)) return bad("Đã soạn nhiều câu hỏi trong giờ này, thử lại sau.", 429);
  inFlight.add(id);
  try {
    const items = await textQuestions(t.title, t.body);
    if (!items.length) return bad("Chưa soạn được câu hỏi, thử lại sau.", 502);
    // Chống trùng khi hai người cùng bấm: kiểm lại ngay trước khi ghi.
    if (await prisma.engExercise.count({ where: { textId: id } }) > 0) return NextResponse.json({ ok: true, created: 0 });
    await prisma.engExercise.createMany({
      data: items.map((e, i) => ({ ownerId: t.ownerId, textId: id, type: e.type, instruction: e.instruction ?? null, prompt: e.prompt, options: e.options, answers: e.answers, explanation: e.explanation ?? null, origin: "ai", order: i })),
    });
    return NextResponse.json({ ok: true, created: items.length });
  } catch (e) {
    console.error("[english.texts.questions]", e);
    return bad("AI đang bận, thử lại sau.", 502);
  } finally {
    inFlight.delete(id);
  }
}
