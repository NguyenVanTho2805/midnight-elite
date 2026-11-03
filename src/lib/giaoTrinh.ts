// BU-02 — Giáo trình của gia sư: PHẦN THUẦN (không React, không DB, không đọc cookie/môi trường; chạy được cả ở trình duyệt).
// Mục nội dung ("Video · Tài liệu · Bài tập/Azota · Buổi live · Bài kiểm tra") KHÔNG phải một bảng: là khái niệm hiển thị suy ra từ các cột của Lesson.
// Hợp đồng kiểu giữa tut-code (máy chủ) và tut-dev (giao diện): GiaoTrinhSnapshot / GtItem / GtLesson dưới đây. Giao diện chỉ `import type`.
import {
  checkLinkForSlot, classifyMediaLink, docTypeFromExt, docTypeLabel, fileExtOf, isSocialVideoHost, parseLinkList, routeToSlot, serializeLinkList,
  type DocType, type MediaSlot,
} from "./mediaLink";
import { MAX_DOCUMENTS_PER_LESSON, DOCUMENT_EXTS, VIDEO_EXTS, fileNameExt, validateDocumentFile, validateVideoUpload } from "./mediaStorage";

export type ItemKind = "video" | "document" | "assignment" | "live" | "exam";   // nhãn: Video · Tài liệu · Bài tập/Azota · Buổi live · Bài kiểm tra

export interface GtItem {
  key: string;                 // `${slot}:${sha1(url).slice(0,10)}`; ổn định, KHÔNG phụ thuộc thứ tự
  kind: ItemKind; slot: MediaSlot | null;   // null với "exam" và mục chỉ đếm (Bài tập tự nộp)
  name: string; url: string | null;         // url null: mục chỉ đếm (Bài tập tự nộp)
  label: string;               // "YouTube", "Google Drive", "PDF", "Tệp trên KiN"…
  storage: "link" | "kin" | "cloudinary_cu";// kin = /api/media/<mã>/file (hoặc kin-media:<mã> với video) ; cloudinary_cu = tệp cũ công khai
  warning: string | null; broken: boolean;  // link cũ hỏng vẫn hiện, gắn nhãn, không làm sập trang
  count?: number; href?: string;            // assignment/exam
}

export interface GtLesson { id: string; title: string; type: string; isLocked: boolean; isFree: boolean; duration: string | null; azotaDeadline: string | null; items: GtItem[] }

export interface GiaoTrinhSnapshot {
  courseId: string; courseName: string;
  sections: { id: string; title: string; chapters: { id: string; title: string; lessons: GtLesson[] }[] }[];
  exams: GtItem[];                                  // Exam.courseId = lớp này, ownerId = chủ lớp
  config: { video: { enabled: boolean; reason: string | null; maxBytes: number }; document: { enabled: boolean; reason: string | null; maxBytes: number; quotaBytes: number; usedBytes: number; exts: string[] } };
}

/** Các cột của Lesson mà phần thuần cần (id có thể vắng khi chưa tạo bài). */
export interface LessonRow {
  id?: string; title?: string; type?: string; isLocked?: boolean; isFree?: boolean; duration?: string | null;
  videoUrl?: string | null; zoomUrl?: string | null; azotaUrl?: string | null; azotaDeadline?: string | null; documents?: string | null;
}
export interface PlaceInput { slot: MediaSlot; url: string; name?: string }
export type GtConfig = GiaoTrinhSnapshot["config"];
export type RouteInputOk = { ok: true; kind: ItemKind; slot: MediaSlot; label: string; warning: string | null; via: "link" | "document_file" | "video_file"; suggestedName: string };
export type RouteInputResult = RouteInputOk | { ok: false; error: string; moveTo?: MediaSlot };

// ── hằng số & tiện ích nhỏ ──────────────────────────────────────────────────

export const MAX_LINKS_PER_SLOT = 20;
export const MAX_ITEM_NAME = 200;
const KIN_FILE_RE = /^\/api\/media\/([A-Za-z0-9_-]{8,40})\/file$/;
const COLUMN_OF: Record<Exclude<MediaSlot, "document">, "videoUrl" | "zoomUrl" | "azotaUrl"> = { video: "videoUrl", live: "zoomUrl", azota: "azotaUrl" };
const KIND_OF_SLOT: Record<MediaSlot, ItemKind> = { video: "video", live: "live", azota: "assignment", document: "document" };

