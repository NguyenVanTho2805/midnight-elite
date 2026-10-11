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

  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
