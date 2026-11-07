// TUT-dong-giang — src/lib/courseAccess.ts: ma trận vai × hành động (mục 4.3 đặc tả), người dạy hiệu lực, điều kiện buổi / nhóm, vai dùng được, lọc tiền, máy trạng thái lời mời.
// Thuần, không DB, không máy chủ. Chạy: DATABASE_URL=postgresql://x:x@localhost/x npx tsx tools/local-e2e/t-course-access-lib.ts
//
// Bảng MATRIX dưới đây được gõ LẠI ĐỘC LẬP từ đặc tả (không import từ mã) — mã đổi một ô mà bảng không đổi theo thì ô đó đỏ.
// Ca phá (bẻ X thì ca Y đỏ):
//   (a) đổi `money.view` của co_teacher sang ✔                   → ô "co_teacher × money.view" đỏ (và ca "đồng giảng không có tiền")
//   (b) thêm `roster.contact` cho subject_teacher                 → ô "subject_teacher × roster.contact" đỏ
//   (c) bỏ nhánh `status` trong isCoTeacherUsable                 → ca "status=invited → không dùng được" đỏ
//   (d) canDo trả true cho hành động lạ / vai lạ                  → ca "mặc định từ chối" đỏ
//   (e) bỏ kiểm `closed` trong canMarkSession                     → ca "đồng giảng × buổi đã chốt" đỏ
//   (f) cho subject_teacher sửa nhóm có teacherId null            → ca "nhóm chưa giao → bộ môn ✘" đỏ
//   (h) cho bộ môn thấy tên khi nhóm không phải của mình          → ca "studentNamesVisible: bộ môn ngoài nhóm ẩn" đỏ
//   (i) canEditAssignment cho tác giả ngoài nhóm sửa                → ca "canEditAssignment: tác giả ngoài nhóm ✘" đỏ
//   (g) sửa thứ tự ưu tiên taughtBy > khung > chủ                  → các ca effectiveSessionTeacher đỏ
import {
  canDo, canMarkSession, canEditChapter, canEditAssignment, canGradeAssignment, studentNamesVisible, anonymousStudentLabel, canEditSchedule, effectiveSessionTeacher, isCoTeacherUsable, redactCourseForRole, redactContactRow,
  nextTeacherStatus, normalizeInviteEmail, normalizeSubjects, canBeInvitedAsTeacher, ROLE_LABEL, MAX_TEACHERS_PER_COURSE, isTeacherRole,
  type CourseAction, type CourseRole, type CoTeacherUserRow, type TeacherStatus, type TeacherEvent,
} from "@/lib/courseAccess";
import { check, section, done } from "./h";

// owner, co_teacher, subject_teacher, admin  (1 = ✔)
const MATRIX: Record<string, string> = {
  "course.view": "1111",
  "roster.view": "1111",
  "roster.contact": "1001",
  "attendance.mark.own": "1111",
  "attendance.mark.other": "1001",
  "session.note.own": "1111",
  "session.add.own": "1101",
  "session.close": "1001",
  "session.request_close": "0110",
  "session.reassign": "1001",
  "content.edit.any": "1101",
  "content.edit.own": "1111",
  "content.delete_section": "1001",
  "quiz.assign": "1111",
  "grade": "1111",
  "score.write": "1001",
  "course.edit": "1001",
  "course.delete": "1001",
  "student.invite": "1001",
  "student.decide": "1001",
  "student.remove": "1001",
  "invite_code.rotate": "1001",
  "teacher.invite": "1001",
  "teacher.remove": "1001",
  "teacher.role": "1001",
  "teacher.leave": "0110",
  "schedule.add.own": "1101",
  "schedule.edit.own": "1101",
  "schedule.edit.other": "1001",
  "money.view": "1001",
  "attendance.export": "1001",
  "community.post": "1111",
  "community.moderate": "1001",
};
const ROLES: Exclude<CourseRole, "none">[] = ["owner", "co_teacher", "subject_teacher", "admin"];
const ME = "u-me", OTHER = "u-other", OWNER = "u-owner";

const goodUser: CoTeacherUserRow = { role: "admin", adminRole: "teacher", tutorVerified: true, banned: false, deletedAt: null };

