// CAT-02 — quy tắc THUẦN cho danh sách khoá học + danh mục phía quản trị. Dùng chung máy chủ, trình duyệt và test:
// KHÔNG import prisma / server-only ở đây.

export type ClassStatus = "open" | "closed" | "paused";

/** Một hàng của GET /api/admin/khoa-hoc (hợp đồng mục 4.1). */
export interface CatalogRow {
  id: string; // slug
  adminId: number;
  name: string;
  adminName: string;
  category: string;
  tutor: { id: string | null; name: string };
  status: boolean;
  classStatus: ClassStatus;
  enrolled: number;
  capacity: number | null;
  price: number;
  createdAt: string;
}

export interface CatalogFacets {
  categories: { name: string; count: number }[];
  tutors: { id: string | null; name: string; count: number }[];
  shown: number;
  hidden: number;
}

export interface CatalogFilter {
  q?: string;
  category?: string;
  /** id gia sư; "center" = khoá của trung tâm (không có chủ). */
  tutor?: string;
  visibility?: "shown" | "hidden";
  classStatus?: ClassStatus;
  /** "free" = price 0 (Miễn phí), "paid" = price > 0. */
  fee?: "free" | "paid";
}

export const CENTER_LABEL = "Trung tâm";
export const BULK_MAX_IDS = 100;
export const CATEGORY_NAME_MAX = 60;

/** Bỏ dấu tiếng Việt + chữ thường, dùng để tìm kiếm và so trùng. */
export function foldVi(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "d").toLowerCase();
}

/** "ĐGNL HSA" → "dgnl-hsa". Tên chỉ khác dấu/hoa thường cho cùng slug. Trả "" nếu không còn ký tự a-z0-9 (người gọi phải từ chối). */
export function categorySlug(name: string): string {
  return foldVi(name).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Kiểm tên danh mục: cắt khoảng trắng, 1–60 ký tự, không ký tự điều khiển, phải có ít nhất một chữ/số (để có slug). */
export function validateCategoryName(raw: unknown): { ok: true; name: string; slug: string } | { ok: false; error: string } {
  if (typeof raw !== "string") return { ok: false, error: "Tên danh mục không hợp lệ" };
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name) return { ok: false, error: "Tên danh mục không được để trống" };
  if ([...name].length > CATEGORY_NAME_MAX) return { ok: false, error: `Tên danh mục tối đa ${CATEGORY_NAME_MAX} ký tự` };
  if (/[\u0000-\u001f\u007f-\u009f]/.test(name)) return { ok: false, error: "Tên danh mục có ký tự không hợp lệ" };
  const slug = categorySlug(name);
  if (!slug) return { ok: false, error: "Tên danh mục cần có ít nhất một chữ hoặc số" };
  return { ok: true, name, slug };
}

export function filterRows(rows: CatalogRow[], f: CatalogFilter): CatalogRow[] {
  const q = f.q ? foldVi(f.q.trim()) : "";
  return rows.filter(r => {
    if (q && !(foldVi(r.name).includes(q) || foldVi(r.adminName).includes(q) || foldVi(r.id).includes(q))) return false;
    if (f.category && r.category !== f.category) return false;
    if (f.tutor) {
      if (f.tutor === "center" ? r.tutor.id !== null : r.tutor.id !== f.tutor) return false;
    }
    if (f.visibility === "shown" && !r.status) return false;
    if (f.visibility === "hidden" && r.status) return false;
    if (f.classStatus && r.classStatus !== f.classStatus) return false;
    if (f.fee === "free" && r.price !== 0) return false;
    if (f.fee === "paid" && r.price === 0) return false;
    return true;
  });
}

export function buildFacets(rows: CatalogRow[]): CatalogFacets {
  const cats = new Map<string, number>();
  const tutors = new Map<string, { id: string | null; name: string; count: number }>();
  let shown = 0, hidden = 0;
  for (const r of rows) {
    cats.set(r.category, (cats.get(r.category) ?? 0) + 1);
    const key = r.tutor.id ?? "";
    const t = tutors.get(key);
    if (t) t.count++;
    else tutors.set(key, { id: r.tutor.id, name: r.tutor.id === null ? CENTER_LABEL : r.tutor.name, count: 1 });
    if (r.status) shown++; else hidden++;
  }
  return {
    categories: [...cats].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name, "vi")),
    tutors: [...tutors.values()].sort((a, b) => a.name.localeCompare(b.name, "vi")),
    shown, hidden,
  };
}

