// BU-03 P1 — phần CÓ DB của ngân hàng câu hỏi gia sư: "kho thấy được", thống kê chương × mức có phạm vi, lưu hàng loạt (nhập Word → ngân hàng).
// Luật thuần nằm ở deThiTree.ts / azotaDocx.ts / quizQuestion.ts. Mọi hàm giả định người gọi đã qua requireTutor().
// KHÔNG gọi AI và KHÔNG tính embedding ở đây (đường Word "không tốn AI" phải đúng sự thật); câu chưa có embedding vẫn tìm tương tự được sau bằng job hiện có.
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { computeContentHash } from "@/lib/questionDedup";
import { initialStatusFor } from "@/lib/questionBankWorkflow";
import type { AdminRole } from "@/lib/permissions";
import { rollupChapterLevel, type ChapterRow, type StatNode } from "@/lib/deThiTree";
import { coerceQuestionInput, validateQuizQuestion, type QuizQuestionInput } from "@/lib/quizQuestion";
import { sanitizeFormulaImgTokens } from "@/lib/mathtype/formulaImg";

export type BankScope = "mine" | "shared" | "all";
export const BANK_SCOPES: readonly BankScope[] = ["mine", "shared", "all"];
export const BANK_SAVE_MAX = 200;
const DIFFICULTIES = ["NB", "TH", "VD", "VDC"] as const;
type Difficulty = (typeof DIFFICULTIES)[number];

/**
 * Kho gia sư NHÌN THẤY: câu đã duyệt của mọi người ∪ câu (mọi trạng thái) của chính mình.
 * `mine` = chỉ của mình; `shared` = chỉ đã duyệt. Câu nháp/chờ duyệt của gia sư khác KHÔNG BAO GIỜ nằm trong kho này.
 */
export function visibleBankWhere(tutorId: string, scope: BankScope = "all"): Prisma.QuestionBankItemWhereInput {
  if (scope === "mine") return { ownerId: tutorId };
  if (scope === "shared") return { status: "approved" };
  return { OR: [{ status: "approved" }, { ownerId: tutorId }] };
}

export const isBankScope = (v: unknown): v is BankScope => typeof v === "string" && (BANK_SCOPES as readonly string[]).includes(v);

export type BankStats = { nodes: StatNode[]; chapterMatrix: ChapterRow[] };

/** `null` = không có nút `rootId`. Hai truy vấn (cây + một groupBy), không N+1. Không trả tên người, không trả nội dung câu. */
export async function bankStats(tutorId: string, rootId: string | null, scope: BankScope): Promise<BankStats | null> {
  const [cats, grouped] = await Promise.all([
    prisma.questionCategory.findMany({ select: { id: true, name: true, parentId: true, sortOrder: true } }),
    prisma.questionBankItem.groupBy({ by: ["categoryId", "difficulty"], where: visibleBankWhere(tutorId, scope), _count: { _all: true } }),
  ]);
  if (rootId !== null && !cats.some(c => c.id === rootId)) return null;
  return rollupChapterLevel(cats, grouped.map(g => ({ categoryId: g.categoryId, difficulty: g.difficulty, n: g._count._all })), rootId);
}

export interface SaveManyResult { saved: number; skippedDuplicate: number; skippedInvalid: number; ids: string[] }
export type SaveManyOutcome =
  | { ok: true; result: SaveManyResult }
  | { ok: false; status: 400 | 404; code?: string; error: string };

/** Một câu thô từ thân yêu cầu → câu hợp lệ + độ khó + (tuỳ chọn) nút riêng. Hỏng → null. */
/** Token ảnh công thức `{{ctimg:…}}` từ máy khách KHÔNG được tin: mỗi token phải là SVG do KiN sinh (validateFormulaSvg), nếu không bị đổi thành nhãn ⟦công thức⟧ (câu bị chặn phát hành). */
function sanitizeTokens(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const r = { ...(raw as Record<string, unknown>) };
  for (const k of ["text", "explanation", "hint", "studentGuide", "graderGuide"]) if (typeof r[k] === "string") r[k] = sanitizeFormulaImgTokens(r[k] as string);
  if (Array.isArray(r.options)) r.options = r.options.map(o => (o && typeof o === "object" && typeof (o as { text?: unknown }).text === "string" ? { ...(o as object), text: sanitizeFormulaImgTokens((o as { text: string }).text) } : o));
  return r;
}

function readItem(rawIn: unknown, defaultDifficulty: Difficulty | null): { q: QuizQuestionInput; difficulty: Difficulty; categoryId: string | null } | null {
  const raw = sanitizeTokens(rawIn);
  const q = coerceQuestionInput(raw);
  if ("error" in q) return null;
  if (validateQuizQuestion(q)) return null; // vào ngân hàng phải đủ đáp án: câu thiếu/mâu thuẫn đáp án ở lại màn xem lại, không vào kho
  const r = (raw ?? {}) as Record<string, unknown>;
  const dRaw = typeof r.difficulty === "string" ? r.difficulty.trim().toUpperCase() : "";
  const difficulty = (DIFFICULTIES as readonly string[]).includes(dRaw) ? (dRaw as Difficulty) : defaultDifficulty;
  if (!difficulty) return null; // KHÔNG đoán mức
  const categoryId = typeof r.categoryId === "string" && r.categoryId.trim() ? r.categoryId.trim() : null;
  return { q, difficulty, categoryId };
}

