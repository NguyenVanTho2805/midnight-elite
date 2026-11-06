// BU-02-PHẲNG — lessonStatus.ts (THUẦN): trạng thái mục Nháp / Đã đăng / Ẩn. Cờ TRẺ EM: chỉ "published" tới học sinh/khách; MỌI giá trị lạ ⇒ không thấy (đóng khi lạ).
// Chạy: npx tsx tools/local-e2e/t-lesson-status-lib.ts   (không cần máy chủ, không cần DB)
// Ca phá cố ý: "Published", "", null, undefined, "archived", số 1, mảng, đối tượng — đều KHÔNG thấy được; chuyển trạng thái chỉ đúng 4/9 ô; cây lọc không lộ tiêu đề/URL bài nháp; không sửa đối tượng gốc.
// Mutation tự thử: đổi `status === "published"` thành `status !== "draft"` ⇒ ca "hidden"/"archived" đỏ; đổi pruneTreeForViewer bỏ nhánh lọc chương ⇒ ca "chương chỉ có nháp biến mất" đỏ.
import { LESSON_STATUSES, PUBLISHED_ONLY, canTransition, isLearnerVisible, isLessonStatus, publishBlockFor, pruneTreeForViewer, transitionError, type LessonStatus } from "@/lib/lessonStatus";
import { learnerLessonWhere } from "@/lib/lessonVisibility";
import { check, section, done } from "./h";

section("isLearnerVisible — ĐÓNG KHI LẠ");
check("chỉ đúng chuỗi 'published' ⇒ true", isLearnerVisible("published") === true);
const weird: unknown[] = ["Published", "PUBLISHED", " published", "published ", "", "draft", "hidden", "archived", null, undefined, 1, 0, true, false, [], ["published"], {}, { status: "published" }, NaN];
check("mọi giá trị khác ⇒ false (Hoa/thường, khoảng trắng, rỗng, null, undefined, số, mảng, đối tượng)", weird.every(v => isLearnerVisible(v) === false), weird.filter(v => isLearnerVisible(v)));
check("PUBLISHED_ONLY là { status: 'published' } và đóng băng về ý nghĩa", PUBLISHED_ONLY.status === "published" && Object.keys(PUBLISHED_ONLY).join() === "status");

section("isLessonStatus");
check("3 giá trị hợp lệ", (["draft", "published", "hidden"] as const).every(isLessonStatus) && LESSON_STATUSES.length === 3);
check("lạ ⇒ false", ["Published", "archived", "", null, undefined, 1, [], {}, "draft "].every(v => !isLessonStatus(v)));

section("canTransition — đủ 9 ô, đúng 4 hợp lệ");
{
  const ok = new Set(["draft>published", "published>hidden", "hidden>published", "hidden>draft"]);
  let n = 0, valid = 0;
  for (const a of LESSON_STATUSES) for (const b of LESSON_STATUSES) {
    n++; const got = canTransition(a, b), want = ok.has(`${a}>${b}`);
    if (got) valid++;
    check(`${a} → ${b} ⇒ ${want ? "hợp lệ" : "✗"}`, got === want);
  }
  check("9 ô, 4 hợp lệ; chuyển về chính nó luôn ✗", n === 9 && valid === 4 && LESSON_STATUSES.every(s => !canTransition(s, s)));
}
section("transitionError — câu tiếng Việt cho ô ✗, null cho ô hợp lệ");
check("draft→hidden: 'chưa từng đăng'", transitionError("draft", "hidden") === "Mục Nháp chưa từng đăng, không cần ẩn.");
check("published→draft: gợi ý dùng Ẩn", /Ẩn/.test(transitionError("published", "draft") ?? ""));
check("ô hợp lệ ⇒ null", transitionError("draft", "published") === null && transitionError("hidden", "draft") === null);
check("bảng: mọi ô ✗ có thông điệp, mọi ô ✓ không có", LESSON_STATUSES.every(a => LESSON_STATUSES.every(b => (transitionError(a, b) === null) === canTransition(a, b))));

section("publishBlockFor — đăng được hay không");
{
  const MSG = "Mục chưa có nội dung. Thêm link hoặc tệp rồi đăng.";
  check("không có nội dung nào ⇒ chặn, nguyên văn", publishBlockFor({ items: [], selfSubmitCount: 0 }) === MSG);
  check("mọi nội dung hỏng, không có bài tập tự nộp ⇒ chặn", publishBlockFor({ items: [{ broken: true }, { broken: true }], selfSubmitCount: 0 }) === MSG);
  check("có 1 nội dung tốt (một phần hỏng) ⇒ đăng được", publishBlockFor({ items: [{ broken: true }, { broken: false }], selfSubmitCount: 0 }) === null);
  check("chỉ có Bài tập tự nộp ⇒ đăng được", publishBlockFor({ items: [], selfSubmitCount: 1 }) === null);
  check("toàn hỏng nhưng có bài tập tự nộp ⇒ đăng được", publishBlockFor({ items: [{ broken: true }], selfSubmitCount: 2 }) === null);
}

