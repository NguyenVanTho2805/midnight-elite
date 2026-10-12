import { api, mkTutor, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), T2 = await mkTutor("Thầy Khác");
  await prisma.user.updateMany({ where: { id: { in: [T.id, T2.id] } }, data: { tutorVerified: true } });
  const S = await mkUser({ name: "Học sinh" });
  const c1 = await mkCourse(T.id, { name: "Toán 9" }), c2 = await mkCourse(T.id, { name: "Toán 10" }), other = await mkCourse(T2.id, { name: "Lý 9" });
  const put = (id: string, as: any, body: unknown) => api("PUT", `/api/tutor/classes/${id}/zalo-group`, { as, body });

  section("PUT /api/tutor/classes/[id]/zalo-group: quyền");
  check("chưa đăng nhập → 401; học sinh → bị chặn", (await put(c1.id, undefined, { url: "https://zalo.me/g/abcxyz" })).status === 401 && [401, 403].includes((await put(c1.id, S, { url: "https://zalo.me/g/abcxyz" })).status));
  check("lớp của gia sư khác → 404 và KHÔNG bị đổi", (await put(other.id, T, { url: "https://zalo.me/g/abcxyz" })).status === 404 && (await prisma.course.findUnique({ where: { id: other.id } }))?.zaloGroupUrl === null);
  check("lớp không có → 404", (await put("khong-co", T, { url: "https://zalo.me/g/abcxyz" })).status === 404);

  section("Kiểm tra link");
  check("thiếu url → 400", (await put(c1.id, T, {})).status === 400);
  for (const bad of ["http://zalo.me/g/abcxyz", "https://evil.com/g/abcxyz", "https://zalo.me/g/ab", "javascript:alert(1)", 5, ["x"]]) {
    const r = await put(c1.id, T, { url: bad });
    check(`từ chối ${JSON.stringify(bad)}`, r.status === 400 && (await prisma.course.findUnique({ where: { id: c1.id } }))?.zaloGroupUrl === null, r.json);
  }
  const ok = await put(c1.id, T, { url: " https://www.zalo.me/g/Abc_xyz/?ref=1 " });
  check("hợp lệ → 200, lưu bản đã CHUẨN HOÁ (bỏ www, / cuối, tham số)", ok.status === 200 && ok.json?.url === "https://zalo.me/g/Abc_xyz" && (await prisma.course.findUnique({ where: { id: c1.id } }))?.zaloGroupUrl === "https://zalo.me/g/Abc_xyz", ok.json);
  check("lớp thứ hai độc lập", (await put(c2.id, T, { url: "https://zalo.me/g/lop10abc" })).status === 200 && (await prisma.course.findUnique({ where: { id: c1.id } }))?.zaloGroupUrl === "https://zalo.me/g/Abc_xyz");
  check("url rỗng / null → gỡ link", (await put(c2.id, T, { url: "" })).json?.url === null && (await prisma.course.findUnique({ where: { id: c2.id } }))?.zaloGroupUrl === null && (await put(c1.id, T, { url: null })).status === 200 && (await prisma.course.findUnique({ where: { id: c1.id } }))?.zaloGroupUrl === null);
  check("có nhật ký thao tác", (await prisma.auditLog.count({ where: { action: "class.zalo_group" } })) >= 3);
  await put(c1.id, T, { url: "https://zalo.me/g/Abc_xyz" });

  section("Lịch tuần: mỗi buổi mang link nhóm của lớp");
  await prisma.classSchedule.create({ data: { courseId: c1.id, dayOfWeek: 4, startTime: "19:00", endTime: "20:30", active: true } });
  await prisma.classSchedule.create({ data: { courseId: c2.id, dayOfWeek: 4, startTime: "21:00", endTime: "22:00", active: true } });
  await prisma.enrollment.create({ data: { userId: S.id, courseId: c1.id, status: "active" } });
  const d = new Date(); const dk = (n: number) => { const x = new Date(Date.now() + n * 86400_000 + 7 * 3600_000); return x.toISOString().slice(0, 10); };
  const sch = await api("GET", `/api/tutor/schedule?from=${dk(0)}&to=${dk(6)}`, { as: T });
  const occ = sch.json?.occurrences ?? [];
  check("200 và có buổi", sch.status === 200 && occ.length === 2, sch.json);
  check("buổi Toán 9 có zaloGroupUrl; buổi Toán 10 (đã gỡ) là null", occ.find((o: any) => o.courseName === "Toán 9")?.zaloGroupUrl === "https://zalo.me/g/Abc_xyz" && occ.find((o: any) => o.courseName === "Toán 10")?.zaloGroupUrl === null);

  section("Buổi điểm danh: trả link nhóm cho giao diện");
  const ses = await prisma.attendanceSession.create({ data: { courseId: c1.id, date: new Date("2026-09-17T00:00:00Z"), createdBy: T.id } });
  const g = await api("GET", `/api/attendance-sessions/${ses.id}`, { as: T });
  check("course.zaloGroupUrl có trong phản hồi", g.status === 200 && g.json?.course?.zaloGroupUrl === "https://zalo.me/g/Abc_xyz" && g.json?.course?.name === "Toán 9", g.json?.course);
  check("gia sư khác không đọc được (403)", (await api("GET", `/api/attendance-sessions/${ses.id}`, { as: T2 })).status === 403);

  section("Hồ sơ công khai: Messenger do gia sư tự nhập");
  const prof = async () => (await api("GET", `/api/tutors/${T.id}`)).json?.tutor;
  check("chưa nhập: messenger null", (await prof()).messenger === null);
  check("lưu bằng link dán nguyên → chuẩn hoá về tên trang", (await api("PUT", "/api/users/me/preferences", { as: T, body: { connections: { messenger: "https://m.me/gia.su.lan?ref=abc" } } })).status === 200 && (await prof()).messenger === "gia.su.lan");
  check("tên sai (khoảng trắng, /) → 400, giữ nguyên giá trị cũ", (await api("PUT", "/api/users/me/preferences", { as: T, body: { connections: { messenger: "a b" } } })).status === 400 && (await prof()).messenger === "gia.su.lan");
  check("xoá → null", (await api("PUT", "/api/users/me/preferences", { as: T, body: { connections: { messenger: null } } })).status === 200 && (await prof()).messenger === null);
  check("messenger không kéo theo lộ số Zalo", (await prof()).zalo === null);
  done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
