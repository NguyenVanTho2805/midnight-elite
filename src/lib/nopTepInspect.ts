// BU-HS-NOP-TEP — kiểm NỘI DUNG THẬT của tệp bài nộp (docx = zip, pdf) theo byte, không tin đuôi tên hay MIME trình duyệt khai.
// THUẦN (không DB, không mạng, không fs) nhưng dùng node:zlib nên CHỈ import từ máy chủ / test — thành phần trình duyệt chỉ import nopTep.ts.
// Không có thư viện zip: đọc THƯ MỤC TRUNG TÂM của zip (EOCD ở cuối tệp) bằng DataView. Chỉ giải nén đúng một mục nhỏ ([Content_Types].xml, trần 64 KB đầu ra);
// mọi mục khác chỉ đọc kích thước KHAI trong thư mục, không bao giờ giải nén ⇒ zip bomb không có gì để nổ.
// Hạn chế nói thẳng (spec mục 6): đây KHÔNG phải quét virus. PDF giấu lệnh trong luồng nén, hay docx khai thác lỗ hổng trình đọc Word, không bị bắt.
import { inflateRawSync } from "node:zlib";
import { NOP_TEP_ERRORS, type NopTepErrorCode } from "./nopTep";

export type InspectResult = { ok: true } | { ok: false; code: NopTepErrorCode; error: string };
const bad = (code: NopTepErrorCode): InspectResult => ({ ok: false, code, error: NOP_TEP_ERRORS[code] });
const OK: InspectResult = { ok: true };

export const DOCX_MAX_ENTRIES = 2000;
export const DOCX_MAX_TOTAL_UNCOMPRESSED = 100 * 1024 * 1024;
export const DOCX_MAX_ENTRY_UNCOMPRESSED = 50 * 1024 * 1024;
export const DOCX_MAX_RATIO = 200;
/** Tỉ số nén chỉ xét với mục lớn hơn mức này: mục nhỏ không thể gây hại (đã có trần tổng và trần từng mục) mà XML Word lặp nhiều có thể nén > 200 lần một cách hợp lệ. */
export const DOCX_RATIO_MIN_BYTES = 64 * 1024;
export const DOCX_CONTENT_TYPES_MAX = 64 * 1024;

const u16 = (b: Uint8Array, o: number): number => b[o] | (b[o + 1] << 8);
const u32 = (b: Uint8Array, o: number): number => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
const latin1 = (b: Uint8Array, s: number, e: number): string => Buffer.from(b.buffer, b.byteOffset + s, e - s).toString("latin1");
const startsWith = (b: Uint8Array, sig: number[]): boolean => b.length >= sig.length && sig.every((v, i) => b[i] === v);

interface ZipEntry { name: string; flags: number; method: number; comp: number; uncomp: number; lho: number }

/** Đọc danh mục zip; null = hỏng/cụt/không phải zip/zip64. Không ném lỗi. */
function readCentralDirectory(b: Uint8Array): { entries: ZipEntry[]; total: number } | "too_many" | null {
  if (b.length < 22) return null;
  const minPos = Math.max(0, b.length - 22 - 0xffff);
  let eocd = -1;
  for (let i = b.length - 22; i >= minPos; i--) {
    if (b[i] === 0x50 && b[i + 1] === 0x4b && b[i + 2] === 0x05 && b[i + 3] === 0x06) { eocd = i; break; }
  }
  if (eocd < 0) return null;
  const total = u16(b, eocd + 10), cdSize = u32(b, eocd + 12), cdOff = u32(b, eocd + 16), commentLen = u16(b, eocd + 20);
  if (total === 0xffff || cdSize === 0xffffffff || cdOff === 0xffffffff) return null; // zip64: một bài nộp dưới 10 MB không cần
  if (eocd + 22 + commentLen > b.length) return null;
  if (total > DOCX_MAX_ENTRIES) return "too_many";
  if (cdOff + cdSize > eocd || cdOff > b.length) return null;
  const entries: ZipEntry[] = [];
  let p = cdOff;
  for (let n = 0; n < total; n++) {
    if (p + 46 > b.length || u32(b, p) !== 0x02014b50) return null;
    const nameLen = u16(b, p + 28), extraLen = u16(b, p + 30), cmtLen = u16(b, p + 32);
    if (p + 46 + nameLen > b.length) return null;
    const flags = u16(b, p + 8);
    // Cờ bit 11 = tên UTF-8; không có thì cp437 (đủ để so sánh tên ASCII: phần cần kiểm đều là ASCII).
    const name = (flags & 0x800) ? new TextDecoder("utf-8").decode(b.subarray(p + 46, p + 46 + nameLen)) : latin1(b, p + 46, p + 46 + nameLen);
    entries.push({ name, flags, method: u16(b, p + 10), comp: u32(b, p + 20), uncomp: u32(b, p + 24), lho: u32(b, p + 42) });
    p += 46 + nameLen + extraLen + cmtLen;
  }
  return { entries, total };
}

/** Tên mục nguy hiểm khi giải nén ra đĩa (zip-slip): `..`, bắt đầu bằng / hoặc \, ổ đĩa, ký tự điều khiển. */
function unsafeEntryName(name: string): boolean {
  if (/[\u0000-\u001f]/.test(name)) return true;
  if (name.startsWith("/") || name.startsWith("\\") || /^[A-Za-z]:/.test(name)) return true;
  return name.split(/[\\/]/).includes("..");
}

