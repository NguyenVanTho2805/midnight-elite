import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { shuffleArray } from "@/lib/examGrading";
import type { QuestionType } from "@/lib/examQuestionParser";

const DIFFICULTIES = ["NB", "TH", "VD", "VDC"] as const;
type Difficulty = (typeof DIFFICULTIES)[number];

// POST /api/question-bank/draw — Giai đoạn 5: tự động rút đề theo ma trận
// môn×độ khó (vd { NB: 10, TH: 15, VD: 10, VDC: 5 } cho môn "Toán"), có tuỳ
// chọn chống trùng với N đề GẦN NHẤT đã dùng ngân hàng. Không cần schema mới
// — "N đề gần nhất" suy từ ExamQuestion.createdAt (DateTime thật) thay vì
// Exam.createdAt (chỉ là String "DD/MM/YYYY" không tin được để sắp xếp).
export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  try {
    const body = await req.json();
    const { subject, counts, excludeRecentExams } = body as {
      subject?: string;
      counts?: Partial<Record<Difficulty, number>>;
      excludeRecentExams?: number;
    };

    if (!subject?.trim()) {
      return NextResponse.json({ error: "Thiếu môn học" }, { status: 400 });
    }
    const wantedEntries = DIFFICULTIES
      .map(d => [d, Number(counts?.[d]) || 0] as const)
      .filter(([, n]) => n > 0);
    if (wantedEntries.length === 0) {
      return NextResponse.json({ error: "Chưa nhập số câu cần rút cho độ khó nào" }, { status: 400 });
    }

    // Tập bản ghi ngân hàng cần loại trừ — lấy từ N đề GẦN NHẤT (theo lần gần
    // nhất có câu được copy từ ngân hàng vào đề, không phải N đề tạo gần nhất
    // nói chung) đã dùng ngân hàng, để không rút trùng câu vừa ra ở đề trước.
    const excludedIds = new Set<string>();
    const n = Number(excludeRecentExams) || 0;
    if (n > 0) {
      const recentLinks = await prisma.examQuestion.findMany({
        where: { sourceBankItemId: { not: null } },
        select: { examId: true, sourceBankItemId: true },
        orderBy: { createdAt: "desc" },
        take: 2000, // đủ rộng để phủ N đề gần nhất mà không kéo toàn bộ bảng
      });
      const recentExamIds: string[] = [];
      for (const link of recentLinks) {
        if (!recentExamIds.includes(link.examId)) {
          if (recentExamIds.length >= n) continue;
          recentExamIds.push(link.examId);
        }
      }
      for (const link of recentLinks) {
        if (recentExamIds.includes(link.examId) && link.sourceBankItemId) {
          excludedIds.add(link.sourceBankItemId);
        }
      }
    }

    const shortfall: Partial<Record<Difficulty, { requested: number; drawn: number }>> = {};
    const chosenIds: string[] = [];
    for (const [difficulty, count] of wantedEntries) {
      const eligible = await prisma.questionBankItem.findMany({
        // Giai đoạn 6 — CHỈ rút từ câu đã "approved". Draft/pending chưa qua
        // duyệt tuyệt đối không được lọt vào đề thi thật.
        where: { subject: subject.trim(), difficulty, status: "approved", id: { notIn: [...excludedIds, ...chosenIds] } },
        select: { id: true },
      });
      const picked = shuffleArray(eligible).slice(0, count).map(e => e.id);
      chosenIds.push(...picked);
      if (picked.length < count) shortfall[difficulty] = { requested: count, drawn: picked.length };
    }

    const items = await prisma.questionBankItem.findMany({
      where: { id: { in: chosenIds } },
      include: { options: { orderBy: { order: "asc" } } },
    });
    // Giữ đúng thứ tự NB → TH → VD → VDC (từ dễ đến khó, khớp cấu trúc đề
    // thi thông thường) thay vì thứ tự trả về ngẫu nhiên của findMany.
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
    console.error("[POST /api/question-bank/draw]", e);
    return NextResponse.json({ error: "Rút đề thất bại" }, { status: 400 });
  }
}