/** Mã tệp KiN trong `/api/media/<mã>/file`; không phải dạng đó ⇒ null. */
export const kinFileIdOf = (url: string | null | undefined): string | null => KIN_FILE_RE.exec((url ?? "").trim())?.[1] ?? null;
export const kinFileLink = (assetId: string): string => `/api/media/${assetId}/file`;

/** SHA-1 thuần (không node:crypto) để chạy cả ở trình duyệt; chỉ dùng để rút khoá ổn định cho mục, KHÔNG phải mật mã. */
function sha1Hex(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const ml = bytes.length * 8;
  const padded = new Uint8Array(((bytes.length + 9 + 63) >> 6) << 6);
  padded.set(bytes); padded[bytes.length] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 8, Math.floor(ml / 0x100000000)); dv.setUint32(padded.length - 4, ml >>> 0);
  let h0 = 0x67452301, h1 = 0xEFCDAB89, h2 = 0x98BADCFE, h3 = 0x10325476, h4 = 0xC3D2E1F0;
  const w = new Uint32Array(80);
  const rol = (x: number, n: number) => (x << n) | (x >>> (32 - n));
  for (let o = 0; o < padded.length; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 80; i++) w[i] = rol(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
    let a = h0, b = h1, c = h2, d = h3, e = h4;
    for (let i = 0; i < 80; i++) {
      const [f, k] = i < 20 ? [(b & c) | (~b & d), 0x5A827999] : i < 40 ? [b ^ c ^ d, 0x6ED9EBA1] : i < 60 ? [(b & c) | (b & d) | (c & d), 0x8F1BBCDC] : [b ^ c ^ d, 0xCA62C1D6];
      const t = (rol(a, 5) + f + e + k + w[i]) >>> 0;
      e = d; d = c; c = rol(b, 30) >>> 0; b = a; a = t;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
  }
  return [h0, h1, h2, h3, h4].map(x => x.toString(16).padStart(8, "0")).join("");
}

/** Khoá mục: `${ô}:${10 ký tự đầu của sha1(url)}`. Chỉ phụ thuộc ô và địa chỉ, KHÔNG phụ thuộc thứ tự trong danh sách. */
export function itemKey(slot: MediaSlot | string, url: string): string { return `${slot}:${sha1Hex(url.trim()).slice(0, 10)}`; }

const clip = (t: string, n: number): string => { const x = t.trim(); return x.length > n ? x.slice(0, n) : x; };

/** Họ tài liệu từ tên + địa chỉ (đuôi tên trước, rồi đuôi địa chỉ, rồi Google Docs). "file" khi không biết. */
export function docTypeOf(name: string | null | undefined, url: string | null | undefined, hint?: string | null): DocType | "file" {
  const u = (url ?? "").toLowerCase();
  if (/docs\.google\.com\/document/.test(u)) return "word";
  if (/docs\.google\.com\/spreadsheets/.test(u)) return "sheet";
  if (/docs\.google\.com\/presentation/.test(u)) return "slide";
  const byHint = hint ? ({ pdf: "pdf", doc: "word", docx: "word", word: "word", xls: "sheet", xlsx: "sheet", sheet: "sheet", ppt: "slide", pptx: "slide", slide: "slide", img: "image", image: "image", txt: "text", text: "text" } as Record<string, DocType>)[hint.toLowerCase()] : undefined;
  return docTypeFromExt(fileNameExt(name ?? "")) ?? docTypeFromExt(fileExtOf(url ?? "")) ?? byHint ?? "file";
}
/** Giá trị `type` lưu trong Lesson.documents (≤10 ký tự; cùng bộ chữ trang quản trị cũ: pdf/doc/xls/ppt/file). */
export function storedDocType(t: DocType | "file"): string {
  return t === "word" ? "doc" : t === "sheet" ? "xls" : t === "slide" ? "ppt" : t === "image" ? "img" : t === "text" ? "txt" : t;
}

