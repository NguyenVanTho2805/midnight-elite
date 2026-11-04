// BU-05 — CỘNG ĐỒNG, API THẬT + DB (mô hình kẻ tấn công, docs/kin/phong-ban/dac-ta/BU-05.md mục 8).
// Cần: máy chủ dev cổng 3100 + DB kin_test, đã `source tools/local-e2e/env.sh`. Bài tự `wipe()` (hai lần: đầu bài và trước nhóm phân trang).
//
// Cờ MÁY CHỦ `KIN_GUEST_QUESTIONS` phải khớp biến `EXPECT_GUEST_QUESTIONS` (giống t-pro-plan / t-trial-mode): chạy HAI lần, mỗi lần khởi động máy chủ khác:
//   EXPECT_GUEST_QUESTIONS=1  (máy chủ chạy với KIN_GUEST_QUESTIONS=1) → chạy đủ mọi nhóm, kể cả khách gửi câu hỏi + hàng chờ duyệt
//   EXPECT_GUEST_QUESTIONS=0  (máy chủ KHÔNG đặt KIN_GUEST_QUESTIONS)   → chỉ kiểm: 503 guest_questions_closed (JSON và form), 0 hàng mới; các nhóm không cần khách vẫn chạy
//
// CA PHÁ CỐ Ý (đổi MỘT dòng trong src/ rồi chạy lại — bài phải ĐỎ; hoàn lại sau khi thử):
//  • Ma trận quyền   — api/community/threads/[id]/like/route.ts: đổi `requireSession()` thành `getSession()`            → "K POST like → 401" đỏ.
//                      api/community/moderation/pending/route.ts: đổi MANAGE_COMMUNITY thành `requireSession()`        → "HS/GS gọi moderation → 403" đỏ.
//  • Người ngoài lớp — communityServer.loadAccessibleThread: bỏ dòng `canAccessThread`                                → mọi ca "ngoài lớp → 404 cùng thân" đỏ.
//                      api/community/replies/[id]/like/route.ts: bỏ dòng `loadAccessibleThread` (lỗi 6 cũ)            → "like trả lời của bài lớp → 404" đỏ.
//  • accept-reply    — communityServer.canAcceptReply: luôn `return true`                                            → "HS không phải chủ → 403" đỏ.
//  • Bài ẩn          — communityServer.publishedThreadWhere: bỏ `status: "published"`                                → pending/rejected lọt feed/bookmarks/sidebar/profiles → nhiều ca đỏ.
//                      api/community/threads/[id]/like/route.ts: đổi loadAccessibleThread thành findUnique trần      → "không tạo hàng" đỏ (lỗi 5 cũ).
//  • Lộ JSON         — communityServer.AUTHOR_SELECT thêm `email: true` và trả author thô                            → quét khoá `email` đỏ; communityRules.publicName luôn trả tên đầy đủ → "Trần Thị Bích" lọt, đỏ.
//  • Khách           — guest-questions: đổi `status: "pending"` thành "published"                                    → "không có trong feed" đỏ.
//                      guest-questions: bỏ `withLock` (đếm rồi ghi không khoá)                                         → 5 song song lọt nhiều hơn 3 hàng, đỏ (có thể chập chờn: chạy 3 lần).
//                      guest-questions: bỏ kiểm `KIN_GUEST_QUESTIONS`                                                  → chạy với EXPECT_GUEST_QUESTIONS=0 đỏ.
//                      getClientIp: lấy phần TỬ ĐẦU của x-forwarded-for                                                → "giả nhiều IP vẫn tính theo IP cuối" đỏ.
//  • Song song       — like/bookmark: bỏ `withLock` và `catch isUniqueViolation`                                      → có yêu cầu 500, đỏ.
//                      reply: bỏ `withLock`                                                                           → "25 song song chỉ 20 lọt" đỏ.
//                      moderation/[id]: đổi `updateMany` có điều kiện thành `update`                                  → "5 duyệt song song, 1 thắng" đỏ.
//  • Lồng            — communityRules.normalizeParent: bỏ nhánh `parent.parentReplyId`                               → cây 3 cấp, "đúng 1 cấp" đỏ.
//  • Thông báo       — communityRules.notificationText("thread_reply"): ghép thêm tên/tiêu đề vào message             → "thông báo sạch" đỏ.
//                      api/community/threads/[id]/like/route.ts: bỏ `t.guestName === null`                            → "thích bài khách không tạo thông báo" đỏ.
//  • Nhắn riêng      — thêm `model DirectMessage` vào prisma/schema.prisma hoặc thư mục src/app/api/community/messages → nhóm tĩnh đỏ.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { createHmac } from "node:crypto";
import { api, mkUser, mkTutor, mkSuper, mkCourse, wipe, check, section, done, type TUser } from "./h";
import { prisma } from "@/lib/prisma";

const GUEST_FLAG = process.env.EXPECT_GUEST_QUESTIONS;
if (GUEST_FLAG !== "0" && GUEST_FLAG !== "1") throw new Error("Đặt EXPECT_GUEST_QUESTIONS=0 hoặc 1 (cờ KIN_GUEST_QUESTIONS mà máy chủ đang chạy).");
const GUEST_ON = GUEST_FLAG === "1";
const GUEST_EMAIL = "khach@he-thong.kin.invalid";

type R = Awaited<ReturnType<typeof api>>;
const stamp = Date.now().toString(36);
let mkSeq = 0;
const mk = (s: string) => `${s}${stamp}x${++mkSeq}`;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const note = (m: string) => console.log(`  ! ${m}`);
const short = (x: unknown) => JSON.stringify(x)?.slice(0, 220);
const GHOST_THREAD = "cghost000000000000000000t";
const GHOST_REPLY = "cghost000000000000000000r";

let ipSeq = 0;
const nextIp = () => { ipSeq++; return `10.77.${(ipSeq >> 8) & 255}.${ipSeq & 255}`; };
const ipHeaders = (ip: string) => ({ "x-forwarded-for": ip });
const hashOf = (ip: string) => createHmac("sha256", process.env.SESSION_SECRET ?? "").update(`guest-ip:${ip}`).digest("hex");

// ─── Quét JSON ────────────────────────────────────────────────────────────────
const FORBIDDEN_KEYS = new Set(["email", "phone", "zaloPhone", "school", "highSchool", "city", "dateOfBirth", "avatarBase64", "guestIpHash", "reviewedById", "rejectReason", "password", "phoneE164", "passwordHash"]);
function forbiddenKeys(v: unknown, path = "$", out: string[] = []): string[] {
  if (Array.isArray(v)) v.forEach((x, i) => forbiddenKeys(x, `${path}[${i}]`, out));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { if (FORBIDDEN_KEYS.has(k)) out.push(`${path}.${k}`); forbiddenKeys(x, `${path}.${k}`, out); }
  return out;
}
function maxDepth(replies: any[], d = 1): number { return replies.reduce((m, r) => Math.max(m, r.children?.length ? maxDepth(r.children, d + 1) : d), replies.length ? d : 0); }

// ─── Dữ liệu mẫu ──────────────────────────────────────────────────────────────
type TO = { authorId: string; mark?: string; kind?: "post" | "question"; courseId?: string | null; status?: string; guestName?: string | null; guestIpHash?: string | null;
  deleted?: boolean; pinned?: boolean; category?: string; createdAt?: Date; imageUrls?: string[]; title?: string | null; content?: string };
async function mkThread(o: TO) {
  const mark = o.mark ?? mk("MK");
  const kind = o.kind ?? "post";
  const t = await prisma.thread.create({
    data: {
      content: o.content ?? `Nội dung ${mark} thử nghiệm`, authorId: o.authorId, category: kind === "question" ? "hoi-dap" : (o.category ?? "kinh-nghiem"), kind,
      title: kind === "question" ? (o.title ?? `Câu hỏi ${mark}`) : null, courseId: o.courseId ?? null, status: o.status ?? "published",
      guestName: o.guestName ?? null, guestIpHash: o.guestIpHash ?? null, isPinned: o.pinned ?? false, deletedAt: o.deleted ? new Date() : null,
      imageUrls: o.imageUrls ?? [], ...(o.createdAt ? { createdAt: o.createdAt } : {}),
    },
  });
  return Object.assign(t, { mark });
}
async function mkReply(threadId: string, authorId: string, o: { parent?: string | null; deleted?: boolean; mark?: string; createdAt?: Date } = {}) {
  const mark = o.mark ?? mk("RP");
  const r = await prisma.threadReply.create({
    data: { content: `Trả lời ${mark} thử`, authorId, threadId, parentReplyId: o.parent ?? null, deletedAt: o.deleted ? new Date() : null, ...(o.createdAt ? { createdAt: o.createdAt } : {}) },
  });
  return Object.assign(r, { mark });
}
const counts = async () => ({
  threads: await prisma.thread.count(), replies: await prisma.threadReply.count(), likes: await prisma.threadLike.count(),
  bookmarks: await prisma.threadBookmark.count(), reports: await prisma.threadReport.count(), replyLikes: await prisma.replyLike.count(),
});
const sameCounts = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const feed = (as: TUser | undefined, q = "") => api("GET", `/api/community/feed${q ? `?${q}` : ""}`, { as });
const feedIds = (r: R): string[] => [...(r.json?.pinned ?? []), ...(r.json?.items ?? [])].map((i: any) => i.id);
const post = (as: TUser | undefined, path: string, body?: unknown, headers?: Record<string, string>) => api("POST", path, { as, body, headers });
const tPath = (id: string, tail = "") => `/api/community/threads/${id}${tail}`;

