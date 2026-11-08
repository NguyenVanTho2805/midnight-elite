import { api, mkTutor, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";

(async () => {
  await wipe();
  const tutor = await mkTutor("Cô Lan");
  const other = await mkTutor("Thầy Khác");
  const stu = await mkUser({ name: "Em Học" });

  section("Tạo lớp trực tiếp trong DB (route tạo lớp có nhiều ràng buộc không liên quan)");
  const course = await mkCourse(tutor.id, { name: "Toán 9" });

  section("Gia sư tạo mã mời");
  const c = await api("POST", `/api/courses/${course.id}/invites`, { as: tutor, body: { maxUses: 2 } });
  check("201 + có code 8 ký tự", c.status === 201 && c.json?.code?.length === 8, c);
  const code = c.json.code, invId = c.json.id;
  const noAuth = await api("POST", `/api/courses/${course.id}/invites`, { body: {} });
  check("không đăng nhập → 401", noAuth.status === 401, noAuth);
  const wrong = await api("POST", `/api/courses/${course.id}/invites`, { as: other, body: {} });
  check("gia sư KHÁC lớp → 403", wrong.status === 403, wrong);

  section("Học viên xem trước + nhập mã (đúng route đã sửa slug)");
  const pv = await api("GET", `/api/invites/by-code/${code}`, { as: stu });
  check("xem trước 200", pv.status === 200, pv);
  const rd = await api("POST", `/api/invites/${code}/redeem`, { as: stu });
  check("redeem 200/201", rd.status === 200 || rd.status === 201, rd);
  const en = await prisma.enrollment.findUnique({ where: { userId_courseId: { userId: stu.id, courseId: course.id } } });
  check("có Enrollment active", en?.status === "active", en);
  const rd2 = await api("POST", `/api/invites/${code}/redeem`, { as: stu });
  check("nhập lại cùng mã: không tạo bản ghi trùng", (await prisma.enrollment.count({ where: { courseId: course.id } })) === 1, rd2);

  section("Thu hồi mã (DELETE /api/invites/[id])");
  const del = await api("DELETE", `/api/invites/${invId}`, { as: tutor });
  check("thu hồi 200", del.status === 200 && del.json?.ok === true, del);
  const del2 = await api("DELETE", `/api/invites/${invId}`, { as: other });
  check("gia sư khác không thu hồi được → 403", del2.status === 403, del2);
  const stu2 = await mkUser({ name: "Em Hai" });
  const rd3 = await api("POST", `/api/invites/${code}/redeem`, { as: stu2 });
  check("mã đã thu hồi không dùng được", rd3.status >= 400, rd3);

  section("Mã lớp có sẵn (ensure:true) — Cách học sinh vào lớp");
  const c2 = await mkCourse(tutor.id, { name: "Lý 9" });
  const e1 = await api("POST", `/api/courses/${c2.id}/invites`, { as: tutor, body: { ensure: true } });
  check("ensure lần 1 → 201, mã 8 ký tự, không giới hạn lượt, không hết hạn", e1.status === 201 && e1.json?.code?.length === 8 && e1.json.maxUses === null && e1.json.expiresAt === null && e1.json.kind === "class", e1);
  const e2 = await api("POST", `/api/courses/${c2.id}/invites`, { as: tutor, body: { ensure: true } });
  check("ensure lần 2 → 200, CÙNG mã, existing:true", e2.status === 200 && e2.json?.id === e1.json.id && e2.json.code === e1.json.code && e2.json.existing === true, e2);
  const par = await Promise.all([1, 2, 3].map(() => api("POST", `/api/courses/${c2.id}/invites`, { as: tutor, body: { ensure: true } })));
  check("ba lần gọi cùng lúc vẫn chỉ một mã", par.every(x => x.json?.id === e1.json.id) && (await prisma.classInvite.count({ where: { courseId: c2.id, kind: "class" } })) === 1, par.map(x => x.status));
  const ax = await prisma.auditLog.count({ where: { action: "class_invite.create", resourceId: e1.json.id } });
  check("AuditLog ghi đúng một lần tạo", ax === 1, ax);
  check("ensure: gia sư KHÁC lớp → 403; không đăng nhập → 401", (await api("POST", `/api/courses/${c2.id}/invites`, { as: other, body: { ensure: true } })).status === 403 && (await api("POST", `/api/courses/${c2.id}/invites`, { body: { ensure: true } })).status === 401);
  const lim = await api("POST", `/api/courses/${c2.id}/invites`, { as: tutor, body: { maxUses: 5 } });
  check("mã có giới hạn tạo thêm vẫn được (không đụng mã lớp), ensure sau đó vẫn trả mã lớp cũ", lim.status === 201 && (await api("POST", `/api/courses/${c2.id}/invites`, { as: tutor, body: { ensure: true } })).json?.id === e1.json.id);
  await api("DELETE", `/api/invites/${e1.json.id}`, { as: tutor });
  const e3 = await api("POST", `/api/courses/${c2.id}/invites`, { as: tutor, body: { ensure: true } });
  check("mã lớp đã thu hồi → ensure tạo mã MỚI (khác mã cũ)", e3.status === 201 && e3.json.id !== e1.json.id, e3);

  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