interface RawDoc { name: string; url: string; type: string }
function parseDocs(raw: string | null | undefined): RawDoc[] {
  if (!raw || !raw.trim()) return [];
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    const out: RawDoc[] = [];
    for (const d of v) {
      if (!d || typeof d !== "object") continue;
      const o = d as { name?: unknown; url?: unknown; type?: unknown };
      if (typeof o.url !== "string" || !o.url.trim()) continue;
      out.push({ name: typeof o.name === "string" ? o.name : "", url: o.url.trim(), type: typeof o.type === "string" ? o.type : "" });
    }
    return out;
  } catch { return []; }
}

// ── deriveItems ─────────────────────────────────────────────────────────────

function linkItem(slot: Exclude<MediaSlot, "document">, raw: string): GtItem {
  const kind = KIND_OF_SLOT[slot];
  const info = classifyMediaLink(raw);
  if (!info.ok) return { key: itemKey(slot, raw), kind, slot, name: clip(raw, 60) || "(trống)", url: raw, label: "Link hỏng", storage: "link", warning: info.error, broken: true };
  const check = checkLinkForSlot(raw, slot);
  // Link hợp lệ nhưng nằm sai ô (dữ liệu cũ): vẫn hiện, gắn cảnh báo, không đánh dấu hỏng (học sinh vẫn mở được).
  const warning = check.ok ? info.warning : check.error;
  return { key: itemKey(slot, info.url), kind, slot, name: info.kind === "upload" ? "Video tải lên KiN" : info.label, url: info.url, label: info.label,
    storage: info.kind === "upload" ? "kin" : "link", warning, broken: false };
}

function docItem(d: RawDoc): GtItem {
  const kinId = kinFileIdOf(d.url);
  const name = clip(d.name, MAX_ITEM_NAME) || (kinId ? "Tệp trên KiN" : d.url);
  const dt = docTypeOf(d.name, d.url, d.type);
  if (kinId) return { key: itemKey("document", d.url), kind: "document", slot: "document", name, url: d.url, label: "Tệp trên KiN", storage: "kin", warning: null, broken: false };
  const info = classifyMediaLink(d.url);
  if (!info.ok || info.kind === "upload") return { key: itemKey("document", d.url), kind: "document", slot: "document", name, url: d.url, label: "Link hỏng", storage: "link", warning: info.error ?? "Địa chỉ không hợp lệ.", broken: true };
  const cu = info.url.startsWith("https://res.cloudinary.com/");
  const label = cu ? "Tệp cũ (công khai)" : dt !== "file" ? docTypeLabel(dt) : info.label;
  return { key: itemKey("document", info.url), kind: "document", slot: "document", name, url: info.url, label, storage: cu ? "cloudinary_cu" : "link", warning: info.warning, broken: false };
}

/** Các mục của MỘT bài, suy từ cột: video (1-n link) · Zoom/Meet · Azota/Form · tài liệu; `extra.assignments` thêm một mục chỉ đếm "Bài tập tự nộp". Không bao giờ ném lỗi. */
export function deriveItems(lesson: LessonRow, extra?: { assignments?: number }): GtItem[] {
  const out: GtItem[] = [];
  for (const slot of ["video", "live", "azota"] as const)
    for (const u of parseLinkList(lesson[COLUMN_OF[slot]])) out.push(linkItem(slot, u));
  for (const d of parseDocs(lesson.documents)) out.push(docItem(d));
  const n = extra?.assignments ?? 0;
  if (n > 0) out.push({ key: "assignment:count", kind: "assignment", slot: null, name: "Bài tập tự nộp", url: null, label: "Bài tập tự nộp", storage: "link", warning: null, broken: false, count: n });
  return out;
}

// ── lessonTypeFor ───────────────────────────────────────────────────────────

/** Giống từng ca với deriveTypes + serializeTypes của trang quản trị cũ: có video ⇒ record; có Zoom ⇒ live; có Azota ⇒ quiz; không có gì ⇒ document. Một loại ⇒ chuỗi, nhiều ⇒ mảng JSON. */
export function lessonTypeFor(lesson: LessonRow): string {
  const types: string[] = [];
  if (parseLinkList(lesson.videoUrl).length) types.push("record");
  if (parseLinkList(lesson.zoomUrl).length) types.push("live");
  if (parseLinkList(lesson.azotaUrl).length) types.push("quiz");
  if (!types.length) types.push("document");
  return types.length === 1 ? types[0] : JSON.stringify(types);
}

