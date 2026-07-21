import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse, ownsResource } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { computeContentHash } from "@/lib/questionDedup";
import { initialStatusFor } from "@/lib/questionBankWorkflow";

const DIFFICULTIES = ["NB", "TH", "VD", "VDC"];

// POST /api/exams/[id]/questions/[qid]/save-to-bank — admin: lưu 1 câu hỏi ĐÃ
// CÓ SẴN trong đề vào Ngân hàng câu hỏi (chiều ngược của
// /api/question-bank/route.ts POST + QuestionBankPicker — xem đó để biết
// chiều thuận copy từ ngân hàng vào đề). COPY nội dung thành bản ghi
// QuestionBankItem mới rồi gắn ExamQuestion.sourceBankItemId trỏ về đó —
// không share row (đúng nguyên tắc độc lập giữa 2 model).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; qid: string }> }
) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  const { id: examId, qid } = await params;

  try {
    const exam = await prisma.exam.findUnique({ where: { id: examId }, select: { ownerId: true } });
    if (!exam) return NextResponse.json({ error: "Không tìm thấy đề thi" }, { status: 404 });
    if (!ownsResource(auth, exam.ownerId)) {
      return NextResponse.json({ error: "Bạn không có quyền với đề thi này" }, { status: 403 });
    }

    const question = await prisma.examQuestion.findUnique({
      where: { id: qid },
      include: { options: { orderBy: { order: "asc" } } },
    });
    if (!question || question.examId !== examId) {
      return NextResponse.json({ error: "Không tìm thấy câu hỏi" }, { status: 404 });
    }
    if (question.sourceBankItemId) {
      return NextResponse.json({ error: "Câu này đã có trong ngân hàng" }, { status: 409 });
    }

    const { subject, topic, difficulty, tags } = await req.json() as {
      subject?: string; topic?: string; difficulty?: string; tags?: string[];
    };
    if (!subject?.trim() || !topic?.trim()) {
      return NextResponse.json({ error: "Thiếu môn học hoặc chủ đề" }, { status: 400 });
    }
    if (!difficulty || !DIFFICULTIES.includes(difficulty)) {
      return NextResponse.json({ error: "Độ khó không hợp lệ" }, { status: 400 });
    }

    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.questionBankItem.create({
        data: {
          type: question.type,
          text: question.text,
          imageUrl: question.imageUrl,
          points: question.points,
          explanation: question.explanation,
          subject: subject.trim(),
          topic: topic.trim(),
          difficulty,
          tags: tags && tags.length > 0 ? tags : undefined,
          contentHash: computeContentHash(question.text),
          ownerId: auth.userId,
          status: initialStatusFor(auth.adminRole),
          options: {
            create: question.options.map((o, idx) => ({
              order: idx,
              text: o.text,
              isCorrect: o.isCorrect,
              subLabel: o.subLabel,
            })),
          },
        },
        include: { options: { orderBy: { order: "asc" } }, owner: { select: { name: true } } },
      });
      await tx.examQuestion.update({ where: { id: qid }, data: { sourceBankItemId: created.id } });
      return created;
    });

    return NextResponse.json(item);
  } catch (e) {
    console.error("[POST /api/exams/[id]/questions/[qid]/save-to-bank]", e);
    return NextResponse.json({ error: "Lưu vào ngân hàng thất bại" }, { status: 400 });
  }
}
