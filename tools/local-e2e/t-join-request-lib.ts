// BU-01 — luật thuần của cách vào lớp / xin vào lớp (src/lib/joinRequest.ts). Không DB.
import { check, section, done } from "./h";
import {
  parseJoinPolicy, effectivePolicy, nextJoinState, redeemOutcome, joinDecision, isFreeClass, canUseOpenPolicy,
  normalizeJoinNote, joinStatusLabel, FREE_CLASS_TAG, REAPPLY_COOLDOWN_HOURS, JOIN_NOTE_MAX,
  type JoinStatus, type JoinEvent, type JoinPolicy,
} from "@/lib/joinRequest";

section("parseJoinPolicy");
for (const v of ["invite_only", "open", "approve"]) check(`"${v}" hợp lệ`, (() => { const r = parseJoinPolicy(v); return r.ok && r.value === v; })());
check("null hợp lệ (về mặc định)", (() => { const r = parseJoinPolicy(null); return r.ok && r.value === null; })());
check("undefined = không đổi", (() => { const r = parseJoinPolicy(undefined); return r.ok && r.value === undefined; })());
for (const bad of ["Open", "OPEN", "", " open", 5, {}, [], true]) check(`CA PHÁ: ${JSON.stringify(bad)} bị từ chối bằng chữ Việt`, (() => { const r = parseJoinPolicy(bad); return !r.ok && /không hợp lệ/.test(r.error); })());

section("effectivePolicy");
check("null / undefined / chuỗi lạ ⇒ invite_only", effectivePolicy(null) === "invite_only" && effectivePolicy(undefined) === "invite_only" && effectivePolicy("x") === "invite_only" && effectivePolicy("Open") === "invite_only");
check("giá trị hợp lệ giữ nguyên", effectivePolicy("open") === "open" && effectivePolicy("approve") === "approve");

section("redeemOutcome");
const cls = { kind: "class", boundUserId: null };
const mine = { kind: "personal", boundUserId: "A" };
check("approve + mã lớp ⇒ request", redeemOutcome({ policy: "approve", invite: cls, userId: "A" }).action === "request");
check("invite_only / open + mã lớp ⇒ enroll", redeemOutcome({ policy: "invite_only", invite: cls, userId: "A" }).action === "enroll" && redeemOutcome({ policy: "open", invite: cls, userId: "A" }).action === "enroll");
check("mã cá nhân của chính mình theo policy: approve ⇒ request, còn lại ⇒ enroll",
  redeemOutcome({ policy: "approve", invite: mine, userId: "A" }).action === "request"
  && redeemOutcome({ policy: "open", invite: mine, userId: "A" }).action === "enroll"
  && redeemOutcome({ policy: "invite_only", invite: mine, userId: "A" }).action === "enroll");
for (const p of ["invite_only", "open", "approve"] as JoinPolicy[]) {
  const r = redeemOutcome({ policy: p, invite: mine, userId: "B" });
  check(`CA PHÁ: mã cá nhân của A, B dùng, policy ${p} ⇒ deny 403`, r.action === "deny" && r.status === 403 && r.error === "Mã này gắn với tài khoản khác");
}
check("CA PHÁ: mã cá nhân thiếu boundUserId (hỏng dữ liệu) ⇒ deny, không cho ai vào", redeemOutcome({ policy: "open", invite: { kind: "personal", boundUserId: null }, userId: "A" }).action === "deny");
check("CA PHÁ: mã 'class' lỡ có boundUserId người khác ⇒ deny", redeemOutcome({ policy: "open", invite: { kind: "class", boundUserId: "Z" }, userId: "A" }).action === "deny");
check("kind null (dòng cũ) + không gắn ai ⇒ như mã lớp", redeemOutcome({ policy: "invite_only", invite: { kind: null, boundUserId: null }, userId: "A" }).action === "enroll");

