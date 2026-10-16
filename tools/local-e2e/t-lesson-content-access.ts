// API: ai thấy NỘI DUNG bài học (videoUrl, tài liệu, buổi học trực tuyến, link Azota, ghi chú, đề bài tập, link nhóm Zalo) — 16/10/2026.
// Lỗi gốc (phát hiện khi rà vai gia sư 15/10): GET /api/courses/[id] trả nguyên bản ghi Lesson cho KHÁCH chưa đăng nhập, chỉ ghi đè isLocked;
// GET /api/lessons/[id]/context mang theo cả cây bài học (có nội dung bài trả phí) tới người xem một bài học thử; MỌI tài khoản admin, kể cả gia sư
// của lớp khác, đọc được bài trả phí; GET /api/lessons/[id]/assignments trả đề bài cho mọi tài khoản đã đăng nhập.
// Bảy vai × năm API; mỗi ô là một phép kiểm "có / không có chuỗi bí mật trong phản hồi".
import { api, mkUser, mkTutor, mkSuper, mkCourse, wipe, check, section, done, type TUser } from "./h";
import { prisma } from "@/lib/prisma";

const SECRET = {
  video: "https://video.example.com/BI-MAT-123",
  zoom: "https://zoom.example.com/j/BI-MAT-ZOOM",
  azota: "https://azota.example.com/BI-MAT-AZOTA",
  doc: "https://files.example.com/BI-MAT.pdf",
  note: "GHI-CHU-NOI-BO-BI-MAT",
  forgot: "https://video.example.com/QUEN-DAT-KHOA",   // bài trả phí nhưng DB ghi isLocked = false
  zalo: "https://zalo.me/g/NHOM-LOP-BI-MAT",
  assignFile: "https://files.example.com/DE-BAI-BI-MAT.pdf",
  assignText: "HUONG-DAN-DE-BAI-BI-MAT",
};
const OPEN = { video: "https://video.example.com/HOC-THU-CONG-KHAI", doc: "https://files.example.com/HOC-THU.pdf" };
const PAID_TOKENS = [SECRET.video, SECRET.zoom, SECRET.azota, "BI-MAT.pdf", SECRET.note, SECRET.forgot];

const has = (text: string, s: string) => text.includes(s);
const leaks = (text: string) => [...PAID_TOKENS, SECRET.zalo].filter(t => has(text, t));