// ── routeInput ──────────────────────────────────────────────────────────────

function nameFromUrl(url: string, fallback: string): string {
  try {
    const last = decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).pop() ?? "");
    return clip(last, MAX_ITEM_NAME) || fallback;
  } catch { return fallback; }
}

/**
 * Ô tải lên CHUNG: một chỗ nhận cả link lẫn tệp, tự chọn ô đúng, báo lỗi/cảnh báo ngay (chưa gửi gì lên máy chủ).
 *  - link: nhận diện bằng classifyMediaLink + routeToSlot (không bảng riêng); đường dẫn tệp KiN `/api/media/<mã>/file` (dùng lại từ Thư viện) cũng nhận;
 *  - tệp tài liệu: kiểm đuôi/MIME/dung lượng/hạn mức; tệp video: chỉ khi cfg.video.enabled (cờ KIN_VIDEO_UPLOAD), nếu tắt ⇒ lỗi, KHÔNG hiện ô xác nhận video.
 */
export function routeInput(input: { text: string } | { file: { name: string; size: number; type?: string } }, cfg: GtConfig): RouteInputResult {
  if ("file" in input) {
    const f = input.file;
    const ext = fileNameExt(f?.name ?? "");
    if ((VIDEO_EXTS as readonly string[]).includes(ext)) {
      if (!cfg.video.enabled) return { ok: false, error: "Tải video lên chưa bật. Hãy dán link YouTube (Không công khai), Vimeo hoặc Google Drive." };
      const v = validateVideoUpload(f, { enabled: true, driver: "local", maxBytes: cfg.video.maxBytes, reason: null });
      return v.ok ? { ok: true, kind: "video", slot: "video", label: "Video tải lên KiN", warning: null, via: "video_file", suggestedName: clip(f.name.replace(/\.[^.]+$/, ""), MAX_ITEM_NAME) } : { ok: false, error: v.error };
    }
    if (!cfg.document.enabled) return { ok: false, error: `${cfg.document.reason ?? "Tải tệp lên chưa bật."} Hãy dán link Google Drive hoặc link tài liệu.` };
    const BANNED = ["exe", "apk", "bat", "sh", "js", "html", "htm", "svg", "zip", "rar", "7z", "msi", "cmd", "ps1", "jar", "dmg"];
    if (BANNED.includes(ext)) return { ok: false, error: `Tệp "${f.name}": KiN không nhận loại tệp này.` };
    const accepted = cfg.document.exts.length ? cfg.document.exts : [...DOCUMENT_EXTS];
    if (!accepted.includes(ext)) return { ok: false, error: `Tệp "${f.name}" không đúng loại. Chỉ nhận ${accepted.map(e => "." + e).join(", ")}.` };
    const d = validateDocumentFile(f, cfg.document.maxBytes);
    if (!d.ok) return { ok: false, error: d.error };
    if (cfg.document.usedBytes + f.size > cfg.document.quotaBytes) return { ok: false, error: `Kho tài liệu của bạn đã gần đầy (đã dùng ${Math.round(cfg.document.usedBytes / 1048576)} MB trên ${Math.round(cfg.document.quotaBytes / 1048576)} MB). Hãy xoá bớt tệp chưa dùng hoặc dán link.` };
    const dt = docTypeOf(f.name, null);
    return { ok: true, kind: "document", slot: "document", label: dt === "file" ? "Tệp" : docTypeLabel(dt), warning: null, via: "document_file", suggestedName: clip(f.name, MAX_ITEM_NAME) };
  }

  const text = typeof input?.text === "string" ? input.text.trim() : "";
  if (!text) return { ok: false, error: "Chưa dán link hoặc chọn tệp." };
  if (/\s/.test(text)) return { ok: false, error: "Có khoảng trắng trong link. Hãy dán lại đúng một link." };
  if (text.startsWith("/")) {
    if (kinFileIdOf(text)) return { ok: true, kind: "document", slot: "document", label: "Tệp trên KiN", warning: null, via: "link", suggestedName: "Tài liệu" };
    return { ok: false, error: "Đường dẫn này không phải tệp của KiN." };
  }
  const info = classifyMediaLink(text);
  if (!info.ok) return { ok: false, error: info.error ?? "Link chưa đúng." };
  if (info.kind === "other") {
    // Mạng xã hội không phát video được: nói rõ thay vì xếp vào "tài liệu" (xem bảng 4.3).
    let host = "";
    try { host = new URL(info.url).hostname; } catch { /* đã qua classify, không xảy ra */ }
    if (isSocialVideoHost(host)) {
      const r = checkLinkForSlot(text, "video");
      return { ok: false, error: r.error ?? "Hãy đưa video lên YouTube (Không công khai) hoặc Drive rồi dán link đó." };
    }
  }
  const slot = routeToSlot(info);
  const c = checkLinkForSlot(text, slot);
  if (!c.ok) return { ok: false, error: c.error ?? "Link chưa đúng.", ...(c.moveTo ? { moveTo: c.moveTo } : {}) };
  const suggested = slot === "document" ? nameFromUrl(info.url, info.label) : info.label;
  return { ok: true, kind: KIND_OF_SLOT[slot], slot, label: info.label, warning: c.warning ?? info.warning, via: "link", suggestedName: suggested };
}

