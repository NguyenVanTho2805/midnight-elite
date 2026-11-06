// "Hàng chờ" của vỏ quản trị (Figma 608:1515). PHẦN THUẦN: nhận các hàng đã đọc từ cơ sở dữ liệu, trả MỘT danh sách gộp
// (8 loại: hồ sơ gia sư · báo cáo bài viết · báo cáo hồ sơ gia sư · báo cáo câu trả lời · đánh giá khoá học · nạp Coin
//  · câu hỏi của khách [BU-05] · yêu cầu vào lớp [BU-01, chỉ đọc]) kèm chi tiết cho panel bên.
// Quy tắc: mỗi dòng là MỘT việc đang chờ người có quyền ra tay; người chờ lâu nhất xếp trước (FIFO theo (at, id)).
//  • Không bao giờ có email/điện thoại của học sinh trong dòng; tên học sinh rút gọn "Bích T." (xem shortName). Ngoại lệ có chủ đích: đơn gia sư (người lớn tự khai).
//  • KHÔNG có đường duyệt mới: mọi lệnh trỏ vào API duyệt đã có. Gia sư (teacher) KHÔNG BAO GIỜ thấy hàng chờ quản trị (canSeeKind).
//  • Tiền chỉ ở dạng chuỗi hiển thị; không có phép tính tiền nào ở đây.
import { addDaysKey, hmOf, vnDateKeyOf, vnMinutesOfDay } from "@/lib/classSessions";
import { checkPermission, PERMISSIONS, type AdminRole, type Permission } from "@/lib/permissions";
import { COIN_VISIBLE, COIN_QUEUE_KIND } from "@/lib/features";
import type { ExternalSupport } from "@/lib/adminQueueExternal";

export const MAX_QUEUE_ITEMS = 100;
export const DEFAULT_PAGE_LIMIT = 50;
export const SNIPPET = 70;
/** Làm hàng loạt: tối đa bao nhiêu dòng một lần, và đếm ngược bao nhiêu giây trước khi thật sự gửi (cho phép Hoàn tác). */
export const MAX_BULK = 25;
export const UNDO_SECONDS = 5;
/** Yêu cầu vào lớp chờ từ ngần này ngày trở lên thì tô đỏ và tính vào "Hôm nay". */
export const JOIN_SLOW_DAYS = 3;
const H = 3_600_000;

export const QUEUE_KINDS = ["gia-su", "bai-viet", "ho-so", "tra-loi", "danh-gia", "nap-coin", "khach-hoi", "vao-lop"] as const;
export type QueueKind = (typeof QUEUE_KINDS)[number];
/** `duyet` = tính vào badge; `theo-doi` = chỉ để quản trị thấy (yêu cầu vào lớp do gia sư duyệt, admin không có quyền duyệt). */
export type QueueGroup = "duyet" | "theo-doi";
export type QueueTone = "cho" | "loi" | "mo" | "xong";

export const QUEUE_KIND_LABEL: Record<QueueKind, string> = {
  "gia-su": "Hồ sơ gia sư", "bai-viet": "Bài viết", "ho-so": "Hồ sơ bị báo cáo", "tra-loi": "Câu trả lời",
  "danh-gia": "Đánh giá", "nap-coin": "Nạp Coin", "khach-hoi": "Câu hỏi của khách", "vao-lop": "Yêu cầu vào lớp",
};
export const QUEUE_KIND_GROUP: Record<QueueKind, QueueGroup> = {
  "gia-su": "duyet", "bai-viet": "duyet", "ho-so": "duyet", "tra-loi": "duyet", "danh-gia": "duyet", "nap-coin": "duyet", "khach-hoi": "duyet", "vao-lop": "theo-doi",
};
/** Quyền cần có để THẤY loại này (ngoài việc phải là quản lý trung tâm). */
export const QUEUE_KIND_PERMISSION: Record<QueueKind, Permission> = {
  "gia-su": PERMISSIONS.MANAGE_TUTORS, "bai-viet": PERMISSIONS.MANAGE_COMMUNITY, "ho-so": PERMISSIONS.MANAGE_TUTORS, "tra-loi": PERMISSIONS.MANAGE_COMMUNITY,
  "danh-gia": PERMISSIONS.MANAGE_COURSES, "nap-coin": PERMISSIONS.MANAGE_REVENUE, "khach-hoi": PERMISSIONS.MANAGE_COMMUNITY, "vao-lop": PERMISSIONS.MANAGE_TUTORS,
};
/** Loại còn tùy nhánh chưa gộp (BU-01 / BU-05): chỉ hiện khi `detectExternal` báo có. */
export const EXTERNAL_KINDS: readonly QueueKind[] = ["khach-hoi", "vao-lop"];

