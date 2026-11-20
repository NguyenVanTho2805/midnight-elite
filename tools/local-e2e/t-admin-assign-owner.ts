// DG-GIAO-LOP — quản trị giao lớp cho gia sư khác làm CHỦ LỚP: /api/admin/khoa-hoc/[id]/chu-lop (GET, POST JSON). API + DB, bài wipe() DB riêng.
// Phần đầu là ca THUẦN (pickOwnerBlocker, isAssignableTutor) — ca phá cố ý: đổi `> 0` thành `> 1` trong pickOwnerBlocker ⇒ ca 2/3 đỏ.
// Chạy: TZ=Asia/Ho_Chi_Minh npx tsx tools/local-e2e/t-admin-assign-owner.ts
import { prisma } from "@/lib/prisma";
import { examsToMoveWhere, isAssignableTutor, nextInstructor, pickOwnerBlocker } from "@/lib/courseOwnerAssign";
import { looksLikeMoney } from "@/lib/lessonReminder";
import { api, check, done, mkCourse, mkSuper, mkTutor, mkUser, section, wipe, type TUser } from "./h";

const path = (id: string) => `/api/admin/khoa-hoc/${encodeURIComponent(id)}/chu-lop`;
const tutorSees = async (u: TUser, courseId: string) => (await api("GET", "/api/tutor/lop", { as: u })).text.includes(courseId);

