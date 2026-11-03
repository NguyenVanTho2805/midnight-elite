// BU-03 P1 — cây ngân hàng câu hỏi của gia sư: tên tầng (Môn › Lớp › Chương › Yêu cầu cần đạt), số câu theo mức, bảng chương × mức. THUẦN: không DB, không React.
// Tầng tính từ GỐC cây thật (không phải từ nút đang xem): 0 = Môn, 1 = Lớp, 2 = Chương, 3 = Yêu cầu cần đạt, ≥4 = "Mục con".
// Ngân hàng cũ chỉ có 2 tầng: ma trận dùng "nút con trực tiếp" làm chương (xem `chapterIdsOf`).
import type { Level } from "@/lib/azotaDocx";

export const LEVEL_KEYS: readonly Level[] = ["NB", "TH", "VD", "VDC"];
export type Counts = Record<Level, number> & { none: number; total: number };
export interface TreeCat { id: string; parentId: string | null; name: string; sortOrder?: number }
/** Một dòng `groupBy(categoryId, difficulty)`: `difficulty` ngoài NB/TH/VD/VDC (hoặc null) tính vào "chưa gắn mức". */
export interface CountRow { categoryId: string; difficulty: string | null; n: number }
export interface StatNode { id: string; parentId: string | null; name: string; depth: number; label: string; own: Counts; sub: Counts }
export interface ChapterRow { chapterId: string; name: string; yccd: { id: string; name: string; counts: Counts }[]; counts: Counts }

const TIER_LABELS = ["Môn", "Lớp", "Chương", "Yêu cầu cần đạt"] as const;
export const SUB_TIER_LABEL = "Mục con";

export function levelLabel(depth: number): string {
  return Number.isInteger(depth) && depth >= 0 && depth < TIER_LABELS.length ? TIER_LABELS[depth] : SUB_TIER_LABEL;
}

export function emptyCounts(): Counts { return { NB: 0, TH: 0, VD: 0, VDC: 0, none: 0, total: 0 }; }
export function addCounts(a: Counts, b: Counts): Counts {
  return { NB: a.NB + b.NB, TH: a.TH + b.TH, VD: a.VD + b.VD, VDC: a.VDC + b.VDC, none: a.none + b.none, total: a.total + b.total };
}
function bump(c: Counts, difficulty: string | null, n: number): void {
  if (!(n > 0)) return;
  if (difficulty && (LEVEL_KEYS as readonly string[]).includes(difficulty)) c[difficulty as Level] += n; else c.none += n;
  c.total += n;
}

/** Sắp theo sortOrder rồi tên (không phân biệt hoa thường) rồi id — thứ tự ổn định cho cây. */
function byOrder(a: TreeCat, b: TreeCat): number {
  return (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name, "vi", { sensitivity: "base" }) || a.id.localeCompare(b.id);
}

/**
 * Cây theo thứ tự duyệt trước (cha rồi con). Nút mồ côi (cha không có) coi là gốc; vòng lặp parentId (dữ liệu hỏng) bị cắt — không treo, không lặp vô hạn.
 * `rootId` != null: chỉ lấy nhánh con của nút đó (gồm chính nó) nhưng `depth` vẫn tính từ gốc cây thật.
 */
export function orderedTree(cats: readonly TreeCat[], rootId: string | null = null): { cat: TreeCat; depth: number; parent: string | null }[] {
  const byId = new Map(cats.map(c => [c.id, c] as const));
  const children = new Map<string | null, TreeCat[]>();
  for (const c of cats) {
    const key = c.parentId && byId.has(c.parentId) && c.parentId !== c.id ? c.parentId : null;
    const arr = children.get(key) ?? []; arr.push(c); children.set(key, arr);
  }
  for (const arr of children.values()) arr.sort(byOrder);
  const out: { cat: TreeCat; depth: number; parent: string | null }[] = [];
  const seen = new Set<string>();
  /** `parent` = nút mà ta đi từ đó tới (cha HIỆU LỰC trong cây vừa dựng; null với gốc phạm vi / gốc cây / nút mồ côi). */
  const walk = (c: TreeCat, depth: number, parent: string | null) => {
    if (seen.has(c.id)) return;
    seen.add(c.id); out.push({ cat: c, depth, parent });
    for (const k of children.get(c.id) ?? []) walk(k, depth + 1, c.id);
  };
  // Độ sâu thật của nút `rootId` = số tổ tiên có thật.
  if (rootId !== null) {
    const start = byId.get(rootId);
    if (!start) return [];
    let depth = 0; const guard = new Set<string>([start.id]);
    for (let p = start.parentId ? byId.get(start.parentId) : undefined; p && !guard.has(p.id); p = p.parentId ? byId.get(p.parentId) : undefined) { guard.add(p.id); depth++; }
    walk(start, depth, null);
    return out;
  }
  for (const r of children.get(null) ?? []) walk(r, 0, null);
  // Nút nằm trong vòng lặp (không với tới từ gốc nào): đưa ra như gốc để vẫn hiện và vẫn đếm.
  for (const c of [...cats].sort(byOrder)) if (!seen.has(c.id)) walk(c, 0, null);
  return out;
}

/**
 * Chương của ma trận: các nút tầng 2 nếu trong phạm vi có; nếu không (ngân hàng cũ 2 tầng) thì con trực tiếp của nút gốc phạm vi
 * (không có `rootId`: các nút tầng 1). Phạm vi không có con nào → [].
 */
export function chapterIdsOf(nodes: readonly Pick<StatNode, "id" | "parentId" | "depth">[], rootId: string | null = null): string[] {
  const depth2 = nodes.filter(n => n.depth === 2).map(n => n.id);
  if (depth2.length) return depth2;
  if (rootId !== null) return nodes.filter(n => n.parentId === rootId).map(n => n.id);
  return nodes.filter(n => n.depth === 1).map(n => n.id);
}

/**
 * Thống kê một lần: `own` = câu thuộc đúng nút, `sub` = cả cây con (đã gồm own). Không truy vấn lặp (N+1): chỉ nhận sẵn `rows` (một groupBy).
 * Dòng đếm của đầu mục không nằm trong phạm vi bị bỏ qua.
 */
export function rollupChapterLevel(cats: readonly TreeCat[], rows: readonly CountRow[], rootId: string | null = null): { nodes: StatNode[]; chapterMatrix: ChapterRow[] } {
  const tree = orderedTree(cats, rootId);
  const own = new Map<string, Counts>(tree.map(t => [t.cat.id, emptyCounts()] as const));
  for (const r of rows) { const c = own.get(r.categoryId); if (c) bump(c, r.difficulty, r.n); }
  const sub = new Map<string, Counts>();
  for (const t of tree) sub.set(t.cat.id, { ...own.get(t.cat.id)! });
  // Cộng dồn từ lá lên: duyệt ngược thứ tự duyệt trước thì con luôn đứng sau cha → cha nhận đủ con trước khi nó cộng lên ông.
  for (let i = tree.length - 1; i >= 0; i--) {
    const id = tree[i].cat.id, pid = tree[i].parent;
    if (pid) sub.set(pid, addCounts(sub.get(pid)!, sub.get(id)!));
  }
  const nodes: StatNode[] = tree.map(t => ({
    id: t.cat.id, parentId: t.parent, name: t.cat.name,
    depth: t.depth, label: levelLabel(t.depth), own: own.get(t.cat.id)!, sub: sub.get(t.cat.id)!,
  }));
  const byId = new Map(nodes.map(n => [n.id, n] as const));
  const chapterMatrix: ChapterRow[] = chapterIdsOf(nodes, rootId).map(cid => {
    const ch = byId.get(cid)!;
    const yccd = nodes.filter(n => n.parentId === cid).map(n => ({ id: n.id, name: n.name, counts: n.sub }));
    return { chapterId: ch.id, name: ch.name, yccd, counts: ch.sub };
  });
  return { nodes, chapterMatrix };
}

/** Tập id của nút `rootId` và mọi nút con cháu (vòng lặp bị cắt). Không có nút → rỗng. */
export function subtreeIds(cats: readonly TreeCat[], rootId: string): string[] {
  return orderedTree(cats, rootId).map(t => t.cat.id);
}
