// LOI-02 mục D — Lesson.scheduledAt qua API thật: PUT /api/lessons/[id], POST /api/chapters/[id]/lessons, đọc lại ở GET /api/courses/[id] và DB.
// Cần máy chủ dev của worktree + Postgres riêng (bài gọi wipe()). Chạy TUẦN TỰ, cả hai múi giờ:
//   source tools/local-e2e/env.sh && TZ=Asia/Ho_Chi_Minh npx tsx tools/local-e2e/t-lesson-scheduled.ts
// Ca phá cố ý: gia sư khác 403, học sinh 403, gia sư chờ duyệt 403, khách 401, bài không có 404, bộ môn ngoài nhóm 403 ROLE_FORBIDDEN, chuỗi rác 400 + DB không đổi,
// "2026-11-13" không giờ 400, ISO không múi giờ 400, thân không phải JSON 400 (trước đây req.json() ném → 400 "Cập nhật bài học thất bại"/500 không có chữ đúng).
// Mỗi ca "bị từ chối" đều đọc lại DB: scheduledAt / tiêu đề / số bài KHÔNG đổi.
import { api, mkUser, mkTutor, mkCourse, wipe, check, section, done, BASE, cookieFor, type TUser } from "./h";
import { prisma } from "@/lib/prisma";
import { parseVnDateTime } from "@/lib/tutorLessonDate";

const stamp = Date.now().toString(36); let seq = 0; const nid = (p: string) => `${p}-${stamp}-${++seq}`;
const ZOOM = "https://us02web.zoom.us/j/81234567890";
const vn = (d: string, t: string) => { const r = parseVnDateTime(d, t); if (!r.ok || !r.iso) throw new Error(`ngày thử sai ${d} ${t}`); return r.iso; };

async function mkTree(ownerId: string, name: string, chapterTeacherId: string | null = null) {
  const c = await mkCourse(ownerId, { name });
  const sec = await prisma.section.create({ data: { id: nid("sec"), title: `Phần ${name}`, order: 1, courseId: c.id } });
  const ch = await prisma.chapter.create({ data: { id: nid("ch"), title: `Chương ${name}`, order: 1, sectionId: sec.id, teacherId: chapterTeacherId } });
  const les = await prisma.lesson.create({ data: { id: nid("les"), code: "L1", title: `Bài ${name}`, type: "live", order: 1, chapterId: ch.id, zoomUrl: ZOOM, documents: "[]" } });
  return { c, sec, ch, les };
}
const dbLesson = (id: string) => prisma.lesson.findUnique({ where: { id }, select: { scheduledAt: true, title: true, zoomUrl: true, type: true } });
const isoOf = (d: Date | null | undefined) => (d ? d.toISOString() : null);
/** PUT với thân THÔ (không JSON.stringify) — ca thân hỏng. */
async function rawPut(path: string, as: TUser, body: string, ctype = "application/json") {
  const res = await fetch(BASE + path, { method: "PUT", headers: { cookie: await cookieFor(as), "content-type": ctype }, body, redirect: "manual" });
  const text = await res.text(); let json: any = null; try { json = JSON.parse(text); } catch { /* */ }
  return { status: res.status, json, text };
}

