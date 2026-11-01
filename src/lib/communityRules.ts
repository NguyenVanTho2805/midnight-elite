// BU-05 — luật THUẦN của cộng đồng (không prisma, không mạng): tên hiển thị, trả lời lồng, kiểm câu hỏi của khách, chữ thông báo.
// Mọi route cộng đồng gọi từ đây để chữ thông báo / cách rút gọn tên chỉ có MỘT nơi.
import type { AuthorTag, CommunityErrorCode } from "@/lib/communityTypes";

// ─── Tên hiển thị ────────────────────────────────────────────────────────────

export type NameSource = {
  name: string;
  role: string;
  adminRole?: string | null;
  tutorVerified?: boolean | null;
};

const FALLBACK_NAME = "Thành viên";

function words(s: string): string[] {
  return s.normalize("NFC").replace(/[\u0000-\u001f\u007f]/g, " ").split(/\s+/).filter(Boolean);
}

// "Nguyễn Văn An" → "An N."; một từ → giữ; rỗng → "Thành viên". Không bao giờ trả chuỗi rỗng.
export function shortName(full: string): string {
  const w = words(full ?? "");
  if (w.length === 0) return FALLBACK_NAME;
  if (w.length === 1) return w[0];
  const first = Array.from(w[0])[0] ?? "";
  const initial = first ? first.toLocaleUpperCase("vi") + "." : "";
  return initial ? `${w[w.length - 1]} ${initial}` : w[w.length - 1];
}

function isStaffWithIdentity(u: NameSource): boolean {
  if (u.role !== "admin") return false;
  if (u.adminRole === "admin_super" || u.adminRole === "admin_content") return true;
  return u.adminRole === "teacher" && u.tutorVerified === true;
}

// Gia sư (đã xác minh) và quản trị: tên đầy đủ. Mọi người khác (kể cả gia sư chưa xác minh): rút gọn.
export function publicName(u: NameSource): string {
  if (isStaffWithIdentity(u)) {
    const w = words(u.name ?? "");
    return w.length ? w.join(" ") : FALLBACK_NAME;
  }
  return shortName(u.name ?? "");
}

export function authorTag(u: NameSource, guest = false): AuthorTag | null {
  if (guest) return "khach";
  if (u.role !== "admin") return null;
  if (u.adminRole === "admin_super" || u.adminRole === "admin_content") return "quan-tri";
  if (u.adminRole === "teacher" && u.tutorVerified === true) return "gia-su";
  return null;
}

// ─── Trả lời lồng đúng 1 cấp ─────────────────────────────────────────────────

export type ParentCandidate = { id: string; threadId: string; parentReplyId: string | null; deletedAt: Date | null };

// Trả id của cha GỐC để gắn vào. Cha khác bài / đã xoá / không có → { ok:false }.
export function normalizeParent(
  threadId: string,
  parent: ParentCandidate | null | undefined,
): { ok: true; rootId: string; childOfChild: boolean } | { ok: false } {
  if (!parent || parent.threadId !== threadId || parent.deletedAt) return { ok: false };
  if (parent.parentReplyId) return { ok: true, rootId: parent.parentReplyId, childOfChild: true };
  return { ok: true, rootId: parent.id, childOfChild: false };
}

// ─── Câu hỏi của khách ───────────────────────────────────────────────────────

// Bỏ ký tự điều khiển (giữ \n khi nhiều dòng), gom khoảng trắng thừa, cắt hai đầu. KHÔNG biến đổi dấu < > (hiển thị là văn bản thuần).
export function cleanText(raw: unknown, multiline = false): string {
  if (typeof raw !== "string") return "";
  let s = raw.normalize("NFC").replace(/\r\n?/g, "\n");
  s = s.replace(multiline ? /[\u0000-\u0009\u000b-\u001f\u007f​-‏‪-‮]/g : /[\u0000-\u001f\u007f​-‏‪-‮]/g, multiline ? "" : " ");
  s = multiline ? s.split("\n").map(l => l.replace(/[ \t]+/g, " ").trim()).join("\n").replace(/\n{3,}/g, "\n\n") : s.replace(/\s+/g, " ");
  return s.trim();
}

export const GUEST_LIMITS = { nameMin: 2, nameMax: 40, titleMin: 5, titleMax: 120, contentMin: 10, contentMax: 600 } as const;

export function hasPhoneOrLink(text: string): boolean {
  const t = (text ?? "").normalize("NFC");
  const collapsed = t.replace(/(?<=\d)[\s.\-](?=\d)/g, "");
  if (/(?<![\d])(?:\+?84|0)\d{9,10}(?!\d)/.test(collapsed)) return true;
  if (/\b(?:https?:\/\/|www\.)\S+/i.test(t)) return true;
  if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(t)) return true;
  if (/(?<![\p{L}\d])[a-z0-9-]{2,}\.(?:me|com|vn|net|org|info|link|gl|ly|io|app)(?![\p{L}\d])/iu.test(t)) return true;
  return false;
}

