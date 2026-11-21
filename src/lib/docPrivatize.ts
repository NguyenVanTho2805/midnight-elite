// SCL-D (P2-6) — phần THUẦN của "Chuyển sang riêng tư": tài liệu cũ nằm ở Cloudinary CÔNG KHAI (ai có link cũng tải được) được chép vào kho riêng tư của KiN
// (FileAsset, mở qua /api/media/<mã>/file có kiểm quyền) rồi đổi đường dẫn trong JSON `documents` của bài. Không DB, không mạng: tools/local-e2e/t-doc-privatize-lib.ts.
import { DOCUMENT_EXTS, fileNameExt } from "./mediaStorage";

export const MAX_PRIVATIZE_PER_CALL = 20;

/** Chỉ tệp cũ trên Cloudinary công khai (đúng nhãn "Tệp cũ (công khai)" của giaoTrinh.docItem). Máy chủ chỉ tải từ đúng máy này — không mở tải tuỳ ý (SSRF). */
export function isLegacyPublicDoc(url: unknown): url is string {
  if (typeof url !== "string" || url.length > 2048) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === "res.cloudinary.com" && !u.username && !u.password && !u.port;
  } catch { return false; }
}

/** Tên lưu + đuôi cho tệp chép: đuôi lấy từ tên hiển thị, thiếu thì từ đường dẫn; đuôi ngoài danh sách tài liệu ⇒ null. */
export function privatizeName(displayName: unknown, url: string): { name: string; ext: string } | null {
  const shown = typeof displayName === "string" ? displayName.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 180) : "";
  let ext = fileNameExt(shown);
  if (!(DOCUMENT_EXTS as readonly string[]).includes(ext)) {
    let path = "";
    try { path = decodeURIComponent(new URL(url).pathname); } catch { return null; }
    ext = fileNameExt(path.split("/").pop() ?? "");
    if (!(DOCUMENT_EXTS as readonly string[]).includes(ext)) return null;
    return { name: `${shown || "tai-lieu"}.${ext}`, ext };
  }
  return { name: shown, ext };
}

/** Đổi MỌI mục tài liệu có url === oldUrl sang newUrl, giữ tên / loại / thứ tự. JSON hỏng hoặc không phải mảng ⇒ không đổi gì. */
export function replaceDocUrl(raw: string | null | undefined, oldUrl: string, newUrl: string): { json: string; changed: number } {
  const src = raw ?? "";
  let arr: unknown;
  try { arr = JSON.parse(src || "[]"); } catch { return { json: src, changed: 0 }; }
  if (!Array.isArray(arr)) return { json: src, changed: 0 };
  let changed = 0;
  const out = arr.map(d => {
    if (d && typeof d === "object" && (d as { url?: unknown }).url === oldUrl) { changed++; return { ...(d as object), url: newUrl }; }
    return d;
  });
  return changed ? { json: JSON.stringify(out), changed } : { json: src, changed: 0 };
}

/** Tên hiển thị của mục đầu tiên trỏ tới url (để đặt tên tệp chép). */
export function docNameFor(raw: string | null | undefined, url: string): string | null {
  try {
    const arr = JSON.parse(raw || "[]");
    if (!Array.isArray(arr)) return null;
    const d = arr.find(x => x && typeof x === "object" && x.url === url);
    return d && typeof d.name === "string" ? d.name : null;
  } catch { return null; }
}
