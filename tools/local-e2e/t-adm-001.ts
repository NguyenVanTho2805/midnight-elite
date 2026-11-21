// ADM-001 (API + DB thật) — thao tác quản trị để lại dấu vết và không xoá mất dữ liệu học sinh.
// (SCL F1: phần Tin tức đã xoá, ca 1–8 và 19 bỏ.)
// Học sinh: DELETE = ẨN (deletedAt + banned), còn lớp active → 409, không cascade; restore; danh sách lọc + SBD không nhảy; ban / ghi danh / tạo trùng bị chặn khi đã ẩn.
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-adm-001.ts  (sau khi `prisma db push` + `prisma generate` + khởi động lại Next dev).
//
// CA PHÁ CỐ Ý (adm-test chạy tay, mỗi lần một thứ, rồi hoàn lại):
//   - Đổi `prisma.user.update` ở DELETE students/[id] về `prisma.user.delete` → ca 10 đỏ ("bản ghi User còn").
//   - Bỏ `banned: true` khỏi data của DELETE → ca 12 đỏ (đăng nhập không còn bị 403).
//   - Bỏ kiểm `user.role !== "student"` → ca 17 đỏ (gia sư / quản trị bị ẩn).
import { prisma } from "@/lib/prisma";
import { api, mkUser, mkTutor, mkSuper, mkCourse, wipe, check, section, done } from "./h";

const audits = (where: Record<string, unknown> = {}) => prisma.auditLog.findMany({ where, orderBy: { createdAt: "asc" } });
const auditCount = () => prisma.auditLog.count();
const noPII = (meta: unknown, ...needles: string[]) => { const s = JSON.stringify(meta ?? {}); return !needles.some(n => n && s.includes(n)); };