/**
 * Lưu hàng loạt vào ngân hàng: mỗi câu `status` theo `initialStatusFor(adminRole)` (gia sư → draft, riêng chủ), chủ = gia sư.
 * Bỏ trùng theo `contentHash` trong CÙNG nút — chỉ so với kho gia sư thấy (không lộ nháp người khác) và so trong chính lô này.
 */
export async function saveManyToBank(tutorId: string, adminRole: AdminRole | undefined | null, input: { categoryId: unknown; items: unknown; defaultDifficulty?: unknown }): Promise<SaveManyOutcome> {
  if (!Array.isArray(input.items) || input.items.length === 0) return { ok: false, status: 400, code: "EMPTY", error: "Chưa có câu nào để lưu." };
  if (input.items.length > BANK_SAVE_MAX) return { ok: false, status: 400, code: "TOO_MANY", error: `Một lần lưu tối đa ${BANK_SAVE_MAX} câu.` };
  const catId = typeof input.categoryId === "string" ? input.categoryId.trim() : "";
  if (!catId) return { ok: false, status: 400, code: "NO_CATEGORY", error: "Chọn nút ngân hàng (chương/yêu cầu cần đạt) để lưu vào." };
  const dd = typeof input.defaultDifficulty === "string" ? input.defaultDifficulty.trim().toUpperCase() : "";
  if (input.defaultDifficulty != null && input.defaultDifficulty !== "" && !(DIFFICULTIES as readonly string[]).includes(dd)) {
    return { ok: false, status: 400, code: "BAD_DIFFICULTY", error: "Mức mặc định phải là NB, TH, VD hoặc VDC." };
  }
  const defaultDifficulty = (dd || null) as Difficulty | null;

  const entries = input.items.map(raw => readItem(raw, defaultDifficulty));
  const wantedCats = new Set<string>([catId, ...entries.flatMap(e => (e?.categoryId ? [e.categoryId] : []))]);
  const found = await prisma.questionCategory.findMany({ where: { id: { in: [...wantedCats] } }, select: { id: true } });
  const foundIds = new Set(found.map(f => f.id));
  if (!foundIds.has(catId)) return { ok: false, status: 404, error: "Không tìm thấy nút ngân hàng này." };
  for (const e of entries) if (e?.categoryId && !foundIds.has(e.categoryId)) return { ok: false, status: 404, error: "Có câu trỏ tới nút ngân hàng không tồn tại." };

  let skippedInvalid = 0, skippedDuplicate = 0;
  const todo: { q: QuizQuestionInput; difficulty: Difficulty; categoryId: string; hash: string }[] = [];
  for (const e of entries) {
    if (!e) { skippedInvalid++; continue; }
    todo.push({ q: e.q, difficulty: e.difficulty, categoryId: e.categoryId ?? catId, hash: computeContentHash(e.q.text) });
  }
  if (todo.length === 0) return { ok: true, result: { saved: 0, skippedDuplicate, skippedInvalid, ids: [] } };

  const existing = await prisma.questionBankItem.findMany({
    where: { AND: [visibleBankWhere(tutorId, "all"), { categoryId: { in: [...new Set(todo.map(t => t.categoryId))] } }, { contentHash: { in: [...new Set(todo.map(t => t.hash))] } }] },
    select: { categoryId: true, contentHash: true },
  });
  const seen = new Set(existing.map(e => `${e.categoryId}|${e.contentHash}`));
  const fresh = todo.filter(t => {
    const k = `${t.categoryId}|${t.hash}`;
    if (seen.has(k)) { skippedDuplicate++; return false; }
    seen.add(k); return true;
  });

  const status = initialStatusFor(adminRole);
  const ids = fresh.length === 0 ? [] : (await prisma.$transaction(fresh.map(t => prisma.questionBankItem.create({
    select: { id: true },
    data: {
      type: t.q.type,
      text: t.q.text.trim(),
      imageUrl: t.q.imageUrl?.trim() || null,
      points: t.q.points > 0 ? t.q.points : 1,
      explanation: t.q.explanation?.trim() || null,
      hint: t.q.hint?.trim() || null,
      categoryId: t.categoryId,
      difficulty: t.difficulty,
      contentHash: t.hash,
      ownerId: tutorId,
      status,
      options: { create: t.q.options.map((o, idx) => ({ order: idx, text: o.text.trim(), isCorrect: !!o.isCorrect, subLabel: o.subLabel ?? null })) },
    },
  })))).map(r => r.id);
  return { ok: true, result: { saved: ids.length, skippedDuplicate, skippedInvalid, ids } };
}
