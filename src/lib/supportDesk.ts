// KiN Pro F6 — HỖ TRỢ ƯU TIÊN. Quy tắc thuần (không DB) để test; DB ở các tuyến api/tutor/ho-tro và api/admin/ho-tro.
//
// Lời hứa (tài liệu docs/kin/rd/pro/tinh-nang-pro-tra-phi.md F6): Pro được xếp trước và trả lời TRONG GIỜ HÀNH CHÍNH; KHÔNG hứa 24/7, KHÔNG hứa con số giờ nào.
// Lỗi nghiêm trọng và vấn đề riêng tư (kind = "serious") KHÔNG phân tầng: Free và Pro cùng vào làn khẩn, đứng trước mọi yêu cầu khác. Không biến an toàn thành đặc quyền.
import type { PlanCode } from "@/lib/planLimits";

export type SupportKind = "setup" | "payment" | "other" | "serious";
export type SupportStatus = "open" | "answered" | "closed";
export type SupportLane = "serious" | "priority" | "normal";

export const SUPPORT_KINDS: readonly SupportKind[] = ["setup", "payment", "other", "serious"];
export const KIND_LABEL: Record<SupportKind, string> = {
  setup: "Kẹt lúc thiết lập (nhập danh sách, nối SePay…)",
  payment: "Học phí, phiếu, đối soát",
  other: "Việc khác",
  serious: "Lỗi nghiêm trọng hoặc vấn đề riêng tư",
};
export const LANE_LABEL: Record<SupportLane, string> = { serious: "Khẩn", priority: "Ưu tiên", normal: "Thường" };
export const STATUS_LABEL: Record<SupportStatus, string> = { open: "Chờ trả lời", answered: "Đã trả lời", closed: "Đã đóng" };

export const SUBJECT_MIN = 3, SUBJECT_MAX = 120, MESSAGE_MIN = 10, MESSAGE_MAX = 2000, REPLY_MAX = 4000;
/** Mỗi gia sư có tối đa chừng này yêu cầu đang chờ cùng lúc (chống gửi dồn; đếm bằng bảng DB). */
export const MAX_OPEN_PER_USER = 3;

export const PRO_PROMISE = "Gói KiN Pro: yêu cầu của bạn được xếp trước và trả lời trong giờ hành chính.";
export const FREE_PROMISE = "Gói Free: yêu cầu được đọc sau các yêu cầu ưu tiên, KiN chưa cam kết thời gian trả lời.";
export const SERIOUS_PROMISE = "Lỗi nghiêm trọng và vấn đề riêng tư được xem trước tiên, giống nhau ở mọi gói.";
export const PRIVACY_HINT = "Đừng ghi họ tên, số điện thoại, ảnh hay thông tin của học sinh và phụ huynh vào đây. Mô tả việc đang kẹt là đủ.";

export const isSupportKind = (v: unknown): v is SupportKind => typeof v === "string" && (SUPPORT_KINDS as readonly string[]).includes(v);

export function laneOf(kind: SupportKind, plan: PlanCode): SupportLane {
  if (kind === "serious") return "serious";
  return plan === "pro" ? "priority" : "normal";
}
const LANE_RANK: Record<SupportLane, number> = { serious: 0, priority: 1, normal: 2 };

export interface QueueItemLike { kind: string; planAtSend: string; status: string; createdAt: Date | string }

/** Xếp hàng đợi: đang chờ trước đã trả lời trước đã đóng; trong đang chờ: khẩn → ưu tiên → thường; cùng làn thì CŨ NHẤT trước. */
export function sortQueue<T extends QueueItemLike>(items: T[]): T[] {
  const stRank = (s: string) => (s === "open" ? 0 : s === "answered" ? 1 : 2);
  const laneRank = (i: T) => LANE_RANK[laneOf(isSupportKind(i.kind) ? i.kind : "other", i.planAtSend === "pro" ? "pro" : "free")];
  const t = (i: T) => new Date(i.createdAt).getTime();
  return [...items].sort((a, b) => stRank(a.status) - stRank(b.status) || (a.status === "open" ? laneRank(a) - laneRank(b) : 0) || (a.status === "open" ? t(a) - t(b) : t(b) - t(a)));
}

export type ParsedRequest = { ok: true; kind: SupportKind; subject: string; message: string } | { ok: false; error: string };

export function parseSupportInput(body: unknown): ParsedRequest {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  if (!isSupportKind(b.kind)) return { ok: false, error: "Chọn loại việc bạn cần hỗ trợ" };
  const subject = typeof b.subject === "string" ? b.subject.replace(/\s+/g, " ").trim() : "";
  const message = typeof b.message === "string" ? b.message.replace(/\r\n/g, "\n").trim() : "";
  if (subject.length < SUBJECT_MIN) return { ok: false, error: `Tiêu đề cần ít nhất ${SUBJECT_MIN} ký tự` };
  if (subject.length > SUBJECT_MAX) return { ok: false, error: `Tiêu đề tối đa ${SUBJECT_MAX} ký tự` };
  if (message.length < MESSAGE_MIN) return { ok: false, error: `Hãy mô tả việc đang kẹt (ít nhất ${MESSAGE_MIN} ký tự)` };
  if (message.length > MESSAGE_MAX) return { ok: false, error: `Nội dung tối đa ${MESSAGE_MAX} ký tự` };
  return { ok: true, kind: b.kind, subject, message };
}

export function parseReplyInput(body: unknown): { ok: true; action: "reply"; reply: string } | { ok: true; action: "close" } | { ok: false; error: string } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  if (b.action === "close") return { ok: true, action: "close" };
  if (b.action !== "reply") return { ok: false, error: "action phải là reply hoặc close" };
  const reply = typeof b.reply === "string" ? b.reply.replace(/\r\n/g, "\n").trim() : "";
  if (reply.length < 2) return { ok: false, error: "Nhập nội dung trả lời" };
  if (reply.length > REPLY_MAX) return { ok: false, error: `Trả lời tối đa ${REPLY_MAX} ký tự` };
  return { ok: true, action: "reply", reply };
}

export const promiseFor = (plan: PlanCode): string => (plan === "pro" ? PRO_PROMISE : FREE_PROMISE);
