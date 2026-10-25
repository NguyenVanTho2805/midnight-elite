// MD-03 — ai thấy link học liệu (src/lib/mediaAccess.ts). Thuần, không DB. Có ca phá cố ý: quyền KHÔNG được nới.
import { check, section, done } from "./h";
import { readFileSync } from "node:fs";
import { canViewAllMaterials, canViewLessonMaterials, courseFor, isCourseManager, lessonFor, redactCourseLinks, redactCourseTree, redactLesson, PRIVATE_COURSE_FIELDS, PROTECTED_LESSON_FIELDS, type MediaContext, type MediaViewer } from "@/lib/mediaAccess";

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

section("Link nhóm Zalo + link học online của lớp (cột Course) — chỉ người trong lớp");
const ZG = "https://zalo.me/g/abc123", ZU = "https://zalo.me/g/xyz789", CJ = "https://meet.google.com/abc-defg-hij";
const courseRow = { id: "c1", name: "Lớp Toán 9", price: 0, ownerId: OWNER, introVideo: "https://youtu.be/promo", zaloGroupLink: ZG, zaloGroupUrl: ZU, classJoinUrl: CJ };
const linksHidden = (c: Record<string, unknown>) => c.zaloGroupLink === null && c.zaloGroupUrl === null && c.classJoinUrl === null;
const linksShown = (c: Record<string, unknown>) => c.zaloGroupLink === ZG && c.zaloGroupUrl === ZU && c.classJoinUrl === CJ;
for (const [ten, v, en] of [["quản trị cấp 1", sup, null], ["quản trị nội dung", content, null], ["gia sư CHỦ lớp", tutor(OWNER), null], ["học viên đang học (active)", stu, { status: "active" }]] as const) {
  check(`${ten} → thấy đủ ba link`, linksShown(courseFor(ctx(v, en), courseRow) as never));
}
check("khách (chưa đăng nhập) → cả ba link = null", linksHidden(courseFor(ctx(null), courseRow) as never));
check("học viên CHƯA ghi danh → null", linksHidden(courseFor(ctx(stu, null), courseRow) as never));
for (const st of ["pending_consent", "suspended", "removed", "", "ACTIVE"]) {
  check(`học viên ghi danh "${st}" → null (không phải đang học thì không cần link nhóm / link vào lớp)`, linksHidden(courseFor(ctx(stu, { status: st }), courseRow) as never));
}
check("gia sư LẠ (không phải chủ lớp) → null", linksHidden(courseFor(ctx(tutor(OTHER)), courseRow) as never));
check("lớp cũ không có chủ (ownerId null): gia sư nào cũng KHÔNG được thấy", linksHidden(courseFor(ctx(tutor(OTHER), null, null), { ...courseRow, ownerId: null }) as never));
const redacted = courseFor(ctx(null), courseRow) as Record<string, unknown>;
check("các cột công khai giữ nguyên (tên, giá, video giới thiệu)", redacted.id === "c1" && redacted.name === "Lớp Toán 9" && redacted.price === 0 && redacted.introVideo === "https://youtu.be/promo");
check("không sửa đối tượng gốc", courseRow.zaloGroupLink === ZG && courseRow.zaloGroupUrl === ZU && courseRow.classJoinUrl === CJ);
check("JSON của khách không chứa bất kỳ link riêng tư nào", !/zalo\.me|meet\.google/.test(JSON.stringify(courseFor(ctx(null), courseRow))));
check("đối tượng thiếu cột (select hẹp) không bị thêm cột lạ", JSON.stringify(redactCourseLinks({ id: "x", name: "n" })) === JSON.stringify({ id: "x", name: "n" }));
check("redactCourseLinks gọi lại được nhiều lần (idempotent)", linksHidden(redactCourseLinks(redactCourseLinks(courseRow)) as never));

section("Đối chiếu với schema: cột link mới của Course buộc phải được quyết định");
const schema = readFileSync("prisma/schema.prisma", "utf8");
const model = /model Course \{([\s\S]*?)\n\}/.exec(schema)?.[1] ?? "";
const cols = [...model.matchAll(/^\s{2}([A-Za-z][A-Za-z0-9]*)\s+/gm)].map(m => m[1]);
const linkish = cols.filter(c => /(url|link)$/i.test(c));
check("đọc được model Course trong schema.prisma (không rỗng)", cols.length > 10 && cols.includes("zaloGroupUrl"), cols.length);
check(`mọi cột có đuôi Url / Link của Course (${linkish.join(", ")}) đều nằm trong PRIVATE_COURSE_FIELDS — cột link mới mà không quyết định sẽ làm đỏ ca này`, linkish.every(c => (PRIVATE_COURSE_FIELDS as readonly string[]).includes(c)), linkish);
check("mọi cột trong PRIVATE_COURSE_FIELDS có thật trong schema (đổi tên cột mà quên đổi ở đây thì đỏ)", PRIVATE_COURSE_FIELDS.every(c => cols.includes(c)), PRIVATE_COURSE_FIELDS);

done();
