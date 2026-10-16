import { api, mkUser, mkTutor, mkSuper, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";

async function applicant(name: string, emailVerified: boolean) {
  const u = await mkUser({ name, emailVerified });
  await prisma.user.update({ where: { id: u.id }, data: { tutorAppliedAt: new Date(), bio: "Dạy Toán 9 ba năm. ".repeat(20), subjects: ["Toán", "Lý"], city: "Hà Nội" } });
  return u;
}

(async () => {
  await wipe();
  const sup = await mkSuper("Quản lý");
  const teacher = await mkTutor("Gia sư thường");
  const a1 = await applicant("Ứng viên A", true);
  const a2 = await applicant("Ứng viên B (chưa xác thực email)", false);
  const a3 = await applicant("Ứng viên C", true);

  section("Quyền xem danh sách");
  check("ẩn danh → 401", (await api("GET", "/api/admin/tutor-applications")).status === 401);
  check("gia sư thường → 403", (await api("GET", "/api/admin/tutor-applications", { as: teacher })).status === 403);
  const list = await api("GET", "/api/admin/tutor-applications", { as: sup });
  check("quản lý thấy 3 hồ sơ chờ", list.status === 200 && list.json.applications.length === 3, list.json);
  check("trả về bio/subjects/emailVerified", list.json.applications[0].subjects.length === 2 && typeof list.json.applications[0].emailVerified === "boolean");
  check("status sai → 400", (await api("GET", "/api/admin/tutor-applications?status=xyz", { as: sup })).status === 400);

  section("Duyệt");
  const noMail = await api("POST", `/api/admin/tutor-applications/${a2.id}/approve`, { as: sup });
  check("email chưa xác thực → 409 + thông báo", noMail.status === 409 && /email/i.test(noMail.json?.error), noMail);
  const ok = await api("POST", `/api/admin/tutor-applications/${a1.id}/approve`, { as: sup });
  check("duyệt A → 200", ok.status === 200, ok);
  const u1 = await prisma.user.findUnique({ where: { id: a1.id } });
  check("A thành admin/teacher + tutorVerified", u1?.role === "admin" && u1?.adminRole === "teacher" && u1?.tutorVerified === true, u1);
  check("có thông báo cho A", (await prisma.notification.count({ where: { userId: a1.id, type: "tutor_approved" } })) === 1);
  check("thông báo duyệt trỏ vào khung gia sư /lop-cua-toi (không phải cửa cũ /admin)", (await prisma.notification.findFirst({ where: { userId: a1.id, type: "tutor_approved" } }))?.link === "/lop-cua-toi");
  check("có audit tutor.approve", (await prisma.auditLog.count({ where: { action: "tutor.approve", resourceId: a1.id } })) === 1);
  const again = await api("POST", `/api/admin/tutor-applications/${a1.id}/approve`, { as: sup });
  check("duyệt lần 2 → 409", again.status === 409, again);
  const race = await Promise.all([1, 2].map(() => api("POST", `/api/admin/tutor-applications/${a3.id}/approve`, { as: sup })));
  check("2 admin duyệt cùng lúc: đúng 1 thành công", race.filter(r => r.status === 200).length === 1 && race.filter(r => r.status === 409).length === 1, race.map(r => r.status));

  section("Từ chối");
  check("thiếu lý do → 400", (await api("POST", `/api/admin/tutor-applications/${a2.id}/reject`, { as: sup, body: {} })).status === 400);
  check("lý do > 500 ký tự → 400", (await api("POST", `/api/admin/tutor-applications/${a2.id}/reject`, { as: sup, body: { reason: "x".repeat(501) } })).status === 400);
  const rj = await api("POST", `/api/admin/tutor-applications/${a2.id}/reject`, { as: sup, body: { reason: "Chưa nêu kinh nghiệm" } });
  check("từ chối B → 200", rj.status === 200, rj);
  const rejList = await api("GET", "/api/admin/tutor-applications?status=rejected", { as: sup });
  check("danh sách 'từ chối' có B kèm lý do", rejList.json.applications.length === 1 && rejList.json.applications[0].tutorRejectReason === "Chưa nêu kinh nghiệm", rejList.json);
  const apprList = await api("GET", "/api/admin/tutor-applications?status=approved", { as: sup });
  const apprIds = apprList.json.applications.map((x: any) => x.id);
  check("danh sách 'đã duyệt' có A, C (và gia sư đã verified từ đầu)", apprIds.includes(a1.id) && apprIds.includes(a3.id) && apprIds.includes(teacher.id) && apprIds.length === 3, apprIds);
  check("danh sách chờ rỗng", (await api("GET", "/api/admin/tutor-applications", { as: sup })).json.applications.length === 0);

  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