(async () => {
  await wipe();
  const SA = await mkSuper("Quản trị Hà");
  const CA = await mkUser({ name: "Biên tập Bình", role: "admin", adminRole: "admin_content" });
  const T = await mkTutor("Cô Lan");
  const S1 = await mkUser({ name: "Nguyễn Bé Bí Mật" }), S2 = await mkUser({ name: "Trần Bé Hai" });
  const C = await mkCourse(T.id, { name: "Toán 9 Lan" }), C2 = await mkCourse(T.id, { name: "Lý 9 Lan" });

  // SCL F1 (Q8): phần Tin tức (/api/admin/articles) đã xoá — các ca 1–8 bỏ cùng route.
  let r: Awaited<ReturnType<typeof api>>;
  let before = 0;

  section("Ẩn học sinh: không xoá dữ liệu, chặn khi còn lớp đang học");
  // 9
  await prisma.enrollment.create({ data: { userId: S1.id, courseId: C.id, status: "active" } });
  before = await auditCount();
  r = await api("DELETE", `/api/admin/students/${S1.id}`, { as: SA });
  let s1 = await prisma.user.findUnique({ where: { id: S1.id } });
  check("9. còn lớp active → 409 code active_enrollments, activeCount 1; S1 còn, deletedAt null, banned false; không audit", r.status === 409 && r.json.code === "active_enrollments" && r.json.activeCount === 1 && /1 lớp đang học/.test(r.json.error) && s1 && s1.deletedAt === null && s1.banned === false && (await auditCount()) === before, r.json);
  // 10
  await prisma.enrollment.create({ data: { userId: S1.id, courseId: C2.id, status: "pending_consent" } });
  const rv = await api("DELETE", "/api/admin/enrollments", { as: SA, body: { userId: S1.id, courseId: C.id } });
  r = await api("DELETE", `/api/admin/students/${S1.id}`, { as: SA });
  s1 = await prisma.user.findUnique({ where: { id: S1.id } });
  const pend = await prisma.enrollment.findMany({ where: { userId: S1.id } });
  const hide = await audits({ action: "student.hide" });
  check("10a. thu hồi lớp active rồi DELETE → 200 { ok, deletedAt }", rv.status === 200 && r.status === 200 && r.json.ok === true && !Number.isNaN(new Date(r.json.deletedAt).getTime()), r.json);
  check("10b. bản ghi User CÒN; deletedAt != null; banned === true", s1 !== null && s1!.deletedAt !== null && s1!.banned === true, s1 && { deletedAt: s1.deletedAt, banned: s1.banned });
  check("10c. ghi danh pending_consent CÒN (không cascade)", pend.length === 1 && pend[0].status === "pending_consent" && pend[0].courseId === C2.id, pend);
  check("10d. 1 dòng student.hide: actorId SA, resourceType User, resourceId S1, metadata.otherEnrollments 1, activeEnrollments 0, wasBanned false, không tên/email",
    hide.length === 1 && hide[0].actorId === SA.id && hide[0].resourceType === "User" && hide[0].resourceId === S1.id && (hide[0].metadata as { otherEnrollments?: number; activeEnrollments?: number; wasBanned?: boolean })?.otherEnrollments === 1 && (hide[0].metadata as { activeEnrollments?: number })?.activeEnrollments === 0 && (hide[0].metadata as { wasBanned?: boolean })?.wasBanned === false && noPII(hide[0].metadata, S1.name, S1.email, "Bí Mật"), hide);
  // 11
  before = await auditCount();
  r = await api("DELETE", `/api/admin/students/${S1.id}`, { as: SA });
  check("11. DELETE lần hai → 200 alreadyHidden kèm deletedAt; audit KHÔNG tăng", r.status === 200 && r.json.alreadyHidden === true && typeof r.json.deletedAt === "string" && (await auditCount()) === before, r.json);
  // 12
  r = await api("POST", "/api/auth/login", { body: { identifier: S1.email, password: "Passw0rd!" } });
  check("12. em đã ẩn đăng nhập → 403 (chặn nhờ banned, không sửa tệp chung)", r.status === 403, [r.status, r.json]);
  // 13
  const list = await api("GET", "/api/admin/students", { as: SA });
  const listAll = await api("GET", "/api/admin/students?includeHidden=1", { as: SA });
  const s2a = list.json.find((x: { id: string }) => x.id === S2.id), s2b = listAll.json.find((x: { id: string }) => x.id === S2.id);
  const s1b = listAll.json.find((x: { id: string }) => x.id === S1.id);
  check("13a. GET students mặc định → không có S1; mọi dòng có trường deletedAt (null)", list.status === 200 && !list.json.some((x: { id: string }) => x.id === S1.id) && list.json.every((x: { deletedAt: unknown }) => x.deletedAt === null), list.json.map((x: { id: string; deletedAt: unknown }) => [x.id, x.deletedAt]));
  check("13b. ?includeHidden=1 → có S1 với deletedAt ISO", listAll.status === 200 && s1b && typeof s1b.deletedAt === "string" && !Number.isNaN(new Date(s1b.deletedAt).getTime()), s1b);
  check("13c. S2 giữ CÙNG sbd ở cả hai lần gọi (SBD không nhảy khi S1 bị ẩn)", s2a && s2b && s2a.sbd === s2b.sbd && /^MD\.\d{5}$/.test(s2a.sbd), [s2a?.sbd, s2b?.sbd]);
  // 14
  r = await api("PATCH", `/api/admin/students/${S1.id}`, { as: SA });
  const enBefore = await prisma.enrollment.count({ where: { userId: S1.id } });
  const en = await api("POST", "/api/admin/enrollments", { as: SA, body: { userId: S1.id, courseId: C.id } });
  check("14a. PATCH toggle ban trên em đã ẩn → 409 code hidden; banned vẫn true", r.status === 409 && r.json.code === "hidden" && (await prisma.user.findUnique({ where: { id: S1.id } }))?.banned === true, r.json);
  check("14b. POST enrollments cho em đã ẩn → 409 code hidden; không có ghi danh mới", en.status === 409 && en.json.code === "hidden" && (await prisma.enrollment.count({ where: { userId: S1.id } })) === enBefore, en.json);
  // 15
  r = await api("POST", "/api/admin/students", { as: SA, body: { name: "Trùng", email: S1.email } });
  check("15. POST students với email của em đã ẩn → 409 code hidden_exists", r.status === 409 && r.json.code === "hidden_exists" && /Khôi phục/.test(r.json.error), r.json);
  // 16
  r = await api("POST", `/api/admin/students/${S1.id}/restore`, { as: SA });
  s1 = await prisma.user.findUnique({ where: { id: S1.id } });
  check("16a. restore → 200; deletedAt null; banned false; 1 dòng student.restore (actor SA, resource User/S1)", r.status === 200 && r.json.ok === true && s1?.deletedAt === null && s1?.banned === false && (await audits({ action: "student.restore" })).filter(x => x.actorId === SA.id && x.resourceType === "User" && x.resourceId === S1.id).length === 1, [r.json, s1?.deletedAt, s1?.banned]);
  before = await auditCount();
  r = await api("POST", `/api/admin/students/${S1.id}/restore`, { as: SA });
  check("16b. restore lần hai → 200 alreadyVisible; không audit thêm", r.status === 200 && r.json.alreadyVisible === true && (await auditCount()) === before, r.json);
  check("16c. restore không có GET/DELETE → 405", (await api("GET", `/api/admin/students/${S1.id}/restore`, { as: SA })).status === 405 && (await api("DELETE", `/api/admin/students/${S1.id}/restore`, { as: SA })).status === 405);
  // 17
  const dT = await api("DELETE", `/api/admin/students/${T.id}`, { as: SA });
  const dSA = await api("DELETE", `/api/admin/students/${SA.id}`, { as: SA });
  const tRow = await prisma.user.findUnique({ where: { id: T.id } });
  check("17a. DELETE gia sư (role admin) → 403 code not_student; T còn nguyên (deletedAt null, banned false)", dT.status === 403 && dT.json.code === "not_student" && tRow && tRow.deletedAt === null && tRow.banned === false, dT.json);
  check("17b. DELETE chính quản trị → 403 not_student; DELETE id không có → 404", dSA.status === 403 && dSA.json.code === "not_student" && (await api("DELETE", "/api/admin/students/khong-co", { as: SA })).status === 404, dSA.json);
  check("17c. restore gia sư → 403 not_student; restore id không có → 404", (await api("POST", `/api/admin/students/${T.id}/restore`, { as: SA })).json?.code === "not_student" && (await api("POST", "/api/admin/students/khong-co/restore", { as: SA })).status === 404);
  // 18
  before = await auditCount();
  const noPerm = [await api("DELETE", `/api/admin/students/${S2.id}`, { as: CA }), await api("DELETE", `/api/admin/students/${S2.id}`, { as: T }), await api("DELETE", `/api/admin/students/${S2.id}`, { as: S2 }), await api("POST", `/api/admin/students/${S2.id}/restore`, { as: CA })];
  const noCookie = [await api("DELETE", `/api/admin/students/${S2.id}`), await api("POST", `/api/admin/students/${S2.id}/restore`)];
  const s2row = await prisma.user.findUnique({ where: { id: S2.id } });
  check("18. admin_content / gia sư / chính em → 403; không cookie → 401; S2 không đổi; không dòng audit nào thêm", noPerm.every(x => x.status === 403) && noCookie.every(x => x.status === 401) && s2row?.deletedAt === null && s2row?.banned === false && (await auditCount()) === before, [noPerm.map(x => x.status), noCookie.map(x => x.status)]);
  // 20 — remind-all (4.9a): bản ẩn không có ghi danh active nên không nhận nhắc; xác nhận không sửa vẫn an toàn
  await prisma.enrollment.create({ data: { userId: S2.id, courseId: C.id, status: "active" } });
  r = await api("POST", "/api/admin/remind-all", { as: SA, body: { message: "Nhắc học nhé", courseId: C.id } });
  check("20. remind-all lớp C: total = 1 (chỉ S2; S1 đã ẩn và không còn ghi danh active)", r.status === 200 && r.json.total === 1, r.json);

  await done();
})().catch(e => { console.error("CRASH", e); process.exit(1); });