(async () => {
  await wipe();

  // ═════════════════════════════════════════ Thế giới thử ═════════════════════════════════════════
  const sup = await mkSuper("Quản Trị Gốc");
  const content = await mkUser({ name: "Quản Trị Nội Dung", role: "admin", adminRole: "admin_content" });
  const tOwner = await mkTutor("Cô Lan Anh");
  await prisma.user.update({ where: { id: tOwner.id }, data: { bio: "Gia sư Toán. ".repeat(60), subjects: ["Toán 9", "Toán 10"] } });
  const tOther = await mkTutor("Thầy Minh Khác");
  const tUnver = await mkUser({ name: "Gia Sư Chưa Duyệt", role: "admin", adminRole: "teacher", tutorVerified: false });
  const sA = await mkUser({ name: "Nguyễn Văn An" });
  const sB = await mkUser({ name: "Trần Thị Bích" });
  const sC = await mkUser({ name: "Lê Hoàng Cường" });
  const sD = await mkUser({ name: "Phạm Quốc Dũng" });
  const guestUser = await prisma.user.create({ data: { name: "Khách", email: GUEST_EMAIL, password: "khong-dang-nhap-duoc", role: "student", banned: true } });
  const allUsers: TUser[] = [sup, content, tOwner, tOther, tUnver, sA, sB, sC, sD];
  const secretsFor = (extra: string[] = []) => [...allUsers.map(u => u.email), GUEST_EMAIL, "Nguyễn Văn An", "Trần Thị Bích", "Lê Hoàng Cường", "Phạm Quốc Dũng", ...extra];

  const CLASS_NAME = `Lớp Riêng Tư ${stamp}`;
  const C = await mkCourse(tOwner.id, { name: CLASS_NAME });
  const C2 = await mkCourse(tOther.id, { name: `Lớp Khác ${stamp}` });
  for (const u of [sA, sC, sD]) await prisma.enrollment.create({ data: { userId: u.id, courseId: C.id, status: "active" } });

  const tCommon = await mkThread({ authorId: sA.id, mark: mk("COMMON") });
  const tClass = await mkThread({ authorId: sA.id, courseId: C.id, mark: mk("CLASSPOST") });
  const tClassT = await mkThread({ authorId: tOwner.id, courseId: C.id, mark: mk("CLASSTUTOR") });
  const tQ = await mkThread({ authorId: sA.id, kind: "question", mark: mk("QCOMMON") });
  const tClassQ = await mkThread({ authorId: sA.id, kind: "question", courseId: C.id, mark: mk("QCLASS") });
  const tPinned = await mkThread({ authorId: tOwner.id, pinned: true, mark: mk("PINNED") });
  const rT1 = await mkReply(tCommon.id, tOwner.id);                  // gốc
  const rT2 = await mkReply(tCommon.id, sA.id, { parent: rT1.id });  // con
  const rT3 = await mkReply(tCommon.id, sB.id, { parent: rT2.id });  // dữ liệu 3 cấp (mã cũ) — API phải ép về 1 cấp
  const rClass = await mkReply(tClass.id, sC.id);                    // trả lời trong bài lớp
  const rQ1 = await mkReply(tQ.id, sB.id), rQ2 = await mkReply(tQ.id, tOwner.id), rQ3 = await mkReply(tQ.id, sC.id);
  const rQDel = await mkReply(tQ.id, sC.id, { deleted: true });
  const rCQ1 = await mkReply(tClassQ.id, sD.id), rCQ2 = await mkReply(tClassQ.id, tOwner.id);
  const tOther2 = await mkThread({ authorId: sB.id, mark: mk("OTHERTHREAD") });
  const rOther2 = await mkReply(tOther2.id, sB.id);
  const tPostForAccept = await mkThread({ authorId: sA.id, mark: mk("POSTNOTQ") });
  const rPost = await mkReply(tPostForAccept.id, sB.id);

  // Bài ẩn: xoá mềm / chờ duyệt / bị từ chối; có trả lời, đã lưu, đã thích — để thử lộ ở mọi mặt.
  const HIDDEN: { name: string; t: Awaited<ReturnType<typeof mkThread>>; reply: Awaited<ReturnType<typeof mkReply>>; tByTutor: Awaited<ReturnType<typeof mkThread>> }[] = [];
  for (const [name, spec] of [["xoá mềm", { deleted: true }], ["chờ duyệt", { status: "pending" }], ["bị từ chối", { status: "rejected" }]] as const) {
    const isGuest = "status" in spec;
    const t = await mkThread({ authorId: isGuest ? guestUser.id : sA.id, kind: "question", guestName: isGuest ? `Khách ${name}` : null, guestIpHash: isGuest ? hashOf(nextIp()) : null, mark: mk("HID"), ...spec });
    const tByTutor = await mkThread({ authorId: tOwner.id, mark: mk("HIDTUT"), ...spec });
    const reply = await mkReply(t.id, tOwner.id);
    await prisma.threadBookmark.create({ data: { userId: sA.id, threadId: t.id } });
    await prisma.threadLike.create({ data: { userId: sB.id, threadId: t.id } });
    HIDDEN.push({ name, t, reply, tByTutor });
  }
  const pend = HIDDEN[1].t;
  const rej = HIDDEN[2].t;
  const hiddenMarks = HIDDEN.flatMap(h => [h.t.mark, h.tByTutor.mark, h.reply.mark]);
  const hiddenIds = HIDDEN.flatMap(h => [h.t.id, h.tByTutor.id]);

  // Câu hỏi cũ (bảng Question) có trả lời.
  const legacyQ = await prisma.question.create({ data: { authorId: sB.id, title: `Câu hỏi cũ ${mk("LEG")}`, content: "Nội dung câu hỏi cũ", bountyPaid: 0, status: "open" } });
  const legacyA = await prisma.answer.create({ data: { questionId: legacyQ.id, authorId: sA.id, content: "Câu trả lời cũ" } });

  // ═════════════════════════════════════════ 1. Ma trận quyền ═════════════════════════════════════════
  section("1. Ma trận quyền: khách / học sinh / gia sư / quản trị");
  {
    const attacks: [string, string, unknown?][] = [
      ["POST /threads", "/api/community/threads", { content: "x", category: "goc-vui" }],
      ["POST reply", tPath(tCommon.id, "/reply"), { content: "x" }],
      ["POST like", tPath(tCommon.id, "/like")],
      ["POST bookmark", tPath(tCommon.id, "/bookmark")],
      ["POST report", tPath(tCommon.id, "/report"), { reason: "x" }],
      ["POST accept-reply", tPath(tQ.id, "/accept-reply"), { replyId: rQ1.id }],
      ["POST replies/like", `/api/community/replies/${rT1.id}/like`],
      ["DELETE thread", tPath(tCommon.id)],
      ["DELETE reply", `/api/community/replies/${rT1.id}`],
      ["PATCH ghim", tPath(tCommon.id), { isPinned: true }],
      ["GET bookmarks", "/api/community/bookmarks"],
      ["GET moderation/pending", "/api/community/moderation/pending"],
      ["POST moderation/[id]", `/api/community/moderation/${pend.id}`, { decision: "approve" }],
    ];
    const before = await counts();
    for (const [label, path, body] of attacks) {
      const m = label.split(" ")[0];
      const r = await api(m, path, { body });
      check(`K ${label} → 401`, r.status === 401, { status: r.status, text: r.text.slice(0, 120) });
    }
    check("K: không tạo / đổi hàng nào", sameCounts(before, await counts()));
    check("K: bài chờ duyệt vẫn pending", (await prisma.thread.findUnique({ where: { id: pend.id } }))?.status === "pending");

    for (const [who, u] of [["HS", sB], ["GS chủ lớp", tOwner], ["GS chưa duyệt", tUnver]] as const) {
      const g = await api("GET", "/api/community/moderation/pending", { as: u });
      check(`${who} GET moderation/pending → 403`, g.status === 403, { status: g.status, text: g.text.slice(0, 120) });
      const p = await post(u, `/api/community/moderation/${pend.id}`, { decision: "approve" });
      check(`${who} POST moderation/[id] → 403`, p.status === 403, { status: p.status });
      const pin = await api("PATCH", tPath(tCommon.id), { as: u, body: { isPinned: true } });
      check(`${who} ghim bài → 403 (gia sư không có MANAGE_COMMUNITY)`, pin.status === 403, { status: pin.status });
    }
    check("sau các cuộc tấn công, bài chờ duyệt vẫn pending và bài chung không bị ghim", (await prisma.thread.findUnique({ where: { id: pend.id } }))?.status === "pending" && (await prisma.thread.findUnique({ where: { id: tCommon.id } }))?.isPinned === false);
    for (const [who, u] of [["quản trị cấp 1", sup], ["quản trị nội dung", content]] as const) {
      const g = await api("GET", "/api/community/moderation/pending", { as: u });
      check(`${who} GET moderation/pending → 200`, g.status === 200 && Array.isArray(g.json?.items), { status: g.status });
      check(`${who}: hàng chờ có bài chờ duyệt, KHÔNG có bài bị từ chối / đã xoá`, g.json?.items?.some((i: any) => i.id === pend.id) && !g.json?.items?.some((i: any) => i.id === rej.id || i.id === HIDDEN[0].t.id), g.json?.items?.map((i: any) => i.id));
    }
    const pin = await api("PATCH", tPath(tCommon.id), { as: content, body: { isPinned: true } });
    check("quản trị nội dung ghim được", pin.status === 200 && pin.json?.isPinned === true, pin.json);
    check("bài ghim hiện ở `pinned` của feed khách", (await feed(undefined)).json?.pinned?.some((i: any) => i.id === tCommon.id));
    await api("PATCH", tPath(tCommon.id), { as: content, body: { isPinned: false } });

    // Người khác xoá bài / trả lời không phải của mình.
    const dB = await api("DELETE", tPath(tCommon.id), { as: sB });
    check("HS xoá bài của người khác → 403", dB.status === 403, { status: dB.status });
    const dBr = await api("DELETE", `/api/community/replies/${rT1.id}`, { as: sB });
    check("HS xoá trả lời của người khác → 403", dBr.status === 403, { status: dBr.status });
    check("bài và trả lời vẫn còn sau khi bị thử xoá", !(await prisma.thread.findUnique({ where: { id: tCommon.id } }))?.deletedAt && !(await prisma.threadReply.findUnique({ where: { id: rT1.id } }))?.deletedAt);
    const dGhost = await api("DELETE", tPath(GHOST_THREAD), { as: sB });
    const dClass = await api("DELETE", tPath(tClass.id), { as: sB });
    if (dGhost.status !== dClass.status) note(`THÔNG TIN: DELETE bài lớp bởi người ngoài lớp → ${dClass.status}, bài không tồn tại → ${dGhost.status} (phân biệt được sự tồn tại; mức thấp, id là cuid)`);

    // Route của vai khác.
    for (const [label, path, as, ok] of [
      ["K /api/student/viec-cua-toi", "/api/student/viec-cua-toi", undefined, [401]],
      ["K /api/tutor/hop-viec", "/api/tutor/hop-viec", undefined, [401]],
      ["K /api/admin/students", "/api/admin/students", undefined, [401]],
      ["HS /api/tutor/hop-viec", "/api/tutor/hop-viec", sB, [401, 403]],
      ["HS /api/admin/students", "/api/admin/students", sB, [401, 403]],
      ["HS /api/admin/thread-reports", "/api/admin/thread-reports", sB, [401, 403]],
    ] as const) {
      const r = await api("GET", path, { as });
      check(`${label} → ${ok.join("/")}`, (ok as readonly number[]).includes(r.status), { status: r.status });
    }
  }

  // ═════════════════════════════════════════ 2. Người ngoài lớp ═════════════════════════════════════════
  section("2. Người ngoài lớp: cùng một 404, không lộ sự tồn tại, không lộ tên lớp");
  {
    const attempts: [string, string, string, unknown?][] = [
      ["GET chi tiết", "GET", "", undefined],
      ["POST like", "POST", "/like"],
      ["POST bookmark", "POST", "/bookmark"],
      ["POST reply", "POST", "/reply", { content: "xin chào" }],
      ["POST report", "POST", "/report", { reason: "vi phạm" }],
      ["POST accept-reply", "POST", "/accept-reply", { replyId: rCQ1.id }],
    ];
    const before = await counts();
    for (const [who, u] of [["HS ngoài lớp", sB], ["GS không phải chủ lớp", tOther]] as const) {
      for (const [label, m, tail, body] of attempts) {
        const real = await api(m, tPath(tClassQ.id, tail), { as: u, body });
        const ghost = await api(m, tPath(GHOST_THREAD, tail), { as: u, body });
        check(`${who} ${label} bài lớp → 404 và cùng thân với bài không tồn tại`, real.status === 404 && ghost.status === 404 && real.text === ghost.text, { real: [real.status, real.text.slice(0, 80)], ghost: [ghost.status, ghost.text.slice(0, 80)] });
      }
      const rl = await post(u, `/api/community/replies/${rClass.id}/like`);
      const rlGhost = await post(u, `/api/community/replies/${GHOST_REPLY}/like`);
      check(`${who} thích trả lời trong bài lớp → 404 cùng thân với trả lời không tồn tại`, rl.status === 404 && rlGhost.status === 404 && rl.text === rlGhost.text, { rl: [rl.status, rl.text.slice(0, 80)], ghost: rlGhost.status });
      const sc = await feed(u, `scope=${C.id}`);
      check(`${who} feed?scope=<lớp> → 403`, sc.status === 403 && sc.json?.code === "not_member", { status: sc.status, body: sc.text.slice(0, 120) });
      const lg = await api("GET", `/api/community/threads?courseId=${C.id}`, { as: u });
      check(`${who} danh sách cũ ?courseId=<lớp> → 403`, lg.status === 403, { status: lg.status });
    }
    check("người ngoài lớp không tạo / đổi hàng nào", sameCounts(before, await counts()));
    const gG = await api("GET", tPath(tClass.id));
    const gGhost = await api("GET", tPath(GHOST_THREAD));
    check("KHÁCH GET bài lớp → 404 cùng thân với bài không tồn tại", gG.status === 404 && gG.text === gGhost.text, { status: gG.status });
    const gScope = await feed(undefined, `scope=${C.id}`);
    check("KHÁCH feed?scope=<lớp> → 403", gScope.status === 403, { status: gScope.status });
    const noCourse = await feed(sB, `scope=cghost000000000000000000c`);
    check("scope là lớp không tồn tại → 403 (cùng mã với lớp có thật)", noCourse.status === 403);

    // Mọi mặt công khai không chứa bài lớp / tên lớp.
    const classMarks = [tClass.mark, tClassT.mark, tClassQ.mark, rClass.mark, rCQ1.mark, rCQ2.mark, CLASS_NAME, tClass.id, tClassT.id, tClassQ.id];
    for (const [who, u] of [["khách", undefined], ["HS ngoài lớp", sB], ["GS không phải chủ lớp", tOther]] as const) {
      const surfaces: [string, R][] = [
        ["feed", await feed(u)], ["feed limit=50", await feed(u, "limit=50")], ["feed hoi-dap", await feed(u, "tab=hoi-dap&limit=50")], ["feed common", await feed(u, "scope=common&limit=50")],
        ["sidebar", await api("GET", "/api/community/sidebar", { as: u })], ["hồ sơ gia sư chủ lớp", await api("GET", `/api/community/profiles/${tOwner.id}`, { as: u })],
        ["danh sách cũ", await api("GET", "/api/community/threads", { as: u })],
      ];
      if (u) surfaces.push(["bookmarks", await api("GET", "/api/community/bookmarks", { as: u })]);
      for (const [label, r] of surfaces) {
        check(`${who}: ${label} → 200 và không chứa bài / tên lớp`, r.status === 200 && !classMarks.some(s => r.text.includes(s)), { status: r.status, leak: classMarks.filter(s => r.text.includes(s)) });
      }
    }
    // Hồ sơ gia sư: bài lớp không tính vào số bài.
    const prof = await api("GET", `/api/community/profiles/${tOwner.id}`);
    const ownerCommon = await prisma.thread.count({ where: { authorId: tOwner.id, courseId: null, deletedAt: null, status: "published" } });
    check("hồ sơ gia sư: postCount chỉ đếm bài chung đã duyệt", prof.json?.profile?.postCount === ownerCommon, { got: prof.json?.profile?.postCount, want: ownerCommon });

    // Thành viên và quản trị thấy.
    for (const [who, u] of [["học sinh trong lớp", sA], ["GS chủ lớp", tOwner], ["quản trị cấp 1", sup], ["quản trị nội dung", content]] as const) {
      const r = await api("GET", tPath(tClassQ.id), { as: u });
      check(`${who} xem được bài lớp (200) và thấy tên lớp`, r.status === 200 && r.json?.course?.name === CLASS_NAME, { status: r.status, course: r.json?.course });
      const f = await feed(u, `scope=${C.id}`);
      check(`${who} feed?scope=<lớp> → 200 có bài lớp`, f.status === 200 && feedIds(f).includes(tClass.id), { status: f.status });
    }
    check("feed mặc định của thành viên lớp có bài lớp", feedIds(await feed(sA, "limit=50")).includes(tClassT.id));
    check("feed mặc định của GS khác lớp KHÔNG có bài lớp", !feedIds(await feed(tOther, "limit=50")).includes(tClassT.id));

    // Bị loại khỏi lớp giữa chừng.
    check("sC (đang trong lớp) lưu được bài lớp và bài chung", (await post(sC, tPath(tClass.id, "/bookmark"))).json?.bookmarkedByMe === true && (await post(sC, tPath(tCommon.id, "/bookmark"))).json?.bookmarkedByMe === true);
    const bm1 = await api("GET", "/api/community/bookmarks", { as: sC });
    check("trước khi bị loại: 'Đã lưu' có cả bài lớp", bm1.json?.items?.some((i: any) => i.id === tClass.id) && bm1.json?.items?.some((i: any) => i.id === tCommon.id), bm1.json?.items?.map((i: any) => i.id));
    await prisma.enrollment.update({ where: { userId_courseId: { userId: sC.id, courseId: C.id } }, data: { status: "suspended" } });
    const bm2 = await api("GET", "/api/community/bookmarks", { as: sC });
    check("sau khi bị loại: 'Đã lưu' KHÔNG còn bài lớp, vẫn còn bài chung", !bm2.text.includes(tClass.mark) && !bm2.json?.items?.some((i: any) => i.id === tClass.id) && bm2.json?.items?.some((i: any) => i.id === tCommon.id), bm2.json?.items?.map((i: any) => i.id));
    check("sau khi bị loại: GET bài lớp → 404, thích → 404, feed?scope → 403", (await api("GET", tPath(tClass.id), { as: sC })).status === 404 && (await post(sC, tPath(tClass.id, "/like"))).status === 404 && (await feed(sC, `scope=${C.id}`)).status === 403);
    check("sau khi bị loại: feed mặc định không có bài lớp", !(await feed(sC, "limit=50")).text.includes(tClass.mark));
    await prisma.enrollment.update({ where: { userId_courseId: { userId: sC.id, courseId: C.id } }, data: { status: "active" } });

    // Đăng vào lớp khi không là thành viên.
    const bad = await post(sB, "/api/community/threads", { content: "Em muốn đăng vào lớp", category: "goc-vui", courseId: C.id });
    check("HS ngoài lớp đăng vào lớp → 403 not_member", bad.status === 403 && bad.json?.code === "not_member", { status: bad.status, body: bad.json });
    const bad2 = await post(tOther, "/api/community/threads", { content: "GS khác đăng vào lớp", category: "goc-vui", courseId: C.id });
    check("GS không phải chủ lớp đăng vào lớp → 403", bad2.status === 403, { status: bad2.status });
  }

  // ═════════════════════════════════════════ 3. Chọn là đúng ═════════════════════════════════════════
  section("3. accept-reply: ai được chọn, chọn đúng bài, đổi được, song song");
  {
    const a = (u: TUser | undefined, threadId: string, replyId: unknown) => post(u, tPath(threadId, "/accept-reply"), { replyId });
    const r1 = await a(sB, tQ.id, rQ1.id);
    check("HS không phải chủ câu hỏi → 403 not_allowed", r1.status === 403 && r1.json?.code === "not_allowed", { status: r1.status, body: r1.json });
    const r2 = await a(tOwner, tQ.id, rQ2.id);
    check("GS (chủ lớp nhưng câu hỏi là bài CHUNG) → 403", r2.status === 403, { status: r2.status });
    const r3 = await a(tOther, tQ.id, rQ1.id);
    check("GS khác → 403", r3.status === 403);
    check("chưa ai được chọn: acceptedReplyId vẫn null", (await prisma.thread.findUnique({ where: { id: tQ.id } }))?.acceptedReplyId === null);
    const det0 = await api("GET", tPath(tQ.id), { as: sB });
    const det1 = await api("GET", tPath(tQ.id), { as: sA });
    check("canAccept: chủ câu hỏi true, người khác false", det1.json?.canAccept === true && det0.json?.canAccept === false, { owner: det1.json?.canAccept, other: det0.json?.canAccept });
    const wrong = await a(sA, tQ.id, rOther2.id);
    check("replyId của BÀI KHÁC → 400 reply_invalid", wrong.status === 400 && wrong.json?.code === "reply_invalid", { status: wrong.status, body: wrong.json });
    const del = await a(sA, tQ.id, rQDel.id);
    check("replyId đã xoá → 400 reply_invalid", del.status === 400 && del.json?.code === "reply_invalid", { status: del.status });
    const ghost = await a(sA, tQ.id, GHOST_REPLY);
    check("replyId không tồn tại → 400", ghost.status === 400);
    const noBody = await post(sA, tPath(tQ.id, "/accept-reply"));
    check("thiếu replyId → 400, không 500", noBody.status === 400, { status: noBody.status });
    const numeric = await a(sA, tQ.id, 123);
    check("replyId không phải chuỗi → 400", numeric.status === 400);
    const notQ = await a(sA, tPostForAccept.id, rPost.id);
    check("bài thường (kind=post) → 400 not_a_question", notQ.status === 400 && notQ.json?.code === "not_a_question", { status: notQ.status, body: notQ.json });
    check("sau các ca xấu: vẫn chưa ai được chọn", (await prisma.thread.findUnique({ where: { id: tQ.id } }))?.acceptedReplyId === null);

    const ok1 = await a(sA, tQ.id, rQ1.id);
    check("chủ câu hỏi chọn → 200 và trả acceptedReplyId", ok1.status === 200 && ok1.json?.acceptedReplyId === rQ1.id, { status: ok1.status, body: ok1.json });
    const ok2 = await a(sA, tQ.id, rQ2.id);
    check("đổi sang trả lời khác → 200", ok2.status === 200 && (await prisma.thread.findUnique({ where: { id: tQ.id } }))?.acceptedReplyId === rQ2.id);
    const again = await a(sA, tQ.id, rQ2.id);
    check("chọn lại đúng trả lời đó → 200 (idempotent)", again.status === 200);
    const det = await api("GET", tPath(tQ.id));
    check("chi tiết: acceptedReplyId đúng, cây có isAccepted đúng một nút, feed.answered = true", det.json?.acceptedReplyId === rQ2.id && JSON.stringify(det.json?.replies).split('"isAccepted":true').length === 2 && (await feed(undefined, "limit=50")).json?.items?.find((i: any) => i.id === tQ.id)?.answered === true);
    const nQ2 = await prisma.notification.findMany({ where: { userId: tOwner.id, type: "reply_accepted" } });
    check("thông báo 'được chọn' tới tác giả trả lời: đúng chữ, liên kết /cong-dong/<id>#r-<replyId>", nQ2.length === 1 && nQ2[0].title === "Trả lời được chọn" && nQ2[0].message === "Một trả lời của bạn được chọn là đúng" && nQ2[0].link === `/cong-dong/${tQ.id}#r-${rQ2.id}`, nQ2.map(n => [n.message, n.link]));

    // Câu hỏi của lớp.
    const c1 = await a(tOther, tClassQ.id, rCQ1.id);
    check("GS khác lớp chọn trong câu hỏi lớp → 404 (không thấy bài)", c1.status === 404, { status: c1.status });
    const c2 = await a(sB, tClassQ.id, rCQ1.id);
    check("HS ngoài lớp chọn → 404", c2.status === 404);
    const c3 = await a(sD, tClassQ.id, rCQ1.id);
    check("HS TRONG lớp nhưng không phải chủ câu hỏi → 403", c3.status === 403, { status: c3.status });
    const c4 = await a(tOwner, tClassQ.id, rCQ1.id);
    check("GS chủ lớp chọn trong câu hỏi lớp → 200", c4.status === 200 && c4.json?.acceptedReplyId === rCQ1.id, { status: c4.status });
    const c5 = await a(sup, tClassQ.id, rCQ2.id);
    check("quản trị chọn (đổi) → 200", c5.status === 200 && (await prisma.thread.findUnique({ where: { id: tClassQ.id } }))?.acceptedReplyId === rCQ2.id);
    const dc = await api("GET", tPath(tClassQ.id), { as: tOwner });
    check("canAccept của GS chủ lớp = true; của HS khác trong lớp = false", dc.json?.canAccept === true && (await api("GET", tPath(tClassQ.id), { as: sD })).json?.canAccept === false);

    // Song song: 5 yêu cầu của chủ câu hỏi, 3 trả lời khác nhau.
    const q3 = await mkThread({ authorId: sA.id, kind: "question", mark: mk("QPAR") });
    const p1 = await mkReply(q3.id, sB.id), p2 = await mkReply(q3.id, sC.id), p3 = await mkReply(q3.id, tOwner.id);
    const rs = await Promise.all([p1, p2, p3, p1, p2].map(p => a(sA, q3.id, p.id)));
    check("5 accept-reply song song → toàn 200, không 500", rs.every(r => r.status === 200), rs.map(r => r.status));
    const final = (await prisma.thread.findUnique({ where: { id: q3.id } }))?.acceptedReplyId;
    check("acceptedReplyId cuối là một trong các replyId hợp lệ", [p1.id, p2.id, p3.id].includes(final ?? ""), final);
  }

  // ═════════════════════════════════════════ 4. Bài ẩn ═════════════════════════════════════════
  section("4. Bài xoá mềm / chờ duyệt / bị từ chối: không lộ ở đâu, không tạo hàng");
  {
    const viewers: [string, TUser | undefined][] = [["khách", undefined], ["HS bất kỳ", sB], ["HS từng lưu", sA], ["GS", tOther], ["quản trị", sup]];
    for (const h of HIDDEN) {
      for (const [who, u] of viewers) {
        const real = await api("GET", tPath(h.t.id), { as: u });
        const ghost = await api("GET", tPath(GHOST_THREAD), { as: u });
        check(`[${h.name}] ${who} GET chi tiết → 404, cùng thân với bài không tồn tại`, real.status === 404 && real.text === ghost.text, { status: real.status, text: real.text.slice(0, 100) });
      }
      const before = await counts();
      for (const [who, u] of [["HS", sB], ["HS từng lưu", sA], ["quản trị", sup], ["GS", tOwner]] as const) {
        const tries: [string, R][] = [
          ["like", await post(u, tPath(h.t.id, "/like"))], ["bookmark", await post(u, tPath(h.t.id, "/bookmark"))],
          ["reply", await post(u, tPath(h.t.id, "/reply"), { content: "chèn vào bài ẩn" })], ["report", await post(u, tPath(h.t.id, "/report"), { reason: "báo bài ẩn" })],
          ["accept-reply", await post(u, tPath(h.t.id, "/accept-reply"), { replyId: h.reply.id })],
          ["thích trả lời", await post(u, `/api/community/replies/${h.reply.id}/like`)],
        ];
        for (const [label, r] of tries) check(`[${h.name}] ${who} ${label} → 404`, r.status === 404, { status: r.status, body: r.text.slice(0, 100) });
      }
      check(`[${h.name}] không tạo / xoá hàng ThreadLike / Bookmark / Reply / Report / ReplyLike`, sameCounts(before, await counts()), { before, after: await counts() });
    }
    // Mọi mặt đọc.
    for (const [who, u] of viewers) {
      const surfaces: [string, R][] = [
        ["feed", await feed(u, "limit=50")], ["feed hoi-dap", await feed(u, "tab=hoi-dap&limit=50")], ["feed common", await feed(u, "scope=common&limit=50")], ["feed kinh-nghiem", await feed(u, "tab=kinh-nghiem&limit=50")],
        ["sidebar", await api("GET", "/api/community/sidebar", { as: u })], ["hồ sơ gia sư", await api("GET", `/api/community/profiles/${tOwner.id}?limit=50`, { as: u })],
        ["danh sách cũ", await api("GET", "/api/community/threads?limit=100", { as: u })],
      ];
      if (u) surfaces.push(["bookmarks (đã lưu TRƯỚC khi ẩn)", await api("GET", "/api/community/bookmarks?limit=50", { as: u })]);
      for (const [label, r] of surfaces) {
        const leaked = [...hiddenMarks, ...hiddenIds].filter(s => r.text.includes(s));
        check(`${who}: ${label} → 200 và không lộ bài ẩn / trả lời của bài ẩn`, r.status === 200 && leaked.length === 0, { status: r.status, leaked });
      }
    }
    // Hồ sơ của tài khoản khách hệ thống.
    check("hồ sơ của tài khoản 'khách' hệ thống → 404", (await api("GET", `/api/community/profiles/${guestUser.id}`)).status === 404 && (await api("GET", `/api/community/profiles/${guestUser.id}`, { as: sup })).status === 404);
    // Gia sư chỉ trả lời ở bài ẩn thì không "nổi bật".
    const sb = await api("GET", "/api/community/sidebar");
    // Qua API: chủ bài xoá bài của mình.
    const mine = await mkThread({ authorId: sA.id, mark: mk("MINE") });
    await prisma.threadBookmark.create({ data: { userId: sB.id, threadId: mine.id } });
    check("trước khi xoá: bài của sA hiện ở feed khách", feedIds(await feed(undefined, "limit=50")).includes(mine.id));
    check("sB (không phải chủ) xoá → 403", (await api("DELETE", tPath(mine.id), { as: sB })).status === 403);
    const d1 = await api("DELETE", tPath(mine.id), { as: sA });
    check("chủ bài xoá → 200", d1.status === 200, { status: d1.status });
    check("xoá lần hai → 404", (await api("DELETE", tPath(mine.id), { as: sA })).status === 404);
    check("sau xoá: biến khỏi feed khách, chi tiết 404, 'Đã lưu' của sB không còn", !(await feed(undefined, "limit=50")).text.includes(mine.mark) && (await api("GET", tPath(mine.id))).status === 404 && !(await api("GET", "/api/community/bookmarks?limit=50", { as: sB })).text.includes(mine.mark));
    check("sau xoá: hàng vẫn còn trong DB với deletedAt (xoá mềm)", !!(await prisma.thread.findUnique({ where: { id: mine.id } }))?.deletedAt);
    const mine2 = await mkThread({ authorId: sA.id, mark: mk("MINE2") });
    check("quản trị xoá bài của người khác → 200", (await api("DELETE", tPath(mine2.id), { as: sup })).status === 200);
    // Trả lời xoá mềm.
    const dR = await mkReply(tCommon.id, sC.id, { deleted: true, mark: mk("RPDEL") });
    const dRchild = await mkReply(tCommon.id, sD.id, { parent: dR.id, mark: mk("RPCHILD") });
    const det = await api("GET", tPath(tCommon.id));
    const node = det.json?.replies?.find((x: any) => x.id === dR.id);
    check("trả lời đã xoá: không lộ nội dung / tên, đánh dấu deleted, ô giữ chỗ còn con", !det.text.includes(dR.mark) && node?.deleted === true && node?.content === "" && node?.author?.label === "" && node?.children?.some((c: any) => c.id === dRchild.id && c.content.includes(dRchild.mark)), node);
    check("thích trả lời đã xoá → 404", (await post(sB, `/api/community/replies/${dR.id}/like`)).status === 404);
    // Gốc đã xoá, mọi con cũng xoá → bỏ hẳn nút.
    const dR2 = await mkReply(tCommon.id, sC.id, { deleted: true, mark: mk("RPGONE") });
    await mkReply(tCommon.id, sD.id, { parent: dR2.id, deleted: true, mark: mk("RPGONEC") });
    const det2 = await api("GET", tPath(tCommon.id));
    check("gốc xoá + toàn con xoá → không còn nút trong cây", !det2.json?.replies?.some((x: any) => x.id === dR2.id));
  }

  // ═════════════════════════════════════════ 5. Quét JSON ═════════════════════════════════════════
  section("5. JSON không lộ khoá / tên đầy đủ học sinh / email");
  {
    // Chứng cứ có thật để quét không rỗng: học sinh sB đăng + trả lời + câu hỏi cũ.
    const viewers: [string, TUser | undefined][] = [["khách", undefined], ["sA", sA], ["sB", sB], ["GS", tOwner], ["quản trị", sup]];
    const bodies: { label: string; r: R; viewer: string }[] = [];
    for (const [who, u] of viewers) {
      for (const [label, path] of [
        ["feed", "/api/community/feed?limit=50"], ["feed hoi-dap", "/api/community/feed?tab=hoi-dap&limit=50"], ["feed common", "/api/community/feed?scope=common&limit=50"],
        ["chi tiết bài + trả lời", tPath(tCommon.id)], ["chi tiết câu hỏi", tPath(tQ.id)], ["sidebar", "/api/community/sidebar"],
        ["hồ sơ gia sư", `/api/community/profiles/${tOwner.id}`], ["danh sách cũ", "/api/community/threads?limit=100"], ["/api/questions", "/api/questions"],
      ] as const) {
        if (who === "quản trị" && label === "danh sách cũ") continue;   // route cũ CỐ Ý cho quản trị thấy tên đầy đủ (kiểm duyệt) — không đổi trong BU-05
        bodies.push({ label, r: await api("GET", path, { as: u }), viewer: who });
      }
      if (u) {
        bodies.push({ label: "bookmarks", r: await api("GET", "/api/community/bookmarks", { as: u }), viewer: who });
        bodies.push({ label: "/api/questions/[id]", r: await api("GET", `/api/questions/${legacyQ.id}`, { as: u }), viewer: who });
      }
    }
    bodies.push({ label: "hồ sơ chính mình (sB)", r: await api("GET", `/api/community/profiles/${sB.id}`, { as: sB }), viewer: "sB" });
    bodies.push({ label: "moderation/pending", r: await api("GET", "/api/community/moderation/pending", { as: sup }), viewer: "quản trị" });
    // Phản hồi ghi.
    const wp = await post(sB, "/api/community/threads", { content: `Bài của Bích ${mk("SBPOST")}`, category: "goc-vui" });
    bodies.push({ label: "POST /threads (201)", r: wp, viewer: "sB" });
    const wr = await post(sB, tPath(tCommon.id, "/reply"), { content: `Trả lời của Bích ${mk("SBREPLY")}` });
    bodies.push({ label: "POST reply (201)", r: wr, viewer: "sB" });
    bodies.push({ label: "POST like", r: await post(sB, tPath(tCommon.id, "/like")), viewer: "sB" });
    bodies.push({ label: "POST bookmark", r: await post(sB, tPath(tQ.id, "/bookmark")), viewer: "sB" });

    let totalBodies = 0;
    for (const { label, r, viewer } of bodies) {
      if (r.status === 404 && /hồ sơ/.test(label)) continue;
      totalBodies++;
      const keys = forbiddenKeys(r.json);
      const secrets = secretsFor().filter(s => r.text.includes(s));
      check(`${viewer} · ${label}: không khoá cấm, không email / tên đầy đủ học sinh`, keys.length === 0 && secrets.length === 0 && r.status < 500, { status: r.status, keys: keys.slice(0, 5), secrets });
    }
    const g = await feed(undefined, "limit=50");
    check("đối chứng: feed khách CÓ tên rút gọn 'Bích T.' và 'An N.' (quét không rỗng)", g.text.includes('"label":"Bích T."') && g.text.includes('"label":"An N."'), g.json?.items?.slice(0, 3)?.map((i: any) => i.author));
    check(`đã quét ${totalBodies} phản hồi`, totalBodies > 40);
    const own = wp.json;
    check("201 của bài mới: kind post, isOwn true, tên tác giả rút gọn, href đúng", own?.kind === "post" && own?.isOwn === true && own?.author?.label === "Bích T." && own?.href === `/cong-dong/${own?.id}`, own);

    // Hồ sơ.
    const pS = await api("GET", `/api/community/profiles/${sB.id}`);
    check("hồ sơ HỌC SINH (người lạ) → 404", pS.status === 404, { status: pS.status });
    check("hồ sơ học sinh bởi HS khác → 404", (await api("GET", `/api/community/profiles/${sB.id}`, { as: sA })).status === 404);
    const selfProf = bodies.find(b => b.label === "hồ sơ chính mình (sB)")?.r.json?.profile;
    check("hồ sơ của CHÍNH MÌNH (học sinh) → 200, isSelf true, tên rút gọn, không email", selfProf?.isSelf === true && selfProf?.label === "Bích T.", selfProf);
    check("hồ sơ GS chưa xác minh → 404", (await api("GET", `/api/community/profiles/${tUnver.id}`)).status === 404);
    check("hồ sơ quản trị → 404", (await api("GET", `/api/community/profiles/${sup.id}`)).status === 404);
    check("hồ sơ id không tồn tại → 404", (await api("GET", `/api/community/profiles/${GHOST_THREAD}`)).status === 404);
    const pT = await api("GET", `/api/community/profiles/${tOwner.id}`);
    check("hồ sơ GS: tên đầy đủ, tag gia-su, bio ≤ 300, môn dạy, không bài lớp", pT.status === 200 && pT.json?.profile?.label === "Cô Lan Anh" && pT.json?.profile?.tag === "gia-su" && pT.json?.profile?.bio.length <= 300 && pT.json?.profile?.bio.length > 0 && pT.json?.profile?.subjects?.includes("Toán 9"), pT.json?.profile);
    await prisma.user.update({ where: { id: tOwner.id }, data: { profileLockedAt: new Date() } });
    check("hồ sơ GS bị khoá (profileLockedAt) → 404 cho người lạ", (await api("GET", `/api/community/profiles/${tOwner.id}`)).status === 404);
    const lockedItems = ((await feed(undefined, "limit=50")).json?.items ?? []).concat((await feed(undefined)).json?.pinned ?? []).filter((i: any) => i.author?.id === tOwner.id);
    check("…và tên GS bị khoá không còn là liên kết trong feed (có bài để kiểm)", lockedItems.length > 0 && lockedItems.every((i: any) => i.author.href === null), lockedItems.length);
    check("…nhưng chính GS vẫn xem được hồ sơ mình (isSelf)", (await api("GET", `/api/community/profiles/${tOwner.id}`, { as: tOwner })).json?.profile?.isSelf === true);
    await prisma.user.update({ where: { id: tOwner.id }, data: { profileLockedAt: null } });
    check("khoá xong mở lại: hồ sơ 200", (await api("GET", `/api/community/profiles/${tOwner.id}`)).status === 200);

    // Tag / href của tác giả.
    const withUnver = await mkThread({ authorId: tUnver.id, mark: mk("UNVER") });
    const feedU = (await feed(undefined, "limit=50")).json?.items?.find((i: any) => i.id === withUnver.id);
    check("GS chưa xác minh hiện như thành viên thường: không thẻ, không liên kết, tên rút gọn", feedU?.author?.tag === null && feedU?.author?.href === null && feedU?.author?.label === "Duyệt G.", feedU?.author);
    const withTCommon = await mkThread({ authorId: tOwner.id, mark: mk("TUTORPOST") });
    const feedT = (await feed(undefined, "limit=50")).json?.items?.find((i: any) => i.id === withTCommon.id);
    check("GS đã xác minh: tên đầy đủ + thẻ gia-su + liên kết /cong-dong/ho-so/<id>", feedT?.author?.label === "Cô Lan Anh" && feedT?.author?.tag === "gia-su" && feedT?.author?.href === `/cong-dong/ho-so/${tOwner.id}`, feedT?.author);
    const withAdmin = await mkThread({ authorId: sup.id, mark: mk("ADMINPOST") });
    check("quản trị: tên đầy đủ + thẻ quan-tri, không liên kết hồ sơ", (await feed(undefined, "limit=50")).json?.items?.find((i: any) => i.id === withAdmin.id)?.author?.tag === "quan-tri");
    const headersOk = await Promise.all([feed(undefined), api("GET", "/api/community/bookmarks", { as: sA }), api("GET", tPath(tCommon.id)), api("GET", `/api/community/profiles/${tOwner.id}`)]);
    check("feed / bookmarks / chi tiết / hồ sơ: Cache-Control private, no-store", headersOk.every(r => /private/.test(r.headers.get("cache-control") ?? "") && /no-store/.test(r.headers.get("cache-control") ?? "")), headersOk.map(r => r.headers.get("cache-control")));
    // Cột phải.
    const s1 = await api("GET", "/api/community/sidebar"), s2 = await api("GET", "/api/community/sidebar", { as: sA });
    check("sidebar: Cache-Control public s-maxage, không Set-Cookie, khách và HS nhận CÙNG thân (không dữ liệu theo người dùng)", /public/.test(s1.headers.get("cache-control") ?? "") && /s-maxage=300/.test(s1.headers.get("cache-control") ?? "") && !s1.headers.get("set-cookie") && s1.text === s2.text, s1.headers.get("cache-control"));
  }

  // ═════════════════════════════════════════ 6. Cột phải ═════════════════════════════════════════
  section("6. Cột phải: chỉ số liệu thật, ≤3 gia sư, ≤5 câu hỏi, không bịa");
  {
    // Trước: chưa gia sư nào có trả lời hợp lệ ngoài tOwner (tOwner trả lời tQ chung, 1 lần, đã công khai). Dựng thêm.
    const t1 = await mkTutor("Cô Một"), t2 = await mkTutor("Thầy Hai"), t3 = await mkTutor("Cô Ba"), t4 = await mkTutor("Thầy Tư");
    const tLocked = await mkTutor("Cô Bị Khoá"); await prisma.user.update({ where: { id: tLocked.id }, data: { profileLockedAt: new Date() } });
    const tOld = await mkTutor("Cô Cũ");
    const q1 = await mkThread({ authorId: sA.id, kind: "question", mark: mk("SBQ1") }), q2 = await mkThread({ authorId: sA.id, kind: "question", mark: mk("SBQ2") });
    const DAY = 86_400_000;
    // tOwner có 2 trả lời hợp lệ ở tQ/ tCommon cộng thêm các trả lời hợp lệ dưới đây: để chắc chắn thứ hạng, đếm lại từ DB.
    for (let i = 0; i < 9; i++) await mkReply(i % 2 ? q1.id : q2.id, t1.id);
    for (let i = 0; i < 6; i++) await mkReply(i % 2 ? q1.id : q2.id, t2.id);
    for (let i = 0; i < 4; i++) await mkReply(i % 2 ? q1.id : q2.id, t3.id);
    await mkReply(q1.id, t4.id);                                                       // chỉ 1 → bị cắt ở top 3
    for (let i = 0; i < 20; i++) await mkReply(q1.id, tLocked.id);                    // khoá hồ sơ → loại
    for (let i = 0; i < 20; i++) await mkReply(q1.id, tUnver.id);                     // chưa xác minh → loại
    for (let i = 0; i < 20; i++) await mkReply(q1.id, sC.id);                         // học sinh → loại
    for (let i = 0; i < 20; i++) await mkReply(q1.id, tOld.id, { createdAt: new Date(Date.now() - 40 * DAY) });   // quá 30 ngày → loại
    for (let i = 0; i < 20; i++) await mkReply(q1.id, t4.id, { deleted: true });      // trả lời đã xoá → không tính
    for (let i = 0; i < 20; i++) await mkReply(tClassQ.id, t3.id);                    // bài lớp → không tính
    for (const h of HIDDEN) for (let i = 0; i < 20; i++) await mkReply(h.t.id, t4.id); // bài ẩn → không tính
    const sb = await api("GET", "/api/community/sidebar");
    const tutors: any[] = sb.json?.tutors ?? [];
    const own = await prisma.threadReply.count({ where: { authorId: tOwner.id, deletedAt: null, createdAt: { gte: new Date(Date.now() - 30 * DAY) }, thread: { deletedAt: null, status: "published", kind: "question", courseId: null } } });
    const expect = [{ id: t1.id, n: 9 }, { id: t2.id, n: 6 }, { id: t3.id, n: 4 }, { id: tOwner.id, n: own }].sort((a, b) => b.n - a.n).slice(0, 3);
    check("gia sư nổi bật: đúng ≤3, đúng người, xếp theo số trả lời THẬT trong 30 ngày", tutors.length === 3 && tutors.every((t, i) => t.id === expect[i].id && t.answers30d === expect[i].n), { got: tutors.map(t => [t.label, t.answers30d]), want: expect });
    check("gia sư khoá / chưa xác minh / học sinh / quá 30 ngày / trả lời đã xoá / bài lớp / bài ẩn: không có mặt", !tutors.some(t => [tLocked.id, tUnver.id, sC.id, tOld.id].includes(t.id)) && !tutors.some(t => t.id === t4.id));
    check("mỗi gia sư có href hồ sơ và tên đầy đủ", tutors.every(t => t.href === `/cong-dong/ho-so/${t.id}` && t.label.length > 2));

    // Chưa trả lời.
    const marks: string[] = [];
    for (let i = 0; i < 6; i++) { const u = await mkThread({ authorId: sA.id, kind: "question", mark: mk(`UNANS${i}`), createdAt: new Date(Date.now() + 10_000 + i * 1000) }); marks.push(u.id); }
    const answeredQ = await mkThread({ authorId: sA.id, kind: "question", mark: mk("ANSW"), createdAt: new Date(Date.now() + 20_000) });
    const ar = await mkReply(answeredQ.id, sB.id);
    const sbq = await api("GET", "/api/community/sidebar");
    const un: any[] = sbq.json?.unanswered ?? [];
    check("câu hỏi chưa trả lời: đúng 5, mới nhất trước, đúng 5 trong 6 vừa tạo (bỏ cái cũ nhất)", un.length === 5 && un.map(x => x.key).join() === [5, 4, 3, 2, 1].map(i => `t:${marks[i]}`).join(), un.map(x => x.key));
    check("câu hỏi đã có trả lời không có mặt; href đúng /cong-dong/<id>", !un.some(x => x.key === `t:${answeredQ.id}`) && un.every(x => /^\/cong-dong\/[A-Za-z0-9_-]+$/.test(x.href)));
    check("câu hỏi chưa trả lời không chứa bài lớp / bài ẩn", !sbq.text.includes(tClassQ.mark) && hiddenMarks.every(m => !sbq.text.includes(m)));
    const legacyOpen = await prisma.question.create({ data: { authorId: sC.id, title: `Câu hỏi cũ chưa trả lời ${mk("LEGOPEN")}`, content: "cũ", bountyPaid: 0, createdAt: new Date(Date.now() + 60_000) } });
    const sbl = await api("GET", "/api/community/sidebar", { as: sB });
    check("câu hỏi CŨ chưa trả lời cũng lên cột phải của NGƯỜI ĐÃ ĐĂNG NHẬP, href /cong-dong/hoi-dap/<id>", sbl.json?.unanswered?.[0]?.href === `/cong-dong/hoi-dap/${legacyOpen.id}`, sbl.json?.unanswered?.[0]);
    check("…và bản đó `private, no-store` (không để bộ nhớ đệm dùng chung giữ rồi phát cho khách)", /private/.test(sbl.headers.get("cache-control") ?? "") && /no-store/.test(sbl.headers.get("cache-control") ?? ""), sbl.headers.get("cache-control"));
    const sbg = await api("GET", "/api/community/sidebar");
    check("3A: KHÁCH không thấy câu hỏi cũ ở cột phải (không href /cong-dong/hoi-dap/…, không tiêu đề cũ)", !sbg.text.includes("/cong-dong/hoi-dap/") && !sbg.text.includes(legacyOpen.id) && !sbg.text.includes("Câu hỏi cũ chưa trả lời"), sbg.json?.unanswered?.map((x: any) => x.href));
    check("…và bản của khách vẫn có 5 câu hỏi mới chưa trả lời, cache công khai 5 phút", sbg.json?.unanswered?.length === 5 && /public/.test(sbg.headers.get("cache-control") ?? "") && /s-maxage=300/.test(sbg.headers.get("cache-control") ?? ""), { n: sbg.json?.unanswered?.length, cc: sbg.headers.get("cache-control") });
    await prisma.question.delete({ where: { id: legacyOpen.id } });
    void ar;
  }

  // ═════════════════════════════════════════ 7. Khách + hàng chờ duyệt ═════════════════════════════════════════
  section(GUEST_ON ? "7. Khách đặt câu hỏi + hàng chờ duyệt (KIN_GUEST_QUESTIONS=1)" : "7. Khách đặt câu hỏi: cờ TẮT → 503, không ghi gì (KIN_GUEST_QUESTIONS không đặt)");
  const gq = (o: Record<string, unknown> = {}) => ({ name: "Bạn Khách", title: "Làm sao giải phương trình này?", content: "Mình không hiểu bước chuyển vế, nhờ mọi người giải thích giúp.", website: "", ...o });
  const guestPost = (body: unknown, ip = nextIp()) => api("POST", "/api/community/guest-questions", { body, headers: ipHeaders(ip) });
  const guestForm = (fields: Record<string, string>, ip = nextIp()) =>
    api("POST", "/api/community/guest-questions", { raw: new URLSearchParams(fields).toString(), headers: { "content-type": "application/x-www-form-urlencoded", ...ipHeaders(ip) } });
  const pendingGuestRows = () => prisma.thread.findMany({ where: { guestName: { not: null }, status: "pending" }, orderBy: { createdAt: "desc" } });

  if (!GUEST_ON) {
    const before = await prisma.thread.count();
    const j = await guestPost(gq());
    check("cờ TẮT: JSON → 503 guest_questions_closed", j.status === 503 && j.json?.code === "guest_questions_closed", { status: j.status, body: j.text.slice(0, 120) });
    const f = await guestForm({ name: "Bạn Khách", title: "Làm sao giải phương trình này?", content: "Mình không hiểu bước chuyển vế, nhờ giúp.", website: "" });
    check("cờ TẮT: form → 503 (không chuyển hướng, không giả vờ đã nhận)", f.status === 503, { status: f.status, location: f.headers.get("location") });
    const honey = await guestPost(gq({ website: "http://spam" }));
    check("cờ TẮT: ngay cả ô bẫy cũng 503 (cổng đóng trước mọi xử lý)", honey.status === 503);
    check("cờ TẮT: không hàng mới nào", (await prisma.thread.count()) === before);
    check("cờ TẮT: hàng chờ duyệt của QT không có gì mới", !(await api("GET", "/api/community/moderation/pending", { as: sup })).text.includes("Bạn Khách"));
  } else {
    // 7.1 Hợp lệ
    const ip1 = nextIp();
    const before = await pendingGuestRows();
    const mark = mk("GUESTOK");
    const ok = await guestPost(gq({ title: `Tiêu đề ${mark}`, content: `Nội dung câu hỏi ${mark} đủ dài để hợp lệ.` }), ip1);
    check("khách gửi hợp lệ → 201 { ok:true, status:'pending' }", ok.status === 201 && ok.json?.ok === true && ok.json?.status === "pending", { status: ok.status, body: ok.text.slice(0, 160) });
    const row = (await pendingGuestRows()).find(r => r.content.includes(mark));
    check("DB: status pending, kind question, hoi-dap, không lớp, đúng tên, tác giả là tài khoản khách hệ thống", !!row && row.status === "pending" && row.kind === "question" && row.category === "hoi-dap" && row.courseId === null && row.guestName === "Bạn Khách" && row.authorId === guestUser.id && row.imageUrls.length === 0 && row.fileUrl === null, row);
    check("DB: guestIpHash là HMAC của IP, không phải IP thô", !!row?.guestIpHash && row.guestIpHash.length === 64 && !row.guestIpHash.includes(ip1) && !!row.guestIpHash.match(/^[0-9a-f]{64}$/));
    const ipTrusted = row?.guestIpHash === hashOf(ip1);
    check("MÔI TRƯỜNG: máy chủ dùng x-forwarded-for do bài gửi (guestIpHash = HMAC(IP cuối của header)); nếu đỏ thì các ca giới hạn tần suất bên dưới vô nghĩa", ipTrusted, { got: row?.guestIpHash?.slice(0, 12), want: hashOf(ip1).slice(0, 12) });
    if (!row) throw new Error("không tìm thấy hàng khách vừa gửi (xem ca trên)");
    check("chưa duyệt: KHÔNG có trong feed của khách / HS / GS / QT, không trong 'Đã lưu' / cột phải / hồ sơ / danh sách cũ", await (async () => {
      for (const u of [undefined, sB, tOwner, sup]) {
        for (const r of [await feed(u, "limit=50"), await feed(u, "tab=hoi-dap&limit=50"), await api("GET", "/api/community/sidebar", { as: u }), await api("GET", "/api/community/threads?limit=100", { as: u }), await api("GET", `/api/community/profiles/${tOwner.id}`, { as: u })]) {
          if (r.text.includes(mark) || (row && r.text.includes(row.id))) return false;
        }
      }
      return true;
    })());
    for (const [who, u] of [["khách", undefined], ["HS", sB], ["QT", sup]] as const) {
      const d = await api("GET", tPath(row!.id), { as: u });
      check(`chưa duyệt: ${who} GET chi tiết → 404 (kể cả quản trị)`, d.status === 404, { status: d.status });
    }
    check("chưa duyệt: không ai thích / lưu / trả lời / báo cáo được (404, không tạo hàng)", await (async () => {
      const b = await counts();
      const rs = [await post(sB, tPath(row!.id, "/like")), await post(sB, tPath(row!.id, "/bookmark")), await post(sB, tPath(row!.id, "/reply"), { content: "x" }), await post(sB, tPath(row!.id, "/report"), { reason: "x" })];
      return rs.every(r => r.status === 404) && sameCounts(b, await counts());
    })());
    check("không thông báo nào cho tài khoản khách hệ thống / không thông báo về bài chờ duyệt", (await prisma.notification.count({ where: { userId: guestUser.id } })) === 0);
    const mp = await api("GET", "/api/community/moderation/pending", { as: sup });
    const item = mp.json?.items?.find((i: any) => i.id === row!.id);
    check("QT thấy bài trong hàng chờ: tên khách, tiêu đề, nội dung, cờ liên hệ = false; không khoá cấm", !!item && item.guestName === "Bạn Khách" && item.flags?.phoneOrLink === false && forbiddenKeys(mp.json).length === 0 && !mp.text.includes(row!.guestIpHash ?? "x?x") && !mp.text.includes(GUEST_EMAIL) && before.every(b => mp.json.items.some((i: any) => i.id === b.id)), item);

    // 7.2 Cờ liên hệ
    const withPhone = await guestPost(gq({ content: "Gọi mình số 0901234567 nhé, mình cần giải gấp bài này." }));
    const withLink = await guestPost(gq({ content: "Xem đề ở http://example.com/de-bai nhé mọi người giúp mình." }));
    const mp2 = await api("GET", "/api/community/moderation/pending?limit=50", { as: sup });
    check("hàng chờ: chip phoneOrLink = true cho số điện thoại và liên kết", withPhone.status === 201 && withLink.status === 201 && mp2.json.items.filter((i: any) => i.flags.phoneOrLink).length >= 2 && mp2.json.items.find((i: any) => i.content.includes("0901234567"))?.flags.phoneOrLink === true && mp2.json.items.find((i: any) => i.content.includes("example.com"))?.flags.phoneOrLink === true);
    check("hàng chờ: chữ 'chín không một' KHÔNG bị bắt là số", (await guestPost(gq({ content: "Số chín không một hai ba bốn năm sáu bảy tám, đọc bằng chữ nhé." }))).status === 201 && !(await api("GET", "/api/community/moderation/pending?limit=50", { as: sup })).json.items.find((i: any) => i.content.includes("chín không một"))?.flags.phoneOrLink);

    // 7.3 Duyệt / từ chối
    const rApprove = await post(content, `/api/community/moderation/${row!.id}`, { decision: "approve" });
    check("QT duyệt → 200 { status:'published' }", rApprove.status === 200 && rApprove.json?.status === "published", { status: rApprove.status, body: rApprove.json });
    const after = await prisma.thread.findUnique({ where: { id: row!.id } });
    check("DB: published, reviewedById = người duyệt, reviewedAt có", after?.status === "published" && after.reviewedById === content.id && !!after.reviewedAt);
    check("audit log: đúng 1 dòng community.guest_question.approve", (await prisma.auditLog.count({ where: { resourceId: row!.id, action: "community.guest_question.approve" } })) === 1);
    for (const [who, u] of [["khách", undefined], ["HS", sB], ["GS", tOwner], ["QT", sup]] as const) {
      const f = await feed(u, "limit=50");
      const hits = (f.json?.items ?? []).filter((i: any) => i.id === row!.id);
      check(`sau duyệt: ${who} thấy bài ĐÚNG 1 lần, nhãn 'Khách', không id / liên kết, không phải của mình`, hits.length === 1 && hits[0].author.tag === "khach" && hits[0].author.label === "Bạn Khách" && hits[0].author.id === null && hits[0].author.href === null && hits[0].isOwn === false && hits[0].kind === "question" && !f.text.includes(row!.guestIpHash ?? "x?x") && !f.text.includes(GUEST_EMAIL), hits);
    }
    const dApproved = await api("GET", tPath(row!.id));
    check("sau duyệt: chi tiết 200, tác giả khách", dApproved.status === 200 && dApproved.json?.author?.tag === "khach" && forbiddenKeys(dApproved.json).length === 0, dApproved.json?.author);
    check("sau duyệt: biến khỏi hàng chờ", !(await api("GET", "/api/community/moderation/pending?limit=50", { as: sup })).json.items.some((i: any) => i.id === row!.id));
    const again = await post(sup, `/api/community/moderation/${row!.id}`, { decision: "approve" });
    check("duyệt lần hai → 409 already_decided", again.status === 409 && again.json?.code === "already_decided", { status: again.status, body: again.json });
    check("từ chối bài đã duyệt → 409", (await post(sup, `/api/community/moderation/${row!.id}`, { decision: "reject", reason: "muộn rồi" })).status === 409);
    // Thông báo không tới tài khoản khách.
    await post(sB, tPath(row!.id, "/like")); await post(sB, tPath(row!.id, "/reply"), { content: "trả lời bài của khách" });
    const rid = (await prisma.threadReply.findFirst({ where: { threadId: row!.id } }))?.id;
    await post(sA, `/api/community/replies/${rid}/like`);
    check("thích / trả lời bài của KHÁCH không tạo thông báo cho tài khoản khách hệ thống", (await prisma.notification.count({ where: { userId: guestUser.id } })) === 0);
    check("chọn trả lời đúng ở bài của khách (QT) → 200, không thông báo cho khách", (await post(sup, tPath(row!.id, "/accept-reply"), { replyId: rid })).status === 200 && (await prisma.notification.count({ where: { userId: guestUser.id } })) === 0);

    // Từ chối.
    const rejMark = mk("GUESTREJ");
    await guestPost(gq({ content: `Nội dung ${rejMark} sẽ bị từ chối ở đây.` }));
    const rr = (await pendingGuestRows()).find(r => r.content.includes(rejMark))!;
    check("từ chối không có lý do → 400 reject_reason_required", (await post(sup, `/api/community/moderation/${rr.id}`, { decision: "reject" })).json?.code === "reject_reason_required");
    check("từ chối lý do toàn khoảng trắng → 400", (await post(sup, `/api/community/moderation/${rr.id}`, { decision: "reject", reason: "   " })).status === 400);
    check("decision lạ → 400 decision_invalid", (await post(sup, `/api/community/moderation/${rr.id}`, { decision: "delete" })).json?.code === "decision_invalid");
    check("thân rỗng → 400, không 500", (await api("POST", `/api/community/moderation/${rr.id}`, { as: sup })).status === 400);
    check("bài vẫn pending sau các ca lỗi", (await prisma.thread.findUnique({ where: { id: rr.id } }))?.status === "pending");
    const rj = await post(sup, `/api/community/moderation/${rr.id}`, { decision: "reject", reason: "Có liên hệ cá nhân" });
    check("từ chối có lý do → 200 { status:'rejected' }, DB lưu rejectReason", rj.status === 200 && rj.json?.status === "rejected" && (await prisma.thread.findUnique({ where: { id: rr.id } }))?.rejectReason === "Có liên hệ cá nhân", rj.json);
    check("bị từ chối: không ở feed / chi tiết 404 / không lộ lý do", !(await feed(undefined, "limit=50")).text.includes(rejMark) && (await api("GET", tPath(rr.id), { as: sup })).status === 404 && !(await api("GET", "/api/community/moderation/pending?limit=50", { as: sup })).text.includes("Có liên hệ cá nhân"));
    check("từ chối lần hai → 409; id không tồn tại → 404; bài thường (không phải của khách) → 404", (await post(sup, `/api/community/moderation/${rr.id}`, { decision: "reject", reason: "x" })).status === 409 && (await post(sup, `/api/community/moderation/${GHOST_THREAD}`, { decision: "approve" })).status === 404 && (await post(sup, `/api/community/moderation/${tCommon.id}`, { decision: "approve" })).status === 404);
    // Song song hai người duyệt.
    const raceMark = mk("GUESTRACE");
    await guestPost(gq({ content: `Nội dung ${raceMark} để hai người cùng duyệt.` }));
    const rc = (await pendingGuestRows()).find(r => r.content.includes(raceMark))!;
    const race = await Promise.all([sup, content, sup, content, sup].map(u => post(u, `/api/community/moderation/${rc.id}`, { decision: "approve" })));
    const wins = race.filter(r => r.status === 200).length, losers = race.filter(r => r.status === 409).length;
    check("5 yêu cầu duyệt song song → đúng 1 thắng (200), 4 thua (409), không 500", wins === 1 && losers === 4, race.map(r => r.status));
    check("…và đúng 1 dòng audit log", (await prisma.auditLog.count({ where: { resourceId: rc.id, action: { startsWith: "community.guest_question" } } })) === 1);
    const hit = (await feed(undefined, "limit=50")).json.items.filter((i: any) => i.id === rc.id);
    check("…và bài hiện đúng 1 lần ở feed", hit.length === 1);

    // 7.4 Ô bẫy / ảnh / tuổi / XSS / kiểm độ dài
    const nRows = await prisma.thread.count();
    const honey = await guestPost(gq({ website: "https://spam.example" }));
    check("ô bẫy có chữ → trả như thành công (201 pending) nhưng KHÔNG lưu", honey.status === 201 && honey.json?.status === "pending" && (await prisma.thread.count()) === nRows, { status: honey.status });
    const honeyForm = await guestForm({ name: "Bot", title: "Tiêu đề bot", content: "Nội dung bot đủ dài rồi", website: "x" });
    check("ô bẫy qua form → 303 /cong-dong?da-gui=1 nhưng KHÔNG lưu", honeyForm.status === 303 && /\/cong-dong\?da-gui=1$/.test(honeyForm.headers.get("location") ?? "") && (await prisma.thread.count()) === nRows, { status: honeyForm.status, loc: honeyForm.headers.get("location") });
    for (const extra of [{ imageUrls: ["https://x/a.png"] }, { fileUrl: "https://x/a.pdf" }, { fileName: "a.pdf" }, { imageUrls: [] }]) {
      const r = await guestPost(gq(extra));
      check(`khách gửi ${Object.keys(extra)[0]} → 400 not_allowed_for_guest`, r.status === 400 && r.json?.code === "not_allowed_for_guest", { status: r.status, body: r.json });
    }
    check("các ca ảnh / tệp: không tạo hàng", (await prisma.thread.count()) === nRows);
    for (const text of ["Em 12 tuổi, nhờ mọi người giải giúp bài này nhé", "mình 11t không biết làm bài này", "Cháu 9 tuổi muốn hỏi một câu về toán"]) {
      const r = await guestPost(gq({ content: text }));
      check(`dưới 13 tự nhận ("${text.slice(0, 22)}…") → 422 under_13 có lời nhắn nhờ người lớn`, r.status === 422 && r.json?.code === "under_13" && /người lớn|bố mẹ/.test(r.json?.error ?? ""), { status: r.status, body: r.json });
    }
    check("'em 12 tuổi' ở TIÊU ĐỀ hoặc TÊN cũng bị bắt", (await guestPost(gq({ title: "Em 12 tuổi hỏi bài toán" }))).status === 422 && (await guestPost(gq({ name: "em 12 tuổi" }))).status === 422);
    check("không bắt nhầm: 'lớp 6', 'em 15 tuổi', '13 tuổi'", (await guestPost(gq({ content: "Em học lớp 6 chưa hiểu bài phân số, nhờ giúp" }))).status === 201 && (await guestPost(gq({ content: "Em 15 tuổi muốn hỏi cách học hình học" }))).status === 201 && (await guestPost(gq({ content: "Mình 13 tuổi và đang ôn thi vào lớp 10" }))).status === 201);
    check("các ca under_13 không tạo hàng", !(await pendingGuestRows()).some(r => /12 tuổi|11t|9 tuổi/.test(r.content + r.title + r.guestName)));
    // XSS
    const xssName = "<img src=x onerror=1>";
    const xssMark = mk("XSS");
    const xs = await guestPost(gq({ name: xssName, title: `Tiêu đề <script>alert(1)</script> ${xssMark}`, content: `Nội dung <b>đậm</b> & "trích" ${xssMark} đủ dài.` }));
    check("tên có HTML → 201", xs.status === 201, { status: xs.status, body: xs.json });
    const xrow = (await pendingGuestRows()).find(r => r.content.includes(xssMark))!;
    check("DB lưu NGUYÊN chuỗi (không cắt thẻ, không HTML-hoá)", xrow?.guestName === xssName && xrow.title === `Tiêu đề <script>alert(1)</script> ${xssMark}` && xrow.content.includes("<b>đậm</b> & \"trích\""), xrow && [xrow.guestName, xrow.title]);
    const xp = (await api("GET", "/api/community/moderation/pending?limit=50", { as: sup })).json.items.find((i: any) => i.id === xrow.id);
    check("danh sách duyệt trả đúng chuỗi đó", xp?.guestName === xssName && xp.title.includes("<script>alert(1)</script>"), xp);
    await post(sup, `/api/community/moderation/${xrow.id}`, { decision: "approve" });
    const xf = (await feed(undefined, "limit=50")).json.items.find((i: any) => i.id === xrow.id);
    check("sau duyệt: feed trả đúng chuỗi (văn bản thuần, để React thoát)", xf?.author?.label === xssName && xf.title.includes("<script>"), xf?.author);
    const page = await fetch(`${process.env.BASE ?? "http://localhost:3100"}/cong-dong/${xrow.id}`);
    const html = await page.text();
    check("trang /cong-dong/<id> không chứa thẻ <img src=x onerror=1> hay <script>alert(1) chưa thoát", page.status < 500 && !html.includes("<img src=x onerror=1>") && !html.includes("<script>alert(1)</script>"), { status: page.status });
    // Làm sạch
    const ctl = await guestPost(gq({ name: "A\u0000B", content: `Nội dung\u0007 hợp lệ ${mk("CTL")} nhé bạn` }));
    const crow = (await pendingGuestRows()).find(r => r.content.includes(`CTL${stamp}`));
    check("ký tự điều khiển bị bỏ / đổi thành khoảng trắng, không lưu \\u0000 hay \\u0007", ctl.status === 201 && !(crow?.content ?? "").includes("\u0007") && !(crow?.guestName ?? "").includes("\u0000"), crow && [crow.guestName, crow.content]);
    // Biên độ dài (mỗi ca một IP riêng để không dính giới hạn 3/giờ)
    const lens: [string, Record<string, unknown>, number, string?][] = [
      ["tên 1 ký tự", { name: "A" }, 400, "name_invalid"], ["tên rỗng", { name: "" }, 400, "name_invalid"], ["tên toàn khoảng trắng", { name: "   " }, 400, "name_invalid"],
      ["tên 2 ký tự", { name: "Ab" }, 201], ["tên 40 ký tự", { name: "N".repeat(40) }, 201], ["tên 41 ký tự", { name: "N".repeat(41) }, 400, "name_invalid"],
      ["tiêu đề 4", { title: "abcd" }, 400, "title_invalid"], ["tiêu đề 5", { title: "abcde" }, 201], ["tiêu đề 120", { title: "t".repeat(120) }, 201], ["tiêu đề 121", { title: "t".repeat(121) }, 400, "title_invalid"],
      ["nội dung 9", { content: "123456789" }, 400, "content_invalid"], ["nội dung 10", { content: "x".repeat(10) }, 201], ["nội dung 600", { content: "x".repeat(600) }, 201], ["nội dung 601", { content: "x".repeat(601) }, 400, "content_invalid"],
    ];
    for (const [label, o, want, code] of lens) {
      const r = await guestPost(gq(o));
      check(`độ dài: ${label} → ${want}${code ? ` ${code}` : ""}`, r.status === want && (!code || r.json?.code === code), { status: r.status, body: r.json });
    }
    // Thân xấu
    for (const [label, init] of [["thân rỗng", { raw: "", headers: { "content-type": "application/json" } }], ["JSON hỏng", { raw: "{không phải json", headers: { "content-type": "application/json" } }], ["mảng JSON", { raw: "[1,2]", headers: { "content-type": "application/json" } }], ["số JSON", { raw: "42", headers: { "content-type": "application/json" } }]] as const) {
      const r = await api("POST", "/api/community/guest-questions", { ...init, headers: { ...init.headers, ...ipHeaders(nextIp()) } });
      check(`${label} → 400 name_invalid, không 500`, r.status === 400 && r.json?.code === "name_invalid", { status: r.status, body: r.text.slice(0, 100) });
    }
    check("tên / tiêu đề / nội dung là số hoặc object → 400, không 500", (await guestPost({ name: 123, title: {}, content: ["x"], website: "" })).status === 400);

    // 7.5 Dạng form
    const formOk = await guestForm({ name: "Khách Form", title: "Câu hỏi gửi bằng form", content: "Nội dung gửi bằng form đủ dài để hợp lệ nhé.", website: "" });
    check("form hợp lệ → 303 tới /cong-dong?da-gui=1 (không phải 200 HTML)", formOk.status === 303 && /\/cong-dong\?da-gui=1$/.test(formOk.headers.get("location") ?? ""), { status: formOk.status, loc: formOk.headers.get("location") });
    check("form hợp lệ: có hàng pending 'Khách Form'", (await pendingGuestRows()).some(r => r.guestName === "Khách Form"));
    for (const [label, fields, loi] of [
      ["tên quá ngắn", { name: "A", title: "Câu hỏi hợp lệ", content: "Nội dung đủ dài rồi nhé", website: "" }, "name_invalid"],
      ["nội dung quá ngắn", { name: "Khách", title: "Câu hỏi hợp lệ", content: "ngắn", website: "" }, "content_invalid"],
      ["dưới 13", { name: "Khách", title: "Câu hỏi hợp lệ", content: "Em 12 tuổi muốn hỏi bài này", website: "" }, "under_13"],
      ["kèm ảnh", { name: "Khách", title: "Câu hỏi hợp lệ", content: "Nội dung đủ dài rồi nhé", website: "", imageUrls: "x" }, "not_allowed_for_guest"],
    ] as const) {
      const r = await guestForm(fields as Record<string, string>);
      check(`form lỗi (${label}) → 303 /cong-dong?loi=${loi}`, r.status === 303 && (r.headers.get("location") ?? "").endsWith(`/cong-dong?loi=${loi}`), { status: r.status, loc: r.headers.get("location") });
    }

    // 7.6 Giới hạn tần suất
    const ipR = nextIp();
    const burst = await Promise.all([1, 2, 3, 4, 5].map(i => guestPost(gq({ title: `Song song ${i} ${stamp}`, content: `Nội dung song song số ${i} đủ dài nhé bạn.` }), ipR)));
    const created = burst.filter(r => r.status === 201).length, limited = burst.filter(r => r.status === 429).length;
    const burstRows = await prisma.thread.findMany({ where: { title: { startsWith: "Song song " }, guestName: { not: null } } });
    check("5 yêu cầu SONG SONG cùng IP → đúng 3 × 201, 2 × 429, không 500", created === 3 && limited === 2 && burst.every(r => r.status === 201 || r.status === 429), burst.map(r => r.status));
    check("…và DB chỉ có đúng 3 hàng của đợt này", burstRows.length === 3, burstRows.length);
    check("429 mang mã rate_limited", burst.filter(r => r.status === 429).every(r => r.json?.code === "rate_limited"));
    if (ipTrusted) {
      const other = await guestPost(gq(), nextIp());
      check("IP khác vẫn gửi được", other.status === 201, { status: other.status });
      // XFF giả nhiều IP: phần đầu giả, phần cuối thật → tính theo IP cuối
      const real = nextIp();
      const forged = [`1.1.1.1, 2.2.2.2, ${real}`, `9.9.9.9,8.8.8.8, ${real}`, `7.7.7.7, ${real}`, `6.6.6.6, 5.5.5.5, 4.4.4.4, ${real}`];
      const fr: R[] = [];
      for (const x of forged) fr.push(await api("POST", "/api/community/guest-questions", { body: gq({ content: `Nội dung giả IP ${mk("FORGE")} đủ dài.` }), headers: { "x-forwarded-for": x } }));
      check("giả nhiều IP ở phần ĐẦU x-forwarded-for: vẫn tính theo IP CUỐI → 3 lần lọt, lần 4 bị 429", fr.map(r => r.status).join() === "201,201,201,429", fr.map(r => r.status));
      const forgedRows = await prisma.thread.findMany({ where: { guestIpHash: hashOf(real) } });
      check("…cả 3 hàng đều mang HMAC của IP cuối", forgedRows.length === 3);
      // Hạn 10/ngày: 10 hàng cũ 2 giờ trước (ngoài cửa sổ 1 giờ) vẫn chặn.
      const dayIp = nextIp();
      for (let i = 0; i < 10; i++) await mkThread({ authorId: guestUser.id, kind: "question", status: "pending", guestName: "Cũ", guestIpHash: hashOf(dayIp), createdAt: new Date(Date.now() - 2 * 3600_000), mark: mk("OLDGUEST") });
      const nBefore = await prisma.thread.count();
      const dayRes = await guestPost(gq(), dayIp);
      check("hạn 10/NGÀY: 10 câu hỏi cách đây 2 giờ → 429 dù cửa sổ giờ trống; không ghi thêm", dayRes.status === 429 && (await prisma.thread.count()) === nBefore, { status: dayRes.status });
      const hourIp = nextIp();
      for (let i = 0; i < 3; i++) await mkThread({ authorId: guestUser.id, kind: "question", status: "pending", guestName: "Cũ", guestIpHash: hashOf(hourIp), createdAt: new Date(Date.now() - 2 * 3600_000), mark: mk("OLDGUEST2") });
      check("3 câu hỏi cũ hơn 1 giờ KHÔNG chặn (cửa sổ giờ trượt)", (await guestPost(gq(), hourIp)).status === 201);
    }
    check("mọi hàng của khách đều pending hoặc đã quyết định qua kiểm duyệt (không có hàng 'published' do khách tự đặt)", (await prisma.thread.count({ where: { guestName: { not: null }, status: "published", reviewedById: null } })) === 0);
  }

  // ═════════════════════════════════════════ 8. Trả lời lồng ═════════════════════════════════════════
  section("8. Trả lời lồng đúng 1 cấp");
  {
    const owner = await mkUser({ name: "Chủ Bài Lồng" });
    const t = await mkThread({ authorId: owner.id, mark: mk("NEST") });
    const rep = (u: TUser, body: Record<string, unknown>) => post(u, tPath(t.id, "/reply"), body);
    const root = await rep(sA, { content: `Gốc ${mk("R1")}` });
    check("trả lời gốc → 201, ReplyNode, tác giả rút gọn, isOwn", root.status === 201 && root.json?.children?.length === 0 && root.json?.isOwn === true && root.json?.author?.label === "An N.", root.json);
    const c1 = await rep(sB, { content: `Con 1 ${mk("C1")}`, parentReplyId: root.json.id });
    const c2 = await rep(sD, { content: `Con của con ${mk("C2")}`, parentReplyId: c1.json?.id });
    const c3 = await rep(tOwner, { content: `Con của con của con ${mk("C3")}`, parentReplyId: c2.json?.id });
    check("trả lời con / con của con / con của con của con → 201", [c1, c2, c3].every(r => r.status === 201), [c1, c2, c3].map(r => r.status));
    const rows = await prisma.threadReply.findMany({ where: { threadId: t.id } });
    check("DB: MỌI trả lời con đều gắn thẳng vào GỐC (parentReplyId = id gốc)", rows.filter(r => r.id !== root.json.id).every(r => r.parentReplyId === root.json.id) && rows.length === 4, rows.map(r => [r.id.slice(-4), r.parentReplyId?.slice(-4)]));
    const det = await api("GET", tPath(t.id));
    check("GET: 1 gốc, 3 con, không con nào có con, độ sâu 2", det.json?.replies?.length === 1 && det.json.replies[0].children.length === 3 && det.json.replies[0].children.every((c: any) => c.children.length === 0) && maxDepth(det.json.replies) === 2, det.json?.replies);
    const times = det.json.replies[0].children.map((c: any) => c.createdAt);
    check("các con xếp cũ → mới", [...times].sort().join() === times.join());
    // Dữ liệu cũ 3 cấp (đã dựng ở thế giới thử): cây vẫn 1 cấp.
    const old = await api("GET", tPath(tCommon.id));
    check("dữ liệu có sẵn 3 cấp (mã cũ): cây trả về vẫn chỉ 1 cấp và không mất trả lời nào", maxDepth(old.json?.replies ?? []) <= 2 && JSON.stringify(old.json?.replies).includes(rT3.mark) && JSON.stringify(old.json?.replies).includes(rT2.mark), maxDepth(old.json?.replies ?? []));

    const delParent = await mkReply(t.id, sB.id, { deleted: true });
    const before = await counts();
    const other = await rep(sA, { content: "cha ở bài khác", parentReplyId: rT1.id });
    check("parentReplyId của BÀI KHÁC → 400 parent_invalid", other.status === 400 && other.json?.code === "parent_invalid", { status: other.status, body: other.json });
    check("parentReplyId của trả lời ĐÃ XOÁ → 400 parent_invalid", (await rep(sA, { content: "x", parentReplyId: delParent.id })).json?.code === "parent_invalid");
    check("parentReplyId không tồn tại → 400", (await rep(sA, { content: "x", parentReplyId: GHOST_REPLY })).status === 400);
    check("parentReplyId rỗng / số / object → 400", (await rep(sA, { content: "x", parentReplyId: "" })).status === 400 && (await rep(sA, { content: "x", parentReplyId: 123 })).status === 400 && (await rep(sA, { content: "x", parentReplyId: {} })).status === 400);
    check("các ca cha sai: không tạo hàng (chỉ có hàng ta chủ động dựng)", (await counts()).replies === before.replies);
    check("parentReplyId null → trả lời gốc", (await rep(sA, { content: "gốc thứ hai", parentReplyId: null })).status === 201);

    // Kiểm tra nội dung
    const vr = await mkUser({ name: "Người Kiểm Tra" });
    const vt = (b: Record<string, unknown>) => post(vr, tPath(t.id, "/reply"), b);
    check("nội dung rỗng / toàn khoảng trắng / thiếu → 400 content_empty", (await vt({ content: "" })).json?.code === "content_empty" && (await vt({ content: "  \n  " })).json?.code === "content_empty" && (await vt({})).json?.code === "content_empty" && (await post(vr, tPath(t.id, "/reply"))).status === 400);
    check("1001 ký tự → 400 content_too_long", (await vt({ content: "x".repeat(1001) })).json?.code === "content_too_long");
    check("3 ảnh → 400 too_many_images; imageUrls không phải mảng → 400", (await vt({ content: "ok", imageUrls: ["a", "b", "c"] })).json?.code === "too_many_images" && (await vt({ content: "ok", imageUrls: "a" })).status === 400);
    check("đúng 1000 ký tự → 201; chứa <script> được lưu nguyên", (await vt({ content: "x".repeat(1000) })).status === 201 && (await vt({ content: "<script>alert(1)</script>" })).json?.content === "<script>alert(1)</script>");
    check("ký tự điều khiển bị bỏ", (await vt({ content: "a\u0007b" })).json?.content === "ab");

    // Xoá cha → con còn.
    const delRes = await api("DELETE", `/api/community/replies/${root.json.id}`, { as: sA });
    check("chủ trả lời xoá gốc → 200", delRes.status === 200, { status: delRes.status });
    const det2 = await api("GET", tPath(t.id));
    const gone = det2.json?.replies?.find((x: any) => x.id === root.json.id);
    check("sau xoá gốc: nút gốc deleted:true, rỗng; 3 con vẫn còn nguyên nội dung", gone?.deleted === true && gone.content === "" && gone.children.length === 3 && gone.children.every((c: any) => c.content.length > 0 && c.deleted === false), gone);
    check("xoá lần hai → 404; người khác xoá → 403", (await api("DELETE", `/api/community/replies/${root.json.id}`, { as: sA })).status === 404 && (await api("DELETE", `/api/community/replies/${c1.json.id}`, { as: sA })).status === 403);
    check("xoá một con → con đó biến mất khỏi cây, các con khác còn", (await api("DELETE", `/api/community/replies/${c1.json.id}`, { as: sB })).status === 200 && (await api("GET", tPath(t.id))).json.replies.find((x: any) => x.id === root.json.id)?.children.length === 2);
    check("không thể trả lời vào trả lời đã xoá (404/400)", [400, 404].includes((await rep(sA, { content: "x", parentReplyId: c1.json.id })).status));

    // Xoá cứng bài: cascade, không hàng mồ côi.
    const hard = await mkThread({ authorId: sA.id, mark: mk("HARD") });
    const h1 = await mkReply(hard.id, sB.id), h2 = await mkReply(hard.id, sC.id, { parent: h1.id });
    await prisma.threadLike.create({ data: { userId: sB.id, threadId: hard.id } });
    await prisma.threadBookmark.create({ data: { userId: sB.id, threadId: hard.id } });
    await prisma.threadReport.create({ data: { threadId: hard.id, reporterId: sB.id, reason: "x" } });
    await prisma.replyLike.create({ data: { userId: sA.id, replyId: h2.id } });
    await prisma.thread.delete({ where: { id: hard.id } });
    const orphan = {
      replies: await prisma.threadReply.count({ where: { id: { in: [h1.id, h2.id] } } }), likes: await prisma.threadLike.count({ where: { threadId: hard.id } }),
      bm: await prisma.threadBookmark.count({ where: { threadId: hard.id } }), rep: await prisma.threadReport.count({ where: { threadId: hard.id } }), rl: await prisma.replyLike.count({ where: { replyId: { in: [h1.id, h2.id] } } }),
    };
    check("xoá cứng bài → cascade: không còn hàng mồ côi (trả lời lồng, thích, lưu, báo cáo, thích trả lời)", Object.values(orphan).every(n => n === 0), orphan);
    const casc = await mkThread({ authorId: sA.id, mark: mk("CASC") });
    const k1 = await mkReply(casc.id, sB.id), k2 = await mkReply(casc.id, sC.id, { parent: k1.id });
    await prisma.threadReply.delete({ where: { id: k1.id } });
    check("xoá cứng trả lời cha → con bị cascade theo (không mồ côi)", (await prisma.threadReply.count({ where: { id: k2.id } })) === 0);
  }

  // ═════════════════════════════════════════ 9. Song song & giới hạn ═════════════════════════════════════════
  section("9. Song song (thích / lưu / báo cáo) và giới hạn tần suất");
  {
    const owner = await mkUser({ name: "Chủ Bài Song Song" });
    const t = await mkThread({ authorId: owner.id, mark: mk("PAR") });
    const rr = await mkReply(t.id, owner.id);
    const racer = await mkUser({ name: "Người Bấm Nhanh" });
    const ten = <T>(f: () => Promise<T>) => Promise.all(Array.from({ length: 10 }, f));

    const likes = await ten(() => post(racer, tPath(t.id, "/like")));
    const lRows = await prisma.threadLike.count({ where: { userId: racer.id, threadId: t.id } });
    check("10 thích song song cùng người cùng bài → toàn 200, không 500", likes.every(r => r.status === 200), likes.map(r => r.status));
    check("…trạng thái cuối nhất quán: 0 hoặc 1 hàng; mọi likeCount trả về ∈ {0,1}", (lRows === 0 || lRows === 1) && likes.every(r => r.json?.likeCount === 0 || r.json?.likeCount === 1), { lRows, counts: likes.map(r => r.json?.likeCount) });
    const lastLiked = (await api("GET", tPath(t.id), { as: racer })).json?.likedByMe;
    check("…và chi tiết khớp với số hàng", lastLiked === (lRows === 1));
    const bms = await ten(() => post(racer, tPath(t.id, "/bookmark")));
    const bRows = await prisma.threadBookmark.count({ where: { userId: racer.id, threadId: t.id } });
    check("10 lưu song song → toàn 200, 0 hoặc 1 hàng", bms.every(r => r.status === 200) && (bRows === 0 || bRows === 1), { codes: bms.map(r => r.status), bRows });
    const rls = await ten(() => post(racer, `/api/community/replies/${rr.id}/like`));
    const rlRows = await prisma.replyLike.count({ where: { userId: racer.id, replyId: rr.id } });
    check("10 thích TRẢ LỜI song song → toàn 200, 0 hoặc 1 hàng", rls.every(r => r.status === 200) && (rlRows === 0 || rlRows === 1), { codes: rls.map(r => r.status), rlRows });
    const reps = await ten(() => post(racer, tPath(t.id, "/report"), { reason: "báo song song" }));
    check("10 báo cáo song song cùng người → đúng 1 × 200, 9 × 409, 1 hàng", reps.filter(r => r.status === 200).length === 1 && reps.filter(r => r.status === 409).length === 9 && (await prisma.threadReport.count({ where: { threadId: t.id, reporterId: racer.id } })) === 1, reps.map(r => r.status));
    check("báo cáo lần nữa (tuần tự) → 409 already_reported; tự báo cáo bài mình → 400 own_post; lý do rỗng → 400 reason_empty", (await post(racer, tPath(t.id, "/report"), { reason: "x" })).json?.code === "already_reported" && (await post(owner, tPath(t.id, "/report"), { reason: "x" })).json?.code === "own_post" && (await post(sC, tPath(t.id, "/report"), { reason: "   " })).json?.code === "reason_empty" && (await post(sC, tPath(t.id, "/report"))).json?.code === "reason_empty");
    const adminList = await api("GET", "/api/admin/thread-reports", { as: sup });
    check("báo cáo vào hàng chờ kiểm duyệt hiện có (/api/admin/thread-reports)", adminList.status === 200 && adminList.text.includes(t.mark), { status: adminList.status });

    // Nhiều người cùng thích.
    const crowd: TUser[] = []; for (let i = 0; i < 8; i++) crowd.push(await mkUser({ name: `Người Đông ${i}` }));
    const t2 = await mkThread({ authorId: owner.id, mark: mk("CROWD") });
    const cl = await Promise.all(crowd.map(u => post(u, tPath(t2.id, "/like"))));
    check("8 người thích song song → toàn 200, 8 hàng, likeCount cuối = 8", cl.every(r => r.status === 200) && (await prisma.threadLike.count({ where: { threadId: t2.id } })) === 8 && (await api("GET", tPath(t2.id))).json?.likeCount === 8, cl.map(r => r.status));
    const notifs = await prisma.notification.findMany({ where: { userId: owner.id, type: "thread_like", link: `/cong-dong/${t2.id}` } });
    const sum = notifs.reduce((s, n) => s + n.count, 0);
    if (sum !== 8) note(`THÔNG TIN (không tính đỏ): 8 lượt thích song song → thông báo gộp tổng count = ${sum} trên ${notifs.length} dòng (notifyLikeAggregate đọc-rồi-ghi không khoá, src/lib/notify.ts:61-75; mức thấp, chỉ lệch số đếm)`);
    check("8 lượt thích song song: có ít nhất một thông báo, không thông báo nào có count < 1", notifs.length >= 1 && notifs.every(n => n.count >= 1), notifs.map(n => n.count));

    // Giới hạn bài: 5/giờ/người, bấm đúp không lọt.
    const rl = await mkUser({ name: "Người Đăng Nhiều" });
    const bodyT = (i: number) => ({ content: `Bài số ${i} ${mk("RLT")}`, category: "goc-vui" });
    const rt = await Promise.all(Array.from({ length: 8 }, (_, i) => post(rl, "/api/community/threads", bodyT(i))));
    check("8 bài song song của một người → đúng 5 × 201 và 3 × 429 rate_limited", rt.filter(r => r.status === 201).length === 5 && rt.filter(r => r.status === 429 && r.json?.code === "rate_limited").length === 3, rt.map(r => r.status));
    check("…DB đúng 5 bài", (await prisma.thread.count({ where: { authorId: rl.id } })) === 5);
    check("…bài thứ 6 (tuần tự) → 429; người khác không bị ảnh hưởng", (await post(rl, "/api/community/threads", bodyT(9))).status === 429 && (await post(sB, "/api/community/threads", { content: `Bài của Bích ${mk("OK")}`, category: "goc-vui" })).status !== 429);
    // Giới hạn trả lời: 20/giờ.
    const rrU = await mkUser({ name: "Người Trả Lời Nhiều" });
    const sink = await mkThread({ authorId: owner.id, mark: mk("SINK") });
    const rp = await Promise.all(Array.from({ length: 25 }, (_, i) => post(rrU, tPath(sink.id, "/reply"), { content: `Trả lời ${i}` })));
    check("25 trả lời song song của một người → đúng 20 × 201 và 5 × 429", rp.filter(r => r.status === 201).length === 20 && rp.filter(r => r.status === 429).length === 5, rp.map(r => r.status).join());
    check("…DB đúng 20 trả lời; trả lời thứ 21 (tuần tự) → 429", (await prisma.threadReply.count({ where: { authorId: rrU.id, threadId: sink.id } })) === 20 && (await post(rrU, tPath(sink.id, "/reply"), { content: "thứ 21" })).status === 429);
    // Kiểm tra đầu vào của đăng bài.
    const vp = await mkUser({ name: "Người Kiểm Bài" });
    const P = (b: Record<string, unknown>) => post(vp, "/api/community/threads", b);
    check("đăng bài: nội dung rỗng → content_empty; 2001 ký tự → content_too_long; danh mục sai → category_invalid; kind sai → kind_invalid", (await P({ content: "", category: "goc-vui" })).json?.code === "content_empty" && (await P({ content: "x".repeat(2001), category: "goc-vui" })).json?.code === "content_too_long" && (await P({ content: "ok", category: "bậy" })).json?.code === "category_invalid" && (await P({ content: "ok", category: "goc-vui", kind: "poll" })).json?.code === "kind_invalid");
    check("đăng bài: 5 ảnh → too_many_images; câu hỏi thiếu tiêu đề → title_required; tiêu đề 121 → title_too_long", (await P({ content: "ok", category: "goc-vui", imageUrls: ["1", "2", "3", "4", "5"] })).json?.code === "too_many_images" && (await P({ content: "ok", kind: "question" })).json?.code === "title_required" && (await P({ content: "ok", kind: "question", title: "t".repeat(121) })).json?.code === "title_too_long");
    check("đăng bài: thân rỗng → 400 (không 500); courseId không phải chuỗi → 400", (await post(vp, "/api/community/threads")).status === 400 && (await P({ content: "ok", category: "goc-vui", courseId: 5 })).status === 400);
    const q = await P({ kind: "question", title: "Câu hỏi hợp lệ nè", content: "Nội dung câu hỏi", category: "goc-vui" });
    check("câu hỏi mới: 201, kind question, category ÉP về hoi-dap, tiêu đề đúng, href đúng", q.status === 201 && q.json?.kind === "question" && q.json?.category === "hoi-dap" && q.json?.title === "Câu hỏi hợp lệ nè" && q.json?.href === `/cong-dong/${q.json?.id}`, q.json);
    check("câu hỏi mới: không trừ xu (coinsEarned = 0) và UI không cần số xu", q.json?.coinsEarned === 0);
    check("câu hỏi mới ở trong feed khách, tab hoi-dap", feedIds(await feed(undefined, "tab=hoi-dap&limit=50")).includes(q.json?.id));
  }

  // ═════════════════════════════════════════ 10. Thông báo ═════════════════════════════════════════
  section("10. Thông báo: không tên, không tiền, không tiêu đề; đúng người nhận");
  {
    const nOwner = await mkUser({ name: "Chủ Thông Báo" });
    const nt = await mkThread({ authorId: nOwner.id, mark: mk("NOTIF") });
    const liker: TUser[] = []; for (let i = 0; i < 5; i++) liker.push(await mkUser({ name: `Người Thích ${i}` }));
    for (const u of liker) await post(u, tPath(nt.id, "/like"));
    const lk = await prisma.notification.findMany({ where: { userId: nOwner.id, type: "thread_like" } });
    check("5 lượt thích liên tiếp → MỘT dòng, count = 5, chữ gộp 'có 5 lượt thích mới'", lk.length === 1 && lk[0].count === 5 && lk[0].message === "Bài viết của bạn có 5 lượt thích mới" && lk[0].title === "Có lượt thích mới" && lk[0].link === `/cong-dong/${nt.id}`, lk);
    const nBefore = await prisma.notification.count({ where: { userId: nOwner.id } });
    await post(nOwner, tPath(nt.id, "/like")); await post(nOwner, tPath(nt.id, "/like"));
    await post(nOwner, tPath(nt.id, "/reply"), { content: "tự trả lời" });
    check("tự thích / tự bỏ thích / tự trả lời → KHÔNG tạo thông báo", (await prisma.notification.count({ where: { userId: nOwner.id } })) === nBefore && (await prisma.notification.findMany({ where: { userId: nOwner.id, type: "thread_like" } }))[0].count === 5);
    await post(liker[0], tPath(nt.id, "/like"));   // bỏ thích
    check("bỏ thích → không thêm thông báo, count không đổi", (await prisma.notification.findMany({ where: { userId: nOwner.id, type: "thread_like" } }))[0].count === 5);
    const rep = await post(liker[1], tPath(nt.id, "/reply"), { content: "bình luận của Người Thích 1" });
    const nr = await prisma.notification.findMany({ where: { userId: nOwner.id, type: "thread_reply" } });
    check("trả lời mới → chủ bài nhận 'Có trả lời mới' / 'Bài viết của bạn có thêm một trả lời', liên kết /cong-dong/<id>", nr.length === 1 && nr[0].title === "Có trả lời mới" && nr[0].message === "Bài viết của bạn có thêm một trả lời" && nr[0].link === `/cong-dong/${nt.id}`, nr);
    const child = await post(liker[2], tPath(nt.id, "/reply"), { content: "trả lời cho Người Thích 1", parentReplyId: rep.json.id });
    const nc = await prisma.notification.findMany({ where: { userId: liker[1].id, type: "thread_reply" } });
    check("trả lời con → chủ trả lời cha nhận 'Bình luận của bạn có thêm một trả lời', liên kết có #r-<id con>", nc.length === 1 && nc[0].message === "Bình luận của bạn có thêm một trả lời" && nc[0].link === `/cong-dong/${nt.id}#r-${child.json.id}`, nc);
    check("…chủ bài cũng nhận thông báo cho trả lời con (khác chủ cha)", (await prisma.notification.count({ where: { userId: nOwner.id, type: "thread_reply" } })) === 2);
    const selfChild = await post(liker[1], tPath(nt.id, "/reply"), { content: "tự trả lời bình luận của mình", parentReplyId: rep.json.id });
    check("tự trả lời bình luận của mình → không thông báo cho chính mình", selfChild.status === 201 && (await prisma.notification.count({ where: { userId: liker[1].id, type: "thread_reply" } })) === 1);
    const ownerChild = await post(nOwner, tPath(nt.id, "/reply"), { content: "chủ bài trả lời con", parentReplyId: rep.json.id });
    check("chủ bài trả lời con: chủ cha được báo, chủ bài (người gõ) không tự báo", ownerChild.status === 201 && (await prisma.notification.count({ where: { userId: liker[1].id, type: "thread_reply" } })) === 2 && (await prisma.notification.count({ where: { userId: nOwner.id, type: "thread_reply" } })) === 3);
    // Thích trả lời
    const rl = await post(liker[3], `/api/community/replies/${rep.json.id}/like`); await post(liker[4], `/api/community/replies/${rep.json.id}/like`);
    const nrl = await prisma.notification.findMany({ where: { userId: liker[1].id, type: "reply_like" } });
    check("thích trả lời → một dòng gộp, count = 2, chữ 'Trả lời của bạn có 2 lượt thích mới', liên kết #r-<id>", rl.status === 200 && nrl.length === 1 && nrl[0].count === 2 && nrl[0].message === "Trả lời của bạn có 2 lượt thích mới" && nrl[0].link === `/cong-dong/${nt.id}#r-${rep.json.id}`, nrl);
    check("tự thích trả lời của mình → không thông báo", await (async () => { const b = await prisma.notification.count({ where: { userId: liker[1].id } }); await post(liker[1], `/api/community/replies/${rep.json.id}/like`); return (await prisma.notification.count({ where: { userId: liker[1].id } })) === b; })());
    // Bài mới trong lớp
    const classPoster = sD;
    const nClassBefore = await prisma.notification.count({ where: { type: "thread_new_class" } });
    const cp = await post(classPoster, "/api/community/threads", { content: `Bài lớp ${mk("CP")}`, category: "goc-vui", courseId: C.id });
    check("học sinh đăng vào lớp → 201", cp.status === 201 && cp.json?.course?.id === C.id, { status: cp.status, body: cp.json });
    const nClass = await prisma.notification.findMany({ where: { type: "thread_new_class" } });
    check("'Có bài mới trong lớp' chỉ tới CHỦ LỚP (đúng 1 dòng mới), không tới người đăng / học sinh khác / GS khác", nClass.length === nClassBefore + 1 && nClass.some(n => n.userId === tOwner.id && n.title === "Có bài mới trong lớp" && n.message === "Lớp của bạn có bài mới" && n.link === `/cong-dong/${cp.json.id}`) && !nClass.some(n => [classPoster.id, sA.id, sC.id, tOther.id, sup.id].includes(n.userId)), nClass.map(n => [n.userId === tOwner.id ? "chủ lớp" : "khác", n.message]));
    const before2 = await prisma.notification.count({ where: { type: "thread_new_class" } });
    await post(tOwner, "/api/community/threads", { content: `Bài lớp của chính chủ lớp ${mk("CP2")}`, category: "goc-vui", courseId: C.id });
    check("chủ lớp tự đăng vào lớp mình → không tự báo", (await prisma.notification.count({ where: { type: "thread_new_class" } })) === before2);
    const common2 = await post(sD, "/api/community/threads", { content: `Bài chung ${mk("CP3")}`, category: "goc-vui" });
    check("bài CHUNG không tạo thông báo lớp", common2.status === 201 && (await prisma.notification.count({ where: { type: "thread_new_class" } })) === before2);
    // Hành động trên bài ẩn không tạo thông báo (đã kiểm hàng ở nhóm 4): đếm toàn bộ thông báo của tác giả bài ẩn
    check("hành động trên bài ẩn (nhóm 4) không để lại thông báo cho tác giả", (await prisma.notification.count({ where: { userId: sA.id, link: { in: HIDDEN.map(h => `/cong-dong/${h.t.id}`) } } })) === 0);

    // Quét toàn bộ thông báo đã sinh ra từ đầu bài.
    const all = await prisma.notification.findMany();
    const names = [...allUsers.map(u => u.name), "Chủ Thông Báo", ...liker.map(u => u.name), "Người Đông", "Người Bấm Nhanh", "Bạn Khách", "Khách Form", "Chủ Bài Lồng"];
    const threadMarks = (await prisma.thread.findMany({ select: { title: true, content: true } })).flatMap(t => [t.title, t.content].filter((x): x is string => !!x && x.length >= 6));
    const MONEY = /(?<![\p{L}])(?:xu|coin|vnd|đ|đồng)(?![\p{L}])/iu;
    const bad: unknown[] = [];
    for (const n of all) {
      const text = `${n.title} ${n.message}`;
      const likeKind = /like/.test(n.type);
      const linkOk = !n.link || /^\/(cong-dong|student\/hoi-dap|student\/cong-dong)\/(hoi-dap\/)?[A-Za-z0-9_-]+(#r-[A-Za-z0-9_-]+)?$/.test(n.link);
      if (MONEY.test(text) || (!likeKind && /\d/.test(text)) || (likeKind && /\d/.test(text) && !/có \d+ lượt thích mới$/.test(text)) || names.some(nm => text.includes(nm)) || threadMarks.some(m => text.includes(m)) || !linkOk) bad.push({ type: n.type, text, link: n.link });
    }
    check(`quét ${all.length} thông báo đã sinh: không tên người, không xu / Coin / đ / VND, không tiêu đề / nội dung bài, liên kết đúng dạng`, all.length >= 10 && bad.length === 0, bad.slice(0, 4));
    check("mọi thông báo của khu này thuộc đúng bộ chữ cho phép", all.filter(n => /^(thread_reply|thread_like|reply_like|reply_accepted|thread_new_class)$/.test(n.type)).every(n => ["Có trả lời mới", "Có lượt thích mới", "Trả lời được chọn", "Có bài mới trong lớp"].includes(n.title)));
    check("tài khoản 'khách' hệ thống không có thông báo nào", (await prisma.notification.count({ where: { userId: guestUser.id } })) === 0);
  }

  // ═════════════════════════════════════════ 11. Tương thích câu hỏi cũ ═════════════════════════════════════════
  section("11. Tương thích: câu hỏi cũ (bảng Question) và route cũ");
  {
    // 3A (quyết định của Thọ 04/11/2026): câu hỏi cũ chỉ có trong bảng tin của người ĐÃ ĐĂNG NHẬP; khách không thấy (mở nó luôn bị đưa sang đăng nhập).
    const fg = await feed(undefined, "tab=hoi-dap&limit=50");
    check("3A: KHÁCH không thấy câu hỏi cũ ở feed?tab=hoi-dap, tab=all, scope=common (không id, không key q:, không href /cong-dong/hoi-dap/)", ![fg, await feed(undefined, "limit=50"), await feed(undefined, "scope=common&limit=50")].some(r => r.text.includes(legacyQ.id) || r.text.includes('"q:') || r.text.includes("/cong-dong/hoi-dap/") || r.text.includes("Câu hỏi cũ")), fg.json?.items?.length);
    check("3A: …khách vẫn thấy câu hỏi mới (kind=question) ở tab hoi-dap", fg.status === 200 && fg.json?.items?.some((i: any) => i.source === "thread" && i.kind === "question") && fg.json.items.every((i: any) => i.source === "thread"), fg.json?.items?.map((i: any) => i.source));
    const f = await feed(sB, "tab=hoi-dap&limit=50");
    const item = f.json?.items?.find((i: any) => i.id === legacyQ.id);
    check("câu hỏi cũ có trong feed?tab=hoi-dap, source 'question', href /cong-dong/hoi-dap/<id>, key q:<id>", item?.source === "question" && item.href === `/cong-dong/hoi-dap/${legacyQ.id}` && item.key === `q:${legacyQ.id}` && item.kind === "question" && item.replyCount === 1, item);
    check("…và có trong tab 'all' nhưng KHÔNG ở tab kinh-nghiem", feedIds(await feed(sB, "limit=50")).includes(legacyQ.id) && !feedIds(await feed(sB, "tab=kinh-nghiem&limit=50")).includes(legacyQ.id));
    check("…tên tác giả cũ cũng rút gọn ('Bích T.')", item?.author?.label === "Bích T.");
    check("thích / lưu câu hỏi cũ bằng route mới → 404 (câu hỏi cũ không có bảng thích)", (await post(sB, tPath(legacyQ.id, "/like"))).status === 404);
    // Route cũ vẫn chạy.
    const oldList = await api("GET", "/api/questions", { as: sB });
    check("GET /api/questions (cũ) vẫn chạy và trả câu hỏi", oldList.status === 200 && oldList.json?.some((q: any) => q.id === legacyQ.id), { status: oldList.status });
    const oldOne = await api("GET", `/api/questions/${legacyQ.id}`, { as: sB });
    check("GET /api/questions/[id] vẫn chạy; tên tác giả rút gọn", oldOne.status === 200 && oldOne.json?.author?.name === "Bích T." && oldOne.json?.answers?.[0]?.author?.name === "An N.", oldOne.json?.author);
    check("GET /api/questions/[id] khách → 401 (không đổi)", (await api("GET", `/api/questions/${legacyQ.id}`)).status === 401);
    const oldPost = await post(sB, "/api/questions", { title: "Câu hỏi qua route cũ", content: "nội dung" });
    check("POST /api/questions (cũ) vẫn chạy: 201 (đủ xu) hoặc 402 (thiếu xu) — không 404 / 500", oldPost.status === 201 || oldPost.status === 402, { status: oldPost.status, body: oldPost.text.slice(0, 120) });
    const oldAns = await post(sC, `/api/questions/${legacyQ.id}/answers`, { content: "Câu trả lời mới qua route cũ" });
    check("POST /api/questions/[id]/answers (cũ) vẫn chạy → 201", oldAns.status === 201, { status: oldAns.status });
    const nAns = await prisma.notification.findMany({ where: { userId: sB.id, type: "answer_new" } });
    check("thông báo 'answer_new' cũ đúng chữ mới: không tên, không xu, không tiêu đề câu hỏi", nAns.length >= 1 && nAns.every(n => n.title === "Có câu trả lời mới" && n.message === "Câu hỏi của bạn có câu trả lời mới" && !n.message.includes(legacyQ.title)), nAns.map(n => n.message));
    const acc = await post(sB, `/api/answers/${legacyA.id}/accept`);
    check("POST /api/answers/[id]/accept (cũ) vẫn chạy (200) và còn trả Coin như cũ", acc.status === 200 && (await prisma.answer.findUnique({ where: { id: legacyA.id } }))?.rewardPaid !== null, { status: acc.status, body: acc.text.slice(0, 120) });
    const nAcc = await prisma.notification.findMany({ where: { userId: sA.id, type: "answer_accepted" } });
    check("thông báo 'answer_accepted' cũ KHÔNG còn chữ 'xu'", nAcc.length === 1 && nAcc[0].message === "Một câu trả lời của bạn được chấp nhận" && !/\bxu\b/i.test(nAcc[0].message + nAcc[0].title), nAcc.map(n => n.message));
    check("accept lần hai → 409; HS khác accept → 403", (await post(sB, `/api/answers/${legacyA.id}/accept`)).status === 409 && (await post(sC, `/api/answers/${legacyA.id}/accept`)).status === 403);
    check("câu hỏi cũ đã chấp nhận: feed answered = true", (await feed(sB, "tab=hoi-dap&limit=50")).json?.items?.find((i: any) => i.id === legacyQ.id)?.answered === true);
  }

  // ═════════════════════════════════════════ 12. Không nhắn riêng (tĩnh) ═════════════════════════════════════════
  section("12. Không có nhắn riêng giữa thành viên (kiểm tĩnh)");
  {
    const ROOT = process.cwd();
    const walk = (d: string, out: string[] = []) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) { if (n !== "generated" && n !== "node_modules") walk(p, out); } else out.push(p); } return out; };
    const schema = readFileSync(join(ROOT, "prisma/schema.prisma"), "utf8");
    const models = [...schema.matchAll(/^model\s+(\w+)/gm)].map(m => m[1]);
    const dmModels = models.filter(m => /Message|Conversation|DirectMessage|Inbox|Chat/i.test(m));
    check(`schema.prisma (${models.length} model) không có model nhắn tin / hội thoại / hộp thư / chat`, dmModels.length === 0, dmModels);
    const apiDirs = walk(join(ROOT, "src/app")).filter(p => /\/route\.ts$/.test(p)).map(p => relative(join(ROOT, "src/app"), p));
    const dmRoutes = apiDirs.filter(p => /(^|\/)(tin-nhan|messages?|dm|direct-messages?|inbox|chat|conversations?|nhan-tin)(\/|$)/i.test(p));
    check(`không có đường API tin-nhan / messages / dm / chat / inbox / conversations (quét ${apiDirs.length} route)`, dmRoutes.length === 0, dmRoutes);
    const pages = walk(join(ROOT, "src/app")).filter(p => /\/page\.tsx$/.test(p)).map(p => relative(join(ROOT, "src/app"), p));
    const dmPages = pages.filter(p => /(^|\/)(tin-nhan|messages?|dm|direct-messages?|nhan-tin|chat)(\/|$)/i.test(p) && /cong-dong|student/.test(p));
    check("không có trang nhắn tin trong cây cộng đồng / học sinh", dmPages.length === 0, dmPages);
    const communityRoutes = walk(join(ROOT, "src/app/api/community")).filter(p => /route\.ts$/.test(p));
    const recip = communityRoutes.filter(p => /recipientId|toUserId|receiverId|targetUserId|recipient_id|toUser\b/.test(readFileSync(p, "utf8")));
    check(`thân ${communityRoutes.length} route cộng đồng không nhận trường recipientId / toUserId / receiverId / targetUserId`, recip.length === 0, recip);
    const comp = walk(join(ROOT, "src/components/community")).concat(walk(join(ROOT, "src/app/(guest)/cong-dong")));
    const dmText = comp.filter(p => /\.tsx$/.test(p) && /Nhắn tin|Tin nhắn|Gửi tin nhắn|Nhắn riêng|Inbox/i.test(readFileSync(p, "utf8").split("\n").filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n")));
    check("giao diện cộng đồng không có chữ 'Nhắn tin' / 'Tin nhắn' ngoài chú thích", dmText.length === 0, dmText.map(p => relative(ROOT, p)));
    // Thử thật: gọi các đường nhắn riêng thường gặp phải là 404.
    for (const p of ["/api/community/messages", "/api/community/dm", "/api/community/tin-nhan", "/api/messages", "/api/dm", "/api/tin-nhan", "/api/community/conversations"]) {
      const r = await api("POST", p, { as: sB, body: { recipientId: sA.id, content: "xin chào" } });
      check(`POST ${p} → 404 (không tồn tại)`, r.status === 404 || r.status === 405, { status: r.status });
    }
    const body = await post(sB, tPath(tCommon.id, "/reply"), { content: "thử gửi riêng", recipientId: sA.id, toUserId: sA.id });
    const lastReply = await prisma.threadReply.findFirst({ where: { threadId: tCommon.id, authorId: sB.id }, orderBy: { createdAt: "desc" } });
    check("trường recipientId / toUserId gửi kèm bị bỏ qua: đây vẫn là trả lời CÔNG KHAI trong bài", body.status === 201 && lastReply?.threadId === tCommon.id && !JSON.stringify(body.json).includes("recipient"), { status: body.status });
    // Cờ tính năng tồn tại trong mã.
    const gqSrc = readFileSync(join(ROOT, "src/app/api/community/guest-questions/route.ts"), "utf8");
    check("guest-questions đọc cờ KIN_GUEST_QUESTIONS ở máy chủ và trả 503 guest_questions_closed", /KIN_GUEST_QUESTIONS/.test(gqSrc) && /guest_questions_closed/.test(gqSrc));
    const formSrc = readFileSync(join(ROOT, "src/components/community/GuestQuestionForm.tsx"), "utf8");
    check("form khách có ô bẫy `website` ẩn khỏi người dùng", /name="website"/.test(formSrc) && /(aria-hidden|tabIndex=\{-1\}|display:\s*"?none|sr-only|hidden)/.test(formSrc));
  }

  // ═════════════════════════════════════════ 13. Phân trang ═════════════════════════════════════════
  section("13. Phân trang: 45 bài + 8 câu hỏi cũ + 6 câu hỏi mới = 59, không lặp, không thiếu");
  await wipe();
  {
    const gu = await prisma.user.create({ data: { name: "Khách", email: GUEST_EMAIL, password: "x", role: "student", banned: true } });
    const pa = await mkUser({ name: "Người Phân Trang A" }), pb = await mkUser({ name: "Người Phân Trang B" });
    const pt = await mkTutor("Cô Phân Trang");
    const pc = await mkCourse(pt.id, { name: `Lớp Phân Trang ${stamp}` });
    await prisma.enrollment.create({ data: { userId: pa.id, courseId: pc.id, status: "active" } });
    const base = Date.now() - 2 * 86_400_000;
    const at = (i: number) => new Date(base + i * 60_000);
    const expectKeys: string[] = [];
    const TIE = new Date(base + 30 * 60_000 + 7);           // 4 bài + 1 câu hỏi cũ cùng MỘT mili-giây
    for (let i = 0; i < 41; i++) { const t = await mkThread({ authorId: i % 2 ? pa.id : pt.id, createdAt: at(i), mark: mk("PG") }); expectKeys.push(`t:${t.id}`); }
    for (let i = 0; i < 4; i++) { const t = await mkThread({ authorId: pa.id, createdAt: TIE, mark: mk("PGTIE") }); expectKeys.push(`t:${t.id}`); }
    for (let i = 0; i < 6; i++) { const t = await mkThread({ authorId: pa.id, kind: "question", createdAt: at(100 + i), mark: mk("PGQ") }); expectKeys.push(`t:${t.id}`); }
    for (let i = 0; i < 8; i++) { const q = await prisma.question.create({ data: { authorId: pb.id, title: `Câu hỏi cũ ${i}`, content: "cũ", bountyPaid: 0, createdAt: i === 0 ? TIE : at(200 + i) } }); expectKeys.push(`q:${q.id}`); }
    // Không được tính:
    const pin1 = await mkThread({ authorId: pt.id, pinned: true, createdAt: at(300), mark: mk("PGPIN") }), pin2 = await mkThread({ authorId: pt.id, pinned: true, createdAt: at(1), mark: mk("PGPIN2") });
    const hidden = [await mkThread({ authorId: pa.id, deleted: true, createdAt: at(50), mark: mk("PGDEL") }), await mkThread({ authorId: gu.id, status: "pending", guestName: "K", createdAt: at(51), mark: mk("PGPEND") }), await mkThread({ authorId: gu.id, status: "rejected", guestName: "K", createdAt: at(52), mark: mk("PGREJ") })];
    const classT = await mkThread({ authorId: pa.id, courseId: pc.id, createdAt: at(53), mark: mk("PGCLASS") });
    check("dựng đủ 59 mục", expectKeys.length === 59, expectKeys.length);

    async function walkAll(as: TUser | undefined, query: string, limit: number) {
      const keys: string[] = []; const pages: R[] = []; let cursor: string | null = null; let guard = 0;
      do {
        const r: R = await feed(as, `${query}${query ? "&" : ""}limit=${limit}${cursor ? `&cursor=${cursor}` : ""}`);
        pages.push(r);
        if (r.status !== 200) break;
        for (const it of r.json.items) keys.push(it.key);
        cursor = r.json.nextCursor; guard++;
      } while (cursor && guard < 100);
      return { keys, pages };
    }
    // 3A: câu hỏi cũ chỉ có với người đã đăng nhập ⇒ phép duyệt trộn bài + câu hỏi cũ (đồng mili-giây, con trỏ) chạy với `pb` (học sinh ĐÃ ĐĂNG NHẬP, KHÔNG thuộc lớp `pc`); khách duyệt ở cuối mục.
    const w10 = await walkAll(pb, "", 10);
    check("thành viên ngoài lớp duyệt limit=10 → đúng 59 mục", w10.keys.length === 59, w10.keys.length);
    check("…không lặp", new Set(w10.keys).size === w10.keys.length);
    check("…không thiếu, không thừa (đúng tập 59 khoá)", expectKeys.every(k => w10.keys.includes(k)) && w10.keys.every(k => expectKeys.includes(k)));
    check("…6 trang (5 × 10 + 9), mọi trang trừ cuối có nextCursor; trang cuối nextCursor null", w10.pages.length === 6 && w10.pages.slice(0, 5).every(p => p.json.items.length === 10 && !!p.json.nextCursor) && w10.pages[5].json.items.length === 9 && w10.pages[5].json.nextCursor === null, w10.pages.map(p => p.json?.items?.length));
    const items = w10.pages.flatMap(p => p.json.items as any[]);
    const sorted = items.every((it, i) => i === 0 || Date.parse(items[i - 1].createdAt) > Date.parse(it.createdAt) || (Date.parse(items[i - 1].createdAt) === Date.parse(it.createdAt) && (items[i - 1].source === "thread" && it.source === "question" || (items[i - 1].source === it.source && items[i - 1].id > it.id))));
    check("…thứ tự: mới nhất trước; cùng mili-giây thì thread trước câu hỏi cũ, rồi id giảm dần", sorted, items.slice(28, 38).map(i => [i.createdAt.slice(-8), i.source]));
    const tieAt = items.filter(i => Date.parse(i.createdAt) === TIE.getTime());
    check("…5 mục cùng mili-giây đều có mặt đúng 1 lần (4 bài + 1 câu hỏi cũ)", tieAt.length === 5 && tieAt.filter(i => i.source === "question").length === 1);
    for (const lim of [1, 3, 7, 25, 50]) {
      const w = await walkAll(pb, "", lim);
      check(`limit=${lim}: 59 mục, không lặp, đúng tập`, w.keys.length === 59 && new Set(w.keys).size === 59 && w.keys.every(k => expectKeys.includes(k)), { got: w.keys.length, uniq: new Set(w.keys).size });
    }
    check("limit=59 > trần 50 → 400 limit_invalid (trần là 50 theo đặc tả, không kẹp)", (await feed(undefined, "limit=59")).status === 400);
    check("bài ghim: chỉ ở `pinned` của trang ĐẦU (2 bài), không ở `items`, không ở trang sau", w10.pages[0].json.pinned.length === 2 && w10.pages.slice(1).every(p => p.json.pinned.length === 0) && ![pin1.id, pin2.id].some(id => items.some(i => i.id === id)), w10.pages.map(p => p.json.pinned.length));
    check("bài xoá / chờ duyệt / bị từ chối / bài lớp không có trong phân trang của khách", hidden.concat([classT]).every(h => !w10.pages.some(p => p.text.includes(h.mark) || p.text.includes(h.id))));
    const wm = await walkAll(pa, "", 10);
    check("thành viên lớp duyệt hết → 60 mục (thêm bài lớp), không lặp", wm.keys.length === 60 && new Set(wm.keys).size === 60 && wm.keys.includes(`t:${classT.id}`), wm.keys.length);
    // Tab và scope
    const wq = await walkAll(pb, "tab=hoi-dap", 4);
    check("tab=hoi-dap: 6 câu hỏi mới + 8 câu hỏi cũ = 14, không lặp", wq.keys.length === 14 && new Set(wq.keys).size === 14, wq.keys.length);
    const wa = await walkAll(pb, "tab=hoi-dap-qa", 50);
    check("tab=hoi-dap-qa là bí danh của hoi-dap (cùng 14 mục)", wa.keys.length === 14 && wa.keys.join() === (await walkAll(pb, "tab=hoi-dap", 50)).keys.join());
    const wk = await walkAll(pb, "tab=kinh-nghiem", 10);
    check("tab=kinh-nghiem: chỉ bài viết thường (45), không câu hỏi", wk.keys.length === 45 && wk.keys.every(k => k.startsWith("t:")), wk.keys.length);
    const wc = await walkAll(pb, "scope=common", 10);
    check("scope=common: 59, không lặp", wc.keys.length === 59 && new Set(wc.keys).size === 59);
    // Khách duyệt cùng dữ liệu: KHÔNG có 8 câu hỏi cũ ⇒ 51 mục (45 bài thường + 6 câu hỏi mới), không có khoá q:…, phân trang vẫn đúng.
    const gAll = await walkAll(undefined, "", 10);
    check("3A: khách duyệt limit=10 → 51 mục (59 - 8 câu hỏi cũ), không lặp, không có khoá q:", gAll.keys.length === 51 && new Set(gAll.keys).size === 51 && gAll.keys.every(k => k.startsWith("t:")) && gAll.keys.every(k => expectKeys.includes(k)), { n: gAll.keys.length, q: gAll.keys.filter(k => k.startsWith("q:")).length });
    check("3A: …6 trang (5 × 10 + 1), trang cuối nextCursor null", gAll.pages.length === 6 && gAll.pages.slice(0, 5).every(p => p.json.items.length === 10 && !!p.json.nextCursor) && gAll.pages[5].json.items.length === 1 && gAll.pages[5].json.nextCursor === null, gAll.pages.map(p => p.json.items.length));
    const gQ = await walkAll(undefined, "tab=hoi-dap", 4);
    check("3A: khách tab=hoi-dap → chỉ 6 câu hỏi mới (không câu hỏi cũ)", gQ.keys.length === 6 && gQ.keys.every(k => k.startsWith("t:")), gQ.keys.length);
    const gC = await walkAll(undefined, "scope=common", 10);
    check("3A: khách scope=common → 51", gC.keys.length === 51 && new Set(gC.keys).size === 51, gC.keys.length);
    const wl = await walkAll(pa, `scope=${pc.id}`, 10);
    check("scope=<lớp> của thành viên: chỉ bài lớp (1), không câu hỏi cũ", wl.keys.length === 1 && wl.keys[0] === `t:${classT.id}`, wl.keys);

    // Con trỏ bị lạm dụng
    const own = await feed(pa, "limit=10");
    const swap = await feed(pb, `limit=10&cursor=${own.json.nextCursor}`);
    check("con trỏ của người A đưa cho người B: vẫn 200, không thêm quyền xem (không có bài lớp)", swap.status === 200 && !swap.text.includes(classT.mark) && !swap.text.includes(classT.id));
    const swapScope = await feed(pb, `scope=${pc.id}&limit=10&cursor=${own.json.nextCursor}`);
    check("…và dùng con trỏ đó kèm scope=<lớp> vẫn 403 cho người ngoài lớp", swapScope.status === 403);
    check("…khách dùng con trỏ của thành viên: không bài lớp", !(await feed(undefined, `limit=50&cursor=${own.json.nextCursor}`)).text.includes(classT.mark));
    for (const [label, q] of [["limit=0", "limit=0"], ["limit=-1", "limit=-1"], ["limit=999", "limit=999"], ["limit=51", "limit=51"], ["limit=abc", "limit=abc"], ["limit=1.5", "limit=1.5"], ["limit=1e1", "limit=1e1"], ["limit=%20", "limit=%20"]] as const) {
      const r = await feed(undefined, q);
      check(`${label} → 400 limit_invalid`, r.status === 400 && r.json?.code === "limit_invalid", { status: r.status, body: r.text.slice(0, 80) });
    }
    check("limit=1 và limit=50 → 200", (await feed(undefined, "limit=1")).status === 200 && (await feed(undefined, "limit=50")).status === 200);
    check("không limit → mặc định 20", (await feed(undefined)).json?.items?.length === 20);
    const goodCursor = w10.pages[0].json.nextCursor as string;
    const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64url");
    for (const [label, c] of [["rác", "!!!"], ["base64 nhưng không có |", b64("khong-co-gach")], ["ngày sai", b64("2026-13-45T25:61:61.000Z|t:abc")], ["khoá sai nguồn", b64("2026-11-01T10:00:00.000Z|x:abc")], ["id có ký tự lạ", b64("2026-11-01T10:00:00.000Z|t:a'b")], ["dài 5000 ký tự", "A".repeat(5000)], ["chỉ gạch đứng", b64("|")], ["ngày không mili-giây", b64("2026-11-01T10:00:00Z|t:abc")], ["cursor là mảng", "a%5B%5D"]] as const) {
      const r = await feed(undefined, `cursor=${c}`);
      check(`cursor ${label} → 400 cursor_invalid`, r.status === 400 && r.json?.code === "cursor_invalid", { status: r.status, body: r.text.slice(0, 80) });
    }
    check("cursor hợp lệ → 200", (await feed(undefined, `cursor=${goodCursor}`)).status === 200);
    check("tab lạ → 400 tab_invalid", (await feed(undefined, "tab=khong-co")).json?.code === "tab_invalid");
    check("scope lạ kiểu SQL / dấu nháy → 403 (không 500)", [(await feed(undefined, "scope=%27%20OR%201%3D1")).status, (await feed(pa, "scope=%27%3B%20DROP%20TABLE%20threads%3B--")).status].every(s => s === 403));
    for (const p of ["/api/community/bookmarks?limit=0", "/api/community/bookmarks?cursor=xyz", `/api/community/profiles/${pt.id}?limit=999`, `/api/community/profiles/${pt.id}?cursor=%21%21`]) {
      const r = await api("GET", p, { as: pa });
      check(`GET ${p} → 400`, r.status === 400, { status: r.status });
    }

    // Đã lưu: 12 bài, phân trang theo thời điểm LƯU.
    const saved: string[] = [];
    for (let i = 0; i < 12; i++) { const t = await mkThread({ authorId: pt.id, createdAt: at(400 + i), mark: mk("PGBM") }); saved.push(t.id); await prisma.threadBookmark.create({ data: { userId: pb.id, threadId: t.id, createdAt: new Date(base + 5_000_000 + i * 1000) } }); }
    await prisma.threadBookmark.create({ data: { userId: pb.id, threadId: classT.id } });                        // bài lớp mà pb KHÔNG phải thành viên
    await prisma.threadBookmark.create({ data: { userId: pb.id, threadId: hidden[0].id } });                    // bài xoá
    const got: string[] = []; const sizes: number[] = []; let cur: string | null = null;
    do {
      const r: R = await api("GET", `/api/community/bookmarks?limit=5${cur ? `&cursor=${cur}` : ""}`, { as: pb });
      if (r.status !== 200) { check("bookmarks phân trang 200", false, r.text.slice(0, 100)); break; }
      sizes.push(r.json.items.length); got.push(...r.json.items.map((i: any) => i.id)); cur = r.json.nextCursor;
    } while (cur && sizes.length < 10);
    check("Đã lưu limit=5: 5 + 5 + 2 = 12 bài, không lặp, đúng tập, mới lưu trước; không lộ bài lớp / bài xoá", sizes.join() === "5,5,2" && new Set(got).size === 12 && saved.every(id => got.includes(id)) && got[0] === saved[11] && !got.includes(classT.id) && !got.includes(hidden[0].id), { sizes, first: got[0] === saved[11] });
    check("Đã lưu: mọi mục bookmarkedByMe = true", (await api("GET", "/api/community/bookmarks?limit=50", { as: pb })).json.items.every((i: any) => i.bookmarkedByMe === true));
    // Hồ sơ: 7 bài.
    const prof: string[] = []; const psz: number[] = []; let pcur: string | null = null;
    do {
      const r: R = await api("GET", `/api/community/profiles/${pt.id}?limit=3${pcur ? `&cursor=${pcur}` : ""}`);
      if (r.status !== 200) { check("profiles phân trang 200", false, r.text.slice(0, 100)); break; }
      psz.push(r.json.items.length); prof.push(...r.json.items.map((i: any) => i.id)); pcur = r.json.nextCursor;
    } while (pcur && psz.length < 20);
    const tutorPosts = await prisma.thread.count({ where: { authorId: pt.id, courseId: null, deletedAt: null, status: "published" } });
    check(`hồ sơ gia sư limit=3: duyệt hết ${tutorPosts} bài, không lặp, không có bài lớp / ẩn; postCount khớp`, prof.length === tutorPosts && new Set(prof).size === prof.length && (await api("GET", `/api/community/profiles/${pt.id}`)).json?.profile?.postCount === tutorPosts && !prof.includes(classT.id), { psz, tutorPosts });
    check("ô lưới hồ sơ: có imageUrl / excerpt, href /cong-dong/<id>, không tên", (await api("GET", `/api/community/profiles/${pt.id}`)).json.items.every((g: any) => g.href === `/cong-dong/${g.id}` && (g.imageUrl || g.excerpt)));
  }

  await prisma.$disconnect();
  await done();
})().catch(async e => { console.error("CRASH", e); await prisma.$disconnect?.(); process.exit(1); });
