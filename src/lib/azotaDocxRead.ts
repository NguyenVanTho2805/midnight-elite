// BU-03 P1 — đọc tệp .docx → DocBlock[] (đoạn, bảng, run có định dạng, hình, công thức). Phần MÁY CHỦ (jszip + @xmldom/xmldom); luật hiểu đề nằm ở azotaDocx.ts (thuần).
// Không AI, không mạng, không ghi DB. Chống tấn công theo mục P1.3: magic `PK\x03\x04`; ≤ 4 MB; ≤ 500 mục nén; tổng giải nén ≤ 30 MB (đo lúc GIẢI NÉN thật,
// không tin kích thước khai trong tệp); từ chối .docm (vbaProject.bin) và XML có <!DOCTYPE; chỉ đọc word/document.xml + word/_rels/document.xml.rels + word/media/*;
// mỗi XML ≤ 8 MB; tên mục có đường dẫn tuyệt đối hoặc `..` → từ chối.
import JSZip from "jszip";
import { DOMParser } from "@xmldom/xmldom";
import type { DocBlock, DocCell, DocRun } from "@/lib/azotaDocx";
import { FORMULA_PLACEHOLDER, ommlToLatexSafe, type XmlNodeLike } from "@/lib/ommlLatex";

export const DOCX_MAX_BYTES = 4 * 1024 * 1024;
export const DOCX_MAX_ENTRIES = 500;
export const DOCX_MAX_UNPACKED = 30 * 1024 * 1024;
export const DOCX_MAX_XML = 8 * 1024 * 1024;
export const DOCX_MAX_IMAGES = 40;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
/** Độ sâu đệ quy tối đa khi duyệt XML (tệp giả lồng hàng vạn tầng sẽ làm tràn ngăn xếp → 500). Vượt → NOT_DOCX (400). */
export const DOCX_MAX_DEPTH = 200;
/** Thuần: ném DocxError NOT_DOCX khi `depth` vượt trần. Mỗi hàm đệ quy gọi ở đầu hàm. */
export function assertDocxDepth(depth: number): void {
  if (depth > DOCX_MAX_DEPTH) throw new DocxError("NOT_DOCX", "Tệp Word có cấu trúc lồng quá sâu — KiN không đọc loại tệp này.");
}

export type DocxErrorCode = "NOT_DOCX" | "TOO_LARGE";
export class DocxError extends Error {
  constructor(public code: DocxErrorCode, message: string) { super(message); this.name = "DocxError"; }
}

const IMAGE_MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp" };

export interface DocxRead { blocks: DocBlock[]; images: Buffer[]; mime: string[]; extraImages: number }

interface ZipStream { on(ev: string, fn: (arg: never) => void): ZipStream; pause(): ZipStream; resume(): ZipStream }

/** Giải nén MỘT mục, dừng ngay khi vượt `limit` byte (chống zip bomb khai sai kích thước). */
function readEntry(entry: JSZip.JSZipObject, limit: number, budget: { left: number }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0, done = false;
    // internalStream có thật trong jszip 3.x nhưng không có trong kiểu công khai.
    const stream = (entry as unknown as { internalStream(t: "uint8array"): ZipStream }).internalStream("uint8array");
    stream.on("data", (chunk: Uint8Array) => {
      if (done) return;
      total += chunk.length; budget.left -= chunk.length;
      if (total > limit || budget.left < 0) {
        done = true; stream.pause();
        reject(new DocxError("TOO_LARGE", "Tệp Word giải nén ra quá lớn."));
        return;
      }
      chunks.push(Buffer.from(chunk));
    });
    stream.on("error", (e: unknown) => { if (!done) { done = true; reject(new DocxError("NOT_DOCX", `Không đọc được nội dung tệp Word (${e instanceof Error ? e.message : "lỗi"}).`)); } });
    stream.on("end", () => { if (!done) { done = true; resolve(Buffer.concat(chunks)); } });
    stream.resume();
  });
}

function parseXml(buf: Buffer): XmlNodeLike {
  const text = buf.toString("utf8");
  if (/<!DOCTYPE/i.test(text) || /<!ENTITY/i.test(text)) throw new DocxError("NOT_DOCX", "Tệp Word có khai báo DOCTYPE — KiN không đọc loại tệp này.");
  let fatal = false;
  const doc = new DOMParser({ errorHandler: { warning: () => {}, error: () => {}, fatalError: () => { fatal = true; } } }).parseFromString(text, "text/xml");
  if (fatal || !doc || !doc.documentElement) throw new DocxError("NOT_DOCX", "Nội dung tệp Word bị hỏng.");
  return doc.documentElement as unknown as XmlNodeLike;
}