section("nextJoinState — đủ 5 trạng thái × 4 sự kiện");
const now = new Date("2026-11-02T10:00:00Z");
const states: (JoinStatus | null)[] = [null, "pending", "approved", "rejected", "cancelled"];
const events: JoinEvent[] = ["apply", "approve", "reject", "cancel"];
const expect: Record<string, string> = {
  "null/apply": "pending", "null/approve": "NOT_PENDING", "null/reject": "NOT_PENDING", "null/cancel": "NOT_PENDING",
  "pending/apply": "pending", "pending/approve": "approved", "pending/reject": "rejected", "pending/cancel": "cancelled",
  "approved/apply": "ALREADY_MEMBER", "approved/approve": "NOT_PENDING", "approved/reject": "NOT_PENDING", "approved/cancel": "NOT_PENDING",
  "rejected/apply": "pending", "rejected/approve": "NOT_PENDING", "rejected/reject": "NOT_PENDING", "rejected/cancel": "NOT_PENDING",
  "cancelled/apply": "pending", "cancelled/approve": "NOT_PENDING", "cancelled/reject": "NOT_PENDING", "cancelled/cancel": "NOT_PENDING",
};
for (const s of states) for (const e of events) {
  // rejected/apply: decidedAt 25h trước (hết chờ); approved/apply: còn Enrollment
  const r = nextJoinState(s, e, { hasEnrollment: true, now, decidedAt: new Date(now.getTime() - 25 * 3600_000) });
  const got = r.ok ? r.next : r.code;
  check(`${s}/${e} ⇒ ${expect[`${s}/${e}`]}`, got === expect[`${s}/${e}`], `được ${got}`);
}
check("CA PHÁ: approve lúc không pending ⇒ NOT_PENDING có chữ Việt", (() => { const r = nextJoinState("approved", "approve"); return !r.ok && r.code === "NOT_PENDING" && r.error.length > 0; })());
const rej = new Date(now.getTime() - 3600_000);
check("CA PHÁ: apply sau reject < 24h ⇒ COOLDOWN, retryAt = decidedAt + 24h", (() => {
  const r = nextJoinState("rejected", "apply", { now, decidedAt: rej });
  return !r.ok && r.code === "COOLDOWN" && r.retryAt?.getTime() === rej.getTime() + REAPPLY_COOLDOWN_HOURS * 3600_000 && /thử lại sau/.test(r.error);
})());
check("apply sau reject đúng 24h ⇒ pending (mốc là >=)", (() => { const r = nextJoinState("rejected", "apply", { now, decidedAt: new Date(now.getTime() - 24 * 3600_000) }); return r.ok && r.next === "pending"; })());
check("apply sau reject 23h59 ⇒ vẫn COOLDOWN", (() => { const r = nextJoinState("rejected", "apply", { now, decidedAt: new Date(now.getTime() - 24 * 3600_000 + 60_000) }); return !r.ok && r.code === "COOLDOWN"; })());
check("apply sau reject ≥ 24h ⇒ pending", (() => { const r = nextJoinState("rejected", "apply", { now, decidedAt: new Date(now.getTime() - 25 * 3600_000) }); return r.ok && r.next === "pending"; })());
check("CA PHÁ: approved + còn Enrollment ⇒ ALREADY_MEMBER; hasEnrollment không rõ cũng không cho xin lại", (() => {
  const a = nextJoinState("approved", "apply", { hasEnrollment: true }); const b = nextJoinState("approved", "apply");
  return !a.ok && a.code === "ALREADY_MEMBER" && !b.ok && b.code === "ALREADY_MEMBER";
})());
check("approved + đã mất Enrollment ⇒ pending", (() => { const r = nextJoinState("approved", "apply", { hasEnrollment: false }); return r.ok && r.next === "pending"; })());
check("rejected không có decidedAt ⇒ không chặn vô hạn (pending)", (() => { const r = nextJoinState("rejected", "apply", { now }); return r.ok; })());

