// BU-05 — phần THUẦN của cộng đồng (src/lib/communityFeed.ts + communityRules.ts): không DB, không mạng.
// Ca phá cố ý (đổi một dòng rồi chạy lại phải đỏ):
//  • communityFeed.sourceCursorWhere: đổi `{ createdAt: { lt: cursor.at } }` (nhánh r < rc) thành `lte` → ca "cùng mili-giây: không lặp" đỏ.
//  • communityFeed.compareFeed: bỏ nhánh so `source` → ca "t trước q" và phân trang 4 bài cùng createdAt đỏ.
//  • communityRules.publicName: bỏ `isStaffWithIdentity` (luôn rút gọn) → ca "gia sư/quản trị giữ nguyên" đỏ; luôn trả full name → ca "Bích T." đỏ.
//  • communityRules.normalizeParent: bỏ nhánh `parent.parentReplyId` → ca "cha là con → gốc" đỏ.
import {
  encodeCursor, decodeCursor, sourceCursorWhere, mergeFeedPages, compareFeed, buildReplyTree, excerptOf,
  threadToFeedItem, legacyQuestionToFeedItem, type FlatReply, type FeedCursor,
} from "@/lib/communityFeed";
import {
  publicName, shortName, authorTag, normalizeParent, hasPhoneOrLink, declaredAgeUnder13, validateGuestQuestion,
  notificationText, isCleanNotificationText, ALL_NOTIF_KINDS, cleanText,
} from "@/lib/communityRules";
import type { FeedAuthor, FeedItem } from "@/lib/communityTypes";
import { check, section, done } from "./h";

const T0 = Date.parse("2026-11-01T10:00:00.000Z");
const iso = (ms: number) => new Date(ms).toISOString();
const author: FeedAuthor = { id: "u1", label: "An N.", tag: null, href: null };
type Row = { source: "thread" | "question"; id: string; createdAt: string };
const row = (source: "thread" | "question", id: string, ms: number): Row => ({ source, id, createdAt: iso(ms) });

section("Con trỏ: đi-về và đầu vào xấu");
const c = encodeCursor({ createdAt: iso(T0), source: "question", id: "abc_DEF-1" });
const d = decodeCursor(c);
check("đi-về giữ nguyên at / nguồn / id", !!d && d.at.getTime() === T0 && d.source === "question" && d.id === "abc_DEF-1", d);
check("con trỏ là base64url (không +/=)", /^[A-Za-z0-9_-]+$/.test(c));
const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const bad: [string, string | null | undefined][] = [
  ["null", null], ["undefined", undefined], ["rỗng", ""], ["rác có ký tự lạ", "!!!@@@"], ["base64 hỏng", "%%%"],
  ["thiếu |", b64(`${iso(T0)} t:abc`)], ["ngày sai", b64("2026-13-45T99:00:00.000Z|t:abc")],
  ["ngày không đủ mili-giây", b64("2026-11-01T10:00:00Z|t:abc")], ["khoá sai nguồn", b64(`${iso(T0)}|x:abc`)],
  ["khoá có ký tự lạ", b64(`${iso(T0)}|t:a b'--`)], ["dài 5000", "A".repeat(5000)], ["id rỗng", b64(`${iso(T0)}|t:`)],
];
for (const [name, v] of bad) check(`từ chối: ${name}`, decodeCursor(v) === null);

section("sourceCursorWhere");
const cursorQ: FeedCursor = { at: new Date(T0), source: "question", id: "q5" };
check("không có con trỏ → rỗng", Object.keys(sourceCursorWhere(null, "thread")).length === 0);
check("con trỏ ở bài q, nguồn thread: chỉ createdAt < at (t cùng mili-giây đã đi qua)", JSON.stringify(sourceCursorWhere(cursorQ, "thread")) === JSON.stringify({ createdAt: { lt: new Date(T0) } }));
check("con trỏ ở bài q, nguồn question: lt hoặc (cùng at và id < q5)", JSON.stringify(sourceCursorWhere(cursorQ, "question")).includes('"id":{"lt":"q5"}'));
const cursorT: FeedCursor = { at: new Date(T0), source: "thread", id: "t5" };
check("con trỏ ở bài t, nguồn question: createdAt <= at (q cùng mili-giây chưa đi qua)", JSON.stringify(sourceCursorWhere(cursorT, "question")) === JSON.stringify({ createdAt: { lte: new Date(T0) } }));