(async () => {
  section("Ma trận 4.3: đủ 31+ hành động × 4 vai (so với bảng gõ lại độc lập)");
  check("bảng độc lập có đúng 33 hàng hành động (mục 4.3 có 31 hàng, hàng 8 / 23 gộp 2 và 3 hành động)", Object.keys(MATRIX).length === 33, Object.keys(MATRIX).length);
  let cells = 0;
  for (const [action, row] of Object.entries(MATRIX)) {
    ROLES.forEach((role, i) => {
      cells++;
      const want = row[i] === "1";
      check(`${role} × ${action} = ${want ? "✔" : "✘"}`, canDo(role, action as CourseAction) === want);
    });
  }
  check(`đã so ${cells} ô (33 × 4)`, cells === 132);

  section("Vai 'none' (gia sư lạ / học sinh / khách) ✘ mọi hành động");
  for (const action of Object.keys(MATRIX)) check(`none × ${action} = ✘`, canDo("none", action as CourseAction) === false);

  section("Mặc định từ chối (ca phá d)");
  check("hành động lạ ⇒ false cho mọi vai", ROLES.every(r => canDo(r, "khong.ton.tai" as CourseAction) === false));
  check("vai lạ ⇒ false", canDo("hacker" as CourseRole, "course.view") === false && canDo("student" as CourseRole, "course.view") === false && canDo("" as CourseRole, "course.view") === false);
  check("hành động rỗng / null ⇒ false", canDo("owner", "" as CourseAction) === false && canDo("owner", null as unknown as CourseAction) === false);

  section("Đồng giảng KHÔNG có tiền / liên hệ / điểm / quản trị người (ca phá a, b)");
  for (const r of ["co_teacher", "subject_teacher"] as const) {
    for (const a of ["money.view", "roster.contact", "score.write", "session.close", "course.edit", "course.delete", "student.invite", "student.decide", "student.remove",
      "invite_code.rotate", "teacher.invite", "teacher.remove", "teacher.role", "attendance.export", "community.moderate", "attendance.mark.other", "session.reassign", "schedule.edit.other"] as CourseAction[]) {
      check(`${r} KHÔNG có ${a}`, canDo(r, a) === false);
    }
  }
  check("chủ nhiệm và quản trị có money.view", canDo("owner", "money.view") && canDo("admin", "money.view"));
  check("chủ nhiệm không có hành động chỉ-đồng-giảng (request_close / leave)", !canDo("owner", "session.request_close") && !canDo("owner", "teacher.leave"));

  section("effectiveSessionTeacher: taughtBy > khung > chủ (ca phá g)");
  check("taughtBy thắng khung", effectiveSessionTeacher({ taughtBy: "A", scheduleTeacherId: "B", ownerId: "C" }) === "A");
  check("khung thắng chủ", effectiveSessionTeacher({ taughtBy: null, scheduleTeacherId: "B", ownerId: "C" }) === "B");
  check("cả hai null ⇒ chủ", effectiveSessionTeacher({ taughtBy: null, scheduleTeacherId: null, ownerId: "C" }) === "C");
  check("chủ null ⇒ null", effectiveSessionTeacher({ taughtBy: null, scheduleTeacherId: null, ownerId: null }) === null);
  check("taughtBy rỗng chuỗi coi như chưa gán", effectiveSessionTeacher({ taughtBy: "", scheduleTeacherId: "B", ownerId: "C" }) === "B");

  section("canMarkSession (ca phá e)");
  check("co_teacher × buổi của mình, chưa chốt ⇒ ok", canMarkSession("co_teacher", ME, ME, false).ok === true);
  const other = canMarkSession("co_teacher", ME, OTHER, false);
  check("co_teacher × buổi người khác ⇒ NOT_YOUR_SESSION", !other.ok && other.code === "NOT_YOUR_SESSION");
  const ownerSession = canMarkSession("co_teacher", ME, OWNER, false);
  check("co_teacher × buổi của chủ ⇒ NOT_YOUR_SESSION", !ownerSession.ok && ownerSession.code === "NOT_YOUR_SESSION");
  const closed = canMarkSession("co_teacher", ME, ME, true);
  check("co_teacher × buổi MÌNH đã chốt ⇒ SESSION_CLOSED_OWNER_ONLY", !closed.ok && closed.code === "SESSION_CLOSED_OWNER_ONLY");
  const closedSub = canMarkSession("subject_teacher", ME, ME, true);
  check("subject_teacher × buổi mình đã chốt ⇒ SESSION_CLOSED_OWNER_ONLY", !closedSub.ok && closedSub.code === "SESSION_CLOSED_OWNER_ONLY");
  check("owner × buổi đã chốt ⇒ ok", canMarkSession("owner", OWNER, OWNER, true).ok === true);
  check("owner × buổi của người khác ⇒ ok", canMarkSession("owner", OWNER, OTHER, false).ok === true);
  check("admin × buổi đã chốt của người khác ⇒ ok", canMarkSession("admin", "adm", OTHER, true).ok === true);
  const none = canMarkSession("none", ME, ME, false);
  check("none ⇒ ROLE_FORBIDDEN", !none.ok && none.code === "ROLE_FORBIDDEN");
  const noTeacher = canMarkSession("co_teacher", ME, null, false);
  check("buổi chưa có người dạy nào (null) ⇒ co_teacher NOT_YOUR_SESSION", !noTeacher.ok && noTeacher.code === "NOT_YOUR_SESSION");

  section("canEditChapter (ca phá f)");
  check("owner sửa mọi nhóm kể cả teacherId null", canEditChapter("owner", ME, null) && canEditChapter("owner", ME, OTHER));
  check("admin sửa mọi nhóm", canEditChapter("admin", ME, OTHER));
  check("co_teacher sửa mọi nhóm", canEditChapter("co_teacher", ME, null) && canEditChapter("co_teacher", ME, OTHER) && canEditChapter("co_teacher", ME, ME));
  check("subject_teacher chỉ nhóm teacherId === me", canEditChapter("subject_teacher", ME, ME) === true && canEditChapter("subject_teacher", ME, OTHER) === false);
  check("nhóm chưa giao (teacherId null) → bộ môn ✘", canEditChapter("subject_teacher", ME, null) === false);
  check("none ✘", canEditChapter("none", ME, ME) === false);

  section("Bài tập: sửa / chấm / tên học sinh theo nhóm (ca phá h, i)");
  check("canEditAssignment: bộ môn chỉ khi nhóm chứa bài giao cho mình", canEditAssignment("subject_teacher", ME, ME) && !canEditAssignment("subject_teacher", ME, OTHER) && !canEditAssignment("subject_teacher", ME, null));
  check("canEditAssignment: owner / admin / co_teacher mọi nhóm; none ✘", canEditAssignment("owner", ME, OTHER) && canEditAssignment("admin", ME, null) && canEditAssignment("co_teacher", ME, OTHER) && !canEditAssignment("none", ME, ME));
  check("canGradeAssignment: bộ môn nhóm mình ✔", canGradeAssignment("subject_teacher", ME, { assignmentOwnerId: OTHER, chapterTeacherId: ME }));
  check("canGradeAssignment: bộ môn tác giả ngoài nhóm ✔ (chấm được)", canGradeAssignment("subject_teacher", ME, { assignmentOwnerId: ME, chapterTeacherId: OTHER }));
  check("canGradeAssignment: bộ môn không tác giả, ngoài nhóm ✘", !canGradeAssignment("subject_teacher", ME, { assignmentOwnerId: OTHER, chapterTeacherId: OTHER }) && !canGradeAssignment("subject_teacher", ME, { assignmentOwnerId: null, chapterTeacherId: null }));
  check("canGradeAssignment: co_teacher mọi bài; none ✘", canGradeAssignment("co_teacher", ME, { assignmentOwnerId: OTHER, chapterTeacherId: null }) && !canGradeAssignment("none", ME, { assignmentOwnerId: ME, chapterTeacherId: ME }));
  check("studentNamesVisible: owner / admin / co_teacher luôn thấy", studentNamesVisible("owner", ME, OTHER) && studentNamesVisible("admin", ME, null) && studentNamesVisible("co_teacher", ME, null));
  check("studentNamesVisible: bộ môn trong nhóm mình thấy", studentNamesVisible("subject_teacher", ME, ME));
  check("studentNamesVisible: bộ môn ngoài nhóm / nhóm chưa giao ẩn", !studentNamesVisible("subject_teacher", ME, OTHER) && !studentNamesVisible("subject_teacher", ME, null));
  check("studentNamesVisible: vai lạ ẩn", !studentNamesVisible("none", ME, ME));
  check("anonymousStudentLabel: 'Học viên N' 1-based", anonymousStudentLabel(0) === "Học viên 1" && anonymousStudentLabel(9) === "Học viên 10");

  section("canEditSchedule");
  check("owner sửa khung bất kỳ", canEditSchedule("owner", ME, null) && canEditSchedule("owner", ME, OTHER));
  check("co_teacher chỉ khung teacherId = me", canEditSchedule("co_teacher", ME, ME) && !canEditSchedule("co_teacher", ME, OTHER));
  check("co_teacher × khung của chủ (teacherId null) ✘", !canEditSchedule("co_teacher", ME, null));
  check("subject_teacher ✘ kể cả khung của mình", !canEditSchedule("subject_teacher", ME, ME));

  section("isCoTeacherUsable: mỗi cờ tách riêng (ca phá c)");
  check("active + gia sư duyệt ⇒ dùng được", isCoTeacherUsable({ status: "active" }, goodUser));
  for (const st of ["invited", "declined", "removed", "", "ACTIVE", "xx"]) check(`status=${JSON.stringify(st)} ⇒ không dùng được`, !isCoTeacherUsable({ status: st }, goodUser));
  check("tutorVerified=false ⇒ không", !isCoTeacherUsable({ status: "active" }, { ...goodUser, tutorVerified: false }));
  check("banned ⇒ không", !isCoTeacherUsable({ status: "active" }, { ...goodUser, banned: true }));
  check("deletedAt ⇒ không", !isCoTeacherUsable({ status: "active" }, { ...goodUser, deletedAt: new Date() }));
  check("role student ⇒ không (kể cả adminRole teacher)", !isCoTeacherUsable({ status: "active" }, { ...goodUser, role: "student" }));
  check("adminRole null ⇒ không", !isCoTeacherUsable({ status: "active" }, { ...goodUser, adminRole: null }));
  check("adminRole admin_super ⇒ không (quản trị không phải đồng giảng)", !isCoTeacherUsable({ status: "active" }, { ...goodUser, adminRole: "admin_super" }));
  check("canBeInvitedAsTeacher: gia sư duyệt ✔, chờ duyệt / học sinh / khoá / xoá ✘",
    canBeInvitedAsTeacher(goodUser) && !canBeInvitedAsTeacher({ ...goodUser, tutorVerified: false }) && !canBeInvitedAsTeacher({ ...goodUser, role: "student", adminRole: null })
    && !canBeInvitedAsTeacher({ ...goodUser, banned: true }) && !canBeInvitedAsTeacher({ ...goodUser, deletedAt: new Date() }));

  section("redactCourseForRole / redactContactRow");
  const course = { id: "c1", name: "Toán 9", price: 500000, originalPrice: 700000, feeMode: "per_session", tag: "Hot", tagColor: "red", zaloGroupUrl: "https://zalo.me/g/x", zaloGroupLink: "https://zalo.me/g/y", classStatus: "open" };
  const co = redactCourseForRole("co_teacher", course) as Record<string, unknown>;
  check("đồng giảng mất price / originalPrice / feeMode / tag", !("price" in co) && !("originalPrice" in co) && !("feeMode" in co) && !("tag" in co) && !("tagColor" in co));
  check("đồng giảng mất link nhóm Zalo phụ huynh", !("zaloGroupUrl" in co) && !("zaloGroupLink" in co));
  check("đồng giảng giữ id / name / classStatus", co.id === "c1" && co.name === "Toán 9" && co.classStatus === "open");
  check("bộ môn cũng bị lọc", !("price" in (redactCourseForRole("subject_teacher", course) as object)));
  check("owner nguyên vẹn", JSON.stringify(redactCourseForRole("owner", course)) === JSON.stringify(course));
  check("admin nguyên vẹn", JSON.stringify(redactCourseForRole("admin", course)) === JSON.stringify(course));
  check("none (vai lạ) bị lọc", !("price" in (redactCourseForRole("none", course) as object)));
  check("không sửa đối tượng gốc", course.price === 500000 && "zaloGroupUrl" in course);
  const row = { userId: "s1", name: "HS", email: "a@b.c", phone: "090", school: "THCS", parentName: "PH", parentPhone: "091", zaloOpenedAt: "x", status: "active" };
  const rc = redactContactRow("co_teacher", row) as Record<string, unknown>;
  check("đồng giảng: dòng học viên mất email / phone / school / parentName / parentPhone / zaloOpenedAt", !("email" in rc) && !("phone" in rc) && !("school" in rc) && !("parentName" in rc) && !("parentPhone" in rc) && !("zaloOpenedAt" in rc));
  check("đồng giảng giữ userId / name / status", rc.userId === "s1" && rc.name === "HS" && rc.status === "active");
  check("owner giữ liên hệ", (redactContactRow("owner", row) as Record<string, unknown>).parentPhone === "091");

  section("Máy trạng thái lời mời (8.1)");
  const T: [TeacherStatus | null, TeacherEvent, TeacherStatus | null][] = [
    [null, "invite", "invited"], ["declined", "invite", "invited"], ["removed", "invite", "invited"], ["invited", "invite", null], ["active", "invite", null],
    ["invited", "accept", "active"], ["active", "accept", null], ["declined", "accept", null], ["removed", "accept", null], [null, "accept", null],
    ["invited", "decline", "declined"], ["active", "decline", null], ["removed", "decline", null],
    ["invited", "cancel", "removed"], ["active", "cancel", null],
    ["active", "remove", "removed"], ["invited", "remove", null], ["removed", "remove", null],
    ["active", "leave", "removed"], ["invited", "leave", null], ["declined", "leave", null],
  ];
  for (const [from, ev, to] of T) check(`${from} --${ev}--> ${to}`, nextTeacherStatus(from, ev) === to);

  section("Hình thức lời mời");
  check("email: trim + hạ chữ", normalizeInviteEmail("  Thay.A@Gmail.COM ") === "thay.a@gmail.com");
  check("email sai ⇒ null", normalizeInviteEmail("abc") === null && normalizeInviteEmail("a@b") === null && normalizeInviteEmail("") === null && normalizeInviteEmail(5) === null && normalizeInviteEmail(null) === null);
  check("email dài > 254 ⇒ null", normalizeInviteEmail("a".repeat(250) + "@b.co") === null);
  check("vai hợp lệ chỉ co_teacher / subject_teacher", isTeacherRole("co_teacher") && isTeacherRole("subject_teacher") && !isTeacherRole("owner") && !isTeacherRole("admin") && !isTeacherRole(""));
  check("subjects rỗng / thiếu ⇒ []", JSON.stringify(normalizeSubjects(undefined)) === "[]" && JSON.stringify(normalizeSubjects([])) === "[]");
  check("subjects bỏ rỗng + trùng + trim", JSON.stringify(normalizeSubjects([" Toán ", "", "Toán", "Lý"])) === JSON.stringify(["Toán", "Lý"]));
  check("subjects > 5 mục ⇒ null", normalizeSubjects(["1", "2", "3", "4", "5", "6"]) === null);
  check("subjects mục > 40 ký tự ⇒ null", normalizeSubjects(["x".repeat(41)]) === null && normalizeSubjects(["x".repeat(40)]) !== null);
  check("subjects sai kiểu ⇒ null", normalizeSubjects("Toán") === null && normalizeSubjects([1]) === null);
  check("hằng: tối đa 5 giáo viên / lớp", MAX_TEACHERS_PER_COURSE === 5);
  check("nhãn vai tiếng Việt", ROLE_LABEL.owner === "Chủ nhiệm" && ROLE_LABEL.co_teacher === "Đồng giảng" && ROLE_LABEL.subject_teacher === "Giáo viên bộ môn" && ROLE_LABEL.admin === "Quản trị trung tâm");

  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
