// BU-02 — kiểm NỘI DUNG THẬT của tệp tài liệu theo byte đầu (magic bytes), không tin đuôi tên hay MIME do trình duyệt khai. THUẦN: không fs, không mạng.
// Máy chủ đọc ~4 KB đầu tệp đã tải lên (đĩa cục bộ / Range từ Cloudinary) rồi hỏi hàm này; sai thì xoá tệp.
// MIME trả về do BẢNG quyết định (DOCUMENT_MIME_BY_EXT), không lấy từ tệp hay từ trình duyệt.
import { DOCUMENT_EXTS, DOCUMENT_MIME_BY_EXT } from "./mediaStorage";

export type SniffResult = { ok: true; mime: string } | { ok: false; error: string };

/** Số byte đầu cần đọc để kiểm (đủ chứa "[Content_Types].xml" của gói OOXML và 4 KB cho tệp văn bản). */
export const SNIFF_BYTES = 4096;

const startsWith = (b: Uint8Array, sig: number[], at = 0): boolean => b.length >= at + sig.length && sig.every((v, i) => b[at + i] === v);
const ascii = (s: string): number[] => Array.from(s, c => c.charCodeAt(0));
const includesAscii = (b: Uint8Array, s: string): boolean => {
  const n = ascii(s);
  outer: for (let i = 0; i + n.length <= b.length; i++) {
    for (let j = 0; j < n.length; j++) if (b[i + j] !== n[j]) continue outer;
    return true;
  }
  return false;
};

const LABEL: Record<string, string> = {
  pdf: "PDF", doc: "Word", docx: "Word", xls: "Excel", xlsx: "Excel", ppt: "PowerPoint", pptx: "PowerPoint",
  txt: "văn bản", png: "PNG", jpg: "JPEG", jpeg: "JPEG", webp: "WebP",
};
const bad = (ext: string): SniffResult => ({ ok: false, error: `Nội dung tệp không phải ${LABEL[ext] ?? ext.toUpperCase()}` });

/** UTF-8 hợp lệ? (cho phép một ký tự bị cắt dở ở cuối đoạn đầu tệp). */
function isUtf8(b: Uint8Array): boolean {
  try {
    let end = b.length;
    // lùi tối đa 3 byte nếu đuôi là phần dở của một ký tự nhiều byte
    for (let back = 0; back < 4 && end > 0; back++) {
      const c = b[end - 1 - back];
      if ((c & 0xC0) === 0x80) continue;                    // byte nối
      const need = c >= 0xF0 ? 4 : c >= 0xE0 ? 3 : c >= 0xC0 ? 2 : 1;
      if (need > back + 1) end = end - 1 - back;            // ký tự dở: bỏ khỏi phần kiểm
      break;
    }
    new TextDecoder("utf-8", { fatal: true }).decode(b.subarray(0, end));
    return true;
  } catch { return false; }
}

/** `head` = các byte đầu tệp (nên đủ SNIFF_BYTES, ngắn hơn nếu tệp ngắn); `ext` = đuôi tên tệp. Không bao giờ ném lỗi. */
export function sniffDocument(head: Uint8Array, ext: string): SniffResult {
  const e = (ext ?? "").toLowerCase().replace(/^\./, "");
  if (!(DOCUMENT_EXTS as readonly string[]).includes(e)) return { ok: false, error: "Loại tệp này KiN không nhận." };
  if (!head || head.length === 0) return { ok: false, error: "Tệp rỗng." };
  const mime = DOCUMENT_MIME_BY_EXT[e];
  const ok: SniffResult = { ok: true, mime };
  switch (e) {
    case "pdf": return startsWith(head, ascii("%PDF-")) ? ok : bad(e);
    case "docx": case "xlsx": case "pptx": {
      if (!startsWith(head, [0x50, 0x4B, 0x03, 0x04])) return bad(e);
      // Gói OOXML luôn có "[Content_Types].xml"; ZIP thường (kể cả zip đổi tên .docx) thì không.
      if (!includesAscii(head.subarray(0, SNIFF_BYTES), "[Content_Types].xml")) return bad(e);
      return ok;
    }
    case "doc": case "xls": case "ppt": return startsWith(head, [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]) ? ok : bad(e);
    case "png": return startsWith(head, [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]) ? ok : bad(e);
    case "jpg": case "jpeg": return startsWith(head, [0xFF, 0xD8, 0xFF]) ? ok : bad(e);
    case "webp": return startsWith(head, ascii("RIFF")) && startsWith(head, ascii("WEBP"), 8) ? ok : bad(e);
    case "txt": {
      const h = head.subarray(0, SNIFF_BYTES);
      if (h.includes(0x00)) return bad(e);
      return isUtf8(h) ? ok : bad(e);
    }
    default: return bad(e);
  }
}