section("mergeFeedPages: thứ tự và ổn định");
const m1 = mergeFeedPages([[row("thread", "t1", T0), row("thread", "t2", T0 - 3000)], [row("question", "q1", T0 - 1000), row("question", "q2", T0 - 5000)]], 10);
check("xen kẽ đúng createdAt giảm dần", m1.items.map(i => i.id).join() === "t1,q1,t2,q2", m1.items.map(i => i.id));
check("hết danh sách → nextCursor null", m1.nextCursor === null);
const same = mergeFeedPages([[row("thread", "tB", T0), row("thread", "tA", T0)], [row("question", "qB", T0), row("question", "qA", T0)]], 10);
check("cùng mili-giây: t trước q, id giảm dần", same.items.map(i => i.id).join() === "tB,tA,qB,qA", same.items.map(i => i.id));
check("compareFeed phản đối xứng", compareFeed(row("thread", "a", T0), row("question", "a", T0)) < 0 && compareFeed(row("question", "a", T0), row("thread", "a", T0)) > 0);
const dup = mergeFeedPages([[row("thread", "t1", T0)], [row("thread", "t1", T0)]], 10);
check("cùng một khoá xuất hiện hai lần → chỉ một", dup.items.length === 1);

// Mô phỏng DB: mỗi nguồn sắp giảm dần, áp where do sourceCursorWhere sinh ra.
type W = { createdAt?: { lt?: Date; lte?: Date } | Date; id?: { lt: string }; OR?: W[] };
function matches(r: Row, w: W | Record<string, unknown>): boolean {
  const x = w as W; const at = Date.parse(r.createdAt);
  if (x.OR && !x.OR.some(o => matches(r, o))) return false;
  if (x.createdAt instanceof Date) { if (at !== x.createdAt.getTime()) return false; }
  else if (x.createdAt) {
    if (x.createdAt.lt && !(at < x.createdAt.lt.getTime())) return false;
    if (x.createdAt.lte && !(at <= x.createdAt.lte.getTime())) return false;
  }
  if (x.id && !(r.id < x.id.lt)) return false;
  return true;
}
function paginate(all: Row[], limit: number): string[] {
  const out: string[] = []; let cursor: string | null = null; let guard = 0;
  do {
    const cur = decodeCursor(cursor);
    const lists = (["thread", "question"] as const).map(src =>
      all.filter(r => r.source === src && matches(r, sourceCursorWhere(cur, src))).sort(compareFeed).slice(0, limit + 1));
    const page = mergeFeedPages(lists, limit);
    out.push(...page.items.map(i => `${i.source[0]}:${i.id}`));
    cursor = page.nextCursor;
  } while (cursor && ++guard < 50);
  return out;
}
const seven = [row("thread", "t1", T0), row("question", "q1", T0 - 1), row("thread", "t2", T0 - 2), row("question", "q2", T0 - 3), row("thread", "t3", T0 - 4), row("question", "q3", T0 - 5), row("thread", "t4", T0 - 6)];
const got7 = paginate(seven, 3);
check("7 bài, limit 3 → đúng 7, mỗi bài một lần", got7.length === 7 && new Set(got7).size === 7, got7);
const tie4 = [row("thread", "t1", T0), row("thread", "t2", T0), row("question", "q1", T0), row("question", "q2", T0)];
for (const lim of [1, 2, 3]) { const g = paginate(tie4, lim); check(`4 bài cùng createdAt, limit ${lim} → không mất, không lặp`, g.length === 4 && new Set(g).size === 4, g); }
const tie9 = Array.from({ length: 9 }, (_, i) => row(i % 2 ? "question" : "thread", `x${i}`, T0 - (i < 6 ? 0 : 1000)));
const g9 = paginate(tie9, 2);
check("9 bài (6 cùng mili-giây + 3 sau) limit 2 → đủ 9, không lặp", g9.length === 9 && new Set(g9).size === 9, g9);

section("normalizeParent");
const mk = (o: Partial<{ id: string; threadId: string; parentReplyId: string | null; deletedAt: Date | null }>) => ({ id: "r1", threadId: "T", parentReplyId: null, deletedAt: null, ...o });
check("cha là gốc → giữ", JSON.stringify(normalizeParent("T", mk({}))) === JSON.stringify({ ok: true, rootId: "r1", childOfChild: false }));
check("cha là con → trả về gốc", JSON.stringify(normalizeParent("T", mk({ id: "r2", parentReplyId: "r1" }))) === JSON.stringify({ ok: true, rootId: "r1", childOfChild: true }));
check("cha khác bài → lỗi", normalizeParent("T", mk({ threadId: "OTHER" })).ok === false);
check("cha đã xoá → lỗi", normalizeParent("T", mk({ deletedAt: new Date() })).ok === false);
check("cha không tồn tại / null → lỗi", normalizeParent("T", null).ok === false && normalizeParent("T", undefined).ok === false);

