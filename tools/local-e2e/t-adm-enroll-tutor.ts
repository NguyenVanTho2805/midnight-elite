// ADM D4a (API + DB thật) — POST /api/admin/enrollments không ghi danh tài khoản gia sư làm học viên.
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-adm-enroll-tutor.ts  (máy chủ dev đang chạy ở $BASE)
//
// CA PHÁ CỐ Ý (chạy tay, mỗi lần một thứ, rồi hoàn lại):
//   - Bỏ khối `if (user.role === "admin" && ...)` ở POST enrollments → ca 1 / 2 / 3 đỏ (gia sư vẫn 200, có Enrollment).
//   - Đổi `user.adminRole === "teacher" ||` thành chỉ kiểm tutorVerified → ca 1 đỏ.
//   - Đổi `user.role === "admin" &&` thành bỏ điều kiện role → ca 4b đỏ (học sinh có tutorVerified bị chặn nhầm) — nếu có.
//   - Chuyển khối kiểm xuống dưới upsert/notify → ca 1c đỏ (đã có Enrollment / thông báo).
import { prisma } from "@/lib/prisma";
import { api, mkUser, mkTutor, mkSuper, mkCourse, wipe, check, section, done } from "./h";

const URL_ = "/api/admin/enrollments";
(async () => {
  await wipe();
  const SA = await mkSuper("Quản trị Hà");
  const CA = await mkUser({ name: "Biên tập Bình", role: "admin", adminRole: "admin_content" });
  const owner = await mkTutor("Cô Lan");
  const C = await mkCourse(owner.id, { name: "Toán 9 Lan" });
  const stat = async (userId: string) => ({ enr: await prisma.enrollment.count({ where: { userId } }), nt: await prisma.notification.count({ where: { userId } }) });

  section("Gia sư bị chặn");
  const gs = await mkTutor("Thầy Minh");
  let r = await api("POST", URL_, { as: SA, body: { userId: gs.id, courseId: C.id } });
  check("1. adminRole teacher → 409 code tutor_account, lời Việt", r.status === 409 && r.json?.code === "tutor_account" && /gia sư/.test(r.json.error), [r.status, r.json]);
  const s1 = await stat(gs.id);
  check("1c. không có Enrollment, không có thông báo", s1.enr === 0 && s1.nt === 0, s1);
  const tv = await mkUser({ name: "Quản trị đã duyệt gia sư", role: "admin", adminRole: "admin_content", tutorVerified: true });
  r = await api("POST", URL_, { as: SA, body: { userId: tv.id, courseId: C.id } });
  check("2. admin + tutorVerified=true → 409 tutor_account", r.status === 409 && r.json?.code === "tutor_account", [r.status, r.json]);
  const s2 = await stat(tv.id);
  check("2c. không có Enrollment / thông báo", s2.enr === 0 && s2.nt === 0, s2);
  r = await api("POST", URL_, { as: CA, body: { userId: gs.id, courseId: C.id } });
  check("3. admin_content gọi cũng bị chặn 409 (qua quyền, trúng kiểm gia sư)", r.status === 409 && r.json?.code === "tutor_account", [r.status, r.json]);

  section("Học sinh thường vẫn ghi danh được");
  const hs = await mkUser({ name: "Bé Hoa" });
  r = await api("POST", URL_, { as: SA, body: { userId: hs.id, courseId: C.id } });
  check("4. học sinh thường → 200 + Enrollment", r.status === 200 && (await prisma.enrollment.count({ where: { userId: hs.id, courseId: C.id } })) === 1, [r.status, r.json]);
  const hsFlag = await mkUser({ name: "Bé có cờ gia sư lạc", tutorVerified: true });
  r = await api("POST", URL_, { as: CA, body: { userId: hsFlag.id, courseId: C.id } });
  check("4b. role student dù tutorVerified lạc → 200 (chỉ chặn role admin)", r.status === 200, [r.status, r.json]);
  r = await api("POST", URL_, { as: CA, body: { userId: (await mkUser({ name: "Bé Nam" })).id, courseId: C.id } });
  check("4c. admin_content ghi danh học sinh thường → 200", r.status === 200, [r.status, r.json]);

  section("Quyền và đầu vào");
  r = await api("POST", URL_, { body: { userId: hs.id, courseId: C.id } });
  check("5a. khách → 401", r.status === 401, r.status);
  const rs = [await api("POST", URL_, { as: owner, body: { userId: hs.id, courseId: C.id } }), await api("POST", URL_, { as: hs, body: { userId: hs.id, courseId: C.id } })];
  check("5b. teacher / student → 403", rs.every(x => x.status === 403), rs.map(x => x.status));
  r = await api("POST", URL_, { as: SA, body: { userId: "khong-co", courseId: C.id } });
  check("5c. userId không tồn tại → 404", r.status === 404, r.status);
  r = await api("POST", URL_, { as: SA, body: { userId: hs.id } });
  check("5d. thiếu courseId → 400", r.status === 400, r.status);

  section("DELETE không đổi");
  r = await api("DELETE", URL_, { as: SA, body: { userId: hs.id, courseId: C.id } });
  check("6. DELETE thu hồi → 200, Enrollment mất", r.status === 200 && (await prisma.enrollment.count({ where: { userId: hs.id, courseId: C.id } })) === 0, [r.status, r.json]);
  await done();
})().catch(e => { console.error(e); process.exit(1); });
