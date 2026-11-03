// TUT-002 — POST /api/invites/[code]/redeem: người đang nộp đơn gia sư (role student + tutorAppliedAt, chưa duyệt,
// chưa bị từ chối) bị 403 { code: "TUTOR_PENDING" } TRƯỚC mọi truy vấn mã mời — usedCount, Enrollment, auditLog không đổi.
// Học sinh thường / bị từ chối vẫn vào được; GET by-code (xem trước) cũng 403 cho người pending (BU-01 PR 103 dùng chung cổng học sinh với redeem — đã đổi so với TUT-002 gốc); admin thêm thủ công (đường GIỮ #3) vẫn 200.
// Mô hình kẻ tấn công (tut-test bổ): pending → bị từ chối → redeem lại CÙNG mã thì vào (trạng thái chuyển đúng);
// mã đã thu hồi → pending vẫn 403 TUTOR_PENDING (chặn NGƯỜI trước MÃ, không lộ 410); lớp sĩ số 1 → pending 403 không chiếm
// chỗ, học sinh thường vẫn vào; pending không leo quyền gia sư/quản trị (DELETE/POST/GET mã mời, POST admin/enrollments → 401/403).
// Cần máy chủ dev + DB. Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-tut-002.ts
//
// Ca phá (bẻ X thì ca Y đỏ):
//   - bỏ khối canSelfEnroll ở redeem/route.ts          → "403 + code TUTOR_PENDING", "mã rác 'ab' → 403", "đang chờ: 403" (sĩ số) đỏ
//   - chuyển khối canSelfEnroll xuống SAU findUnique mã → "mã rác 'ab' → vẫn 403 (không phải 400)" và "mã thu hồi → pending 403" đỏ
//   - chuyển khối xuống SAU updateMany usedCount        → "usedCount vẫn 0 (chặn trước transaction)" đỏ
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
  // BU-01 (PR 103): by-code dùng chung cổng học sinh thật với redeem/my-requests → người pending nhận 403 (trước đây 200). Chặt hơn, không lộ tên lớp cho người chưa được vào lớp.
  check("GET by-code (xem trước) 403 cho người pending, không lộ thông tin lớp", pv.status === 403 && pv.json?.status === undefined && !JSON.stringify(pv.json).includes("Lớp"), pv);
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
  // (a) Admin duyệt xong đổi role sang admin/teacher; cookie của P (api{as:P} ký từ P.role = "student", h.ts cookieFor) vẫn là phiên cũ.
  //     POST là yêu cầu GHI → getSession() đối chiếu DB (reconcileSession, NC2-033) đổi session.role = "admin" TRƯỚC khi route chạy
  //     → rơi vào nhánh `session.role !== "student"` (403 không code); khối canSelfEnroll không được chạm tới. Kỳ vọng vẫn là 403 không code.
  await prisma.user.update({ where: { id: P.id }, data: { tutorVerified: true, role: "admin", adminRole: "teacher" } });
  const r7 = await api("POST", `/api/invites/${code}/redeem`, { as: P });
  check("pending được duyệt (DB role admin, phiên cũ student) → 403 không có code", r7.status === 403 && r7.json?.code === undefined, r7);
  // (b) tutorVerified true nhưng role vẫn student (duyệt dở) → 403 not_student, KHÔNG nói "đang chờ duyệt".
  const Q = await mkUser({ name: "Duyệt dở" });
  await prisma.user.update({ where: { id: Q.id }, data: { tutorAppliedAt: new Date(), tutorVerified: true } });
  const r8 = await api("POST", `/api/invites/${code}/redeem`, { as: Q });
  check("approved + role student → 403 không có code, không phải chữ chờ duyệt", r8.status === 403 && r8.json?.code === undefined && r8.json?.error !== ENROLL_TUTOR_PENDING_MESSAGE, r8);
  check("usedCount vẫn 2, P và Q không có Enrollment", (await usedCount(invId)) === 2 && (await enrolls(P.id)) === 0 && (await enrolls(Q.id)) === 0);

  section("Đường GIỮ #3: quản trị thêm thủ công người pending vẫn được");
  const P2 = await mkUser({ name: "Gia sư chờ duyệt 2" });
  await prisma.user.update({ where: { id: P2.id }, data: { tutorAppliedAt: new Date() } });
  const SA = await mkSuper("Quản trị");
  const r9 = await api("POST", `/api/admin/enrollments`, { as: SA, body: { userId: P2.id, courseId: course.id } });
  check("admin POST /api/admin/enrollments → 200", r9.status === 200, r9);
  check("P2 có Enrollment (đặc cách quản trị), usedCount không đổi", (await enrolls(P2.id)) === 1 && (await usedCount(invId)) === 2);

  // ---- tut-test bổ: mô hình kẻ tấn công / cô lập quyền. Dùng mã mời MỚI để không đổi kỳ vọng usedCount của mã đầu. ----
  const mkPending = async (name: string) => {
    const u = await mkUser({ name });
    await prisma.user.update({ where: { id: u.id }, data: { tutorAppliedAt: new Date() } });
    return u;
  };
  const mkInvite = async (courseId: string, body: Record<string, unknown> = { maxUses: 3 }) => {
    const r = await api("POST", `/api/courses/${courseId}/invites`, { as: T, body });
    check(`gia sư tạo mã mời cho ${courseId} → 201`, r.status === 201 && typeof r.json?.code === "string", r);
    return { code: r.json.code as string, id: r.json.id as string };
  };

  section("(a) Pending → bị TỪ CHỐI → redeem lại CÙNG mã thì vào được");
  const inv2 = await mkInvite(course.id);
  const P3 = await mkPending("Chờ duyệt rồi bị từ chối");
  const a1 = await api("POST", `/api/invites/${inv2.code}/redeem`, { as: P3 });
  check("đang chờ: 403 TUTOR_PENDING, usedCount 0", a1.status === 403 && a1.json?.code === "TUTOR_PENDING" && (await usedCount(inv2.id)) === 0, a1);
  await prisma.user.update({ where: { id: P3.id }, data: { tutorRejectedAt: new Date() } });
  const a2 = await api("POST", `/api/invites/${inv2.code}/redeem`, { as: P3 });
  check("sau khi bị từ chối: cùng mã → 200/201 (không cần đăng nhập lại)", a2.status === 200 || a2.status === 201, a2);
  const enP3 = await prisma.enrollment.findUnique({ where: { userId_courseId: { userId: P3.id, courseId: course.id } } });
  check("Enrollment active, usedCount 1, có đủ 2 auditLog redeem+create", enP3?.status === "active" && (await usedCount(inv2.id)) === 1 && (await logs(P3.id)) === 2, enP3);
  const a3 = await api("POST", `/api/invites/${inv2.code}/redeem`, { as: P3 });
  check("redeem lại lần nữa: 200 alreadyEnrolled, không tạo bản ghi trùng", a3.status === 200 && a3.json?.alreadyEnrolled === true && (await enrolls(P3.id)) === 1, a3);

  section("(b) Mã đã thu hồi: pending vẫn 403 TUTOR_PENDING (chặn NGƯỜI trước MÃ), học sinh thường mới thấy 410");
  const inv3 = await mkInvite(course.id, {});
  const rv = await api("DELETE", `/api/invites/${inv3.id}`, { as: T });
  check("gia sư thu hồi mã → 200", rv.status === 200 && rv.json?.ok === true, rv);
  const P4 = await mkPending("Chờ duyệt, thử mã thu hồi");
  const b1 = await api("POST", `/api/invites/${inv3.code}/redeem`, { as: P4 });
  check("pending redeem mã thu hồi → 403 TUTOR_PENDING (không phải 410)", b1.status === 403 && b1.json?.code === "TUTOR_PENDING" && b1.json?.error === ENROLL_TUTOR_PENDING_MESSAGE, b1);
  const S3 = await mkUser({ name: "Em Ba" });
  const b2 = await api("POST", `/api/invites/${inv3.code}/redeem`, { as: S3 });
  check("đối chiếu: học sinh thường redeem mã thu hồi → 410 (lỗi về MÃ)", b2.status === 410, b2);
  check("mã thu hồi: usedCount 0, P4 và S3 không có Enrollment", (await usedCount(inv3.id)) === 0 && (await enrolls(P4.id)) === 0 && (await enrolls(S3.id)) === 0);

  section("(c) Sĩ số 1: pending bị 403 KHÔNG chiếm chỗ, học sinh thường vẫn vào, em thứ hai mới 'Lớp đã đầy'");
  const tiny = await mkCourse(T.id, { name: "Lớp 1 chỗ", capacity: 1 });
  const inv4 = await mkInvite(tiny.id);
  const P5 = await mkPending("Chờ duyệt, thử lớp 1 chỗ");
  const c1 = await api("POST", `/api/invites/${inv4.code}/redeem`, { as: P5 });
  check("pending → 403 TUTOR_PENDING", c1.status === 403 && c1.json?.code === "TUTOR_PENDING", c1);
  const S4 = await mkUser({ name: "Em Bốn" });
  const c2 = await api("POST", `/api/invites/${inv4.code}/redeem`, { as: S4 });
  check("học sinh thường vào chỗ duy nhất → 200/201", c2.status === 200 || c2.status === 201, c2);
  const S5 = await mkUser({ name: "Em Năm" });
  const c3 = await api("POST", `/api/invites/${inv4.code}/redeem`, { as: S5 });
  check("em thứ hai → 409 'Lớp đã đầy' (chứng tỏ sĩ số 1 có hiệu lực thật)", c3.status === 409 && /đầy/.test(String(c3.json?.error)), c3);
  const activeTiny = await prisma.enrollment.count({ where: { courseId: tiny.id, status: "active" } });
  check("lớp có đúng 1 Enrollment active (của S4), P5 không có; usedCount 1 (lượt của 403/409 không bị tiêu)",
    activeTiny === 1 && (await enrolls(S4.id)) === 1 && (await enrolls(P5.id)) === 0 && (await usedCount(inv4.id)) === 1);

  section("(d) Pending không leo quyền gia sư/quản trị qua API mã mời và ghi danh");
  const d1 = await api("DELETE", `/api/invites/${inv2.id}`, { as: P5 });
  check("pending DELETE /api/invites/[id] → 401/403", d1.status === 401 || d1.status === 403, d1);
  check("mã không bị thu hồi", (await prisma.classInvite.findUnique({ where: { id: inv2.id } }))?.revoked === false);
  const d2 = await api("POST", `/api/courses/${course.id}/invites`, { as: P5, body: { maxUses: 3 } });
  check("pending POST /api/courses/[id]/invites (tạo mã) → 401/403", d2.status === 401 || d2.status === 403, d2);
  const d3 = await api("GET", `/api/courses/${course.id}/invites`, { as: P5 });
  check("pending GET /api/courses/[id]/invites (xem danh sách mã) → 401/403", d3.status === 401 || d3.status === 403, d3);
  check("lớp vẫn đúng 3 mã mời (inv đầu, inv2, inv3)", (await prisma.classInvite.count({ where: { courseId: course.id } })) === 3);
  const d4 = await api("POST", `/api/admin/enrollments`, { as: P5, body: { userId: P5.id, courseId: course.id } });
  check("pending tự POST /api/admin/enrollments cho mình → 401/403", d4.status === 401 || d4.status === 403, d4);
  const d5 = await api("DELETE", `/api/admin/enrollments`, { as: P5, body: { userId: S.id, courseId: course.id } });
  check("pending DELETE /api/admin/enrollments đuổi em khác → 401/403, S vẫn còn ghi danh", (d5.status === 401 || d5.status === 403) && (await enrolls(S.id)) === 1, d5);
  check("P5 vẫn không có Enrollment nào", (await enrolls(P5.id)) === 0);

  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