export const isQueueKind = (s: unknown): s is QueueKind => typeof s === "string" && (QUEUE_KINDS as readonly string[]).includes(s);

/** Gia sư và mọi vai khác quản lý trung tâm: KHÔNG BAO GIỜ. Quản lý trung tâm: theo quyền của từng loại. */
export function canSeeKind(role: AdminRole | undefined | null, kind: QueueKind): boolean {
  if (role !== "admin_super" && role !== "admin_content") return false;
  return checkPermission(role, QUEUE_KIND_PERMISSION[kind]);
}
/** Các loại người này được xem; loại ngoài (B) chỉ có khi `support` báo đã có model. Không truyền `support` = coi như chưa có. */
export function visibleKinds(role: AdminRole | undefined | null, support?: ExternalSupport): QueueKind[] {
  return QUEUE_KINDS.filter(k => canSeeKind(role, k)
    && (COIN_VISIBLE || k !== COIN_QUEUE_KIND) // Coin ẩn: không liệt kê, không đếm, không vào badge
    && (k !== "khach-hoi" || !!support?.guestQuestions)
    && (k !== "vao-lop" || !!support?.joinRequests));
}
/** Badge = tổng số đếm CHÍNH XÁC của các loại thuộc nhóm `duyet`. Không bao giờ cắt ở số dòng trả về. */
export function badgeOf(counts: Partial<Record<QueueKind, number>>): number {
  return QUEUE_KINDS.reduce((s, k) => s + (QUEUE_KIND_GROUP[k] === "duyet" && (COIN_VISIBLE || k !== COIN_QUEUE_KIND) ? counts[k] ?? 0 : 0), 0);
}

/** Một việc người duyệt có thể làm trên dòng này. Gọi đúng API xử lý đã có, không có đường xử lý mới. */
export interface QueueAction {
  key: "approve" | "reject" | "remove" | "keep" | "lock" | "dismiss";
  label: string;
  kind: "primary" | "secondary" | "danger";
  method: "POST" | "PATCH";
  url: string;
  body?: Record<string, unknown>;
  /** Phải nhập lý do trước khi gửi (API từ chối nếu thiếu). Lý do được gửi trong body với khoá `reason`. */
  reason?: { label: string; max: number };
  /** Hỏi lại một câu trước khi gửi (việc không hoàn tác được). */
  confirm?: string;
  /** Phải tick ô này (nhãn = chuỗi) trước khi nút mở: đối chiếu sao kê, hiểu sẽ trừ Coin, đã xem không lộ số điện thoại. */
  ack?: string;
  /** Không bấm được, kèm lý do hiển thị cho người duyệt. */
  disabled?: string;
}
export interface QueueLink { label: string; href: string }
export interface QueueSection { title: string; text: string }

