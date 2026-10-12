import { api, mkTutor, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";

(async () => {
  await wipe();
  const tutor = await mkTutor("Cô Lan");
  const other = await mkTutor("Thầy Khác");
  const course = await mkCourse(tutor.id, { name: "Toán 9" });
  const s1 = await mkUser({ name: "Em Một" }), s2 = await mkUser({ name: "Em Hai" }), s3 = await mkUser({ name: "Em Ba" });
  await prisma.enrollment.create({ data: { userId: s1.id, courseId: course.id, status: "active" } });
  await prisma.enrollment.create({ data: { userId: s2.id, courseId: course.id, status: "active" } });
  await prisma.enrollment.create({ data: { userId: s3.id, courseId: course.id, status: "pending_consent" } });

  section("FE-147: sức chứa + trạng thái lớp qua PUT /api/courses/[id]");
  const put = (body: object, as = tutor) => api("PUT", `/api/courses/${course.id}`, { as, body });
  let r = await put({ capacity: 1 });
  check("hạ sức chứa dưới số đang học (2) → 400", r.status === 400 && /2 học viên/.test(r.json?.error ?? ""), r);
  r = await put({ capacity: 2 });
  check("đặt đúng bằng số đang học → 200", r.status === 200 && r.json?.capacity === 2, r);
  r = await put({ capacity: -1 });
  check("số âm → 400", r.status === 400, r);
  r = await put({ capacity: 2.5 });
  check("số thập phân → 400", r.status === 400, r);
  r = await put({ capacity: "10" });
  check("chuỗi → 400", r.status === 400, r);
  r = await put({ capacity: null });
  check("null = không giới hạn → 200", r.status === 200 && r.json?.capacity === null, r);
  r = await put({ classStatus: "paused" });
  check("classStatus paused → 200", r.status === 200 && r.json?.classStatus === "paused", r);
  r = await put({ classStatus: "bogus" });
  check("classStatus sai → 400", r.status === 400, r);
  r = await put({ classStatus: "closed" }, other);
  check("gia sư khác không sửa được → 403", r.status === 403, r);
  const g = await api("GET", `/api/courses/${course.id}`, { as: tutor });
  check("GET trả capacity + classStatus (admin page đọc được)", g.status === 200 && "capacity" in g.json && g.json.classStatus === "paused", g.json && { c: g.json.capacity, s: g.json.classStatus });

  section("Enforce ở cửa vào: lớp tạm dừng/đóng/đầy chặn người mới");
  const inv = await api("POST", `/api/courses/${course.id}/invites`, { as: tutor, body: { maxUses: 10 } });
  const code = inv.json.code;
  const n1 = await mkUser({ name: "Mới 1" });
  let rd = await api("POST", `/api/invites/${code}/redeem`, { as: n1 });
  check("lớp paused → không vào được", rd.status >= 400, rd);
  await put({ classStatus: "open", capacity: 2 });
  rd = await api("POST", `/api/invites/${code}/redeem`, { as: n1 });
  check("lớp đầy (2/2 đang học) → không vào được", rd.status >= 400, rd);
  await put({ capacity: 3 });
  rd = await api("POST", `/api/invites/${code}/redeem`, { as: n1 });
  check("còn chỗ + open → vào được", rd.status === 200 || rd.status === 201, rd);

  section("FE-149: danh sách học viên có status");
  const st = await api("GET", `/api/courses/${course.id}/students`, { as: tutor });
  const by = Object.fromEntries((st.json?.students ?? []).map((s: any) => [s.name, s.status]));
  check("Em Một active", by["Em Một"] === "active", by);
  check("Em Ba pending_consent", by["Em Ba"] === "pending_consent", by);
  check("tổng 4 (3 + người mới)", st.json?.total === 4, st.json?.total);

  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
