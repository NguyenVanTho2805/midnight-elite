// Rà soát 16/11 (P1 + P2): ai nhận tin "đề thi mới" / "nhắc thi"; ai được gắn đề vào lớp; tin không trỏ vào phần đang tắt cờ.
// Trước đây: POST /api/exams và cron remind-exam gửi cho MỌI ghi danh cùng "môn" (kể cả em đã nghỉ, lớp của gia sư khác) kèm tên đề;
// gia sư gắn được đề của mình vào lớp người khác (POST / PUT /api/exams).
// Cần máy chủ với cờ MẶC ĐỊNH (tắt) + CRON_SECRET (env.sh). Chạy: source tools/local-e2e/env.sh && TZ=Asia/Ho_Chi_Minh npx tsx tools/local-e2e/t-exam-notify.ts
// CA PHÁ CỐ Ý: examNotifyServer.ts examAudienceKind trả luôn "public" ⇒ ca 3/4/7 đỏ; attachCourseBlock trả null ⇒ ca 8/9 đỏ; api/notifications/route.ts bỏ khối isLinkHidden ⇒ ca 14 đỏ.
import { api, check, done, mkCourse, mkSuper, mkTutor, mkUser, section, wipe } from "./h";
import { prisma } from "@/lib/prisma";
import { examAudienceKind, mayAttachToCourse } from "@/lib/examNotifyServer";
import { notifyMany } from "@/lib/notify";
import { isLinkHidden } from "@/lib/features";
import { featureOn } from "@/lib/features";

