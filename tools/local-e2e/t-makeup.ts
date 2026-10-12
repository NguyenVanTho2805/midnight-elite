import { api, mkTutor, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";

const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const day = (n: number) => new Date(Date.UTC(2026, 9, n)); // 0h UTC ngày n/10/2026 — khớp normalizeAttendanceDate

(async () => {
  await wipe();
  const tutor = await mkTutor("Cô Lan");
  const other = await mkTutor("Thầy Khác");
  const A = await mkUser({ name: "Em An" }), B = await mkUser({ name: "Em Bình" });
  const course = await mkCourse(tutor.id, { name: "Toán 9" });
  for (const u of [A, B]) await prisma.enrollment.create({ data: { userId: u.id, courseId: course.id, status: "active" } });
  const mkAbs = (studentId: string, n: number) => prisma.classAbsence.create({ data: { courseId: course.id, scheduleId: "s", dateKey: `2026-09-${String(n).padStart(2, "0")}`, startAt: new Date(), studentId, reportedBy: "parent", leadMinutes: 600, status: "excused_auto" } });
  const credit = async (studentId: string, n: number, expiresInDays: number) => (await prisma.makeupCredit.create({ data: { studentId, courseId: course.id, absenceId: (await mkAbs(studentId, n)).id, expiresAt: new Date(Date.now() + expiresInDays * 86400_000) } }));
  const cA1 = await credit(A.id, 1, 10), cA2 = await credit(A.id, 2, -1), cB1 = await credit(B.id, 3, 5), cA3 = await credit(A.id, 4, 20);
  const s1 = await prisma.attendanceSession.create({ data: { courseId: course.id, date: day(5), createdBy: tutor.id } });
  const s2 = await prisma.attendanceSession.create({ data: { courseId: course.id, date: day(6), createdBy: tutor.id } });
  const put = (id: string, records: object[], as = tutor) => api("PUT", `/api/attendance-sessions/${id}`, { as, body: { records } });
  const state = async (id: string) => (await prisma.makeupCredit.findUnique({ where: { id } }))!;

  section("Điểm danh hiện buổi bù còn dùng được");
  let g = await api("GET", `/api/attendance-sessions/${s1.id}`, { as: tutor });
  const rosterOf = (j: any, uid: string) => j.roster.find((r: any) => r.userId === uid);
  check("An: 2 buổi bù dùng được (loại buổi đã hết hạn), sắp hết hạn trước", g.status === 200 && eq(rosterOf(g.json, A.id).makeupAvailable.map((c: any) => c.id), [cA1.id, cA3.id]), rosterOf(g.json, A.id));
  check("Bình: 1 buổi bù; chưa dùng buổi nào", rosterOf(g.json, B.id).makeupAvailable.length === 1 && rosterOf(g.json, A.id).makeupUsedId === null);

  section("Dùng buổi bù khi điểm danh");
  let r = await put(s1.id, [{ userId: A.id, status: "present", makeupCreditId: cA1.id }]);
  check("An có mặt + dùng buổi bù → 200", r.status === 200, r);
  let c = await state(cA1.id);
  check("buổi bù chuyển 'used', gắn đúng buổi", c.status === "used" && c.usedSessionId === s1.id && !!c.usedAt, c);
  g = await api("GET", `/api/attendance-sessions/${s1.id}`, { as: tutor });
  check("roster: makeupUsedId = buổi vừa dùng; buổi đã dùng không còn trong danh sách chọn", rosterOf(g.json, A.id).makeupUsedId === cA1.id && !rosterOf(g.json, A.id).makeupAvailable.some((x: any) => x.id === cA1.id));
  check("lưu lại lần nữa cùng buổi bù → vẫn 200 (không báo 'đã dùng' với chính mình)", (await put(s1.id, [{ userId: A.id, status: "late", makeupCreditId: cA1.id }])).status === 200);

  section("Từ chối và hoàn tác trọn gói");
  r = await put(s2.id, [{ userId: B.id, status: "present" }, { userId: A.id, status: "present", makeupCreditId: cA1.id }]);
  check("buổi bù đã dùng ở buổi khác → 400", r.status === 400, r);
  check("cả bản lưu bị hoàn tác (Bình không bị ghi dở)", (await prisma.attendanceRecord.count({ where: { sessionId: s2.id } })) === 0);
  check("buổi bù đã hết hạn → 400", (await put(s2.id, [{ userId: A.id, status: "present", makeupCreditId: cA2.id }])).status === 400);
  check("buổi bù của học viên khác → 400", (await put(s2.id, [{ userId: A.id, status: "present", makeupCreditId: cB1.id }])).status === 400);
  check("buổi bù không tồn tại → 400", (await put(s2.id, [{ userId: A.id, status: "present", makeupCreditId: "khong-co" }])).status === 400);
  check("vắng/có phép mà kèm buổi bù → 400", (await put(s2.id, [{ userId: A.id, status: "absent", makeupCreditId: cA3.id }])).status === 400 && (await put(s2.id, [{ userId: A.id, status: "excused", makeupCreditId: cA3.id }])).status === 400);
  check("sau các lỗi: buổi bù cA3, cB1 vẫn nguyên", (await state(cA3.id)).status === "active" && (await state(cB1.id)).status === "active");
  check("gia sư lớp khác không điểm danh được → 403", (await put(s1.id, [{ userId: A.id, status: "present" }], other)).status === 403);

  section("Hai buổi cùng lúc tranh một buổi bù");
  const rs = await Promise.all([put(s2.id, [{ userId: A.id, status: "present", makeupCreditId: cA3.id }]), put(s1.id, [{ userId: A.id, status: "present", makeupCreditId: cA3.id }])]);
  check("đúng 1 bên được dùng, bên kia 400", rs.filter(x => x.status === 200).length === 1 && rs.filter(x => x.status === 400).length === 1, rs.map(x => x.status));
  const cc = await state(cA3.id);
  check("buổi bù chỉ gắn vào 1 buổi", cc.status === "used" && [s1.id, s2.id].includes(cc.usedSessionId!));

  section("Trả lại buổi bù");
  r = await put(s1.id, [{ userId: A.id, status: "absent" }]);
  c = await state(cA1.id);
  check("đổi An sang vắng → buổi bù của buổi này được trả lại", r.status === 200 && c.status === "active" && c.usedSessionId === null && c.usedAt === null, c);
  await put(s1.id, [{ userId: A.id, status: "present", makeupCreditId: cA1.id }]);
  check("dùng lại được", (await state(cA1.id)).status === "used");
  const del = await api("DELETE", `/api/attendance-sessions/${s1.id}`, { as: tutor });
  check("xoá buổi điểm danh → trả lại buổi bù đã gắn", del.status === 200 && (await state(cA1.id)).status === "active");

  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
