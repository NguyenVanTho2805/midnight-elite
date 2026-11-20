// TUT-lich-keo-tha — API: tạo lớp kèm khung giờ (nguyên tử), nhân bản chép khung, GET /api/tutor/khung-gio, PUT/PATCH, trần 14 khung / note ≤ 200,
// ma trận quyền (gia sư chủ lớp / gia sư lạ / quản trị trung tâm / học sinh / khách / gia sư chờ duyệt) và BẤT BIẾN TIỀN: đổi khung không đổi phí đã chốt.
// Cần máy chủ dev đang chạy (BASE). Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-schedule-drag-api.ts
import { api, mkUser, mkTutor, mkSuper, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { issueInvoice } from "@/lib/invoiceServer";
import { buildInboxItems } from "@/lib/tutorInbox";
import { loadTutorInboxRaw } from "@/lib/tutorInboxServer";
import { loadTutorTodoCounts, loadTutorTodoTotal } from "@/lib/tutorDashboard";

const COURSE_BASE = {
  category: "Toán", instructor: "KiN", teacherAvatar: "K", openDate: "01/10/2026", types: ["Video"], tag: null, tagColor: null,
  bg: "var(--kin-chu-phu)", strip: "var(--kin-tt-chu-cho)", price: 0, originalPrice: null, lessons: 0, hours: 0, status: true,
};
let seq = 0;
const stamp = Date.now().toString(36);
const newBody = (extra: Record<string, unknown> = {}) => { seq++; const id = `kg-${stamp}-${seq}`; return { ...COURSE_BASE, id, name: `Lớp KG ${seq}`, adminName: `Lớp KG ${seq}`, shortTitle: `K${seq}`, ...extra }; };
const S = (day: number, s: string, e: string, extra: Record<string, unknown> = {}) => ({ dayOfWeek: day, startTime: s, endTime: e, ...extra });
const snapSched = async () => JSON.stringify(await prisma.classSchedule.findMany({ orderBy: { id: "asc" } }));
const snapCourses = async () => (await prisma.course.count());

(async () => {
  await wipe();
  const A = await mkTutor("Cô Lan"), B = await mkTutor("Thầy Khác"), ADM = await mkSuper("Quản trị TT");
  const STU = await mkUser({ name: "Em An" });
  const PEND = await mkUser({ name: "Chờ duyệt" });
  await prisma.user.update({ where: { id: PEND.id }, data: { tutorAppliedAt: new Date() } });
  const cA = await mkCourse(A.id, { name: "Toán 9" });
  const cB = await mkCourse(B.id, { name: "Lý 8 (của thầy Khác)" });
  const sA = await prisma.classSchedule.create({ data: { courseId: cA.id, dayOfWeek: 2, startTime: "19:00", endTime: "20:30", note: "gốc", joinUrl: "https://meet.example/a" } });
  const sB = await prisma.classSchedule.create({ data: { courseId: cB.id, dayOfWeek: 2, startTime: "19:00", endTime: "20:30", joinUrl: "https://meet.example/SECRET-B" } });
  await prisma.enrollment.create({ data: { userId: STU.id, courseId: cA.id, status: "active" } });

  // ── 1. Ma trận quyền ───────────────────────────────────────────────────────
  section("Ma trận quyền: khách 401 · học sinh 403 · gia sư chờ duyệt 403 · gia sư lạ 403 (DB KHÔNG đổi) · không có 404 · quản trị 2xx");
  type Req = { name: string; call: (courseId: string, scheduleId: string, as?: typeof A) => ReturnType<typeof api>; okStatus: number[]; mutates: boolean };
  const routes: Req[] = [
    { name: "GET class-schedules", call: (c, _s, as) => api("GET", `/api/courses/${c}/class-schedules`, { as }), okStatus: [200], mutates: false },
    { name: "POST class-schedules", call: (c, _s, as) => api("POST", `/api/courses/${c}/class-schedules`, { as, body: S(4, "10:00", "11:00") }), okStatus: [201], mutates: true },
    { name: "PUT class-schedules/[id]", call: (_c, s, as) => api("PUT", `/api/class-schedules/${s}`, { as, body: { note: "đổi" } }), okStatus: [200], mutates: true },
    { name: "PATCH class-schedules/[id]", call: (_c, s, as) => api("PATCH", `/api/class-schedules/${s}`, { as, body: { note: "đổi" } }), okStatus: [200], mutates: true },
    { name: "POST schedule-conflicts", call: (c, _s, as) => api("POST", `/api/courses/${c}/schedule-conflicts`, { as, body: { dayOfWeek: 2, startTime: "19:00", endTime: "20:00" } }), okStatus: [200], mutates: false },
    { name: "GET tutor/khung-gio?courseId", call: (c, _s, as) => api("GET", `/api/tutor/khung-gio?courseId=${encodeURIComponent(c)}`, { as }), okStatus: [200], mutates: false },
    { name: "POST duplicate", call: (c, _s, as) => api("POST", `/api/courses/${c}/duplicate`, { as }), okStatus: [200], mutates: true },
    { name: "DELETE class-schedules/[id]", call: (_c, s, as) => api("DELETE", `/api/class-schedules/${s}`, { as }), okStatus: [200], mutates: true },
  ];
  for (const r of routes) {
    const before = await snapSched(), cBefore = await snapCourses();
    const g = await r.call(cA.id, sA.id, undefined);
    const st = await r.call(cA.id, sA.id, STU);
    const pe = await r.call(cA.id, sA.id, PEND);
    const bad = await r.call(cA.id, sA.id, B);
    check(`${r.name}: khách 401 · học sinh 403 · chờ duyệt 403 · gia sư lạ 403`, g.status === 401 && st.status === 403 && pe.status === 403 && bad.status === 403, [g.status, st.status, pe.status, bad.status]);
    check(`${r.name}: bốn lần bị từ chối KHÔNG đổi DB (khung + số lớp)`, (await snapSched()) === before && (await snapCourses()) === cBefore);
    const nf = await r.call("khong-co-lop-nay", "khong-co-khung-nay", A);
    check(`${r.name}: lớp/khung không có → 404 (chủ lớp hỏi)`, nf.status === 404, nf.status);
    const nfStranger = await r.call("khong-co-lop-nay", "khong-co-khung-nay", B);
    check(`${r.name}: không có → 404 kể cả gia sư lạ (không lộ lớp nào tồn tại)`, nfStranger.status === 404, nfStranger.status);
  }
  check("id rỗng (/api/courses//class-schedules) không bao giờ 2xx", (await api("GET", "/api/courses//class-schedules", { as: A })).status >= 300);
  check("id lạ có ký tự đặc biệt → 404 (ký tự NUL → 400/404), không 500", [(await api("GET", "/api/courses/%27%20OR%201%3D1--/class-schedules", { as: A })).status === 404, [400, 404].includes((await api("PUT", "/api/class-schedules/%00x", { as: A, body: { note: "x" } })).status)].every(Boolean), "");
  // Quản trị trung tâm: 2xx trên lớp của gia sư (sau cùng vì có đổi dữ liệu)
  const admResults: Array<[string, number]> = [];
  for (const r of routes.filter(r => r.name !== "DELETE class-schedules/[id]")) admResults.push([r.name, (await r.call(cA.id, sA.id, ADM)).status]);
  check("quản trị trung tâm: mọi route 2xx đúng mã trên lớp của gia sư", routes.filter(r => r.name !== "DELETE class-schedules/[id]").every((r, i) => r.okStatus.includes(admResults[i][1])), admResults);
  // Chủ lớp: 2xx
  const ownResults: Array<[string, number]> = [];
  for (const r of routes) ownResults.push([r.name, (await r.call(cA.id, sA.id, A)).status]);
  check("gia sư chủ lớp: mọi route đúng mã (khung gốc bị DELETE ở route cuối)", routes.every((r, i) => r.okStatus.includes(ownResults[i][1])), ownResults);
  // Dọn: bản sao + khung thêm trong ma trận
  await prisma.course.deleteMany({ where: { id: { notIn: [cA.id, cB.id] } } });
  await prisma.classSchedule.deleteMany({ where: { courseId: cA.id } });
  const s1 = await prisma.classSchedule.create({ data: { courseId: cA.id, dayOfWeek: 2, startTime: "19:00", endTime: "20:30", note: "gốc", joinUrl: "https://meet.example/a" } });

  // ── 2. POST /api/courses + schedules[] ────────────────────────────────────
  section("POST /api/courses kèm schedules[]: nguyên tử, kiểm từng khung, cờ requireSchedule / noFixedSchedule");
  const create = (extra: Record<string, unknown>, as = A) => api("POST", "/api/courses", { as, body: newBody(extra) });
  const okSched = [S(2, "19:00", "20:30", { note: "Toán 9", mode: "offline", location: "Phòng 3" }), S(4, "19:00", "20:30")];
  let c0 = await snapCourses(), sc0 = await snapSched();
  let r = await create({ schedules: okSched, requireSchedule: true });
  const got = r.status === 201 ? await prisma.classSchedule.findMany({ where: { courseId: r.json.id }, orderBy: { dayOfWeek: "asc" } }) : [];
  check("2 khung hợp lệ → 201, scheduleCount=2, DB có đúng 2 khung với giờ/ghi chú/hình thức", r.status === 201 && r.json.scheduleCount === 2 && got.length === 2 && got[0].startTime === "19:00" && got[0].note === "Toán 9" && got[0].mode === "offline" && got[0].location === "Phòng 3" && got.every(g => g.active), [r.status, r.json, got]);
  check("lớp tạo ra thuộc về người gọi (ownerId = A)", (await prisma.course.findUniqueOrThrow({ where: { id: r.json.id } })).ownerId === A.id);
  const rGiờ = await create({ schedules: [S(1, "9:05", "10:00")] });
  check("giờ '9:05' được chuẩn hoá '09:05'", rGiờ.status === 201 && (await prisma.classSchedule.findFirstOrThrow({ where: { courseId: rGiờ.json.id } })).startTime === "09:05");
  const rEnd = await create({ schedules: [S(1, "20:00", "23:59")] });
  check("endTime '23:59' → 201 (đây là cách gửi 'hết ngày')", rEnd.status === 201);

  c0 = await snapCourses(); sc0 = await snapSched();
  r = await create({ schedules: [S(2, "19:00", "20:30"), S(3, "19:00", "20:30"), S(4, "20:00", "19:00")] });
  check("khung thứ 3 hỏng → 400 kèm index=2 và field='schedules'", r.status === 400 && r.json.index === 2 && r.json.field === "schedules", r.json);
  check("… và KHÔNG có Course nào, KHÔNG có khung nào (nguyên tử)", (await snapCourses()) === c0 && (await snapSched()) === sc0);
  const badCases: Array<[string, unknown]> = [
    ["15 khung (vượt trần 14)", Array.from({ length: 15 }, (_, i) => S(i % 7, `${String(6 + (i % 7)).padStart(2, "0")}:00`, `${String(7 + (i % 7)).padStart(2, "0")}:00`))],
    ["endTime '24:00'", [S(1, "20:00", "24:00")]],
    ["startTime = endTime", [S(1, "19:00", "19:00")]],
    ["start > end", [S(1, "20:00", "19:00")]],
    ["giờ chữ", [S(1, "bảy giờ", "20:00")]],
    ["joinUrl javascript:", [S(1, "19:00", "20:00", { joinUrl: "javascript:alert(1)" })]],
    ["joinUrl ftp:", [S(1, "19:00", "20:00", { joinUrl: "ftp://x.y/z" })]],
    ["note 201 ký tự", [S(1, "19:00", "20:00", { note: "x".repeat(201) })]],
    ["note không phải chữ", [S(1, "19:00", "20:00", { note: 5 })]],
    ["dayOfWeek 7", [S(7, "19:00", "20:00")]],
    ["dayOfWeek −1", [S(-1, "19:00", "20:00")]],
    ["dayOfWeek '2' (chuỗi)", [S("2" as unknown as number, "19:00", "20:00")]],
    ["dayOfWeek 2.5", [S(2.5, "19:00", "20:00")]],
    ["mode lạ", [S(1, "19:00", "20:00", { mode: "hybrid" })]],
    ["phần tử không phải đối tượng", [null]],
    ["schedules không phải mảng", "2 giờ chiều"],
  ];
  for (const [name, schedules] of badCases) {
    const b = await create({ schedules });
    check(`từ chối: ${name} → 400, không tạo gì`, b.status === 400 && (await snapCourses()) === c0 && (await snapSched()) === sc0, [b.status, b.json]);
  }
  check("note đúng 200 ký tự → 201", (await create({ schedules: [S(1, "19:00", "20:00", { note: "x".repeat(200) })] })).status === 201);
  check("đúng 14 khung → 201, scheduleCount=14", await (async () => { const rr = await create({ schedules: Array.from({ length: 14 }, (_, i) => S(i % 7, `${String(5 + Math.floor(i / 7) * 6).padStart(2, "0")}:00`, `${String(6 + Math.floor(i / 7) * 6).padStart(2, "0")}:00`)) }); return rr.status === 201 && rr.json.scheduleCount === 14; })());

  c0 = await snapCourses();
  r = await create({ requireSchedule: true });
  check("requireSchedule không có schedules → 400 code=schedule_required, không tạo lớp", r.status === 400 && r.json.code === "schedule_required" && (await snapCourses()) === c0, r.json);
  r = await create({ requireSchedule: true, schedules: [] });
  check("requireSchedule + schedules rỗng → 400 schedule_required", r.status === 400 && r.json.code === "schedule_required");
  r = await create({ requireSchedule: true, noFixedSchedule: true });
  check("requireSchedule + noFixedSchedule → 201, scheduleCount=0, không có khung", r.status === 201 && r.json.scheduleCount === 0 && (await prisma.classSchedule.count({ where: { courseId: r.json.id } })) === 0, r.json);
  r = await create({});
  check("KHÔNG có cờ nào → hành vi cũ: 201, scheduleCount=0 (bài cũ vẫn xanh)", r.status === 201 && r.json.scheduleCount === 0);
  r = await create({ requireSchedule: "true" });
  check("phá: requireSchedule dạng chuỗi 'true' KHÔNG phải cờ bật (chỉ boolean true) → hành vi cũ 201", r.status === 201);
  const own = await create({ schedules: okSched, ownerId: B.id });
  check("phá: gia sư không đặt được ownerId người khác qua body (ownerId = người gọi)", own.status === 201 && (await prisma.course.findUniqueOrThrow({ where: { id: own.json.id } })).ownerId === A.id);
  check("học sinh / khách / chờ duyệt tạo lớp kèm khung → 403/401/403 và không tạo gì", await (async () => { const a = await create({ schedules: okSched }, STU), g = await api("POST", "/api/courses", { body: newBody({ schedules: okSched }) }), p = await create({ schedules: okSched }, PEND); return a.status === 403 && g.status === 401 && p.status === 403; })());
  const dupId = await create({ id: (await prisma.course.findFirstOrThrow({ where: { ownerId: A.id }, orderBy: { adminId: "desc" } })).id, schedules: okSched });
  check("mã lớp trùng → 409 và KHÔNG thêm khung nào", dupId.status === 409);

  // ── 3. duplicate ──────────────────────────────────────────────────────────
  section("duplicate chép khung ĐANG BẬT");
  const off = await prisma.classSchedule.create({ data: { courseId: cA.id, dayOfWeek: 5, startTime: "08:00", endTime: "09:00", active: false } });
  const s2 = await prisma.classSchedule.create({ data: { courseId: cA.id, dayOfWeek: 6, startTime: "08:00", endTime: "09:30", note: "T7", mode: "online", joinUrl: "https://meet.example/t7", location: null } });
  const d = await api("POST", `/api/courses/${cA.id}/duplicate`, { as: A });
  const copied = await prisma.classSchedule.findMany({ where: { courseId: d.json.id }, orderBy: [{ dayOfWeek: "asc" }] });
  check("bản sao có đúng 2 khung bật (bỏ khung tắt), schedulesCopied=2", d.status === 200 && d.json.schedulesCopied === 2 && copied.length === 2, [d.json, copied.length]);
  check("khung sao chép đủ trường (thứ, giờ, note, mode, joinUrl), bật, là BẢN GHI MỚI (id khác nguồn)", copied.every(c => c.active) && copied.some(c => c.dayOfWeek === 6 && c.note === "T7" && c.mode === "online" && c.joinUrl === "https://meet.example/t7" && c.startTime === "08:00" && c.endTime === "09:30") && copied.every(c => ![s1.id, s2.id, off.id].includes(c.id)));
  check("bản sao có ownerId = người nhân bản; lớp nguồn vẫn đủ khung (3, kể cả tắt)", (await prisma.course.findUniqueOrThrow({ where: { id: d.json.id } })).ownerId === A.id && (await prisma.classSchedule.count({ where: { courseId: cA.id } })) === 3);
  const dAdm = await api("POST", `/api/courses/${cA.id}/duplicate`, { as: ADM });
  check("quản trị nhân bản lớp của gia sư: chép khung, ownerId = quản trị", dAdm.status === 200 && dAdm.json.schedulesCopied === 2 && (await prisma.course.findUniqueOrThrow({ where: { id: dAdm.json.id } })).ownerId === ADM.id);
  const cNo = await mkCourse(A.id, { name: "Không lịch" });
  const dNo = await api("POST", `/api/courses/${cNo.id}/duplicate`, { as: A });
  check("lớp không có khung → bản sao không có khung, schedulesCopied=0 (hành vi cũ)", dNo.status === 200 && dNo.json.schedulesCopied === 0 && (await prisma.classSchedule.count({ where: { courseId: dNo.json.id } })) === 0);
  const before = await snapSched(), cc = await snapCourses();
  const dB = await api("POST", `/api/courses/${cA.id}/duplicate`, { as: B });
  check("gia sư lạ nhân bản lớp người khác → 403, không tạo lớp, không chép khung", dB.status === 403 && (await snapSched()) === before && (await snapCourses()) === cc);

  // ── 4. PUT / PATCH ────────────────────────────────────────────────────────
  section("PUT/PATCH: sửa nhiều trường một lần, kiểm hiệu lực, 409 trùng giờ, note ≤ 200");
  const cP = await mkCourse(A.id, { name: "Sửa khung" });
  const p1 = await prisma.classSchedule.create({ data: { courseId: cP.id, dayOfWeek: 2, startTime: "19:00", endTime: "20:30" } });
  let u = await api("PUT", `/api/class-schedules/${p1.id}`, { as: A, body: { dayOfWeek: 4, startTime: "9:00", endTime: "10:15", note: "Ôn thi" } });
  check("PUT đổi thứ + giờ + ghi chú một lần", u.status === 200 && u.json.dayOfWeek === 4 && u.json.startTime === "09:00" && u.json.endTime === "10:15" && u.json.note === "Ôn thi", u.json);
  u = await api("PATCH", `/api/class-schedules/${p1.id}`, { as: A, body: { dayOfWeek: 5, startTime: "13:00", endTime: "14:00", note: "Ôn thi 2" } });
  const rowP = await prisma.classSchedule.findUniqueOrThrow({ where: { id: p1.id } });
  check("PATCH ≡ PUT: cùng hợp đồng, cùng kết quả", u.status === 200 && rowP.dayOfWeek === 5 && rowP.startTime === "13:00" && rowP.endTime === "14:00" && rowP.note === "Ôn thi 2");
  u = await api("PUT", `/api/class-schedules/${p1.id}`, { as: A, body: { endTime: "12:00" } });
  check("chỉ endTime nhỏ hơn startTime ĐANG LƯU → 400 và giữ nguyên", u.status === 400 && (await prisma.classSchedule.findUniqueOrThrow({ where: { id: p1.id } })).endTime === "14:00");
  u = await api("PATCH", `/api/class-schedules/${p1.id}`, { as: A, body: { startTime: "15:00" } });
  check("PATCH: chỉ startTime lớn hơn endTime đang lưu → 400", u.status === 400);
  check("dayOfWeek 7 / '2' → 400 hoặc bỏ qua, KHÔNG đổi thứ", await (async () => { const a = await api("PUT", `/api/class-schedules/${p1.id}`, { as: A, body: { dayOfWeek: 7 } }); const b = await api("PUT", `/api/class-schedules/${p1.id}`, { as: A, body: { dayOfWeek: "2" } }); return a.status === 400 && b.status !== 500 && (await prisma.classSchedule.findUniqueOrThrow({ where: { id: p1.id } })).dayOfWeek === 5; })());
  u = await api("PUT", `/api/class-schedules/${p1.id}`, { as: A, body: { note: "x".repeat(201) } });
  check("note 201 ký tự → 400 'tối đa 200', giữ nguyên ghi chú cũ", u.status === 400 && /200/.test(u.json.error) && (await prisma.classSchedule.findUniqueOrThrow({ where: { id: p1.id } })).note === "Ôn thi 2", u.json);
  u = await api("PATCH", `/api/class-schedules/${p1.id}`, { as: A, body: { note: "x".repeat(200) } });
  check("note đúng 200 ký tự → 200; note: null xoá ghi chú", u.status === 200 && (await api("PUT", `/api/class-schedules/${p1.id}`, { as: A, body: { note: null } })).json.note === null);
  check("note không phải chữ (5) → 400", (await api("PUT", `/api/class-schedules/${p1.id}`, { as: A, body: { note: 5 } })).status === 400);
  u = await api("PUT", `/api/class-schedules/${p1.id}`, { as: A, body: { active: false } });
  const list = await api("GET", `/api/courses/${cP.id}/class-schedules`, { as: A });
  check("active:false → khung vẫn còn trong GET (không mất id); active:true bật lại cùng id", u.status === 200 && list.json.some((x: any) => x.id === p1.id && x.active === false) && (await api("PATCH", `/api/class-schedules/${p1.id}`, { as: A, body: { active: true } })).json.id === p1.id);
  // trùng giờ
  const cQ = await mkCourse(A.id, { name: "Lớp khác của cô" });
  await prisma.classSchedule.create({ data: { courseId: cQ.id, dayOfWeek: 3, startTime: "18:00", endTime: "19:00" } });
  const stu2 = await mkUser({ name: "Em Chung" });
  await prisma.enrollment.createMany({ data: [{ userId: stu2.id, courseId: cQ.id, status: "active" }, { userId: stu2.id, courseId: cP.id, status: "active" }] });
  u = await api("PUT", `/api/class-schedules/${p1.id}`, { as: A, body: { dayOfWeek: 3, startTime: "18:30", endTime: "19:30", checkConflicts: true } });
  check("trùng lớp khác của CÙNG gia sư + checkConflicts → 409 needsConfirm, có conflicts[] kèm sharedStudents (SỐ), DB chưa đổi", u.status === 409 && u.json.needsConfirm === true && u.json.conflicts.length >= 1 && u.json.conflicts.some((c: any) => c.sharedStudents === 1) && (await prisma.classSchedule.findUniqueOrThrow({ where: { id: p1.id } })).dayOfWeek === 5, u.json);
  check("TRẺ EM: thân 409 không chứa tên em (chỉ số em chung)", !JSON.stringify(u.json).includes("Em Chung"));
  u = await api("PUT", `/api/class-schedules/${p1.id}`, { as: A, body: { dayOfWeek: 3, startTime: "18:30", endTime: "19:30", checkConflicts: true, force: true } });
  check("force:true → 200 và lưu", u.status === 200 && u.json.dayOfWeek === 3);
  u = await api("PUT", `/api/class-schedules/${p1.id}`, { as: A, body: { dayOfWeek: 3, startTime: "19:00", endTime: "20:00", checkConflicts: true } });
  check("CHẠM ĐẦU (19:00 sau 18:00–19:00) → không trùng, 200", u.status === 200);
  // trùng với lớp của gia sư KHÁC → không báo
  await prisma.classSchedule.create({ data: { courseId: cB.id, dayOfWeek: 6, startTime: "10:00", endTime: "11:00" } });
  u = await api("PUT", `/api/class-schedules/${p1.id}`, { as: A, body: { dayOfWeek: 6, startTime: "10:00", endTime: "11:00", checkConflicts: true } });
  check("trùng giờ với lớp của gia sư KHÁC → KHÔNG báo (không lộ lớp người khác), 200", u.status === 200 && !JSON.stringify(u.json).includes("Lý 8"), u.json);
  const pb = await api("POST", `/api/courses/${cP.id}/schedule-conflicts`, { as: A, body: { dayOfWeek: 6, startTime: "10:00", endTime: "11:00", ignoreScheduleId: p1.id } });
  check("schedule-conflicts: cũng không lộ lớp gia sư khác", pb.status === 200 && pb.json.conflicts.length === 0 && !JSON.stringify(pb.json).includes("Lý 8"), pb.json);
  // trần 14 + note ở POST class-schedules
  const cM = await mkCourse(A.id, { name: "Đủ 14" });
  await prisma.classSchedule.createMany({ data: Array.from({ length: 14 }, (_, i) => ({ courseId: cM.id, dayOfWeek: i % 7, startTime: i < 7 ? "06:00" : "07:00", endTime: i < 7 ? "07:00" : "08:00" })) });
  const over = await api("POST", `/api/courses/${cM.id}/class-schedules`, { as: A, body: S(1, "20:00", "21:00") });
  check("khung thứ 15 của một lớp (POST class-schedules) → 400 'tối đa 14', không thêm", over.status === 400 && /14/.test(over.json.error) && (await prisma.classSchedule.count({ where: { courseId: cM.id } })) === 14, over.json);
  // khung TẮT không tính vào trần: 14 bật + 3 tắt vẫn thêm được 1 khung tắt?? -> không: thêm là bật; xoá bớt bật rồi test
  const cT = await mkCourse(A.id, { name: "13 bật 3 tắt" });
  await prisma.classSchedule.createMany({ data: [
    ...Array.from({ length: 13 }, (_, i) => ({ courseId: cT.id, dayOfWeek: i % 7, startTime: i < 7 ? "06:00" : "07:00", endTime: i < 7 ? "07:00" : "08:00" })),
    ...Array.from({ length: 3 }, (_, i) => ({ courseId: cT.id, dayOfWeek: 0, startTime: `1${i}:00`, endTime: `1${i}:30`, active: false })),
  ] });
  const okT = await api("POST", `/api/courses/${cT.id}/class-schedules`, { as: A, body: S(2, "20:00", "21:00") });
  check("13 bật + 3 tắt (16 dòng) → thêm khung bật thứ 14 được (201)", okT.status === 201 && (await prisma.classSchedule.count({ where: { courseId: cT.id, active: true } })) === 14, okT.json);
  const overT = await api("POST", `/api/courses/${cT.id}/class-schedules`, { as: A, body: S(3, "20:00", "21:00") });
  check("đủ 14 bật (còn 3 tắt) → khung bật thứ 15 bị 400", overT.status === 400 && /14/.test(overT.json.error), overT.json);
  const oldMany = await mkCourse(A.id, { name: "Lớp cũ nhiều khung" });
  await prisma.classSchedule.createMany({ data: Array.from({ length: 16 }, (_, i) => ({ courseId: oldMany.id, dayOfWeek: i % 7, startTime: `${String(5 + Math.floor(i / 7)).padStart(2, "0")}:00`, endTime: `${String(5 + Math.floor(i / 7)).padStart(2, "0")}:30` })) });
  const oldRow = await prisma.classSchedule.findFirstOrThrow({ where: { courseId: oldMany.id } });
  check("dữ liệu CŨ vượt trần không bị đụng: vẫn sửa/tắt được khung hiện có", (await api("PUT", `/api/class-schedules/${oldRow.id}`, { as: A, body: { note: "ok" } })).status === 200);
  const nt = await api("POST", `/api/courses/${cP.id}/class-schedules`, { as: A, body: S(1, "20:00", "21:00", { note: "x".repeat(201) }) });
  check("POST class-schedules: note 201 ký tự → 400; dayOfWeek 2.5 → 400", nt.status === 400 && (await api("POST", `/api/courses/${cP.id}/class-schedules`, { as: A, body: S(2.5, "20:00", "21:00") })).status === 400);

  // ── 5. GET /api/tutor/khung-gio ───────────────────────────────────────────
  section("GET /api/tutor/khung-gio: chỉ khung của mình, không joinUrl / học sinh");
  const kg = await api("GET", "/api/tutor/khung-gio", { as: A });
  const txt = JSON.stringify(kg.json);
  check("200, có rules + courses; chỉ lớp của cô Lan (không có lớp của thầy Khác)", kg.status === 200 && Array.isArray(kg.json.rules) && Array.isArray(kg.json.courses) && kg.json.rules.every((x: any) => x.courseName !== cB.name) && !kg.json.courses.some((c: any) => c.id === cB.id), kg.status);
  check("KHÔNG có joinUrl nào (kể cả của chính lớp mình), không tên em, không khung lớp khác", !/joinUrl|meet\.example|SECRET-B|Em An|Em Chung/.test(txt));
  check("Cache-Control: no-store", kg.headers.get("cache-control") === "no-store");
  check("mỗi rule có đủ trường vẽ lưới: id, courseId, courseName, color, dayOfWeek, startTime, endTime, note, mode, location, active", kg.json.rules.length > 0 && kg.json.rules.every((x: any) => ["id", "courseId", "courseName", "color", "dayOfWeek", "startTime", "endTime", "note", "mode", "location", "active"].every(k => k in x)));
  check("courses[].scheduleCount đúng (Đủ 14 → 14; Không lịch → 0)", kg.json.courses.find((c: any) => c.id === cM.id)?.scheduleCount === 14 && kg.json.courses.find((c: any) => c.id === cNo.id)?.scheduleCount === 0);
  await prisma.classSchedule.update({ where: { id: p1.id }, data: { active: false } });
  const inact = await api("GET", `/api/tutor/khung-gio?courseId=${cP.id}`, { as: A });
  const inact2 = await api("GET", `/api/tutor/khung-gio?courseId=${cP.id}&includeInactive=1`, { as: A });
  check("mặc định bỏ khung tắt; includeInactive=1 thì có (active:false)", !inact.json.rules.some((x: any) => x.id === p1.id) && inact2.json.rules.some((x: any) => x.id === p1.id && x.active === false));
  check("?courseId lọc đúng 1 lớp", inact2.json.rules.every((x: any) => x.courseId === cP.id) && inact2.json.courses.length === 1);
  check("courseId của người khác → 403; không có → 404 (đã trong ma trận, kiểm lại)", (await api("GET", `/api/tutor/khung-gio?courseId=${cB.id}`, { as: A })).status === 403 && (await api("GET", `/api/tutor/khung-gio?courseId=khong-co`, { as: A })).status === 404);
  const kgB = await api("GET", "/api/tutor/khung-gio", { as: B });
  check("thầy Khác chỉ thấy lớp của mình (không thấy lớp cô Lan, không joinUrl của mình)", kgB.status === 200 && kgB.json.courses.every((c: any) => c.id === cB.id) && !JSON.stringify(kgB.json).includes("Toán 9") && !JSON.stringify(kgB.json).includes("SECRET-B"));
  check("quản trị trung tâm thấy cả hai gia sư; khách 401, học sinh 403, chờ duyệt 403", (await api("GET", "/api/tutor/khung-gio", { as: ADM })).json.courses.length >= 2 && (await api("GET", "/api/tutor/khung-gio")).status === 401 && (await api("GET", "/api/tutor/khung-gio", { as: STU })).status === 403 && (await api("GET", "/api/tutor/khung-gio", { as: PEND })).status === 403);
  await prisma.classSchedule.update({ where: { id: p1.id }, data: { active: true } });

  // ── 6. Hộp việc noSchedule ────────────────────────────────────────────────
  // LOI-02 F: dòng "chưa có lịch" chỉ sống khi cờ lịch BẬT (NEXT_PUBLIC_KIN_MO_LICH="1"). Các ca gọi thư viện trong tiến trình bật cờ ở đây
  // và gỡ ở cuối mục; máy chủ dev chạy cờ TẮT (mặc định) nên ca gọi /api/tutor/hop-viec kỳ vọng KHÔNG có dòng noSchedule.
  section("Hộp việc: loại noSchedule (cờ lịch bật trong tiến trình test)");
  const flagBefore = process.env.NEXT_PUBLIC_KIN_MO_LICH;
  process.env.NEXT_PUBLIC_KIN_MO_LICH = "1";
  const T = await mkTutor("Cô Hộp"), T2 = await mkTutor("Thầy Hộp");
  const n0 = await loadTutorInboxRaw(T.id);
  check("chưa có lớp → noSchedule = 0, không có dòng", n0.noSchedule.count === 0 && !buildInboxItems(n0, new Date()).some(i => i.id === "noSchedule"));
  const o1 = await mkCourse(T.id, { name: "Lớp mở 1" }), o2 = await mkCourse(T.id, { name: "Lớp mở 2" }), cl = await mkCourse(T.id, { name: "Lớp đã đóng", classStatus: "closed" });
  await mkCourse(T2.id, { name: "Lớp của thầy khác" });
  const n1 = await loadTutorInboxRaw(T.id);
  const it = buildInboxItems(n1, new Date()).find(i => i.id === "noSchedule");
  check("2 lớp MỞ không lịch → count 2; lớp ĐÃ ĐÓNG và lớp của gia sư khác không tính", n1.noSchedule.count === 2 && it?.title === "2 lớp chưa có lịch học", n1.noSchedule);
  check("dòng chỉ tên lớp + liên kết /quan-lop/<id>/lich-hoc; không khẩn", n1.noSchedule.rows.every(x => /^\/lop-cua-toi\/quan-lop\/[^/]+\/lich-hoc$/.test(x.href!)) && n1.noSchedule.rows.map(x => x.title).sort().join() === "Lớp mở 1,Lớp mở 2" && it?.urgent === false);
  check("đếm số đỏ cùng nguồn (loadTutorTodoCounts.noSchedule = 2)", (await loadTutorTodoCounts(T.id)).noSchedule === 2);
  await prisma.classSchedule.create({ data: { courseId: o1.id, dayOfWeek: 1, startTime: "19:00", endTime: "20:00", active: false } });
  check("chỉ có khung TẮT vẫn tính là chưa có lịch (2)", (await loadTutorInboxRaw(T.id)).noSchedule.count === 2);
  await prisma.classSchedule.create({ data: { courseId: o1.id, dayOfWeek: 2, startTime: "19:00", endTime: "20:00" } });
  check("thêm một khung BẬT → còn 1", (await loadTutorInboxRaw(T.id)).noSchedule.count === 1);
  const viaApi = await create({ schedules: [S(3, "19:00", "20:00")] }, T);
  check("tạo lớp qua API kèm khung → không thêm vào noSchedule (vẫn 1); tạo không khung → 2", viaApi.status === 201 && (await loadTutorInboxRaw(T.id)).noSchedule.count === 1 && (await create({}, T)).status === 201 && (await loadTutorInboxRaw(T.id)).noSchedule.count === 2);
  // Ca phá ngược: cờ tắt trong tiến trình ⇒ cùng dữ liệu (2 lớp mở không lịch) mà noSchedule = 0 và không có dòng.
  process.env.NEXT_PUBLIC_KIN_MO_LICH = "0";
  const lichOff = await loadTutorInboxRaw(T.id);
  check("cờ tắt (\"0\") ⇒ cùng 2 lớp không lịch mà noSchedule = 0, không dòng, loadTutorTodoCounts.noSchedule = 0",
    lichOff.noSchedule.count === 0 && !buildInboxItems(lichOff, new Date()).some(i => i.id === "noSchedule") && (await loadTutorTodoCounts(T.id)).noSchedule === 0, lichOff.noSchedule);
  if (flagBefore === undefined) delete process.env.NEXT_PUBLIC_KIN_MO_LICH; else process.env.NEXT_PUBLIC_KIN_MO_LICH = flagBefore;

  // Máy chủ dev chạy cờ TẮT (mặc định): API không có dòng noSchedule; total = Σ số việc của các dòng không `waiting` = số đỏ (loadTutorTodoTotal, cờ tắt).
  const hv = await api("GET", "/api/tutor/hop-viec", { as: T });
  const itemCount = (x: any) => (x.detail?.rows?.length ?? 0) + (x.detail?.more ?? 0);
  const visible = (hv.json?.items ?? []).filter((x: any) => !x.waiting).reduce((s: number, x: any) => s + itemCount(x), 0);
  check("GET /api/tutor/hop-viec (máy chủ cờ tắt) KHÔNG có dòng noSchedule dù có 2 lớp mở không lịch", hv.status === 200 && !hv.json.items.some((x: any) => x.id === "noSchedule"), hv.json?.items?.map((x: any) => x.id));
  const badge = await loadTutorTodoTotal(T.id);
  check("total của API = Σ việc dòng không waiting = số đỏ (loadTutorTodoTotal, cờ tắt)", hv.json.total === visible && hv.json.total === badge, { total: hv.json.total, visible, badge });
  void o2; void cl;

  // ── 7. TIỀN: đổi khung không đổi phí đã chốt ─────────────────────────────
  section("BẤT BIẾN TIỀN: đổi/tắt/xoá khung KHÔNG đổi phí đã chốt, phiếu, số buổi");
  const TF = await mkTutor("Cô Phí");
  const FEE = await api("POST", "/api/courses", { as: TF, body: newBody({ feeMode: "per_session", feeRate: 150_000, schedules: [S(1, "19:00", "20:30"), S(3, "19:00", "20:30")] }) });
  check("tạo lớp theo buổi 150.000 kèm 2 khung → 201", FEE.status === 201 && FEE.json.scheduleCount === 2, FEE.json);
  const fid = FEE.json.id as string;
  const kids = [await mkUser({ name: "Em Phí 1" }), await mkUser({ name: "Em Phí 2" })];
  for (const k of kids) await prisma.enrollment.create({ data: { userId: k.id, courseId: fid, status: "active" } });
  const dates = ["2026-10-05", "2026-10-07", "2026-10-12"];
  for (const dk of dates) {
    const sess = await api("POST", `/api/courses/${fid}/attendance-sessions`, { as: TF, body: { date: dk } });
    await prisma.attendanceSession.update({ where: { id: sess.json.id }, data: { state: "closed", closedAt: new Date(), closedBy: TF.id } });
    const put = await api("PUT", `/api/attendance-sessions/${sess.json.id}`, { as: TF, body: { records: kids.map(k => ({ userId: k.id, status: "present" })) } });
    if (put.status !== 200) check("điểm danh buổi " + dk, false, put.json);
  }
  const inv = await issueInvoice({ tutorId: TF.id, studentId: kids[0].id, yearMonth: "2026-10" });
  const money = async () => JSON.stringify({
    charges: await prisma.feeCharge.findMany({ where: { courseId: fid }, orderBy: { id: "asc" } }),
    invoices: await prisma.tuitionInvoice.findMany({ where: { tutorId: TF.id }, orderBy: { id: "asc" } }),
    sessions: await prisma.attendanceSession.findMany({ where: { courseId: fid }, orderBy: { id: "asc" }, select: { id: true, date: true, state: true, closedAt: true } }),
    records: await prisma.attendanceRecord.count({ where: { session: { courseId: fid } } }),
    rates: await prisma.courseFeeRate.findMany({ where: { courseId: fid }, orderBy: { id: "asc" } }),
    course: await prisma.course.findUniqueOrThrow({ where: { id: fid }, select: { feeMode: true, price: true } }),
  });
  const m0 = await money();
  const nCharges = (await prisma.feeCharge.count({ where: { courseId: fid } }));
  check("trước khi đổi khung: có 6 dòng phí (3 buổi × 2 em × 150.000) và 1 phiếu", nCharges === 6 && inv.ok === true && (await prisma.feeCharge.aggregate({ where: { courseId: fid }, _sum: { amount: true } }))._sum.amount === 900_000, [nCharges, inv]);
  const fs = await prisma.classSchedule.findMany({ where: { courseId: fid }, orderBy: { dayOfWeek: "asc" } });
  const e1 = await api("PUT", `/api/class-schedules/${fs[0].id}`, { as: TF, body: { dayOfWeek: 5, startTime: "08:00", endTime: "09:00" } });
  check("dời khung sang thứ 6 08:00 → 200 và phí/phiếu/buổi đã chốt KHÔNG đổi (so từng dòng)", e1.status === 200 && (await money()) === m0);
  const e2 = await api("PATCH", `/api/class-schedules/${fs[1].id}`, { as: TF, body: { active: false } });
  check("tắt khung → phí đã chốt không đổi", e2.status === 200 && (await money()) === m0);
  const e3 = await api("DELETE", `/api/class-schedules/${fs[0].id}`, { as: TF });
  const e4 = await api("DELETE", `/api/class-schedules/${fs[1].id}`, { as: TF });
  check("xoá HẾT khung → phí đã chốt, phiếu, buổi đã điểm danh KHÔNG đổi", e3.status === 200 && e4.status === 200 && (await prisma.classSchedule.count({ where: { courseId: fid } })) === 0 && (await money()) === m0);
  const e5 = await api("POST", `/api/courses/${fid}/class-schedules`, { as: TF, body: S(2, "07:00", "08:00") });
  check("thêm khung mới sau đó → vẫn không đổi phí đã chốt, không sinh dòng phí mới (phí chỉ sinh khi chốt buổi)", e5.status === 201 && (await money()) === m0);
  const dupFee = await api("POST", `/api/courses/${fid}/duplicate`, { as: TF });
  check("nhân bản lớp tính phí theo buổi: lớp nguồn không đổi; bản sao KHÔNG mang dòng phí nào", dupFee.status === 200 && (await money()) === m0 && (await prisma.feeCharge.count({ where: { courseId: dupFee.json.id } })) === 0);
  check("phá: nếu ai đó xoá một dòng phí thì kiểm 'so từng dòng' PHẢI đỏ (bằng chứng kiểm có răng)", await (async () => { const one = await prisma.feeCharge.findFirstOrThrow({ where: { courseId: fid } }); await prisma.feeCharge.update({ where: { id: one.id }, data: { amount: one.amount + 1 } }); const differs = (await money()) !== m0; await prisma.feeCharge.update({ where: { id: one.id }, data: { amount: one.amount, updatedAt: one.updatedAt } }); return differs && (await money()) === m0; })());

  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
