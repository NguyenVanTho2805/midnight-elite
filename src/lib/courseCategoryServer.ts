// CAT-02 — phần chạm CSDL của danh mục khoá học (dùng chung /api/admin/danh-muc* và /api/categories).
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { categorySlug, validateCategoryName } from "@/lib/courseCatalogAdmin";

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Đồng bộ lười: mọi Course.category chưa có dòng → tạo ở cuối theo chữ cái. Idempotent (skipDuplicates), an toàn khi gọi đồng thời.
 */
export async function syncCourseCategories(db: Db = prisma): Promise<void> {
  const [used, rows] = await Promise.all([
    db.course.groupBy({ by: ["category"] }),
    db.courseCategory.findMany({ select: { name: true, slug: true, sortOrder: true } }),
  ]);
  const have = new Set(rows.map(r => r.name));
  const slugs = new Set(rows.map(r => r.slug));
  const missing = used.map(u => u.category).filter(n => n && !have.has(n)).sort((a, b) => a.localeCompare(b, "vi"));
  if (!missing.length) return;
  let next = rows.reduce((m, r) => Math.max(m, r.sortOrder), 0) + 1;
  const data: { name: string; slug: string; sortOrder: number }[] = [];
  for (const name of missing) {
    const slug = categorySlug(name);
    if (!slug || slugs.has(slug)) continue; // trùng slug với dòng khác: để lại, API công khai vẫn liệt kê theo tên
    slugs.add(slug);
    data.push({ name, slug, sortOrder: next++ });
  }
  if (data.length) await db.courseCategory.createMany({ data, skipDuplicates: true });
}

/** Có danh mục nào (dòng khác `exceptId`, hoặc tên đang dùng trên khoá) trùng slug với `slug`? Trả tên trùng. */
export async function findCategoryConflict(slug: string, exceptId: string | null, db: Db = prisma): Promise<{ id: string | null; name: string } | null> {
  const row = await db.courseCategory.findFirst({ where: { slug, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { id: true, name: true } });
  if (row) return row;
  const used = await db.course.groupBy({ by: ["category"] });
  const own = exceptId ? (await db.courseCategory.findUnique({ where: { id: exceptId }, select: { name: true } }))?.name : null;
  const hit = used.map(u => u.category).find(n => n !== own && categorySlug(n) === slug);
  return hit ? { id: null, name: hit } : null;
}

export type RenameResult =
  | { ok: true; category: { id: string; name: string; slug: string; sortOrder: number }; renamedCourses: number; from: string }
  | { ok: false; status: 400 | 404 | 409; error: string; existing?: { id: string | null; name: string } };

/** Đổi tên trong MỘT giao dịch: dòng danh mục + mọi Course.category cũ → mới. Trùng tên → 409 (không gộp ngầm). */
export async function renameCategory(opts: { id?: string; oldName?: string; newName: unknown }): Promise<RenameResult> {
  const v = validateCategoryName(opts.newName);
  if (!v.ok) return { ok: false, status: 400, error: v.error };
  if (!opts.id) await syncCourseCategories();
  const cur = opts.id
    ? await prisma.courseCategory.findUnique({ where: { id: opts.id } })
    : await prisma.courseCategory.findUnique({ where: { name: opts.oldName ?? "" } });
  if (!cur) return { ok: false, status: 404, error: "Không tìm thấy danh mục" };
  if (cur.name === v.name) return { ok: false, status: 400, error: "Tên mới trùng tên hiện tại" };
  const clash = await findCategoryConflict(v.slug, cur.id);
  if (clash) return { ok: false, status: 409, error: "Đã có danh mục tên này", existing: clash };
  try {
    return await prisma.$transaction(async tx => {
      const upd = await tx.courseCategory.update({ where: { id: cur.id }, data: { name: v.name, slug: v.slug } });
      const r = await tx.course.updateMany({ where: { category: cur.name }, data: { category: v.name } });
      return { ok: true as const, category: { id: upd.id, name: upd.name, slug: upd.slug, sortOrder: upd.sortOrder }, renamedCourses: r.count, from: cur.name };
    });
  } catch (e) {
    if ((e as { code?: string })?.code === "P2002") return { ok: false, status: 409, error: "Đã có danh mục tên này" };
    throw e;
  }
}