export interface QueueItem {
  id: string;
  kind: QueueKind;
  group: QueueGroup;
  title: string;
  subtitle: string;
  /** Cột "Từ ai": tên rút gọn (học sinh) hoặc tên đầy đủ (nhân sự, đơn gia sư) hoặc tên lớp (vao-lop). */
  who: string;
  /** Cột "Ở đâu": lớp / nguồn. */
  place: string;
  at: string;
  /** Nhãn ngắn bên phải dòng: giờ nếu hôm nay, "Hôm qua", hoặc "22/09". */
  when: string;
  status: { label: string; tone: QueueTone };
  /** Đúng MỘT lệnh nhanh ngoài hàng (khoá của một action trong detail.actions), hoặc không có. Hiện chỉ `danh-gia`: "approve". */
  quick?: QueueAction["key"];
  /** Các lệnh được phép làm hàng loạt (chỉ lệnh an toàn; không bao giờ tiền / trừ Coin / gỡ / khoá). */
  bulk: QueueAction["key"][];
  flags?: { phoneOrLink?: boolean };
  detail: { heading: string; meta: string; sections: QueueSection[]; actions: QueueAction[]; links: QueueLink[] };
}

export interface TutorApp { id: string; name: string; email: string; phone: string | null; city: string | null; emailVerified: boolean; bio: string | null; subjects: string[]; appliedAt: Date }
export interface ThreadRep { id: string; reason: string; createdAt: Date; reporter: string; reporterStaff?: boolean; author: string; authorStaff?: boolean; content: string; course: string | null }
export interface ProfileRep { id: string; tutorId: string; tutorName: string; reason: string; detail: string | null; channel: string | null; createdAt: Date }
export interface AnswerRep { id: string; reason: string; createdAt: Date; reporter: string; reporterStaff?: boolean; author: string; authorStaff?: boolean; content: string; questionTitle: string; rewardPaid: number }
export interface ReviewRep { id: string; rating: number; comment: string; createdAt: Date; reviewer: string; reviewerStaff?: boolean; courseId: string; courseName: string }
export interface TopupRep { id: string; requesterId: string; requester: string; requesterStaff?: boolean; amountVnd: number; coinAmount: number; bankRef: string | null; note: string | null; createdAt: Date }
export interface GuestRep { id: string; title: string | null; content: string; guestName: string; createdAt: Date; phoneOrLink: boolean }
export interface JoinRep { courseId: string; courseName: string; ownerName: string | null; count: number; oldestAt: Date }