const ln = (n: XmlNodeLike): string => (n.localName || n.nodeName.split(":").pop() || "").toString();
const els = (n: XmlNodeLike): XmlNodeLike[] => Array.from(n.childNodes).filter(c => c.nodeType === 1);
const attr = (n: XmlNodeLike | undefined, ...names: string[]): string | null => {
  if (!n || !n.getAttribute) return null;
  for (const nm of names) { const v = n.getAttribute(nm); if (v !== null && v !== undefined && v !== "") return v; }
  return null;
};
/** Tìm hậu duệ đầu tiên có tên cục bộ `name` (không đi vào mc:Fallback). */
function findFirst(n: XmlNodeLike, name: string, depth = 0): XmlNodeLike | undefined {
  assertDocxDepth(depth);
  for (const c of els(n)) {
    if (ln(c) === name) return c;
    if (ln(c) === "Fallback") continue;
    const f = findFirst(c, name, depth + 1);
    if (f) return f;
  }
  return undefined;
}

/** Cờ bật/tắt của w:b, w:i, w:u…: phần tử có mặt mà không val="0|false|off|none" = bật. */
function flagOn(rpr: XmlNodeLike | undefined, name: string, offValues: RegExp = /^(0|false|off)$/i): boolean {
  if (!rpr) return false;
  const el = els(rpr).find(c => ln(c) === name);
  if (!el) return false;
  const v = attr(el, "w:val", "val");
  return v === null || !offValues.test(v);
}

interface Ctx {
  rels: Map<string, string>;
  zip: JSZip;
  images: Buffer[]; mime: string[]; imageIndexByTarget: Map<string, number>;
  imageBuf: Map<string, Buffer>;
  extraImages: number;
}

function runProps(rpr: XmlNodeLike | undefined): Omit<DocRun, "text"> {
  const out: Omit<DocRun, "text"> = {};
  if (!rpr) return out;
  if (flagOn(rpr, "b")) out.bold = true;
  if (flagOn(rpr, "i")) out.italic = true;
  if (flagOn(rpr, "u", /^(none|0|false|off)$/i)) out.underline = true;
  const color = attr(els(rpr).find(c => ln(c) === "color"), "w:val", "val");
  if (color && !/^(auto|000000)$/i.test(color)) out.color = color.toUpperCase();
  const hl = attr(els(rpr).find(c => ln(c) === "highlight"), "w:val", "val");
  if (hl && hl !== "none") out.highlight = hl;
  const va = attr(els(rpr).find(c => ln(c) === "vertAlign"), "w:val", "val");
  if (va === "superscript") out.sup = true;
  if (va === "subscript") out.sub = true;
  return out;
}

function imageFromRelId(ctx: Ctx, relId: string | null): DocRun["image"] | undefined {
  if (!relId) return undefined;
  const target = ctx.rels.get(relId);
  if (!target) return undefined;
  const ext = (target.split(".").pop() ?? "").toLowerCase();
  const mime = IMAGE_MIME[ext];
  if (!mime) return { index: -1, readable: false }; // wmf/emf/… không hiển thị được
  const have = ctx.imageIndexByTarget.get(target);
  if (have !== undefined) return { index: have, readable: true };
  const buf = ctx.imageBuf.get(target);
  if (!buf) return undefined;
  if (ctx.images.length >= DOCX_MAX_IMAGES) { ctx.extraImages++; return { index: -1, readable: false }; }
  ctx.images.push(buf); ctx.mime.push(mime);
  ctx.imageIndexByTarget.set(target, ctx.images.length - 1);
  return { index: ctx.images.length - 1, readable: true };
}