const SECRET = process.env.CRON_SECRET;
(async () => {
  section("hàm thuần");
  check("1a. đề gắn lớp ⇒ 'course'", examAudienceKind({ courseId: "c", ownerAdminRole: "teacher", category: "toan" }, false) === "course");
  check("1b. đề riêng của gia sư không gắn lớp ⇒ 'none' (kể cả khi thi thử công khai mở)", examAudienceKind({ courseId: null, ownerAdminRole: "teacher", category: "toan" }, true) === "none");
  check("1c. đề KiN không lớp: cờ tắt ⇒ 'none'; cờ mở ⇒ 'public'; môn rỗng ⇒ 'none'",
    examAudienceKind({ courseId: null, ownerAdminRole: "admin_super", category: "toan" }, false) === "none"
    && examAudienceKind({ courseId: null, ownerAdminRole: "admin_super", category: "toan" }, true) === "public"
    && examAudienceKind({ courseId: null, ownerAdminRole: null, category: "  " }, true) === "none");
  check("1d. gắn lớp: gia sư chỉ lớp mình làm chủ / đang đồng giảng; quản trị mọi lớp",
    mayAttachToCourse({ adminRole: "teacher", userId: "t1", courseOwnerId: "t1", activeTeacher: false })
    && mayAttachToCourse({ adminRole: "teacher", userId: "t1", courseOwnerId: "t2", activeTeacher: true })
    && !mayAttachToCourse({ adminRole: "teacher", userId: "t1", courseOwnerId: "t2", activeTeacher: false })
    && mayAttachToCourse({ adminRole: "admin_super", userId: "a", courseOwnerId: "t2", activeTeacher: false }));
  check("1e. cờ HOC_PHI tắt: link học phí bị coi là ẩn, link lớp thì không", featureOn("HOC_PHI") || (isLinkHidden("/lop-cua-toi/hoc-phi?tab=doi-soat") && !isLinkHidden("/lop-cua-toi/lop")));

  if (featureOn("THI_THU_CONG_KHAI") || featureOn("HOC_PHI")) { console.log("BỎ QUA phần API: cần máy chủ chạy với cờ mặc định (tắt)."); await done(); return; }

  await wipe();
  const A = await mkSuper("Quản trị KiN");
  const T1 = await mkTutor("Cô Một"), T2 = await mkTutor("Cô Hai"), T3 = await mkTutor("Cô Ba Đồng Giảng");
  const C1 = await mkCourse(T1.id, { name: "Toán Cô Một" }), C2 = await mkCourse(T2.id, { name: "Toán Cô Hai" });
  await prisma.courseTeacher.create({ data: { courseId: C1.id, userId: T3.id, role: "co_teacher", status: "active", invitedBy: T1.id } });
  const s1 = await mkUser({ name: "Em Lớp Một" }), s1off = await mkUser({ name: "Em Đã Nghỉ" }), s2 = await mkUser({ name: "Em Lớp Hai" });
  await prisma.enrollment.createMany({ data: [
    { userId: s1.id, courseId: C1.id, status: "active" }, { userId: s1off.id, courseId: C1.id, status: "suspended" }, { userId: s2.id, courseId: C2.id, status: "active" },
  ] });
  const tomorrow = new Date(Date.now() + 7 * 3600_000 + 24 * 3600_000).toISOString().slice(0, 10);
  const body = (title: string, extra: Record<string, unknown> = {}) => ({ title, category: "toan", date: tomorrow, time: "19:00", duration: "45 phút", questions: 0, status: "available", active: true, createdAt: "2026-11-16", ...extra });
  const notesOf = (uid: string) => prisma.notification.findMany({ where: { userId: uid, type: { in: ["exam_new", "exam_reminder"] } } });

  section("POST /api/exams — người nhận tin đề thi mới");
  const r1 = await api("POST", "/api/exams", { as: T1, body: body("Đề riêng lớp Một", { courseId: C1.id }) });
  check("2. gia sư tạo đề gắn lớp mình ⇒ 201", r1.status === 201, r1.json);
  const n1 = await notesOf(s1.id);
  check("3. em ĐANG HỌC lớp đó nhận 1 tin, link vào đúng đề", n1.length === 1 && n1[0].link === `/student/thi-thu/${r1.json.id}`, n1);
  check("4. em đã nghỉ lớp và em lớp của gia sư khác (cùng môn) KHÔNG nhận, không thấy tên đề", (await notesOf(s1off.id)).length === 0 && (await notesOf(s2.id)).length === 0);
  const r2 = await api("POST", "/api/exams", { as: T1, body: body("Đề riêng không lớp") });
  check("5. đề riêng của gia sư không gắn lớp ⇒ tạo được, không ai nhận tin", r2.status === 201 && (await prisma.notification.count({ where: { type: "exam_new", message: { contains: "Đề riêng không lớp" } } })) === 0, r2.json);
  const r3 = await api("POST", "/api/exams", { as: A, body: body("Đề thi thử KiN") });
  check("6. đề thi thử của KiN khi phần đó đang tắt ⇒ không ai nhận tin (link sẽ là ngõ cụt)", r3.status === 201 && (await prisma.notification.count({ where: { message: { contains: "Đề thi thử KiN" } } })) === 0);

  section("Gắn đề vào lớp — chỉ lớp mình dạy");
  const r4 = await api("POST", "/api/exams", { as: T1, body: body("Đề lấn lớp", { courseId: C2.id }) });
  check("8. gia sư gắn đề MỚI vào lớp của gia sư khác ⇒ 403, không tạo đề, không tin", r4.status === 403 && (await prisma.exam.count({ where: { title: "Đề lấn lớp" } })) === 0 && (await notesOf(s2.id)).length === 0, r4.json);
  const r5 = await api("PUT", `/api/exams/${r2.json.id}`, { as: T1, body: { courseId: C2.id } });
  check("9. gia sư SỬA đề của mình sang lớp người khác ⇒ 403, đề vẫn không lớp", r5.status === 403 && (await prisma.exam.findUnique({ where: { id: r2.json.id } }))?.courseId === null, r5.json);
  const r6 = await api("POST", "/api/exams", { as: T3, body: body("Đề của đồng giảng", { courseId: C1.id }) });
  check("10. đồng giảng ĐANG HOẠT ĐỘNG gắn được đề vào lớp mình đồng giảng", r6.status === 201, r6.json);
  await prisma.course.update({ where: { id: C1.id }, data: { ownerId: T2.id } });
  await prisma.courseTeacher.updateMany({ where: { userId: T3.id }, data: { status: "removed" } });
  const r7 = await api("PUT", `/api/exams/${r6.json.id}`, { as: T3, body: { courseId: C1.id, title: "Đề của đồng giảng (sửa)" } });
  check("11. gửi lại ĐÚNG lớp cũ (trình soạn lưu cả bộ cài đặt) ⇒ vẫn lưu được dù nay không còn dạy lớp đó", r7.status === 200, r7.json);
  const r8 = await api("PUT", `/api/exams/${r2.json.id}`, { as: T1, body: { courseId: null } });
  check("12. gỡ đề khỏi lớp (courseId null) ⇒ luôn được", r8.status === 200, r8.json);
  const r9 = await api("POST", "/api/exams", { as: A, body: body("Đề quản trị gắn lớp", { courseId: C2.id, active: false }) });
  check("13. quản trị trung tâm gắn được vào lớp bất kỳ", r9.status === 201, r9.json);

  section("cron remind-exam — cùng người nhận");
  await prisma.notification.deleteMany({});
  const rc = await api("GET", "/api/cron/remind-exam", { headers: { authorization: `Bearer ${SECRET}` } });
  const rem = await prisma.notification.findMany({ where: { type: "exam_reminder" } });
  check("7. nhắc thi ngày mai: chỉ em ĐANG HỌC lớp có đề; đề riêng không lớp / đề KiN (cờ tắt) không nhắc ai", rc.status === 200 && rem.length > 0 && rem.every(n => n.userId === s2.id || n.userId === s1.id) && !rem.some(n => n.userId === s1off.id)
    && !rem.some(n => /Đề riêng không lớp|Đề thi thử KiN/.test(n.message)), { status: rc.status, rem: rem.map(n => [n.userId === s1.id ? "s1" : n.userId === s2.id ? "s2" : n.userId, n.message, n.link]) });

  section("tin không trỏ vào phần đang tắt cờ (P2)");
  await notifyMany([T1.id], { type: "invoice_paid", title: "Đã gạch phiếu", message: "Phiếu đã được gạch", link: "/lop-cua-toi/hoc-phi?tab=doi-soat" });
  await notifyMany([T1.id], { type: "enrollment", title: "Có học sinh mới", message: "Lớp có học sinh mới", link: "/lop-cua-toi/lop" });
  const tn = await prisma.notification.findMany({ where: { userId: T1.id } });
  const bell = await api("GET", "/api/notifications", { as: T1 });
  const bn = (bell.json?.notifications ?? []) as { type: string; link: string | null }[];
  check("14. chuông: tin học phí (cờ HOC_PHI tắt) trả link null, tin lớp (đang mở) giữ link", bn.find(n => n.type === "invoice_paid")?.link === null && bn.find(n => n.type === "enrollment")?.link === "/lop-cua-toi/lop", bn.map(n => [n.type, n.link]));
  check("15. DB vẫn giữ link gốc (lọc lúc đọc, không sửa dữ liệu; notify.ts — tệp khoá — không đổi)", tn.find(n => n.type === "invoice_paid")?.link === "/lop-cua-toi/hoc-phi?tab=doi-soat", tn.map(n => [n.type, n.link]));
  await done();
})();
