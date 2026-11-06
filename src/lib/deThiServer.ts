// BU-03 P2 — phần CÓ DB của ma trận / mã đề / tệp đề gốc. Luật thuần ở deThiBlueprint.ts, deThiVariants.ts, deThiSourceFile.ts.
// Mọi hàm giả định người gọi đã qua requireTutor(). Quyền theo tài nguyên (Q2): không có → 404, của người khác → 403.
// Kết quả trả dạng { ok:true, … } | { ok:false, status, code?, error, extra? } để route mỏng: `failResponse(f)`.
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { visibleBankWhere, isBankScope, type BankScope } from "@/lib/deThiBankServer";
import {
  BLUEPRINT_MAX_TOTAL, drawFromBlueprint, expandSubtree, normalizeBlueprintName, rowsFromJson, shortagesForSelection, swapOne, validateBlueprintRows,
  isLevel, type BlueprintRow, type CatRef, type DrawResult, type PoolItem, type Shortage,
} from "@/lib/deThiBlueprint";
import { VARIANT_MAX, VARIANT_MIN, buildVariantPlan, shuffleWarnings, variantCode, variantMatchesRoot, type KeyQuestion } from "@/lib/deThiVariants";
import { isAllowedSourceUrl, looksLikeDocx, imageMimeFromMagic, wordAnalyseAllowed, WORD_ANALYSE_KIND, WORD_ANALYSE_WINDOW_MS, WORD_RATE_MESSAGE } from "@/lib/deThiSourceFile";
import { AZOTA_MAX_QUESTIONS, parseAzotaBlocks, type AzotaParse } from "@/lib/azotaDocx";
import { DOCX_MAX_BYTES, DOCX_MAX_IMAGES, DocxError, readDocx } from "@/lib/azotaDocxRead";
import { cloudinaryServerConfigured, uploadImageBufferToCloudinary } from "@/lib/cloudinaryServer";
import { isQuizType, type QuizQuestionInput } from "@/lib/quizQuestion";
import { VARIANT_STUDENT_SUPPORT } from "@/lib/deThiAssign";
import { QUIZ_CATEGORY, dmyFromKey, durationText, loadOwnedQuiz, loadQuestions, logChange, newExamCode, newExamId, questionCreateData, statusOf, supersededBlock, syncQuizTotals, todayKeyVN, toSnap, type OwnedQuiz } from "@/lib/quizServer";
import { isNextResponse } from "@/lib/auth-guard";
import { clipVisible, visibleLength } from "@/lib/mathtype/formulaImg"; // không cắt giữa token ảnh công thức

export type Fail = { ok: false; status: number; error: string; code?: string; extra?: Record<string, unknown> };
export type Outcome<T extends object> = ({ ok: true } & T) | Fail;
const fail = (status: number, error: string, code?: string, extra?: Record<string, unknown>): Fail => ({ ok: false, status, error, ...(code ? { code } : {}), ...(extra ? { extra } : {}) });
export const failResponse = (f: Fail): NextResponse =>
  NextResponse.json({ error: f.error, ...(f.code ? { code: f.code } : {}), ...(f.extra ?? {}) }, { status: f.status, headers: { "Cache-Control": "no-store" } });

export const TITLE_MAX = 150;
export const EXAM_MODES = ["practice", "test"] as const;
export type ExamMode = (typeof EXAM_MODES)[number];
export const isExamMode = (v: unknown): v is ExamMode => v === "practice" || v === "test";
const PREVIEW_CHARS = 240;

// ── Quyền ─────────────────────────────────────────────────────────────────────────────────────────
/** Lớp trong thân yêu cầu: không tồn tại → 404; có nhưng không phải lớp của mình → 403 NOT_YOUR_CLASS. */
export async function checkOwnCourse(tutorId: string, courseId: string): Promise<Fail | null> {
  const c = await prisma.course.findUnique({ where: { id: courseId }, select: { ownerId: true } });
  if (!c) return fail(404, "Không tìm thấy lớp này.");
  if (c.ownerId !== tutorId) return fail(403, "Lớp này không phải lớp của cô.", "NOT_YOUR_CLASS");
  return null;
}

export async function loadOwnedBlueprint(tutorId: string, id: string): Promise<Outcome<{ bp: { id: string; name: string; rows: BlueprintRow[]; createdAt: Date; updatedAt: Date } }>> {
  const bp = await prisma.examBlueprint.findUnique({ where: { id } });
  if (!bp) return fail(404, "Không tìm thấy ma trận này.");
  if (bp.ownerId !== tutorId) return fail(403, "Ma trận này không phải của cô.");
  return { ok: true, bp: { id: bp.id, name: bp.name, rows: rowsFromJson(bp.rows), createdAt: bp.createdAt, updatedAt: bp.updatedAt } };
}

export const shapeBlueprint = (bp: { id: string; name: string; rows: BlueprintRow[]; updatedAt: Date; createdAt?: Date }) =>
  ({ id: bp.id, name: bp.name, rows: bp.rows, total: bp.rows.reduce((s, r) => s + r.count, 0), updatedAt: bp.updatedAt.toISOString() });

