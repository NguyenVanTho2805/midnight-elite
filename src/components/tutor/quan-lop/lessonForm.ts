// GS-LOP-GON — kiểu dữ liệu + hàm thuần của form bài học, CẮT NGUYÊN VĂN từ admin/khoa-hoc/[id]/page.tsx (chỉ thêm `export`).
// Khác bản gốc: LsForm không còn `pendingDocuments` (tệp tài liệu giờ tải NGAY khi thả, xem DocumentsEditor) .
// LOI-02 (11/11/2026): LessonDB có `scheduledAt` (ISO hoặc null) + `status` (published / draft / hidden); LsForm có ngày + giờ học (giờ VN) và trạng thái.
// Ô Zoom đã bỏ khỏi panel: `zoomUrls` vẫn nạp từ bài (để giữ nhãn "Live" của bài cũ) nhưng KHÔNG gửi khoá zoomUrl khi lưu, và firstBadLink không kiểm ô live nữa.
import { checkLinkForSlot, type MediaSlot } from "@/lib/mediaLink";

export interface LessonDB {
  id: string;
  code: string;
  title: string;
  type: "record" | "live" | "quiz" | "document";
  videoUrl?: string | null;
  zoomUrl?: string | null;
  azotaUrl?: string | null;
  azotaDeadline?: string | null;
  duration?: string | null;
  documents?: string | null;
  adminNote?: string | null;
  isLocked: boolean;
  isFree: boolean;
  statsVideos: number;
  statsMaterials: number;
  statsViews: number;
  order: number;
  /** LOI-02: ngày giờ học (ISO UTC) hoặc null = bài không gắn ngày. */
  scheduledAt?: string | null;
  /** "published" | "draft" | "hidden" (BU-02-PHẲNG). Vắng ⇒ coi là "published". */
  status?: string;
  _count?: { assignments: number };
}
export interface ChapterDB { id: string; title: string; order: number; lessons: LessonDB[] }
export interface SectionDB { id: string; title: string; order: number; chapters: ChapterDB[] }
export interface CourseDB {
  id: string; adminId: number; name: string;
  category: string; instructor: string; status: boolean;
  openDate: string; price: number; originalPrice?: number | null;
  lessons: number; hours: number; tag?: string | null; tagColor?: string | null;
  introVideo?: string | null; zaloGroupLink?: string | null; bg: string; createdAt: string;
  ownerId?: string | null;
  capacity?: number | null; classStatus?: string;
  types: string[];
  sections: SectionDB[];
}

export type PanelMode =
  | { type: "none" }
  | { type: "add-section" }
  | { type: "edit-section"; sectionId: string }
  | { type: "add-chapter"; sectionId: string }
  | { type: "edit-chapter"; sectionId: string; chapterId: string }
  | { type: "add-lesson"; sectionId: string; chapterId: string }
  | { type: "edit-lesson"; sectionId: string; chapterId: string; lessonId: string };

export type DelTarget =
  | { kind: "section"; sectionId: string; label: string }
  | { kind: "chapter"; sectionId: string; chapterId: string; label: string }
  | { kind: "lesson"; sectionId: string; chapterId: string; lessonId: string; label: string }
  | null;

export interface TitleForm { title: string }
export interface LsForm {
  title: string;
  videoUrls: string[]; zoomUrls: string[]; azotaUrls: string[];
  azotaDeadline: string; duration: string;
  isLocked: boolean; isFree: boolean;
  documentsRaw: string;
  adminNote: string;
  /** LOI-02: "YYYY-MM-DD" và "HH:mm" theo giờ VN; cả hai rỗng = không gắn ngày. */
  scheduledDate: string;
  scheduledTime: string;
  /** Trạng thái bài (đổi qua PATCH …/giao-trinh/trang-thai, không qua PUT bài). */
  status: LessonStatusValue;
}

