// FE-099 — đọc/ghi điểm chuẩn (Prisma). Trang công khai chỉ thấy dòng đã xuất bản; bảng trống thì dùng dữ liệu khởi đầu có sẵn.
import { prisma } from "@/lib/prisma";
import { scoreKey, type PublicScore, type ScoreInput } from "@/lib/admissionScore";
import { SEED_SCORES } from "@/lib/admissionScoreSeed";

const PUBLIC_LIMIT = 3000;

type Row = Awaited<ReturnType<typeof prisma.admissionScore.findFirstOrThrow>>;
export const toPublic = (r: Row): PublicScore => ({
  id: r.id, school: r.school, major: r.major, variant: r.variant, year: r.year, method: r.method, score: r.score, scale: r.scale,
  note: r.note || null, sourceUrl: r.sourceUrl, sourceName: r.sourceName, verified: r.verified,
});

export async function loadPublicScores(): Promise<{ rows: PublicScore[]; source: "db" | "seed" }> {
  const total = await prisma.admissionScore.count();
  if (total === 0) {
    return { source: "seed", rows: SEED_SCORES.map((s, i) => ({ id: `seed-${i + 1}`, school: s.school, major: s.major, variant: s.variant, year: s.year, method: s.method, score: s.score, scale: s.scale, note: s.note || null, sourceUrl: s.sourceUrl, sourceName: s.sourceName, verified: s.verified })) };
  }
  const rows = await prisma.admissionScore.findMany({ where: { published: true }, orderBy: [{ school: "asc" }, { major: "asc" }, { year: "desc" }], take: PUBLIC_LIMIT });
  return { source: "db", rows: rows.map(toPublic) };
}

const data = (v: ScoreInput) => ({ school: v.school, major: v.major, variant: v.variant, year: v.year, method: v.method, score: v.score, scale: v.scale, note: v.note || null, sourceUrl: v.sourceUrl, sourceName: v.sourceName, verified: v.verified, published: v.published });

type Db = Pick<typeof prisma, "admissionScore">;
/**
 * Dòng đã có cùng khoá (trường, ngành, chương trình, năm, phương thức), KHÔNG phân biệt hoa/thường.
 * Ràng buộc duy nhất của CSDL phân biệt hoa/thường nên chỉ là lưới an toàn cuối; so khớp thật làm ở đây để khớp với kiểm tra khi nhập.
 */
export async function findSameKey(db: Db, v: { school: string; major: string; variant: string; year: number; method: string }, excludeId?: string) {
  const cands = await db.admissionScore.findMany({
    where: { year: v.year, method: v.method, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true, school: true, major: true, variant: true, year: true, method: true },
  });
  const k = scoreKey(v);
  return cands.find(c => scoreKey(c) === k) ?? null;
}

/** Thêm mới hoặc cập nhật theo khoá (không phân biệt hoa/thường). Trả số dòng thêm / cập nhật. */
export async function upsertScores(rows: ScoreInput[]): Promise<{ created: number; updated: number }> {
  let created = 0, updated = 0;
  await prisma.$transaction(async tx => {
    for (const v of rows) {
      const existing = await findSameKey(tx, v);
      if (existing) { await tx.admissionScore.update({ where: { id: existing.id }, data: data(v) }); updated++; }
      else { await tx.admissionScore.create({ data: data(v) }); created++; }
    }
  });
  return { created, updated };
}

/** Chỉ thêm dòng CHƯA có (theo khoá, không phân biệt hoa/thường); dòng đã có giữ nguyên — không đè dấu "đã đối chiếu" hay chỉnh sửa của quản trị. */
export async function insertMissingScores(rows: ScoreInput[]): Promise<{ created: number; skipped: number }> {
  const have = new Set((await prisma.admissionScore.findMany({ select: { school: true, major: true, variant: true, year: true, method: true } })).map(scoreKey));
  const missing = rows.filter(r => !have.has(scoreKey(r)));
  const r = missing.length ? await prisma.admissionScore.createMany({ data: missing.map(data), skipDuplicates: true }) : { count: 0 };
  return { created: r.count, skipped: rows.length - r.count };
}

export const isUniqueViolation = (e: unknown) => (e as { code?: string } | null)?.code === "P2002";
export const rowData = data;
