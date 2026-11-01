// TUT-002 — POST /api/invites/[code]/redeem: người đang nộp đơn gia sư (role student + tutorAppliedAt, chưa duyệt,
// chưa bị từ chối) bị 403 { code: "TUTOR_PENDING" } TRƯỚC mọi truy vấn mã mời — usedCount, Enrollment, auditLog không đổi.
// Học sinh thường / bị từ chối vẫn vào được; GET by-code (xem trước) giữ 200; admin thêm thủ công (đường GIỮ #3) vẫn 200.
// Cần máy chủ dev + DB. Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-tut-002.ts
import { prisma } from "@/lib/prisma";
import { ENROLL_TUTOR_PENDING_MESSAGE } from "@/lib/enrollEligibility";
import { api, mkTutor, mkUser, mkCourse, mkSuper, wipe, check, section, done } from "./h";

const REDEEM_ACTIONS = ["class_invite.redeem", "enrollment.create"];
const usedCount = async (id: string) => (await prisma.classInvite.findUnique({ where: { id } }))?.usedCount;
const enrolls = (userId: string) => prisma.enrollment.count({ where: { userId } });
// logAction ghi vào AuditLog.actorId (src/lib/auditLog.ts).
const logs = (userId: string) => prisma.auditLog.count({ where: { actorId: userId, action: { in: REDEEM_ACTIONS } } });

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");
  const course = await mkCourse(T.id, { name: "Toán 9" });
  const c = await api("POST", `/api/courses/${course.id}/invites`, { as: T, body: { maxUses: 3 } });
  check("gia sư tạo mã mời 201", c.status === 201 && typeof c.json?.code === "string", c);
  const code: string = c.json.code, invId: string = c.json.id;

  // Người pending: mkUser không có tuỳ chọn tutorAppliedAt → update riêng (như t-admin-queue.ts), KHÔNG gọi register-tutor.
  const P = await mkUser({ name: "Gia sư chờ duyệt" });
  await prisma.user.update({ where: { id: P.id }, data: { tutorAppliedAt: new Date() } });

  section("Người đang chờ duyệt gia sư redeem");
  const r1 = await api("POST", `/api/invites/${code}/redeem`, { as: P });
  check("403 + code TUTOR_PENDING", r1.status === 403 && r1.json?.code === "TUTOR_PENDING", r1);
  check("error đúng từng chữ ENROLL_TUTOR_PENDING_MESSAGE", r1.json?.error === ENROLL_TUTOR_PENDING_MESSAGE, r1.json);
  check("usedCount vẫn 0 (chặn trước transaction)", (await usedCount(invId)) === 0);
  check("không có Enrollment cho người pending", (await enrolls(P.id)) === 0);
  check("không có auditLog class_invite.redeem / enrollment.create", (await logs(P.id)) === 0);
  const r2 = await api("POST", `/api/invites/ab/redeem`, { as: P });
  check("mã rác 'ab' → vẫn 403 TUTOR_PENDING (chặn người trước chặn mã, không phải 400)", r2.status === 403 && r2.json?.code === "TUTOR_PENDING", r2);
  const pv = await api("GET", `/api/invites/by-code/${code}`, { as: P });
  check("GET by-code (xem trước) giữ 200 status ok cho người pending", pv.status === 200 && pv.json?.status === "ok", pv);
  check("xem trước không chạm usedCount", (await usedCount(invId)) === 0);

  section("Học sinh thường và người bị từ chối vẫn vào được");
  const S = await mkUser({ name: "Em Học" });
  const r3 = await api("POST", `/api/invites/${code}/redeem`, { as: S });
  check("học sinh thường 200/201", r3.status === 200 || r3.status === 201, r3);
  const enS = await prisma.enrollment.findUnique({ where: { userId_courseId: { userId: S.id, courseId: course.id } } });
  check("Enrollment active + usedCount 1", enS?.status === "active" && (await usedCount(invId)) === 1, enS);

  const R = await mkUser({ name: "Gia sư bị từ chối" });
  await prisma.user.update({ where: { id: R.id }, data: { tutorAppliedAt: new Date(Date.now() - 86_400_000), tutorRejectedAt: new Date() } });
  const r4 = await api("POST", `/api/invites/${code}/redeem`, { as: R });
  check("rejected 200/201 (trở lại là học sinh)", r4.status === 200 || r4.status === 201, r4);
  check("rejected có Enrollment + usedCount 2", (await enrolls(R.id)) === 1 && (await usedCount(invId)) === 2);

  section("Hành vi cũ giữ nguyên");
  const r5 = await api("POST", `/api/invites/${code}/redeem`, { as: T });
  check("gia sư (role admin) → 403 không có code", r5.status === 403 && r5.json?.code === undefined, r5);
  const r6 = await api("POST", `/api/invites/${code}/redeem`);
  check("không đăng nhập → 401", r6.status === 401, r6);
  check("usedCount vẫn 2 sau hai ca trên", (await usedCount(invId)) === 2);

  section("Lệch dữ liệu: đã duyệt nhưng phiên/role còn student");
  // (a) Admin duyệt xong đổi role sang admin/teacher; cookie của P vẫn role "student" (phiên cũ) → route đọc DB thấy role admin → not_student.
  await prisma.user.update({ where: { id: P.id }, data: { tutorVerified: true, role: "admin", adminRole: "teacher" } });
  const r7 = await api("POST", `/api/invites/${code}/redeem`, { as: P });
  check("pending được duyệt (DB role admin, phiên cũ student) → 403 không có code", r7.status === 403 && r7.json?.code === undefined, r7);
  // (b) tutorVerified true nhưng role vẫn student (duyệt dở) → 403 not_student, KHÔNG nói "đang chờ duyệt".
  const Q = await mkUser({ name: "Duyệt dở" });
  await prisma.user.update({ where: { id: Q.id }, data: { tutorAppliedAt: new Date(), tutorVerified: true } });
  const r8 = await api("POST", `/api/invites/${code}/redeem`, { as: Q });
  check("approved + role student → 403 không có code, không phải chữ chờ duyệt", r8.status === 403 && r8.json?.code === undefined && r8.json?.error !== ENROLL_TUTOR_PENDING_MESSAGE, r8);
  check("usedCount vẫn 2, Q không có Enrollment", (await usedCount(invId)) === 2 && (await enrolls(Q.id)) === 0);

  section("Đường GIỮ #3: quản trị thêm thủ công người pending vẫn được");
  const P2 = await mkUser({ name: "Gia sư chờ duyệt 2" });
  await prisma.user.update({ where: { id: P2.id }, data: { tutorAppliedAt: new Date() } });
  const SA = await mkSuper("Quản trị");
  const r9 = await api("POST", `/api/admin/enrollments`, { as: SA, body: { userId: P2.id, courseId: course.id } });
  check("admin POST /api/admin/enrollments → 200", r9.status === 200, r9);
  check("P2 có Enrollment (đặc cách quản trị), usedCount không đổi", (await enrolls(P2.id)) === 1 && (await usedCount(invId)) === 2);

  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
