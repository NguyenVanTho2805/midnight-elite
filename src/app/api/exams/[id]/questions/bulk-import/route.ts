import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";

// Định dạng nhập hàng loạt, mỗi câu hỏi là 1 khối:
//   Câu 1: Nội dung câu hỏi...
//   A. Đáp án A
//   B. Đáp án B
//   C. Đáp án C
//   D. Đáp án D
//   Đáp án: B
// Các khối cách nhau bởi 1+ dòng trống. Lỗi ở khối nào chỉ bỏ qua khối đó,
// không làm hỏng cả batch (đề thật 35-150 câu, cần import dễ dãi với lỗi gõ).

const QUESTION_START = /^C[âa]u\s*\d+\s*[:.]?\s*/i;
const OPTION_LINE = /^([A-D])[.):]\s*(.+)$/i;
const ANSWER_LINE = /^Đ[áa]p\s*[áa]n\s*(?:đ[úu]ng)?\s*[:.]?\s*([A-D])/i;

interface ParsedQuestion {
  text: string;
  options: { text: string; isCorrect: boolean }[];
}

interface ParseError {
  block: number;
  message: string;
}

function parseBulkText(raw: string): { questions: ParsedQuestion[]; errors: ParseError[] } {
  const blocks = raw
    .split(/\n\s*\n/)
    .map(b => b.trim())
    .filter(Boolean);

  const questions: ParsedQuestion[] = [];
  const errors: ParseError[] = [];

  blocks.forEach((block, idx) => {
    const lines = block.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return;

    let questionText = "";
    const options: { text: string; isCorrect: boolean }[] = [];
    let answerLetter: string | null = null;

    for (const line of lines) {
      const answerMatch = line.match(ANSWER_LINE);
      if (answerMatch) {
        answerLetter = answerMatch[1].toUpperCase();
        continue;
      }
      const optionMatch = line.match(OPTION_LINE);
      if (optionMatch) {
        options.push({ text: optionMatch[2].trim(), isCorrect: false });
        continue;
      }
      if (!questionText) {
        questionText = line.replace(QUESTION_START, "").trim();
      } else {
        questionText += " " + line;
      }
    }

    if (!questionText) {
      errors.push({ block: idx + 1, message: "Không tìm thấy nội dung câu hỏi" });
      return;
    }
    if (options.length < 2) {
      errors.push({ block: idx + 1, message: "Cần ít nhất 2 đáp án (dòng bắt đầu bằng A./B./C./D.)" });
      return;
    }
    if (!answerLetter) {
      errors.push({ block: idx + 1, message: "Thiếu dòng 'Đáp án: X'" });
      return;
    }
    const answerIdx = answerLetter.charCodeAt(0) - "A".charCodeAt(0);
    if (answerIdx < 0 || answerIdx >= options.length) {
      errors.push({ block: idx + 1, message: `Đáp án "${answerLetter}" không khớp với danh sách lựa chọn` });
      return;
    }
    options[answerIdx].isCorrect = true;

    questions.push({ text: questionText, options });
  });

  return { questions, errors };
}

// POST /api/exams/[id]/questions/bulk-import — admin: nhập hàng loạt câu hỏi từ text
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  const { id: examId } = await params;

  try {
    const { text } = await req.json() as { text?: string };
    if (!text?.trim()) {
      return NextResponse.json({ error: "Thiếu nội dung để nhập" }, { status: 400 });
    }

    const exam = await prisma.exam.findUnique({ where: { id: examId }, select: { id: true } });
    if (!exam) return NextResponse.json({ error: "Không tìm thấy đề thi" }, { status: 404 });

    const { questions, errors } = parseBulkText(text);

    if (questions.length === 0) {
      return NextResponse.json({ imported: 0, errors }, { status: 400 });
    }

    const maxOrder = await prisma.examQuestion.aggregate({
      where: { examId },
      _max: { order: true },
    });
    let nextOrder = (maxOrder._max.order ?? 0) + 1;

    await prisma.$transaction(
      questions.map(q => {
        const order = nextOrder++;
        return prisma.examQuestion.create({
          data: {
            id: `eq-${crypto.randomUUID()}`,
            examId,
            order,
            text: q.text,
            points: 1,
            options: {
              create: q.options.map((o, idx) => ({
                id: `eo-${crypto.randomUUID()}`,
                order: idx,
                text: o.text,
                isCorrect: o.isCorrect,
              })),
            },
          },
        });
      })
    );

    return NextResponse.json({ imported: questions.length, errors });
  } catch (e) {
    console.error("[POST /api/exams/[id]/questions/bulk-import]", e);
    return NextResponse.json({ error: "Nhập hàng loạt thất bại" }, { status: 400 });
  }
}