section("buildReplyTree");
const fr = (id: string, parent: string | null, ms: number, o: Partial<FlatReply> = {}): FlatReply => ({
  id, parentReplyId: parent, content: `nội dung ${id}`, imageUrls: [], createdAt: new Date(T0 + ms), author, likeCount: 0, likedByMe: false, isOwn: false, isAccepted: false, deleted: false, ...o,
});
const tree = buildReplyTree([fr("c2", "r1", 30), fr("r2", null, 20), fr("c1", "r1", 10), fr("r1", null, 0)]);
check("gốc theo thứ tự cũ→mới, con cũ→mới", tree.map(n => n.id).join() === "r1,r2" && tree[0].children.map(n => n.id).join() === "c1,c2", tree.map(n => n.id));
const deep = buildReplyTree([fr("r1", null, 0), fr("c1", "r1", 1), fr("g1", "c1", 2), fr("g2", "g1", 3)]);
check("chuỗi 3–4 cấp bị ép về 1 cấp", deep.length === 1 && deep[0].children.map(n => n.id).join() === "c1,g1,g2" && deep[0].children.every(n => n.children.length === 0), deep);
const delParent = buildReplyTree([fr("r1", null, 0, { deleted: true, content: "BÍ MẬT" }), fr("c1", "r1", 1)]);
check("cha xoá còn con → nút deleted giữ con, nội dung bị xoá sạch", delParent.length === 1 && delParent[0].deleted && delParent[0].content === "" && delParent[0].author.label === "" && delParent[0].children.length === 1, delParent);
check("không rò nội dung đã xoá ở bất kỳ đâu", !JSON.stringify(delParent).includes("BÍ MẬT"));
check("cha xoá không còn con → bỏ; con xoá (lá) → bỏ", buildReplyTree([fr("r1", null, 0, { deleted: true })]).length === 0 && buildReplyTree([fr("r1", null, 0), fr("c1", "r1", 1, { deleted: true })])[0].children.length === 0);
const orphan = buildReplyTree([fr("c9", "gone", 0)]);
check("mồ côi (cha không còn trong dữ liệu) → coi là gốc", orphan.length === 1 && orphan[0].id === "c9");
const cyc = buildReplyTree([fr("a", "b", 0), fr("b", "a", 1)]);
check("vòng tham chiếu không treo", cyc.length >= 1);

section("publicName / shortName");
check("học sinh 'Nguyễn Văn An' → 'An N.'", publicName({ name: "Nguyễn Văn An", role: "student" }) === "An N.");
check("'Trần Thị Bích' → 'Bích T.' (không lộ họ tên đầy đủ)", publicName({ name: "Trần Thị Bích", role: "student" }) === "Bích T.");
check("một từ giữ nguyên", publicName({ name: "An", role: "student" }) === "An");
check("khoảng trắng thừa", shortName("  Lê   Hoàng   Nam  ") === "Nam L.");
check("tên viết thường 'nguyễn văn an' → 'an N.' (chữ cái đầu họ viết hoa)", shortName("nguyễn văn an") === "an N.");
check("tên toàn dấu 'Đặng Ứng Ỷ' → 'Ỷ Đ.'", shortName("Đặng Ứng Ỷ") === "Ỷ Đ.");
check("không bao giờ rỗng: '', '   ', ký tự điều khiển", [shortName(""), shortName("   "), shortName("\u0000\n")].every(s => s.length > 0));
check("gia sư đã xác minh giữ tên đầy đủ", publicName({ name: "Nguyễn Phúc Thanh", role: "admin", adminRole: "teacher", tutorVerified: true }) === "Nguyễn Phúc Thanh");
check("quản trị giữ tên đầy đủ", publicName({ name: "Lê Quản Trị", role: "admin", adminRole: "admin_super" }) === "Lê Quản Trị");
check("gia sư CHƯA xác minh hiện như thành viên thường (rút gọn, không thẻ)", publicName({ name: "Phạm Văn Chưa", role: "admin", adminRole: "teacher", tutorVerified: false }) === "Chưa P." && authorTag({ name: "x", role: "admin", adminRole: "teacher", tutorVerified: false }) === null);
check("thẻ: gia-su / quan-tri / khach / học sinh null", authorTag({ name: "x", role: "admin", adminRole: "teacher", tutorVerified: true }) === "gia-su" && authorTag({ name: "x", role: "admin", adminRole: "admin_content" }) === "quan-tri" && authorTag({ name: "x", role: "student" }, true) === "khach" && authorTag({ name: "x", role: "student" }) === null);