// ── placeItem / removeItem ──────────────────────────────────────────────────

type PlaceOk = { ok: true; patch: Partial<LessonRow>; duplicate: boolean; item: GtItem };

/**
 * Thêm MỘT mục vào bài: trả bản VÁ cho các cột (người gọi ghi trong giao dịch có khoá). Chặn: link sai ô/hỏng, trùng địa chỉ (duplicate, patch rỗng),
 * quá MAX_LINKS_PER_SLOT link một ô, quá MAX_DOCUMENTS_PER_LESSON tài liệu; tên dài hơn MAX_ITEM_NAME bị cắt (không lỗi).
 */
export function placeItem(lesson: LessonRow, plan: PlaceInput): PlaceOk | { ok: false; error: string; moveTo?: MediaSlot } {
  const raw = (plan?.url ?? "").trim();
  if (!raw) return { ok: false, error: "Thiếu địa chỉ." };

  if (plan.slot !== "document") {
    const c = checkLinkForSlot(raw, plan.slot);
    if (!c.ok || !c.info) return { ok: false, error: c.error ?? "Link chưa đúng.", ...(c.moveTo ? { moveTo: c.moveTo } : {}) };
    const col = COLUMN_OF[plan.slot];
    const list = parseLinkList(lesson[col]);
    const url = c.info.url;
    const key = itemKey(plan.slot, url);
    const dup = list.map(u => classifyMediaLink(u)).find(i => i.ok && itemKey(plan.slot, i.url) === key);
    if (dup) return { ok: true, patch: {}, duplicate: true, item: linkItem(plan.slot, dup.url) };
    if (list.length >= MAX_LINKS_PER_SLOT) return { ok: false, error: `Tối đa ${MAX_LINKS_PER_SLOT} link trong một ô.` };
    const next = { ...lesson, [col]: serializeLinkList([...list, url]) } as LessonRow;
    return { ok: true, patch: { [col]: next[col], type: lessonTypeFor(next) }, duplicate: false, item: linkItem(plan.slot, url) };
  }

  const kinId = kinFileIdOf(raw);
  let url = raw;
  if (!kinId) {
    const c = checkLinkForSlot(raw, "document");
    if (!c.ok || !c.info) return { ok: false, error: c.error ?? "Link chưa đúng.", ...(c.moveTo ? { moveTo: c.moveTo } : {}) };
    url = c.info.url;
  }
  const docs = parseDocs(lesson.documents);
  const key = itemKey("document", url);
  const dup = docs.find(d => itemKey("document", d.url) === key);
  if (dup) return { ok: true, patch: {}, duplicate: true, item: docItem(dup) };
  if (docs.length >= MAX_DOCUMENTS_PER_LESSON) return { ok: false, error: `Mỗi bài tối đa ${MAX_DOCUMENTS_PER_LESSON} tài liệu.` };
  const name = clip(plan.name ?? "", MAX_ITEM_NAME) || (kinId ? "Tài liệu" : nameFromUrl(url, url));
  const entry: RawDoc = { name, url, type: storedDocType(docTypeOf(name, url)) };
  const documents = JSON.stringify([...docs, entry]);
  return { ok: true, patch: { documents }, duplicate: false, item: docItem(entry) };
}

