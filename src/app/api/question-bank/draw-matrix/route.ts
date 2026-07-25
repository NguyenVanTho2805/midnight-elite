import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { shuffleArray } from "@/lib/examGrading";
import { computeExcludedBankItemIds } from "@/lib/questionBankDraw";
import type { QuestionType } from "@/lib/examQuestionParser";

const DIFFICULTIES = ["NB", "TH", "VD", "VDC"] as const;
type Difficulty = (typeof DIFFICULTIES)[number];

interface MatrixCell {
  topic: string;
  difficulty: Difficulty;
  type?: QuestionType | null;
  count: number;
}
interface ShortfallEntry extends MatrixCell {
  drawn: number;
}

// POST /api/question-bank/draw-matrix — ma trận đề chuẩn Bộ GDĐT: rút đề
// theo Chủ đề × Độ khó × Loại câu (Loại câu là bộ lọc TUỲ CHỌN theo từng
// dòng — type=null/undefined nghĩa là không lọc). Route riêng biệt với
// /api/question-bank/draw (Môn×Độ khó đơn giản, Giai đoạn 5) — không sửa
// route đó để tránh rủi ro regression cho chế độ "rút nhanh" đang hoạt động
// ổn định; chỉ dùng chung computeExcludedBankItemIds() cho phần chống trùng.
export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  try {
    const body = await req.json();
    const { subject, cells, excludeRecentExams } = body as {
      subject?: string;
      cells?: MatrixCell[];
      excludeRecentExams?: number;
    };

    if (!subject?.trim()) {
      return NextResponse.json({ error: "Thiếu môn học" }, { status: 400 });
    }
    if (!Array.isArray(cells) || cells.length === 0) {
      return NextResponse.json({ error: "Ma trận cần ít nhất 1 dòng chủ đề" }, { status: 400 });
    }
    for (const c of cells) {
      if (!c.topic?.trim() || !DIFFICULTIES.includes(c.difficulty) || !c.count || c.count <= 0) {
        return NextResponse.json({ error: "Ma trận có dòng thiếu chủ đề/độ khó/số câu hợp lệ" }, { status: 400 });
      }
    }

    const excludedIds = await computeExcludedBankItemIds(Number(excludeRecentExams) || 0);

    const shortfall: ShortfallEntry[] = [];
    const chosenIds: string[] = [];
    for (const cell of cells) {
      const eligible = await prisma.questionBankItem.findMany({
        // Giai đoạn 6 — CHỈ rút từ câu đã "approved".
        where: {
          subject: subject.trim(),
          topic: cell.topic.trim(),
          difficulty: cell.difficulty,
          status: "approved",
          ...(cell.type ? { type: cell.type } : {}),
          id: { notIn: [...excludedIds, ...chosenIds] },
        },
        select: { id: true },
      });
      const picked = shuffleArray(eligible).slice(0, cell.count).map(e => e.id);
      chosenIds.push(...picked);
      if (picked.length < cell.count) shortfall.push({ ...cell, drawn: picked.length });
    }

    const items = await prisma.questionBankItem.findMany({
      where: { id: { in: chosenIds } },
      include: { options: { orderBy: { order: "asc" } } },
    });
    // Giữ đúng thứ tự các dòng ma trận đã nhập, thay vì thứ tự trả về ngẫu
    // nhiên của findMany.
    const itemsById = new Map(items.map(i => [i.id, i]));
    const orderedItems = chosenIds.map(id => itemsById.get(id)!).filter(Boolean);

    const questions = orderedItems.map(item => ({
      text: item.text,
      type: item.type as QuestionType,
      imageUrl: item.imageUrl ?? undefined,
      points: item.points,
      explanation: item.explanation ?? undefined,
      options: item.options.map(o => ({ text: o.text, isCorrect: o.isCorrect, subLabel: o.subLabel ?? undefined })),
      sourceBankItemId: item.id,
    }));

    return NextResponse.json({ questions, shortfall });
  } catch (e) {
    console.error("[POST /api/question-bank/draw-matrix]", e);
    return NextResponse.json({ error: "Rút đề theo ma trận thất bại" }, { status: 400 });
  }
}