export type LessonStatusValue = "published" | "draft" | "hidden";
export const LESSON_STATUS_OPTIONS: { value: LessonStatusValue; label: string }[] = [
  { value: "published", label: "Đã đăng" },
  { value: "draft", label: "Nháp" },
  { value: "hidden", label: "Ẩn" },
];
/** Chip CHỮ trên hàng bài (chỉ khi không phải Đã đăng — TRẺ EM: cô phải biết học sinh chưa thấy bài). */
export const LESSON_STATUS_CHIP: Record<string, string> = {
  draft: "Nháp · học sinh chưa thấy",
  hidden: "Ẩn · học sinh không thấy",
};
export const lessonStatusOf = (s: string | null | undefined): LessonStatusValue => (s === "draft" || s === "hidden" ? s : "published");

export const INIT_LS: LsForm = {
  title: "",
  videoUrls: [""], zoomUrls: [""], azotaUrls: [""],
  azotaDeadline: "", duration: "", isLocked: true, isFree: false,
  documentsRaw: "[]", adminNote: "",
  scheduledDate: "", scheduledTime: "", status: "published",
};

export function parseUrls(raw: string | null | undefined): string[] {
  if (!raw) return [""];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length) return parsed as string[];
  } catch { /* plain string */ }
  return [raw];
}

export function serializeUrls(urls: string[]): string | null {
  const filtered = urls.map(u => u.trim()).filter(Boolean);
  if (!filtered.length) return null;
  if (filtered.length === 1) return filtered[0];
  return JSON.stringify(filtered);
}

/** Câu lỗi đầu tiên nếu có link sai ô (máy chủ cũng kiểm lại lúc lưu: đây chỉ để báo sớm, trước khi tải tài liệu lên).
 *  LOI-02: không kiểm ô "live" (Zoom) — ô đã bỏ khỏi panel, link cũ cô không sửa được nên không được chặn lưu. */
export function firstBadLink(ls: LsForm): string | null {
  const slots: [string[], MediaSlot, string][] = [[ls.videoUrls, "video", "Video bài giảng"], [ls.azotaUrls, "azota", "Bài Azota"]];
  for (const [urls, slot, name] of slots) {
    for (const u of urls) { if (!u.trim()) continue; const r = checkLinkForSlot(u, slot); if (!r.ok) return `${name}: ${r.error}`; }
  }
  return null;
}

export function parseTypes(raw: string | null | undefined): LessonDB["type"][] {
  if (!raw) return ["document"];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length) return parsed as LessonDB["type"][];
  } catch { /* plain string */ }
  return [raw as LessonDB["type"]];
}

export function deriveTypes(vUrls: string[], zUrls: string[], aUrls: string[]): LessonDB["type"][] {
  const types: LessonDB["type"][] = [];
  if (vUrls.some(u => u.trim())) types.push("record");
  if (zUrls.some(u => u.trim())) types.push("live");
  if (aUrls.some(u => u.trim())) types.push("quiz");
  return types.length ? types : ["document"];
}

export function serializeTypes(types: LessonDB["type"][]): string {
  if (types.length === 1) return types[0];
  return JSON.stringify(types);
}

// Nhãn "quiz" cố tình KHÔNG ghi "Bài Tập" — dễ hiểu nhầm là tính năng "Bài tập
// tự nộp" (AssignmentEditor, bảng Assignment riêng). "quiz" ở đây chỉ nghĩa là
// có link Azota ngoài (xem deriveTypes) — badge riêng cho bài tập tự nộp thật
// xem ASSIGNMENT_BADGE bên dưới, tính từ lesson._count.assignments.
export const TYPE_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  record:   { label: "Video",    color: "var(--kin-nhan-link)", bg: "var(--kin-nhan-nen-nhat)" },
  document: { label: "Tài liệu", color: "var(--kin-chu-mo)", bg: "var(--kin-chu-tren-nut-chinh)" },
  quiz:     { label: "Azota",    color: "var(--kin-nhan-link)", bg: "var(--kin-chu-tren-nut-chinh)" },
  live:     { label: "Live",     color: "var(--kin-tt-chu-loi)", bg: "var(--kin-chu-tren-nut-chinh)" },
};
export const ASSIGNMENT_BADGE = { color: "var(--kin-tt-chu-cho)", bg: "var(--kin-chu-tren-nut-chinh)" };

export function hasRealDocuments(raw: string | null | undefined): boolean {
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0;
  } catch {
    return false;
  }
}