/** Duyệt nội dung một run (hoặc phần tử bọc) → DocRun[]. */
function readRunContent(r: XmlNodeLike, ctx: Ctx, runs: DocRun[], props: Omit<DocRun, "text">, depth = 0): void {
  assertDocxDepth(depth);
  for (const c of els(r)) {
    switch (ln(c)) {
      case "t": { const t = c.textContent ?? ""; if (t) runs.push({ ...props, text: t }); break; }
      case "tab": runs.push({ ...props, text: "\t" }); break;
      case "br": case "cr": { const ty = attr(c, "w:type", "type"); if (ty === "page" || ty === "column") break; runs.push({ ...props, text: "\n", br: true }); break; }
      case "noBreakHyphen": runs.push({ ...props, text: "-" }); break;
      case "drawing": case "pict": {
        const blip = findFirst(c, "blip");
        const relId = blip ? attr(blip, "r:embed", "embed") : (() => { const im = findFirst(c, "imagedata"); return im ? attr(im, "r:id", "id") : null; })();
        const image = imageFromRelId(ctx, relId);
        if (image) runs.push({ ...props, text: "", image });
        break;
      }
      case "object": {
        const ole = findFirst(c, "OLEObject");
        const prog = attr(ole, "ProgID") ?? "";
        if (/equation|mathtype/i.test(prog)) runs.push({ ...props, text: FORMULA_PLACEHOLDER, formula: "ole" });
        else {
          // OLE khác (Excel, Visio…): chỉ lấy ảnh xem trước nếu là ảnh đọc được, không thì bỏ qua
          const im = findFirst(c, "imagedata");
          const image = im ? imageFromRelId(ctx, attr(im, "r:id", "id")) : undefined;
          if (image && image.readable) runs.push({ ...props, text: "", image });
        }
        break;
      }
      case "AlternateContent": {
        const choice = els(c).find(x => ln(x) === "Choice") ?? els(c).find(x => ln(x) === "Fallback");
        if (choice) readRunContent(choice, ctx, runs, props, depth + 1);
        break;
      }
      default: break; // rPr, instrText, delText, sym… bỏ qua
    }
  }
}

function readInline(parent: XmlNodeLike, ctx: Ctx, runs: DocRun[], depth = 0): void {
  assertDocxDepth(depth);
  for (const c of els(parent)) {
    switch (ln(c)) {
      case "r": {
        const rpr = els(c).find(x => ln(x) === "rPr");
        readRunContent(c, ctx, runs, runProps(rpr), depth + 1);
        break;
      }
      case "oMath": {
        const { ok, latex } = ommlToLatexSafe(c);
        runs.push({ text: ok ? `$${latex}$` : FORMULA_PLACEHOLDER, formula: "omml", latex: ok ? latex : undefined });
        break;
      }
      case "oMathPara": readInline(c, ctx, runs, depth + 1); break;
      case "hyperlink": case "ins": case "smartTag": case "sdt": case "sdtContent": case "fldSimple": case "customXml": case "moveTo": readInline(c, ctx, runs, depth + 1); break;
      case "AlternateContent": {
        const choice = els(c).find(x => ln(x) === "Choice") ?? els(c).find(x => ln(x) === "Fallback");
        if (choice) readInline(choice, ctx, runs, depth + 1);
        break;
      }
      default: break; // pPr, del, bookmark…
    }
  }
}

function readParagraph(p: XmlNodeLike, ctx: Ctx): DocRun[] {
  const runs: DocRun[] = [];
  readInline(p, ctx, runs);
  return runs;
}

function readTable(tbl: XmlNodeLike, ctx: Ctx, depth = 0): DocBlock {
  assertDocxDepth(depth);
  const rows: DocCell[][] = [];
  for (const tr of els(tbl).filter(x => ln(x) === "tr")) {
    const cells: DocCell[] = [];
    for (const tc of els(tr).filter(x => ln(x) === "tc")) {
      const paragraphs: DocRun[][] = [];
      for (const p of els(tc)) {
        if (ln(p) === "p") paragraphs.push(readParagraph(p, ctx));
        else if (ln(p) === "tbl") { // bảng lồng nhau: trải phẳng chữ vào cùng ô
          const inner = readTable(p, ctx, depth + 1);
          if (inner.kind === "table") for (const r of inner.rows) for (const c of r) paragraphs.push(...c.paragraphs);
        }
      }
      cells.push({ paragraphs });
    }
    rows.push(cells);
  }
  return { kind: "table", rows };
}

function readBody(parent: XmlNodeLike, ctx: Ctx, out: DocBlock[], depth = 0): void {
  assertDocxDepth(depth);
  for (const c of els(parent)) {
    switch (ln(c)) {
      case "p": out.push({ kind: "p", runs: readParagraph(c, ctx) }); break;
      case "tbl": out.push(readTable(c, ctx, depth + 1)); break;
      case "sdt": case "sdtContent": case "customXml": readBody(c, ctx, out, depth + 1); break;
      default: break; // sectPr…
    }
  }
}

