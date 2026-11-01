// BU-01 — luật THUẦN cho "cách vào lớp" và "xin vào lớp" (không React, không DB, không cookie; test: tools/local-e2e/t-join-request-lib.ts).
// Mọi nơi hiện nhãn "Miễn phí" / quyết định vào lớp phải gọi các hàm ở đây, không tự viết lại điều kiện.

export const JOIN_POLICIES = ["invite_only", "open", "approve"] as const;
export type JoinPolicy = (typeof JOIN_POLICIES)[number];
/** Dấu "Miễn phí" do gia sư tick lúc tạo lớp, lưu ở Course.tag (wizard luôn ghi price 0 nên price === 0 một mình không đủ). */
export const FREE_CLASS_TAG = "Miễn phí";
export const PERSONAL_CODE_TTL_DAYS = 30;
export const REAPPLY_COOLDOWN_HOURS = 24;
export const JOIN_NOTE_MAX = 200;
export const JOIN_BULK_MAX = 50;
/** Loại thông báo (type tự do của notify). */
export const JOIN_NOTIFY_TYPES = {
  new: "join_request_new",
  approved: "join_request_approved",
  rejected: "join_request_rejected",
} as const;

/** Giá trị gửi lên (PATCH/POST lớp). undefined = không đổi; null và "invite_only" hợp lệ; chuỗi lạ = lỗi tiếng Việt. */
export function parseJoinPolicy(raw: unknown): { ok: true; value: JoinPolicy | null | undefined } | { ok: false; error: string } {
  if (raw === undefined) return { ok: true, value: undefined };
  if (raw === null) return { ok: true, value: null };
  if (typeof raw === "string" && (JOIN_POLICIES as readonly string[]).includes(raw)) return { ok: true, value: raw as JoinPolicy };
  return { ok: false, error: "Cách vào lớp không hợp lệ" };
}

/** Giá trị lưu → chính sách hiệu lực: null/lạ ⇒ "invite_only". */
export function effectivePolicy(stored: string | null | undefined): JoinPolicy {
  return (JOIN_POLICIES as readonly string[]).includes(stored ?? "") ? (stored as JoinPolicy) : "invite_only";
}

export type JoinStatus = "pending" | "approved" | "rejected" | "cancelled";
export type JoinEvent = "apply" | "approve" | "reject" | "cancel";
export type JoinDenyCode = "ALREADY_MEMBER" | "ALREADY_DECIDED" | "NOT_PENDING" | "COOLDOWN";

