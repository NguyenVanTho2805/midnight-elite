// Quyết định của chủ 06/11/2026 (API + DB thật + trang): học sinh Enrollment.status = "suspended" (đã nghỉ lớp) KHÔNG xem được nội dung lớp nữa
// (thay quy tắc R01 cũ cho xem lại). Bài MIỄN PHÍ công khai giữ nguyên; active / pending_consent như cũ; gia sư chủ lớp và quản trị không bị chặn.
// Phủ: /context, /lessons/[id], /lessons/[id]/assignments, /assignments/[id]/answer (bài tập tương tác), /lesson-notes, /progress,
// /media/[id]/file + /stream (tài liệu / video lưu trên KiN), /courses/[id]/recordings, trang /lop-cua-toi/[id]/ban-ghi, /courses/[id] (cờ suspended).
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-suspended-content-api.ts   (cần máy chủ thử đang chạy ở BASE; wipe() xoá DB thử)
//
// CA PHÁ CỐ Ý (mỗi lần một thứ rồi hoàn lại — gỡ sửa thì bài phải ĐỎ):
//   - lessons/[id]/context/route.ts: đổi `enrolled.status === "active"` thành `|| === "suspended"` và bỏ khối suspendedBlocksLesson → các ca "context … 403" đỏ.
//   - lessonGuard.ts canWatchStoredMedia: thêm lại `|| v.enrollmentStatus === "suspended"` → ca "tệp tài liệu" và "video" đỏ.
//   - classRecordingsServer.ts: trả ok cho "suspended" → ca "bản ghi 403" đỏ.
//   - lesson-notes/progress/assignments: bỏ lời gọi suspendedLessonBlock / suspendedCourseIds → ca tương ứng đỏ.
//   - P3-7: progress/[lessonId]/route.ts, assignments/[id]/answer|submit, lessons/[id]/azota-done: đổi `enrollmentDeniedBody(enrolled, …)` về `{ error: … }` → ca "ghi … 403 code" đỏ.
//   - P3-4: enrollServer.ts: trả lại `"active"` cho hồ sơ suspended (hoặc bỏ khối isSuspended trong invites/[id]/redeem) → ca "redeem … suspended" đỏ (báo alreadyEnrolled).
import { api, mkUser, mkTutor, mkCourse, mkSuper, cookieFor, wipe, check, section, done, BASE } from "./h";
import { prisma } from "@/lib/prisma";
import { suspendedBlocksLesson, isSuspended, enrollmentDeniedBody, SUSPENDED_REDEEM_MESSAGE, contactTutorHref, SUSPENDED_CONTENT_MESSAGE } from "@/lib/suspendedContent";
import { canWatchStoredMedia } from "@/lib/lessonGuard";
import { uploadLink } from "@/lib/mediaLink";
import { mkdirSync, writeFileSync } from "node:fs";
import { localPathFor } from "@/lib/mediaStorageServer";

const SECRET_VIDEO = "https://video.example/bi-mat-video", SECRET_DOC_TEXT = "TÀI-LIỆU-BÍ-MẬT";
const MSG = "Bạn đã nghỉ lớp này nên chưa xem được bài. Liên hệ gia sư nếu cần tham gia lại.";

async function page(path: string, as: Awaited<ReturnType<typeof mkUser>> | null) {
  const res = await fetch(BASE + path, { redirect: "manual", headers: as ? { cookie: await cookieFor(as) } : {} });
  return { status: res.status, location: res.headers.get("location") ?? "", text: await res.text() };
}

