// Phần chạm DB / tệp của nhập hàng loạt (LO-06, LO-17). Đọc thân yêu cầu (JSON hoặc tệp), dựng ngữ cảnh theo gia sư, xem trước, ghi.
// Quy tắc đồng ý: studentImport.ts + consentPolicy.ts. Nhập hàng loạt BẮT BUỘC có hộp xác nhận của gia sư, ghi vết theo lần nhập (batchId).
import Papa from "papaparse";
import { prisma } from "@/lib/prisma";
import { normalizeKey } from "@/lib/tutorArea";
import { isAgeGroup, type AgeGroup, type ConsentParty } from "@/lib/consentPolicy";
import { IMPORT_TEXT_MAX, parseScheduleImport, parseStudentImport, type ImportContext } from "@/lib/studentImport";
import { importMaxRows } from "@/lib/studentProfile";

export const FILE_MAX_BYTES = 1_000_000;
const XLSX_UNCOMPRESSED_MAX = 20_000_000;
const XLSX_ENTRIES_MAX = 300;

/** Tổng dung lượng SAU KHI GIẢI NÉN của tệp zip (xlsx) theo thư mục trung tâm — chặn "bom nén" trước khi nạp vào exceljs. null = không đọc được. */
export function zipUncompressedTotal(buf: Uint8Array): { total: number; entries: number } | null {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) return null;
  const n = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true), total = 0, seen = 0;
  while (seen < n && p + 46 <= buf.length && dv.getUint32(p, true) === 0x02014b50) {
    total += dv.getUint32(p + 24, true);
    p += 46 + dv.getUint16(p + 28, true) + dv.getUint16(p + 30, true) + dv.getUint16(p + 32, true);
    seen++;
  }
  return seen === n ? { total, entries: n } : null;
}

const cellText = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return `${String(v.getUTCDate()).padStart(2, "0")}/${String(v.getUTCMonth() + 1).padStart(2, "0")}/${v.getUTCFullYear()}`;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("result" in o) return cellText(o.result);           // công thức: lấy KẾT QUẢ, không bao giờ chạy lại
    if ("richText" in o && Array.isArray(o.richText)) return (o.richText as { text?: string }[]).map(r => r.text ?? "").join("");
    if ("text" in o) return cellText(o.text);
    return "";
  }
  return String(v);
};

/** Tệp .xlsx → chữ CSV (trang tính đầu tiên). Ném Error có thông điệp tiếng Việt khi tệp không dùng được. */
export async function xlsxToCsv(buf: Uint8Array, maxRows: number): Promise<string> {
  const z = zipUncompressedTotal(buf);
  if (!z || z.total > XLSX_UNCOMPRESSED_MAX || z.entries > XLSX_ENTRIES_MAX) throw new Error("Tệp Excel không đọc được hoặc quá lớn. Hãy lưu lại thành CSV rồi chọn lại.");
  const mod = await import("exceljs");
  const { Workbook } = (mod as unknown as { default?: typeof mod }).default ?? mod;
  const wb = new Workbook();
  try { await wb.xlsx.load(buf as unknown as ArrayBuffer); } catch { throw new Error("Tệp Excel không đọc được. Hãy lưu lại thành CSV rồi chọn lại."); }
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("Tệp Excel không có trang tính nào.");
  const rows: string[][] = [];
  const cap = maxRows + 5;
  ws.eachRow({ includeEmpty: false }, (row, rn) => {
    if (rows.length > cap + 2) return;
    const cells: string[] = [];
    const lim = Math.min(row.cellCount, 40);
    for (let c = 1; c <= lim; c++) cells.push(cellText(row.getCell(c).value));
    void rn;
    rows.push(cells);
  });
  return Papa.unparse(rows, { delimiter: ",", newline: "\n" });
}

export type ImportKind = "hoc-sinh" | "lich";
export interface ImportRequest { kind: ImportKind; text: string; defaultGroup: AgeGroup; courseId: string | null; status: "active" | "inactive" | "waitlist" | undefined; attest: Record<string, unknown> | null; skipErrors: boolean; fromFile: boolean }