async function loadCategories(): Promise<CatRef[]> {
  return prisma.questionCategory.findMany({ select: { id: true, parentId: true } });
}

/** Mọi `categoryId` của các dòng phải là nút có thật, không thì 404. */
function missingCategory(rows: readonly BlueprintRow[], cats: readonly CatRef[]): Fail | null {
  const have = new Set(cats.map(c => c.id));
  const bad = rows.findIndex(r => !have.has(r.categoryId));
  return bad >= 0 ? fail(404, `Dòng ${bad + 1}: nút ngân hàng không tồn tại (có thể đã bị xoá).`, undefined, { rowIndex: bad }) : null;
}

export async function listBlueprints(tutorId: string) {
  const rows = await prisma.examBlueprint.findMany({ where: { ownerId: tutorId }, orderBy: { updatedAt: "desc" }, take: 200 });
  return rows.map(r => shapeBlueprint({ id: r.id, name: r.name, rows: rowsFromJson(r.rows), updatedAt: r.updatedAt }));
}

export async function saveBlueprint(tutorId: string, body: { name?: unknown; rows?: unknown }, existingId?: string): Promise<Outcome<{ id: string }>> {
  const name = normalizeBlueprintName(body.name);
  if (!name.ok) return fail(400, name.error, "BAD_NAME");
  const rows = validateBlueprintRows(body.rows);
  if (!rows.ok) return fail(400, rows.error, rows.code);
  const miss = missingCategory(rows.rows, await loadCategories());
  if (miss) return miss;
  const data = { name: name.name, rows: rows.rows as unknown as Prisma.InputJsonValue };
  if (existingId) { await prisma.examBlueprint.update({ where: { id: existingId }, data }); return { ok: true, id: existingId }; }
  const created = await prisma.examBlueprint.create({ data: { ...data, ownerId: tutorId }, select: { id: true } });
  return { ok: true, id: created.id };
}

// ── Bốc câu ─────────────────────────────────────────────────────────────────────────────────────
const asLevel = (v: string | null): PoolItem["difficulty"] => (isLevel(v) ? v : null);

async function loadPool(tutorId: string, rows: readonly BlueprintRow[], cats: readonly CatRef[], scope: BankScope): Promise<PoolItem[]> {
  const catIds = [...new Set(rows.flatMap(r => expandSubtree(r.categoryId, cats)))];
  const diffs = [...new Set(rows.map(r => r.difficulty))];
  const items = await prisma.questionBankItem.findMany({
    where: { AND: [visibleBankWhere(tutorId, scope), { categoryId: { in: catIds } }, { difficulty: { in: diffs } }] },
    select: { id: true, categoryId: true, difficulty: true, contentHash: true },
  });
  return items.map(i => ({ id: i.id, categoryId: i.categoryId, difficulty: asLevel(i.difficulty), contentHash: i.contentHash ?? "" }));
}

export interface ItemPreview { id: string; text: string; type: string; difficulty: string | null; categoryId: string; hasImage: boolean }
async function previews(ids: readonly string[]): Promise<Map<string, ItemPreview>> {
  if (ids.length === 0) return new Map();
  const items = await prisma.questionBankItem.findMany({ where: { id: { in: [...ids] } }, select: { id: true, text: true, type: true, difficulty: true, categoryId: true, imageUrl: true } });
  return new Map(items.map(i => [i.id, { id: i.id, text: clipVisible(i.text, PREVIEW_CHARS) + (visibleLength(i.text) > PREVIEW_CHARS ? "…" : ""), type: i.type, difficulty: i.difficulty, categoryId: i.categoryId, hasImage: !!i.imageUrl }]));
}

const strList = (v: unknown, max = 500): string[] | null => (v == null ? [] : Array.isArray(v) && v.length <= max && v.every(x => typeof x === "string") ? (v as string[]) : null);
const scopeOf = (v: unknown): BankScope | null => (v == null || v === "" ? "all" : isBankScope(v) ? v : null);

/** Xem trước bốc câu theo ma trận. KHÔNG ghi gì. Hạt không gửi → sinh hạt mới (mỗi lần "Bốc lại" là một hạt mới). */
export async function drawPreview(tutorId: string, body: { rows?: unknown; seed?: unknown; scope?: unknown; locked?: unknown; exclude?: unknown }): Promise<Outcome<{ result: DrawResult & { picks: { rowIndex: number; itemIds: string[]; items: ItemPreview[] }[] } }>> {
  const rows = validateBlueprintRows(body.rows);
  if (!rows.ok) return fail(400, rows.error, rows.code);
  const scope = scopeOf(body.scope); if (!scope) return fail(400, "Kho phải là mine, shared hoặc all.", "BAD_SCOPE");
  const locked = strList(body.locked), exclude = strList(body.exclude);
  if (!locked || !exclude) return fail(400, "Danh sách câu giữ lại / bỏ không đúng dạng.", "BAD_LIST");
  const seed = typeof body.seed === "string" && body.seed.trim() ? body.seed.trim().slice(0, 100) : randomUUID();
  const cats = await loadCategories();
  const miss = missingCategory(rows.rows, cats); if (miss) return miss;
  const pool = await loadPool(tutorId, rows.rows, cats, scope);
  const res = drawFromBlueprint({ rows: rows.rows, pool, categories: cats, seed, locked, exclude });
  const pv = await previews(res.picks.flatMap(p => p.itemIds));
  return { ok: true, result: { ...res, picks: res.picks.map(p => ({ ...p, items: p.itemIds.flatMap(id => (pv.has(id) ? [pv.get(id)!] : [])) })) } };
}

export async function swapPreview(tutorId: string, body: { rows?: unknown; rowIndex?: unknown; itemId?: unknown; current?: unknown; seed?: unknown; scope?: unknown; exclude?: unknown }): Promise<Outcome<{ itemId: string; item: ItemPreview | null }>> {
  const rows = validateBlueprintRows(body.rows);
  if (!rows.ok) return fail(400, rows.error, rows.code);
  const rowIndex = body.rowIndex;
  if (typeof rowIndex !== "number" || !Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex >= rows.rows.length) return fail(400, "Dòng cần đổi câu không hợp lệ.", "BAD_ROW_INDEX");
  if (typeof body.itemId !== "string" || !body.itemId) return fail(400, "Thiếu câu cần đổi.", "BAD_ITEM");
  const current = strList(body.current, 300), exclude = strList(body.exclude);
  if (!current || !exclude) return fail(400, "Danh sách câu hiện có không đúng dạng.", "BAD_LIST");
  const scope = scopeOf(body.scope); if (!scope) return fail(400, "Kho phải là mine, shared hoặc all.", "BAD_SCOPE");
  const seed = typeof body.seed === "string" && body.seed.trim() ? body.seed.trim().slice(0, 100) : randomUUID();
  const cats = await loadCategories();
  const miss = missingCategory(rows.rows, cats); if (miss) return miss;
  const pool = await loadPool(tutorId, rows.rows, cats, scope);
  const r = swapOne({ itemId: body.itemId, rowIndex, rows: rows.rows, pool, categories: cats, seed, current, exclude });
  if ("code" in r) return fail(409, "Không còn câu nào khác trong ô này để đổi. Thử nới kho (Tất cả) hoặc thêm câu vào ngân hàng.", "NO_ALTERNATIVE");
  return { ok: true, itemId: r.itemId, item: (await previews([r.itemId])).get(r.itemId) ?? null };
}

// ── Tạo đề từ câu đã bốc ────────────────────────────────────────────────────────────────────────
export async function createExamFromBank(tutorId: string, body: { title?: unknown; courseId?: unknown; blueprintId?: unknown; itemIds?: unknown; mode?: unknown; allowShort?: unknown }): Promise<Outcome<{ examId: string; shortages: Shortage[] }>> {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return fail(400, "Cô đặt tên cho đề trước nhé.", "NO_TITLE");
  if (title.length > TITLE_MAX) return fail(400, `Tên đề tối đa ${TITLE_MAX} ký tự.`, "TITLE_TOO_LONG");
  if (body.mode != null && body.mode !== "" && !isExamMode(body.mode)) return fail(400, "Chế độ phải là practice (luyện tập) hoặc test (kiểm tra).", "BAD_MODE");
  const mode: ExamMode | null = isExamMode(body.mode) ? body.mode : null;
  const ids = body.itemIds;
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every(x => typeof x === "string" && x)) return fail(400, "Chưa có câu nào để tạo đề.", "EMPTY");
  if (ids.length > BLUEPRINT_MAX_TOTAL) return fail(400, `Một đề tối đa ${BLUEPRINT_MAX_TOTAL} câu.`, "TOO_MANY");
  if (new Set(ids).size !== ids.length) return fail(400, "Có câu bị chọn hai lần.", "DUPLICATE_ITEM");

  let courseId: string | null = null;
  if (typeof body.courseId === "string" && body.courseId) {
    const bad = await checkOwnCourse(tutorId, body.courseId); if (bad) return bad;
    courseId = body.courseId;
  }
  let bpRows: BlueprintRow[] | null = null, blueprintId: string | null = null;
  if (typeof body.blueprintId === "string" && body.blueprintId) {
    const bp = await loadOwnedBlueprint(tutorId, body.blueprintId);
    if (!bp.ok) return bp;
    bpRows = bp.bp.rows; blueprintId = bp.bp.id;
  }

  const items = await prisma.questionBankItem.findMany({ where: { id: { in: ids as string[] } }, include: { options: { orderBy: { order: "asc" } } } });
  const byId = new Map(items.map(i => [i.id, i]));
  if ([...ids as string[]].some(id => !byId.has(id))) return fail(404, "Có câu không còn trong ngân hàng.", "ITEM_NOT_FOUND");
  // Kho thấy được: đã duyệt của mọi người hoặc của chính mình. Nháp/chờ duyệt của gia sư khác KHÔNG bao giờ được đưa vào đề.
  if (items.some(i => i.status !== "approved" && i.ownerId !== tutorId)) return fail(403, "Có câu không nằm trong kho cô được dùng.", "ITEM_NOT_VISIBLE");

  let shortages: Shortage[] = [];
  if (bpRows) {
    shortages = shortagesForSelection(bpRows, (ids as string[]).map(id => ({ id, categoryId: byId.get(id)!.categoryId, difficulty: asLevel(byId.get(id)!.difficulty) })), await loadCategories());
    if (shortages.length > 0 && body.allowShort !== true) return fail(422, "Ma trận còn thiếu câu ở một số ô. Bốc thêm, hoặc chọn \"Vẫn tạo đề thiếu\".", "SHORTAGE", { shortages });
  }

  const examId = await prisma.$transaction(async tx => {
    const id = newExamId();
    await tx.exam.create({
      data: {
        id, code: await newExamCode(tx), title, category: QUIZ_CATEGORY, date: dmyFromKey(todayKeyVN()), time: "19:00", duration: durationText(15),
        questions: 0, status: "upcoming", participants: 0, active: false, activeGuest: false, guestCanTake: false, createdAt: new Date().toLocaleDateString("vi-VN"),
        ownerId: tutorId, courseId, isDraft: true, rootExamId: null, versionNo: 1, totalPoints: 10, price: null, blueprintId, mode,
      },
    });
    let order = 1;
    for (const itemId of ids as string[]) {
      const it = byId.get(itemId)!;
      // Sao chép độc lập (sửa đề không đổi ngân hàng); chỉ giữ dấu vết nguồn ở sourceBankItemId.
      const q: QuizQuestionInput = {
        type: isQuizType(it.type) ? it.type : "MC", text: it.text, points: it.points > 0 ? it.points : 1, imageUrl: it.imageUrl,
        explanation: it.explanation, hint: it.hint,
        options: it.type === "ESSAY" ? [] : it.options.map(o => ({ text: o.text, isCorrect: o.isCorrect, subLabel: o.subLabel })),
      };
      await tx.examQuestion.create({ data: { ...questionCreateData(id, q, order++), sourceBankItemId: it.id } });
    }
    await syncQuizTotals(tx, id);
    await logChange(tx, { examId: id, rootExamId: null, actorId: tutorId, kind: "create", note: `Tạo đề nháp từ ${ids.length} câu bốc theo ma trận${blueprintId ? "" : " (không lưu ma trận)"}` });
    return id;
  });
  return { ok: true, examId, shortages };
}

// ── Mã đề ───────────────────────────────────────────────────────────────────────────────────────
/** Mã đề CON khoá nội dung: sửa/thêm/xoá/đổi thứ tự câu → 409 VARIANT_LOCKED (phải "tạo lại" mã đề từ đề gốc). */
export function variantLockedBlock(exam: { variantOfId: string | null }): NextResponse | null {
  return exam.variantOfId
    ? NextResponse.json({ error: "Đây là mã đề con, nội dung suy ra từ đề gốc nên không sửa trực tiếp. Sửa đề gốc rồi tạo lại mã đề.", code: "VARIANT_LOCKED", variantOfId: exam.variantOfId }, { status: 409 })
    : null;
}

const toKeyQuestions = (qs: Awaited<ReturnType<typeof loadQuestions>>): KeyQuestion[] => qs.map(q => ({ type: q.type, text: q.text, options: q.options.map(o => ({ text: o.text, isCorrect: o.isCorrect })) }));

export interface VariantRow { id: string; variantNo: number; code: number; questionCount: number; warnings: string[] }
async function variantView(root: OwnedQuiz) {
  const [children, qs] = await Promise.all([
    prisma.exam.findMany({ where: { variantOfId: root.id }, orderBy: { variantNo: "asc" }, select: { id: true, variantNo: true, questions: true } }),
    loadQuestions(root.id),
  ]);
  const warnings = shuffleWarnings(qs.map(q => ({ type: q.type, sectionLabel: q.sectionLabel, options: q.options })));
  const msgs = warnings.map(w => w.message);
  const variants: VariantRow[] = [
    { id: root.id, variantNo: 1, code: variantCode(1), questionCount: root.questions, warnings: msgs },
    ...children.map(c => ({ id: c.id, variantNo: c.variantNo ?? 0, code: variantCode(c.variantNo ?? 0), questionCount: c.questions, warnings: msgs })),
  ];
  return { variants, warnings, hasVariants: children.length > 0, studentSupport: VARIANT_STUDENT_SUPPORT, questionCount: qs.length };
}

export async function getVariants(tutorId: string, examId: string): Promise<Outcome<Awaited<ReturnType<typeof variantView>> & { examId: string }>> {
  const got = await loadOwnedQuiz(tutorId, examId);
  if (isNextResponse(got)) return fail(got.status, got.status === 404 ? "Không tìm thấy đề này." : "Đề này không phải của cô.");
  if (got.exam.variantOfId) return fail(400, "Đây là mã đề con. Mở đề gốc để xem các mã đề.", "IS_VARIANT", { variantOfId: got.exam.variantOfId });
  return { ok: true, examId, ...(await variantView(got.exam)) };
}

/** Khoá tư vấn theo đề gốc (cùng mẫu lockInvoice): mã đề + phát hành cùng một đề chạy lần lượt. Gọi ĐẦU giao dịch. */
export async function lockExam(tx: Prisma.TransactionClient, rootId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`exam:${rootId}`}))`;
}

export interface MakeVariantsBody { count?: unknown; shuffleQuestions?: unknown; shuffleOptions?: unknown; fixed?: unknown }

/**
 * Tạo / TẠO LẠI mã đề: xoá mã con cũ rồi dựng mới trong MỘT giao dịch. Chỉ khi đề gốc còn nháp. `count` = tổng số mã gồm cả đề gốc (2..8).
 * `fixed` = vị trí câu giữ nguyên, ĐÁNH SỐ TỪ 1 (như "Câu 1" trên màn hình).
 */
export async function makeVariants(tutorId: string, examId: string, body: MakeVariantsBody): Promise<Outcome<Awaited<ReturnType<typeof variantView>> & { examId: string }>> {
  const got = await loadOwnedQuiz(tutorId, examId);
  if (isNextResponse(got)) return fail(got.status, got.status === 404 ? "Không tìm thấy đề này." : "Đề này không phải của cô.");
  const exam = got.exam;
  if (exam.variantOfId) return fail(400, "Không tạo mã đề cho một mã đề con. Tạo từ đề gốc.", "IS_VARIANT", { variantOfId: exam.variantOfId });
  const sup = supersededBlock(exam); if (sup) return fail(409, "Đây là phiên bản cũ, chỉ để xem.", "SUPERSEDED");
  if (!exam.isDraft) return fail(409, "Đề đã phát hành nên không tạo thêm mã đề. Tạo phiên bản mới của đề rồi tạo mã đề ở bản nháp.", "NOT_DRAFT");

  const count = body.count;
  if (typeof count !== "number" || !Number.isInteger(count) || count < VARIANT_MIN || count > VARIANT_MAX) return fail(400, `Số mã đề phải từ ${VARIANT_MIN} đến ${VARIANT_MAX} (tính cả đề gốc).`, "BAD_COUNT");
  const shuffleQuestions = body.shuffleQuestions === undefined ? true : body.shuffleQuestions === true;
  const shuffleOptions = body.shuffleOptions === undefined ? true : body.shuffleOptions === true;
  if (!shuffleQuestions && !shuffleOptions) return fail(400, "Bật ít nhất một trong hai: đảo câu hoặc đảo phương án, nếu không các mã đề giống hệt nhau.", "NOTHING_TO_SHUFFLE");

  const rawFixed = body.fixed == null ? [] : body.fixed;

  // Khoá theo đề gốc: tạo mã đề / phát hành chạy lần lượt. Kiểm lại nháp + đọc lại câu BÊN TRONG giao dịch (không tin dữ liệu đọc trước khoá).
  const done = await prisma.$transaction(async tx => {
    await lockExam(tx, examId);
    const cur = await tx.exam.findUnique({ where: { id: examId }, select: { isDraft: true, supersededById: true } });
    if (!cur) return fail(404, "Không tìm thấy đề này.");
    if (cur.supersededById) return fail(409, "Đây là phiên bản cũ, chỉ để xem.", "SUPERSEDED");
    if (!cur.isDraft) return fail(409, "Đề đã phát hành nên không tạo thêm mã đề. Tạo phiên bản mới của đề rồi tạo mã đề ở bản nháp.", "NOT_DRAFT");

    const questions = await loadQuestions(examId, tx);
    if (questions.length === 0) return fail(400, "Đề chưa có câu nào để tạo mã đề.", "NO_QUESTIONS");
    if (!Array.isArray(rawFixed) || rawFixed.length > questions.length || !rawFixed.every(n => typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= questions.length)) {
      return fail(400, `Vị trí câu cố định phải là số từ 1 đến ${questions.length}.`, "BAD_FIXED");
    }
    const fixed0 = [...new Set(rawFixed as number[])].map(n => n - 1);
    const plan = buildVariantPlan(questions.map(q => ({ type: q.type, sectionLabel: q.sectionLabel, options: q.options })), { count, shuffleQuestions, shuffleOptions, fixed: fixed0, seed: randomUUID() });

    await tx.exam.deleteMany({ where: { variantOfId: examId } });
    await tx.exam.update({ where: { id: examId }, data: { variantNo: 1 } });
    for (const v of plan.variants) {
      const childId = newExamId();
      await tx.exam.create({ data: childData(exam, childId, await newExamCode(tx), v.variantNo, questions.length) });
      for (let k = 0; k < v.order.length; k++) {
        const src = questions[v.order[k]];
        const snap = toSnap(src);
        const orderOpt = v.optionOrders[v.order[k]];
        snap.options = orderOpt.map(i => snap.options[i]);
        await tx.examQuestion.create({
          data: { ...questionCreateData(childId, snap, k + 1), sourceBankItemId: src.sourceBankItemId, sectionMinutes: src.sectionMinutes },
        });
      }
    }
    await logChange(tx, { examId, rootExamId: exam.rootExamId, actorId: tutorId, kind: "variants", note: `Tạo ${count} mã đề (đảo câu: ${shuffleQuestions ? "có" : "không"}, đảo phương án: ${shuffleOptions ? "có" : "không"})` });
    return null;
  });
  if (done) return done;
  const fresh = await prisma.exam.findUniqueOrThrow({ where: { id: examId } });
  return { ok: true, examId, ...(await variantView(fresh)) };
}

function childData(root: OwnedQuiz, id: string, code: string, variantNo: number, questions: number): Prisma.ExamUncheckedCreateInput {
  return {
    id, code, title: root.title, category: QUIZ_CATEGORY, date: root.date, time: root.time, duration: root.duration, questions, status: "upcoming",
    participants: 0, active: false, activeGuest: false, guestCanTake: false, createdAt: new Date().toLocaleDateString("vi-VN"),
    ownerId: root.ownerId, courseId: root.courseId, isDraft: true, rootExamId: null, versionNo: 1, totalPoints: root.totalPoints, price: null,
    answerVisibility: root.answerVisibility, hideAnswerForWrong: root.hideAnswerForWrong, showLeaderboard: root.showLeaderboard,
    password: root.password, passwordHash: root.passwordHash, mode: root.mode, blueprintId: root.blueprintId,
    ...(root.clusterScorePercents != null ? { clusterScorePercents: root.clusterScorePercents as Prisma.InputJsonValue } : {}),
    variantOfId: root.id, variantNo,
  };
}

/**
 * Cho `publish`: các mã con của đề gốc, đã nạp câu, và các mã con còn khớp đề gốc không.
 * (Đề gốc sửa sau khi tạo mã đề → mã con cũ → VARIANTS_STALE.)
 */
export async function loadVariantGroup(rootId: string, db: Pick<typeof prisma, "exam" | "examQuestion"> = prisma) {
  const children = await db.exam.findMany({ where: { variantOfId: rootId }, select: { id: true } });
  if (children.length === 0) return { childIds: [] as string[], questionsOfChildren: [] as Awaited<ReturnType<typeof loadQuestions>>[], stale: false };
  const [rootQs, ...childQs] = await Promise.all([loadQuestions(rootId, db), ...children.map(c => loadQuestions(c.id, db))]);
  const rootKeys = toKeyQuestions(rootQs);
  return { childIds: children.map(c => c.id), questionsOfChildren: childQs, stale: childQs.some(cq => !variantMatchesRoot(rootKeys, toKeyQuestions(cq))) };
}

// ── Danh sách "Ngân hàng đề" ─────────────────────────────────────────────────────────────────────
const LIST_STATUS = ["draft", "upcoming", "available", "completed"] as const;
export async function listRootExams(tutorId: string, q: { lop?: string | null; trangThai?: string | null }) {
  if (q.trangThai && !(LIST_STATUS as readonly string[]).includes(q.trangThai)) return fail(400, "Trạng thái phải là draft, upcoming, available hoặc completed.", "BAD_STATUS");
  const exams = await prisma.exam.findMany({
    where: { ownerId: tutorId, supersededById: null, variantOfId: null, ...(q.lop ? { courseId: q.lop } : {}) },
    select: { id: true, title: true, isDraft: true, active: true, date: true, time: true, mode: true, questions: true, courseId: true, course: { select: { name: true } } },
    take: 300,
  });
  const ids = exams.map(e => e.id);
  const [kids, logs, files] = await Promise.all([
    ids.length ? prisma.exam.groupBy({ by: ["variantOfId"], where: { variantOfId: { in: ids } }, _count: { _all: true } }) : [],
    ids.length ? prisma.examChangeLog.groupBy({ by: ["examId"], where: { examId: { in: ids } }, _max: { createdAt: true } }) : [],
    ids.length ? prisma.examFile.findMany({ where: { ownerId: tutorId, extractedExamId: { in: ids } }, select: { id: true, fileName: true, extractedExamId: true } }) : [],
  ]);
  const nKids = new Map(kids.map(k => [k.variantOfId as string, k._count._all]));
  const touched = new Map(logs.map(l => [l.examId, l._max.createdAt]));
  const fileOf = new Map(files.map(f => [f.extractedExamId as string, { id: f.id, fileName: f.fileName }]));
  const items = exams
    .map(e => ({
      id: e.id, title: e.title, status: statusOf(e), mode: e.mode, variants: (nKids.get(e.id) ?? 0) > 0 ? (nKids.get(e.id) ?? 0) + 1 : 1,
      questionCount: e.questions, courseId: e.courseId, courseName: e.course?.name ?? null,
      updatedAt: (touched.get(e.id) ?? new Date(0)).toISOString(), extractedFrom: fileOf.get(e.id) ?? null,
    }))
    .filter(e => !q.trangThai || e.status === q.trangThai)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
  return { ok: true as const, items };
}

// ── Tệp đề gốc ─────────────────────────────────────────────────────────────────────────────────
/**
 * Hạn mức phân tích Word theo gia sư (bền, đếm usage_events): tối đa 20 lần/giờ → 429 RATE_LIMITED. Khoá tư vấn theo gia sư để hai yêu cầu cùng lúc không cùng lọt.
 * Gọi TRƯỚC khi đọc/tải tệp. Trả null = được phép (đã ghi một lượt).
 */
export async function reserveWordAnalysis(tutorId: string): Promise<Fail | null> {
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`wordrate:${tutorId}`}))`;
    const used = await tx.usageEvent.count({ where: { userId: tutorId, kind: WORD_ANALYSE_KIND, createdAt: { gte: new Date(Date.now() - WORD_ANALYSE_WINDOW_MS) } } });
    if (!wordAnalyseAllowed(used)) return fail(429, WORD_RATE_MESSAGE, "RATE_LIMITED");
    await tx.usageEvent.create({ data: { userId: tutorId, kind: WORD_ANALYSE_KIND, quantity: 1 } });
    return null;
  });
}

