// BU-02 — API Giáo trình G1–G3 (GET/POST/DELETE /api/tutor/lop/[courseId]/giao-trinh[/muc]) trên máy chủ dev thật + Postgres cục bộ. Cần BASE (mặc định http://localhost:3100).
// Bài gọi wipe(): chỉ chạy trên DB riêng của worktree. Không cần Cloudinary (tệp KiN được tạo thẳng trong DB, driver local).
// Ca phá cố ý: gia sư LỚP KHÁC (403 ở G1/G2/G3), gia sư CHỜ DUYỆT (403), học sinh/khách, bài của lớp khác trong cùng đường dẫn (404), link độc (cột KHÔNG đổi),
// tệp KiN của người khác (403), 5 yêu cầu song song vào một bài (đủ 5 mục), 3 yêu cầu song song vào lớp trống (đúng 1 Phần), gỡ hai lần, học sinh chưa ghi danh không thấy link vừa thêm.
import { api, BASE, mkUser, mkTutor, mkSuper, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { itemKey } from "@/lib/giaoTrinh";

const yt = (n: number) => `https://www.youtube.com/watch?v=${String(n).padStart(11, "a")}`;
let seq = 0; const stamp = Date.now().toString(36);

async function mkTree(courseId: string, titles: string[]) {
  const sec = await prisma.section.create({ data: { id: `sec-${stamp}-${++seq}`, title: "Phần 1", order: 1, courseId } });
  const ch = await prisma.chapter.create({ data: { id: `ch-${stamp}-${++seq}`, title: "Chương 1", order: 1, sectionId: sec.id } });
  const lessons = [];
  for (let i = 0; i < titles.length; i++) lessons.push(await prisma.lesson.create({ data: { id: `les-${stamp}-${++seq}`, code: `B${i + 1}`, title: titles[i], type: "document", order: i + 1, chapterId: ch.id, isLocked: false, isFree: false, documents: "[]" } }));
  return { chapter: ch, lessons };
}
const lessonDb = (id: string) => prisma.lesson.findUniqueOrThrow({ where: { id } });
const post = (courseId: string, as: Parameters<typeof api>[2] extends infer O ? (O extends { as?: infer U } ? U : never) : never, body: unknown) => api("POST", `/api/tutor/lop/${courseId}/giao-trinh/muc`, { as, body });

(async () => {
  await wipe();
  const T = await mkTutor("Gia sư A"), T2 = await mkTutor("Gia sư B"), SUP = await mkSuper("Quản trị");
  const P = await mkUser({ name: "Gia sư chờ duyệt" });
  await prisma.user.update({ where: { id: P.id }, data: { tutorAppliedAt: new Date() } });
  const S = await mkUser({ name: "HS đã ghi danh" }), SX = await mkUser({ name: "HS chưa ghi danh" });
  const A = await mkCourse(T.id, { name: "Lớp A" }), B = await mkCourse(T2.id, { name: "Lớp B" });
  const E = await mkCourse(T.id, { name: "Lớp trống" }), E2 = await mkCourse(T.id, { name: "Lớp trống 2" });
  await prisma.enrollment.create({ data: { userId: S.id, courseId: A.id, status: "active" } });
  const tA = await mkTree(A.id, ["Bài 1", "Bài 2", "Bài 3"]);
  const tB = await mkTree(B.id, ["Bài của B"]);
  const [L1, L2, L3] = tA.lessons, LB = tB.lessons[0];

  section("G1 · GET giao-trinh — quyền");
  const g = (id: string, as?: typeof T) => api("GET", `/api/tutor/lop/${id}/giao-trinh`, { as });
  const g1 = await g(A.id, T);
  check("gia sư chủ lớp → 200, có courseId/courseName/entries/groups/counts/exams/config (KHÔNG còn config.video, KHÔNG còn sections)", g1.status === 200 && g1.json.courseId === A.id && g1.json.courseName === "Lớp A" && Array.isArray(g1.json.entries) && Array.isArray(g1.json.groups) && !!g1.json.counts && g1.json.sections === undefined && Array.isArray(g1.json.exams) && g1.json.config?.video === undefined && !!g1.json.config?.document, g1.json);
  check("danh sách phẳng đủ 3 mục (cây 'chung' Phần 1/Chương 1 ⇒ không nhóm), mỗi mục có items (mảng), status published (bài cũ), groupId null", g1.json.entries.length === 3 && g1.json.groups.length === 0 && g1.json.entries.every((l: any) => Array.isArray(l.items) && l.status === "published" && l.groupId === null) && g1.json.counts.published === 3 && g1.json.counts.draft === 0);
  check("config.document có maxBytes 25 MB, hạn mức 500 MB, exts, usedBytes số", g1.json.config.document.maxBytes === 25 * 1024 * 1024 && g1.json.config.document.quotaBytes === 500 * 1024 * 1024 && Array.isArray(g1.json.config.document.exts) && typeof g1.json.config.document.usedBytes === "number");
  check("Cache-Control: no-store", /no-store/.test(g1.headers.get("cache-control") ?? ""));
  check("API tổng hợp KHÔNG trả tên học sinh (HS đã ghi danh không xuất hiện)", !JSON.stringify(g1.json).includes("HS đã ghi danh") && !JSON.stringify(g1.json).includes(S.email));
  check("gia sư LỚP KHÁC → 403, không mang dữ liệu lớp", (await g(A.id, T2)).status === 403 && !JSON.stringify((await g(A.id, T2)).json).includes("Bài 1"));
  check("lớp không tồn tại → 404", (await g("khong-co-lop", T)).status === 404);
  check("gia sư CHỜ DUYỆT → 403", (await g(A.id, P)).status === 403);
  check("học sinh → 403; quản trị cấp 1 → 403 (màn của gia sư)", (await g(A.id, S)).status === 403 && (await g(A.id, SUP)).status === 403);
  check("khách → 401", (await g(A.id)).status === 401);

  section("G2 · POST muc — thêm link vào bài có sẵn");
  const y1 = await post(A.id, T, { lessonId: L1.id, url: yt(1) });
  check("YouTube vào Bài 1 → 201, item.label YouTube, ô video, có key", y1.status === 201 && y1.json.item?.label === "YouTube" && y1.json.item?.slot === "video" && y1.json.item?.key === itemKey("video", yt(1)) && y1.json.lessonId === L1.id && y1.json.created?.lesson === false, y1.json);
  const d1 = await lessonDb(L1.id);
  check("cột videoUrl đã ghi, type = record", d1.videoUrl === yt(1) && d1.type === "record", d1);
  const y1b = await post(A.id, T, { lessonId: L1.id, url: yt(1) });
  check("trùng ⇒ 200 {duplicate:true}, cột không đổi", y1b.status === 200 && y1b.json.duplicate === true && (await lessonDb(L1.id)).videoUrl === yt(1), y1b.json);
  const z1 = await post(A.id, T, { lessonId: L1.id, url: "https://zoom.us/j/84012345678" });
  check("Zoom → ô live, zoomUrl ghi, type thành ['record','live']", z1.status === 201 && z1.json.item.slot === "live" && (await lessonDb(L1.id)).zoomUrl === "https://zoom.us/j/84012345678" && (await lessonDb(L1.id)).type === '["record","live"]');
  const az = await post(A.id, T, { lessonId: L1.id, url: "https://azota.vn/de/abc" });
  check("Azota → ô azota", az.status === 201 && az.json.item.slot === "azota" && (await lessonDb(L1.id)).azotaUrl === "https://azota.vn/de/abc");
  const dc = await post(A.id, T, { lessonId: L2.id, url: "https://cdn.example.vn/de-cuong.pdf", name: "Đề cương" });
  const d2 = await lessonDb(L2.id);
  check("PDF trực tiếp → tài liệu, documents có {name,url,type}", dc.status === 201 && dc.json.item.kind === "document" && JSON.parse(d2.documents!)[0].name === "Đề cương" && JSON.parse(d2.documents!)[0].type === "pdf", d2.documents);
  check("tên 300 ký tự được cắt còn 200 (không lỗi)", (await post(A.id, T, { lessonId: L2.id, url: "https://cdn.example.vn/b.pdf", name: "N".repeat(300) })).status === 201 && JSON.parse((await lessonDb(L2.id)).documents!)[1].name.length === 200);
  const warn = await post(A.id, T, { lessonId: L3.id, url: "https://example.vn/trang-bai-giang" });
  check("trang web lạ → 201 kèm warning 'tab mới'", warn.status === 201 && /tab mới/.test(warn.json.warning ?? ""));

  section("G2 · PHÁ CỐ Ý — link độc / hỏng: 400 và CỘT KHÔNG ĐỔI");
  const snap = async () => JSON.stringify((await prisma.lesson.findMany({ where: { id: { in: [L1.id, L2.id, L3.id] } }, orderBy: { id: "asc" }, select: { id: true, videoUrl: true, zoomUrl: true, azotaUrl: true, documents: true, type: true } })));
  const before = await snap();
  for (const [name, url, slot] of [
    ["javascript:", "javascript:alert(1)", undefined], ["data:", "data:text/html,<script>alert(1)</script>", undefined], ["http://", "http://www.youtube.com/watch?v=dQw4w9WgXcQ", undefined],
    ["youtube.com.evil.example vào ô video", "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ", "video"],
    ["2.100 ký tự", "https://x.vn/" + "a".repeat(2100), undefined], ["có khoảng trắng", "https://x.vn/a b", undefined], ["file:", "file:///etc/passwd", undefined],
    [".exe", "https://x.vn/setup.exe", undefined], ["mp4 trực tiếp", "https://x.vn/a.mp4", undefined], ["Facebook", "https://www.facebook.com/watch/?v=1", undefined],
    ["đường dẫn nội bộ lạ", "/admin/khoa-hoc", undefined], ["kin-media của mã không có", "kin-media:ckkhongco12345", undefined], ["Azota vào ô video", "https://azota.vn/de/x", "video"],
    ["playlist YouTube", "https://www.youtube.com/playlist?list=PL123", undefined],
  ] as const) {
    const r = await post(A.id, T, { lessonId: L3.id, url, ...(slot ? { slot } : {}) });
    check(`${name} → 4xx, có lỗi tiếng Việt`, r.status >= 400 && r.status < 500 && typeof r.json?.error === "string", [r.status, r.json]);
  }
  check("sau 14 link độc: cột của cả 3 bài NGUYÊN VẸN", (await snap()) === before);
  check("Azota vào ô video có moveTo=azota", (await post(A.id, T, { lessonId: L3.id, url: "https://azota.vn/de/x", slot: "video" })).json?.moveTo === "azota");
  check("thiếu url → 400; body không phải JSON → 400", (await post(A.id, T, { lessonId: L3.id })).status === 400 && (await api("POST", `/api/tutor/lop/${A.id}/giao-trinh/muc`, { as: T, raw: "{hỏng", headers: { "content-type": "application/json" } })).status === 400);

  section("G2 · giới hạn: 20 link / ô, 30 tài liệu");
  const L4 = (await mkTree(A.id, ["Bài đầy"])).lessons[0];
  await prisma.lesson.update({ where: { id: L4.id }, data: { videoUrl: JSON.stringify(Array.from({ length: 20 }, (_, i) => yt(100 + i))), documents: JSON.stringify(Array.from({ length: 30 }, (_, i) => ({ name: `t${i}`, url: `https://x.vn/${i}.pdf`, type: "pdf" }))) } });
  const full1 = await post(A.id, T, { lessonId: L4.id, url: yt(500) });
  check("link video THỨ 21 → 400 'Tối đa 20'", full1.status === 400 && /Tối đa 20/.test(full1.json.error), full1.json);
  const full2 = await post(A.id, T, { lessonId: L4.id, url: "https://x.vn/moi.pdf" });
  check("tài liệu THỨ 31 → 400", full2.status === 400 && /tối đa 30/.test(full2.json.error), full2.json);
  check("trùng khi đã đầy → vẫn 200 duplicate (không báo vượt)", (await post(A.id, T, { lessonId: L4.id, url: yt(100) })).status === 200);

  section("G2 · quyền & khoá ngoại");
  check("gia sư LỚP KHÁC POST vào lớp A → 403, cột không đổi", (await post(A.id, T2, { lessonId: L3.id, url: yt(7) })).status === 403 && (await snap()) === before);
  check("lessonId của lớp B nhưng đường dẫn là lớp A (T chủ A) → 404, bài của B không đổi", (await post(A.id, T, { lessonId: LB.id, url: yt(8) })).status === 404 && (await lessonDb(LB.id)).videoUrl === null);
  check("T2 gửi vào lớp B bài của B → 201 (chủ lớp B thao tác được)", (await post(B.id, T2, { lessonId: LB.id, url: yt(9) })).status === 201);
  check("chapterId của lớp B nhưng đường dẫn lớp A → 404, không tạo bài", (await post(A.id, T, { chapterId: tB.chapter.id, newLessonTitle: "Lén", url: yt(10) })).status === 404 && (await prisma.lesson.count({ where: { chapterId: tB.chapter.id } })) === 1);
  check("lớp không tồn tại → 404", (await post("khong-co-lop", T, { lessonId: L1.id, url: yt(11) })).status === 404);
  check("gia sư CHỜ DUYỆT → 403; học sinh → 403; quản trị → 403; khách → 401", (await post(A.id, P, { lessonId: L3.id, url: yt(12) })).status === 403 && (await post(A.id, S, { lessonId: L3.id, url: yt(12) })).status === 403 && (await post(A.id, SUP, { lessonId: L3.id, url: yt(12) })).status === 403 && (await post(A.id, undefined as never, { lessonId: L3.id, url: yt(12) })).status === 401);
  check("sau mọi ca bị chặn: cột các bài vẫn nguyên", (await snap()) === before);
  check("lessonId không tồn tại → 404", (await post(A.id, T, { lessonId: "khong-co-bai", url: yt(13) })).status === 404);

  section("G2 · bài mới");
  const nw = await post(A.id, T, { chapterId: tA.chapter.id, newLessonTitle: "Bài mới từ link", url: yt(20) });
  check("YouTube vào 'bài mới' (có chapterId) → 201, created.lesson=true, bài có type 'record'", nw.status === 201 && nw.json.created.lesson === true, nw.json);
  const nl = await lessonDb(nw.json.lessonId);
  check("bài mới đúng tiêu đề, đúng chương, order cuối, videoUrl, type record", nl.title === "Bài mới từ link" && nl.chapterId === tA.chapter.id && nl.videoUrl === yt(20) && nl.type === "record" && nl.order > L4.order - 1);
  const nw2 = await post(A.id, T, { url: yt(21) });
  check("không chỉ rõ bài/chương, lớp ĐÃ có cây ⇒ vào chương cuối, tên bài lấy từ nhận diện", nw2.status === 201 && (await lessonDb(nw2.json.lessonId)).title.length > 0);

  section("G2 · lớp TRỐNG tự có Phần 1 › Chương 1");
  const e1 = await post(E.id, T, { newLessonTitle: "Bài đầu tiên", url: yt(30) });
  const eTree = await prisma.section.findMany({ where: { courseId: E.id }, include: { chapters: { include: { lessons: true } } } });
  check("lớp chưa có Phần: 201 + tự tạo 1 phần NGẦM › 1 chương NGẦM › 1 mục, mục mới là NHÁP (không còn 'Phần 1/Chương 1' cứng)", e1.status === 201 && e1.json.status === "draft" && eTree.length === 1 && eTree[0].isImplicit === true && eTree[0].chapters.length === 1 && eTree[0].chapters[0].isImplicit === true && eTree[0].chapters[0].lessons.length === 1 && eTree[0].chapters[0].lessons[0].status === "draft", eTree);
  const par = await Promise.all([40, 41, 42].map(n => post(E2.id, T, { newLessonTitle: `Song song ${n}`, url: yt(n) })));
  const e2Tree = await prisma.section.findMany({ where: { courseId: E2.id }, include: { chapters: { include: { lessons: true } } } });
  check("3 yêu cầu SONG SONG vào lớp trống → 3 mục, nhưng chỉ ĐÚNG 1 phần ngầm và 1 chương ngầm (khoá cây lớp)", par.every(r => r.status === 201) && e2Tree.length === 1 && e2Tree[0].chapters.length === 1 && e2Tree[0].chapters[0].lessons.length === 3, [par.map(r => r.status), e2Tree.length]);

  section("G2 · 5 yêu cầu SONG SONG vào MỘT bài → đủ 5 mục");
  const LP = (await mkTree(A.id, ["Bài song song"])).lessons[0];
  const five = await Promise.all([50, 51, 52, 53, 54].map(n => post(A.id, T, { lessonId: LP.id, url: yt(n) })));
  const lp = await lessonDb(LP.id);
  const got = JSON.parse(lp.videoUrl!) as string[];
  check("cả 5 → 201", five.every(r => r.status === 201), five.map(r => r.status));
  check("cột videoUrl chứa ĐỦ 5 link, không mất cập nhật", got.length === 5 && [50, 51, 52, 53, 54].every(n => got.includes(yt(n))), got);
  const mixed = await Promise.all([post(A.id, T, { lessonId: LP.id, url: "https://x.vn/a1.pdf" }), post(A.id, T, { lessonId: LP.id, url: "https://x.vn/a2.pdf" }), post(A.id, T, { lessonId: LP.id, url: "https://zoom.us/j/84012345678" })]);
  const lp2 = await lessonDb(LP.id);
  check("song song khác ô: 2 tài liệu + 1 Zoom đều có mặt, 5 video còn nguyên", mixed.every(r => r.status === 201) && JSON.parse(lp2.documents!).length === 2 && !!lp2.zoomUrl && JSON.parse(lp2.videoUrl!).length === 5);

  section("G2 · tệp KiN: của mình dùng lại được, của người khác thì không");
  const mkAsset = (ownerId: string, courseId: string, o: Record<string, unknown> = {}) => prisma.fileAsset.create({ data: { ownerId, courseId, kind: "document", driver: "local", storageKey: `${courseId}/x.pdf`, mimeType: "application/pdf", bytes: 100, originalName: "tai-lieu.pdf", status: "ready", ...o } });
  const mine = await mkAsset(T.id, A.id), theirs = await mkAsset(T2.id, B.id), pend = await mkAsset(T.id, A.id, { status: "pending" });
  const LE = eTree[0].chapters[0].lessons[0];
  const reuse = await post(E.id, T, { lessonId: LE.id, url: `/api/media/${mine.id}/file`, name: "tai-lieu.pdf", from: "library" });
  check("dùng lại tệp CỦA MÌNH ở lớp khác (E) → 201, storage 'kin', nhãn 'Tệp trên KiN'", reuse.status === 201 && reuse.json.item.storage === "kin" && reuse.json.item.label === "Tệp trên KiN", reuse.json);
  check("FileAsset.lessonId được đặt khi đang trống", (await prisma.fileAsset.findUnique({ where: { id: mine.id } }))?.lessonId === LE.id);
  const reuse2 = await post(A.id, T, { lessonId: L3.id, url: `/api/media/${mine.id}/file`, from: "library" });
  check("cùng tệp dùng thêm ở bài thứ hai (lớp A) → 201 và lessonId của tệp KHÔNG bị giành", reuse2.status === 201 && (await prisma.fileAsset.findUnique({ where: { id: mine.id } }))?.lessonId === LE.id);
  const steal = await post(A.id, T, { lessonId: L3.id, url: `/api/media/${theirs.id}/file`, from: "library" });
  check("tệp KiN của GIA SƯ KHÁC → 403, cột bài không đổi", steal.status === 403 && !((await lessonDb(L3.id)).documents ?? "").includes(theirs.id), steal.json);
  check("tệp chưa tải xong (pending) → 404; mã không có → 404", (await post(A.id, T, { lessonId: L3.id, url: `/api/media/${pend.id}/file` })).status === 404 && (await post(A.id, T, { lessonId: L3.id, url: "/api/media/ckkhongco12345/file" })).status === 404);
  const vOther = await prisma.fileAsset.create({ data: { ownerId: T2.id, courseId: B.id, kind: "video", driver: "local", storageKey: "x/v.mp4", mimeType: "video/mp4", bytes: 10, originalName: "v.mp4", status: "ready" } });
  const vMine = await prisma.fileAsset.create({ data: { ownerId: T.id, courseId: A.id, kind: "video", driver: "local", storageKey: "x/v2.mp4", mimeType: "video/mp4", bytes: 10, originalName: "v2.mp4", status: "ready" } });
  check("BU-02-PHẲNG: video chỉ YouTube — kin-media: (của người khác HAY của mình) → 400 'Video chỉ nhận link YouTube', cột không đổi", await (async () => { const a = await post(A.id, T, { lessonId: L3.id, url: `kin-media:${vOther.id}` }), b = await post(A.id, T, { lessonId: L3.id, url: `kin-media:${vMine.id}` }); return a.status === 400 && b.status === 400 && /YouTube/.test(b.json.error) && !((await lessonDb(L3.id)).videoUrl ?? "").includes("kin-media"); })());

  section("G2 · form (POST thường → 303)");
  const form = (courseId: string, as: typeof T, fields: Record<string, string>) => api("POST", `/api/tutor/lop/${courseId}/giao-trinh/muc`, { as, raw: new URLSearchParams(fields).toString(), headers: { "content-type": "application/x-www-form-urlencoded" } });
  const f1 = await form(A.id, T, { lessonId: L3.id, url: yt(60) });
  // LOI-07: đích là GỐC lớp (tab "Bài học"), MỘT chặng: …/giao-trinh nay 307 về gốc và bỏ query, nên 303 về đó từng làm mất ?ok= / ?loi=.
  const loc = (r: { headers: Headers }) => new URL(r.headers.get("location") ?? "/", BASE);
  const dest1 = loc(f1);
  check("form hợp lệ → 303 THẲNG về gốc lớp /lop-cua-toi/quan-lop/<id>?ok=1&lessonId=… (không qua …/giao-trinh)", f1.status === 303 && dest1.pathname === `/lop-cua-toi/quan-lop/${A.id}` && dest1.searchParams.get("ok") === "1" && dest1.searchParams.get("lessonId") === L3.id, f1.headers.get("location"));
  check("303 có Cache-Control no-store", /no-store/.test(f1.headers.get("cache-control") ?? ""), f1.headers.get("cache-control"));
  const hop = await api("GET", `${dest1.pathname}${dest1.search}`, { as: T });
  check("mở đích 303 → 200 ngay (đích đã là trang cuối: không chặng 307 nào cắt query)", hop.status === 200 && !hop.headers.get("location"), [hop.status, hop.headers.get("location")]);
  // Ca phá cố ý: đích cũ …/giao-trinh?ok=1 thì chặng 307 tiếp theo làm rơi query — giữ ca này để không ai đổi đích về chỗ cũ.
  const old = await api("GET", `/lop-cua-toi/quan-lop/${A.id}/giao-trinh?ok=1&lessonId=${L3.id}`, { as: T });
  check("phá cố ý: đường cũ …/giao-trinh?ok=1 → 307 về gốc và MẤT ?ok= (lý do không được 303 về đó)", old.status === 307 && !new URL(old.headers.get("location") ?? "/", BASE).searchParams.has("ok"), [old.status, old.headers.get("location")]);
  check("form: cột đã ghi", (await lessonDb(L3.id)).videoUrl?.includes(yt(60)) === true);
  const f2 = await form(A.id, T, { lessonId: L3.id, url: "javascript:alert(1)" });
  check("form link độc → 303 gốc lớp ?loi=link và GIỮ lessonId", f2.status === 303 && loc(f2).pathname === `/lop-cua-toi/quan-lop/${A.id}` && loc(f2).searchParams.get("loi") === "link" && loc(f2).searchParams.get("lessonId") === L3.id, f2.headers.get("location"));
  const f3 = await form(A.id, T, { lessonId: L4.id, url: yt(600) });
  check("form vượt giới hạn → 303 ?loi=gioi-han", f3.status === 303 && /loi=gioi-han/.test(f3.headers.get("location") ?? ""), f3.headers.get("location"));
  const f4 = await form(A.id, T2, { lessonId: L3.id, url: yt(61) });
  check("form của gia sư lớp khác → 303 gốc lớp ?loi=quyen, cột không đổi", f4.status === 303 && loc(f4).pathname === `/lop-cua-toi/quan-lop/${A.id}` && loc(f4).searchParams.get("loi") === "quyen" && !(await lessonDb(L3.id)).videoUrl?.includes(yt(61)), f4.headers.get("location"));
  check("form không có url → 303 ?loi=link", /loi=link/.test((await form(A.id, T, { lessonId: L3.id })).headers.get("location") ?? ""));

  section("G3 · DELETE muc — gỡ, hai lần không lỗi");
  const del = (courseId: string, as: typeof T | undefined, body: unknown) => api("DELETE", `/api/tutor/lop/${courseId}/giao-trinh/muc`, { as, body });
  const key1 = itemKey("video", yt(1));
  const dl1 = await del(A.id, T, { lessonId: L1.id, key: key1 });
  check("gỡ YouTube khỏi Bài 1 → 200 {removed:true}, cột videoUrl rỗng, type cập nhật", dl1.status === 200 && dl1.json.removed === true && (await lessonDb(L1.id)).videoUrl === null && (await lessonDb(L1.id)).type !== "record", dl1.json);
  const dl2 = await del(A.id, T, { lessonId: L1.id, key: key1 });
  check("gỡ LẦN HAI cùng khoá → vẫn 200 {removed:false}", dl2.status === 200 && dl2.json.removed === false);
  const docKey = itemKey("document", "https://cdn.example.vn/de-cuong.pdf");
  check("gỡ tài liệu theo khoá; bài còn tài liệu thứ hai", (await del(A.id, T, { lessonId: L2.id, key: docKey })).json.removed === true && JSON.parse((await lessonDb(L2.id)).documents!).length === 1);
  const kinKey = itemKey("document", `/api/media/${mine.id}/file`);
  check("gỡ tệp KiN khỏi bài — FileAsset KHÔNG bị xoá (có thể đang dùng ở lớp khác)", (await del(A.id, T, { lessonId: L3.id, key: kinKey })).json.removed === true && !!(await prisma.fileAsset.findUnique({ where: { id: mine.id } })));
  check("gia sư LỚP KHÁC gỡ → 403, không đổi gì", (await del(A.id, T2, { lessonId: L2.id, key: itemKey("document", JSON.parse((await lessonDb(L2.id)).documents!)[0].url) })).status === 403 && JSON.parse((await lessonDb(L2.id)).documents!).length === 1);
  check("bài của lớp B qua đường dẫn lớp A → 404; thiếu khoá / thiếu bài → 400; chờ duyệt 403; khách 401", (await del(A.id, T, { lessonId: LB.id, key: key1 })).status === 404 && (await del(A.id, T, { lessonId: L1.id })).status === 400 && (await del(A.id, T, { key: key1 })).status === 400 && (await del(A.id, P, { lessonId: L1.id, key: key1 })).status === 403 && (await del(A.id, undefined, { lessonId: L1.id, key: key1 })).status === 401);
  check("khoá lạ → 200 removed:false (không lỗi)", (await del(A.id, T, { lessonId: L1.id, key: "video:0000000000" })).json.removed === false);

  section("Không lộ link cho người chưa ghi danh sau khi thêm mục (MD-03 còn nguyên)");
  const SECRET = "bbbbbbbbbbb";
  await post(A.id, T, { lessonId: L1.id, url: `https://www.youtube.com/watch?v=${SECRET}` });
  await post(A.id, T, { lessonId: L1.id, url: "https://cdn.example.vn/bi-mat-tai-lieu.pdf", name: "Tài liệu bí mật" });
  const leaks = (j: unknown) => /bbbbbbbbbbb|bi-mat-tai-lieu|Tài liệu bí mật/.test(JSON.stringify(j));
  check("học sinh CHƯA ghi danh: GET /api/courses/<A> không có link vừa thêm", !leaks((await api("GET", `/api/courses/${A.id}`, { as: SX })).json));
  check("khách: GET /api/courses/<A> không có link vừa thêm", !leaks((await api("GET", `/api/courses/${A.id}`)).json));
  const ctxSX = await api("GET", `/api/lessons/${L1.id}/context`, { as: SX });
  check("học sinh chưa ghi danh: GET /api/lessons/<id>/context không có link (hoặc bị chặn)", !leaks(ctxSX.json), ctxSX.status);
  check("học sinh ĐÃ ghi danh vẫn thấy đủ", leaks((await api("GET", `/api/courses/${A.id}`, { as: S })).json));
  check("gia sư LỚP KHÁC xem /api/courses/<A> không thấy link", !leaks((await api("GET", `/api/courses/${A.id}`, { as: T2 })).json));

  await done();
})().catch(e => { console.error(e); process.exit(1); });
