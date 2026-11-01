// BU-02 — fileSniff.ts (THUẦN): kiểm NỘI DUNG THẬT của tệp tài liệu theo byte đầu, không tin đuôi tên hay MIME trình duyệt khai.
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-file-sniff-lib.ts
// Ca phá cố ý (đỡ nhầm thì ca đỏ): .exe ("MZ") đổi tên .pdf; HTML đổi tên .png; .docx không phải ZIP; ZIP thường (thiếu [Content_Types].xml) đổi tên .docx;
// .txt có byte 0x00; .svg/.html/.zip/.exe ngoài danh sách; đầu tệp rỗng/ngắn hơn chữ ký (không được ném lỗi).
// Mutation tự thử: bỏ điều kiện "[Content_Types].xml" ⇒ ca "ZIP thường đổi tên .docx" đỏ; đổi `startsWith(%PDF-)` thành luôn đúng ⇒ ca MZ.pdf đỏ.
import { sniffDocument, SNIFF_BYTES } from "@/lib/fileSniff";
import { DOCUMENT_EXTS, DOCUMENT_MIME_BY_EXT } from "@/lib/mediaStorage";
import { check, section, done } from "./h";

const A = (s: string) => Array.from(s, c => c.charCodeAt(0));
const u8 = (...parts: (number[] | string)[]) => new Uint8Array(parts.flatMap(p => (typeof p === "string" ? Array.from(new TextEncoder().encode(p)) : p)));
const pad = (b: Uint8Array, n = 200) => { const o = new Uint8Array(Math.max(n, b.length)); o.set(b); return o; };

const PDF = pad(u8("%PDF-1.7\n%âãÏÓ\n1 0 obj"));
const DOCX = pad(u8([0x50, 0x4B, 0x03, 0x04, 0x14, 0, 6, 0, 8, 0, 0, 0, 0, 0], "[Content_Types].xml", [0, 0], "word/document.xml"));
const XLSX = pad(u8([0x50, 0x4B, 0x03, 0x04, 0x14, 0, 6, 0], "[Content_Types].xml", "xl/workbook.xml"));
const PPTX = pad(u8([0x50, 0x4B, 0x03, 0x04, 0x14, 0, 6, 0], "[Content_Types].xml", "ppt/presentation.xml"));
const OLE = pad(u8([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1, 0, 0, 0, 0]));
const PNG = pad(u8([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13], "IHDR"));
const JPG = pad(u8([0xFF, 0xD8, 0xFF, 0xE0, 0, 16], "JFIF"));
const WEBP = pad(u8("RIFF", [0x24, 0, 0, 0], "WEBPVP8 "));
const TXT = u8("Đề cương ôn tập Toán 9\nChương 1: Căn bậc hai\n");
const PLAIN_ZIP = pad(u8([0x50, 0x4B, 0x03, 0x04, 0x14, 0, 0, 0], "baitap.txt", [0, 0, 0], "noi dung"));
const EXE = pad(u8("MZ", [0x90, 0, 3, 0, 0, 0, 4, 0], "This program cannot be run in DOS mode."));
const HTML = pad(u8("<!doctype html><html><script>alert(1)</script>"));
const SVG = pad(u8('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'));

section("Tệp thật đạt, MIME do BẢNG quyết định");
const GOOD: [string, Uint8Array][] = [["pdf", PDF], ["docx", DOCX], ["xlsx", XLSX], ["pptx", PPTX], ["doc", OLE], ["xls", OLE], ["ppt", OLE], ["png", PNG], ["jpg", JPG], ["jpeg", JPG], ["webp", WEBP], ["txt", TXT]];
for (const [ext, bytes] of GOOD) {
  const r = sniffDocument(bytes, ext);
  check(`.${ext} thật → ok, mime ${DOCUMENT_MIME_BY_EXT[ext]}`, r.ok && r.mime === DOCUMENT_MIME_BY_EXT[ext], r);
}
check("mọi đuôi trong DOCUMENT_EXTS đều có ca tệp thật ở trên (không bỏ sót đuôi nào)", (DOCUMENT_EXTS as readonly string[]).every(e => GOOD.some(([x]) => x === e)));
check("đuôi viết hoa / có dấu chấm đầu vẫn đọc đúng: PDF, .pdf", sniffDocument(PDF, "PDF").ok && sniffDocument(PDF, ".pdf").ok);
check("MIME trả về KHÔNG phụ thuộc nội dung (png nhưng khai jpg ⇒ bị từ chối, không đổi mime)", !sniffDocument(PNG, "jpg").ok);
check(".txt tiếng Việt có dấu (UTF-8) đạt; có BOM đạt", sniffDocument(TXT, "txt").ok && sniffDocument(u8([0xEF, 0xBB, 0xBF], "xin chào"), "txt").ok);