(async () => {
  section("Hàm thuần");
  check("thông điệp đúng giọng KiN", SUSPENDED_CONTENT_MESSAGE === MSG);
  check("isSuspended chỉ đúng 'suspended'", isSuspended({ status: "suspended" }) && !isSuspended({ status: "active" }) && !isSuspended({ status: "pending_consent" }) && !isSuspended(null));
  check("chặn bài trả phí, không chặn bài miễn phí", suspendedBlocksLesson({ status: "suspended" }, { isFree: false }) && !suspendedBlocksLesson({ status: "suspended" }, { isFree: true }));
  check("active / pending_consent / chưa ghi danh: hàm này không chặn (nhánh khác lo)", ["active", "pending_consent"].every(s => !suspendedBlocksLesson({ status: s }, { isFree: false })) && !suspendedBlocksLesson(null, { isFree: false }));
  check("đích liên hệ: hồ sơ gia sư, lớp không chủ thì trang lớp", contactTutorHref({ id: "c1", ownerId: "t1" }) === "/mentor/t1" && contactTutorHref({ id: "c1", ownerId: null }) === "/khoa-hoc/c1");
  check("enrollmentDeniedBody: suspended → code + thông điệp nghỉ lớp; chưa ghi danh / chờ đồng ý → chỉ fallback, KHÔNG code",
    enrollmentDeniedBody({ status: "suspended" }, "x").code === "enrollment_suspended" && enrollmentDeniedBody({ status: "suspended" }, "x").error === MSG
    && JSON.stringify(enrollmentDeniedBody(null, "Chưa ghi danh")) === JSON.stringify({ error: "Chưa ghi danh" }) && enrollmentDeniedBody({ status: "pending_consent" }, "y").code === undefined);
  check("thông điệp redeem cho suspended: giọng KiN, không số/tên", /Liên hệ gia sư/.test(SUSPENDED_REDEEM_MESSAGE) && !/\d/.test(SUSPENDED_REDEEM_MESSAGE));
  const v = { userId: "u", role: "student", adminRole: null, courseOwnerId: "t", enrollmentStatus: null as string | null, lessonIsFree: false };
  check("canWatchStoredMedia: suspended không xem video trả phí, bài miễn phí vẫn được", !canWatchStoredMedia({ ...v, enrollmentStatus: "suspended" }) && canWatchStoredMedia({ ...v, enrollmentStatus: "suspended", lessonIsFree: true }) && canWatchStoredMedia({ ...v, enrollmentStatus: "active" }));

  await wipe();
  const T = await mkTutor("Cô Chủ Lớp Bí Danh"), ADM = await mkSuper("Quản trị");
  const sAct = await mkUser({ name: "HS Đang Học" }), sSus = await mkUser({ name: "HS Đã Nghỉ" }), sPend = await mkUser({ name: "HS Chờ Đồng Ý" }), sOut = await mkUser({ name: "HS Ngoài Lớp" });
  const course = await mkCourse(T.id, { name: "Toán 9" });
  for (const [u, st] of [[sAct, "active"], [sSus, "suspended"], [sPend, "pending_consent"]] as const) await prisma.enrollment.create({ data: { userId: u.id, courseId: course.id, status: st } });
  const sec = await prisma.section.create({ data: { id: "s-x", title: "Phần 1", courseId: course.id, order: 0 } });
  const ch = await prisma.chapter.create({ data: { id: "ch-x", title: "Chương 1", sectionId: sec.id, order: 0 } });
  const mkLesson = (id: string, isFree: boolean, extra: Record<string, unknown> = {}) => prisma.lesson.create({
    data: { id, code: id, title: `Bài ${id}`, type: "record", chapterId: ch.id, order: isFree ? 1 : 0, isFree, isLocked: !isFree, videoUrl: SECRET_VIDEO, ...extra },
  });

  // Tài liệu + video lưu trên KiN (đĩa cục bộ)
  const mkAsset = async (kind: "document" | "video", name: string, body: Buffer, mime: string) => {
    const a = await prisma.fileAsset.create({ data: { ownerId: T.id, courseId: course.id, kind, driver: "local", storageKey: "", mimeType: mime, bytes: body.length, originalName: name, status: "ready" } });
    const key = `${course.id}/${a.id}-${name}`;
    mkdirSync(localPathFor(`${course.id}/x`).replace(/\/x$/, ""), { recursive: true });
    writeFileSync(localPathFor(key), body);
    return prisma.fileAsset.update({ where: { id: a.id }, data: { storageKey: key } });
  };
  const doc = await mkAsset("document", "bi-mat.pdf", Buffer.from(`%PDF-1.4\n${SECRET_DOC_TEXT}\n%%EOF\n`), "application/pdf");
  const vid = await mkAsset("video", "bi-mat.mp4", Buffer.from("0000ftypmp42-video-bi-mat"), "video/mp4");
  const docUrl = `/api/media/${doc.id}/file`, vidUrl = `/api/media/${vid.id}/stream`;
  const paid = await mkLesson("paid-x", false, { videoUrl: uploadLink(vid.id), documents: JSON.stringify([{ name: "Bí mật", url: docUrl, type: "pdf" }]) });
  const free = await mkLesson("free-x", true);

  // Bài tập tương tác + bài đã nộp
  const asg = await prisma.assignment.create({ data: { lessonId: paid.id, title: "BT bí mật", mode: "interactive", dueDate: new Date(Date.now() + 7 * 864e5), ownerId: T.id } });
  await prisma.assignmentQuestion.create({ data: { assignmentId: asg.id, order: 0, text: "Câu hỏi bí mật?", type: "single", points: 1 } });
  // Ghi chú + tiến độ
  for (const u of [sAct, sSus]) {
    await prisma.lessonNote.create({ data: { userId: u.id, lessonId: paid.id, text: "ghi chú riêng" } });
    await prisma.lessonNote.create({ data: { userId: u.id, lessonId: free.id, text: "ghi chú bài miễn phí" } });
    await prisma.lessonProgress.create({ data: { userId: u.id, lessonId: paid.id, completed: true, watchedSeconds: 50 } });
    await prisma.lessonProgress.create({ data: { userId: u.id, lessonId: free.id, completed: true, watchedSeconds: 20 } });
  }
  // Bản ghi buổi học
  const REC = "https://youtu.be/BANGHI-BI-MAT";
  await prisma.classRecording.create({ data: { courseId: course.id, title: "Bản ghi bí mật", url: REC, kind: "youtube", createdBy: T.id } });

  const notSecret = (r: { text: string }) => !/bi-mat-video|BANGHI-BI-MAT|TÀI-LIỆU-BÍ-MẬT|Câu hỏi bí mật|Bí mật|ghi chú riêng/.test(r.text);
  const isSusBody = (r: { status: number; json: any; text: string }) => r.status === 403 && r.json?.code === "enrollment_suspended" && r.json?.error === MSG && notSecret(r);
  const noLeakOfPeople = (r: { text: string }) => !/Cô Chủ Lớp|HS Đã Nghỉ|đồng|\d{4,}/.test(r.text.replace(/enrollment_suspended|[a-z0-9_-]{20,}/gi, ""));

  section("Học sinh ĐÃ NGHỈ (suspended) → 403 ở mọi đường nội dung");
  const c1 = await api("GET", `/api/lessons/${paid.id}/context`, { as: sSus });
  check("/context bài trả phí → 403 + code + thông điệp KiN, không lộ link", isSusBody(c1), c1.json);
  check("/context: contactHref trỏ hồ sơ gia sư, không kèm tên gia sư / số tiền", c1.json?.contactHref === `/mentor/${T.id}` && noLeakOfPeople(c1), c1.json);
  const l1 = await api("GET", `/api/lessons/${paid.id}`, { as: sSus });
  check("/lessons/[id] → 403 + code", isSusBody(l1), l1.json);
  const a1 = await api("GET", `/api/lessons/${paid.id}/assignments`, { as: sSus });
  check("/lessons/[id]/assignments → 403 (không thấy bài tập / bài đã nộp)", isSusBody(a1) && !a1.text.includes("BT bí mật"), a1.json);
  const q1 = await api("GET", `/api/assignments/${asg.id}/answer`, { as: sSus });
  check("bài tập tương tác /assignments/[id]/answer GET → 403, không câu hỏi", q1.status === 403 && notSecret(q1), q1.json);
  const n1 = await api("GET", `/api/lesson-notes/${paid.id}`, { as: sSus });
  check("ghi chú GET bài trả phí → 403, không lộ ghi chú", isSusBody(n1), n1.json);
  const n2 = await api("PUT", `/api/lesson-notes/${paid.id}`, { as: sSus, body: { text: "ghi thêm" } });
  check("ghi chú PUT bài trả phí → 403 và không ghi vào DB", n2.status === 403 && (await prisma.lessonNote.findUnique({ where: { userId_lessonId: { userId: sSus.id, lessonId: paid.id } } }))?.text === "ghi chú riêng", n2.json);
  const p1 = await api("GET", "/api/progress", { as: sSus });
  check("/progress: tiến độ bài trả phí của lớp đã nghỉ KHÔNG hiện; bài miễn phí vẫn hiện", p1.status === 200 && !p1.json.completedIds.includes(paid.id) && p1.json.completedIds.includes(free.id) && !(paid.id in p1.json.positions) && (p1.json.byCourse[course.id] ?? 0) === 1, p1.json);
  const f1 = await api("GET", docUrl, { as: sSus });
  check("tài liệu lưu trên KiN (/media/…/file) → 403, không nội dung", f1.status === 403 && !f1.text.includes(SECRET_DOC_TEXT), f1.status);
  const m1 = await api("GET", vidUrl, { as: sSus });
  check("video lưu trên KiN (/media/…/stream) → 403", m1.status === 403 && !m1.text.includes("video-bi-mat"), m1.status);
  const r1 = await api("GET", `/api/courses/${course.id}/recordings`, { as: sSus });
  check("bản ghi buổi học → 403 + code, không link", isSusBody(r1), r1.json);
  const b1 = await page(`/lop-cua-toi/${course.id}/ban-ghi`, sSus);
  check("trang Bản ghi: hiện thông báo KiN + nút 'Liên hệ gia sư' (không 404, không chuyển trang)", b1.status === 200 && b1.text.includes(MSG) && b1.text.includes("Liên hệ gia sư") && b1.text.includes(`/mentor/${T.id}`) && !b1.text.includes("BANGHI-BI-MAT"), { s: b1.status, loc: b1.location });
  const cc = await api("GET", `/api/courses/${course.id}`, { as: sSus });
  const paidInTree = cc.json?.sections?.[0]?.chapters?.[0]?.lessons?.find((l: any) => l.id === paid.id);
  check("/courses/[id]: có cờ suspended.contactHref; link bài trả phí vẫn bị che", cc.status === 200 && cc.json?.suspended?.contactHref === `/mentor/${T.id}` && paidInTree?.videoUrl === null && paidInTree?.documents === "[]" && notSecret({ text: JSON.stringify(paidInTree) }), cc.json?.suspended);

  section("Học sinh ĐÃ NGHỈ: bài miễn phí công khai giữ nguyên");
  const cf = await api("GET", `/api/lessons/${free.id}/context`, { as: sSus });
  check("/context bài MIỄN PHÍ → 200 đúng bài, bài trả phí trong cây vẫn bị che link", cf.status === 200 && cf.json.lesson.videoUrl === SECRET_VIDEO && cf.json.enrolled === false && cf.json.course.sections[0].chapters[0].lessons.find((l: any) => l.id === paid.id).videoUrl === null, cf.status);
  const nf = await api("GET", `/api/lesson-notes/${free.id}`, { as: sSus });
  check("ghi chú bài miễn phí vẫn đọc được", nf.status === 200 && nf.json.text === "ghi chú bài miễn phí", nf.json);
  const sf = await api("GET", `/api/lessons/${free.id}/assignments`, { as: sSus });
  check("bài tập của bài miễn phí không bị chặn bởi quy tắc này", sf.status === 200, sf.status);

  section("Học sinh ĐANG HỌC (active) → vẫn xem được");
  const c2 = await api("GET", `/api/lessons/${paid.id}/context`, { as: sAct });
  check("/context → 200 đủ link", c2.status === 200 && c2.json.lesson.videoUrl === uploadLink(vid.id) && c2.json.enrolled === true, c2.status);
  check("/lessons/[id] → 200", (await api("GET", `/api/lessons/${paid.id}`, { as: sAct })).status === 200);
  check("/lessons/[id]/assignments → 200 có bài tập", (await api("GET", `/api/lessons/${paid.id}/assignments`, { as: sAct })).json?.some((x: any) => x.title === "BT bí mật"));
  check("bài tập tương tác GET → 200 có câu hỏi", (await api("GET", `/api/assignments/${asg.id}/answer`, { as: sAct })).status === 200);
  check("ghi chú GET / PUT → 200", (await api("GET", `/api/lesson-notes/${paid.id}`, { as: sAct })).json?.text === "ghi chú riêng" && (await api("PUT", `/api/lesson-notes/${paid.id}`, { as: sAct, body: { text: "mới" } })).status === 200);
  const p2 = await api("GET", "/api/progress", { as: sAct });
  check("/progress đủ cả hai bài", p2.json.completedIds.includes(paid.id) && p2.json.completedIds.includes(free.id), p2.json);
  const f2 = await api("GET", docUrl, { as: sAct });
  check("tài liệu → 200 đúng nội dung", f2.status === 200 && f2.text.includes(SECRET_DOC_TEXT), f2.status);
  check("video → 200", (await api("GET", vidUrl, { as: sAct })).status === 200);
  check("bản ghi buổi học → 200 role student", (await api("GET", `/api/courses/${course.id}/recordings`, { as: sAct })).json?.role === "student");
  const b2 = await page(`/lop-cua-toi/${course.id}/ban-ghi`, sAct);
  check("trang Bản ghi → chuyển sang Lớp của tôi (như cũ)", b2.status === 307 && b2.location.includes(`/student/hoc-tap?course=${course.id}`), b2);
  check("/courses/[id] của em đang học: KHÔNG có cờ suspended", !("suspended" in ((await api("GET", `/api/courses/${course.id}`, { as: sAct })).json ?? {})));

  section("pending_consent / chưa ghi danh: như cũ (không đổi)");
  const cp = await api("GET", `/api/lessons/${paid.id}/context`, { as: sPend });
  check("chờ đồng ý: bài trả phí 403 KHÔNG mang code nghỉ lớp (chưa vào lớp, không phải đã nghỉ)", cp.status === 403 && cp.json?.code === undefined, cp.json);
  check("chờ đồng ý: bài miễn phí 200", (await api("GET", `/api/lessons/${free.id}/context`, { as: sPend })).status === 200);
  const co = await api("GET", `/api/lessons/${paid.id}/context`, { as: sOut });
  check("chưa ghi danh: 403 không code", co.status === 403 && co.json?.code === undefined);
  check("chờ đồng ý / chưa ghi danh: tài liệu 403", (await api("GET", docUrl, { as: sPend })).status === 403 && (await api("GET", docUrl, { as: sOut })).status === 403);

  section("Gia sư chủ lớp / quản trị: không bị chặn");
  for (const [nm, u] of [["gia sư chủ lớp", T], ["quản trị cấp 1", ADM]] as const) {
    check(`${nm}: context + lessons + tài liệu + video + bản ghi đều 200`,
      (await api("GET", `/api/lessons/${paid.id}/context`, { as: u })).status === 200 && (await api("GET", `/api/lessons/${paid.id}`, { as: u })).status === 200
      && (await api("GET", docUrl, { as: u })).status === 200 && (await api("GET", vidUrl, { as: u })).status === 200 && (await api("GET", `/api/courses/${course.id}/recordings`, { as: u })).status === 200);
  }
  check("gia sư vẫn thấy hồ sơ của em đã nghỉ (không đổi dữ liệu)", (await prisma.lessonProgress.count({ where: { userId: sSus.id } })) === 2 && (await prisma.lessonNote.count({ where: { userId: sSus.id } })) === 2);

  section("P3-7: học sinh ĐÃ NGHỈ ghi (tiến độ, nộp bài, báo làm xong) → 403 kèm code, không ghi gì");
  const az = await mkLesson("az-x", false, { azotaUrl: "https://azota.vn/de-thi/abc", order: 2 });
  const susBody = (r: { status: number; json: any }) => r.status === 403 && r.json?.code === "enrollment_suspended" && r.json?.error === MSG;
  const progBefore = await prisma.lessonProgress.findUnique({ where: { userId_lessonId: { userId: sSus.id, lessonId: paid.id } } });
  const w1 = await api("POST", `/api/progress/${paid.id}`, { as: sSus, body: {} });
  check("progress POST: 403 + enrollment_suspended", susBody(w1), w1.json);
  const w2 = await api("PATCH", `/api/progress/${paid.id}`, { as: sSus, body: { watchedSeconds: 99 } });
  check("progress PATCH: 403 + enrollment_suspended", susBody(w2), w2.json);
  const w3 = await api("DELETE", `/api/progress/${paid.id}`, { as: sSus });
  check("progress DELETE: 403 + enrollment_suspended", susBody(w3), w3.json);
  const progAfter = await prisma.lessonProgress.findUnique({ where: { userId_lessonId: { userId: sSus.id, lessonId: paid.id } } });
  check("tiến độ trong DB không đổi", progBefore?.completed === progAfter?.completed && progBefore?.watchedSeconds === progAfter?.watchedSeconds, progAfter);
  const w4 = await api("PATCH", `/api/assignments/${asg.id}/answer`, { as: sSus, body: { questionId: "x", answer: "a" } });
  check("assignments answer PATCH: 403 + enrollment_suspended", susBody(w4), w4.json);
  const w5 = await api("POST", `/api/assignments/${asg.id}/submit`, { as: sSus, body: {} });
  check("assignments submit: 403 + enrollment_suspended", susBody(w5), w5.json);
  const w6 = await api("POST", `/api/lessons/${az.id}/azota-done`, { as: sSus, body: {} });
  check("azota-done: 403 + enrollment_suspended", susBody(w6), w6.json);
  check("không có bài nộp / dấu azota nào được ghi", (await prisma.assignmentSubmission.count({ where: { userId: sSus.id } })) === 0 && (await prisma.lessonAzotaDone.count({ where: { userId: sSus.id } })) === 0);
  const x1 = await api("PATCH", `/api/assignments/${asg.id}/answer`, { as: sOut, body: { questionId: "x", answer: "a" } });
  check("chưa ghi danh: vẫn 403 'chưa ghi danh' KHÔNG code nghỉ lớp", x1.status === 403 && x1.json?.code === undefined && /ghi danh/.test(x1.json?.error ?? ""), x1.json);
  const x2 = await api("POST", `/api/progress/${paid.id}`, { as: sOut, body: {} });
  check("progress: chưa ghi danh vẫn 403 không code", x2.status === 403 && x2.json?.code === undefined, x2.json);
  const x3 = await api("POST", `/api/lessons/${az.id}/azota-done`, { as: sPend, body: {} });
  check("azota-done: chờ đồng ý vẫn 403 không code", x3.status === 403 && x3.json?.code === undefined, x3.json);
  const x4 = await api("POST", `/api/progress/${paid.id}`, { as: sAct, body: {} });
  check("progress POST: đang học không bị chặn", x4.status !== 403, x4.json);
  const x5 = await api("POST", `/api/lessons/${az.id}/azota-done`, { as: sAct, body: {} });
  check("azota-done: đang học 200", x5.status === 200, x5.json);

  section("P3-4: nhập mã mời khi đã nghỉ lớp → KHÔNG báo 'đã trong lớp', KHÔNG tự học lại");
  const inv = await api("POST", `/api/courses/${course.id}/invites`, { as: T, body: { maxUses: 5 } });
  check("gia sư tạo mã mời", inv.status === 201 && !!inv.json?.code, inv.json);
  const usedBefore = (await prisma.classInvite.findUnique({ where: { id: inv.json.id } }))?.usedCount;
  const rd = await api("POST", `/api/invites/${inv.json.code}/redeem`, { as: sSus });
  check("redeem (suspended): 403 enrollment_suspended + thông điệp KiN", rd.status === 403 && rd.json?.code === "enrollment_suspended" && rd.json?.error === SUSPENDED_REDEEM_MESSAGE && rd.json?.alreadyEnrolled === undefined, rd.json);
  const stillSus = await prisma.enrollment.findUnique({ where: { userId_courseId: { userId: sSus.id, courseId: course.id } } });
  check("hồ sơ vẫn suspended, mã không bị tính thêm lượt", stillSus?.status === "suspended" && (await prisma.classInvite.findUnique({ where: { id: inv.json.id } }))?.usedCount === usedBefore, stillSus);
  const rdA = await api("POST", `/api/invites/${inv.json.code}/redeem`, { as: sAct });
  check("redeem (đang học): vẫn 200 alreadyEnrolled", rdA.status === 200 && rdA.json?.alreadyEnrolled === true, rdA.json);
  const rdN = await api("POST", `/api/invites/${inv.json.code}/redeem`, { as: sOut });
  check("redeem (chưa ghi danh): vẫn vào lớp 200", rdN.status === 200 && !!rdN.json?.enrollmentId, rdN.json);
  await prisma.enrollment.delete({ where: { userId_courseId: { userId: sOut.id, courseId: course.id } } });

  section("Cho học lại (suspended → active) thì xem được ngay");
  await prisma.enrollment.update({ where: { userId_courseId: { userId: sSus.id, courseId: course.id } }, data: { status: "active" } });
  check("sau khi cho học lại: context 200, tài liệu 200, bản ghi 200, tiến độ trở lại",
    (await api("GET", `/api/lessons/${paid.id}/context`, { as: sSus })).status === 200 && (await api("GET", docUrl, { as: sSus })).status === 200
    && (await api("GET", `/api/courses/${course.id}/recordings`, { as: sSus })).status === 200 && (await api("GET", "/api/progress", { as: sSus })).json.completedIds.includes(paid.id));

  await done();
})();
