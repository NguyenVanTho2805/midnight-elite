// Thuần (không cần máy chủ): quy tắc ai thấy NỘI DUNG bài học — src/lib/lessonAccess.ts (16/10/2026).
import { canViewCourseContent, redactLessonForOutsider, lessonForViewer, courseTreeForViewer, LESSON_CONTENT_FIELDS } from "@/lib/lessonAccess";
import { check, section, done } from "./h";

const OWNER = "tutor-owner", OTHER = "tutor-other";
const course = { ownerId: OWNER };
const orphan = { ownerId: null };   // lớp cũ / của trung tâm
const asTeacher = (userId: string) => ({ userId, role: "admin" as const, adminRole: "teacher" as const });
const asSuper = { userId: "root", role: "admin" as const, adminRole: "admin_super" as const };
const asContent = { userId: "cms", role: "admin" as const, adminRole: "admin_content" as const };
const asStudent = (userId = "s1") => ({ userId, role: "student" as const });

section("canViewCourseContent — ai có toàn quyền với nội dung mọi bài của lớp");
check("khách: không", canViewCourseContent(null, course, null) === false);
check("khách (undefined): không", canViewCourseContent(undefined, course, null) === false);
check("quản trị cấp 1: có (lớp của gia sư)", canViewCourseContent(asSuper, course, null) === true);
check("quản trị nội dung: có", canViewCourseContent(asContent, course, null) === true);
check("quản trị cấp 1: có cả lớp ownerId = null", canViewCourseContent(asSuper, orphan, null) === true);
check("gia sư chủ lớp: có", canViewCourseContent(asTeacher(OWNER), course, null) === true);
check("gia sư của lớp khác: KHÔNG", canViewCourseContent(asTeacher(OTHER), course, null) === false);
check("gia sư + lớp ownerId = null: KHÔNG (lớp cũ không thuộc ai)", canViewCourseContent(asTeacher(OWNER), orphan, null) === false);
check("admin không có adminRole (phiên cũ): có — cùng quy tắc ownsResource", canViewCourseContent({ userId: "x", role: "admin" }, course, null) === true);
check("học viên chưa ghi danh: không", canViewCourseContent(asStudent(), course, null) === false);
check("học viên active: có", canViewCourseContent(asStudent(), course, { status: "active" }) === true);
check("học viên pending_consent: không", canViewCourseContent(asStudent(), course, { status: "pending_consent" }) === false);
check("học viên suspended: không (mặc định)", canViewCourseContent(asStudent(), course, { status: "suspended" }) === false);
check("học viên suspended: có khi includeSuspended (xem lại nội dung đã mở)", canViewCourseContent(asStudent(), course, { status: "suspended" }, { includeSuspended: true }) === true);
check("học viên pending_consent: vẫn không dù includeSuspended", canViewCourseContent(asStudent(), course, { status: "pending_consent" }, { includeSuspended: true }) === false);
check("học viên + trạng thái lạ: không", canViewCourseContent(asStudent(), course, { status: "whatever" }, { includeSuspended: true }) === false);
check("gia sư không cần ghi danh để xem lớp của mình, nhưng ghi danh của gia sư khác không giúp gì", canViewCourseContent(asTeacher(OTHER), course, { status: "active" }) === false);

section("redactLessonForOutsider — bài trả phí bị cắt nội dung, bài học thử giữ nguyên");
const paid = { id: "p", title: "Bài trả phí", type: "record", duration: "30 phút", isFree: false, isLocked: false,
  videoUrl: "https://v/BI-MAT", zoomUrl: "https://z/BI-MAT", azotaUrl: "https://a/BI-MAT", azotaDeadline: "2026-12-01", documents: '[{"name":"x","url":"https://f/BI-MAT.pdf"}]', adminNote: "BI-MAT" };
const free = { ...paid, id: "f", title: "Bài học thử", isFree: true, isLocked: false };
const r = redactLessonForOutsider(paid);
check("bài trả phí: mọi cột nội dung bị cắt", LESSON_CONTENT_FIELDS.every(f => (f === "documents" ? r[f] === "[]" : r[f] === null)), r);
check("bài trả phí: luôn khoá dù DB ghi isLocked = false (quên đặt cờ)", r.isLocked === true);
check("bài trả phí: giữ tiêu đề / loại / thời lượng để trang giới thiệu vẫn hiện danh sách", r.title === "Bài trả phí" && r.type === "record" && r.duration === "30 phút" && r.id === "p");
check("không sửa đối tượng gốc", paid.videoUrl === "https://v/BI-MAT" && paid.isLocked === false);
check("bài học thử: giữ nguyên (cùng đối tượng)", redactLessonForOutsider(free) === free && free.videoUrl === "https://v/BI-MAT");
check("bài học thử vẫn mang cờ isLocked của DB (không ép)", redactLessonForOutsider({ ...free, isLocked: true as boolean }).isLocked === true);

section("lessonForViewer / courseTreeForViewer");
check("toàn quyền: mở khoá, giữ nội dung", (() => { const v = lessonForViewer({ ...paid, isLocked: true as boolean }, true); return v.isLocked === false && v.videoUrl === "https://v/BI-MAT"; })());
check("không toàn quyền: cắt", lessonForViewer(paid, false).videoUrl === null);
const tree = { id: "c", zaloGroupLink: "https://zalo.me/g/BI-MAT", sections: [{ id: "s", chapters: [{ id: "ch", lessons: [paid, free] }] }] };
const tOut = courseTreeForViewer(tree, false);
check("cây: bài trả phí bị cắt, bài học thử giữ", tOut.sections[0].chapters[0].lessons[0].videoUrl === null && tOut.sections[0].chapters[0].lessons[1].videoUrl === "https://v/BI-MAT");
check("cây: không sửa cây gốc", tree.sections[0].chapters[0].lessons[0].videoUrl === "https://v/BI-MAT");
check("cây: giữ nguyên trường khác của khoá", tOut.id === "c" && tOut.zaloGroupLink === "https://zalo.me/g/BI-MAT");
const tIn = courseTreeForViewer(tree, true);
check("cây toàn quyền: mọi bài mở khoá, nội dung còn nguyên", tIn.sections[0].chapters[0].lessons.every(l => l.isLocked === false && l.videoUrl === "https://v/BI-MAT"));

done();