async function main() {
  section("thuần");
  check("1. không còn tiền ⇒ giao được", pickOwnerBlocker({ openInvoices: 0, uninvoicedFees: 0 }) === null);
  check("2. 1 phiếu mở ⇒ 409 open_invoices", pickOwnerBlocker({ openInvoices: 1, uninvoicedFees: 0 })?.code === "open_invoices");
  check("3. 1 khoản chưa vào phiếu ⇒ 409 uninvoiced_fees; cả hai ⇒ báo phiếu trước", pickOwnerBlocker({ openInvoices: 0, uninvoicedFees: 1 })?.code === "uninvoiced_fees" && pickOwnerBlocker({ openInvoices: 2, uninvoicedFees: 3 })?.code === "open_invoices");
  check("4. câu báo chặn không có số tiền", !looksLikeMoney(pickOwnerBlocker({ openInvoices: 2, uninvoicedFees: 0 })!.error));
  const base = { role: "admin", adminRole: "teacher", tutorVerified: true, banned: false, deletedAt: null, email: "a@b.vn" };
  check("5. isAssignableTutor: gia sư đã duyệt ⇒ đúng; chưa duyệt / bị khoá / đã xoá / ẩn danh / học sinh / quản trị ⇒ sai",
    isAssignableTutor(base) && !isAssignableTutor({ ...base, tutorVerified: false }) && !isAssignableTutor({ ...base, banned: true })
    && !isAssignableTutor({ ...base, deletedAt: new Date() }) && !isAssignableTutor({ ...base, email: "deleted+x@invalid" })
    && !isAssignableTutor({ ...base, role: "student", adminRole: null }) && !isAssignableTutor({ ...base, adminRole: "admin_super" }) && !isAssignableTutor(null));

  check("5b. nextInstructor: trống / trùng tên chủ cũ ⇒ tên chủ mới; tên khác do quản trị đặt ⇒ giữ (null); trùng tên mới ⇒ null",
    nextInstructor("", "Cô A", "Thầy B") === "Thầy B" && nextInstructor("  Cô A ", "Cô A", "Thầy B") === "Thầy B" && nextInstructor("Ban Toán KiN", "Cô A", "Thầy B") === null
    && nextInstructor("Cô A", null, "Thầy B") === null && nextInstructor("Thầy B", "Cô A", "Thầy B") === null);
  check("5d. Q5: tên giữ chỗ 'GV' / 'kin' / 'Giáo viên.' ⇒ đổi theo chủ mới; 'Ban Toán KiN', 'GV Toán' ⇒ giữ",
    nextInstructor("GV", "Cô A", "Thầy B") === "Thầy B" && nextInstructor(" kin ", null, "Thầy B") === "Thầy B" && nextInstructor("Giáo viên.", null, "Thầy B") === "Thầy B"
    && nextInstructor("Ban Toán KiN", null, "Thầy B") === null && nextInstructor("GV Toán", null, "Thầy B") === null);
  check("5c. examsToMoveWhere: chỉ đề của chủ cũ, gắn lớp hoặc là mã con; không có đề gốc ⇒ chỉ lọc theo lớp",
    JSON.stringify(examsToMoveWhere("c1", "u1", ["e1"])) === JSON.stringify({ ownerId: "u1", OR: [{ courseId: "c1" }, { variantOfId: { in: ["e1"] } }] })
    && JSON.stringify(examsToMoveWhere("c1", null, [])) === JSON.stringify({ ownerId: null, OR: [{ courseId: "c1" }] }));

  await wipe();
  const sup = await mkSuper("Quản trị Một");
  const content = await mkUser({ name: "Quản trị Nội dung", role: "admin", adminRole: "admin_content" });
  const t1 = await mkTutor("Gia sư Cũ");
  const t2 = await mkTutor("Gia sư Đồng Giảng");
  const t3 = await mkTutor("Gia sư Mới");
  const unverified = await mkUser({ name: "Gia sư Chưa Duyệt", role: "admin", adminRole: "teacher", tutorVerified: false });
  const banned = await mkTutor("Gia sư Bị Khoá");
  await prisma.user.update({ where: { id: banned.id }, data: { banned: true } });
  const student = await mkUser({ name: "Học sinh Một" });

  const free = await mkCourse(t1.id, { name: "Lớp Giao Được" });
  await prisma.enrollment.create({ data: { userId: student.id, courseId: free.id, status: "active" } });
  await prisma.courseTeacher.create({ data: { courseId: free.id, userId: t2.id, role: "co_teacher", status: "active", invitedBy: t1.id } });
  await prisma.course.update({ where: { id: free.id }, data: { instructor: t1.name } }); // tên công khai = tên chủ cũ ⇒ đổi theo chủ mới
  const mkExam = (suffix: string, extra: Record<string, unknown>) => prisma.exam.create({ data: { id: `exam-giao-${suffix}-${Date.now()}`, code: `DE-GIAO-${suffix}-${Date.now() % 100000}`, title: `Đề ${suffix}`, category: "toan", date: "2026-12-01", time: "19:00", duration: "30", questions: 0, status: "available", createdAt: new Date().toISOString(), totalPoints: 10, ...extra } as never });
  const exam = await mkExam("lop", { ownerId: t1.id, courseId: free.id });
  const variant = await mkExam("ma2", { ownerId: t1.id, courseId: null, variantOfId: exam.id, variantNo: 2 }); // mã đề con không gắn courseId vẫn đi theo đề gốc
  const coExam = await mkExam("dong-giang", { ownerId: t3.id, courseId: free.id }); // đề của người khác gắn vào lớp ⇒ không đổi chủ
  const otherExam = await mkExam("lop-khac", { ownerId: t1.id, courseId: null }); // đề riêng của chủ cũ, không gắn lớp ⇒ không đổi chủ

  section("quyền");
  check("6. khách ⇒ 401", (await api("POST", path(free.id), { body: { tutorId: t3.id } })).status === 401);
  check("7. học sinh ⇒ 403", (await api("POST", path(free.id), { as: student, body: { tutorId: t3.id } })).status === 403);
  check("8. gia sư (kể cả chính chủ lớp) ⇒ 403", (await api("POST", path(free.id), { as: t1, body: { tutorId: t3.id } })).status === 403);
  check("9. gia sư GET danh sách ⇒ 403", (await api("GET", path(free.id), { as: t1 })).status === 403);
  check("10. ownerId chưa đổi sau các lần bị chặn", (await prisma.course.findUnique({ where: { id: free.id } }))?.ownerId === t1.id);

  section("dữ liệu sai");
  check("11. lớp không tồn tại ⇒ 404", (await api("POST", path("khong-co-lop"), { as: sup, body: { tutorId: t3.id } })).status === 404);
  const bad = await Promise.all([
    api("POST", path(free.id), { as: sup, body: {} }),
    api("POST", path(free.id), { as: sup, body: { tutorId: student.id } }),
    api("POST", path(free.id), { as: sup, body: { tutorId: unverified.id } }),
    api("POST", path(free.id), { as: sup, body: { tutorId: banned.id } }),
    api("POST", path(free.id), { as: sup, body: { tutorId: sup.id } }),
    api("POST", path(free.id), { as: sup, body: { tutorId: "khong-co-ai" } }),
    api("POST", path(free.id), { as: sup, body: { tutorId: t1.id } }),
  ]);
  check("12. thiếu tutorId / học sinh / gia sư chưa duyệt / bị khoá / quản trị / không có ai / đã là chủ ⇒ 400", bad.every(r => r.status === 400), bad.map(r => r.status));
  check("13. vẫn chưa đổi chủ, chưa ghi nhật ký", (await prisma.course.findUnique({ where: { id: free.id } }))?.ownerId === t1.id && (await prisma.auditLog.count({ where: { action: "course.owner_assign" } })) === 0);

  section("GET danh sách cho ô chọn");
  const g = await api("GET", path(free.id), { as: content });
  const ids = (g.json?.tutors ?? []).map((t: { id: string }) => t.id);
  check("14. quản trị nội dung GET ⇒ 200, chủ lớp hiện tại đúng", g.status === 200 && g.json?.owner?.id === t1.id, g.json);
  check("15. danh sách chỉ có gia sư giao được (không chưa duyệt / bị khoá / học sinh / quản trị)", ids.includes(t2.id) && ids.includes(t3.id) && !ids.includes(unverified.id) && !ids.includes(banned.id) && !ids.includes(student.id) && !ids.includes(sup.id), ids);

  section("TIỀN: còn phiếu mở / khoản chưa vào phiếu ⇒ 409, không đổi gì");
  const inv = await mkCourse(t1.id, { name: "Lớp Còn Phiếu" });
  await prisma.course.update({ where: { id: inv.id }, data: { instructor: "Ban Toán KiN" } }); // tên thật do quản trị đặt (Q5: "GV" giờ là tên giữ chỗ, sẽ đổi)
  const s2 = await mkUser({ name: "Học sinh Phiếu" });
  await prisma.enrollment.create({ data: { userId: s2.id, courseId: inv.id, status: "active" } });
  await prisma.tuitionInvoice.create({ data: { code: "KINTEST1", tutorId: t1.id, studentId: s2.id, yearMonth: "2026-11", amountDue: 500000, status: "sent" } });
  const r409 = await api("POST", path(inv.id), { as: sup, body: { tutorId: t3.id } });
  check("16. phiếu 'sent' chưa tất toán ⇒ 409 open_invoices + câu tiếng Việt", r409.status === 409 && r409.json?.code === "open_invoices" && /phiếu học phí/.test(r409.json?.error ?? ""), r409.json);
  check("17. câu báo 409 không có số tiền", !looksLikeMoney(r409.json?.error ?? ""));
  check("18. ownerId KHÔNG đổi, phiếu giữ nguyên (tutorId, số tiền, trạng thái)", (await prisma.course.findUnique({ where: { id: inv.id } }))?.ownerId === t1.id
    && JSON.stringify(await prisma.tuitionInvoice.findUnique({ where: { code: "KINTEST1" }, select: { tutorId: true, amountDue: true, status: true } })) === JSON.stringify({ tutorId: t1.id, amountDue: 500000, status: "sent" }));
  await prisma.tuitionInvoice.update({ where: { code: "KINTEST1" }, data: { status: "paid", paidAmount: 500000 } });
  const fee = await mkCourse(t1.id, { name: "Lớp Còn Khoản Phí" });
  await prisma.enrollment.create({ data: { userId: s2.id, courseId: fee.id, status: "active" } });
  await prisma.feeCharge.create({ data: { tutorId: t1.id, courseId: fee.id, studentId: s2.id, kind: "session", dateKey: "2026-11-10", yearMonth: "2026-11", amount: 120000, mode: "per_session" } });
  const rFee = await api("POST", path(fee.id), { as: sup, body: { tutorId: t3.id } });
  check("19. khoản phí chưa vào phiếu ⇒ 409 uninvoiced_fees", rFee.status === 409 && rFee.json?.code === "uninvoiced_fees", rFee.json);
  check("20. ownerId lớp đó KHÔNG đổi, khoản phí giữ nguyên tutorId", (await prisma.course.findUnique({ where: { id: fee.id } }))?.ownerId === t1.id && (await prisma.feeCharge.count({ where: { courseId: fee.id, tutorId: t1.id, invoiceId: null } })) === 1);
  const rPaid = await api("POST", path(inv.id), { as: sup, body: { tutorId: t3.id } });
  check("21. phiếu đã tất toán ⇒ lớp đó giao được", rPaid.status === 200 && (await prisma.course.findUnique({ where: { id: inv.id } }))?.ownerId === t3.id, rPaid.json);

  section("giao thành công — gỡ đồng giảng trùng, nhật ký, thông báo, Lớp của tôi");
  check("22. trước khi giao: gia sư cũ thấy lớp", await tutorSees(t1, free.id));
  const ok = await api("POST", path(free.id), { as: content, body: { tutorId: t2.id } });
  check("23. quản trị nội dung giao cho đồng giảng ⇒ 200, removedCoTeacher", ok.status === 200 && ok.json?.ownerId === t2.id && ok.json?.removedCoTeacher === true, ok.json);
  check("24. ownerId đổi sang gia sư mới", (await prisma.course.findUnique({ where: { id: free.id } }))?.ownerId === t2.id);
  check("25. hàng CourseTeacher của gia sư mới trong lớp này đã gỡ", (await prisma.courseTeacher.count({ where: { courseId: free.id, userId: t2.id } })) === 0);
  const logs = await prisma.auditLog.findMany({ where: { action: "course.owner_assign", resourceId: free.id } });
  check("26. đúng 1 dòng nhật ký, người làm = quản trị nội dung", logs.length === 1 && logs[0].actorId === content.id && logs[0].resourceType === "Course", logs);
  const meta = JSON.stringify(logs[0]?.metadata ?? {});
  check("27. metadata chỉ có mã: không tên, không email", meta.includes(t1.id) && meta.includes(t2.id) && ![t1.name, t2.name, t1.email, t2.email, content.email].some(x => meta.includes(x)), meta);
  const noti = await prisma.notification.findMany({ where: { userId: t2.id, type: "course_owner_assigned" } });
  check("28. gia sư mới nhận 1 thông báo 'Bạn được giao lớp …', không số tiền", noti.length === 1 && noti[0].message.includes("Lớp Giao Được") && !looksLikeMoney(`${noti[0].title} ${noti[0].message}`), noti);
  check("29. gia sư cũ KHÔNG còn thấy lớp trong Lớp của tôi; gia sư mới thấy", !(await tutorSees(t1, free.id)) && (await tutorSees(t2, free.id)));
  const pOld = await api("GET", `/lop-cua-toi/quan-lop/${free.id}?tab=cai-dat`, { as: t1 });
  check("30. gia sư cũ mở trang quản lý lớp ⇒ không có quyền", pOld.text.includes("Bạn không có quyền với lớp này") || pOld.status === 403, pOld.status);
  check("31. gia sư mới (lớp giao từ phiếu đã tất toán) thấy lớp, gia sư cũ không", (await tutorSees(t3, inv.id)) && !(await tutorSees(t1, inv.id)));
  check("32. giao lại cho người đang là chủ ⇒ 400, không thêm nhật ký", (await api("POST", path(free.id), { as: sup, body: { tutorId: t2.id } })).status === 400 && (await prisma.auditLog.count({ where: { action: "course.owner_assign", resourceId: free.id } })) === 1);

  section("tên công khai, thông báo gia sư cũ, đề của lớp");
  check("34. Course.instructor = tên chủ cũ ⇒ đổi thành tên gia sư mới", (await prisma.course.findUnique({ where: { id: free.id } }))?.instructor === t2.name && ok.json?.instructorUpdated === true);
  check("35. lớp có tên công khai do quản trị đặt ('Ban Toán KiN') ⇒ giữ nguyên", (await prisma.course.findUnique({ where: { id: inv.id } }))?.instructor === "Ban Toán KiN" && rPaid.json?.instructorUpdated === false);
  const oldNoti = await prisma.notification.findMany({ where: { userId: t1.id, type: "course_owner_removed" } });
  check("36. gia sư cũ nhận thông báo 'đã được giao cho gia sư khác' (2 lớp đã giao đi), không tên người mới, không số tiền",
    oldNoti.length === 2 && oldNoti.some(n => n.message.includes("Lớp Giao Được")) && oldNoti.every(n => n.message.includes("gia sư khác") && !n.message.includes(t2.name) && !n.message.includes(t3.name) && !looksLikeMoney(`${n.title} ${n.message}`)), oldNoti);
  const own = async (id: string) => (await prisma.exam.findUnique({ where: { id }, select: { ownerId: true } }))?.ownerId;
  check("37. đề gắn lớp CHUYỂN sang chủ mới, vẫn gắn lớp", JSON.stringify(await prisma.exam.findUnique({ where: { id: exam.id }, select: { ownerId: true, courseId: true } })) === JSON.stringify({ ownerId: t2.id, courseId: free.id }));
  check("38. mã đề con của đề lớp cũng chuyển theo", (await own(variant.id)) === t2.id);
  check("39. đề của người khác gắn vào lớp GIỮ chủ cũ", (await own(coExam.id)) === t3.id);
  check("40. đề riêng của chủ cũ không gắn lớp GIỮ chủ cũ", (await own(otherExam.id)) === t1.id);
  check("41. phản hồi + nhật ký ghi movedExams = 2", ok.json?.movedExams === 2 && JSON.stringify(logs[0]?.metadata ?? {}).includes('"movedExams":2'), ok.json);
  check("42. chủ lớp mới thấy và sửa được đề của lớp", (await api("GET", "/api/exams", { as: t2 })).text.includes(exam.id) && (await api("PUT", `/api/exams/${exam.id}`, { as: t2, body: { title: "Đề lớp (chủ mới sửa)" } })).status === 200);
  check("43. chủ cũ không còn sửa được đề của lớp", (await api("PUT", `/api/exams/${exam.id}`, { as: t1, body: { title: "Chủ cũ thử sửa" } })).status === 403);

  section("lớp chưa có chủ (của trung tâm) ⇒ giao được, không cần kiểm tiền");
  const center = await mkCourse(null, { name: "Lớp Trung Tâm" });
  const rc = await api("POST", path(center.id), { as: sup, body: { tutorId: t3.id } });
  check("33. 200, ownerId = gia sư, nhật ký fromOwnerId null", rc.status === 200 && (await prisma.course.findUnique({ where: { id: center.id } }))?.ownerId === t3.id
    && JSON.stringify((await prisma.auditLog.findFirst({ where: { resourceId: center.id } }))?.metadata ?? {}).includes('"fromOwnerId":null'), rc.json);

  section("hai quản trị giao CÙNG MỘT lớp cùng lúc (14/11) — không lỗi 500, chủ lớp và đề của lớp luôn khớp nhau");
  const sup2 = await mkSuper("Quản trị Hai");
  for (let round = 1; round <= 3; round++) {
    const race = await mkCourse(t1.id, { name: `Lớp Đua ${round}` });
    const raceExam = await prisma.exam.create({ data: { id: `dua-${round}`, code: `dua-${round}`, title: "Đề đua", category: "Toán", date: "01/01/2030", time: "08:00", duration: "15 phút", questions: 1, status: "available", createdAt: "2026-11-14", ownerId: t1.id, courseId: race.id } });
    const [ra, rb] = await Promise.all([
      api("POST", path(race.id), { as: sup, body: { tutorId: t2.id } }),
      api("POST", path(race.id), { as: sup2, body: { tutorId: t3.id } }),
    ]);
    const st = [ra.status, rb.status];
    const wins = st.filter(x => x === 200).length;
    const after = await prisma.course.findUnique({ where: { id: race.id }, select: { ownerId: true } });
    const exOwner = (await prisma.exam.findUnique({ where: { id: raceExam.id }, select: { ownerId: true } }))?.ownerId;
    const logsN = await prisma.auditLog.count({ where: { resourceId: race.id } });
    check(`44.${round}a. chỉ 200 / 409 (không 500), ít nhất một người thành công`, st.every(x => x === 200 || x === 409) && wins >= 1, st);
    check(`44.${round}b. người thua nhận 409 'changed' kèm lời nhắn tải lại`, [ra, rb].filter(r => r.status === 409).every(r => r.json?.code === "changed" && /Tải lại/.test(r.json?.error ?? "")), [ra.json, rb.json]);
    check(`44.${round}c. chủ lớp cuối là một trong hai gia sư, và đề của lớp đi theo đúng chủ đó`, (after?.ownerId === t2.id || after?.ownerId === t3.id) && exOwner === after?.ownerId, { after, exOwner });
    check(`44.${round}d. số dòng nhật ký = số lần giao thành công`, logsN === wins, { logsN, wins });
  }

  await done();
}
main().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });
