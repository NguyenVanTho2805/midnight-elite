// BU-03 P2 — ma trận đề và bốc câu. THUẦN (không prisma, không next): chạy được bằng tsx với DATABASE_URL giả (t-blueprint-lib).
// Luật: PRNG có hạt (cùng hạt → cùng kết quả); mỗi câu dùng MỘT lần qua mọi dòng; bỏ trùng theo contentHash; dòng khó nhất bốc trước;
// thiếu câu thì BÁO (không tự hạ mức); `locked` (giữ lại khi bốc lại) và `exclude` (đã bỏ) luôn được tôn trọng. "Bốc lại" = hạt mới.
import type { Level } from "@/lib/azotaDocx";

export const LEVELS: readonly Level[] = ["NB", "TH", "VD", "VDC"];
/** Giới hạn cứng (đặc tả Q5). */
export const BLUEPRINT_MAX_ROWS = 50;
export const BLUEPRINT_ROW_MAX_COUNT = 100;
export const BLUEPRINT_MAX_TOTAL = 200;
export const BLUEPRINT_NAME_MAX = 100;

export interface BlueprintRow { categoryId: string; difficulty: Level; count: number }
export interface PoolItem { id: string; categoryId: string; difficulty: Level | null; contentHash: string }
export interface CatRef { id: string; parentId: string | null }
export interface Shortage { rowIndex: number; need: number; have: number; categoryId: string; difficulty: Level }
export interface DrawInput {
  rows: BlueprintRow[]; pool: PoolItem[]; categories: CatRef[]; seed: string;
  /** Câu đã bỏ — không bao giờ được bốc. */
  exclude?: readonly string[];
  /** Câu giữ lại khi bốc lại: được xếp vào dòng khớp trước, rồi mới bốc phần còn thiếu. */
  locked?: readonly string[];
}
export interface DrawResult { picks: { rowIndex: number; itemIds: string[] }[]; shortages: Shortage[]; seed: string }

export const isLevel = (v: unknown): v is Level => typeof v === "string" && (LEVELS as readonly string[]).includes(v);

// ── Kiểm ma trận (đọc dữ liệu không tin cậy) ─────────────────────────────────────────────────────
export type RowsCheck = { ok: true; rows: BlueprintRow[]; total: number } | { ok: false; error: string; code: string };

/** Chỉ giữ ĐÚNG ba khoá categoryId/difficulty/count; khoá lạ bị bỏ. Vi phạm Q5 → lỗi (không cắt âm thầm). */
export function validateBlueprintRows(raw: unknown): RowsCheck {
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, code: "EMPTY", error: "Ma trận chưa có dòng nào. Thêm ít nhất một dòng (yêu cầu cần đạt × mức × số câu)." };
  if (raw.length > BLUEPRINT_MAX_ROWS) return { ok: false, code: "TOO_MANY_ROWS", error: `Ma trận tối đa ${BLUEPRINT_MAX_ROWS} dòng.` };
  const rows: BlueprintRow[] = [];
  let total = 0;
  for (let i = 0; i < raw.length; i++) {
    const r = raw[i] as Record<string, unknown> | null;
    if (!r || typeof r !== "object") return { ok: false, code: "BAD_ROW", error: `Dòng ${i + 1} không đọc được.` };
    const categoryId = typeof r.categoryId === "string" ? r.categoryId.trim() : "";
    if (!categoryId) return { ok: false, code: "BAD_ROW", error: `Dòng ${i + 1}: chọn nút ngân hàng (chương/yêu cầu cần đạt).` };
    const difficulty = typeof r.difficulty === "string" ? r.difficulty.trim().toUpperCase() : "";
    if (!isLevel(difficulty)) return { ok: false, code: "BAD_ROW", error: `Dòng ${i + 1}: mức phải là NB, TH, VD hoặc VDC.` };
    const count = r.count;
    if (typeof count !== "number" || !Number.isInteger(count) || count < 1 || count > BLUEPRINT_ROW_MAX_COUNT) {
      return { ok: false, code: "BAD_ROW", error: `Dòng ${i + 1}: số câu phải là số nguyên từ 1 đến ${BLUEPRINT_ROW_MAX_COUNT}.` };
    }
    total += count;
    rows.push({ categoryId, difficulty, count });
  }
  if (total > BLUEPRINT_MAX_TOTAL) return { ok: false, code: "TOO_MANY_TOTAL", error: `Tổng số câu của ma trận tối đa ${BLUEPRINT_MAX_TOTAL} (hiện ${total}).` };
  return { ok: true, rows, total };
}

export function normalizeBlueprintName(raw: unknown): { ok: true; name: string } | { ok: false; error: string } {
  const name = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
  if (!name) return { ok: false, error: "Cô đặt tên cho ma trận trước nhé." };
  if (name.length > BLUEPRINT_NAME_MAX) return { ok: false, error: `Tên ma trận tối đa ${BLUEPRINT_NAME_MAX} ký tự.` };
  return { ok: true, name };
}

/** Đọc cột Json `rows` từ DB về BlueprintRow[] (dòng hỏng bị bỏ — dữ liệu cũ/sửa tay không làm sập màn). */
export function rowsFromJson(raw: unknown): BlueprintRow[] {
  if (!Array.isArray(raw)) return [];
  const out: BlueprintRow[] = [];
  for (const r of raw) {
    const o = r as Record<string, unknown> | null;
    if (o && typeof o.categoryId === "string" && isLevel(o.difficulty) && typeof o.count === "number" && Number.isInteger(o.count) && o.count > 0) {
      out.push({ categoryId: o.categoryId, difficulty: o.difficulty, count: o.count });
    }
  }
  return out;
}

// ── PRNG có hạt ───────────────────────────────────────────────────────────────────────────────
function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return (h ^= h >>> 16) >>> 0; };
}
function mulberry32(a: number): () => number {
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** Hàm ngẫu nhiên [0,1) xác định theo `seed`. */
export function makeRng(seed: string): () => number { return mulberry32(xmur3(seed)()); }

/** Fisher–Yates trên bản sao, theo `rng`. */
export function shuffleSeeded<T>(arr: readonly T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ── Cây ───────────────────────────────────────────────────────────────────────────────────────
/** Nút + mọi nút con (cắt vòng lặp parentId của dữ liệu hỏng). Nút không có trong `categories` → chỉ chính nó. */
export function expandSubtree(categoryId: string, categories: readonly CatRef[]): string[] {
  const kids = new Map<string, string[]>();
  for (const c of categories) if (c.parentId && c.parentId !== c.id) { const a = kids.get(c.parentId) ?? []; a.push(c.id); kids.set(c.parentId, a); }
  const out: string[] = [], seen = new Set<string>();
  const stack = [categoryId];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id); out.push(id);
    for (const k of kids.get(id) ?? []) stack.push(k);
  }
  return out;
}

const HARDNESS: Record<Level, number> = { NB: 0, TH: 1, VD: 2, VDC: 3 };
/** Thứ tự xử lý dòng: mức khó trước; cùng mức giữ thứ tự dòng. */
function rowOrder(rows: readonly BlueprintRow[]): number[] {
  return rows.map((_, i) => i).sort((a, b) => HARDNESS[rows[b].difficulty] - HARDNESS[rows[a].difficulty] || a - b);
}

function subtreeSets(rows: readonly BlueprintRow[], categories: readonly CatRef[]): Set<string>[] {
  const cache = new Map<string, Set<string>>();
  return rows.map(r => {
    let s = cache.get(r.categoryId);
    if (!s) { s = new Set(expandSubtree(r.categoryId, categories)); cache.set(r.categoryId, s); }
    return s;
  });
}

const byId = (a: PoolItem, b: PoolItem) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * Bốc câu theo ma trận. Kết quả KHÔNG phụ thuộc thứ tự `pool` (ứng viên được sắp theo id trước khi trộn bằng hạt).
 * Câu `contentHash` rỗng được coi là duy nhất (không bị gộp nhầm với nhau).
 */
export function drawFromBlueprint(input: DrawInput): DrawResult {
  const { rows, categories, seed } = input;
  const excluded = new Set(input.exclude ?? []);
  const subtrees = subtreeSets(rows, categories);
  const pool = input.pool.filter(p => !excluded.has(p.id)).sort(byId);
  const matches = (p: PoolItem, ri: number) => p.difficulty === rows[ri].difficulty && subtrees[ri].has(p.categoryId);

  const picked: string[][] = rows.map(() => []);
  const used = new Set<string>();
  const usedHash = new Set<string>();
  const take = (p: PoolItem, ri: number) => { picked[ri].push(p.id); used.add(p.id); if (p.contentHash) usedHash.add(p.contentHash); };
  const order = rowOrder(rows);

  // 1) Câu giữ lại vào dòng khớp đầu tiên (theo thứ tự xử lý) còn chỗ.
  const lockedItems = (input.locked ?? []).map(id => pool.find(p => p.id === id)).filter((p): p is PoolItem => !!p);
  const lockedSeen = new Set<string>();
  for (const p of lockedItems) {
    if (lockedSeen.has(p.id)) continue;
    lockedSeen.add(p.id);
    if (p.contentHash && usedHash.has(p.contentHash)) continue;
    const ri = order.find(i => picked[i].length < rows[i].count && matches(p, i));
    if (ri !== undefined) take(p, ri);
  }

  // 2) Bốc phần còn thiếu, dòng khó trước, mỗi dòng một dòng PRNG riêng theo (hạt, chỉ số dòng).
  const shortages: Shortage[] = [];
  for (const ri of order) {
    const need = rows[ri].count - picked[ri].length;
    if (need > 0) {
      const cands = pool.filter(p => !used.has(p.id) && matches(p, ri));
      const shuffled = shuffleSeeded(cands, makeRng(`${seed}|row|${ri}`));
      for (const p of shuffled) {
        if (picked[ri].length >= rows[ri].count) break;
        if (used.has(p.id) || (p.contentHash && usedHash.has(p.contentHash))) continue;
        take(p, ri);
      }
    }
    if (picked[ri].length < rows[ri].count) shortages.push({ rowIndex: ri, need: rows[ri].count, have: picked[ri].length, categoryId: rows[ri].categoryId, difficulty: rows[ri].difficulty });
  }
  shortages.sort((a, b) => a.rowIndex - b.rowIndex);
  return { picks: rows.map((_, rowIndex) => ({ rowIndex, itemIds: picked[rowIndex] })), shortages, seed };
}

export interface SwapInput {
  itemId: string; rowIndex: number;
  rows: BlueprintRow[]; pool: PoolItem[]; categories: CatRef[]; seed: string;
  /** Mọi câu đang được bốc của cả đề (kể cả `itemId`). */
  current: readonly string[];
  exclude?: readonly string[];
}

/** Đổi MỘT câu trong dòng `rowIndex` sang câu khác cùng ô (chưa dùng, không bị bỏ, không trùng nội dung với bất kỳ câu đang có). */
export function swapOne(input: SwapInput): { itemId: string } | { code: "NO_ALTERNATIVE" } {
  const { rows, rowIndex, itemId } = input;
  const row = rows[rowIndex];
  if (!row) return { code: "NO_ALTERNATIVE" };
  const subtree = new Set(expandSubtree(row.categoryId, input.categories));
  const excluded = new Set(input.exclude ?? []);
  const current = new Set(input.current);
  current.add(itemId);
  const hashOf = new Map(input.pool.map(p => [p.id, p.contentHash] as const));
  const blockedHash = new Set<string>();
  for (const id of current) { const h = hashOf.get(id); if (h) blockedHash.add(h); }
  const cands = input.pool
    .filter(p => !current.has(p.id) && !excluded.has(p.id) && p.difficulty === row.difficulty && subtree.has(p.categoryId) && !(p.contentHash && blockedHash.has(p.contentHash)))
    .sort(byId);
  if (cands.length === 0) return { code: "NO_ALTERNATIVE" };
  return { itemId: shuffleSeeded(cands, makeRng(`${input.seed}|swap|${itemId}`))[0].id };
}

/**
 * Với một ma trận đã lưu và danh sách câu cuối cùng (gia sư có thể đã đổi/thêm tay): ô nào còn thiếu câu khớp?
 * Xếp tham lam, dòng khó trước: mỗi câu vào dòng khớp đầu tiên còn chỗ. Câu không khớp dòng nào (thêm tay) không bị tính là lỗi.
 */
export function shortagesForSelection(rows: readonly BlueprintRow[], items: readonly { id: string; categoryId: string; difficulty: Level | null }[], categories: readonly CatRef[]): Shortage[] {
  const subtrees = subtreeSets(rows, categories);
  const have = rows.map(() => 0);
  const order = rowOrder(rows);
  for (const it of items) {
    const ri = order.find(i => have[i] < rows[i].count && it.difficulty === rows[i].difficulty && subtrees[i].has(it.categoryId));
    if (ri !== undefined) have[ri]++;
  }
  return rows.flatMap((r, rowIndex) => (have[rowIndex] < r.count ? [{ rowIndex, need: r.count, have: have[rowIndex], categoryId: r.categoryId, difficulty: r.difficulty }] : []));
}