section("hasPhoneOrLink / declaredAgeUnder13");
for (const [t, want] of [
  ["gọi mình 0901234567 nhé", true], ["+84 90 123 4567", true], ["090.123.4567", true], ["0901 234 567", true],
  ["chín không một hai ba bốn", false], ["http://x.vn/abc", true], ["xem zalo.me/0901", true], ["www.abc.net", true],
  ["a.b", false], ["bài 3.5 điểm", false], ["liên hệ a@b.com", true], ["giải x = 1234567", false],
] as [string, boolean][]) check(`hasPhoneOrLink(${JSON.stringify(t)}) = ${want}`, hasPhoneOrLink(t) === want);
for (const [t, want] of [
  ["em 11 tuổi", true], ["mình 12t", true], ["em năm nay 10 tuổi", true], ["lớp 6", false], ["em lớp 6 cần giúp", false],
  ["em 15 tuổi", false], ["em 13 tuổi", false], ["em 1 tuổi", false], ["em 12 tháng", false], ["em học lớp 9", false],
] as [string, boolean][]) check(`declaredAgeUnder13(${JSON.stringify(t)}) = ${want}`, declaredAgeUnder13(t) === want);

section("validateGuestQuestion: ranh giới");
const rep = (n: number) => "a".repeat(n);
const v = (name: string, title: string, content: string) => validateGuestQuestion({ name, title, content });
const okTitle = "Tiêu đề hợp lệ", okContent = "Nội dung hợp lệ đủ dài";
check("tên 1 ký tự → name_invalid", (v(rep(1), okTitle, okContent) as { code?: string }).code === "name_invalid");
check("tên 2 ký tự → ok", v(rep(2), okTitle, okContent).ok);
check("tên 40 ký tự → ok; 41 → name_invalid", v(rep(40), okTitle, okContent).ok && (v(rep(41), okTitle, okContent) as { code?: string }).code === "name_invalid");
check("tiêu đề 4 → title_invalid; 5 ok; 120 ok; 121 → title_invalid", (v("An", rep(4), okContent) as { code?: string }).code === "title_invalid" && v("An", rep(5), okContent).ok && v("An", rep(120), okContent).ok && (v("An", rep(121), okContent) as { code?: string }).code === "title_invalid");
check("nội dung 9 → content_invalid; 10 ok; 600 ok; 601 → content_invalid", (v("An", okTitle, rep(9)) as { code?: string }).code === "content_invalid" && v("An", okTitle, rep(10)).ok && v("An", okTitle, rep(600)).ok && (v("An", okTitle, rep(601)) as { code?: string }).code === "content_invalid");
const xss = v("<img src=x onerror=1>", okTitle, "<script>alert(1)</script> nội dung");
check("<script> / <img> giữ nguyên làm chữ thường (không cắt, không HTML hoá)", xss.ok && xss.value.name === "<img src=x onerror=1>" && xss.value.content.startsWith("<script>alert(1)</script>"), xss);
const ctl = v("A\u0000n\u0007", "Tiêu\u0001 đề ok", "Nội dung\u0000 ok ok ok");
check("ký tự điều khiển bị bỏ / thay bằng khoảng trắng", ctl.ok && !/[\u0000-\u0008]/.test(JSON.stringify(ctl.ok ? ctl.value : "").replace(/\\u000[0-8]/g, "X").replace(/X/g, "\u0000")) && !(ctl.ok && /[\u0000-\u001f]/.test(ctl.value.name + ctl.value.title + ctl.value.content)), ctl);
check("tên chỉ toàn khoảng trắng → name_invalid", (v("      ", okTitle, okContent) as { code?: string }).code === "name_invalid");
check("'em 12 tuổi' trong nội dung → under_13", (v("An", okTitle, "em 12 tuổi cần giải bài này") as { code?: string }).code === "under_13");
check("cleanText nhiều dòng giữ xuống dòng, gom 3+ dòng trống", cleanText("a\r\n\r\n\r\n\r\nb", true) === "a\n\nb");

