// Thư viện (Figma 30:2 "Bản ghi và tài liệu") — phần THUẦN: đọc tài liệu của bài học, nhãn tiến độ xem, trạng thái bài nộp. Không DB, không React.
// Phần có DB: src/lib/libraryServer.ts. Giao diện: src/components/library/LibraryView.tsx.
//
// Dữ liệu: bài học (Lesson) là đơn vị gom — mỗi bài có video (videoUrl), tài liệu (documents), bài tập (Assignment) kèm bài nộp (AssignmentSubmission)
// và tiến độ xem (LessonProgress). Figma gom theo BUỔI có ngày; bài học chưa có ngày nên gom theo bài.

export interface LibDoc { name: string; url: string; type: string }

const MAX_DOCS = 50;
const isHttp = (u: unknown): u is string => typeof u === "string" && /^https?:\/\//i.test(u.trim());

/**
 * Tài liệu của bài học (cột Lesson.documents, kiểu chuỗi). Dạng thật trong dữ liệu là MẢNG JSON `[{ name, url, type? }]` (admin tải lên Cloudinary rồi lưu
 * như vậy; trang bài giảng của học viên cũng đọc bằng JSON.parse). Dạng cũ "nhãn|url" mỗi dòng vẫn nhận để không mất dữ liệu cũ.
 * Chỉ nhận địa chỉ http(s): không để "javascript:" hay đường dẫn lạ lọt ra thẻ <a>.
 */
export function parseLessonDocuments(raw: string | null | undefined): LibDoc[] {
  if (!raw || !raw.trim()) return [];
  const out: LibDoc[] = [];
  const t = raw.trim();
  if (t.startsWith("[") || t.startsWith("{")) {
    try {
      const v = JSON.parse(t);
      for (const d of Array.isArray(v) ? v : []) {
        if (d && typeof d === "object" && isHttp((d as { url?: unknown }).url)) {
          const url = ((d as { url: string }).url).trim();
          const name = typeof (d as { name?: unknown }).name === "string" && (d as { name: string }).name.trim() ? (d as { name: string }).name.trim() : url;
          out.push({ name, url, type: typeof (d as { type?: unknown }).type === "string" ? (d as { type: string }).type : "" });
        }
      }
    } catch { /* JSON hỏng: không đoán, trả rỗng */ }
    return out.slice(0, MAX_DOCS);
  }
  for (const line of raw.split("\n")) {
    const [label, url] = line.split("|").map(s => s.trim());
    if (isHttp(url)) out.push({ name: label || url, url, type: "" });
  }
  return out.slice(0, MAX_DOCS);
}

export type DocKind = "PDF" | "DOC" | "XLS" | "PPT" | "FILE";
/** Nhãn loại tệp ngắn (chip). Ưu tiên `type` đã lưu, rồi đuôi tên tệp, rồi địa chỉ Google Docs/Sheets/Slides. */
export function docKind(d: { name: string; url: string; type?: string }): DocKind {
  const hay = `${d.type ?? ""} ${d.name} ${d.url}`.toLowerCase();
  if (/docs\.google\.com\/document/.test(hay)) return "DOC";
  if (/docs\.google\.com\/spreadsheets/.test(hay)) return "XLS";
  if (/docs\.google\.com\/presentation/.test(hay)) return "PPT";
  const ext = (d.name.split(".").pop() ?? "").toLowerCase();
  const tt = (d.type ?? "").toLowerCase();
  if (tt === "pdf" || ext === "pdf") return "PDF";
  if (["doc", "docx"].includes(tt) || ["doc", "docx"].includes(ext)) return "DOC";
  if (["xls", "xlsx", "csv"].includes(tt) || ["xls", "xlsx", "csv"].includes(ext)) return "XLS";
  if (["ppt", "pptx"].includes(tt) || ["ppt", "pptx"].includes(ext)) return "PPT";
  return "FILE";
}

/** Mở tài liệu ở trang xem trước (giống trang bài giảng): xem trước rồi mới tải, giữ đúng tên gốc. */
export const viewerHref = (name: string, url: string): string => `/xem-tai-lieu?url=${encodeURIComponent(url)}&name=${encodeURIComponent(name)}`;

