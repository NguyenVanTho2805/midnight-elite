// BU-08 mục 4.4 — loại hàng chờ phụ thuộc NHÁNH CHƯA GỘP: `khach-hoi` (câu hỏi của khách, BU-05) và `vao-lop` (yêu cầu vào lớp, BU-01).
// PHẦN THUẦN (không nhập prisma). Mã này biên dịch và chạy trên `main` khi chưa có model/cột: `detectExternal` trả false → hai loại vắng khoá.
// Dò THEO ĐỊNH NGHĨA (tên model / tên cột trong bản sinh của Prisma), không `try/catch` bắt lỗi truy vấn (lỗi truy vấn có thể che lỗi thật).
import type { GuestRep, JoinRep } from "@/lib/adminQueue";

export interface ExternalSupport { joinRequests: boolean; guestQuestions: boolean }

const has = (o: Record<string, string> | null | undefined, k: string) => !!o && Object.prototype.hasOwnProperty.call(o, k);

/** `modelNames` = `Prisma.ModelName`, `threadFields` = `Prisma.ThreadScalarFieldEnum`. Cần ĐỦ cả `status` lẫn `guestName` mới coi là có câu hỏi của khách. */
export function detectExternal(modelNames: Record<string, string>, threadFields: Record<string, string>): ExternalSupport {
  return { joinRequests: has(modelNames, "ClassJoinRequest"), guestQuestions: has(threadFields, "status") && has(threadFields, "guestName") };
}

const asDate = (v: unknown): Date | null => {
  const d = v instanceof Date ? v : typeof v === "string" ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object";

/**
 * Số điện thoại hoặc đường dẫn trong nội dung (khách có thể là trẻ em): dùng để BẮT tick xác nhận trước khi duyệt.
 * Bản dự phòng của `hasPhoneOrLink` (BU-05, communityRules.ts) khi nhánh đó chưa gộp; thận trọng (thà báo thừa còn hơn sót).
 */
export function looksLikePhoneOrLink(text: string): boolean {
  const t = text.normalize("NFKC");
  if (/(?:\+?84|\b0)[\s.\-]?\d(?:[\s.\-]?\d){7,9}/.test(t)) return true;
  if (/\b\d{9,11}\b/.test(t.replace(/[\s.\-]/g, " ")) || /\d(?:[\s.\-]?\d){8,}/.test(t)) return true;
  return /https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|vn|net|org|me|io|info|edu)\b|\bzalo\b|\bfb\.com|\bt\.me\b/i.test(t);
}

/** Hàng thô từ `thread.findMany` → GuestRep; hàng lạ (thiếu cột, sai kiểu) → null (bị bỏ, không ném). */
export function isGuestRow(x: unknown): x is { id: string; content: string; guestName: string; createdAt: Date | string; title?: unknown } {
  return isObj(x) && typeof x.id === "string" && x.id !== "" && typeof x.content === "string"
    && typeof x.guestName === "string" && x.guestName.trim() !== "" && asDate(x.createdAt) !== null;
}
export function toGuestRep(x: unknown): GuestRep | null {
  if (!isGuestRow(x)) return null;
  const createdAt = asDate(x.createdAt)!;
  const title = typeof x.title === "string" && x.title.trim() ? x.title.trim() : null;
  return { id: x.id, title, content: x.content, guestName: x.guestName.trim(), createdAt, phoneOrLink: looksLikePhoneOrLink(`${title ?? ""} ${x.content}`) };
}

/** Hàng thô từ `classJoinRequest.groupBy({by:["courseId"], _count:{_all}, _min:{createdAt}})`. */
export interface JoinGroupRow { courseId: string; _count: { _all: number }; _min: { createdAt: Date | string } }
export function isJoinGroupRow(x: unknown): x is JoinGroupRow {
  return isObj(x) && typeof x.courseId === "string" && x.courseId !== ""
    && isObj(x._count) && typeof x._count._all === "number" && x._count._all > 0
    && isObj(x._min) && asDate(x._min.createdAt) !== null;
}
/** Ghép nhóm với tên lớp / chủ lớp. Lớp không còn (xoá) → bỏ. KHÔNG mang tên học sinh hay userId. */
export function toJoinRep(g: unknown, courses: Map<string, { name: string; ownerName: string | null }>): JoinRep | null {
  if (!isJoinGroupRow(g)) return null;
  const c = courses.get(g.courseId);
  if (!c) return null;
  return { courseId: g.courseId, courseName: c.name, ownerName: c.ownerName, count: g._count._all, oldestAt: asDate(g._min.createdAt)! };
}