section("Chữ thông báo: không tên, không tiền, không tiêu đề");
const SAMPLE_NAMES = ["Trần Thị Bích", "Bích", "Nguyễn Văn An"];
for (const kind of ALL_NOTIF_KINDS) {
  const t1 = notificationText(kind, 1);
  const txt = `${t1.title} ${t1.message}`;
  check(`${kind}: sạch (không xu/Coin/VND/đ/chữ số/tên mẫu)`, isCleanNotificationText(txt) && SAMPLE_NAMES.every(n => !txt.includes(n)), txt);
}
const many = notificationText("thread_like", 5);
check("thích gộp N=5: chỉ chữ số là số đếm 5, vẫn không tiền", many.message.includes("5 lượt thích") && isCleanNotificationText(many.message, true) && many.message.replace("5", "").match(/\d/) === null, many);
check("kiểm 'sạch' bắt được vi phạm: 'nhận 20 xu', 'Bích đã thích', '50.000đ', 'Coin'", !isCleanNotificationText("bạn nhận được 20 xu", true) && !isCleanNotificationText("nhận Coin") && !isCleanNotificationText("50.000 đ", true) && !isCleanNotificationText("thích 1 lần"));
check("loại thông báo giữ đúng khoá cũ (thread_reply/thread_like/reply_like/answer_new) để gộp và đường dẫn không vỡ", notificationText("thread_reply_child").type === "thread_reply" && notificationText("thread_like").type === "thread_like" && notificationText("reply_like").type === "reply_like" && notificationText("answer_new").type === "answer_new");

section("threadToFeedItem / legacyQuestionToFeedItem");
const base = {
  id: "t1", kind: "post", title: "bỏ qua", content: "hi", category: "kinh-nghiem", imageUrls: [], fileUrl: null, fileName: null,
  createdAt: new Date(T0), isPinned: false, guestName: null, acceptedReplyId: null, authorId: "u9",
  author: { id: "u9", name: "Trần Thị Bích", role: "student" }, course: null,
  _count: { replies: 2, likes: 3 }, likes: [{ userId: "me" }], bookmarks: [],
};
const fi: FeedItem = threadToFeedItem(base, "me");
check("bài thường: title null, nhãn 'Bích T.', không lộ tên đầy đủ, likedByMe", fi.title === null && fi.author.label === "Bích T." && !JSON.stringify(fi).includes("Trần Thị Bích") && fi.likedByMe && !fi.isOwn);
const fq = threadToFeedItem({ ...base, kind: "question", title: "Tiêu đề", acceptedReplyId: "r1", guestName: "Khách Hỏi" }, null);
check("câu hỏi của khách: nhãn guestName, thẻ khach, id null, không href tác giả, answered", fq.author.label === "Khách Hỏi" && fq.author.tag === "khach" && fq.author.id === null && fq.author.href === null && fq.answered && fq.title === "Tiêu đề" && !fq.likedByMe);
const tutorItem = threadToFeedItem({ ...base, author: { id: "g1", name: "Gia Sư Một", role: "admin", adminRole: "teacher", tutorVerified: true } }, null);
const lockedItem = threadToFeedItem({ ...base, author: { id: "g1", name: "Gia Sư Một", role: "admin", adminRole: "teacher", tutorVerified: true, profileLockedAt: new Date() } }, null);
check("gia sư xác minh: tên đầy đủ + href hồ sơ; hồ sơ bị khoá → không href", tutorItem.author.label === "Gia Sư Một" && tutorItem.author.href === "/cong-dong/ho-so/g1" && lockedItem.author.href === null);
const lq = legacyQuestionToFeedItem({ id: "q1", title: "T", content: "C", createdAt: new Date(T0), status: "answered", acceptedAnswerId: null, authorId: "u9", author: base.author, _count: { answers: 4 } }, "u9");
check("câu hỏi cũ: key q:, href hoi-dap, answered theo status, isOwn, replyCount = answers", lq.key === "q:q1" && lq.href === "/cong-dong/hoi-dap/q1" && lq.answered && lq.isOwn && lq.replyCount === 4);

section("excerptOf");
check("4 dòng đầu, bỏ dòng trống", excerptOf("a\n\nb\nc\nd\ne") === "a\nb\nc\nd");
check("cắt 240 ký tự + …", excerptOf("x".repeat(500)).endsWith("…") && Array.from(excerptOf("x".repeat(500))).length === 241);

done();