(async () => {
  await wipe();
  const stamp = Date.now().toString(36);
  const T1 = await mkTutor("Gia sư chủ lớp");
  const T2 = await mkTutor("Gia sư lớp khác");
  const SUPER = await mkSuper("Quản trị cấp 1");
  const CMS = await mkUser({ name: "Quản trị nội dung", role: "admin", adminRole: "admin_content" });
  const S_NONE = await mkUser({ name: "HS chưa vào lớp" });
  const S_PEND = await mkUser({ name: "HS chờ phụ huynh" });
  const S_ACT = await mkUser({ name: "HS đang học" });
  const S_SUSP = await mkUser({ name: "HS tạm dừng" });

  const C = await mkCourse(T1.id, { name: "Lớp có bài trả phí" });
  await prisma.course.update({ where: { id: C.id }, data: { price: 500000, zaloGroupLink: SECRET.zalo, status: true } });
  for (const [u, status] of [[S_PEND, "pending_consent"], [S_ACT, "active"], [S_SUSP, "suspended"]] as const) {
    await prisma.enrollment.create({ data: { userId: u.id, courseId: C.id, status } });
  }
  const sec = await prisma.section.create({ data: { id: `sec-${stamp}`, title: "Chương 1", order: 1, courseId: C.id } });
  const chap = await prisma.chapter.create({ data: { id: `chap-${stamp}`, title: "Bài 1", order: 1, sectionId: sec.id } });
  const mk = (k: string, order: number, o: Record<string, unknown>) =>
    prisma.lesson.create({ data: { id: `les-${k}-${stamp}`, code: `L${order}`, title: `Bài ${k}`, type: "record", order, chapterId: chap.id, ...o } as never });
  const lPaid = await mk("paid", 1, {
    isLocked: true, isFree: false, duration: "45 phút", videoUrl: SECRET.video, zoomUrl: SECRET.zoom, azotaUrl: SECRET.azota, azotaDeadline: "2026-12-31",
    documents: JSON.stringify([{ name: "tai-lieu", url: SECRET.doc }]), adminNote: SECRET.note,
  });
  const lForgot = await mk("forgot", 2, { isLocked: false, isFree: false, videoUrl: SECRET.forgot });
  const lFree = await mk("free", 3, { isLocked: false, isFree: true, videoUrl: OPEN.video, documents: JSON.stringify([{ name: "hoc-thu", url: OPEN.doc }]) });
  await prisma.assignment.create({ data: { lessonId: lPaid.id, title: "Bài tập lớp trả phí", instructions: SECRET.assignText, fileUrl: SECRET.assignFile, fileName: "de-bai.pdf", maxPoints: 10, ownerId: T1.id, mode: "file" } });
  // Lớp ẨN (status = false) để giữ nguyên quy tắc "ai thấy lớp ẩn".
  const H = await mkCourse(T1.id, { name: "Lớp ẩn" });
  await prisma.course.update({ where: { id: H.id }, data: { status: false } });

  type V = { key: string; who: string; as?: TUser; full: boolean; fullCtx: boolean };
  // full = toàn quyền ở /api/courses/[id] và /api/lessons/[id] (chỉ "active"); fullCtx = toàn quyền ở /context và /assignments (cho thêm "suspended" xem lại).
  const viewers: V[] = [
    { key: "guest", who: "khách chưa đăng nhập", full: false, fullCtx: false },
    { key: "none", who: "học viên chưa vào lớp", as: S_NONE, full: false, fullCtx: false },
    { key: "pend", who: "học viên chờ phụ huynh (pending_consent)", as: S_PEND, full: false, fullCtx: false },
    { key: "susp", who: "học viên tạm dừng (suspended)", as: S_SUSP, full: false, fullCtx: true },
    { key: "act", who: "học viên đang học (active)", as: S_ACT, full: true, fullCtx: true },
    { key: "owner", who: "gia sư CHỦ lớp", as: T1, full: true, fullCtx: true },
    { key: "other", who: "gia sư của LỚP KHÁC", as: T2, full: false, fullCtx: false },
    { key: "super", who: "quản trị cấp 1", as: SUPER, full: true, fullCtx: true },
    { key: "cms", who: "quản trị nội dung", as: CMS, full: true, fullCtx: true },
  ];

  section("GET /api/courses/[id] — danh sách bài của lớp");
  for (const v of viewers) {
    const r = await api("GET", `/api/courses/${C.id}`, { as: v.as });
    check(`${v.who}: 200`, r.status === 200, r.status);
    const lessons = (r.json?.sections?.[0]?.chapters?.[0]?.lessons ?? []) as Array<Record<string, unknown>>;
    const byId = (id: string) => lessons.find(l => l.id === id) ?? {};
    check(`${v.who}: thấy đủ 3 bài (tiêu đề / loại / thời lượng còn nguyên để trang giới thiệu hiện danh sách)`, lessons.length === 3 && byId(lPaid.id).title === "Bài paid" && byId(lPaid.id).duration === "45 phút");
    if (v.full) {
      check(`${v.who}: thấy nội dung bài trả phí`, has(r.text, SECRET.video) && has(r.text, SECRET.zoom) && has(r.text, SECRET.azota) && has(r.text, "BI-MAT.pdf") && has(r.text, SECRET.note));
      check(`${v.who}: mọi bài mở khoá`, lessons.every(l => l.isLocked === false));
      check(`${v.who}: thấy link nhóm Zalo của lớp`, r.json?.zaloGroupLink === SECRET.zalo);
    } else {
      check(`${v.who}: KHÔNG lộ videoUrl / zoom / azota / tài liệu / ghi chú của bài trả phí`, leaks(r.text).length === 0, leaks(r.text));
      check(`${v.who}: bài trả phí hiện khoá (kể cả bài DB quên đặt isLocked)`, byId(lPaid.id).isLocked === true && byId(lForgot.id).isLocked === true);
      check(`${v.who}: các cột nội dung của bài trả phí là null / "[]"`, byId(lPaid.id).videoUrl === null && byId(lPaid.id).documents === "[]" && byId(lPaid.id).adminNote === null && byId(lForgot.id).videoUrl === null);
      check(`${v.who}: bài học thử miễn phí vẫn công khai (đúng thiết kế)`, byId(lFree.id).videoUrl === OPEN.video && has(r.text, OPEN.doc));
      check(`${v.who}: link nhóm Zalo bị ẩn`, r.json?.zaloGroupLink === null);
    }
  }
  const hidden = async (v: V) => (await api("GET", `/api/courses/${H.id}`, { as: v.as })).status;
  check("lớp ẩn: khách 404", (await hidden(viewers[0])) === 404);
  check("lớp ẩn: học viên chưa vào lớp 404", (await hidden(viewers[1])) === 404);
  check("lớp ẩn: gia sư chủ lớp 200", (await hidden(viewers[5])) === 200);
  check("lớp ẩn: quản trị 200 (giữ nguyên như trước)", (await hidden(viewers[7])) === 200);

  section("GET /api/lessons/[id]/context — bài học thử (cây bài học của lớp đi kèm)");
  for (const v of viewers) {
    const r = await api("GET", `/api/lessons/${lFree.id}/context`, { as: v.as });
    if (!v.as) { check(`${v.who}: 401`, r.status === 401, r.status); continue; }
    check(`${v.who}: 200`, r.status === 200, r.status);
    check(`${v.who}: enrolled = ${v.fullCtx}`, r.json?.enrolled === v.fullCtx, r.json?.enrolled);
    if (v.fullCtx) {
      check(`${v.who}: thấy nội dung bài trả phí trong cây`, has(r.text, SECRET.video) && has(r.text, SECRET.note));
    } else {
      check(`${v.who}: cây bài học KHÔNG mang nội dung bài trả phí (cả `+"`lesson.chapter...course.sections`"+` lẫn `+"`course.sections`"+`)`, leaks(r.text).length === 0, leaks(r.text));
      check(`${v.who}: bài học thử xem được`, r.json?.lesson?.videoUrl === OPEN.video);
    }
  }

  section("GET /api/lessons/[id]/context — bài trả phí");
  for (const v of viewers) {
    const r = await api("GET", `/api/lessons/${lPaid.id}/context`, { as: v.as });
    if (!v.as) { check(`${v.who}: 401`, r.status === 401, r.status); continue; }
    if (v.fullCtx) {
      check(`${v.who}: 200 và thấy nội dung`, r.status === 200 && has(r.text, SECRET.video) && has(r.text, SECRET.doc), r.status);
    } else {
      check(`${v.who}: 403 và không lộ gì`, r.status === 403 && leaks(r.text).length === 0, r.status);
    }
  }

  section("GET /api/lessons/[id] — bản ghi thô của bài trả phí");
  for (const v of viewers) {
    const r = await api("GET", `/api/lessons/${lPaid.id}`, { as: v.as });
    if (!v.as) { check(`${v.who}: 401`, r.status === 401, r.status); continue; }
    if (v.full) {
      check(`${v.who}: 200 và thấy nội dung`, r.status === 200 && has(r.text, SECRET.video), r.status);
    } else {
      check(`${v.who}: 403 và không lộ gì`, r.status === 403 && leaks(r.text).length === 0, r.status);
    }
  }
  const free = await api("GET", `/api/lessons/${lFree.id}`, { as: T2 });
  check("bài học thử: gia sư lớp khác vẫn đọc được (công khai)", free.status === 200 && free.json?.videoUrl === OPEN.video, free.status);
  const freeStu = await api("GET", `/api/lessons/${lFree.id}`, { as: S_NONE });
  check("bài học thử: học viên chưa vào lớp vẫn 403 ở bản ghi thô (giữ nguyên như trước; trang dùng /context)", freeStu.status === 403, freeStu.status);

  section("GET /api/lessons/[id]/assignments — đề bài của lớp");
  for (const v of viewers) {
    const r = await api("GET", `/api/lessons/${lPaid.id}/assignments`, { as: v.as });
    if (!v.as) { check(`${v.who}: 401`, r.status === 401, r.status); continue; }
    if (v.fullCtx) {
      check(`${v.who}: 200 và thấy đề bài`, r.status === 200 && has(r.text, SECRET.assignFile) && has(r.text, SECRET.assignText), r.status);
    } else {
      check(`${v.who}: 403 và không lộ đề bài`, r.status === 403 && !has(r.text, SECRET.assignFile) && !has(r.text, SECRET.assignText), r.status);
    }
  }
  const freeList = await api("GET", `/api/lessons/${lFree.id}/assignments`, { as: S_NONE });
  check("bài học thử: ai đăng nhập cũng xem được danh sách bài tập (200, rỗng)", freeList.status === 200 && Array.isArray(freeList.json) && freeList.json.length === 0, freeList.status);
  const missing = await api("GET", `/api/lessons/khong-co-bai-nay/assignments`, { as: S_ACT });
  check("bài học không tồn tại: 404", missing.status === 404, missing.status);

  section("GET /api/courses — danh sách công khai không mang link nhóm Zalo");
  const pubList = await api("GET", "/api/courses");
  check("khách: danh sách có lớp nhưng không có link nhóm Zalo", pubList.status === 200 && (pubList.json as Array<{ id: string }>).some(c => c.id === C.id) && !has(pubList.text, SECRET.zalo));
  const stuList = await api("GET", "/api/courses", { as: S_ACT });
  check("học viên: danh sách không có link nhóm Zalo", stuList.status === 200 && !has(stuList.text, SECRET.zalo));
  const ownList = await api("GET", "/api/courses?all=1", { as: T1 });
  check("gia sư chủ lớp: bảng quản trị (?all=1) vẫn có link nhóm Zalo để sửa", ownList.status === 200 && has(ownList.text, SECRET.zalo));
  const otherList = await api("GET", "/api/courses?all=1", { as: T2 });
  check("gia sư lớp khác: ?all=1 chỉ thấy lớp của mình (không có lớp này, không có link)", otherList.status === 200 && !has(otherList.text, SECRET.zalo));

  section("Sửa / xoá bài vẫn đúng quyền (không đổi)");
  const putOwn = await api("PUT", `/api/lessons/${lPaid.id}`, { as: T1, body: { adminNote: SECRET.note } });
  check("gia sư chủ lớp sửa được bài của mình", putOwn.status === 200, putOwn.status);
  const putOther = await api("PUT", `/api/lessons/${lPaid.id}`, { as: T2, body: { adminNote: "x" } });
  check("gia sư lớp khác không sửa được (403)", putOther.status === 403, putOther.status);

  await prisma.$disconnect();
  await done();
})().catch(async e => { console.error("CRASH", e); await prisma.$disconnect(); process.exit(1); });
