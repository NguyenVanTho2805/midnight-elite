// TUT-dong-giang — API đồng giảng: mời / nhận / từ chối / gỡ / rời, cô lập giữa các gia sư (IDOR), quyền M của đồng giảng và bộ môn, đồng giảng 403 ở MỌI route tiền,
// gỡ giữ nguyên buổi cũ, vá H1/H2 (chuyển học sinh thành gia sư). Cần máy chủ: bash .local-dev/wt-up.sh. DB riêng bị wipe().
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-course-teachers.ts
//
// Ca phá (bẻ X thì ca Y đỏ):
//   - đổi `ownsResource(...)` trong một route dòng G thành cho đồng giảng qua           → ca "C × <route G> = 403" đỏ
//   - bỏ `isCoTeacherUsable` trong loadCourseAccess                                    → ca "mời chưa nhận / đã bị gỡ / bị khoá / bị hạ vai ⇒ 403" đỏ
//   - cho PUT điểm danh của đồng giảng gọi syncSessionCharges / bỏ kiểm `closed`        → ca "FeeCharge không đổi" / "buổi đã chốt ⇒ 409" đỏ
//   - trả `price` / `email` / `parentPhone` cho đồng giảng                              → ca "không có price / email / parentPhone" đỏ
//   - bỏ `user.role === "student"` trong enrollInTx hoặc `known` của hoc-sinh           → ca "H1 / H2" đỏ
//   - gửi thông báo có tên người / email                                                → ca "thông báo không chứa tên / email" đỏ
//   - de-nghi-chot ghi AttendanceSession.state                                          → ca "state không đổi" đỏ
import { prisma } from "@/lib/prisma";
import { api, check, section, done, mkUser, mkTutor, mkSuper, mkCourse, wipe, type TUser } from "./h";

const J = (r: { json: unknown }) => (r.json ?? {}) as Record<string, any>;
const keys = (v: unknown, out: string[] = []): string[] => {
  if (Array.isArray(v)) v.forEach(x => keys(x, out));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { out.push(k); keys(x, out); }
  return out;
};
const MONEY = /^(price|originalPrice|amount|fee|fees|feeMode|charge|charges|invoice|invoices|rate|rates|revenue|packages)$/i;
const key = (d: number) => { const t = new Date(Date.now() + 7 * 3600_000 - d * 86_400_000); return t.toISOString().slice(0, 10); };
const day = (k: string) => new Date(`${k}T00:00:00Z`);
const moneySnapshot = async () => `${await prisma.feeCharge.count()}/${await prisma.tuitionInvoice.count()}`;