function fmtRetry(d: Date): string {
  const v = new Date(d.getTime() + 7 * 3600_000); // giờ Việt Nam (UTC+7, không DST)
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(v.getUTCDate())}/${p(v.getUTCMonth() + 1)} ${p(v.getUTCHours())}:${p(v.getUTCMinutes())}`;
}

/** Máy trạng thái (spec mục 6.1). `current` null = chưa có yêu cầu. Mọi cặp (trạng thái × sự kiện) có kết quả xác định. */
export function nextJoinState(
  current: JoinStatus | null,
  event: JoinEvent,
  ctx: { hasEnrollment?: boolean; now?: Date; decidedAt?: Date | null } = {},
): { ok: true; next: JoinStatus } | { ok: false; code: JoinDenyCode; error: string; retryAt?: Date } {
  if (event === "apply") {
    if (current === null || current === "cancelled") return { ok: true, next: "pending" };
    if (current === "pending") return { ok: true, next: "pending" }; // idempotent: người gọi tự biết không tăng lượt / không báo lại
    if (current === "approved") {
      if (ctx.hasEnrollment === false) return { ok: true, next: "pending" }; // đã rời lớp
      return { ok: false, code: "ALREADY_MEMBER", error: "Bạn đã ở trong lớp này" };
    }
    // rejected: chờ REAPPLY_COOLDOWN_HOURS kể từ decidedAt
    if (ctx.decidedAt) {
      const retryAt = new Date(ctx.decidedAt.getTime() + REAPPLY_COOLDOWN_HOURS * 3600_000);
      if ((ctx.now ?? new Date()).getTime() < retryAt.getTime()) {
        return { ok: false, code: "COOLDOWN", error: `Gia sư vừa từ chối; thử lại sau ${fmtRetry(retryAt)}`, retryAt };
      }
    }
    return { ok: true, next: "pending" };
  }
  if (current !== "pending") return { ok: false, code: "NOT_PENDING", error: "Yêu cầu này đã được xử lý" };
  if (event === "approve") return { ok: true, next: "approved" };
  if (event === "reject") return { ok: true, next: "rejected" };
  return { ok: true, next: "cancelled" };
}

export type RedeemOutcome =
  | { action: "enroll" }
  | { action: "request" }
  | { action: "deny"; status: 403; error: "Mã này gắn với tài khoản khác" };

/** Mã nhập có đưa tới vào lớp, tạo yêu cầu, hay bị từ chối? Mã cá nhân của người khác bị từ chối bất kể chính sách. */
export function redeemOutcome(o: { policy: JoinPolicy; invite: { kind: string | null; boundUserId: string | null }; userId: string }): RedeemOutcome {
  if (o.invite.kind === "personal" && o.invite.boundUserId !== o.userId) {
    return { action: "deny", status: 403, error: "Mã này gắn với tài khoản khác" };
  }
  if (o.invite.kind !== "personal" && o.invite.boundUserId && o.invite.boundUserId !== o.userId) {
    return { action: "deny", status: 403, error: "Mã này gắn với tài khoản khác" };
  }
  return o.policy === "approve" ? { action: "request" } : { action: "enroll" };
}

/** Học sinh bấm "Vào lớp" có được cấp mã cá nhân / vào ngay không. */
export function joinDecision(o: { policy: JoinPolicy; classOpen: boolean; hasEnrollment: boolean; request: JoinStatus | null }):
  | { action: "enroll" } | { action: "issue_personal_code" } | { action: "already_member" } | { action: "closed" } | { action: "invite_only" } {
  if (o.hasEnrollment) return { action: "already_member" };
  if (!o.classOpen) return { action: "closed" };
  if (o.policy === "open") return { action: "enroll" };
  if (o.policy === "approve") return { action: "issue_personal_code" };
  return { action: "invite_only" };
}

type FreeInput = { price: number; tag: string | null; hasFeeRate: boolean };
/** Lớp có được gắn nhãn "Miễn phí" không (Q1): price 0 + dấu của gia sư + chưa nhập đơn giá. */
export function isFreeClass(c: FreeInput): boolean {
  return c.price === 0 && c.tag === FREE_CLASS_TAG && !c.hasFeeRate;
}
/** "open" chỉ hợp lệ khi lớp miễn phí (Q2). */
export function canUseOpenPolicy(c: FreeInput): boolean {
  return isFreeClass(c);
}

/** Lời nhắn của gia sư. Rỗng → value null; >200 ký tự → lỗi (không tự cắt). Ký tự điều khiển (kể cả xuống dòng) bị bỏ. */
export function normalizeJoinNote(raw: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, error: "Lời nhắn không hợp lệ" };
  // eslint-disable-next-line no-control-regex
  const s = raw.replace(/[\u0000-\u001F\u007F-\u009F]/g, "").trim();
  if (s.length > JOIN_NOTE_MAX) return { ok: false, error: `Lời nhắn tối đa ${JOIN_NOTE_MAX} ký tự` };
  return { ok: true, value: s === "" ? null : s };
}

export function joinStatusLabel(s: JoinStatus): string {
  switch (s) {
    case "pending": return "Chờ duyệt";
    case "approved": return "Đã vào lớp";
    case "rejected": return "Chưa được duyệt";
    case "cancelled": return "Đã huỷ";
  }
}