function safeName(name: string): boolean {
  return !(name.startsWith("/") || /(^|[\\/])\.\.([\\/]|$)/.test(name) || name.includes("\\") || /^[A-Za-z]:/.test(name));
}

export async function readDocx(buf: Buffer): Promise<DocxRead> {
  if (buf.length > DOCX_MAX_BYTES) throw new DocxError("TOO_LARGE", "Tệp Word lớn hơn 4 MB. Cô tách đề nhỏ hơn rồi tải lại nhé.");
  if (buf.length < 4 || buf[0] !== 0x50 || buf[1] !== 0x4b || buf[2] !== 0x03 || buf[3] !== 0x04) throw new DocxError("NOT_DOCX", "Đây không phải tệp Word .docx. Cô lưu lại dưới dạng .docx rồi tải lên nhé.");

  let zip: JSZip;
  try { zip = await JSZip.loadAsync(buf); }
  catch { throw new DocxError("NOT_DOCX", "Không mở được tệp Word này (tệp hỏng hoặc không phải .docx)."); }

  const names = Object.keys(zip.files);
  if (names.length > DOCX_MAX_ENTRIES) throw new DocxError("TOO_LARGE", "Tệp Word có quá nhiều thành phần bên trong.");
  if (names.some(n => !safeName(n))) throw new DocxError("NOT_DOCX", "Tệp Word có đường dẫn bên trong không hợp lệ.");
  // Kích thước KHAI trong tệp: chặn sớm nếu đã vượt (kích thước thật vẫn đo lúc giải nén ở readEntry).
  let declared = 0;
  for (const n of names) declared += ((zip.files[n] as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize) ?? 0;
  if (declared > DOCX_MAX_UNPACKED) throw new DocxError("TOO_LARGE", "Tệp Word giải nén ra quá lớn.");
  if (names.some(n => /(^|\/)vbaProject\.bin$/i.test(n)) || names.some(n => /\.docm$/i.test(n))) throw new DocxError("NOT_DOCX", "Tệp Word có macro (.docm). KiN không đọc loại tệp này — cô lưu thành .docx thường rồi tải lại.");
  const docEntry = zip.file("word/document.xml");
  if (!docEntry) throw new DocxError("NOT_DOCX", "Không tìm thấy nội dung đề trong tệp (thiếu word/document.xml).");

  const budget = { left: DOCX_MAX_UNPACKED };
  const docXml = await readEntry(docEntry, DOCX_MAX_XML, budget);
  const relsEntry = zip.file("word/_rels/document.xml.rels");
  const relsXml = relsEntry ? await readEntry(relsEntry, DOCX_MAX_XML, budget) : null;

  const rels = new Map<string, string>();
  if (relsXml) {
    for (const r of els(parseXml(relsXml))) {
      const id = attr(r, "Id"), target = attr(r, "Target"), mode = attr(r, "TargetMode");
      if (!id || !target || mode === "External") continue;
      let t = target.replace(/^\.?\//, "");
      if (t.startsWith("/")) t = t.slice(1);
      t = t.replace(/^word\//, "");
      if (!safeName(t) || !t.startsWith("media/")) continue; // chỉ word/media/*
      rels.set(id, t);
    }
  }

  const imageBuf = new Map<string, Buffer>();
  for (const t of new Set(rels.values())) {
    const ext = (t.split(".").pop() ?? "").toLowerCase();
    if (!IMAGE_MIME[ext]) continue; // wmf/emf không cần giải nén
    const e = zip.file(`word/${t}`);
    if (!e) continue;
    try { imageBuf.set(t, await readEntry(e, MAX_IMAGE_BYTES, budget)); }
    catch (err) { if (err instanceof DocxError && err.code === "TOO_LARGE" && budget.left < 0) throw err; /* ảnh quá lớn: bỏ riêng ảnh đó */ }
  }

  const ctx: Ctx = { rels, zip, images: [], mime: [], imageIndexByTarget: new Map(), imageBuf, extraImages: 0 };
  const root = parseXml(docXml);
  const body = els(root).find(c => ln(c) === "body");
  const blocks: DocBlock[] = [];
  try { if (body) readBody(body, ctx, blocks); }
  catch (err) {
    if (err instanceof RangeError) throw new DocxError("NOT_DOCX", "Tệp Word có cấu trúc lồng quá sâu — KiN không đọc loại tệp này.");
    throw err;
  }
  return { blocks, images: ctx.images, mime: ctx.mime, extraImages: ctx.extraImages };
}