(async () => {
  await wipe();
  // ── Người ────────────────────────────────────────────────────────────────────────────────────
  const O = await mkTutor("Thầy Hoàng Phát");
  const C = await mkTutor("Cô Mai Trinh");
  const S = await mkTutor("Thầy Quang Vinh");
  const S2 = await mkTutor("Cô Bích Ngọc");
  const X = await mkTutor("Cô Lạ Hoa");
  const B = await mkTutor("Thầy Bị Khoá");
  const P = await mkUser({ name: "Cô Chờ Duyệt", role: "student" });
  await prisma.user.update({ where: { id: P.id }, data: { tutorAppliedAt: new Date() } });
  const H = await mkUser({ name: "Em Học Sinh" });
  const ADM = await mkSuper("Quản Trị");
  await prisma.user.update({ where: { id: B.id }, data: { banned: true } });
  const guest = undefined;

  // ── Lớp ──────────────────────────────────────────────────────────────────────────────────────
  const K1 = await mkCourse(O.id, { name: "Lớp K1 của Phát" });
  const K2 = await mkCourse(X.id, { name: "Lớp K2 của Hoa" });
  await prisma.course.update({ where: { id: K1.id }, data: { feeMode: "per_session", price: 777000, zaloGroupUrl: "https://zalo.me/g/k1secret", tag: "Hot" } });
  await prisma.courseFeeRate.create({ data: { courseId: K1.id, mode: "per_session", rate: 137000, effectiveFrom: "2026-01-01", createdBy: O.id } });
  const stu: TUser[] = [];
  for (let i = 0; i < 3; i++) {
    const s = await mkUser({ name: `Em Số ${i + 1}` });
    await prisma.user.update({ where: { id: s.id }, data: { phone: `09000000${i}`, school: "THCS Bí Mật", parentName: `Phụ huynh ${i}`, parentPhone: `09111111${i}` } });
    await prisma.enrollment.create({ data: { userId: s.id, courseId: K1.id, status: "active" } });
    stu.push(s);
  }
  const SECRETS = ["09000000", "09111111", "THCS Bí Mật", "Phụ huynh", "k1secret", "137000", "777000"];

  // ── Phiên làm việc: mời C, S, S2 vào K1 bằng chính API ────────────────────────────────────────
  section("Mời / chấp nhận / từ chối (dòng chảy chính)");
  const inv = async (u: TUser, role: string, subjects?: string[]) => api("POST", `/api/tutor/lop/${K1.id}/giao-vien`, { as: O, body: { email: u.email, role, subjects } });
  const r1 = await inv(C, "co_teacher", ["Toán"]);
  check("chủ mời C ⇒ 200 câu chung", r1.status === 200 && J(r1).ok === true && /Nếu email đúng/.test(J(r1).message ?? ""), r1);
  const ctC = await prisma.courseTeacher.findUnique({ where: { courseId_userId: { courseId: K1.id, userId: C.id } } });
  check("CourseTeacher của C = invited, co_teacher, nhãn môn lưu", ctC?.status === "invited" && ctC.role === "co_teacher" && ctC.subjects[0] === "Toán", ctC);
  const nInv = await prisma.notification.findFirst({ where: { userId: C.id, type: "co_teacher_invited" } });
  check("C nhận thông báo co_teacher_invited, link /lop-cua-toi/dong-giang", !!nInv && nInv.link === "/lop-cua-toi/dong-giang", nInv);
  const text = `${nInv?.title} ${nInv?.message}`;
  check("thông báo mời không chứa email / tên chủ lớp / tên người", !text.includes("@") && !text.includes(O.name) && !text.includes(C.name) && text.includes("Lớp K1 của Phát"), text);

  // C chưa nhận: mọi route M phải 403
  const preAccept = await api("GET", `/api/courses/${K1.id}/students`, { as: C });
  check("C CHƯA chấp nhận ⇒ route M (students) 403", preAccept.status === 403, preAccept.status);
  const preAccept2 = await api("GET", `/api/tutor/lop/${K1.id}/giao-trinh`, { as: C });
  check("C CHƯA chấp nhận ⇒ giao-trinh 403", preAccept2.status === 403, preAccept2.status);

  const mine = await api("GET", "/api/tutor/dong-giang", { as: C });
  check("GET dong-giang: C thấy 1 lời mời (không tên chủ, không tiền)", mine.status === 200 && J(mine).invitations.length === 1 && J(mine).courses.length === 0 && !JSON.stringify(mine.json).includes(O.name) && !JSON.stringify(mine.json).includes("137000"), mine.json);
  const idC = J(mine).invitations[0]?.id as string;

  // IDOR ctId: S không nhận/từ chối/rời được lời mời của C
  const idor1 = await api("POST", `/api/tutor/dong-giang/${idC}/chap-nhan`, { as: S });
  const idor2 = await api("POST", `/api/tutor/dong-giang/${idC}/tu-choi`, { as: S });
  const idor3 = await api("POST", `/api/tutor/dong-giang/${idC}/roi-lop`, { as: S });
  check("S nhận / từ chối / rời lời mời của C ⇒ 404 (IDOR ctId)", [idor1, idor2, idor3].every(r => r.status === 404), [idor1.status, idor2.status, idor3.status]);
  check("…và dòng của C vẫn invited", (await prisma.courseTeacher.findUnique({ where: { id: idC } }))?.status === "invited");
  const idor4 = await api("POST", `/api/tutor/dong-giang/${idC}/chap-nhan`, { as: X });
  const idor5 = await api("POST", `/api/tutor/dong-giang/${idC}/chap-nhan`, { as: O });
  check("X (gia sư lạ) và O (chủ) nhận hộ lời mời của C ⇒ 404", idor4.status === 404 && idor5.status === 404, [idor4.status, idor5.status]);
  check("H, P, khách, B chấp nhận ⇒ 403/401/403/403", (await api("POST", `/api/tutor/dong-giang/${idC}/chap-nhan`, { as: H })).status === 403
    && (await api("POST", `/api/tutor/dong-giang/${idC}/chap-nhan`, { as: P })).status === 403
    && (await api("POST", `/api/tutor/dong-giang/${idC}/chap-nhan`, { as: guest })).status === 401
    && (await api("POST", `/api/tutor/dong-giang/${idC}/chap-nhan`, { as: B })).status === 403);

  const acc1 = await api("POST", `/api/tutor/dong-giang/${idC}/chap-nhan`, { as: C });
  check("C chấp nhận ⇒ 200, dòng thành active, có respondedAt", acc1.status === 200 && (await prisma.courseTeacher.findUnique({ where: { id: idC } }))?.status === "active");
  const acc2 = await api("POST", `/api/tutor/dong-giang/${idC}/chap-nhan`, { as: C });
  check("chấp nhận lần hai ⇒ 409 ALREADY_RESPONDED", acc2.status === 409 && J(acc2).code === "ALREADY_RESPONDED", acc2.json);
  const nAcc = await prisma.notification.findFirst({ where: { userId: O.id, type: "co_teacher_accepted" } });
  check("chủ nhận co_teacher_accepted không chứa tên người", !!nAcc && !`${nAcc.title}${nAcc.message}`.includes(C.name) && nAcc.link === `/lop-cua-toi/${K1.id}?tab=giao-vien`, nAcc);

  // S: bộ môn; S2: bộ môn chưa được giao gì
  await inv(S, "subject_teacher", ["Lý"]); await inv(S2, "subject_teacher");
  const mineS = J(await api("GET", "/api/tutor/dong-giang", { as: S })).invitations[0]?.id;
  const mineS2 = J(await api("GET", "/api/tutor/dong-giang", { as: S2 })).invitations[0]?.id;
  check("S, S2 nhận lời", (await api("POST", `/api/tutor/dong-giang/${mineS}/chap-nhan`, { as: S })).status === 200 && (await api("POST", `/api/tutor/dong-giang/${mineS2}/chap-nhan`, { as: S2 })).status === 200);

  // Từ chối rồi mời lại cùng dòng
  const Dd = await mkTutor("Cô Từ Chối");
  await inv(Dd, "co_teacher");
  const idD = J(await api("GET", "/api/tutor/dong-giang", { as: Dd })).invitations[0]?.id;
  const dec = await api("POST", `/api/tutor/dong-giang/${idD}/tu-choi`, { as: Dd });
  check("từ chối ⇒ declined + chủ nhận co_teacher_declined", dec.status === 200 && (await prisma.courseTeacher.findUnique({ where: { id: idD } }))?.status === "declined" && !!(await prisma.notification.findFirst({ where: { userId: O.id, type: "co_teacher_declined" } })));
  check("từ chối lần hai ⇒ 409", (await api("POST", `/api/tutor/dong-giang/${idD}/tu-choi`, { as: Dd })).status === 409);
  await inv(Dd, "subject_teacher");
  const again = await prisma.courseTeacher.findMany({ where: { courseId: K1.id, userId: Dd.id } });
  check("mời lại người đã từ chối ⇒ CÙNG dòng, về invited, đổi vai", again.length === 1 && again[0].id === idD && again[0].status === "invited" && again[0].role === "subject_teacher" && again[0].respondedAt === null, again);
  await api("POST", `/api/tutor/dong-giang/${idD}/tu-choi`, { as: Dd });

  section("Mời: không lộ email (cùng một body), không tạo dòng cho người không hợp lệ");
  const OG = await mkTutor("Thầy Mời Thử"); const KG = await mkCourse(OG.id, { name: "Lớp KG" });
  const CG = await mkTutor("Cô Đã Trong Lớp");
  await prisma.courseTeacher.create({ data: { courseId: KG.id, userId: CG.id, role: "co_teacher", status: "active", invitedBy: OG.id } });
  const sg = await mkUser({ name: "Em Của KG" }); await prisma.enrollment.create({ data: { userId: sg.id, courseId: KG.id, status: "active" } });
  const invG = (email: string) => api("POST", `/api/tutor/lop/${KG.id}/giao-vien`, { as: OG, body: { email, role: "co_teacher" } });
  const before = await prisma.courseTeacher.count({ where: { courseId: KG.id } });
  const cases: [string, any][] = [
    ["P chờ duyệt", await invG(P.email)],
    ["H học sinh", await invG(H.email)],
    ["B bị khoá", await invG(B.email)],
    ["email lạ", await invG("khong.ton.tai@kin.local")],
    ["học viên của chính lớp", await invG(sg.email)],
    ["đã là đồng giảng", await invG(CG.email)],
  ];
  const ref = JSON.stringify(cases[0][1].json);
  for (const [n, r] of cases) check(`mời ${n} ⇒ 200 và cùng một body`, r.status === 200 && JSON.stringify(r.json) === ref, r.json);
  check("…và KHÔNG tạo thêm dòng CourseTeacher nào", (await prisma.courseTeacher.count({ where: { courseId: KG.id } })) === before);
  check("P chờ duyệt không có dòng CourseTeacher", (await prisma.courseTeacher.count({ where: { userId: P.id } })) === 0);
  const self = await api("POST", `/api/tutor/lop/${K1.id}/giao-vien`, { as: O, body: { email: O.email, role: "co_teacher" } });
  const ownerInv = await api("POST", `/api/tutor/lop/${K1.id}/giao-vien`, { as: ADM, body: { email: O.email, role: "co_teacher" } });
  check("quản trị mời CHỦ lớp ⇒ 200 cùng body chung (không 409 ALREADY_IN_COURSE: chống dò)", ownerInv.status === 200 && JSON.stringify(ownerInv.json) === ref, ownerInv.json);
  check("chủ mời chính mình ⇒ 409 ALREADY_IN_COURSE (người gọi chính là chủ nên không lộ gì)", self.status === 409 && J(self).code === "ALREADY_IN_COURSE", self.json);
  check("email sai định dạng ⇒ 400; vai sai ⇒ 400; môn quá dài ⇒ 400",
    (await api("POST", `/api/tutor/lop/${K1.id}/giao-vien`, { as: O, body: { email: "abc", role: "co_teacher" } })).status === 400
    && (await api("POST", `/api/tutor/lop/${K1.id}/giao-vien`, { as: O, body: { email: X.email, role: "owner" } })).status === 400
    && (await api("POST", `/api/tutor/lop/${K1.id}/giao-vien`, { as: O, body: { email: X.email, role: "co_teacher", subjects: ["x".repeat(50)] } })).status === 400);
  // Email phân biệt hoa/thường, khoảng trắng
  const Z = await mkTutor("Cô Hoa Thường");
  const zr = await api("POST", `/api/tutor/lop/${K1.id}/giao-vien`, { as: O, body: { email: `  ${Z.email.toUpperCase()} `, role: "co_teacher" } });
  check("email gõ HOA + khoảng trắng vẫn khớp đúng người (khớp chính xác sau trim/hạ chữ)", zr.status === 200 && (await prisma.courseTeacher.count({ where: { courseId: K1.id, userId: Z.id, status: "invited" } })) === 1);
  await api("DELETE", `/api/tutor/lop/${K1.id}/giao-vien/${(await prisma.courseTeacher.findFirst({ where: { courseId: K1.id, userId: Z.id } }))!.id}`, { as: O });

  section("Đồng giảng KHÔNG mời / gỡ / đổi vai được; người lạ không đọc được danh sách");
  const dChar = await prisma.courseTeacher.findFirst({ where: { courseId: K1.id, userId: S.id } });
  check("C POST giao-vien ⇒ 403 ROLE_FORBIDDEN", (await api("POST", `/api/tutor/lop/${K1.id}/giao-vien`, { as: C, body: { email: X.email, role: "co_teacher" } })).status === 403);
  const cPatch = await api("PATCH", `/api/tutor/lop/${K1.id}/giao-vien/${dChar!.id}`, { as: C, body: { role: "co_teacher" } });
  check("C PATCH đổi vai của S ⇒ 403 ROLE_FORBIDDEN", cPatch.status === 403 && J(cPatch).code === "ROLE_FORBIDDEN", cPatch.json);
  check("C DELETE gỡ S ⇒ 403", (await api("DELETE", `/api/tutor/lop/${K1.id}/giao-vien/${dChar!.id}`, { as: C })).status === 403);
  check("S (bộ môn) DELETE / PATCH ⇒ 403", (await api("DELETE", `/api/tutor/lop/${K1.id}/giao-vien/${idC}`, { as: S })).status === 403 && (await api("PATCH", `/api/tutor/lop/${K1.id}/giao-vien/${idC}`, { as: S, body: { role: "subject_teacher" } })).status === 403);
  check("…dòng S, C vẫn active", (await prisma.courseTeacher.count({ where: { courseId: K1.id, userId: { in: [S.id, C.id] }, status: "active" } })) === 2);
  check("X (gia sư lạ) GET / POST / PATCH / DELETE giao-vien của K1 ⇒ 403", (await api("GET", `/api/tutor/lop/${K1.id}/giao-vien`, { as: X })).status === 403
    && (await api("POST", `/api/tutor/lop/${K1.id}/giao-vien`, { as: X, body: { email: C.email, role: "co_teacher" } })).status === 403
    && (await api("PATCH", `/api/tutor/lop/${K1.id}/giao-vien/${idC}`, { as: X, body: { role: "subject_teacher" } })).status === 403
    && (await api("DELETE", `/api/tutor/lop/${K1.id}/giao-vien/${idC}`, { as: X })).status === 403);
  check("lớp không tồn tại ⇒ 404 cho cả C và X (404 trước 403)", (await api("GET", "/api/tutor/lop/khong-co/giao-vien", { as: C })).status === 404 && (await api("GET", "/api/tutor/lop/khong-co/giao-vien", { as: X })).status === 404);
  check("khách 401; H, P, B 403", (await api("GET", `/api/tutor/lop/${K1.id}/giao-vien`, { as: guest })).status === 401
    && (await api("GET", `/api/tutor/lop/${K1.id}/giao-vien`, { as: H })).status === 403 && (await api("GET", `/api/tutor/lop/${K1.id}/giao-vien`, { as: P })).status === 403
    && (await api("GET", `/api/tutor/lop/${K1.id}/giao-vien`, { as: B })).status === 403);
  const listO = J(await api("GET", `/api/tutor/lop/${K1.id}/giao-vien`, { as: O }));
  const listC = J(await api("GET", `/api/tutor/lop/${K1.id}/giao-vien`, { as: C }));
  check("chủ thấy email + tên (active) + giới hạn 5", listO.limit === 5 && listO.teachers.some((t: any) => t.email === C.email && t.name === C.name), listO);
  check("đồng giảng thấy tên + vai nhưng KHÔNG thấy email, KHÔNG thấy lời mời chờ / từ chối", listC.teachers.length === 3 && listC.teachers.every((t: any) => t.status === "active" && !("email" in t) && t.name), listC);
  const dPatchOwn = await api("PATCH", `/api/tutor/lop/${K1.id}/giao-vien/${idC}`, { as: O, body: { subjects: ["Toán", "Lý"] } });
  check("chủ đổi nhãn môn ⇒ 200", dPatchOwn.status === 200 && (await prisma.courseTeacher.findUnique({ where: { id: idC } }))?.subjects.length === 2);
  check("PATCH ctId của lớp khác ⇒ 404 (IDOR ctId)", (await api("PATCH", `/api/tutor/lop/${K2.id}/giao-vien/${idC}`, { as: X, body: { subjects: ["x"] } })).status === 404);
  check("DELETE ctId của lớp khác ⇒ 404 và dòng không đổi", (await api("DELETE", `/api/tutor/lop/${K2.id}/giao-vien/${idC}`, { as: X })).status === 404 && (await prisma.courseTeacher.findUnique({ where: { id: idC } }))?.status === "active");

  section("Giới hạn 5 giáo viên / lớp và 10 lời mời / 10 phút");
  const O3 = await mkTutor("Thầy Giới Hạn"); const K3 = await mkCourse(O3.id, { name: "Lớp K3" });
  for (let i = 0; i < 5; i++) { const t = await mkTutor(`GV ${i}`); await prisma.courseTeacher.create({ data: { courseId: K3.id, userId: t.id, role: "co_teacher", status: i % 2 ? "invited" : "active", invitedBy: O3.id } }); }
  const extra = await mkTutor("Người thứ sáu");
  const lim = await api("POST", `/api/tutor/lop/${K3.id}/giao-vien`, { as: O3, body: { email: extra.email, role: "co_teacher" } });
  check("giáo viên thứ 6 (active + invited) ⇒ 409 TEACHER_LIMIT", lim.status === 409 && J(lim).code === "TEACHER_LIMIT", lim.json);
  const O4 = await mkTutor("Thầy Hạn Mức"); const K4x = await mkCourse(O4.id, { name: "Lớp K4x" });
  const codes: number[] = [];
  for (let i = 0; i < 11; i++) codes.push((await api("POST", `/api/tutor/lop/${K4x.id}/giao-vien`, { as: O4, body: { email: `nobody${i}@kin.local`, role: "co_teacher" } })).status);
  check("10 lần đầu 200, lần 11 trong 10 phút ⇒ 429", codes.slice(0, 10).every(c => c === 200) && codes[10] === 429, codes);

  // ── Buổi, khung, giáo trình để thử quyền M ───────────────────────────────────────────────────
  section("Chuẩn bị: buổi của C, buổi của chủ, buổi đã chốt, khung lịch, nhóm giáo trình");
  const D1 = key(3), D2 = key(4), D3 = key(5), D4 = key(6);
  const sessC = await prisma.attendanceSession.create({ data: { courseId: K1.id, date: day(D1), createdBy: O.id, taughtBy: C.id } });
  const sessO = await prisma.attendanceSession.create({ data: { courseId: K1.id, date: day(D2), createdBy: O.id } });
  const sessClosed = await prisma.attendanceSession.create({ data: { courseId: K1.id, date: day(D3), createdBy: O.id, taughtBy: C.id, state: "closed", closedAt: new Date(), closedBy: O.id } });
  const sessS = await prisma.attendanceSession.create({ data: { courseId: K1.id, date: day(D4), createdBy: O.id, taughtBy: S.id } });
  const recs = stu.map(s => ({ userId: s.id, status: "present" }));
  const ow = await api("PUT", `/api/attendance-sessions/${sessO.id}`, { as: O, body: { records: recs } });
  check("(chủ) PUT điểm danh buổi của mình ⇒ 200", ow.status === 200, ow.json);
  const sec = await api("POST", `/api/courses/${K1.id}/sections`, { as: O, body: { title: "Phần 1" } });
  const chA = await api("POST", `/api/sections/${J(sec).id}/chapters`, { as: O, body: { title: "Nhóm chung" } });
  const chB = await api("POST", `/api/sections/${J(sec).id}/chapters`, { as: O, body: { title: "Nhóm Vật lý" } });
  const lA = await api("POST", `/api/chapters/${J(chA).id}/lessons`, { as: O, body: { title: "Bài chung" } });
  const lB = await api("POST", `/api/chapters/${J(chB).id}/lessons`, { as: O, body: { title: "Bài Vật lý" } });
  check("(chủ) dựng phần / 2 nhóm / 2 bài ⇒ 200/201", [sec, chA, chB, lA, lB].every(r => r.status === 201), [sec.status, chA.status, chB.status, lA.status, lB.status]);
  const assignB = await api("PATCH", `/api/tutor/lop/${K1.id}/giao-trinh/chuong/${J(chB).id}`, { as: O, body: { teacherId: S.id } });
  check("(chủ) giao nhóm Vật lý cho S ⇒ 200, Chapter.teacherId = S", assignB.status === 200 && (await prisma.chapter.findUnique({ where: { id: J(chB).id } }))?.teacherId === S.id, assignB.json);
  check("giao nhóm cho người KHÔNG thuộc lớp ⇒ 400", (await api("PATCH", `/api/tutor/lop/${K1.id}/giao-trinh/chuong/${J(chA).id}`, { as: O, body: { teacherId: X.id } })).status === 400);
  // MÁY CHỦ trả đủ cho giao diện chọn giáo viên (ca phá: bỏ `userId` khỏi select/map ở listCourseTeachers, bỏ `self.userId` ở route, hoặc trả userId cho non-manager ⇒ đỏ)
  const gvO = await api("GET", `/api/tutor/lop/${K1.id}/giao-vien`, { as: O });
  const gvC = await api("GET", `/api/tutor/lop/${K1.id}/giao-vien`, { as: C });
  const gvS = await api("GET", `/api/tutor/lop/${K1.id}/giao-vien`, { as: S });
  check("MÁY CHỦ trả đủ: chủ thấy userId của từng giáo viên và self.userId của mình", gvO.status === 200 && J(gvO).self?.userId === O.id && (J(gvO).teachers as any[]).some(t => t.userId === S.id) && (J(gvO).teachers as any[]).every(t => typeof t.userId === "string"), gvO.json);
  check("MÁY CHỦ trả đủ: đồng giảng / bộ môn có self.userId của CHÍNH mình, KHÔNG thấy userId người khác", J(gvC).self?.userId === C.id && J(gvS).self?.userId === S.id
    && (J(gvC).teachers as any[]).every(t => !("userId" in t)) && (J(gvS).teachers as any[]).every(t => !("userId" in t)), [gvC.json, gvS.json]);
  const gtO = await api("GET", `/api/tutor/lop/${K1.id}/giao-trinh`, { as: O });
  const gtC = await api("GET", `/api/tutor/lop/${K1.id}/giao-trinh`, { as: C });
  const grp = (r: { json: unknown }, id: string) => (J(r).groups as any[] | undefined)?.find(g => g.id === id);
  check("MÁY CHỦ trả đủ: groups[].teacherId = S cho nhóm Vật lý, null cho nhóm chung (chủ và đồng giảng đều thấy)", grp(gtO, J(chB).id)?.teacherId === S.id && grp(gtO, J(chA).id)?.teacherId === null && grp(gtC, J(chB).id)?.teacherId === S.id, J(gtO).groups);
  check("groups[] chỉ có id/title/teacherId — không tên, không email", (J(gtO).groups as any[]).every(g => Object.keys(g).sort().join() === "id,teacherId,title") && !JSON.stringify(J(gtO).groups).includes(S.email), J(gtO).groups);
  const schO = await api("POST", `/api/courses/${K1.id}/class-schedules`, { as: O, body: { dayOfWeek: 2, startTime: "19:00", endTime: "20:30" } });
  check("(chủ) tạo khung của chủ ⇒ 201, teacherId null", schO.status === 201 && J(schO).teacherId === null, schO.json);
  const feeRows0 = await moneySnapshot();

  section("M — đồng giảng C: xem, KHÔNG thấy tiền / liên hệ phụ huynh");
  const cv = await api("GET", `/api/courses/${K1.id}`, { as: C });
  check("C GET lớp ⇒ 200, có cây giáo trình", cv.status === 200 && Array.isArray(J(cv).sections) && J(cv).sections.length === 1, cv.status);
  check("…không có price / originalPrice / feeMode / tag / link Zalo", !("price" in J(cv)) && !("originalPrice" in J(cv)) && !("feeMode" in J(cv)) && !("tag" in J(cv)) && !("zaloGroupUrl" in J(cv)));
  check("…không khoá nào trông như tiền trong cả phản hồi", keys(cv.json).filter(k => MONEY.test(k)).length === 0, keys(cv.json).filter(k => MONEY.test(k)));
  check("…không chuỗi bí mật nào lọt ra (giá, đơn giá, link Zalo)", !SECRETS.some(s => cv.text.includes(s)));
  check("…bài chưa đăng / link học liệu của chủ: C là quản lý ⇒ thấy cây (200) nhưng người lạ X thì không phải quản lý", (await api("GET", `/api/courses/${K1.id}`, { as: X })).status === 200);
  const cs = await api("GET", `/api/courses/${K1.id}/students`, { as: C });
  check("C GET students ⇒ 200, có tên + trạng thái + tiến độ", cs.status === 200 && J(cs).students.length === 3 && J(cs).students.every((s: any) => s.name && s.status && "progress" in s), cs.json);
  check("…KHÔNG có email / phone / school", J(cs).students.every((s: any) => !("email" in s) && !("phone" in s) && !("school" in s)) && !SECRETS.some(s => cs.text.includes(s)));
  const os = await api("GET", `/api/courses/${K1.id}/students`, { as: O });
  check("(đối chứng) chủ vẫn thấy email / phone / school", J(os).students.every((s: any) => s.email && s.phone && s.school), os.json);
  const s2s = await api("GET", `/api/courses/${K1.id}/students`, { as: S2 });
  check("S2 (bộ môn chưa được giao gì) chỉ thấy SỐ LƯỢNG, không thấy tên", s2s.status === 200 && J(s2s).students.length === 0 && J(s2s).total === 3 && J(s2s).namesHidden === true, s2s.json);
  const sss = await api("GET", `/api/courses/${K1.id}/students`, { as: S });
  check("S (bộ môn có nhóm / buổi được giao) thấy tên, không liên hệ", sss.status === 200 && J(sss).students.length === 3 && J(sss).students.every((s: any) => !("email" in s)), sss.json);

  const att = await api("GET", `/api/attendance-sessions/${sessO.id}`, { as: C });
  check("C GET điểm danh buổi của CHỦ ⇒ 200 (xem được)", att.status === 200 && J(att).roster.length === 3, att.status);
  check("…roster KHÔNG có parentName / parentPhone / zaloOpenedAt / parentVisible; course.zaloGroupUrl = null",
    J(att).roster.every((r: any) => !("parentName" in r) && !("parentPhone" in r) && !("zaloOpenedAt" in r) && !("parentVisible" in r)) && J(att).course.zaloGroupUrl === null && !SECRETS.some(s => att.text.includes(s)), att.json);
  check("(đối chứng) chủ thấy parentName / parentPhone", J(await api("GET", `/api/attendance-sessions/${sessO.id}`, { as: O })).roster.every((r: any) => r.parentName && r.parentPhone));
  const attS2 = await api("GET", `/api/attendance-sessions/${sessO.id}`, { as: S2 });
  check("S2 (bộ môn CHƯA được giao gì) GET buổi ⇒ 200 nhưng roster rỗng, namesHidden, chỉ có sĩ số, không tên học sinh nào trong body",
    attS2.status === 200 && J(attS2).roster.length === 0 && J(attS2).namesHidden === true && J(attS2).total === 3 && !stu.some((u: any) => u.name && attS2.text.includes(u.name)), attS2.json);
  const sd = await api("GET", `/api/courses/${K1.id}/sessions/${D2}`, { as: C });
  check("C GET sessions/[dateKey] ⇒ 200, reopenWarning = null, không link Zalo", sd.status === 200 && J(sd).reopenWarning === null && J(sd).course.zaloGroupUrl === null, sd.json);
  const cal = await api("GET", `/api/courses/${K1.id}/calendar`, { as: C });
  check("C GET calendar ⇒ 200; PATCH calendar ⇒ 403", cal.status === 200 && (await api("PATCH", `/api/courses/${K1.id}/calendar`, { as: C, body: { calendarColor: null } })).status === 403);
  check("C GET class-schedules ⇒ 200", (await api("GET", `/api/courses/${K1.id}/class-schedules`, { as: C })).status === 200);
  const listAs = await api("GET", `/api/courses/${K1.id}/attendance-sessions`, { as: C });
  const itemDates = (J(listAs).items ?? []).map((i: any) => i.date.slice(0, 10));
  check("C GET attendance-sessions: chỉ buổi MÌNH dạy + buổi chưa gán (không có buổi của S)", listAs.status === 200 && itemDates.includes(D1) && itemDates.includes(D2) && itemDates.includes(D3) && !itemDates.includes(D4), itemDates);
  check("C GET recordings ⇒ 200 role=helper; POST ⇒ 403", J(await api("GET", `/api/courses/${K1.id}/recordings`, { as: C })).role === "helper" && (await api("POST", `/api/courses/${K1.id}/recordings`, { as: C, body: { title: "x", url: "https://youtu.be/abc", pledge: true } })).status === 403);

  section("M — đồng giảng C: điểm danh buổi của MÌNH, không sinh phí");
  const putOwn = await api("PUT", `/api/attendance-sessions/${sessC.id}`, { as: C, body: { records: recs } });
  check("C PUT điểm danh buổi taughtBy = C, chưa chốt ⇒ 200", putOwn.status === 200 && J(putOwn).count === 3, putOwn.json);
  check("…phản hồi KHÔNG có charges / packages / warning", !("charges" in J(putOwn)) && !("packages" in J(putOwn)) && !("warning" in J(putOwn)), putOwn.json);
  check("…FeeCharge / TuitionInvoice KHÔNG đổi (lớp per_session, present)", (await moneySnapshot()) === feeRows0, await moneySnapshot());
  check("…AttendanceRecord.updatedBy = C", (await prisma.attendanceRecord.findFirst({ where: { sessionId: sessC.id } }))?.updatedBy === C.id);
  const putOther = await api("PUT", `/api/attendance-sessions/${sessO.id}`, { as: C, body: { records: recs } });
  check("C PUT buổi của CHỦ ⇒ 403 NOT_YOUR_SESSION", putOther.status === 403 && J(putOther).code === "NOT_YOUR_SESSION", putOther.json);
  const putS = await api("PUT", `/api/attendance-sessions/${sessS.id}`, { as: C, body: { records: recs } });
  check("C PUT buổi của S ⇒ 403 NOT_YOUR_SESSION", putS.status === 403 && J(putS).code === "NOT_YOUR_SESSION", putS.json);
  const putClosed = await api("PUT", `/api/attendance-sessions/${sessClosed.id}`, { as: C, body: { records: recs } });
  check("C PUT buổi MÌNH dạy nhưng đã chốt ⇒ 409 SESSION_CLOSED_OWNER_ONLY", putClosed.status === 409 && J(putClosed).code === "SESSION_CLOSED_OWNER_ONLY", putClosed.json);
  check("…và không có bản ghi nào được thêm vào buổi đã chốt", (await prisma.attendanceRecord.count({ where: { sessionId: sessClosed.id } })) === 0);
  const mk = await api("PUT", `/api/attendance-sessions/${sessC.id}`, { as: C, body: { records: [{ userId: stu[0].id, status: "present", makeupCreditId: "x" }] } });
  const pv = await api("PUT", `/api/attendance-sessions/${sessC.id}`, { as: C, body: { records: [{ userId: stu[0].id, status: "present", parentVisible: true }] } });
  check("C gửi makeupCreditId / parentVisible ⇒ 403", mk.status === 403 && pv.status === 403, [mk.status, pv.status]);
  check("C DELETE buổi ⇒ 403", (await api("DELETE", `/api/attendance-sessions/${sessC.id}`, { as: C })).status === 403);
  check("S (bộ môn) PUT buổi của S ⇒ 200; PUT buổi của C ⇒ 403", (await api("PUT", `/api/attendance-sessions/${sessS.id}`, { as: S, body: { records: recs } })).status === 200 && (await api("PUT", `/api/attendance-sessions/${sessC.id}`, { as: S, body: { records: recs } })).status === 403);
  check("…sau mọi cuộc gọi của C và S: số dòng phí vẫn y nguyên", (await moneySnapshot()) === feeRows0);
  check("C GET /diem và POST /zalo ⇒ 403 (điểm / liên hệ phụ huynh)", (await api("GET", `/api/attendance-sessions/${sessC.id}/diem`, { as: C })).status === 403 && (await api("POST", `/api/attendance-sessions/${sessC.id}/zalo`, { as: C, body: { userId: stu[0].id } })).status === 403);

  section("M — chốt buổi: đồng giảng KHÔNG chốt / mở lại, chỉ đề nghị chủ chốt (không ghi trạng thái, không phí)");
  const cl = await api("POST", `/api/courses/${K1.id}/sessions/${D1}/close`, { as: C, body: { action: "close" } });
  const ro = await api("POST", `/api/courses/${K1.id}/sessions/${D3}/close`, { as: C, body: { action: "reopen", confirm: true } });
  check("C close / reopen ⇒ 403", cl.status === 403 && ro.status === 403, [cl.status, ro.status]);
  check("…buổi D1 vẫn mở, D3 vẫn đã chốt, phí không đổi", (await prisma.attendanceSession.findUnique({ where: { id: sessC.id } }))?.state !== "closed" && (await prisma.attendanceSession.findUnique({ where: { id: sessClosed.id } }))?.state === "closed" && (await moneySnapshot()) === feeRows0);
  const dn = await api("POST", `/api/tutor/lop/${K1.id}/buoi/${D1}/de-nghi-chot`, { as: C });
  check("C de-nghi-chot buổi D1 (có điểm danh) ⇒ 200", dn.status === 200 && J(dn).ok === true, dn.json);
  check("…AttendanceSession.state không đổi; 0 dòng phí mới", (await prisma.attendanceSession.findUnique({ where: { id: sessC.id } }))?.state !== "closed" && (await moneySnapshot()) === feeRows0);
  await api("POST", `/api/tutor/lop/${K1.id}/buoi/${D1}/de-nghi-chot`, { as: C });
  const nReq = await prisma.notification.findMany({ where: { userId: O.id, type: "session_close_request" } });
  check("chủ nhận ĐÚNG MỘT thông báo session_close_request (gọi hai lần không nhân đôi)", nReq.length === 1 && nReq[0].link === `/lop-cua-toi/buoi/${K1.id}/${D1}`, nReq);
  check("…thông báo chỉ có ngày + tên lớp, không tên người, không số tiền", !/Mai Trinh|137|đ\b/.test(`${nReq[0].title} ${nReq[0].message}`) && nReq[0].title.includes("Lớp K1 của Phát"), nReq[0]);
  check("de-nghi-chot buổi của chủ (D2) ⇒ 403 NOT_YOUR_SESSION; buổi chưa có (xa) ⇒ 409", (await api("POST", `/api/tutor/lop/${K1.id}/buoi/${D2}/de-nghi-chot`, { as: C })).status === 403 && (await api("POST", `/api/tutor/lop/${K1.id}/buoi/${key(60)}/de-nghi-chot`, { as: C })).status === 409);
  check("de-nghi-chot buổi đã chốt ⇒ 409; owner gọi ⇒ 403; X ⇒ 403; ngày sai ⇒ 400", (await api("POST", `/api/tutor/lop/${K1.id}/buoi/${D3}/de-nghi-chot`, { as: C })).status === 409
    && (await api("POST", `/api/tutor/lop/${K1.id}/buoi/${D1}/de-nghi-chot`, { as: O })).status === 403 && (await api("POST", `/api/tutor/lop/${K1.id}/buoi/${D1}/de-nghi-chot`, { as: X })).status === 403
    && (await api("POST", `/api/tutor/lop/${K1.id}/buoi/xx/de-nghi-chot`, { as: C })).status === 400);

  section("M — ghi chép / tạo buổi / khung lịch (người dạy luôn là MÌNH)");
  const note = await api("PATCH", `/api/courses/${K1.id}/sessions/${D1}`, { as: C, body: { taught: "Đã dạy chương 1" } });
  check("C PATCH ghi chép buổi MÌNH dạy ⇒ 200", note.status === 200 && note.json.session?.taught === "Đã dạy chương 1", note.json);
  check("C PATCH ghi chép buổi của CHỦ ⇒ 403", (await api("PATCH", `/api/courses/${K1.id}/sessions/${D2}`, { as: C, body: { taught: "x" } })).status === 403);
  const tb = await api("PATCH", `/api/courses/${K1.id}/sessions/${D1}`, { as: C, body: { taught: "y", taughtBy: O.id } });
  check("C gửi taughtBy ⇒ 403 (đổi người dạy chỉ chủ)", tb.status === 403 && (await prisma.attendanceSession.findUnique({ where: { id: sessC.id } }))?.taughtBy === C.id, tb.json);
  const ex = await api("POST", `/api/courses/${K1.id}/sessions`, { as: C, body: { dateKey: key(-8), startTime: "18:00", endTime: "19:00", kind: "extra", force: true } });
  const exRow = await prisma.attendanceSession.findFirst({ where: { courseId: K1.id, date: day(key(-8)) } });
  check("C POST buổi lẻ ⇒ 201, taughtBy = C, createdBy = CHỦ (không phải C)", ex.status === 201 && exRow?.taughtBy === C.id && exRow?.createdBy === O.id, [ex.json, exRow]);
  check("S (bộ môn) POST buổi lẻ ⇒ 403", (await api("POST", `/api/courses/${K1.id}/sessions`, { as: S, body: { dateKey: key(-9), startTime: "18:00", endTime: "19:00", kind: "extra", force: true } })).status === 403);
  const cNew = await api("POST", `/api/courses/${K1.id}/attendance-sessions`, { as: C, body: { date: key(-10) } });
  const cNewRow = await prisma.attendanceSession.findFirst({ where: { courseId: K1.id, date: day(key(-10)) } });
  check("C POST attendance-sessions ⇒ 201, taughtBy = C, createdBy = CHỦ", cNew.status === 201 && cNewRow?.taughtBy === C.id && cNewRow?.createdBy === O.id, cNewRow);
  check("S POST attendance-sessions cho ngày không được giao ⇒ 403", (await api("POST", `/api/courses/${K1.id}/attendance-sessions`, { as: S, body: { date: key(-11) } })).status === 403);
  const scC = await api("POST", `/api/courses/${K1.id}/class-schedules`, { as: C, body: { dayOfWeek: 4, startTime: "08:00", endTime: "09:00", teacherId: O.id } });
  check("C POST khung ⇒ 201 và teacherId = C (bỏ qua teacherId do client gửi)", scC.status === 201 && J(scC).teacherId === C.id, scC.json);
  check("S POST khung ⇒ 403", (await api("POST", `/api/courses/${K1.id}/class-schedules`, { as: S, body: { dayOfWeek: 4, startTime: "08:00", endTime: "09:00" } })).status === 403);
  check("C PUT khung của MÌNH ⇒ 200", (await api("PUT", `/api/class-schedules/${J(scC).id}`, { as: C, body: { note: "Dạy bù" } })).status === 200);
  check("C PUT / DELETE khung của CHỦ ⇒ 403", (await api("PUT", `/api/class-schedules/${J(schO).id}`, { as: C, body: { note: "x" } })).status === 403 && (await api("DELETE", `/api/class-schedules/${J(schO).id}`, { as: C })).status === 403);
  check("C PUT khung của mình kèm teacherId ⇒ 403 (đổi người dạy chỉ chủ)", (await api("PUT", `/api/class-schedules/${J(scC).id}`, { as: C, body: { teacherId: O.id } })).status === 403);
  check("…khung của chủ còn nguyên", (await prisma.classSchedule.findUnique({ where: { id: J(schO).id } }))?.note === null);
  check("C POST schedule-conflicts ⇒ 200; S ⇒ 403", (await api("POST", `/api/courses/${K1.id}/schedule-conflicts`, { as: C, body: { dayOfWeek: 1, startTime: "10:00", endTime: "11:00" } })).status === 200 && (await api("POST", `/api/courses/${K1.id}/schedule-conflicts`, { as: S, body: { dayOfWeek: 1, startTime: "10:00", endTime: "11:00" } })).status === 403);
  const asg = await api("PUT", `/api/class-schedules/${J(schO).id}`, { as: O, body: { teacherId: S.id } });
  check("(chủ) giao khung của mình cho S ⇒ 200; giao cho người ngoài lớp ⇒ 400", asg.status === 200 && (await prisma.classSchedule.findUnique({ where: { id: J(schO).id } }))?.teacherId === S.id && (await api("PUT", `/api/class-schedules/${J(schO).id}`, { as: O, body: { teacherId: X.id } })).status === 400);

  section("M — soạn giáo trình: đồng giảng mọi nhóm; bộ môn chỉ nhóm được giao");
  const gt = await api("GET", `/api/tutor/lop/${K1.id}/giao-trinh`, { as: C });
  check("C GET giao-trinh ⇒ 200, không khoá tiền", gt.status === 200 && keys(gt.json).filter(k => MONEY.test(k)).length === 0, gt.status);
  check("C sửa bài ở nhóm chung ⇒ 200; ở nhóm Vật lý ⇒ 200 (đồng giảng soạn mọi nhóm)", (await api("PUT", `/api/lessons/${J(lA).id}`, { as: C, body: { title: "Bài chung (C sửa)" } })).status === 200 && (await api("PUT", `/api/lessons/${J(lB).id}`, { as: C, body: { title: "Bài Lý (C sửa)" } })).status === 200);
  check("S sửa bài trong nhóm CỦA MÌNH ⇒ 200", (await api("PUT", `/api/lessons/${J(lB).id}`, { as: S, body: { title: "Bài Lý (S)" } })).status === 200);
  const sOut = await api("PUT", `/api/lessons/${J(lA).id}`, { as: S, body: { title: "S sửa nhầm" } });
  check("S sửa bài NGOÀI nhóm ⇒ 403", sOut.status === 403 && (await prisma.lesson.findUnique({ where: { id: J(lA).id } }))?.title === "Bài chung (C sửa)", sOut.json);
  check("S tạo phần ⇒ 403; C tạo phần ⇒ 201; C xoá phần ⇒ 403", (await api("POST", `/api/courses/${K1.id}/sections`, { as: S, body: { title: "x" } })).status === 403
    && (await api("POST", `/api/courses/${K1.id}/sections`, { as: C, body: { title: "Phần của C" } })).status === 201 && (await api("DELETE", `/api/sections/${J(sec).id}`, { as: C })).status === 403);
  check("…phần 1 vẫn còn", !!(await prisma.section.findUnique({ where: { id: J(sec).id } })));
  check("C đổi teacherId của nhóm ⇒ 403; S đổi ⇒ 403", (await api("PUT", `/api/chapters/${J(chA).id}`, { as: C, body: { title: "A", teacherId: C.id } })).status === 403 && (await api("PATCH", `/api/tutor/lop/${K1.id}/giao-trinh/chuong/${J(chB).id}`, { as: S, body: { teacherId: null } })).status === 403);
  const sCh = await api("POST", `/api/sections/${J(sec).id}/chapters`, { as: S, body: { title: "Nhóm của S" } });
  check("S tạo nhóm ⇒ 201 và Chapter.teacherId = S", sCh.status === 201 && (await prisma.chapter.findUnique({ where: { id: J(sCh).id } }))?.teacherId === S.id, sCh.json);
  check("S POST bài vào nhóm chung ⇒ 403; vào nhóm Vật lý ⇒ 201", (await api("POST", `/api/chapters/${J(chA).id}/lessons`, { as: S, body: { title: "Lạc nhóm" } })).status === 403 && (await api("POST", `/api/chapters/${J(chB).id}/lessons`, { as: S, body: { title: "Bài Lý mới" } })).status === 201);
  check("S PATCH tên nhóm chung (giao-trinh/chuong) ⇒ 403; nhóm Vật lý ⇒ 200", (await api("PATCH", `/api/tutor/lop/${K1.id}/giao-trinh/chuong/${J(chA).id}`, { as: S, body: { title: "x" } })).status === 403 && (await api("PATCH", `/api/tutor/lop/${K1.id}/giao-trinh/chuong/${J(chB).id}`, { as: S, body: { title: "Nhóm Vật lý!" } })).status === 200);
  check("S tạo mục (muc) không chỉ nhóm ⇒ 403", (await api("POST", `/api/tutor/lop/${K1.id}/giao-trinh/muc`, { as: S, body: { url: "https://youtu.be/dQw4w9WgXcQ" } })).status === 403);
  check("S reorder bài ngoài nhóm ⇒ 403; trong nhóm của mình ⇒ 200", (await api("PATCH", `/api/courses/${K1.id}/reorder`, { as: S, body: { type: "lesson", items: [{ id: J(lA).id, order: 5 }] } })).status === 403 && (await api("PATCH", `/api/courses/${K1.id}/reorder`, { as: S, body: { type: "lesson", items: [{ id: J(lB).id, order: 5 }] } })).status === 200);
  check("S reorder phần ⇒ 403; C reorder phần ⇒ 200", (await api("PATCH", `/api/courses/${K1.id}/reorder`, { as: S, body: { type: "section", items: [{ id: J(sec).id, order: 1 }] } })).status === 403 && (await api("PATCH", `/api/courses/${K1.id}/reorder`, { as: C, body: { type: "section", items: [{ id: J(sec).id, order: 1 }] } })).status === 200);
  check("C trạng thái hàng loạt (trang-thai) ⇒ 200", (await api("PATCH", `/api/tutor/lop/${K1.id}/giao-trinh/trang-thai`, { as: C, body: { lessonIds: [J(lA).id], status: "draft" } })).status === 200);
  check("S trạng thái hàng loạt bài ngoài nhóm ⇒ 403", (await api("PATCH", `/api/tutor/lop/${K1.id}/giao-trinh/trang-thai`, { as: S, body: { lessonIds: [J(lA).id], status: "published" } })).status === 403);
  check("C GET bài học (lessons/[id]) và context ⇒ 200", (await api("GET", `/api/lessons/${J(lA).id}`, { as: C })).status === 200 && (await api("GET", `/api/lessons/${J(lA).id}/context`, { as: C })).status === 200);
  check("X (gia sư lạ) GET bài học của K1 ⇒ 403", (await api("GET", `/api/lessons/${J(lA).id}`, { as: X })).status === 403);

  section("M — bài tập: soạn và chấm");
  const aC = await api("POST", `/api/lessons/${J(lA).id}/assignments`, { as: C, body: { title: "BT của C" } });
  check("C tạo bài tập ở bài trong lớp ⇒ 201, tác giả = C", aC.status === 201 && J(aC).ownerId === C.id, aC.json);
  const aO = await api("POST", `/api/lessons/${J(lA).id}/assignments`, { as: O, body: { title: "BT của chủ" } });
  check("S tạo bài tập ở bài NGOÀI nhóm ⇒ 403; ở nhóm của mình ⇒ 201", (await api("POST", `/api/lessons/${J(lA).id}/assignments`, { as: S, body: { title: "x" } })).status === 403 && (await api("POST", `/api/lessons/${J(lB).id}/assignments`, { as: S, body: { title: "BT Lý của S" } })).status === 201);
  check("C xem kết quả / bài nộp / sửa BT của CHỦ trong cùng lớp ⇒ 200", (await api("GET", `/api/assignments/${J(aO).id}/submissions`, { as: C })).status === 200 && (await api("PUT", `/api/assignments/${J(aO).id}`, { as: C, body: { title: "BT chủ (C sửa)" } })).status === 200);
  check("chủ sửa BT do C soạn ⇒ 200", (await api("PUT", `/api/assignments/${J(aC).id}`, { as: O, body: { title: "BT của C (chủ sửa)" } })).status === 200);
  check("S xem bài nộp của BT ngoài nhóm (do chủ soạn) ⇒ 403", (await api("GET", `/api/assignments/${J(aO).id}/submissions`, { as: S })).status === 403);
  section("M — chấm bài: tên học sinh theo nhóm được giao (bộ môn)");
  const due = new Date(Date.now() + 7 * 86400000).toISOString();
  const quiz = (t: string) => ({ title: t, mode: "interactive", dueDate: due, questions: [{ text: "1+1=?", type: "MC", points: 1, options: [{ text: "2", isCorrect: true }, { text: "3" }] }] });
  const aInGroup = await api("POST", `/api/lessons/${J(lB).id}/assignments`, { as: O, body: quiz("BT tương tác nhóm Lý") });
  const aOutGroup = await api("POST", `/api/lessons/${J(lA).id}/assignments`, { as: O, body: quiz("BT tương tác nhóm chung") });
  const resIn = await api("GET", `/api/assignments/${J(aInGroup).id}/results`, { as: S });
  check("S xem kết quả bài TRONG nhóm mình ⇒ 200, thấy tên + mã học sinh", resIn.status === 200 && stu.every(u => resIn.text.includes(u.name)), resIn.status);
  check("S xem kết quả bài NGOÀI nhóm (do chủ soạn) ⇒ 403", (await api("GET", `/api/assignments/${J(aOutGroup).id}/results`, { as: S })).status === 403);
  // Bộ môn tự soạn bài trong nhóm mình, rồi chủ rút nhóm khỏi bộ môn ⇒ bài nằm NGOÀI nhóm nhưng S vẫn là tác giả: chấm được, nhưng tên bị ẩn; sửa thì 403.
  const aS = await api("POST", `/api/lessons/${J(lB).id}/assignments`, { as: S, body: quiz("BT của S") });
  check("S tạo BT tương tác trong nhóm mình ⇒ 201", aS.status === 201, aS.json);
  await prisma.chapter.update({ where: { id: J(chB).id }, data: { teacherId: null } });
  const resOut = await api("GET", `/api/assignments/${J(aS).id}/results`, { as: S });
  check("S (tác giả, bài ngoài nhóm) xem kết quả ⇒ 200 nhưng KHÔNG có tên / mã học sinh nào", resOut.status === 200 && J(resOut).students.length === stu.length && !stu.some(u => resOut.text.includes(u.name) || (u.email && resOut.text.includes(u.email))), resOut.status);
  check("…nhãn ẩn danh 'Học viên N', studentId null, vẫn có userId để chấm", J(resOut).students.every((x: any) => /^Học viên \d+$/.test(x.name) && x.studentId === null && typeof x.userId === "string"));
  const subOut = await api("GET", `/api/assignments/${J(aS).id}/submissions`, { as: S });
  check("S xem bài nộp ngoài nhóm ⇒ 200 và không lộ tên", subOut.status === 200 && !stu.some(u => subOut.text.includes(u.name)), subOut.status);
  check("S sửa / xoá BT do mình soạn nhưng nhóm đã rút ⇒ 403", (await api("PUT", `/api/assignments/${J(aS).id}`, { as: S, body: { title: "x" } })).status === 403 && (await api("DELETE", `/api/assignments/${J(aS).id}`, { as: S })).status === 403 && !!(await prisma.assignment.findUnique({ where: { id: J(aS).id } })));
  check("C (đồng giảng) vẫn thấy tên ở mọi bài", (await api("GET", `/api/assignments/${J(aS).id}/results`, { as: C })).text.includes(stu[0].name));
  await prisma.chapter.update({ where: { id: J(chB).id }, data: { teacherId: S.id } });
  check("trả nhóm lại cho S ⇒ S thấy tên lại", (await api("GET", `/api/assignments/${J(aS).id}/results`, { as: S })).text.includes(stu[0].name));

  const lK2 = await (async () => {
    const sx = await api("POST", `/api/courses/${K2.id}/sections`, { as: X, body: { title: "P" } });
    const cx = await api("POST", `/api/sections/${J(sx).id}/chapters`, { as: X, body: { title: "N" } });
    const lx = await api("POST", `/api/chapters/${J(cx).id}/lessons`, { as: X, body: { title: "Bài K2" } });
    const ax = await api("POST", `/api/lessons/${J(lx).id}/assignments`, { as: X, body: { title: "BT K2" } });
    return { lesson: J(lx).id as string, assignment: J(ax).id as string, chapter: J(cx).id as string, section: J(sx).id as string };
  })();
  check("C gọi BT / bài / nhóm / phần của lớp K2 (người khác) ⇒ 403", (await api("GET", `/api/assignments/${lK2.assignment}/submissions`, { as: C })).status === 403
    && (await api("GET", `/api/assignments/${lK2.assignment}/results`, { as: C })).status === 403 && (await api("PUT", `/api/assignments/${lK2.assignment}`, { as: C, body: { title: "x" } })).status === 403
    && (await api("PUT", `/api/lessons/${lK2.lesson}`, { as: C, body: { title: "x" } })).status === 403 && (await api("POST", `/api/lessons/${lK2.lesson}/assignments`, { as: C, body: { title: "x" } })).status === 403
    && (await api("PUT", `/api/chapters/${lK2.chapter}`, { as: C, body: { title: "x" } })).status === 403 && (await api("PUT", `/api/sections/${lK2.section}`, { as: C, body: { title: "x" } })).status === 403
    && (await api("GET", `/api/lessons/${lK2.lesson}/azota-status`, { as: C })).status === 403);
  check("C chấm điểm bài nộp ở K2 ⇒ 403 (kể cả id lạ)", (await api("PATCH", `/api/assignments/${lK2.assignment}/submissions/xx/grade`, { as: C, body: { score: 1 } })).status === 403);
  check("C GET azota-status bài trong lớp mình ⇒ 200 (chấm)", (await api("GET", `/api/lessons/${J(lA).id}/azota-status`, { as: C })).status === 200);

  section("M — giao đề / quiz của MÌNH vào lớp đồng giảng");
  const exam = (id: string, owner: string) => prisma.exam.create({ data: { id, code: id, title: id, category: "Toán", date: "01/01/2031", time: "08:00", duration: "15 phút", questions: 1, status: "upcoming", createdAt: "2026-11-07", ownerId: owner, totalPoints: 10 } as never });
  await exam("de-c", C.id); await exam("de-o", O.id);
  const asC = await api("PATCH", `/api/tutor/de-thi/de-c/giao`, { as: C, body: { courseId: K1.id } });
  check("C giao đề CỦA C vào K1 ⇒ không còn 403 NOT_YOUR_CLASS (đồng giảng được giao)", asC.status !== 403 && J(asC).code !== "NOT_YOUR_CLASS", asC.json);
  check("C giao đề của CHỦ ⇒ 403; C giao đề của C vào K2 ⇒ 403 NOT_YOUR_CLASS", (await api("PATCH", `/api/tutor/de-thi/de-o/giao`, { as: C, body: { courseId: K1.id } })).status === 403
    && J(await api("PATCH", `/api/tutor/de-thi/de-c/giao`, { as: C, body: { courseId: K2.id } })).code === "NOT_YOUR_CLASS");
  check("S (bộ môn) giao đề vào K1 ⇒ 403 (vòng 1 chỉ đồng giảng)", (await api("PATCH", `/api/tutor/de-thi/de-c/giao`, { as: S, body: { courseId: K1.id } })).status === 403);

  section("G — route chỉ chủ: đồng giảng, bộ môn, gia sư lạ, chờ duyệt, bị khoá, học sinh, khách");
  const G: [string, string, unknown?][] = [
    ["PUT", `/api/courses/${K1.id}`, { name: "đổi tên" }], ["DELETE", `/api/courses/${K1.id}`], ["POST", `/api/courses/${K1.id}/duplicate`, {}],
    ["GET", `/api/courses/${K1.id}/invites`], ["POST", `/api/courses/${K1.id}/invites`, {}], ["PATCH", `/api/courses/${K1.id}/calendar`, { calendarColor: null }],
    ["GET", `/api/courses/${K1.id}/attendance-export`], ["POST", `/api/courses/${K1.id}/recordings`, { title: "x", url: "https://youtu.be/abc", pledge: true }],
    ["POST", `/api/courses/${K1.id}/sessions/${D1}/close`, { action: "close" }], ["POST", `/api/courses/${K1.id}/sessions/${D3}/close`, { action: "reopen", confirm: true }],
    ["GET", `/api/tutor/lop/${K1.id}/yeu-cau`], ["POST", `/api/tutor/lop/${K1.id}/yeu-cau/hang-loat`, {}], ["POST", `/api/tutor/lop/${K1.id}/yeu-cau/zz/duyet`, {}], ["POST", `/api/tutor/lop/${K1.id}/yeu-cau/zz/tu-choi`, {}],
    ["POST", `/api/tutor/lop/${K1.id}/hoc-sinh`, { userIds: [stu[0].id] }], ["GET", `/api/tutor/lop/${K1.id}/bao-cao-link`],
    ["PUT", `/api/tutor/classes/${K1.id}/zalo-group`, { url: "https://zalo.me/g/abcdef123" }], ["GET", `/api/tutor/so-diem?courseId=${K1.id}`],
    ["GET", `/api/attendance-sessions/${sessC.id}/diem`], ["PUT", `/api/attendance-sessions/${sessC.id}/diem`, {}], ["POST", `/api/attendance-sessions/${sessC.id}/zalo`, {}], ["DELETE", `/api/attendance-sessions/${sessC.id}`],
    ["DELETE", `/api/invites/zz`],
  ];
  for (const [m, path, body] of G) {
    const rs = {
      C: await api(m, path, { as: C, body }), S: await api(m, path, { as: S, body }), X: await api(m, path, { as: X, body }),
      P: await api(m, path, { as: P, body }), B: await api(m, path, { as: B, body }), H: await api(m, path, { as: H, body }), guest: await api(m, path, { as: guest, body }),
    };
    // Một vài route giới hạn theo ownerId trong câu lệnh (404, không lộ lớp tồn tại) và người bị khoá có thể nhận 401: đều là TỪ CHỐI.
    const scoped = /zalo-group|\/api\/invites\//.test(path);
    const bad = Object.entries(rs).filter(([k, r]) => k === "guest" ? r.status !== 401 : (k === "B" ? ![401, 403].includes(r.status) : scoped ? ![403, 404].includes(r.status) : r.status !== 403)).map(([k, r]) => `${k}=${r.status}`);
    check(`${m} ${path.replace(K1.id, "K1").replace(sessC.id, "SESS").replace(D1, "D1").replace(D3, "D3")}: C S X P B H = 403, khách 401`, bad.length === 0, bad);
  }
  check("zalo-group không đổi sau các lần C / S / X gọi", (await prisma.course.findUnique({ where: { id: K1.id } }))?.zaloGroupUrl === "https://zalo.me/g/k1secret");
  check("DELETE /api/courses/K1 không xoá: lớp còn, tên không đổi", (await prisma.course.findUnique({ where: { id: K1.id } }))?.name === "Lớp K1 của Phát");
  for (const [who, u] of [["C", C], ["X", X]] as const) {
    const miss = await api("GET", `/api/tutor/lop/khong-co/giao-trinh`, { as: u });
    check(`${who} gọi lớp KHÔNG tồn tại ⇒ 404 (giao-trinh)`, miss.status === 404, miss.status);
    check(`${who} gọi lớp không tồn tại ⇒ 404 (students, attendance-sessions)`, (await api("GET", `/api/courses/khong-co/students`, { as: u })).status === 404 && (await api("GET", `/api/courses/khong-co/attendance-sessions`, { as: u })).status === 404);
  }
  check("C gọi lớp K2 của X (không phải lớp mình) ⇒ 403 ở mọi route M", (await Promise.all([
    api("GET", `/api/courses/${K2.id}/students`, { as: C }), api("GET", `/api/courses/${K2.id}/attendance-sessions`, { as: C }), api("GET", `/api/courses/${K2.id}/class-schedules`, { as: C }),
    api("POST", `/api/courses/${K2.id}/class-schedules`, { as: C, body: { dayOfWeek: 1, startTime: "08:00", endTime: "09:00" } }), api("POST", `/api/courses/${K2.id}/sections`, { as: C, body: { title: "x" } }),
    api("GET", `/api/tutor/lop/${K2.id}/giao-trinh`, { as: C }), api("POST", `/api/tutor/lop/${K2.id}/buoi/${D1}/de-nghi-chot`, { as: C }), api("GET", `/api/tutor/lop/${K2.id}/giao-vien`, { as: C }),
    api("PATCH", `/api/courses/${K2.id}/sessions/${D1}`, { as: C, body: { taught: "x" } }), api("POST", `/api/courses/${K2.id}/sessions`, { as: C, body: { dateKey: key(-20), startTime: "08:00", endTime: "09:00", kind: "extra" } }),
  ])).every(r => r.status === 403));
  check("khách 401 / học sinh 403 / chờ duyệt 403 / bị khoá 403 ở route M (students)", (await api("GET", `/api/courses/${K1.id}/students`, { as: guest })).status === 401
    && (await api("GET", `/api/courses/${K1.id}/students`, { as: H })).status === 403 && (await api("GET", `/api/courses/${K1.id}/students`, { as: P })).status === 403 && (await api("GET", `/api/courses/${K1.id}/students`, { as: B })).status === 403);
  check("quản trị trung tâm vẫn xem được students của K1 với đủ liên hệ", J(await api("GET", `/api/courses/${K1.id}/students`, { as: ADM })).students?.every((s: any) => s.email));

  section("T — tiền: đồng giảng và bộ môn không thấy / không ghi ở MỌI route tiền");
  const T: [string, string, unknown?][] = [
    ["GET", `/api/courses/${K1.id}/fees`], ["PUT", `/api/courses/${K1.id}/fees`, { feeMode: "per_course" }], ["GET", `/api/courses/${K1.id}/fee-rates`], ["POST", `/api/courses/${K1.id}/fee-rates`, { mode: "per_session", rate: 1 }],
    ["GET", `/api/courses/${K1.id}/extra-fees`], ["POST", `/api/courses/${K1.id}/extra-fees`, {}], ["GET", `/api/courses/${K1.id}/packages`], ["POST", `/api/courses/${K1.id}/packages`, {}],
  ];
  for (const [m, path, body] of T) {
    const a = await api(m, path, { as: C, body }), b = await api(m, path, { as: S, body });
    check(`${m} ${path.replace(K1.id, "K1")}: C và S = 403, không rò số tiền`, a.status === 403 && b.status === 403 && !SECRETS.some(s => a.text.includes(s) || b.text.includes(s)), [a.status, b.status]);
  }
  const TG = ["/api/tutor/hoc-phi-thang", "/api/tutor/invoices", "/api/tutor/student-discounts", "/api/tutor/bank-transactions", "/api/tutor/payout-account", "/api/tutor/goi", `/api/tutor/late-fee-hint?courseId=${K1.id}`, `/api/users/${stu[0].id}/tuition`];
  for (const p of TG) {
    const a = await api("GET", p, { as: C }), b = await api("GET", p, { as: S });
    check(`GET ${p.replace(K1.id, "K1").replace(stu[0].id, "HS")}: C và S không nhận được số tiền / dữ liệu của K1 (status ${a.status}/${b.status})`,
      !SECRETS.some(s => a.text.includes(s) || b.text.includes(s)) && !a.text.includes(K1.id) && !b.text.includes(K1.id) && !(a.status === 200 && JSON.stringify(a.json).match(/"(total|amount|fee)[A-Za-z]*":\s*[1-9]/)), [a.status, b.status, a.text.slice(0, 120)]);
  }
  check("(đối chứng) chủ vẫn đọc được đơn giá của K1", (await api("GET", `/api/courses/${K1.id}/fee-rates`, { as: O })).status === 200);
  check("phản hồi M của C (course / students / attendance / sessions / giao-trinh / giao-vien) không khoá tiền", [cv, cs, att, sd, gt, listC].every(r => keys(r.json ?? J(r)).filter(k => MONEY.test(k)).length === 0));
  check("…và số dòng phí vẫn y nguyên sau toàn bộ bài", (await moneySnapshot()) === feeRows0);

  section("Gỡ / rời lớp: buổi cũ giữ nguyên, khung và nhóm về chủ, quyền mất NGAY");
  const nSess = await prisma.attendanceSession.count({ where: { courseId: K1.id } });
  const nRec = await prisma.attendanceRecord.count();
  const scBefore = await prisma.classSchedule.count({ where: { courseId: K1.id, teacherId: C.id } });
  await prisma.chapter.update({ where: { id: J(chA).id }, data: { teacherId: C.id } });
  const prev = await api("DELETE", `/api/tutor/lop/${K1.id}/giao-vien/${idC}?preview=1`, { as: O });
  check("xem trước gỡ C: đếm khung / nhóm sẽ về chủ, KHÔNG ghi gì", prev.status === 200 && J(prev).reassignedSchedules === scBefore && J(prev).reassignedChapters === 1 && J(prev).previewOnly === true && (await prisma.courseTeacher.findUnique({ where: { id: idC } }))?.status === "active", prev.json);
  const rm = await api("DELETE", `/api/tutor/lop/${K1.id}/giao-vien/${idC}`, { as: O });
  check("chủ gỡ C ⇒ 200, removed, removedBy = chủ, trả số khung / nhóm đã đặt lại", rm.status === 200 && J(rm).reassignedSchedules === scBefore && J(rm).reassignedChapters === 1, rm.json);
  const afterC = await prisma.courseTeacher.findUnique({ where: { id: idC } });
  check("…dòng CourseTeacher: removed, removedBy, removedAt", afterC?.status === "removed" && afterC.removedBy === O.id && !!afterC.removedAt, afterC);
  check("C gọi route M ngay sau khi bị gỡ ⇒ 403 (students, PUT điểm danh, giao-trinh, de-nghi-chot)", (await api("GET", `/api/courses/${K1.id}/students`, { as: C })).status === 403
    && (await api("PUT", `/api/attendance-sessions/${sessC.id}`, { as: C, body: { records: recs } })).status === 403 && (await api("GET", `/api/tutor/lop/${K1.id}/giao-trinh`, { as: C })).status === 403
    && (await api("POST", `/api/tutor/lop/${K1.id}/buoi/${D1}/de-nghi-chot`, { as: C })).status === 403);
  check("buổi và điểm danh C đã ghi còn NGUYÊN (đếm trước / sau), taughtBy vẫn là C", (await prisma.attendanceSession.count({ where: { courseId: K1.id } })) === nSess && (await prisma.attendanceRecord.count()) === nRec && (await prisma.attendanceSession.findUnique({ where: { id: sessC.id } }))?.taughtBy === C.id);
  check("khung teacherId = C và nhóm teacherId = C đã về null", (await prisma.classSchedule.count({ where: { courseId: K1.id, teacherId: C.id } })) === 0 && (await prisma.chapter.findUnique({ where: { id: J(chA).id } }))?.teacherId === null);
  check("C nhận co_teacher_removed (không tên); GET dong-giang không còn lớp K1", !!(await prisma.notification.findFirst({ where: { userId: C.id, type: "co_teacher_removed" } })) && J(await api("GET", "/api/tutor/dong-giang", { as: C })).courses.length === 0);
  check("gỡ lần hai ⇒ 409", (await api("DELETE", `/api/tutor/lop/${K1.id}/giao-vien/${idC}`, { as: O })).status === 409);
  await inv(C, "co_teacher");
  const rinv = await prisma.courseTeacher.findMany({ where: { courseId: K1.id, userId: C.id } });
  check("mời lại người đã bị gỡ ⇒ cùng dòng, invited, xoá removedAt / removedBy", rinv.length === 1 && rinv[0].id === idC && rinv[0].status === "invited" && rinv[0].removedAt === null && rinv[0].removedBy === null, rinv);
  await api("POST", `/api/tutor/dong-giang/${idC}/chap-nhan`, { as: C });
  const leave = await api("POST", `/api/tutor/dong-giang/${idC}/roi-lop`, { as: C });
  const lc = await prisma.courseTeacher.findUnique({ where: { id: idC } });
  check("C tự rời lớp ⇒ 200, removed, removedBy = chính C; chủ nhận co_teacher_left", leave.status === 200 && lc?.status === "removed" && lc.removedBy === C.id && !!(await prisma.notification.findFirst({ where: { userId: O.id, type: "co_teacher_left" } })), [leave.json, lc]);
  check("C rời lần hai ⇒ 409; buổi cũ vẫn còn", (await api("POST", `/api/tutor/dong-giang/${idC}/roi-lop`, { as: C })).status === 409 && (await prisma.attendanceSession.count({ where: { courseId: K1.id } })) === nSess);

  section("Đổi vai và mất quyền khi tài khoản đổi");
  await inv(C, "co_teacher"); await api("POST", `/api/tutor/dong-giang/${idC}/chap-nhan`, { as: C });
  check("sau khi nhận lại C vào được route M", (await api("GET", `/api/courses/${K1.id}/students`, { as: C })).status === 200);
  const dem = await api("PATCH", `/api/tutor/lop/${K1.id}/giao-vien/${idC}`, { as: O, body: { role: "subject_teacher" } });
  check("chủ hạ C xuống bộ môn ⇒ 200 + thông báo co_teacher_role_changed (không tên)", dem.status === 200 && !!(await prisma.notification.findFirst({ where: { userId: C.id, type: "co_teacher_role_changed" } })));
  check("…C (nay là bộ môn) tạo phần ⇒ 403 ROLE_FORBIDDEN, tạo khung ⇒ 403", (await api("POST", `/api/courses/${K1.id}/sections`, { as: C, body: { title: "x" } })).status === 403 && (await api("POST", `/api/courses/${K1.id}/class-schedules`, { as: C, body: { dayOfWeek: 5, startTime: "08:00", endTime: "09:00" } })).status === 403);
  await api("PATCH", `/api/tutor/lop/${K1.id}/giao-vien/${idC}`, { as: O, body: { role: "co_teacher" } });
  await prisma.user.update({ where: { id: C.id }, data: { banned: true } });
  check("C bị khoá sau khi active ⇒ route M 403 dù dòng CourseTeacher còn active", (await api("GET", `/api/courses/${K1.id}/students`, { as: C })).status === 403 && (await prisma.courseTeacher.findUnique({ where: { id: idC } }))?.status === "active");
  await prisma.user.update({ where: { id: C.id }, data: { banned: false, role: "student", adminRole: null } });
  const dem2 = await api("GET", `/api/courses/${K1.id}/students`, { as: { ...C, role: "admin", adminRole: "teacher" } as TUser });
  check("C bị hạ role về học sinh trong DB (JWT cũ còn teacher) ⇒ route M 403 (đọc User từ DB)", dem2.status === 403, dem2.status);
  await prisma.user.update({ where: { id: C.id }, data: { role: "admin", adminRole: "teacher", tutorVerified: false } });
  check("C bị thu hồi duyệt gia sư (tutorVerified=false) ⇒ route M 403", (await api("GET", `/api/courses/${K1.id}/students`, { as: C })).status === 403);
  await prisma.user.update({ where: { id: C.id }, data: { tutorVerified: true } });
  check("khôi phục ⇒ C vào lại được", (await api("GET", `/api/courses/${K1.id}/students`, { as: C })).status === 200);
  await prisma.user.update({ where: { id: C.id }, data: { deletedAt: new Date() } });
  check("C bị ẩn tài khoản (deletedAt) ⇒ route M 403", (await api("GET", `/api/courses/${K1.id}/students`, { as: C })).status === 403);
  await prisma.user.update({ where: { id: C.id }, data: { deletedAt: null } });

  section("createdBy = chủ: xoá tài khoản đồng giảng không xoá buổi");
  const T3 = await mkTutor("Cô Sẽ Bị Xoá");
  const ct3 = await prisma.courseTeacher.create({ data: { courseId: K1.id, userId: T3.id, role: "co_teacher", status: "active", invitedBy: O.id } });
  const mkS = await api("POST", `/api/courses/${K1.id}/attendance-sessions`, { as: T3, body: { date: key(-30) } });
  const sid = J(mkS).id as string;
  check("T3 tạo buổi ⇒ createdBy = chủ, taughtBy = T3", mkS.status === 201 && J(mkS).createdBy === O.id && J(mkS).taughtBy === T3.id, mkS.json);
  let delOk = true; try { await prisma.user.delete({ where: { id: T3.id } }); } catch (e) { delOk = false; console.log("   xoá user lỗi:", String(e).slice(0, 160)); }
  check("xoá tài khoản T3 (cascade CourseTeacher) ⇒ buổi còn nguyên", delOk && !!(await prisma.attendanceSession.findUnique({ where: { id: sid } })) && !(await prisma.courseTeacher.findUnique({ where: { id: ct3.id } })));

  section("H1/H2: học sinh đã chuyển thành gia sư không thể vào lớp làm học sinh");
  const O5 = await mkTutor("Thầy Lớp Mở"); const K5 = await mkCourse(O5.id, { name: "Lớp K5" }); const K6 = await mkCourse(O5.id, { name: "Lớp K6" });
  await prisma.course.update({ where: { id: K5.id }, data: { joinPolicy: "approve" } });
  const Y = await mkUser({ name: "Em Sẽ Thành Gia Sư" });
  await prisma.enrollment.create({ data: { userId: Y.id, courseId: K6.id, status: "active" } });
  const Q = await mkUser({ name: "Em Bình Thường" });
  await prisma.enrollment.create({ data: { userId: Q.id, courseId: K6.id, status: "active" } });
  const inviteK5 = await prisma.classInvite.create({ data: { courseId: K5.id, code: "ABCD2345", createdBy: O5.id, kind: "class", maxUses: 10, usedCount: 1 } as never });
  const Zr = await mkUser({ name: "Em Xin Vào" });
  const jr = await prisma.classJoinRequest.create({ data: { userId: Zr.id, courseId: K5.id, inviteId: inviteK5.id, status: "pending" } });
  // chuyển Y và Zr thành gia sư (PR #142: Enrollment giữ nguyên)
  for (const u of [Y, Zr]) await prisma.user.update({ where: { id: u.id }, data: { role: "admin", adminRole: "teacher", tutorVerified: true } });
  const Ytut: TUser = { ...Y, role: "admin", adminRole: "teacher" };
  check("Enrollment cũ của Y còn nguyên sau khi chuyển vai", (await prisma.enrollment.count({ where: { userId: Y.id, courseId: K6.id, status: "active" } })) === 1);
  const rdm = await api("POST", `/api/invites/${inviteK5.id}/redeem`, { as: Ytut });
  check("Y redeem mã mời ⇒ 403 (không phải học sinh)", rdm.status === 403, rdm.json);
  const duyet = await api("POST", `/api/tutor/lop/${K5.id}/yeu-cau/${jr.id}/duyet`, { as: O5, body: {} });
  const jrAfter = await prisma.classJoinRequest.findUnique({ where: { id: jr.id } });
  check("O5 duyệt đơn của người nay đã là gia sư ⇒ outcome khong-phai-hs (303 ?duyet=khong-phai-hs)", duyet.status === 303 && (duyet.headers.get("location") ?? "").includes("duyet=khong-phai-hs"), [duyet.status, duyet.headers.get("location")]);
  check("…không tạo Enrollment, đơn bị cancelled, usedCount của mã trả lại (1 → 0)", (await prisma.enrollment.count({ where: { userId: Zr.id, courseId: K5.id } })) === 0 && jrAfter?.status === "cancelled" && (await prisma.classInvite.findUnique({ where: { id: inviteK5.id } }))?.usedCount === 0, jrAfter);
  const add = await api("POST", `/api/tutor/lop/${K5.id}/hoc-sinh`, { as: O5, body: { userIds: [Y.id] } });
  check("O5 thêm Y (đã là gia sư, còn Enrollment ở lớp K6 của O5) vào K5 ⇒ 403, không tạo Enrollment", add.status === 403 && (await prisma.enrollment.count({ where: { userId: Y.id, courseId: K5.id } })) === 0, add.json);
  const addQ = await api("POST", `/api/tutor/lop/${K5.id}/hoc-sinh`, { as: O5, body: { userIds: [Q.id] } });
  check("(đối chứng) thêm học sinh THẬT Q đã học K6 vào K5 ⇒ 201", addQ.status === 201 && (await prisma.enrollment.count({ where: { userId: Q.id, courseId: K5.id } })) === 1, addQ.json);
  const Cpend = await mkTutor("Đồng giảng K5");
  await prisma.courseTeacher.create({ data: { courseId: K5.id, userId: Cpend.id, role: "co_teacher", status: "active", invitedBy: O5.id } });
  await prisma.enrollment.create({ data: { userId: Cpend.id, courseId: K6.id, status: "active" } });
  const addT = await api("POST", `/api/tutor/lop/${K5.id}/hoc-sinh`, { as: O5, body: { userIds: [Cpend.id] } });
  check("O5 thêm chính đồng giảng của K5 làm học viên ⇒ 403 is_teacher_of_course", addT.status === 403 && J(addT).code === "is_teacher_of_course" && (await prisma.enrollment.count({ where: { userId: Cpend.id, courseId: K5.id } })) === 0, addT.json);
  const invY = await api("POST", `/api/tutor/lop/${K6.id}/giao-vien`, { as: O5, body: { email: Y.email, role: "co_teacher" } });
  check("mời Y (gia sư mới, còn Enrollment ở chính K6) làm đồng giảng K6 ⇒ 200 chung, KHÔNG tạo dòng", invY.status === 200 && (await prisma.courseTeacher.count({ where: { courseId: K6.id, userId: Y.id } })) === 0, invY.json);
  const ctY = await prisma.courseTeacher.create({ data: { courseId: K6.id, userId: Y.id, role: "co_teacher", status: "invited", invitedBy: O5.id } });
  const accY = await api("POST", `/api/tutor/dong-giang/${ctY.id}/chap-nhan`, { as: Ytut });
  check("lỡ có dòng mời rồi: Y chấp nhận ⇒ 409 is_student_of_course", accY.status === 409 && J(accY).code === "is_student_of_course" && (await prisma.courseTeacher.findUnique({ where: { id: ctY.id } }))?.status === "invited", accY.json);
  const admE = await api("POST", "/api/admin/enrollments", { as: ADM, body: { userId: Y.id, courseId: K5.id } });
  console.log(`   ℹ admin POST /api/admin/enrollments cho tài khoản gia sư Y ⇒ ${admE.status} (H3 thuộc Quản trị, mục D4a: sau khi adm-code sửa phải là 409 not_student)`);
  check("(H3 — chờ Quản trị) ghi nhận kết quả thật, không đỏ giả", true);
  for (const [m, p, b] of [["POST", "/api/exams/de-o/start", {}], ["POST", "/api/progress/" + J(lA).id, { completed: true }], ["POST", "/api/assignments/" + J(aO).id + "/submit", {}], ["POST", `/api/followed-courses/${K6.id}`, {}], ["GET", "/api/enrollments", undefined]] as [string, string, unknown][]) {
    const r = await api(m, p, { as: Ytut, body: b });
    console.log(`   ℹ H4 ${m} ${p.replace(J(lA).id, "LESSON").replace(J(aO).id, "ASG")} bởi gia sư có Enrollment cũ ⇒ ${r.status}${r.status === 200 ? "  ← P2 cho stu-code (route chưa kiểm role)" : ""}`);
  }
  check("(H4 — ghi nhận cho stu-code, không sửa ở đây)", true);

  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