// ── Hàng loạt (mục 4.2) ────────────────────────────────────────────────────────────────────────
export type BulkAction = { action: "set_status"; status: boolean } | { action: "set_category"; category: string };
export interface BulkActor { adminRole: "admin_super" | "admin_content" | "teacher" | undefined; userId: string }
export interface BulkRowIn { id: string; ownerId: string | null; status: boolean; category: string }
export type SkipReason = "not_owner" | "not_found" | "no_change";
export interface BulkPlan {
  updated: { id: string; prev: { status: boolean; category: string } }[];
  skipped: { id: string; reason: SkipReason }[];
}
export type BulkPlanResult = ({ ok: true } & BulkPlan) | { ok: false; status: 400 | 403; error: string };

/** Kiểm đầu vào ids: mảng chuỗi 1..100, bỏ trùng giữ thứ tự. */
export function normalizeBulkIds(ids: unknown): { ok: true; ids: string[] } | { ok: false; error: string } {
  if (!Array.isArray(ids) || ids.length === 0) return { ok: false, error: "Chưa chọn khoá học nào" };
  if (ids.length > BULK_MAX_IDS) return { ok: false, error: `Mỗi lần chỉ đổi tối đa ${BULK_MAX_IDS} khoá` };
  if (ids.some(i => typeof i !== "string" || !i || i.length > 120)) return { ok: false, error: "Mã khoá học không hợp lệ" };
  return { ok: true, ids: [...new Set(ids as string[])] };
}

/**
 * Tách lô thành `updated` / `skipped`. Gia sư: khoá không của mình → skipped:not_owner (không 403 cả lô);
 * set_category dành cho gia sư → 403 (cả lô). Khoá đã đúng giá trị → no_change. Không có trong `found` → not_found.
 */
export function planBulk(ids: string[], found: BulkRowIn[], act: BulkAction, actor: BulkActor): BulkPlanResult {
  const norm = normalizeBulkIds(ids);
  if (!norm.ok) return { ok: false, status: 400, error: norm.error };
  if (act.action === "set_status") {
    if (typeof act.status !== "boolean") return { ok: false, status: 400, error: "Trạng thái hiển thị không hợp lệ" };
  } else if (act.action === "set_category") {
    if (actor.adminRole === "teacher") return { ok: false, status: 403, error: "Chỉ quản trị viên được đổi danh mục hàng loạt" };
    const c = typeof act.category === "string" ? act.category.trim() : "";
    if (!c || [...c].length > CATEGORY_NAME_MAX) return { ok: false, status: 400, error: "Tên danh mục không hợp lệ" };
  } else {
    return { ok: false, status: 400, error: "Thao tác hàng loạt không hợp lệ" };
  }
  const byId = new Map(found.map(r => [r.id, r]));
  const out: BulkPlan = { updated: [], skipped: [] };
  for (const id of norm.ids) {
    const r = byId.get(id);
    if (!r) { out.skipped.push({ id, reason: "not_found" }); continue; }
    if (actor.adminRole === "teacher" && r.ownerId !== actor.userId) { out.skipped.push({ id, reason: "not_owner" }); continue; }
    const same = act.action === "set_status" ? r.status === act.status : r.category === act.category.trim();
    if (same) { out.skipped.push({ id, reason: "no_change" }); continue; }
    out.updated.push({ id, prev: { status: r.status, category: r.category } });
  }
  return { ok: true, ...out };
}

// ── Thứ tự danh mục (mục 4.5) ──────────────────────────────────────────────────────────────────
export type OrderCheck = { ok: true } | { ok: false; status: 400 | 409; error: string };
/** `ids` phải đúng bằng tập `currentIds` (không thiếu, không thừa, không trùng). Trùng → 400; lệch tập → 409. */
export function validateOrderIds(ids: unknown, currentIds: string[]): OrderCheck {
  if (!Array.isArray(ids) || ids.some(i => typeof i !== "string")) return { ok: false, status: 400, error: "Danh sách thứ tự không hợp lệ" };
  const list = ids as string[];
  if (new Set(list).size !== list.length) return { ok: false, status: 400, error: "Danh sách thứ tự bị trùng danh mục" };
  const cur = new Set(currentIds);
  if (list.length !== cur.size || list.some(i => !cur.has(i))) return { ok: false, status: 409, error: "Danh sách vừa đổi, đã tải lại" };
  return { ok: true };
}