section("joinDecision");
const base = { policy: "approve" as JoinPolicy, classOpen: true, hasEnrollment: false, request: null };
check("approve ⇒ issue_personal_code", joinDecision(base).action === "issue_personal_code");
check("open ⇒ enroll", joinDecision({ ...base, policy: "open" }).action === "enroll");
check("invite_only ⇒ invite_only (409)", joinDecision({ ...base, policy: "invite_only" }).action === "invite_only");
check("đã là thành viên thắng mọi thứ, kể cả lớp đóng", joinDecision({ ...base, hasEnrollment: true, classOpen: false }).action === "already_member");
check("CA PHÁ: lớp đóng ⇒ closed dù open hay approve", joinDecision({ ...base, policy: "open", classOpen: false }).action === "closed" && joinDecision({ ...base, classOpen: false }).action === "closed");
check("đang pending, bấm lại ⇒ vẫn trả mã (cùng mã)", joinDecision({ ...base, request: "pending" }).action === "issue_personal_code");

section("isFreeClass / canUseOpenPolicy");
check("price 0 + tag Miễn phí + chưa có đơn giá ⇒ miễn phí", isFreeClass({ price: 0, tag: FREE_CLASS_TAG, hasFeeRate: false }) && canUseOpenPolicy({ price: 0, tag: FREE_CLASS_TAG, hasFeeRate: false }));
check("CA PHÁ: price 0 nhưng không có tag (lớp wizard thu phí) ⇒ KHÔNG miễn phí", !isFreeClass({ price: 0, tag: null, hasFeeRate: false }) && !isFreeClass({ price: 0, tag: "Toán", hasFeeRate: false }));
check("CA PHÁ: có tag nhưng gia sư đã nhập đơn giá ⇒ KHÔNG miễn phí", !isFreeClass({ price: 0, tag: FREE_CLASS_TAG, hasFeeRate: true }));
check("CA PHÁ: price > 0 ⇒ KHÔNG miễn phí dù có tag", !isFreeClass({ price: 1, tag: FREE_CLASS_TAG, hasFeeRate: false }));
check("CA PHÁ: tag viết thường ⇒ không khớp", !isFreeClass({ price: 0, tag: "miễn phí", hasFeeRate: false }));
check("open bị chặn ở lớp không miễn phí", !canUseOpenPolicy({ price: 0, tag: null, hasFeeRate: false }));

section("normalizeJoinNote");
check("200 ký tự ok", (() => { const r = normalizeJoinNote("a".repeat(JOIN_NOTE_MAX)); return r.ok && r.value?.length === 200; })());
check("CA PHÁ: 201 ký tự ⇒ lỗi (không tự cắt)", (() => { const r = normalizeJoinNote("a".repeat(JOIN_NOTE_MAX + 1)); return !r.ok && /200/.test(r.error); })());
check("toàn khoảng trắng / rỗng / null / undefined ⇒ null", [" \n\t ", "", null, undefined].every((v) => { const r = normalizeJoinNote(v); return r.ok && r.value === null; }));
check("CA PHÁ: ký tự điều khiển bị bỏ", (() => { const r = normalizeJoinNote("  Em\u0000 thử\u0007 lại\nsau \u007F"); return r.ok && r.value === "Em thử lạisau"; })());
check("CA PHÁ: không phải chuỗi ⇒ lỗi", !normalizeJoinNote(5).ok && !normalizeJoinNote({}).ok);
check("đếm sau khi bỏ ký tự điều khiển (200 + vài \\n vẫn ok)", (() => { const r = normalizeJoinNote("a".repeat(200) + "\n\n"); return r.ok; })());

section("joinStatusLabel");
check("bốn nhãn Việt", joinStatusLabel("pending") === "Chờ duyệt" && joinStatusLabel("approved") === "Đã vào lớp" && joinStatusLabel("rejected") === "Chưa được duyệt" && joinStatusLabel("cancelled") === "Đã huỷ");

done();