/** Đọc thân JSON hoặc multipart (có tệp). Lỗi → { error, status }. */
export async function readImportRequest(req: Request): Promise<ImportRequest | { error: string; status: number }> {
  const ct = req.headers.get("content-type") ?? "";
  let b: Record<string, unknown> = {};
  let text = "";
  let fromFile = false;
  if (ct.includes("multipart/form-data")) {
    const fd = await req.formData().catch(() => null);
    if (!fd) return { error: "Không đọc được tệp gửi lên", status: 400 };
    for (const [k, v] of fd.entries()) if (typeof v === "string") b[k] = v;
    if (typeof b.attest === "string") { try { b.attest = JSON.parse(b.attest); } catch { b.attest = null; } }
    const f = fd.get("file");
    if (f && typeof f !== "string") {
      fromFile = true;
      if (f.size > FILE_MAX_BYTES) return { error: "Tệp quá lớn (tối đa 1 MB).", status: 413 };
      const name = (f.name ?? "").toLowerCase();
      const buf = new Uint8Array(await f.arrayBuffer());
      if (name.endsWith(".xlsx")) {
        try { text = await xlsxToCsv(buf, importMaxRows()); } catch (e) { return { error: (e as Error).message, status: 400 }; }
      } else if (name.endsWith(".xls")) return { error: "Tệp .xls (Excel cũ) chưa đọc được. Hãy lưu thành .xlsx hoặc CSV.", status: 400 };
      else if (/\.(csv|tsv|txt)$/.test(name)) text = new TextDecoder("utf-8").decode(buf);
      else return { error: "Chỉ nhận tệp .csv, .tsv, .txt hoặc .xlsx.", status: 400 };
    }
  } else {
    b = (await req.json().catch(() => null)) as Record<string, unknown> | null ?? {};
  }
  if (!fromFile) text = typeof b.text === "string" ? b.text : "";
  if (text.length > IMPORT_TEXT_MAX) return { error: "Danh sách quá dài.", status: 413 };
  const kind: ImportKind = b.kind === "lich" ? "lich" : "hoc-sinh";
  const status = b.status === "waitlist" || b.status === "inactive" || b.status === "active" ? b.status : undefined;
  return {
    kind, text, defaultGroup: isAgeGroup(b.defaultGroup) ? b.defaultGroup : "7to15", courseId: typeof b.courseId === "string" && b.courseId ? b.courseId : null,
    status, attest: b.attest && typeof b.attest === "object" ? b.attest as Record<string, unknown> : null, skipErrors: b.skipErrors === true || b.skipErrors === "true", fromFile,
  };
}

export async function buildContext(tutorId: string, r: ImportRequest, now: Date): Promise<{ ctx: ImportContext; courses: Map<string, string> } | { error: string; status: number }> {
  const [courses, defs] = await Promise.all([
    prisma.course.findMany({ where: { ownerId: tutorId }, select: { id: true, name: true, adminName: true } }),
    prisma.studentFieldDef.findMany({ where: { tutorId }, select: { id: true, label: true } }),
  ]);
  const courseByKey = new Map<string, string>();
  for (const c of courses) { courseByKey.set(normalizeKey(c.name), c.id); courseByKey.set(normalizeKey(c.adminName), c.id); }
  if (r.courseId && !courses.some(c => c.id === r.courseId)) return { error: "Lớp này không thuộc về bạn", status: 403 };
  const customByKey = new Map(defs.map(d => [normalizeKey(d.label), d.id]));
  return {
    ctx: { defaultGroup: r.defaultGroup, customByKey, courseByKey, defaultCourseId: r.courseId, defaultStatus: r.status, now, maxRows: importMaxRows() },
    courses: new Map(courses.map(c => [c.id, c.name])),
  };
}

export { parseScheduleImport, parseStudentImport };
export type { ConsentParty };