const dm = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}`;
export const clip = (s: string, n: number) => { const t = s.replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t; };

/** "Trần Thị Bích" → "Bích T." (từ cuối + chữ cái đầu họ); một từ giữ nguyên; nhân sự (`staff`) hiện đủ tên. Học sinh có thể dưới 16 tuổi. */
export function shortName(name: string | null | undefined, staff = false): string {
  const t = (name ?? "").replace(/\s+/g, " ").trim();
  if (!t) return "Người dùng";
  if (staff) return t;
  const parts = t.split(" ");
  if (parts.length < 2) return t;
  return `${parts[parts.length - 1]} ${parts[0][0].toLocaleUpperCase("vi")}.`;
}

/** Số tiền chỉ để HIỂN THỊ: "1.250.000 đ". Không dùng để cộng/trừ. */
export function formatVndText(n: number): string {
  const v = Number.isFinite(n) ? Math.trunc(n) : 0;
  return `${String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ".")} đ`.replace(/^/, v < 0 ? "-" : "");
}

/** "23:02" nếu hôm nay, "Hôm qua", còn lại "22/09". */
export function agoLabel(at: Date, now: Date): string {
  const k = vnDateKeyOf(at), today = vnDateKeyOf(now);
  if (k === today) return hmOf(vnMinutesOfDay(at));
  if (k === addDaysKey(today, -1)) return "Hôm qua";
  return dm(k);
}

/** "đã chờ 3 ngày" / "đã chờ 5 giờ" / "vừa gửi". */
export function waitedText(at: Date, now: Date): string {
  const ms = Math.max(0, now.getTime() - at.getTime());
  const d = Math.floor(ms / (24 * H)), h = Math.floor(ms / H), m = Math.floor(ms / 60_000);
  return d >= 1 ? `đã chờ ${d} ngày` : h >= 1 ? `đã chờ ${h} giờ` : m >= 1 ? `đã chờ ${m} phút` : "vừa gửi";
}

const sentMeta = (at: Date, now: Date) => `gửi lúc ${hmOf(vnMinutesOfDay(at))} ${dm(vnDateKeyOf(at))} · ${waitedText(at, now)}`;

// ── Con trỏ phân trang: base64url của "at|id" ────────────────────────────────────────────────────
export interface QueueCursor { at: string; id: string }
export function encodeCursor(c: QueueCursor): string {
  return btoa(`${c.at}|${c.id}`).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
/** null nếu hỏng (giao diện nhận 400). */
export function decodeCursor(s: string | null | undefined): QueueCursor | null {
  if (!s || !/^[A-Za-z0-9_-]+$/.test(s)) return null;
  try {
    const raw = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4));
    const i = raw.indexOf("|");
    if (i < 1) return null;
    const at = raw.slice(0, i), id = raw.slice(i + 1);
    if (!id || !/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(at) || Number.isNaN(new Date(at).getTime())) return null;
    return { at, id };
  } catch { return null; }
}
/** Dòng nằm SAU con trỏ theo thứ tự (at, id)? */
export const afterCursor = (it: { at: string; id: string }, c: QueueCursor) => it.at > c.at || (it.at === c.at && it.id > c.id);
export const sortQueue = <T extends { at: string; id: string }>(a: T[]): T[] => [...a].sort((x, y) => x.at.localeCompare(y.at) || x.id.localeCompare(y.id));

// ── Dựng dòng từng loại ──────────────────────────────────────────────────────────────────────────
const base = { group: "duyet" as const, bulk: [] as QueueAction["key"][] };

function tutorItem(t: TutorApp, now: Date): QueueItem {
  const subj = t.subjects.length ? t.subjects.join(", ") : "Chưa ghi môn dạy";
  const verified = t.emailVerified;
  return {
    ...base, id: `gia-su:${t.id}`, kind: "gia-su",
    title: `Hồ sơ gia sư: ${t.name}`, subtitle: `${subj}${t.city ? ` · ${t.city}` : ""}`,
    who: t.name, place: "Đơn xin làm gia sư",
    at: t.appliedAt.toISOString(), when: agoLabel(t.appliedAt, now),
    status: verified ? { label: "Chờ duyệt", tone: "cho" } : { label: "Chưa xác thực email", tone: "loi" },
    detail: {
      heading: `Hồ sơ gia sư: ${t.name}`, meta: `Nộp đơn lúc ${hmOf(vnMinutesOfDay(t.appliedAt))} ${dm(vnDateKeyOf(t.appliedAt))} · ${waitedText(t.appliedAt, now)}`,
      sections: [
        { title: "Giới thiệu", text: t.bio?.trim() || "Người nộp đơn chưa viết giới thiệu." },
        { title: "Môn dạy", text: subj },
        { title: "Liên hệ", text: `${t.email}${t.phone ? ` · ${t.phone}` : ""}${t.city ? ` · ${t.city}` : ""}` },
        ...(verified ? [] : [{ title: "Chưa duyệt được", text: "Người nộp đơn chưa xác thực email. Chờ họ xác thực rồi mới duyệt, để quyền gia sư không cấp nhầm cho email của người khác." }]),
      ],
      actions: [
        { key: "approve", label: "Duyệt gia sư", kind: "primary", method: "POST", url: `/api/admin/tutor-applications/${t.id}/approve`,
          ...(verified ? {} : { disabled: "Người nộp đơn chưa xác thực email." }) },
        { key: "reject", label: "Từ chối", kind: "secondary", method: "POST", url: `/api/admin/tutor-applications/${t.id}/reject`, reason: { label: "Lý do từ chối (người nộp sẽ đọc được)", max: 500 } },
      ],
      links: [{ label: "Xem lịch sử đơn gia sư", href: "/admin/gia-su" }],
    },
  };
}

function threadItem(r: ThreadRep, now: Date): QueueItem {
  const reporter = shortName(r.reporter, r.reporterStaff), author = shortName(r.author, r.authorStaff);
  return {
    ...base, id: `bai-viet:${r.id}`, kind: "bai-viet",
    title: `Bài viết bị báo cáo`, subtitle: clip(r.content, SNIPPET),
    who: reporter, place: r.course ?? "Cộng đồng chung",
    at: r.createdAt.toISOString(), when: agoLabel(r.createdAt, now),
    status: { label: "Chờ xử lý", tone: "cho" }, bulk: ["keep"],
    detail: {
      heading: `Bài viết của ${author} bị báo cáo`, meta: sentMeta(r.createdAt, now),
      sections: [
        { title: "Nội dung bài viết", text: r.content.trim() || "(bài không có chữ)" },
        { title: "Lý do báo cáo", text: r.reason.trim() || "Người báo cáo không ghi lý do." },
        { title: "Người báo cáo", text: `${reporter} · bài của ${author} · ${r.course ?? "cộng đồng chung"}` },
      ],
      actions: [
        { key: "remove", label: "Gỡ bài viết", kind: "primary", method: "POST", url: `/api/admin/thread-reports/${r.id}/resolve`, body: { decision: "approved" },
          confirm: "Bài viết sẽ bị gỡ khỏi cộng đồng (hệ thống vẫn lưu lại để đối chiếu)." },
        { key: "keep", label: "Giữ bài lại", kind: "secondary", method: "POST", url: `/api/admin/thread-reports/${r.id}/resolve`, body: { decision: "rejected" } },
      ],
      links: [{ label: "Mở trang cộng đồng", href: "/admin/cong-dong" }],
    },
  };
}

function profileItem(r: ProfileRep, now: Date): QueueItem {
  return {
    ...base, id: `ho-so:${r.id}`, kind: "ho-so",
    title: `Hồ sơ gia sư bị báo cáo: ${r.tutorName}`, subtitle: clip(r.reason, SNIPPET),
    who: r.tutorName, place: r.channel?.trim() || "Hồ sơ công khai",
    at: r.createdAt.toISOString(), when: agoLabel(r.createdAt, now),
    status: { label: "Chờ xử lý", tone: "cho" }, bulk: ["dismiss"],
    detail: {
      heading: `Hồ sơ của ${r.tutorName} bị báo cáo`, meta: sentMeta(r.createdAt, now),
      sections: [
        { title: "Lý do báo cáo", text: r.reason.trim() },
        ...(r.detail?.trim() ? [{ title: "Chi tiết", text: r.detail.trim() }] : []),
        ...(r.channel ? [{ title: "Báo cáo từ", text: r.channel }] : []),
        { title: "Khoá hồ sơ làm gì", text: "Khoá chỉ ẩn hồ sơ công khai của gia sư (người xem thấy trang không tồn tại). Gia sư vẫn dùng sổ lớp bình thường và có thể được mở khoá sau." },
      ],
      actions: [
        { key: "lock", label: "Khoá hồ sơ công khai", kind: "primary", method: "PATCH", url: `/api/admin/profile-reports/${r.id}`, body: { action: "lock" }, reason: { label: "Lý do khoá hồ sơ", max: 500 } },
        { key: "dismiss", label: "Bỏ qua báo cáo", kind: "secondary", method: "PATCH", url: `/api/admin/profile-reports/${r.id}`, body: { action: "dismiss" } },
      ],
      links: [{ label: "Mở bảng phễu gia sư", href: "/admin/pheu" }],
    },
  };
}

/**
 * Báo cáo câu trả lời: "xác nhận vi phạm" có thể TRỪ COIN của người trả lời (khi câu trả lời đã được trả thưởng).
 * Xử lý được ngay trong panel NHƯNG nút chỉ mở sau khi tick "Tôi hiểu sẽ trừ N Coin"; không bao giờ hàng loạt, không có lệnh nhanh.
 */
function answerItem(r: AnswerRep, now: Date): QueueItem {
  const reporter = shortName(r.reporter, r.reporterStaff), author = shortName(r.author, r.authorStaff);
  const paid = r.rewardPaid > 0 ? Math.trunc(r.rewardPaid) : 0;
  return {
    ...base, id: `tra-loi:${r.id}`, kind: "tra-loi",
    title: `Câu trả lời bị báo cáo`, subtitle: clip(r.questionTitle, SNIPPET),
    who: reporter, place: "Hỏi đáp",
    at: r.createdAt.toISOString(), when: agoLabel(r.createdAt, now),
    status: { label: "Chờ xử lý", tone: "cho" },
    detail: {
      heading: `Câu trả lời của ${author} bị báo cáo`, meta: sentMeta(r.createdAt, now),
      sections: [
        { title: "Câu hỏi", text: r.questionTitle },
        { title: "Câu trả lời", text: r.content.trim() || "(không có chữ)" },
        { title: "Lý do báo cáo", text: r.reason.trim() || "Người báo cáo không ghi lý do." },
        { title: "Người báo cáo", text: `${reporter} · câu trả lời của ${author}` },
        ...(paid > 0 ? [{ title: COIN_VISIBLE ? "Sẽ trừ Coin" : "Sẽ trừ lại phần thưởng", text: COIN_VISIBLE ? `Sẽ trừ ${paid} Coin của ${author}. Câu trả lời này đã được trả thưởng; xác nhận vi phạm sẽ trừ lại phần thưởng.` : `Câu trả lời này đã được trả thưởng; xác nhận vi phạm sẽ trừ lại phần thưởng của ${author}.` }] : []),
      ],
      actions: [
        { key: "remove", label: "Xác nhận vi phạm", kind: "primary", method: "POST", url: `/api/admin/answer-reports/${r.id}/resolve`, body: { decision: "approved" },
          ...(paid > 0 ? { ack: COIN_VISIBLE ? `Tôi hiểu sẽ trừ ${paid} Coin của ${author}` : `Tôi hiểu sẽ trừ lại phần thưởng của ${author}` } : {}) },
        { key: "keep", label: "Giữ câu trả lời", kind: "secondary", method: "POST", url: `/api/admin/answer-reports/${r.id}/resolve`, body: { decision: "rejected" } },
      ],
      links: [{ label: "Mở trang cộng đồng", href: "/admin/cong-dong" }],
    },
  };
}

function reviewItem(r: ReviewRep, now: Date): QueueItem {
  const who = shortName(r.reviewer, r.reviewerStaff);
  const stars = Math.min(5, Math.max(0, Math.trunc(r.rating)));
  return {
    ...base, id: `danh-gia:${r.id}`, kind: "danh-gia",
    title: `Đánh giá · ${r.courseName} · ${stars} sao`, subtitle: clip(r.comment, SNIPPET),
    who, place: r.courseName,
    at: r.createdAt.toISOString(), when: agoLabel(r.createdAt, now),
    status: { label: "Chờ duyệt", tone: "cho" }, quick: "approve", bulk: ["approve", "reject"],
    detail: {
      heading: `Đánh giá của ${who} cho ${r.courseName}`, meta: sentMeta(r.createdAt, now),
      sections: [
        { title: "Số sao", text: `${stars} / 5` },
        { title: "Nhận xét", text: r.comment.trim() || "(không có chữ)" },
        { title: "Người đánh giá", text: `${who} · ${r.courseName}` },
      ],
      actions: [
        { key: "approve", label: "Duyệt", kind: "primary", method: "PATCH", url: `/api/admin/reviews/${r.id}`, body: { status: "approved" } },
        { key: "reject", label: "Từ chối", kind: "secondary", method: "PATCH", url: `/api/admin/reviews/${r.id}`, body: { status: "rejected" } },
      ],
      links: [{ label: "Mở lớp", href: `/admin/khoa-hoc/${r.courseId}` }],
    },
  };
}

/** Nạp Coin: gọi ĐÚNG API duyệt cũ (không đổi). Số tiền khai báo chỉ là chuỗi hiển thị. Không tự duyệt yêu cầu của chính mình (chỉ chặn ở giao diện — API chưa chặn, xem phiếu bàn giao). */
function topupItem(r: TopupRep, now: Date, viewerId: string | null): QueueItem {
  const who = shortName(r.requester, r.requesterStaff);
  const self = !!viewerId && r.requesterId === viewerId;
  const coin = Math.trunc(r.coinAmount);
  return {
    ...base, id: `nap-coin:${r.id}`, kind: "nap-coin",
    title: `Nạp Coin · ${coin} Coin`, subtitle: `Khai báo ${formatVndText(r.amountVnd)} · mã ${r.bankRef?.trim() || "không có"}`,
    who, place: "Nạp Coin",
    at: r.createdAt.toISOString(), when: agoLabel(r.createdAt, now),
    status: { label: "Chờ đối chiếu", tone: "cho" },
    detail: {
      heading: `Yêu cầu nạp Coin của ${who}`, meta: sentMeta(r.createdAt, now),
      sections: [
        { title: "Số tiền khai báo", text: formatVndText(r.amountVnd) },
        { title: "Số Coin sẽ cộng", text: `${coin} Coin` },
        { title: "Mã tham chiếu", text: r.bankRef?.trim() || "Người nạp không ghi mã." },
        { title: "Ghi chú của người nạp", text: r.note?.trim() || "Không có ghi chú." },
        { title: "Cách duyệt", text: "Đối chiếu số tiền và mã với sao kê ngân hàng rồi mới duyệt. Duyệt cộng Coin vào ví đúng một lần." },
      ],
      actions: [
        { key: "approve", label: "Duyệt nạp Coin", kind: "primary", method: "POST", url: `/api/admin/topups/${r.id}/approve`, ack: "Đã đối chiếu sao kê",
          ...(self ? { disabled: "Không tự duyệt yêu cầu của chính mình" } : {}) },
        { key: "reject", label: "Từ chối", kind: "secondary", method: "POST", url: `/api/admin/topups/${r.id}/reject`, reason: { label: "Lý do từ chối (người nạp sẽ đọc được)", max: 500 } },
      ],
      links: [{ label: "Xem lịch sử nạp Coin", href: "/admin/topups" }],
    },
  };
}

function guestItem(r: GuestRep, now: Date): QueueItem {
  const head = clip(r.title?.trim() || r.content, 50);
  return {
    ...base, id: `khach-hoi:${r.id}`, kind: "khach-hoi",
    title: `Câu hỏi của khách: ${head}`, subtitle: clip(r.content, SNIPPET),
    who: r.guestName, place: "Hỏi đáp công khai",
    at: r.createdAt.toISOString(), when: agoLabel(r.createdAt, now),
    status: { label: "Chờ duyệt", tone: "cho" }, flags: { phoneOrLink: r.phoneOrLink },
    detail: {
      heading: `Câu hỏi của khách ${r.guestName}`, meta: sentMeta(r.createdAt, now),
      sections: [
        { title: "Câu hỏi", text: clip(r.content, 600) || "(không có chữ)" },
        { title: "Người hỏi", text: `${r.guestName} (khách tự gõ tên, chưa có tài khoản)` },
        ...(r.phoneOrLink ? [{ title: "Cần xem kỹ", text: "Nội dung có vẻ chứa số điện thoại hoặc đường dẫn. Người hỏi có thể là trẻ em; đừng để lộ thông tin liên hệ." }] : []),
      ],
      actions: [
        { key: "approve", label: "Duyệt", kind: "primary", method: "POST", url: `/api/community/moderation/${r.id}`, body: { decision: "approve" },
          ...(r.phoneOrLink ? { ack: "Đã xem, không lộ số điện thoại hoặc đường dẫn" } : {}) },
        { key: "reject", label: "Từ chối", kind: "secondary", method: "POST", url: `/api/community/moderation/${r.id}`, body: { decision: "reject" }, reason: { label: "Lý do từ chối", max: 300 } },
      ],
      links: [{ label: "Mở trang cộng đồng", href: "/admin/cong-dong" }],
    },
  };
}

/** Yêu cầu vào lớp: CHỈ ĐỌC, gộp theo LỚP, nhóm theo-doi, không lệnh duyệt (quyền duyệt thuộc riêng chủ lớp). Không tên học sinh, không userId. */
function joinItem(r: JoinRep, now: Date): QueueItem {
  const slow = now.getTime() - r.oldestAt.getTime() >= JOIN_SLOW_DAYS * 24 * H;
  const owner = r.ownerName?.trim() || "chưa rõ";
  return {
    id: `vao-lop:${r.courseId}`, kind: "vao-lop", group: "theo-doi", bulk: [],
    title: `Yêu cầu vào lớp: ${r.courseName}`, subtitle: `${r.count} yêu cầu chờ · ${waitedText(r.oldestAt, now)}`,
    who: r.courseName, place: `Gia sư ${owner}`,
    at: r.oldestAt.toISOString(), when: agoLabel(r.oldestAt, now),
    status: slow ? { label: `Chờ quá ${JOIN_SLOW_DAYS} ngày`, tone: "loi" } : { label: "Chờ gia sư", tone: "cho" },
    detail: {
      heading: `Lớp ${r.courseName} đang có yêu cầu vào lớp chờ`, meta: `${r.count} yêu cầu · yêu cầu cũ nhất ${waitedText(r.oldestAt, now)}`,
      sections: [
        { title: "Ai duyệt", text: `Gia sư ${owner} duyệt yêu cầu vào lớp của mình. Quản trị chỉ theo dõi để biết lớp nào đang để học sinh chờ lâu.` },
      ],
      actions: [],
      links: [{ label: "Mở lớp", href: `/admin/khoa-hoc/${r.courseId}/hoc-vien` }],
    },
  };
}

export interface BuildQueueInput {
  tutors?: TutorApp[]; threads?: ThreadRep[]; profiles?: ProfileRep[]; answers?: AnswerRep[];
  reviews?: ReviewRep[]; topups?: TopupRep[]; guests?: GuestRep[]; joins?: JoinRep[];
  now: Date;
  /** Người đang xem: để khoá "tự duyệt nạp Coin của chính mình". */
  viewerId?: string | null;
  /** Tối đa số dòng trả về (mặc định MAX_QUEUE_ITEMS). */
  limit?: number;
}

/**
 * Gộp, xếp người chờ lâu nhất lên trước (FIFO), cắt `limit`. `badge` ở đây chỉ đếm các dòng NHÓM `duyet` có trong kết quả —
 * số đếm CHÍNH XÁC (không bị cắt) do máy chủ tính riêng bằng `count()` rồi gộp qua `badgeOf`.
 */
export function buildAdminQueue(input: BuildQueueInput): { items: QueueItem[]; badge: number } {
  const { now } = input;
  const all = [
    ...(input.tutors ?? []).map(t => tutorItem(t, now)),
    ...(input.threads ?? []).map(r => threadItem(r, now)),
    ...(input.profiles ?? []).map(r => profileItem(r, now)),
    ...(input.answers ?? []).map(r => answerItem(r, now)),
    ...(input.reviews ?? []).map(r => reviewItem(r, now)),
    ...(input.topups ?? []).map(r => topupItem(r, now, input.viewerId ?? null)),
    ...(input.guests ?? []).map(r => guestItem(r, now)),
    ...(input.joins ?? []).map(r => joinItem(r, now)),
  ];
  const items = sortQueue(all).slice(0, Math.max(0, input.limit ?? MAX_QUEUE_ITEMS));
  return { items, badge: items.filter(i => i.group === "duyet").length };
}
