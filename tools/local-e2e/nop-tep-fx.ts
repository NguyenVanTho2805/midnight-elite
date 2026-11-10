// BU-HS-NOP-TEP — dựng tệp thử BẰNG TAY (mảng byte) cho t-nop-tep-lib / t-nop-tep / t-nop-tep-het-han. Không phụ thuộc thư viện zip; chỉ dùng node:zlib.
// Cho phép KHAI SAI kích thước trong thư mục trung tâm của zip (để dựng zip bomb mà không phải tạo hàng GB) và dựng các biến thể hỏng.
import { deflateRawSync } from "node:zlib";

const crcTable = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b: Uint8Array): number => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

export interface ZipItem {
  name: string;
  data?: Uint8Array | string;
  /** 0 = lưu nguyên, 8 = deflate (mặc định 8 nếu có dữ liệu). */
  method?: 0 | 8;
  /** KHAI trong thư mục trung tâm (có thể sai sự thật để dựng bomb). */
  declUncomp?: number;
  declComp?: number;
  flags?: number;
}
const w16 = (n: number) => { const b = Buffer.alloc(2); b.writeUInt16LE(n & 0xffff); return b; };
const w32 = (n: number) => { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return b; };

export function buildZip(items: ZipItem[], o: { eocdComment?: number } = {}): Buffer {
  const locals: Buffer[] = [], centrals: Buffer[] = [];
  let off = 0;
  for (const it of items) {
    const name = Buffer.from(it.name, "utf8");
    const raw = Buffer.from(it.data ?? "");
    const method = it.method ?? (raw.length ? 8 : 0);
    const comp = method === 8 ? deflateRawSync(raw) : raw;
    const flags = (it.flags ?? 0) | 0x800;
    const crc = crc32(raw);
    const lh = Buffer.concat([w32(0x04034b50), w16(20), w16(flags), w16(method), w16(0), w16(0x21), w32(crc), w32(comp.length), w32(raw.length), w16(name.length), w16(0), name, comp]);
    const ch = Buffer.concat([w32(0x02014b50), w16(20), w16(20), w16(flags), w16(method), w16(0), w16(0x21), w32(crc), w32(it.declComp ?? comp.length), w32(it.declUncomp ?? raw.length), w16(name.length), w16(0), w16(0), w16(0), w16(0), w32(0), w32(off), name]);
    locals.push(lh); centrals.push(ch);
    off += lh.length;
  }
  const cd = Buffer.concat(centrals);
  const cm = o.eocdComment ?? 0;
  const eocd = Buffer.concat([w32(0x06054b50), w16(0), w16(0), w16(items.length), w16(items.length), w32(cd.length), w32(off), w16(cm), Buffer.alloc(cm)]);
  return Buffer.concat([...locals, cd, eocd]);
}

const CT_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/>';
export const contentTypes = (mainType: string): string => `${CT_HEAD}<Override PartName="/word/document.xml" ContentType="${mainType}"/></Types>`;
const WORD_MAIN = "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml";
const DOC_XML = '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Bài làm</w:t></w:r></w:p></w:body></w:document>';

/** Một .docx hợp lệ tối thiểu; `extra` thêm mục (vd macro, embeddings). `padTo` đệm thêm byte để đạt kích thước mong muốn (mục lưu nguyên, không nén). */
export function validDocx(o: { extra?: ZipItem[]; mainType?: string; padTo?: number } = {}): Buffer {
  const items: ZipItem[] = [
    { name: "[Content_Types].xml", data: contentTypes(o.mainType ?? WORD_MAIN) },
    { name: "_rels/.rels", data: '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>' },
    { name: "word/document.xml", data: DOC_XML },
    ...(o.extra ?? []),
  ];
  let z = buildZip(items);
  if (o.padTo && z.length < o.padTo) {
    // Đệm bằng một mục lưu nguyên (method 0) cuối gói để đúng kích thước mong muốn.
    const base = buildZip([...items, { name: "pad.bin", data: Buffer.alloc(0), method: 0 }]).length;
    const need = Math.max(0, o.padTo - base);
    z = buildZip([...items, { name: "pad.bin", data: Buffer.alloc(need, 0x61), method: 0 }]);
    // bù lệch vài byte (tên/độ dài cố định nên thường khớp đúng)
    if (z.length !== o.padTo) z = buildZip([...items, { name: "pad.bin", data: Buffer.alloc(need + (o.padTo - z.length), 0x61), method: 0 }]);
  }
  return z;
}
export const validXlsx = (): Buffer => buildZip([
  { name: "[Content_Types].xml", data: contentTypes("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml") },
  { name: "xl/workbook.xml", data: "<workbook/>" },
]);
export const plainZip = (): Buffer => buildZip([{ name: "a.txt", data: "xin chao" }, { name: "b.txt", data: "tam biet" }]);

export const PNG_BYTES = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200, 7)]);
export const JPEG_BYTES = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 9)]);
export const EXE_BYTES = Buffer.concat([Buffer.from("MZ"), Buffer.alloc(300, 1)]);
export const HTML_BYTES = Buffer.from("<html><script>alert(1)</script></html>");

export function validPdf(o: { body?: string; padTo?: number } = {}): Buffer {
  let s = `%PDF-1.7\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n${o.body ?? ""}\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n`;
  if (o.padTo && s.length < o.padTo) {
    // Đệm bằng chú thích PDF (%...) TRƯỚC phần đuôi để %%EOF vẫn nằm trong 2 KiB cuối.
    const tail = "\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n";
    const head = s.slice(0, s.length - tail.length);
    s = head + "\n%" + "a".repeat(Math.max(0, o.padTo - head.length - tail.length - 2)) + tail;
  }
  return Buffer.from(s, "latin1");
}