(async () => {
  await wipe();
  const A = await mkTutor("Cô An"), B = await mkTutor("Cô Bình"), BM = await mkTutor("Thầy Bộ Môn");
  const S = await mkUser({ name: "Em Sáu" });
  const P = await mkUser({ name: "Cô Chờ Duyệt" });
  await prisma.user.update({ where: { id: P.id }, data: { tutorAppliedAt: new Date(), tutorVerified: false } });
  const KA = await mkTree(A.id, "Lớp A"), KB = await mkTree(B.id, "Lớp B");
  await prisma.enrollment.create({ data: { userId: S.id, courseId: KA.c.id, status: "active" } });
  // Bộ môn của lớp A: chương KA.ch KHÔNG giao cho thầy (teacherId null) ⇒ ngoài nhóm.
  await prisma.courseTeacher.create({ data: { courseId: KA.c.id, userId: BM.id, role: "subject_teacher", status: "active", invitedBy: A.id } });
  const chBM = await prisma.chapter.create({ data: { id: nid("ch"), title: "Chương của bộ môn", order: 2, sectionId: KA.sec.id, teacherId: BM.id } });
  const lesBM = await prisma.lesson.create({ data: { id: nid("les"), code: "L2", title: "Bài của bộ môn", type: "record", order: 1, chapterId: chBM.id, documents: "[]" } });

  const L = `/api/lessons/${KA.les.id}`;
  const T1 = vn("2026-11-13", "19:00"); // 2026-11-13T12:00:00.000Z
  const courseLesson = async (lessonId: string, as: TUser = A) => {
    const r = await api("GET", `/api/courses/${KA.c.id}`, { as });
    for (const s of r.json?.sections ?? []) for (const ch of s.chapters ?? []) for (const l of ch.lessons ?? []) if (l.id === lessonId) return l;
    return null;
  };

  section("PUT /api/lessons/[id] — đặt, giữ, xoá ngày học (chủ lớp)");
  const p1 = await api("PUT", L, { as: A, body: { scheduledAt: T1 } });
  check("PUT { scheduledAt: ISO } → 200, bản ghi trả scheduledAt đúng ISO", p1.status === 200 && p1.json?.scheduledAt === T1, [p1.status, p1.json?.scheduledAt, p1.json?.error]);
  check("DB: scheduledAt = 2026-11-13T12:00:00.000Z (19:00 giờ VN)", isoOf((await dbLesson(KA.les.id))?.scheduledAt) === T1);
  check("GET /api/courses/<id> (chủ lớp) thấy đúng ISO trong cây", (await courseLesson(KA.les.id))?.scheduledAt === T1, await courseLesson(KA.les.id));
  const pOff = await api("PUT", L, { as: A, body: { scheduledAt: "2026-11-14T08:30:00+07:00" } });
  check('PUT có múi "+07:00" → lưu đúng thời điểm UTC (01:30Z)', pOff.status === 200 && isoOf((await dbLesson(KA.les.id))?.scheduledAt) === "2026-11-14T01:30:00.000Z", [pOff.status, pOff.json?.scheduledAt]);
  await api("PUT", L, { as: A, body: { scheduledAt: T1 } });
  const p2 = await api("PUT", L, { as: A, body: { title: "Bài A (đổi tên)" } });
  const d2 = await dbLesson(KA.les.id);
  check("PUT KHÔNG có khoá scheduledAt → ngày giữ nguyên, tên đổi", p2.status === 200 && isoOf(d2?.scheduledAt) === T1 && d2?.title === "Bài A (đổi tên)", [p2.status, isoOf(d2?.scheduledAt), d2?.title]);
  check("C1: PUT không gửi zoomUrl → zoomUrl cũ còn nguyên trong DB (đọc DB), type giữ 'live'", d2?.zoomUrl === ZOOM && d2?.type === "live", d2);
  const p3 = await api("PUT", L, { as: A, body: { scheduledAt: null } });
  check("PUT { scheduledAt: null } → 200, xoá ngày (DB null, bản ghi null)", p3.status === 200 && p3.json?.scheduledAt === null && (await dbLesson(KA.les.id))?.scheduledAt === null, [p3.status, p3.json?.scheduledAt]);
  check("GET /api/courses/<id> thấy scheduledAt = null sau khi xoá", (await courseLesson(KA.les.id))?.scheduledAt === null);
  await api("PUT", L, { as: A, body: { scheduledAt: T1 } });

  section("PUT — ca phá: dữ liệu rác ⇒ 400, DB không đổi");
  for (const [v, why] of [
    ["", "chuỗi rỗng"], ["abc", "chuỗi rác"], [123, "số"], [[], "mảng"], [{}, "đối tượng"], [true, "boolean"],
    ["2026-11-13", "chỉ ngày, không giờ"], ["2026-11-13T12:00", "không múi giờ"], ["2026-02-30T12:00:00Z", "30/02"], ["1999-01-01T00:00:00Z", "năm 1999"], ["2026-11-13T25:00:00Z", "25 giờ"],
  ] as [unknown, string][]) {
    const r = await api("PUT", L, { as: A, body: { scheduledAt: v, title: "KHONG-DUOC-LUU" } });
    const d = await dbLesson(KA.les.id);
    check(`phá: scheduledAt = ${JSON.stringify(v)} (${why}) → 400 "Ngày học không hợp lệ.", ngày + tên trong DB không đổi`, r.status === 400 && r.json?.error === "Ngày học không hợp lệ." && isoOf(d?.scheduledAt) === T1 && d?.title === "Bài A (đổi tên)", [r.status, r.json?.error, isoOf(d?.scheduledAt), d?.title]);
  }
  for (const [body, ctype, why] of [["{không phải json", "application/json", "JSON hỏng"], ["", "application/json", "thân rỗng"], ["null", "application/json", "null"], ['["x"]', "application/json", "mảng"], ["scheduledAt=2026", "application/x-www-form-urlencoded", "form"]] as const) {
    const r = await rawPut(L, A, body, ctype);
    check(`phá: thân ${why} → 400 "Dữ liệu gửi lên không đúng.", DB không đổi`, r.status === 400 && r.json?.error === "Dữ liệu gửi lên không đúng." && isoOf((await dbLesson(KA.les.id))?.scheduledAt) === T1, [r.status, r.text.slice(0, 120)]);
  }

  section("PUT — quyền (giống route chị em: requireCourseAccessBy + canEditChapter)");
  const deny = async (label: string, as: TUser | undefined, path: string, want: number, code?: string) => {
    const before = await dbLesson(path.split("/").pop()!);
    const r = await api("PUT", path, { as, body: { scheduledAt: "2030-01-01T00:00:00Z", title: "KE-LA" } });
    const after = await dbLesson(path.split("/").pop()!);
    check(`${label} → ${want}${code ? ` ${code}` : ""}, DB không đổi`, r.status === want && (!code || r.json?.code === code) && JSON.stringify(before) === JSON.stringify(after), [r.status, r.json]);
    return r;
  };
  await deny("chưa đăng nhập", undefined, L, 401);
  await deny("học sinh (kể cả đang học lớp này)", S, L, 403);
  await deny("gia sư chờ duyệt", P, L, 403);
  const other = await deny("gia sư B sửa bài lớp A (lớp người khác)", B, L, 403);
  check("403 lớp người khác KHÔNG lộ tên lớp / tên bài của A", !/Lớp A|Bài A/.test(other.text), other.text.slice(0, 200));
  await deny("gia sư A sửa bài lớp B", A, `/api/lessons/${KB.les.id}`, 403);
  await deny("bộ môn sửa bài NGOÀI nhóm mình", BM, L, 403, "ROLE_FORBIDDEN");
  const nf = await api("PUT", `/api/lessons/khong-co-bai-${stamp}`, { as: A, body: { scheduledAt: T1 } });
  check("bài không có → 404", nf.status === 404, [nf.status, nf.json]);
  const bmOk = await api("PUT", `/api/lessons/${lesBM.id}`, { as: BM, body: { scheduledAt: T1 } });
  check("đối chứng: bộ môn sửa bài TRONG nhóm mình → 200 (ca 403 ở trên không đậu giả)", bmOk.status === 200 && isoOf((await dbLesson(lesBM.id))?.scheduledAt) === T1, [bmOk.status, bmOk.json]);
  check("gia sư B không sửa được ⇒ bài lớp B vẫn không có ngày", (await dbLesson(KB.les.id))?.scheduledAt === null);

  section("POST /api/chapters/[id]/lessons — tạo bài có / không ngày");
  const C = `/api/chapters/${KA.ch.id}/lessons`;
  const count = () => prisma.lesson.count({ where: { chapterId: KA.ch.id } });
  const n0 = await count();
  const c1 = await api("POST", C, { as: A, body: { title: "Buổi 2", scheduledAt: vn("2026-11-20", "19:00") } });
  check("POST có scheduledAt → 201, DB đúng ISO", c1.status === 201 && c1.json?.scheduledAt === "2026-11-20T12:00:00.000Z" && isoOf((await dbLesson(c1.json.id))?.scheduledAt) === "2026-11-20T12:00:00.000Z", [c1.status, c1.json?.scheduledAt, c1.json?.error]);
  const c2 = await api("POST", C, { as: A, body: { title: "Buổi 3" } });
  check("POST không có khoá → 201, scheduledAt null", c2.status === 201 && c2.json?.scheduledAt === null && (await dbLesson(c2.json.id))?.scheduledAt === null, [c2.status, c2.json?.scheduledAt]);
  const c3 = await api("POST", C, { as: A, body: { title: "Buổi 4", scheduledAt: null } });
  check("POST scheduledAt null → 201, null", c3.status === 201 && c3.json?.scheduledAt === null, [c3.status, c3.json?.scheduledAt]);
  check("POST không gửi zoomUrl → bài mới zoomUrl null", c2.json?.zoomUrl === null);
  check("thêm 3 bài đúng 3", (await count()) === n0 + 3);
  const n1 = await count();
  for (const [v, why] of [["abc", "rác"], ["2026-11-13", "chỉ ngày"], ["2026-11-13T19:00", "không múi"], [42, "số"], ["", "rỗng"]] as [unknown, string][]) {
    const r = await api("POST", C, { as: A, body: { title: `KHONG-TAO-${why}`, scheduledAt: v } });
    check(`phá: POST scheduledAt ${JSON.stringify(v)} (${why}) → 400, KHÔNG tạo bài`, r.status === 400 && r.json?.error === "Ngày học không hợp lệ." && (await count()) === n1, [r.status, r.json]);
  }
  const noTitle = await api("POST", C, { as: A, body: { title: "  ", scheduledAt: "abc" } });
  check("thiếu tiêu đề kiểm TRƯỚC ngày: → 400 'Thiếu tiêu đề'", noTitle.status === 400 && noTitle.json?.error === "Thiếu tiêu đề", noTitle.json);
  const cB = await api("POST", C, { as: B, body: { title: "KE-LA", scheduledAt: "abc" } });
  check("phá: gia sư B tạo bài vào chương lớp A → 403 (quyền kiểm TRƯỚC ngày), không tạo", cB.status === 403 && (await count()) === n1, [cB.status, cB.json]);
  const cS = await api("POST", C, { as: S, body: { title: "KE-LA", scheduledAt: T1 } });
  check("phá: học sinh POST → 403, không tạo", cS.status === 403 && (await count()) === n1, cS.status);
  const cP = await api("POST", C, { as: P, body: { title: "KE-LA", scheduledAt: T1 } });
  check("phá: gia sư chờ duyệt POST → 403, không tạo", cP.status === 403 && (await count()) === n1, cP.status);
  const cG = await api("POST", C, { body: { title: "KE-LA", scheduledAt: T1 } });
  check("phá: khách POST → 401", cG.status === 401, cG.status);
  const cBM = await api("POST", C, { as: BM, body: { title: "KE-LA", scheduledAt: T1 } });
  check("phá: bộ môn POST vào chương ngoài nhóm → 403 ROLE_FORBIDDEN, không tạo", cBM.status === 403 && cBM.json?.code === "ROLE_FORBIDDEN" && (await count()) === n1, [cBM.status, cBM.json]);
  const cNF = await api("POST", `/api/chapters/khong-co-${stamp}/lessons`, { as: A, body: { title: "x", scheduledAt: T1 } });
  check("chương không có → 404", cNF.status === 404, cNF.status);

  section("Người học: bài có ngày vẫn đọc như cũ (không lộ gì thêm ngoài trường của bài)");
  const sg = await api("GET", L, { as: S });
  check("học sinh đang học GET bài → 200, thấy scheduledAt (ngày học của chính bài em học)", sg.status === 200 && sg.json?.scheduledAt === T1, [sg.status, sg.json?.scheduledAt]);
  const bg = await api("GET", L, { as: B });
  check("gia sư B GET bài lớp A → 403, không lộ ngày", bg.status === 403 && !bg.text.includes(T1), bg.status);

  done();
})().catch(e => { console.error("CRASH", e); process.exit(1); });