/** Gỡ MỘT mục (theo khoá) khỏi bài; không có thì `removed:false` và patch rỗng (gỡ hai lần không lỗi). Không xoá tệp lưu trữ. */
export function removeItem(lesson: LessonRow, key: string): { removed: boolean; patch: Partial<LessonRow> } {
  for (const slot of ["video", "live", "azota"] as const) {
    const col = COLUMN_OF[slot];
    const list = parseLinkList(lesson[col]);
    const next = list.filter(u => { const i = classifyMediaLink(u); return itemKey(slot, i.ok ? i.url : u) !== key; });
    if (next.length !== list.length) {
      const after = { ...lesson, [col]: serializeLinkList(next) } as LessonRow;
      return { removed: true, patch: { [col]: after[col], type: lessonTypeFor(after) } };
    }
  }
  const docs = parseDocs(lesson.documents);
  const rest = docs.filter(d => itemKey("document", classifyMediaLink(d.url).ok ? classifyMediaLink(d.url).url : d.url) !== key && itemKey("document", d.url) !== key);
  if (rest.length !== docs.length) return { removed: true, patch: { documents: JSON.stringify(rest) } };
  return { removed: false, patch: {} };
}

// ── Thư viện của tôi ────────────────────────────────────────────────────────

export interface LibUse { courseId: string; courseName: string; lessonId: string; lessonTitle: string }
export interface TutorLibItem { url: string; name: string; docType: DocType | "file"; storage: GtItem["storage"]; label: string; broken: boolean; usedIn: LibUse[] }
export interface TutorLibUnattached { id: string; name: string; bytes: number; link: string; docType: DocType | "file" }
export interface TutorLibExamFile { id: string; name: string }
export interface TutorLibrary {
  items: TutorLibItem[];            // gộp theo địa chỉ ⇒ "dùng ở n lớp"
  unattached: TutorLibUnattached[]; // tệp tải lên đã xong mà chưa bài nào tham chiếu
  examFiles: TutorLibExamFile[];    // đề gốc (chỉ xem)
}

/**
 * Gộp tài liệu của mọi bài (đã đọc từ DB) thành Thư viện: cùng địa chỉ ⇒ MỘT mục, `usedIn` liệt kê các bài (mỗi bài một lần).
 * Tệp tải lên mà có bài tham chiếu thì KHÔNG nằm ở nhóm "chưa gắn" (phòng khi cột lessonId lệch với nội dung bài).
 */
export function mergeLibrary(i: {
  lessons: (LibUse & { documents: string | null })[];
  assets: { id: string; name: string; bytes: number | null }[];
  examFiles?: TutorLibExamFile[];
}): TutorLibrary {
  const map = new Map<string, TutorLibItem>();
  for (const l of i.lessons) {
    for (const d of parseDocs(l.documents)) {
      const it = docItem(d);
      const k = it.url ?? d.url;
      let row = map.get(k);
      if (!row) { row = { url: k, name: it.name, docType: docTypeOf(d.name, k, d.type), storage: it.storage, label: it.label, broken: it.broken, usedIn: [] }; map.set(k, row); }
      if (!row.usedIn.some(u => u.lessonId === l.lessonId)) row.usedIn.push({ courseId: l.courseId, courseName: l.courseName, lessonId: l.lessonId, lessonTitle: l.lessonTitle });
    }
  }
  const used = new Set([...map.keys()].map(u => kinFileIdOf(u)).filter((x): x is string => !!x));
  const unattached = i.assets.filter(a => !used.has(a.id)).map(a => ({ id: a.id, name: a.name, bytes: a.bytes ?? 0, link: kinFileLink(a.id), docType: docTypeOf(a.name, null) }));
  return { items: [...map.values()], unattached, examFiles: i.examFiles ?? [] };
}