/** "1:52:04", "52:04", "45 phút", "45p", "1 giờ 52 phút", "1h52" → giây; không hiểu thì null. */
export function parseDurationSeconds(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  const clock = s.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/);
  if (clock) return Number(clock[1] ?? 0) * 3600 + Number(clock[2]) * 60 + Number(clock[3]);
  const h = s.match(/(\d+)\s*(?:giờ|gio|h)/), m = s.match(/(\d+)\s*(?:phút|phut|p|m)\b/), bare = s.match(/^(\d+)$/);
  if (h || m) return (h ? Number(h[1]) * 3600 : 0) + (m ? Number(m[1]) * 60 : 0);
  if (/^\d+\s*h\s*\d+$/.test(s)) { const [a, b] = s.split("h").map(x => Number(x.trim())); return a * 3600 + b * 60; }
  return bare ? Number(bare[1]) * 60 : null;
}

export type LibTone = "xong" | "cho" | "loi" | "mo";

/** Nhãn xem video: chưa xem / đã xem N phút / đã xem xong (từ 90% thời lượng trở lên, khi biết thời lượng). */
export function watchLabel(watchedSeconds: number | null | undefined, durationSec: number | null): { label: string; tone: LibTone } {
  const ws = watchedSeconds ?? 0;
  if (ws <= 0) return { label: "Chưa xem", tone: "mo" };
  if (durationSec && ws >= durationSec * 0.9) return { label: "Đã xem xong", tone: "xong" };
  return { label: `Đã xem ${Math.max(1, Math.round(ws / 60))} phút`, tone: "cho" };
}

// Tính tay theo giờ Việt Nam (UTC+7, không có giờ mùa hè) thay vì Intl: kết quả không phụ thuộc cấu hình ICU của máy chủ ("20/10" hay "20-10").
const VN_OFFSET_MS = 7 * 3_600_000;
export const shortDate = (d: Date): string => {
  const v = new Date(d.getTime() + VN_OFFSET_MS);
  return `${String(v.getUTCDate()).padStart(2, "0")}/${String(v.getUTCMonth() + 1).padStart(2, "0")}`;
};
/** 18.4 → "18,4"; 25 → "25" (dấu phẩy kiểu Việt, một chữ số lẻ, bỏ ".0"). */
export const scoreText = (n: number): string => String(Math.round(n * 10) / 10).replace(".", ",");

/** Trạng thái bài tập của học viên: chưa nộp (còn hạn / quá hạn) · đã nộp chờ chấm · đã chấm kèm điểm. */
export function assignmentStatus(
  a: { dueDate: Date | null; maxPoints: number },
  sub: { score: number | null; gradedAt: Date | null } | null,
  now: Date,
): { label: string; tone: LibTone } {
  if (sub) {
    if (sub.gradedAt && sub.score != null) return { label: `Đã chấm · ${scoreText(sub.score)}/${scoreText(a.maxPoints)}`, tone: "xong" };
    return { label: "Đã nộp · chờ chấm", tone: "cho" };
  }
  if (a.dueDate && a.dueDate.getTime() < now.getTime()) return { label: "Quá hạn · chưa nộp", tone: "loi" };
  if (a.dueDate) return { label: `Chưa nộp · hạn ${shortDate(a.dueDate)}`, tone: "cho" };
  return { label: "Chưa nộp", tone: "mo" };
}

/** Tóm tắt bài tập cho GIA SƯ: bao nhiêu bài nộp, bao nhiêu chờ chấm. */
export function tutorAssignmentSummary(submitted: number, ungraded: number): { label: string; tone: LibTone } {
  if (submitted === 0) return { label: "Chưa có bài nộp", tone: "mo" };
  if (ungraded > 0) return { label: `${submitted} bài nộp · ${ungraded} chờ chấm`, tone: "cho" };
  return { label: `${submitted} bài nộp · đã chấm hết`, tone: "xong" };
}

export const LESSON_TYPE_LABEL: Record<string, string> = { record: "Bản ghi", live: "Học trực tiếp", quiz: "Bài kiểm tra", document: "Tài liệu" };