// Chỉ bắt khi TỰ NÓI rõ số tuổi 6–12 ("em 11 tuổi", "mình 12t"). "lớp 6–9" không phải dấu hiệu (đó là học sinh mục tiêu).
export function declaredAgeUnder13(text: string): boolean {
  const t = (text ?? "").normalize("NFC");
  const re = /(?<![\p{L}])(?:em|mình|minh|tớ|tôi|tui|mik|mk|con|cháu|bé)\s+(?:năm nay\s+|đã\s+|mới\s+|vừa\s+)?(\d{1,2})\s*(?:tuổi|tuoi|t)(?![\p{L}\d])/giu;
  for (const m of t.matchAll(re)) {
    const age = Number(m[1]);
    if (age >= 6 && age <= 12) return true;
  }
  return false;
}

export type GuestInput = { name: unknown; title: unknown; content: unknown };
export type GuestValidation =
  | { ok: true; value: { name: string; title: string; content: string } }
  | { ok: false; code: Extract<CommunityErrorCode, "name_invalid" | "title_invalid" | "content_invalid" | "under_13">; error: string };

export function validateGuestQuestion(input: GuestInput): GuestValidation {
  const L = GUEST_LIMITS;
  const name = cleanText(input.name);
  const title = cleanText(input.title);
  const content = cleanText(input.content, true);
  const len = (s: string) => Array.from(s).length;
  if (len(name) < L.nameMin || len(name) > L.nameMax) {
    return { ok: false, code: "name_invalid", error: `Tên hiển thị cần từ ${L.nameMin} đến ${L.nameMax} ký tự.` };
  }
  if (len(title) < L.titleMin || len(title) > L.titleMax) {
    return { ok: false, code: "title_invalid", error: `Tiêu đề cần từ ${L.titleMin} đến ${L.titleMax} ký tự.` };
  }
  if (len(content) < L.contentMin || len(content) > L.contentMax) {
    return { ok: false, code: "content_invalid", error: `Nội dung cần từ ${L.contentMin} đến ${L.contentMax} ký tự.` };
  }
  if (declaredAgeUnder13(`${name}\n${title}\n${content}`)) {
    return { ok: false, code: "under_13", error: "Em hãy nhờ bố mẹ hoặc người lớn giúp đặt câu hỏi này nhé." };
  }
  return { ok: true, value: { name, title, content } };
}

// ─── Chữ thông báo (không tên, không tiền, không tiêu đề) ────────────────────

export type CommunityNotifKind =
  | "thread_reply" | "thread_reply_child" | "thread_like" | "reply_like"
  | "reply_accepted" | "thread_new_class" | "answer_new" | "answer_accepted";

// `count` chỉ dùng cho thích gộp (số đếm lượt thích, KHÔNG phải tiền).
export function notificationText(kind: CommunityNotifKind, count = 1): { type: string; title: string; message: string } {
  switch (kind) {
    case "thread_reply":
      return { type: "thread_reply", title: "Có trả lời mới", message: "Bài viết của bạn có thêm một trả lời" };
    case "thread_reply_child":
      return { type: "thread_reply", title: "Có trả lời mới", message: "Bình luận của bạn có thêm một trả lời" };
    case "thread_like":
      return { type: "thread_like", title: "Có lượt thích mới", message: count <= 1 ? "Bài viết của bạn có lượt thích mới" : `Bài viết của bạn có ${count} lượt thích mới` };
    case "reply_like":
      return { type: "reply_like", title: "Có lượt thích mới", message: count <= 1 ? "Trả lời của bạn có lượt thích mới" : `Trả lời của bạn có ${count} lượt thích mới` };
    case "reply_accepted":
      return { type: "reply_accepted", title: "Trả lời được chọn", message: "Một trả lời của bạn được chọn là đúng" };
    case "thread_new_class":
      return { type: "thread_new_class", title: "Có bài mới trong lớp", message: "Lớp của bạn có bài mới" };
    case "answer_new":
      return { type: "answer_new", title: "Có câu trả lời mới", message: "Câu hỏi của bạn có câu trả lời mới" };
    case "answer_accepted":
      return { type: "answer_accepted", title: "Câu trả lời được chấp nhận", message: "Một câu trả lời của bạn được chấp nhận" };
  }
}

export const ALL_NOTIF_KINDS: readonly CommunityNotifKind[] = [
  "thread_reply", "thread_reply_child", "thread_like", "reply_like",
  "reply_accepted", "thread_new_class", "answer_new", "answer_accepted",
];

// true nếu chữ "sạch": không xu / Coin / VND / đ đứng riêng / "đồng" tiền; chữ số chỉ cho phép khi `allowDigits`.
export function isCleanNotificationText(s: string, allowDigits = false): boolean {
  if (/(?<![\p{L}])(?:xu|coin|vnd|đ)(?![\p{L}])/iu.test(s)) return false;
  if (/(?<![\p{L}])đồng(?![\p{L}])\s*(?:tiền)?/iu.test(s) && /\d/.test(s)) return false;
  if (!allowDigits && /\d/.test(s)) return false;
  return true;
}

export const threadLink = (threadId: string, replyId?: string) => `/cong-dong/${threadId}${replyId ? `#r-${replyId}` : ""}`;
