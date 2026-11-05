// BU-02-PHẲNG — bảng kẻ tấn công (đặc tả 8.2) cho Lesson.status: học sinh/khách KHÔNG thấy bài Nháp/Ẩn ở MỌI đường đọc/ghi (R1–R18), gia sư lạ bị chặn, G4–G6 cô lập hai gia sư.
// Cần máy chủ dev + Postgres cục bộ (BASE mặc định http://localhost:3100). Bài gọi wipe(): chỉ chạy trên DB riêng của worktree.
// Cờ TRẺ EM: mỗi ca "không thấy" kiểm cả mã HTTP LẪN nội dung (JSON.stringify không chứa tiêu đề/URL/mã tệp của bài nháp).
// TRẠNG THÁI CHẠY: viết theo đặc tả, CHƯA chạy thật trong phiên viết (không có DB) — tut-test chạy tuần tự rồi sửa lệch (nếu có).
import { api, mkUser, mkTutor, mkSuper, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";

const stamp = Date.now().toString(36); let seq = 0; const id = (p: string) => `${p}-${stamp}-${++seq}`;
const YT = (n: number) => `https://www.youtube.com/watch?v=${String(n).padStart(11, "b")}`;
const SECRET = (k: string) => `BI-MAT-${k}`;      // tiêu đề / link của bài nháp phải KHÔNG xuất hiện ở đâu
type U = Awaited<ReturnType<typeof mkUser>>;
const has = (j: unknown, ...needles: string[]) => needles.some(n => JSON.stringify(j ?? "").includes(n));

async function mkClass(ownerId: string, name: string) {
  const c = await mkCourse(ownerId, { name });
  const sec = await prisma.section.create({ data: { id: id("sec"), title: `Phần của ${name}`, order: 1, courseId: c.id } });
  const mkCh = (title: string, order: number) => prisma.chapter.create({ data: { id: id("ch"), title, order, sectionId: sec.id } });
  const chMix = await mkCh(`Chương lẫn ${name}`, 1), chDraftOnly = await mkCh(SECRET(`CHUONG-CHI-NHAP-${name}`), 2), chEmpty = await mkCh(`Chương trống ${name}`, 3);
  let o = 0;
  const L = (chapterId: string, k: string, status: string, extra: Record<string, unknown> = {}) =>
    prisma.lesson.create({ data: { id: id("les"), code: `L${++o}`, title: status === "published" ? `CONG-KHAI-${k}` : SECRET(k), type: "record", order: ++o, chapterId, isLocked: false, isFree: false, status, videoUrl: status === "published" ? YT(1) : YT(9), documents: "[]", ...extra } });
  const pub = await L(chMix.id, `${name}-pub`, "published");
  const draft = await L(chMix.id, `${name}-draft`, "draft");
  const hidden = await L(chMix.id, `${name}-hidden`, "hidden");
  const draftFree = await L(chMix.id, `${name}-draftfree`, "draft", { isFree: true, azotaUrl: "https://azota.vn/de/xxx", azotaDeadline: "2099-01-01T20:00", documents: JSON.stringify([{ name: SECRET("tailieu-free"), url: "https://x.vn/bi-mat-free.pdf", type: "pdf" }]) });
  const onlyDraft = await L(chDraftOnly.id, `${name}-chuong-nhap`, "draft");
  return { c, sec, chMix, chDraftOnly, chEmpty, pub, draft, hidden, draftFree, onlyDraft };
}

(async () => {
  await wipe();
  const TA = await mkTutor("Gia sư A"), TB = await mkTutor("Gia sư B"), SUP = await mkSuper("Quản trị");
  const PEND = await mkUser({ name: "Gia sư chờ duyệt" }); await prisma.user.update({ where: { id: PEND.id }, data: { tutorAppliedAt: new Date() } });
  const S1 = await mkUser({ name: "HS ghi danh" }), S2 = await mkUser({ name: "HS chưa ghi danh" }), S3 = await mkUser({ name: "HS chờ đồng ý" });
  const A = await mkClass(TA.id, "A"), B = await mkClass(TB.id, "B");
  await prisma.course.update({ where: { id: A.c.id }, data: { status: true } });
  await prisma.enrollment.create({ data: { userId: S1.id, courseId: A.c.id, status: "active" } });
  await prisma.enrollment.create({ data: { userId: S3.id, courseId: A.c.id, status: "pending_consent" } });
  const G = (p: string, as?: U) => api("GET", p, { as });
  const hideAll = ["BI-MAT-", YT(9)];

  section("K1–K4 · GET /api/courses/A (R1) — cây khoá");
  const k1 = await G(`/api/courses/${A.c.id}`);
  const lessonsOf = (j: any) => (j?.sections ?? []).flatMap((s: any) => s.chapters.flatMap((c: any) => c.lessons.map((l: any) => l.id)));
  check("K1 khách: 200, chỉ thấy bài published; không có tên/link/mã bài nháp, ẩn, nháp-miễn-phí; chương chỉ có nháp VÀ chương trống đều biến mất (sau rà soát: pruneTreeForViewer bỏ mọi chương không còn bài Đã đăng)", k1.status === 200 && lessonsOf(k1.json).join() === A.pub.id && !has(k1.json, ...hideAll, "bi-mat-free", "azota.vn/de/xxx") && (k1.json.sections[0].chapters as any[]).map(c => c.id).join() === A.chMix.id, k1.json);
  const k2 = await G(`/api/courses/${A.c.id}`, S1);
  check("K2 HS ghi danh active: như khách (không phải quản lý lớp ⇒ không thấy nháp)", k2.status === 200 && lessonsOf(k2.json).join() === A.pub.id && !has(k2.json, ...hideAll), lessonsOf(k2.json));
  const k3 = await G(`/api/courses/${A.c.id}`, TA);
  check("K3 gia sư chủ: thấy đủ 5 bài, mỗi bài có status", k3.status === 200 && lessonsOf(k3.json).length === 5 && (k3.json.sections as any[]).flatMap(s => s.chapters.flatMap((c: any) => c.lessons)).every((l: any) => ["draft", "published", "hidden"].includes(l.status)));
  const k4 = await G(`/api/courses/${A.c.id}`, TB);
  check("K4 gia sư B (khác): chỉ thấy bài published", k4.status === 200 && lessonsOf(k4.json).join() === A.pub.id && !has(k4.json, ...hideAll));
  const k3b = await G(`/api/courses/${A.c.id}`, SUP);
  check("quản trị cấp 1: thấy đủ (quản lý lớp)", lessonsOf(k3b.json).length === 5);
  check("S3 chờ đồng ý: chỉ published", !has((await G(`/api/courses/${A.c.id}`, S3)).json, ...hideAll));

  section("K5–K8 · GET /api/lessons/[id] (R2) và /context (R3)");
  for (const [n, l] of [["draft", A.draft], ["hidden", A.hidden]] as const) {
    const r = await G(`/api/lessons/${l.id}`, S1);
    check(`K5 S1 GET lesson ${n} ⇒ 404 (không phải 403/200), không lộ nội dung`, r.status === 404 && !has(r.json, ...hideAll), r.status);
  }
  check("K6 S2 (chưa ghi danh) GET lesson draft-free ⇒ 404", (await G(`/api/lessons/${A.draftFree.id}`, S2)).status === 404);
  check("S1 GET lesson published ⇒ 200 (không phá hành vi cũ)", (await G(`/api/lessons/${A.pub.id}`, S1)).status === 200);
  const c1 = await G(`/api/lessons/${A.draft.id}/context`, S1);
  check("K7 S1 context bài draft ⇒ 404", c1.status === 404 && !has(c1.json, ...hideAll));
  const c2 = await G(`/api/lessons/${A.draftFree.id}/context`);
  check("K7 khách context bài draft + isFree ⇒ 401 (chưa đăng nhập) hoặc 404", c2.status === 401 || c2.status === 404);
  const c2b = await G(`/api/lessons/${A.draftFree.id}/context`, S2);
  check("K7 S2 (đã đăng nhập) context bài draft + isFree ⇒ 404, KHÔNG rơi vào nhánh học thử", c2b.status === 404 && !has(c2b.json, ...hideAll, "bi-mat-free"));
  await prisma.lesson.update({ where: { id: A.pub.id }, data: { isFree: true } });
  const c3 = await G(`/api/lessons/${A.pub.id}/context`, S2);
  check("K7 context bài published miễn phí: 200 và cây course.sections KHÔNG chứa tên bài nháp/ẩn/tên chương chỉ có nháp", c3.status === 200 && !has(c3.json, ...hideAll, "bi-mat-free"), c3.status);
  await prisma.lesson.update({ where: { id: A.pub.id }, data: { isFree: false } });
  check("K8 gia sư B GET /api/lessons/<bài bất kỳ của A> ⇒ 403 (hành vi cũ giữ)", (await G(`/api/lessons/${A.draft.id}`, TB)).status === 403 && (await G(`/api/lessons/${A.pub.id}`, TB)).status === 403);
  check("gia sư chủ GET lesson draft ⇒ 200", (await G(`/api/lessons/${A.draft.id}`, TA)).status === 200);

  section("K9–K13 · ghi/đọc của học sinh trên bài nháp (R4, R5, R7, R9, R10)");
  const asg = await prisma.assignment.create({ data: { lessonId: A.draft.id, title: SECRET("btap"), mode: "file", ownerId: TA.id, dueDate: new Date(Date.now() + 86400000) } });
  const asgPub = await prisma.assignment.create({ data: { lessonId: A.pub.id, title: "BT công khai", mode: "file", ownerId: TA.id, dueDate: new Date(Date.now() + 86400000) } });
  const before = { prog: await prisma.lessonProgress.count(), coin: await prisma.coinTransaction.count(), note: await prisma.lessonNote.count(), az: await prisma.lessonAzotaDone.count(), sub: await prisma.assignmentSubmission.count() };
  const k9 = [await api("POST", `/api/progress/${A.draft.id}`, { as: S1, body: { watchedSeconds: 5 } }), await api("PATCH", `/api/progress/${A.draft.id}`, { as: S1, body: { watchedSeconds: 5 } }), await api("POST", `/api/progress/${A.draftFree.id}`, { as: S2, body: {} }), await api("POST", `/api/progress/${A.hidden.id}`, { as: S1, body: {} })];
  check("K9 progress POST/PATCH bài draft/hidden (cả bài miễn phí) ⇒ 404, KHÔNG hàng LessonProgress, KHÔNG Coin", k9.every(r => r.status === 404) && (await prisma.lessonProgress.count()) === before.prog && (await prisma.coinTransaction.count()) === before.coin, k9.map(r => r.status));
  const k10 = [await api("PUT", `/api/lesson-notes/${A.draft.id}`, { as: S1, body: { text: "x" } }), await G(`/api/lesson-notes/${A.draft.id}`, S1), await api("PUT", `/api/lesson-notes/${A.hidden.id}`, { as: S1, body: { text: "" } })];
  check("K10 lesson-notes PUT/GET bài draft/hidden ⇒ 404, không có LessonNote mới", k10.every(r => r.status === 404) && (await prisma.lessonNote.count()) === before.note);
  const k11 = [await api("POST", `/api/lessons/${A.draftFree.id}/azota-done`, { as: S1, body: {} }), await G(`/api/lessons/${A.draftFree.id}/azota-done`, S1)];
  check("K11 azota-done POST/GET bài draft ⇒ 404, không có LessonAzotaDone", k11.every(r => r.status === 404) && (await prisma.lessonAzotaDone.count()) === before.az);
  const k12 = [await api("POST", `/api/assignments/${asg.id}/submit`, { as: S1, body: { fileUrl: "https://x.vn/bai.pdf" } }), await G(`/api/assignments/${asg.id}/answer`, S1)];
  check("K12 assignments submit/answer của bài thuộc mục draft ⇒ 404, không có AssignmentSubmission", k12.every(r => r.status === 404) && (await prisma.assignmentSubmission.count()) === before.sub, k12.map(r => r.status));
  const k13 = [await G(`/api/lessons/${A.draft.id}/assignments`, S1), await G(`/api/lessons/${A.draft.id}/assignments`, S2), await G(`/api/lessons/${A.draft.id}/assignments`, TB)];
  check("K13 GET lessons/<draft>/assignments cho HS ghi danh, HS lạ, gia sư lạ ⇒ 404, không lộ tiêu đề bài tập", k13.every(r => r.status === 404 && !has(r.json, "BI-MAT")), k13.map(r => r.status));
  check("K13 gia sư chủ ⇒ 200 thấy bài tập; bài published ⇒ 200 cho mọi tài khoản", (await G(`/api/lessons/${A.draft.id}/assignments`, TA)).status === 200 && (await G(`/api/lessons/${A.pub.id}/assignments`, S2)).status === 200);
  check("(đối chứng) S1 ghi danh nộp bài tập của mục published ⇒ KHÔNG 404", (await api("POST", `/api/assignments/${asgPub.id}/submit`, { as: S1, body: { fileUrl: "https://x.vn/bai.pdf" } })).status !== 404);

  section("K14–K18 · các đường tổng hợp (R8, R11–R17)");
  const dl = await G("/api/deadlines", S1);
  check("K16 /api/deadlines: hạn Azota của bài draft-free không xuất hiện", dl.status === 200 && !has(dl.json, A.draftFree.id, "BI-MAT"), dl.json);
  const en = await G("/api/enrollments?detail=1", S1);
  check("K17 /api/enrollments?detail=1: lessonCount chỉ đếm bài published (1/5)", en.status === 200 && en.json.courses?.find((c: any) => c.id === A.c.id)?.lessonCount === 1, en.json);
  await prisma.lessonProgress.create({ data: { userId: S1.id, lessonId: A.hidden.id, completed: true } });
  const pg = await G("/api/progress", S1);
  check("R8 /api/progress: bài đã ẩn không vào completedIds/byCourse/positions", pg.status === 200 && !pg.json.completedIds.includes(A.hidden.id) && !(pg.json.byCourse[A.c.id] > 0), pg.json);
  const sch = await G("/api/schedule", S1), todo = await G("/api/student/viec-cua-toi", S1);
  check("K16 /api/schedule và /api/student/viec-cua-toi không chứa bài draft", !has(sch.json, A.draftFree.id, "BI-MAT") && !has(todo.json, asg.id, "BI-MAT"));
  const tim = await G(`/api/thu-vien/tim?q=${encodeURIComponent("bi-mat-free")}`);
  check("K14 khách tìm kho tài liệu công khai bằng từ khoá tài liệu của bài draft+isFree ⇒ không thấy", !has(tim.json, "bi-mat-free", "BI-MAT"), tim.status);
  const tv = await api("GET", "/thu-vien");
  check("K14 trang /thu-vien của khách không chứa tài liệu bài draft-free", !tv.text.includes("bi-mat-free") && !tv.text.includes("BI-MAT"));
  const tvs = await api("GET", "/thu-vien", { as: S1 });
  check("K15 /thu-vien của HS ghi danh không có bài nháp/ẩn của lớp A", !tvs.text.includes("BI-MAT") && !tvs.text.includes("bi-mat-free"));

  section("K19–K20 · tệp KiN gắn ở bài nháp (R18)");
  // Tệp phải có THẬT trên đĩa (driver local): thiếu tệp thì đường "được phép" trả 404 chứ không phải 200.
  const { mkdirSync, writeFileSync } = await import("node:fs");
  const { localPathFor } = await import("@/lib/mediaStorageServer");
  const mkDoc = async (ownerId: string, courseId: string) => {
    const a = await prisma.fileAsset.create({ data: { ownerId, courseId, kind: "document", driver: "local", storageKey: "", mimeType: "text/plain", bytes: 3, originalName: "bi-mat.txt", status: "ready" } });
    const key = `${courseId}/${a.id}-bi-mat.txt`;
    mkdirSync(localPathFor(courseId), { recursive: true }); writeFileSync(localPathFor(key), "abc");
    return prisma.fileAsset.update({ where: { id: a.id }, data: { storageKey: key } });
  };
  const fOnlyDraft = await mkDoc(TA.id, A.c.id), fBoth = await mkDoc(TA.id, A.c.id);
  await prisma.lesson.update({ where: { id: A.draft.id }, data: { documents: JSON.stringify([{ name: "n", url: `/api/media/${fOnlyDraft.id}/file`, type: "txt" }, { name: "b", url: `/api/media/${fBoth.id}/file`, type: "txt" }]) } });
  await prisma.fileAsset.update({ where: { id: fOnlyDraft.id }, data: { lessonId: A.draft.id } });
  await prisma.lesson.update({ where: { id: A.pub.id }, data: { documents: JSON.stringify([{ name: "b", url: `/api/media/${fBoth.id}/file`, type: "txt" }]) } });
  check("K19 S1 mở /file của tệp CHỈ ở bài draft ⇒ 403", (await api("GET", `/api/media/${fOnlyDraft.id}/file`, { as: S1 })).status === 403);
  check("K19 tệp ở cả bài draft và bài published ⇒ 200 (qua bài đã đăng)", (await api("GET", `/api/media/${fBoth.id}/file`, { as: S1 })).status === 200);
  check("K19 chủ tệp / gia sư chủ lớp vẫn mở được tệp ở bài nháp", (await api("GET", `/api/media/${fOnlyDraft.id}/file`, { as: TA })).status === 200);
  check("K20 gia sư B mở tệp của A ⇒ 403", (await api("GET", `/api/media/${fOnlyDraft.id}/file`, { as: TB })).status === 403 && (await api("GET", `/api/media/${fBoth.id}/file`, { as: TB })).status === 403);
  await prisma.lesson.update({ where: { id: A.pub.id }, data: { documents: "[]" } });
  check("gỡ khỏi hết bài published ⇒ HS không còn mở được tệp (403)", (await api("GET", `/api/media/${fBoth.id}/file`, { as: S1 })).status === 403);

  section("K21–K25 · G1–G6: gia sư lạ / chờ duyệt / học sinh / khách");
  const gt = (p: string) => `/api/tutor/lop/${A.c.id}/giao-trinh${p}`;
  const calls: [string, string, unknown][] = [
    ["GET", gt(""), undefined], ["POST", gt("/muc"), { url: YT(70) }], ["DELETE", gt("/muc"), { lessonId: A.pub.id, key: "video:x" }],
    ["PATCH", gt(`/bai/${A.draft.id}`), { status: "published" }], ["PATCH", gt("/trang-thai"), { lessonIds: [A.draft.id], status: "published" }],
    ["POST", gt("/chuong"), { title: "Lén" }], ["PATCH", gt(`/chuong/${A.chMix.id}`), { title: "Lén" }], ["DELETE", gt(`/chuong/${A.chMix.id}`), undefined],
  ];
  const snapA = async () => JSON.stringify([await prisma.lesson.findMany({ where: { chapter: { section: { courseId: A.c.id } } }, orderBy: { id: "asc" }, select: { id: true, status: true, chapterId: true, order: true, videoUrl: true } }), await prisma.chapter.count({ where: { section: { courseId: A.c.id } } })]);
  const s0 = await snapA();
  for (const [who, u] of [["gia sư B", TB], ["gia sư chờ duyệt", PEND], ["học sinh", S1], ["quản trị", SUP]] as const) {
    const rs = await Promise.all(calls.map(([m, p, b]) => api(m, p, { as: u, body: b })));
    check(`K21/K25 ${who}: G1–G6 đều 403, không lộ dữ liệu`, rs.every(r => r.status === 403) && !rs.some(r => has(r.json, "BI-MAT")), rs.map(r => r.status));
  }
  const rsG = await Promise.all(calls.map(([m, p, b]) => api(m, p, { body: b })));
  check("K25 khách: G1–G6 đều 401", rsG.every(r => r.status === 401), rsG.map(r => r.status));
  check("K21 lớp không tồn tại ⇒ 404", (await api("PATCH", "/api/tutor/lop/khong-co/giao-trinh/trang-thai", { as: TA, body: { lessonIds: ["x"], status: "published" } })).status === 404);
  check("K21 sau mọi ca bị chặn: không ghi gì", (await snapA()) === s0);

  section("K22–K24 · cô lập khi gia sư A (chủ lớp A) gửi id của lớp B");
  const bBefore = JSON.stringify(await prisma.lesson.findUnique({ where: { id: B.draft.id } }));
  const k22 = await api("PATCH", gt(`/bai/${B.draft.id}`), { as: TA, body: { status: "published" } });
  check("K22 G4 với bài của lớp B trong đường dẫn lớp A ⇒ 404, bài B không đổi", k22.status === 404 && JSON.stringify(await prisma.lesson.findUnique({ where: { id: B.draft.id } })) === bBefore);
  const k23 = await api("PATCH", gt("/trang-thai"), { as: TA, body: { lessonIds: [A.draft.id, B.draft.id], status: "published" } });
  check("K23 G5 lẫn id lớp B ⇒ 404, KHÔNG id nào đổi (cả bài của A)", k23.status === 404 && (await prisma.lesson.findUnique({ where: { id: A.draft.id } }))?.status === "draft" && JSON.stringify(await prisma.lesson.findUnique({ where: { id: B.draft.id } })) === bBefore);
  const k24 = await api("PATCH", gt(`/bai/${A.draft.id}`), { as: TA, body: { groupId: B.chDraftOnly.id } });
  check("K24 G4 groupId là chương lớp B ⇒ 404, chapterId không đổi", k24.status === 404 && (await prisma.lesson.findUnique({ where: { id: A.draft.id } }))?.chapterId === A.chMix.id);
  check("G6 PATCH/DELETE chương của lớp B qua đường dẫn lớp A ⇒ 404, chương B còn", (await api("PATCH", gt(`/chuong/${B.chMix.id}`), { as: TA, body: { title: "Lén" } })).status === 404 && (await api("DELETE", gt(`/chuong/${B.chMix.id}`), { as: TA })).status === 404 && !!(await prisma.chapter.findUnique({ where: { id: B.chMix.id } })));
  const k37 = await api("PATCH", `/api/courses/${A.c.id}/reorder`, { as: TA, body: { type: "lesson", items: [{ id: B.pub.id, order: 1, parentId: A.chMix.id }] } });
  check("K37 reorder với id/parentId lớp B ⇒ 403 (V6), B không đổi", k37.status === 403 && (await prisma.lesson.findUnique({ where: { id: B.pub.id } }))?.chapterId === B.chMix.id);

  section("K26–K30 · máy trạng thái G4/G5");
  const P = (lid: string, body: unknown, as: U = TA) => api("PATCH", gt(`/bai/${lid}`), { as, body });
  const mkL = (status: string, extra: Record<string, unknown> = {}) => prisma.lesson.create({ data: { id: id("les"), code: "X", title: "Mục thử", type: "record", order: 99, chapterId: A.chMix.id, isLocked: false, status, videoUrl: YT(3), documents: "[]", ...extra } });
  const m1 = await mkL("draft");
  check("K26 HS PATCH G4 ⇒ 403", (await P(m1.id, { status: "published" }, S1)).status === 403);
  const up = await P(m1.id, { status: "published" });
  check("draft → published ⇒ 200 {id,status,groupId}", up.status === 200 && up.json.status === "published" && up.json.id === m1.id && "groupId" in up.json, up.json);
  check("hai lần liên tiếp cùng trạng thái ⇒ 200 idempotent", (await P(m1.id, { status: "published" })).status === 200);
  const hid = await P(m1.id, { status: "hidden" });
  check("published → hidden ⇒ 200; hidden → draft ⇒ 200; hidden → published ⇒ 200", hid.status === 200 && (await P(m1.id, { status: "draft" })).status === 200 && (await P(m1.id, { status: "published" })).status === 200 && (await P(m1.id, { status: "hidden" })).status === 200 && (await P(m1.id, { status: "published" })).status === 200);
  const dh = await P((await mkL("draft")).id, { status: "hidden" });
  check("K29 draft → hidden ⇒ 409 nguyên văn 'Mục Nháp chưa từng đăng, không cần ẩn.'", dh.status === 409 && dh.json.error === "Mục Nháp chưa từng đăng, không cần ẩn.", dh.json);
  const pd = await P(m1.id, { status: "draft" });
  check("K29 published → draft ⇒ 409, trạng thái không đổi", pd.status === 409 && (await prisma.lesson.findUnique({ where: { id: m1.id } }))?.status === "published");
  const empty = await mkL("draft", { videoUrl: null, type: "document" });
  const pe = await P(empty.id, { status: "published" });
  check("K29 đăng mục RỖNG ⇒ 409 'Mục chưa có nội dung. Thêm link hoặc tệp rồi đăng.'", pe.status === 409 && pe.json.error === "Mục chưa có nội dung. Thêm link hoặc tệp rồi đăng." && (await prisma.lesson.findUnique({ where: { id: empty.id } }))?.status === "draft", pe.json);
  const badVals: unknown[] = ["Published", "archived", "", 1, [], {}, null, "draft "];
  const bv = await Promise.all(badVals.map(v => P(m1.id, { status: v })));
  check("K28 status lạ ('Published', 'archived', '', số, mảng, {}, null) ⇒ 400, không ghi", bv.every(r => r.status === 400) && (await prisma.lesson.findUnique({ where: { id: m1.id } }))?.status === "published", bv.map(r => r.status));
  check("G4 body rỗng / groupId '' / groupId số ⇒ 400", [await P(m1.id, {}), await P(m1.id, { groupId: "" }), await P(m1.id, { groupId: 5 })].every(r => r.status === 400));
  const k30 = await Promise.all(["hidden", "published", "hidden", "published", "hidden"].map(s => P(m1.id, { status: s })));
  const fin = (await prisma.lesson.findUnique({ where: { id: m1.id } }))?.status;
  check("K30 5 PATCH song song xen kẽ ⇒ không 500; kết quả cuối hợp lệ", k30.every(r => r.status === 200 || r.status === 409) && (fin === "published" || fin === "hidden"), [k30.map(r => r.status), fin]);
  const k27 = await api("PUT", `/api/lessons/${A.draft.id}`, { as: TA, body: { title: "Đổi tên", status: "published" } });
  check("K27 PUT /api/lessons/[id] kèm status ⇒ 200 nhưng status KHÔNG đổi (bị bỏ qua), tiêu đề đổi", k27.status === 200 && (await prisma.lesson.findUnique({ where: { id: A.draft.id } }))?.status === "draft" && (await prisma.lesson.findUnique({ where: { id: A.draft.id } }))?.title === "Đổi tên");
  await prisma.lesson.update({ where: { id: A.draft.id }, data: { title: SECRET("A-draft") } });
  const bulk = await api("PATCH", gt("/trang-thai"), { as: TA, body: { lessonIds: [A.draft.id, empty.id, A.hidden.id], status: "published" } });
  check("G5 hàng loạt: đăng được vào changed; mục rỗng vào skipped (không làm hỏng lô)", bulk.status === 200 && bulk.json.changed.includes(A.draft.id) && bulk.json.changed.includes(A.hidden.id) && bulk.json.skipped.some((x: any) => x.id === empty.id), bulk.json);
  check("G5 body sai (0 id, 101 id, status lạ) ⇒ 400", [await api("PATCH", gt("/trang-thai"), { as: TA, body: { lessonIds: [], status: "published" } }), await api("PATCH", gt("/trang-thai"), { as: TA, body: { lessonIds: Array.from({ length: 101 }, (_, i) => `x${i}`), status: "published" } }), await api("PATCH", gt("/trang-thai"), { as: TA, body: { lessonIds: [A.pub.id], status: "Published" } })].every(r => r.status === 400));
  const aft = await G(`/api/courses/${A.c.id}`, S1);
  check("sau khi đăng, HS thấy mục vừa đăng (draft→published) ở GET /api/courses", lessonsOf(aft.json).includes(A.draft.id));

  section("K31–K36 · G2 link độc / video YouTube / lớp trống / lớp 'chung' / G6");
  const E = await mkCourse(TA.id, { name: "Lớp trống" }), N = await mkCourse(TA.id, { name: "Lớp chung" });
  const post = (cid: string, body: unknown) => api("POST", `/api/tutor/lop/${cid}/giao-trinh/muc`, { as: TA, body });
  const poison = ["javascript:alert(1)", "data:text/html,<script>1</script>", "http://youtu.be/dQw4w9WgXcQ", "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ", "https://x.vn/" + "a".repeat(2100)];
  const pr = await Promise.all(poison.map(u => post(E.id, { url: u, slot: "video" })));
  check("K31 link độc ⇒ 400, KHÔNG tạo Lesson, KHÔNG tạo phần/chương ngầm", pr.every(r => r.status === 400) && (await prisma.lesson.count({ where: { chapter: { section: { courseId: E.id } } } })) === 0 && (await prisma.section.count({ where: { courseId: E.id } })) === 0, pr.map(r => r.status));
  const vid = await Promise.all(["https://vimeo.com/123456789", "https://zoom.us/rec/share/AbCdEf123", "kin-media:ckkhongco12345", "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrSt/view"].map((u, i) => post(E.id, { url: u, slot: i < 3 ? "video" : "video" })));
  check("K32 Vimeo / Zoom bản ghi / kin-media / Drive ở ô video ⇒ 400 'Video chỉ nhận link YouTube', không tạo gì", vid.every(r => r.status === 400 && /YouTube/.test(r.json.error)) && (await prisma.section.count({ where: { courseId: E.id } })) === 0, vid.map(r => r.json));
  const drive = await post(E.id, { url: "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrSt/view" });
  check("Drive không chỉ ô ⇒ 201 vào TÀI LIỆU (không phải video), mục Nháp", drive.status === 201 && drive.json.item.slot === "document" && drive.json.status === "draft", drive.json);
  const par = await Promise.all([71, 72, 73, 74, 75].map(n => post(E.id, { url: YT(n) })));
  const ets = await prisma.section.findMany({ where: { courseId: E.id }, include: { chapters: { include: { lessons: true } } } });
  check("K33 5 G2 song song vào lớp (gần) trống ⇒ đúng 1 phần ngầm + 1 chương ngầm, đủ mục, tất cả Nháp", par.every(r => r.status === 201) && ets.length === 1 && ets[0].isImplicit && ets[0].chapters.length === 1 && ets[0].chapters[0].isImplicit && ets[0].chapters[0].lessons.length === 6 && ets[0].chapters[0].lessons.every(l => l.status === "draft"), [par.map(r => r.status), ets.length]);
  const pubNow = await post(E.id, { url: YT(76), publish: true });
  check("publish:true ⇒ mục Đã đăng ngay", pubNow.status === 201 && pubNow.json.status === "published");
  // lớp 'chung'
  const nsec = await prisma.section.create({ data: { id: id("sec"), title: "Phần 1", order: 1, courseId: N.id } });
  const nch = await prisma.chapter.create({ data: { id: id("ch"), title: "Chương 1", order: 1, sectionId: nsec.id } });
  const nl = [] as { id: string }[]; for (let i = 0; i < 3; i++) nl.push(await prisma.lesson.create({ data: { id: id("les"), code: `N${i}`, title: `Cũ ${i}`, type: "document", order: i + 1, chapterId: nch.id, documents: "[]" } }));
  const k34 = await post(N.id, { url: YT(80) });
  check("K34 G2 lần đầu ở lớp 'chung' ⇒ mục đi vào chương cũ, KHÔNG tạo chương ngầm thứ hai", k34.status === 201 && (await prisma.chapter.count({ where: { section: { courseId: N.id } } })) === 1 && (await prisma.section.count({ where: { courseId: N.id } })) === 1);
  const k35 = await api("POST", gt("/chuong").replace(A.c.id, N.id), { as: TA, body: { title: "Đại số" } });
  const nLess = await prisma.lesson.findMany({ where: { id: { in: nl.map(l => l.id) } }, select: { chapterId: true } });
  const ssN = await prisma.section.findUnique({ where: { id: nsec.id } }), chN = await prisma.chapter.findUnique({ where: { id: nch.id } });
  check("K35 G6 'Thêm chương' ở lớp 'chung' ⇒ 201, Phần 1/Chương 1 cũ thành NGẦM, KHÔNG bài nào đổi chapterId", k35.status === 201 && ssN?.isImplicit === true && chN?.isImplicit === true && nLess.every(l => l.chapterId === nch.id), k35.json);
  const g1N = await api("GET", `/api/tutor/lop/${N.id}/giao-trinh`, { as: TA });
  check("G1 sau đó: groups có 'Đại số', các mục cũ groupId null (chưa nhóm)", g1N.json.groups.length === 1 && g1N.json.groups[0].title === "Đại số" && g1N.json.entries.filter((e: any) => e.groupId === null).length === 4);
  const gid = k35.json.id;
  const mv = await api("PATCH", `/api/tutor/lop/${N.id}/giao-trinh/bai/${nl[0].id}`, { as: TA, body: { groupId: gid } });
  check("G4 chuyển nhóm ⇒ 200 groupId đúng; groupId null ⇒ về chưa nhóm", mv.status === 200 && mv.json.groupId === gid && (await api("PATCH", `/api/tutor/lop/${N.id}/giao-trinh/bai/${nl[0].id}`, { as: TA, body: { groupId: null } })).json.groupId === null);
  for (const l of nl.slice(0, 3)) await api("PATCH", `/api/tutor/lop/${N.id}/giao-trinh/bai/${l.id}`, { as: TA, body: { groupId: gid } });
  const rn = await api("PATCH", `/api/tutor/lop/${N.id}/giao-trinh/chuong/${gid}`, { as: TA, body: { title: "Đại số 10" } });
  check("G6 đổi tên nhóm ⇒ 200; tên rỗng / 121 ký tự ⇒ 400", rn.status === 200 && rn.json.title === "Đại số 10" && (await api("PATCH", `/api/tutor/lop/${N.id}/giao-trinh/chuong/${gid}`, { as: TA, body: { title: "  " } })).status === 400 && (await api("PATCH", `/api/tutor/lop/${N.id}/giao-trinh/chuong/${gid}`, { as: TA, body: { title: "x".repeat(121) } })).status === 400);
  check("G6 đổi tên/bỏ nhóm trên chương NGẦM ⇒ 400 'Đây không phải nhóm'", (await api("PATCH", `/api/tutor/lop/${N.id}/giao-trinh/chuong/${nch.id}`, { as: TA, body: { title: "x" } })).status === 400 && (await api("DELETE", `/api/tutor/lop/${N.id}/giao-trinh/chuong/${nch.id}`, { as: TA })).status === 400);
  const before36 = await prisma.lesson.count({ where: { chapter: { section: { courseId: N.id } } } });
  const k36 = await api("DELETE", `/api/tutor/lop/${N.id}/giao-trinh/chuong/${gid}`, { as: TA });
  check("K36 'Bỏ nhóm' chương có 3 mục ⇒ 3 mục về chương không nhóm, chương bị xoá, Lesson còn đủ", k36.status === 200 && k36.json.moved === 3 && !(await prisma.chapter.findUnique({ where: { id: gid } })) && (await prisma.lesson.count({ where: { chapter: { section: { courseId: N.id } } } })) === before36 && (await prisma.lesson.count({ where: { id: { in: nl.map(l => l.id) }, chapterId: nch.id } })) === 3);

  section("G6-trống · chương có tên còn TRỐNG chỉ lộ cho người quản lý lớp");
  const g6name = "TEN-CHUONG-TRONG-G6-" + stamp;
  const g6 = await api("POST", gt("/chuong"), { as: TA, body: { title: g6name } });
  const g6own = await G(`/api/courses/${A.c.id}`, TA);
  const g6ctxHs = await G(`/api/lessons/${A.pub.id}/context`, S1), g6ctxGuest = await G(`/api/lessons/${A.pub.id}/context`);
  const g6hs = await G(`/api/courses/${A.c.id}`, S1), g6guest = await G(`/api/courses/${A.c.id}`);
  check("G6-trống tạo chương có tên (còn trống) ⇒ 201", g6.status === 201, g6.json);
  check("G6-trống HS đã ghi danh: GET /api/courses/A KHÔNG chứa tên chương trống", g6hs.status === 200 && !has(g6hs.json, g6name), g6hs.status);
  check("G6-trống khách: GET /api/courses/A KHÔNG chứa tên chương trống", g6guest.status === 200 && !has(g6guest.json, g6name), g6guest.status);
  check("G6-trống HS đã ghi danh: /lessons/[id]/context 200 và KHÔNG chứa tên chương trống", g6ctxHs.status === 200 && !has(g6ctxHs.json, g6name), g6ctxHs.status);
  check("G6-trống khách: /lessons/[id]/context không lộ tên chương trống (200 hoặc 401/403)", [200, 401, 403].includes(g6ctxGuest.status) && !has(g6ctxGuest.json, g6name), g6ctxGuest.status);
  check("G6-trống gia sư chủ: GET /api/courses/A VẪN thấy chương trống đó", g6own.status === 200 && has(g6own.json, g6name), g6own.status);

  section("K38–K39 · nhân bản + hồi quy lớp cũ");
  const dupL = await api("POST", `/api/chapters/${A.chMix.id}/lessons`, { as: TA, body: { title: "Bản sao nháp", status: "draft", videoUrl: YT(5) } });
  const dupP = await api("POST", `/api/chapters/${A.chMix.id}/lessons`, { as: TA, body: { title: "Tab Chương bài cũ", videoUrl: YT(5) } });
  const dupX = await api("POST", `/api/chapters/${A.chMix.id}/lessons`, { as: TA, body: { title: "Giá trị lạ", status: "hidden", videoUrl: YT(5) } });
  check("K38 POST chapters/[id]/lessons: status:'draft' ⇒ draft; không gửi ⇒ published (hành vi cũ); giá trị khác ('hidden') ⇒ published", dupL.json?.status === "draft" && dupP.json?.status === "published" && dupX.json?.status === "published", [dupL.json?.status, dupP.json?.status, dupX.json?.status]);
  await prisma.section.update({ where: { id: B.sec.id }, data: { isImplicit: true } });
  const dc = await api("POST", `/api/courses/${B.c.id}/duplicate`, { as: TB });
  if (dc.status === 200) {
    const copy = await prisma.section.findMany({ where: { courseId: dc.json.id }, include: { chapters: { include: { lessons: true } } } });
    const lessonsC = copy.flatMap(s => s.chapters.flatMap(c => c.lessons));
    check("K38 duplicate lớp: draft/hidden giữ nguyên, published giữ; isImplicit của phần được chép", copy[0]?.isImplicit === true && lessonsC.filter(l => l.status === "draft").length === 3 && lessonsC.filter(l => l.status === "hidden").length === 1 && lessonsC.filter(l => l.status === "published").length === 1, lessonsC.map(l => l.status));
  } else check("K38 duplicate chạy được (cần MANAGE_COURSES; nếu 403 thì bỏ qua)", dc.status === 403, dc.status);
  const K39 = await mkCourse(TA.id, { name: "Lớp cũ" });
  await prisma.course.update({ where: { id: K39.id }, data: { status: true } });
  const ks = await prisma.section.create({ data: { id: id("sec"), title: "Chương trình", order: 1, courseId: K39.id } });
  const kc = await prisma.chapter.create({ data: { id: id("ch"), title: "Đại số", order: 1, sectionId: ks.id } });
  await prisma.lesson.create({ data: { id: id("les"), code: "K", title: "Bài cũ 1", type: "document", order: 1, chapterId: kc.id, documents: "[]" } });
  const k39 = await G(`/api/courses/${K39.id}`);
  const k39g = await api("GET", `/api/tutor/lop/${K39.id}/giao-trinh`, { as: TA });
  check("K39 lớp cũ (mọi bài mặc định published): khách vẫn thấy bài; G1 hiện nhóm 'Chương trình · Đại số'; cột mới mặc định đúng", lessonsOf(k39.json).length === 1 && k39.json.sections[0].isImplicit === false && k39.json.sections[0].chapters[0].lessons[0].status === "published" && k39g.json.groups[0]?.title === "Chương trình · Đại số" && k39g.json.entries[0].status === "published");

  await done();
})();