section("learnerLessonWhere — mảnh where dùng chung");
check("người học ⇒ { status:'published' }", JSON.stringify(learnerLessonWhere(false)) === '{"status":"published"}');
check("quản lý lớp ⇒ {} (thấy hết)", JSON.stringify(learnerLessonWhere(true)) === "{}");
check("không trả cùng đối tượng với hằng (người gọi sửa thêm không làm bẩn PUBLISHED_ONLY)", learnerLessonWhere(false) !== (PUBLISHED_ONLY as unknown));

section("pruneTreeForViewer — không lộ bài nháp/ẩn");
{
  const L = (id: string, status: unknown, extra: object = {}) => ({ id, title: `TIEU-DE-${id}`, status, videoUrl: `https://youtu.be/URL-${id}`, ...extra });
  const tree = {
    id: "course", name: "Lớp",
    sections: [
      { id: "s1", title: "S-LẪN", chapters: [
        { id: "c1", title: "C-LẪN", lessons: [L("p1", "published"), L("d1", "draft"), L("h1", "hidden")] },
        { id: "c2", title: "C-CHỈ-NHÁP", lessons: [L("d2", "draft"), L("h2", "hidden"), L("x1", "Published"), L("x2", null)] },
        { id: "c3", title: "C-TRỐNG-SẴN", lessons: [] },
      ] },
      { id: "s2", title: "S-CHỈ-NHÁP", chapters: [{ id: "c4", title: "C-CON-NHÁP", lessons: [L("d3", "draft")] }] },
      { id: "s3", title: "S-TRỐNG-SẴN", chapters: [] },
      { id: "s4", title: "S-CHƯƠNG-TRỐNG", chapters: [{ id: "c5", title: "C5", lessons: [] }] },
    ],
  };
  const snapshot = JSON.stringify(tree);
  const v = pruneTreeForViewer(tree, false);
  const flat = JSON.stringify(v);
  check("người học: chỉ còn bài published (p1)", v.sections.flatMap(s => s.chapters.flatMap(c => c.lessons.map(l => l.id))).join() === "p1");
  check("chương chỉ có bài nháp/ẩn/lạ (c2) biến mất; chương lẫn (c1) giữ", v.sections[0].chapters.map(c => c.id).join() === "c1");
  check("phần chỉ có chương bị lọc hết (s2) biến mất", !v.sections.some(s => s.id === "s2"));
  check("chương/phần TRỐNG (c3, s3, s4) không lộ tên cho người học (chương vừa tạo chưa có mục)", v.sections.map(s => s.id).join() === "s1" && !v.sections[0].chapters.some(c => c.id === "c3"));
  check("JSON kết quả KHÔNG chứa tiêu đề/URL/tên chương của bài nháp-ẩn-lạ", !/TIEU-DE-(d1|h1|d2|h2|x1|x2|d3)|URL-(d1|h1|d2|h2|x1|x2|d3)|C-CHỈ-NHÁP|S-CHỈ-NHÁP|C-CON-NHÁP/.test(flat), flat);
  check("JSON kết quả vẫn chứa bài đã đăng", /TIEU-DE-p1/.test(flat));
  check("KHÔNG đổi đối tượng gốc (so JSON trước/sau)", JSON.stringify(tree) === snapshot);
  check("trả đối tượng MỚI, giữ nguyên trường ngoài sections (id, name)", v !== tree && (v as typeof tree).name === "Lớp" && v.id === "course");
  const m = pruneTreeForViewer(tree, true);
  check("quản lý lớp ⇒ nhận nguyên cây (đủ 7 bài ở các trạng thái)", m === tree && JSON.stringify(m) === snapshot);
  check("cây rỗng ⇒ rỗng, không ném", pruneTreeForViewer({ sections: [] }, false).sections.length === 0);
  const allDraft = pruneTreeForViewer({ sections: [{ chapters: [{ lessons: [{ status: "draft" as LessonStatus }] }] }] }, false);
  check("lớp toàn nháp ⇒ sections = [] (khách không thấy cả khung lớp)", allDraft.sections.length === 0);
}

done();