section("PHÁ CỐ Ý — đổi đuôi để lách");
check(".exe (MZ) đổi tên .pdf ⇒ từ chối, nói rõ 'không phải PDF'", (() => { const r = sniffDocument(EXE, "pdf"); return !r.ok && r.error === "Nội dung tệp không phải PDF"; })());
check(".exe đổi tên .png / .jpg / .docx / .txt / .doc / .webp đều bị từ chối", ["png", "jpg", "jpeg", "docx", "xlsx", "pptx", "doc", "xls", "ppt", "webp"].every(e => !sniffDocument(EXE, e).ok));
check("HTML đổi tên .png / .jpg / .pdf / .webp ⇒ từ chối", ["png", "jpg", "pdf", "webp", "docx", "doc"].every(e => !sniffDocument(HTML, e).ok));
check("HTML đổi tên .txt ⇒ vẫn là văn bản thuần (an toàn nhờ Content-Type text/plain + nosniff + CSP), KHÔNG bị coi là lỗi", sniffDocument(u8("<!doctype html><html><script>alert(1)</script></html>"), "txt").ok);
check(".docx mà không phải ZIP (là PDF / là văn bản) ⇒ từ chối", !sniffDocument(PDF, "docx").ok && !sniffDocument(TXT, "docx").ok);
check("ZIP thường (thiếu [Content_Types].xml) đổi tên .docx / .xlsx / .pptx ⇒ từ chối", ["docx", "xlsx", "pptx"].every(e => !sniffDocument(PLAIN_ZIP, e).ok));
check("tệp OLE cũ (.doc) đổi tên .docx ⇒ từ chối (docx phải là ZIP)", !sniffDocument(OLE, "docx").ok);
check("PDF đổi tên .doc / .xls ⇒ từ chối", !sniffDocument(PDF, "doc").ok && !sniffDocument(PDF, "xls").ok);
check("'%PDF' thiếu dấu gạch cuối ⇒ từ chối", !sniffDocument(pad(u8("%PDF1.7 giả")), "pdf").ok);
check("RIFF nhưng không phải WEBP (WAV) đổi tên .webp ⇒ từ chối", !sniffDocument(pad(u8("RIFF", [0x24, 0, 0, 0], "WAVEfmt ")), "webp").ok);
check("PNG thiếu 4 byte cuối của chữ ký ⇒ từ chối", !sniffDocument(pad(u8([0x89, 0x50, 0x4E, 0x47])), "png").ok);
check(".txt có byte 0x00 (nhị phân) ⇒ từ chối", !sniffDocument(pad(u8("xin chào", [0, 1, 2, 3])), "txt").ok);
check(".txt không phải UTF-8 hợp lệ (0xFF 0xFE rác) ⇒ từ chối", !sniffDocument(pad(u8([0xFF, 0xFE, 0xFD, 0xC3, 0x28])), "txt").ok);
check(".txt dài > 4 KB bị cắt giữa một ký tự nhiều byte ⇒ vẫn đạt (không từ chối oan)", (() => { const bytes = new TextEncoder().encode("ế".repeat(2000)); return sniffDocument(bytes.subarray(0, SNIFF_BYTES), "txt").ok; })());
check("[Content_Types].xml nằm SAU 4 KB đầu ⇒ không tính (docx giả đẩy chuỗi ra xa)", (() => { const b = new Uint8Array(SNIFF_BYTES + 100); b.set([0x50, 0x4B, 0x03, 0x04]); b.set(A("[Content_Types].xml"), SNIFF_BYTES + 20); return !sniffDocument(b, "docx").ok; })());

section("PHÁ CỐ Ý — đuôi ngoài danh sách");
for (const e of ["svg", "html", "htm", "zip", "exe", "js", "php", "mp4", "gif", "rar", "7z", "bat", "", "pdf.exe", "../pdf"])
  check(`đuôi "${e}" ⇒ ngoài danh sách, bị từ chối`, !sniffDocument(PDF, e).ok);
check("SVG thật đổi tên .png / .jpg ⇒ từ chối", !sniffDocument(SVG, "png").ok && !sniffDocument(SVG, "jpg").ok);
check("danh sách đuôi KHÔNG có svg, html, zip, exe", !(DOCUMENT_EXTS as readonly string[]).some(e => ["svg", "html", "zip", "exe"].includes(e)));

section("Đầu tệp rỗng / ngắn — không ném lỗi");
check("rỗng ⇒ từ chối", !sniffDocument(new Uint8Array(0), "pdf").ok);
check("null / undefined ⇒ từ chối, không ném", (() => { try { return !sniffDocument(null as unknown as Uint8Array, "pdf").ok && !sniffDocument(undefined as unknown as Uint8Array, "png").ok; } catch { return false; } })());
check("ngắn hơn chữ ký (1–7 byte) ở mọi đuôi ⇒ từ chối, không ném", (() => {
  try { for (const e of DOCUMENT_EXTS) if (e !== "txt") for (let n = 1; n < 4; n++) if (sniffDocument(new Uint8Array(n).fill(0x25), e).ok) return false; return true; } catch { return false; }
})());
check("đuôi null / undefined ⇒ từ chối, không ném", (() => { try { return !sniffDocument(PDF, null as unknown as string).ok && !sniffDocument(PDF, undefined as unknown as string).ok; } catch { return false; } })());

done();