/** Mục chỉ có trong tệp có macro / đối tượng nhúng / ActiveX. So trên tên viết thường. */
function macroEntryName(lower: string): boolean {
  return lower.includes("vbaproject") || lower.includes("vbadata") || lower.startsWith("word/activex/") || lower.startsWith("word/embeddings/");
}

/** Đọc nội dung mục `e` (stored hoặc deflate), tối đa `max` byte đầu ra; lỗi ⇒ null. */
function readEntry(b: Uint8Array, e: ZipEntry, max: number): Uint8Array | null {
  try {
    if (e.lho + 30 > b.length || u32(b, e.lho) !== 0x04034b50) return null;
    const start = e.lho + 30 + u16(b, e.lho + 26) + u16(b, e.lho + 28);
    if (start + e.comp > b.length) return null;
    const raw = b.subarray(start, start + e.comp);
    if (e.method === 0) return e.comp <= max ? raw : null;
    if (e.method === 8) return new Uint8Array(inflateRawSync(raw, { maxOutputLength: max }));
    return null;
  } catch { return null; }
}

/** `bytes` = TOÀN BỘ tệp (đã giới hạn < 10 MiB ở nơi gọi). Không bao giờ ném lỗi. */
export function inspectDocx(bytes: Uint8Array): InspectResult {
  if (!bytes || bytes.length === 0) return bad("bad_content");
  if (!startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return bad("bad_content");
  const cd = readCentralDirectory(bytes);
  if (cd === "too_many") return bad("bomb");
  if (!cd) return bad("bad_content");

  let total = 0;
  let ct: ZipEntry | null = null, doc: ZipEntry | null = null;
  const seen = new Set<string>();
  for (const e of cd.entries) {
    if (e.flags & 0x1) return bad("bad_content");                       // mã hoá
    if (unsafeEntryName(e.name)) return bad("bad_content");
    const lower = e.name.toLowerCase();
    if (seen.has(lower)) return bad("bad_content");                     // tên trùng: mơ hồ giữa các trình đọc
    seen.add(lower);
    if (macroEntryName(lower)) return bad("blocked_macro");
    if (e.uncomp > DOCX_MAX_ENTRY_UNCOMPRESSED) return bad("bomb");
    total += e.uncomp;
    if (total > DOCX_MAX_TOTAL_UNCOMPRESSED) return bad("bomb");
    if (e.uncomp > DOCX_RATIO_MIN_BYTES && e.uncomp / Math.max(e.comp, 1) > DOCX_MAX_RATIO) return bad("bomb");
    if (e.name === "[Content_Types].xml") ct = e;
    else if (e.name === "word/document.xml") doc = e;
  }
  // Gói Word bắt buộc có cả hai. Xlsx/pptx đổi tên .docx và zip thường đều rớt ở đây.
  if (!ct || !doc) return bad("bad_content");
  if (ct.uncomp > DOCX_CONTENT_TYPES_MAX) return bad("bomb");
  const xml = readEntry(bytes, ct, DOCX_CONTENT_TYPES_MAX);
  if (!xml) return bad("bad_content");
  const text = new TextDecoder("utf-8").decode(xml).toLowerCase();
  if (text.includes("macroenabled") || text.includes("vbaproject")) return bad("blocked_macro");
  return OK;
}

// ── PDF ─────────────────────────────────────────────────────────────────────

const PDF_BLOCKED_NAMES = new Set(["Encrypt", "Launch", "EmbeddedFile", "JavaScript", "JS"]);

/** `bytes` = TOÀN BỘ tệp. Quét byte thô; PDF giấu lệnh trong luồng nén (object stream) không bị phát hiện — hạn chế đã nói ở đầu tệp. Không ném lỗi. */
export function inspectPdf(bytes: Uint8Array): InspectResult {
  if (!bytes || bytes.length < 8) return bad("bad_content");
  const head = latin1(bytes, 0, 8);
  if (!head.startsWith("%PDF-1.") && !head.startsWith("%PDF-2.")) return bad("bad_content");
  const tail = latin1(bytes, Math.max(0, bytes.length - 2048), bytes.length);
  if (!tail.includes("%%EOF")) return bad("bad_content");
  const all = latin1(bytes, 0, bytes.length);
  // Tên PDF: "/" + ký tự thường cho tới khoảng trắng hoặc dấu phân cách. Giải mã "#xx" trước khi so (mẹo giấu "/J#61vaScript").
  const re = /\/([^\s\/\[\]<>()%{}]{1,64})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(all)) !== null) {
    const name = m[1].includes("#") ? m[1].replace(/#([0-9A-Fa-f]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16))) : m[1];
    if (PDF_BLOCKED_NAMES.has(name)) return bad("blocked_macro");
  }
  return OK;
}

/** Chọn bộ kiểm theo đuôi (đuôi đã qua validateNopTepRequest). */
export function inspectNopTepContent(bytes: Uint8Array, ext: string): InspectResult {
  if (ext === "docx") return inspectDocx(bytes);
  if (ext === "pdf") return inspectPdf(bytes);
  return bad("bad_ext");
}