export type WordAnalysis = AzotaParse & { images: { key: string; url: string }[] };

/**
 * Bộ đọc Word dùng chung cho "Nhập Word" và "Tách tệp đề gốc": đọc docx (không AI, không nhúng), chuyển hình sang Cloudinary.
 * `TOO_MANY` → 422; lỗi tệp → 400/413.
 */
export async function analyseDocx(buf: Buffer): Promise<Outcome<{ parsed: WordAnalysis }>> {
  let read;
  try { read = await readDocx(buf); }
  catch (e) {
    if (e instanceof DocxError) return fail(e.code === "TOO_LARGE" ? 413 : 400, e.message, e.code);
    throw e;
  }
  const parsed = parseAzotaBlocks(read.blocks);
  const fst = read.formulaStats; // MathType (BU-03-MATHTYPE): chỉ ĐẾM theo nhóm lý do, không có nội dung công thức
  if (fst.total > 0) {
    parsed.formulaStats = { total: fst.total, decoded: fst.decoded, failed: fst.failed, byReason: fst.byReason, unverified: fst.unverified, image: fst.image, imageFailByReason: fst.imageFailByReason };
    parsed.stats.formulaDecoded = fst.decoded; parsed.stats.formulaFailed = fst.failed;
    if (fst.decoded > 0) parsed.warnings.unshift({ question: "", code: "mathtype_summary", message: `KiN đọc được ${fst.decoded}/${fst.total} công thức MathType; kiểm lại trước khi lưu.${fst.unverified > 0 ? ` Có ${fst.unverified} công thức dạng phức tạp (tích phân, tổng, giới hạn, vectơ, ma trận…) KiN chưa kiểm kỹ — xem lại từng cái.` : ""}` });
    if (fst.image > 0) parsed.warnings.unshift({ question: "", code: "formula_image_summary", message: `${fst.image}/${fst.total} công thức MathType hiển thị bằng ẢNH giống bản Word (KiN chưa chắc cách chuyển thành công thức gõ được). Câu vẫn dùng và phát hành được; cô có thể sửa thành công thức gõ tay nếu muốn. Chữ trên ảnh dùng font của máy người xem nên nét chữ có thể khác nhẹ so với Word.` });
    if (fst.timedOut) parsed.warnings.push({ question: "", code: "mathtype_timeout", message: "Tệp có quá nhiều công thức MathType nên KiN dừng đọc giữa chừng; các công thức còn lại giữ nhãn, cần gõ lại." });
  }
  if (read.extraImages > 0) parsed.warnings.push({ question: "", code: "too_many_images", message: `Tệp có quá ${DOCX_MAX_IMAGES} hình; ${read.extraImages} hình thừa không được lấy. Chèn lại bằng tay ở những câu còn thiếu hình.` });
  if (parsed.questions.length > AZOTA_MAX_QUESTIONS || (parsed.fatal && /quá giới hạn/.test(parsed.fatal))) return fail(422, parsed.fatal ?? `Tệp có quá ${AZOTA_MAX_QUESTIONS} câu.`, "TOO_MANY");

  // Tải hình (mỗi hình một lần dù nhiều câu dùng chung), tối đa 4 lượt song song.
  const urlByIndex = new Map<number, string>();
  const wanted = [...new Set(parsed.questions.flatMap(q => (q.imageIndex !== undefined ? [q.imageIndex] : [])))];
  let cursor = 0;
  const failed = new Set<number>();
  const worker = async () => {
    for (;;) {
      const i = wanted[cursor++];
      if (i === undefined) return;
      const b = read.images[i], mime = read.mime[i];
      if (!b || !mime || !cloudinaryServerConfigured) { failed.add(i); continue; }
      const real = imageMimeFromMagic(b); // tin byte thật, không tin đuôi tệp trong Word
      if (!real) { failed.add(i); continue; }
      try { urlByIndex.set(i, await uploadImageBufferToCloudinary(b, `word-${Date.now().toString(36)}-${i}.${real.split("/")[1].replace("jpeg", "jpg")}`, real)); }
      catch (e) { console.error("[analyseDocx] upload ảnh", e); failed.add(i); }
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);

  const images: { key: string; url: string }[] = [];
  for (const q of parsed.questions) {
    if (q.imageIndex === undefined) continue;
    const url = urlByIndex.get(q.imageIndex);
    if (url) { q.imageUrl = url; images.push({ key: q.key, url }); }
    else {
      if (!q.flags.includes("image_unreadable")) q.flags.push("image_unreadable");
      parsed.warnings.push({ question: q.key, code: "image_upload_failed", message: `Câu ${q.number}: chưa tải được hình lên. Chèn lại hình ở bước chỉnh sửa.` });
    }
    delete q.imageIndex;
  }
  return { ok: true, parsed: { ...parsed, stats: { ...parsed.stats, withImage: parsed.questions.filter(q => !!q.imageUrl).length }, images } };
}

async function loadOwnedFile(tutorId: string, fileId: string) {
  const f = await prisma.examFile.findUnique({ where: { id: fileId }, select: { id: true, fileName: true, fileUrl: true, fileType: true, ownerId: true, extractedExamId: true } });
  if (!f) return fail(404, "Không tìm thấy tệp này.");
  if (f.ownerId !== tutorId) return fail(403, "Tệp này không phải của cô.");
  return f;
}

async function downloadCapped(url: string, cap: number): Promise<Buffer | Fail> {
  let res: Response;
  try { res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(20_000), cache: "no-store" }); }
  catch { return fail(502, "Chưa tải được tệp gốc về để tách. Thử lại sau ít phút.", "FETCH_FAILED"); }
  if (!res.ok) return fail(502, "Chưa tải được tệp gốc về để tách (tệp không còn hoặc bị chuyển hướng).", "FETCH_FAILED");
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > cap) return fail(413, "Tệp Word lớn hơn 4 MB. Cô tách đề nhỏ hơn rồi tải lại nhé.", "TOO_LARGE");
  const reader = res.body?.getReader();
  if (!reader) return fail(502, "Chưa đọc được nội dung tệp gốc.", "FETCH_FAILED");
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > cap) { await reader.cancel().catch(() => {}); return fail(413, "Tệp Word lớn hơn 4 MB. Cô tách đề nhỏ hơn rồi tải lại nhé.", "TOO_LARGE"); }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/** Tách tệp đề gốc (.docx đã lưu ở Cloudinary) thành câu để xem lại. CHỈ XEM TRƯỚC, không ghi DB, không AI. */
export async function splitSourceFile(tutorId: string, fileId: string): Promise<Outcome<{ parsed: WordAnalysis }>> {
  const f = await loadOwnedFile(tutorId, fileId);
  if ("ok" in f) return f;
  if (f.extractedExamId && (await prisma.exam.findUnique({ where: { id: f.extractedExamId }, select: { id: true } }))) {
    return fail(409, "Tệp này đã được tách thành một đề rồi.", "ALREADY_EXTRACTED", { examId: f.extractedExamId });
  }
  if (!looksLikeDocx(f)) return fail(400, "Chỉ tách được tệp Word .docx. Với PDF hoặc ảnh, dùng nhập đề bằng AI.", "NOT_DOCX");
  if (!isAllowedSourceUrl(f.fileUrl)) return fail(400, "Địa chỉ tệp không nằm trong kho KiN nên không tách được.", "BAD_HOST");
  const limited = await reserveWordAnalysis(tutorId); if (limited) return limited; // 20 lần/giờ/gia sư (429 RATE_LIMITED)
  const buf = await downloadCapped(f.fileUrl, DOCX_MAX_BYTES);
  if (!Buffer.isBuffer(buf)) return buf;
  return analyseDocx(buf);
}

/** Ghi "tệp này đã tách thành đề X". Chủ cả HAI: tệp (404/403) và đề (404/403). */
export async function linkSourceFile(tutorId: string, fileId: string, examId: unknown): Promise<Outcome<{ fileId: string; examId: string }>> {
  const f = await loadOwnedFile(tutorId, fileId);
  if ("ok" in f) return f;
  if (typeof examId !== "string" || !examId) return fail(400, "Thiếu đề cần gán.", "NO_EXAM");
  const e = await prisma.exam.findUnique({ where: { id: examId }, select: { id: true, ownerId: true, variantOfId: true } });
  if (!e) return fail(404, "Không tìm thấy đề này.");
  if (e.ownerId !== tutorId) return fail(403, "Đề này không phải của cô.");
  if (e.variantOfId) return fail(400, "Gán vào đề gốc, không gán vào mã đề con.", "IS_VARIANT");
  await prisma.examFile.update({ where: { id: fileId }, data: { extractedExamId: examId } });
  return { ok: true, fileId, examId };
}

