// MD-03 — ai thấy link học liệu (src/lib/mediaAccess.ts). Thuần, không DB. Có ca phá cố ý: quyền KHÔNG được nới.
import { check, section, done } from "./h";
import { canViewAllMaterials, canViewLessonMaterials, isCourseManager, lessonFor, redactCourseTree, redactLesson, PROTECTED_LESSON_FIELDS, type MediaContext, type MediaViewer } from "@/lib/mediaAccess";

const OWNER = "tutor-chu", OTHER = "tutor-la", STU = "hs-1";
const tutor = (id: string): MediaViewer => ({ userId: id, role: "admin", adminRole: "teacher" });
const sup: MediaViewer = { userId: "ad-1", role: "admin", adminRole: "admin_super" };
const content: MediaViewer = { userId: "ad-2", role: "admin", adminRole: "admin_content" };
const stu: MediaViewer = { userId: STU, role: "student" };
const ctx = (viewer: MediaViewer | null, enrollment: MediaContext["enrollment"] = null, courseOwnerId: string | null = OWNER): MediaContext => ({ viewer, courseOwnerId, enrollment });

const lesson = { id: "l1", title: "Bài 1", isFree: false, videoUrl: "https://v/1", zoomUrl: "https://z/1", azotaUrl: "https://a/1", documents: '[{"name":"a","url":"https://d/1"}]', adminNote: "ghi chú nội bộ", duration: "10:00" };
const free = { ...lesson, id: "l2", isFree: true };
const hidden = (l: Record<string, unknown>) => l.videoUrl === null && l.zoomUrl === null && l.azotaUrl === null && l.documents === "[]" && l.adminNote === null;
const shown = (l: Record<string, unknown>) => l.videoUrl === lesson.videoUrl && l.zoomUrl === lesson.zoomUrl && l.azotaUrl === lesson.azotaUrl && l.documents === lesson.documents;

section("Người được xem đủ");
check("quản trị cấp 1 và quản trị nội dung thấy hết", [sup, content].every(v => shown(lessonFor(ctx(v), lesson))));
check("gia sư CHỦ lớp thấy hết", shown(lessonFor(ctx(tutor(OWNER)), lesson)));
check("học viên đã ghi danh đang hiệu lực (active) thấy hết", shown(lessonFor(ctx(stu, { status: "active" }), lesson)));

section("Người bị khoá (ca phá cố ý — phải KHOÁ)");
check("khách (chưa đăng nhập) → link bỏ trống, tài liệu = []", hidden(lessonFor(ctx(null), lesson) as never));
check("học viên CHƯA ghi danh → khoá", hidden(lessonFor(ctx(stu, null), lesson) as never));
check("học viên enrollment undefined → khoá", hidden(lessonFor(ctx(stu, undefined), lesson) as never));
for (const st of ["pending_consent", "suspended", "removed", "", "ACTIVE"]) {
  check(`học viên ghi danh trạng thái "${st}" → khoá`, hidden(lessonFor(ctx(stu, { status: st }), lesson) as never));
}
check("gia sư LẠ (không phải chủ lớp) → khoá", hidden(lessonFor(ctx(tutor(OTHER)), lesson) as never));
check("lớp cũ không có chủ (ownerId null): gia sư nào cũng KHÔNG được coi là chủ", !isCourseManager(tutor(OTHER), null) && hidden(lessonFor(ctx(tutor(OTHER), null, null), lesson) as never));
check("lớp không chủ: quản trị vẫn thấy", shown(lessonFor(ctx(sup, null, null), lesson)));
check("gia sư có userId trùng chuỗi rỗng không thành chủ lớp rỗng", !isCourseManager(tutor(""), null));
check("học viên có enrollment active nhưng là role=admin-teacher lạ vẫn không thành chủ", !isCourseManager({ userId: STU, role: "student" }, STU));

section("Bài miễn phí");
check("bài isFree: khách, chưa ghi danh, gia sư lạ đều thấy link", [null, stu, tutor(OTHER)].every(v => shown(lessonFor(ctx(v), free))));
check("isFree chỉ mở ĐÚNG bài đó: bài trả phí cùng lớp vẫn khoá", hidden(lessonFor(ctx(null), lesson) as never));
check("isFree = truthy-nhưng-không-phải-true ('true', 1) KHÔNG mở khoá", [{ ...lesson, isFree: "true" }, { ...lesson, isFree: 1 }, { ...lesson, isFree: null }, { ...lesson, isFree: undefined }].every(l => hidden(lessonFor(ctx(null), l as never) as never)));

section("Không sửa dữ liệu gốc, giữ phần còn lại");
const before = JSON.stringify(lesson);
const red = redactLesson(lesson);
check("redactLesson không sửa đối tượng gốc", JSON.stringify(lesson) === before && red !== lesson);
check("giữ nguyên tiêu đề, thời lượng, id (để khung bài vẫn hiện)", red.title === "Bài 1" && red.duration === "10:00" && red.id === "l1");
check("chỉ xoá đúng các cột bảo vệ", PROTECTED_LESSON_FIELDS.length === 5 && PROTECTED_LESSON_FIELDS.every(f => f in lesson));
check("bài thiếu một số cột không bị thêm cột lạ", Object.keys(redactLesson({ id: "x", videoUrl: "u" })).sort().join() === "id,videoUrl");

section("Cây Phần → Chương → Bài");
const course = { id: "c1", name: "Lớp", sections: [{ id: "s1", chapters: [{ id: "ch1", lessons: [lesson, free] }] }] };
const t1 = redactCourseTree(ctx(null), course), ls1 = t1.sections[0].chapters[0].lessons as Record<string, unknown>[];
check("khách: bài trả phí khoá, bài miễn phí mở", hidden(ls1[0]) && shown(ls1[1]));
check("khách: tên Phần/Chương/Bài vẫn còn để quyết định đăng ký", t1.sections[0].id === "s1" && t1.sections[0].chapters[0].id === "ch1" && ls1[0].title === "Bài 1");
check("không sửa cây gốc", course.sections[0].chapters[0].lessons[0].videoUrl === lesson.videoUrl);
const t2 = redactCourseTree(ctx(stu, { status: "active" }), course);
check("học viên active: trả nguyên cây", t2 === course);
check("học viên suspended: khoá như người ngoài", hidden((redactCourseTree(ctx(stu, { status: "suspended" }), course).sections[0].chapters[0].lessons as Record<string, unknown>[])[0]));
check("chuỗi JSON toàn cây của khách không chứa bất kỳ URL trả phí nào", !/v\/1|z\/1|a\/1|d\/1/.test(JSON.stringify(redactCourseTree(ctx(null), { ...course, sections: [{ id: "s", chapters: [{ id: "c", lessons: [lesson] }] }] }))));

section("Hàm tổng hợp");
check("canViewAllMaterials / canViewLessonMaterials nhất quán", canViewAllMaterials(ctx(sup)) && !canViewAllMaterials(ctx(null)) && canViewLessonMaterials(ctx(null), free) && !canViewLessonMaterials(ctx(null), lesson));

done();
