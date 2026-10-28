// NC2-050 — đọc / ghi công thức tính điểm (Prisma). Trang công khai chỉ thấy công thức ĐÃ XUẤT BẢN và CÓ đường dẫn nguồn; JSON trong CSDL được kiểm lại khi đọc
// (dữ liệu hỏng / sửa tay trong CSDL thì bỏ qua công thức đó, không làm sập trang).
import { prisma } from "@/lib/prisma";
import { parseFormulaInput, type FormulaValue, type PublicFormula } from "@/lib/admissionFormula";

type Row = Awaited<ReturnType<typeof prisma.admissionFormula.findFirstOrThrow>>;

/** Dòng CSDL → giá trị đã kiểm; null nếu dữ liệu trong CSDL không còn hợp lệ. */
export function rowToValue(r: Row): FormulaValue | null {
  const p = parseFormulaInput({
    name: r.name, school: r.school, year: r.year, scale: r.scale, inputs: r.inputs, multiplier: r.multiplier, bonuses: r.bonuses,
    note: r.note ?? "", sourceUrl: r.sourceUrl, sourceName: r.sourceName, verified: r.verified, published: r.published,
  }, new Date(Date.now() + 366 * 86_400_000));
  return p.ok ? p.value : null;
}

export const toPublic = (id: string, v: FormulaValue): PublicFormula => ({
  id, name: v.name, school: v.school, year: v.year, scale: v.scale, inputs: v.inputs, multiplier: v.multiplier, bonuses: v.bonuses,
  note: v.note || null, sourceUrl: v.sourceUrl, sourceName: v.sourceName, verified: v.verified,
});

export async function loadPublicFormulas(): Promise<PublicFormula[]> {
  const rows = await prisma.admissionFormula.findMany({ where: { published: true, NOT: { sourceUrl: "" } }, orderBy: [{ school: "asc" }, { name: "asc" }], take: 200 });
  const out: PublicFormula[] = [];
  for (const r of rows) { const v = rowToValue(r); if (v && v.published && v.sourceUrl) out.push(toPublic(r.id, v)); }
  return out;
}

export const formulaData = (v: FormulaValue) => ({
  name: v.name, school: v.school, year: v.year, scale: v.scale, inputs: v.inputs as unknown as object[], multiplier: v.multiplier, bonuses: v.bonuses as unknown as object[],
  note: v.note || null, sourceUrl: v.sourceUrl, sourceName: v.sourceName, verified: v.verified, published: v.published,
});
