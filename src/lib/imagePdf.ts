// SCL-D (Q3, 21/11/2026) — gộp ảnh JPEG thành MỘT tệp PDF, không thư viện. Thuần (không DOM, không mạng): trình duyệt nén ảnh bằng canvas rồi gọi hàm này,
// tệp PDF đi tiếp đường nộp PDF sẵn có (ảnh gốc không lên máy chủ). Mỗi ảnh một trang, rộng A4 (595,28pt), cao theo tỉ lệ ảnh; ảnh nhúng nguyên byte JPEG (/DCTDecode).
// Kiểm ở tools/local-e2e/t-image-pdf-lib.ts (xref, số trang, byte JPEG giữ nguyên).

export interface JpegPage { jpeg: Uint8Array; width: number; height: number }

export const PDF_PAGE_WIDTH = 595.28;
/** Ảnh nén ở trình duyệt: cạnh dài tối đa (px). */
export const IMAGE_MAX_EDGE = 2000;
/** Số ảnh tối đa gộp vào một PDF (một lần nộp). */
export const MAX_IMAGE_PAGES = 30;

const enc = new TextEncoder();
const fmt = (n: number) => (Math.round(n * 100) / 100).toString();

/** Kích thước sau khi thu nhỏ để cạnh dài ≤ maxEdge (không phóng to ảnh nhỏ). */
export function fitWithin(width: number, height: number, maxEdge = IMAGE_MAX_EDGE): { width: number; height: number } {
  const long = Math.max(width, height);
  if (long <= maxEdge) return { width: Math.round(width), height: Math.round(height) };
  const k = maxEdge / long;
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) };
}

/** Byte của một tệp PDF 1.4 hợp lệ: catalog, cây trang, mỗi trang một XObject ảnh JPEG + một luồng vẽ. Ném lỗi nếu không có trang hoặc dữ liệu không phải JPEG. */
export function buildJpegPdf(pages: JpegPage[]): Uint8Array {
  if (pages.length === 0) throw new Error("Chưa có ảnh nào.");
  if (pages.length > MAX_IMAGE_PAGES) throw new Error(`Tối đa ${MAX_IMAGE_PAGES} ảnh mỗi lần nộp.`);
  for (const p of pages) {
    if (!(p.jpeg.length > 3 && p.jpeg[0] === 0xff && p.jpeg[1] === 0xd8 && p.jpeg[2] === 0xff)) throw new Error("Ảnh không ở dạng JPEG.");
    if (!(Number.isInteger(p.width) && Number.isInteger(p.height) && p.width > 0 && p.height > 0)) throw new Error("Kích thước ảnh không hợp lệ.");
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
  const push = (b: Uint8Array | string) => { const u = typeof b === "string" ? enc.encode(b) : b; chunks.push(u); size += u.length; };
  const offsets: number[] = []; // offsets[i] = vị trí byte của đối tượng số i+1
  const obj = (n: number, body: (string | Uint8Array)[]) => { offsets[n - 1] = size; push(`${n} 0 obj\n`); for (const b of body) push(b); push("\nendobj\n"); };

  push(new Uint8Array([...enc.encode("%PDF-1.4\n%"), 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])); // dòng 2: byte > 127 để công cụ coi tệp là nhị phân

  // 1 = Catalog, 2 = Pages; trang i dùng 3+3i (Page), 4+3i (ảnh), 5+3i (luồng vẽ).
  const kids = pages.map((_, i) => `${3 + 3 * i} 0 R`).join(" ");
  obj(1, ["<< /Type /Catalog /Pages 2 0 R >>"]);
  obj(2, [`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`]);
  pages.forEach((p, i) => {
    const pageN = 3 + 3 * i, imgN = pageN + 1, contN = pageN + 2;
    const w = PDF_PAGE_WIDTH, h = (PDF_PAGE_WIDTH * p.height) / p.width;
    obj(pageN, [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${fmt(w)} ${fmt(h)}] /Resources << /XObject << /Im0 ${imgN} 0 R >> >> /Contents ${contN} 0 R >>`]);
    obj(imgN, [`<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`, p.jpeg, "\nendstream"]);
    const draw = `q ${fmt(w)} 0 0 ${fmt(h)} 0 0 cm /Im0 Do Q`;
    obj(contN, [`<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`]);
  });
  const count = 2 + 3 * pages.length;
  const xrefAt = size;
  push(`xref\n0 ${count + 1}\n0000000000 65535 f \n`);
  for (let i = 0; i < count; i++) push(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size ${count + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`);

  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
}
