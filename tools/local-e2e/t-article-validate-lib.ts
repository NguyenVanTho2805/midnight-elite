// ADM-002 — luật máy chủ cho bài viết (src/lib/articleValidate.ts). THUẦN: không DB, không máy chủ.
// Ca phá cố ý: đổi TITLE_MIN thành 1 → ca "tiêu đề 9 ký tự" đỏ; đổi CONTENT_MIN thành 1 → ca "nội dung 99 ký tự" đỏ; bỏ `/[a-z0-9]/` → ca slug "---" đỏ;
// bỏ `slugChanged === false` bỏ qua → ca "slug cũ không hợp lệ được giữ khi không đổi" đỏ.
import { CONTENT_MIN, SLUG_MIN, TITLE_MIN, contentError, slugError, titleError, toArticleSlug, validateArticleText } from "@/lib/articleValidate";
import { SLUG_MAX } from "@/lib/articleSource";
import { check, section, done } from "./h";

const rep = (c: string, n: number) => c.repeat(n);

section("Hằng số");
check("slug 3–80, tiêu đề ≥ 10, nội dung ≥ 100", SLUG_MIN === 3 && SLUG_MAX === 80 && TITLE_MIN === 10 && CONTENT_MIN === 100);

section("Slug");
const okSlugs = ["abc", "a-b", "tuyen-sinh-2026", "123", rep("a", 80)];
const badSlugs: [string, unknown][] = [["rỗng", ""], ["2 ký tự", "ab"], ["81 ký tự", rep("a", 81)], ["chữ hoa", "Abc"], ["có dấu", "tuyển-sinh"], ["khoảng trắng", "a b c"], ["gạch dưới", "a_b"], ["chỉ gạch ngang", "---"], ["số", 123], ["null", null]];
for (const s of okSlugs) check(`slug hợp lệ: ${s.length > 20 ? s.length + " ký tự" : s}`, slugError(s) === null, slugError(s));
for (const [n, s] of badSlugs) check(`slug sai: ${n}`, slugError(s) !== null);
check("slug có khoảng trắng hai đầu được cắt rồi mới kiểm", slugError("  abc  ") === null);
check("lời báo nêu đúng khoảng 3–80", /3–80/.test(slugError("a") ?? ""));

section("Tiêu đề");
check("10 ký tự đạt, 9 ký tự không", titleError(rep("x", 10)) === null && titleError(rep("x", 9)) !== null);
check("khoảng trắng hai đầu không tính", titleError("   " + rep("x", 9) + "   ") !== null && titleError("   " + rep("x", 10) + "   ") === null);
check("đếm theo ký tự hiển thị, không theo byte (tiếng Việt có dấu)", titleError("Tuyển sinh") === null && titleError("Tuyển sin") !== null);
check("không phải chuỗi → lỗi", titleError(undefined) !== null && titleError(12345678901) !== null);

section("Nội dung");
check("100 ký tự đạt, 99 ký tự không", contentError(rep("n", 100)) === null && contentError(rep("n", 99)) !== null);
check("khoảng trắng và đổi dòng hai đầu không tính", contentError("\n\n" + rep("n", 99) + "  \n") !== null);

section("validateArticleText");
const good = { title: "Điểm chuẩn năm 2026", slug: "diem-chuan-2026", content: rep("n", 120) };
check("đủ ba trường hợp lệ → null", validateArticleText(good) === null);
check("thứ tự lỗi: tiêu đề trước, rồi slug, rồi nội dung", validateArticleText({ title: "x", slug: "A", content: "y" })?.field === "title" && validateArticleText({ ...good, slug: "A", content: "y" })?.field === "slug" && validateArticleText({ ...good, content: "y" })?.field === "content");
check("khoá vắng = không kiểm (PATCH chỉ đổi published)", validateArticleText({}) === null && validateArticleText({ title: undefined, slug: undefined, content: undefined }) === null);
check("chỉ gửi nội dung ngắn → lỗi nội dung", validateArticleText({ content: "ngắn" })?.field === "content");
check("slug cũ không hợp lệ được giữ khi không đổi (slugChanged=false)", validateArticleText({ slug: "A_old" }, { slugChanged: false }) === null && validateArticleText({ slug: "A_old" }, { slugChanged: true })?.field === "slug" && validateArticleText({ slug: "A_old" })?.field === "slug");

section("Slug đề xuất từ tiêu đề");
check("bỏ dấu, thường, nối bằng gạch ngang", toArticleSlug("Điểm chuẩn Đại học 2026") === "diem-chuan-dai-hoc-2026");
const long = toArticleSlug(rep("tuyen sinh ", 20));
check("tiêu đề dài → slug ≤ 80 và cắt ở ranh giới từ (không kết thúc bằng nửa từ cụt)", long.length <= SLUG_MAX && long.length > 0 && /^[a-z0-9-]+$/.test(long) && !long.endsWith("-") && long.split("-").every(w => w === "tuyen" || w === "sinh"), long);
check("slug đề xuất hợp lệ khi tiêu đề đủ dài", slugError(toArticleSlug("Thông báo tuyển sinh năm học mới")) === null);
check("tiêu đề quá ngắn → slug có thể < 3 ký tự (người dùng phải nhập tay)", slugError(toArticleSlug("Hi")) !== null);

done();
