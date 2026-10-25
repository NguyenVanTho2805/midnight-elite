// Kiểm link học liệu LÚC LƯU bài (ở máy chủ, không chỉ ở trình duyệt) và gắn video tải lên vào bài. Dùng ở POST /api/chapters/[id]/lessons và PUT /api/lessons/[id].
import { prisma } from "./prisma";
import { checkLinkListForSlot, classifyMediaLink, parseLinkList, uploadIdOf, type MediaSlot } from "./mediaLink";
import { MAX_DOCUMENTS_PER_LESSON } from "./mediaStorage";

const SLOTS: { key: "videoUrl" | "zoomUrl" | "azotaUrl"; slot: MediaSlot; name: string }[] = [
  { key: "videoUrl", slot: "video", name: "Video bài giảng" },
  { key: "zoomUrl", slot: "live", name: "Phòng Zoom" },
  { key: "azotaUrl", slot: "azota", name: "Bài tập Azota" },
];

const norm = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/**
 * Trả câu lỗi tiếng Việt cho ô ĐẦU TIÊN có link sai, hoặc null nếu ổn.
 * Chỉ kiểm ô nào ĐỔI so với bản đang lưu (`existing`): bài cũ có sẵn link lạ vẫn sửa tên/khoá/ghi chú được, như quy tắc NC2-035 của lớp.
 */
export function validateLessonLinks(body: Record<string, unknown>, existing?: Partial<Record<"videoUrl" | "zoomUrl" | "azotaUrl", string | null>>): string | null {
  for (const { key, slot, name } of SLOTS) {
    if (!(key in body)) continue;
    const next = norm(body[key]);
    if (existing && next === norm(existing[key])) continue;
    const r = checkLinkListForSlot(parseLinkList(next), slot);
    if (!r.ok) return `${name}: ${r.error}`;
  }
  return null;
}

/** Danh sách tài liệu (chuỗi JSON mảng): mỗi mục phải có link https an toàn hoặc /api/media nội bộ; tối đa MAX_DOCUMENTS_PER_LESSON. */
export function validateDocumentsJson(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let arr: unknown;
  try { arr = JSON.parse(raw); } catch { return "documents phải là chuỗi JSON dạng mảng"; }
  if (!Array.isArray(arr)) return "documents phải là chuỗi JSON dạng mảng";
  if (arr.length > MAX_DOCUMENTS_PER_LESSON) return `Mỗi bài tối đa ${MAX_DOCUMENTS_PER_LESSON} tài liệu.`;
  for (let i = 0; i < arr.length; i++) {
    const d = arr[i] as { name?: unknown; url?: unknown } | null;
    const url = d && typeof d.url === "string" ? d.url.trim() : "";
    if (!url) return `Tài liệu thứ ${i + 1} thiếu đường dẫn.`;
    if (/^\/api\/media\/[A-Za-z0-9_-]{8,40}\/(stream|file)$/.test(url)) continue;
    const info = classifyMediaLink(url);
    if (!info.ok || info.kind === "upload") return `Tài liệu thứ ${i + 1}: ${info.error ?? "đường dẫn không hợp lệ."}`;
  }
  return null;
}

/**
 * Gắn mọi video "kin-media:<mã>" trong `videoUrl` vào bài, sau khi kiểm: có thật, là video đã tải XONG, thuộc đúng lớp này, và do chính người lưu
 * tải lên (gia sư) hoặc quản trị. Trả câu lỗi hoặc null. Chạy SAU khi bài đã lưu (cần lessonId).
 */
export async function claimUploadedVideos(o: { videoUrl: string | null | undefined; lessonId: string; courseId: string; userId: string; isTeacher: boolean }): Promise<string | null> {
  const ids = parseLinkList(o.videoUrl ?? null).map(uploadIdOf).filter((x): x is string => !!x);
  for (const id of ids) {
    const a = await prisma.fileAsset.findUnique({ where: { id } });
    if (!a || a.kind !== "video") return "Video tải lên không còn. Hãy tải lại.";
    if (a.status !== "ready") return "Video tải lên chưa xong. Đợi tải xong rồi lưu bài.";
    if (a.courseId !== o.courseId) return "Video này thuộc lớp khác, không dùng cho bài này được.";
    if (o.isTeacher && a.ownerId !== o.userId) return "Video này do người khác tải lên.";
    if (a.lessonId !== o.lessonId) await prisma.fileAsset.update({ where: { id }, data: { lessonId: o.lessonId } });
  }
  return null;
}
