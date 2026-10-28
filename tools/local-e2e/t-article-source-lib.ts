// NC2-051 — src/lib/articleSource.ts: nguồn + ảnh bìa của bài Tin tức, và "dán nhanh" từ bài đăng Facebook.
// PHÁ CỐ Ý: link nguồn nguy hiểm (javascript:, ftp:, data:, tên đăng nhập trong URL, quá dài, không có giao thức, sai kiểu), ảnh bìa không phải https,
// tên nguồn quá dài / không có link, chữ dán rỗng / một dòng / dòng đầu quá dài / CRLF / ký tự tàng hình / chữ có dấu dạng tổ hợp.
import { cleanArticleSource, draftFromPaste, normalizePasted, SOURCE_NAME_MAX, COVER_URL_MAX, TITLE_MAX, EXCERPT_MAX, SLUG_MAX } from "@/lib/articleSource";
import { check, section, done } from "./h";

const bad = (name: string, raw: Parameters<typeof cleanArticleSource>[0], field: string) => {
  const r = cleanArticleSource(raw);
  check(name, !r.ok && r.field === field && r.error.length > 10, r);
};

section("Nguồn + ảnh bìa: trống");
let r = cleanArticleSource({});
check("không gửi gì → nhận, cả ba là null", r.ok && r.value.sourceUrl === null && r.value.sourceName === null && r.value.coverImage === null, r);
r = cleanArticleSource({ sourceUrl: "", sourceName: "", coverImage: "" });
check("chuỗi rỗng → null", r.ok && r.value.sourceUrl === null && r.value.coverImage === null, r);
r = cleanArticleSource({ sourceUrl: "   ", coverImage: " \n " });
check("toàn khoảng trắng → coi như trống (không báo lỗi)", r.ok && r.value.sourceUrl === null && r.value.coverImage === null, r);
r = cleanArticleSource({ sourceUrl: null, sourceName: null, coverImage: null });
check("null → nhận, null", r.ok && r.value.sourceUrl === null, r);

section("Nguồn hợp lệ");
r = cleanArticleSource({ sourceUrl: "https://www.facebook.com/kin.edu/posts/123" });
check("link Facebook → nhận; tên nguồn để trống thì lấy tên miền bỏ 'www.' (facebook.com)", r.ok && r.value.sourceUrl === "https://www.facebook.com/kin.edu/posts/123" && r.value.sourceName === "facebook.com", r);
r = cleanArticleSource({ sourceUrl: "http://tuyensinh.example.edu.vn/thong-bao", sourceName: "  Phòng  Đào tạo \n ĐH Mẫu " });
check("http cũng nhận cho NGUỒN; tên nguồn gộp khoảng trắng / dòng", r.ok && r.value.sourceName === "Phòng Đào tạo ĐH Mẫu", r);
r = cleanArticleSource({ sourceUrl: "https://example.edu.vn/a", sourceName: "\u200b\u200d\ufeff \u2060" });
check("tên nguồn chỉ toàn ký tự tàng hình → coi là trống, lấy tên miền (không có liên kết chữ vô hình)", r.ok && r.value.sourceName === "example.edu.vn", r);
const NFC = "Tuyển sinh".normalize("NFC"), NFD = NFC.normalize("NFD");
check("(kiểm tra bài) hai dạng chữ thật sự khác nhau về byte", NFC !== NFD);
r = cleanArticleSource({ sourceUrl: "https://example.edu.vn/a", sourceName: NFD });
check("tên nguồn chữ có dấu dạng tổ hợp (NFD) → chuẩn hoá NFC", r.ok && r.value.sourceName === NFC, r);
r = cleanArticleSource({ sourceName: "Không có link" });
check("có tên nguồn mà không có link → tên bị bỏ (null): tên chỉ là nhãn của link", r.ok && r.value.sourceName === null && r.value.sourceUrl === null, r);
r = cleanArticleSource({ sourceUrl: "https://example.edu.vn/a", sourceName: "x".repeat(SOURCE_NAME_MAX) });
check(`tên nguồn đúng ${SOURCE_NAME_MAX} ký tự → nhận`, r.ok && r.value.sourceName?.length === SOURCE_NAME_MAX, r);

section("Nguồn nguy hiểm / sai → báo lỗi ở ô sourceUrl");
bad("javascript:", { sourceUrl: "javascript:alert(1)" }, "sourceUrl");
bad("JaVaScRiPt: viết hoa xen kẽ", { sourceUrl: "JaVaScRiPt:alert(1)" }, "sourceUrl");
bad("ftp://", { sourceUrl: "ftp://example.edu.vn/a" }, "sourceUrl");
bad("data:text/html", { sourceUrl: "data:text/html,<script>alert(1)</script>" }, "sourceUrl");
bad("tên đăng nhập trong URL (https://tin-cay.vn@xau.com)", { sourceUrl: "https://tin-cay.vn@xau.example.com/" }, "sourceUrl");
bad("không có giao thức (facebook.com/abc)", { sourceUrl: "facebook.com/abc" }, "sourceUrl");
bad("máy chủ không có dấu chấm (http://localhost)", { sourceUrl: "http://localhost/abc" }, "sourceUrl");
bad("quá 500 ký tự", { sourceUrl: "https://example.edu.vn/" + "a".repeat(500) }, "sourceUrl");
bad("số thay vì chữ", { sourceUrl: 12345 as unknown as string }, "sourceUrl");
bad("đối tượng thay vì chữ", { sourceUrl: { href: "https://example.edu.vn" } as unknown as string }, "sourceUrl");
bad(`tên nguồn quá ${SOURCE_NAME_MAX} ký tự → lỗi ở ô sourceName`, { sourceUrl: "https://example.edu.vn/a", sourceName: "x".repeat(SOURCE_NAME_MAX + 1) }, "sourceName");

section("Ảnh bìa");
r = cleanArticleSource({ coverImage: "https://cdn.example.edu.vn/anh-bia.jpg" });
check("https → nhận", r.ok && r.value.coverImage === "https://cdn.example.edu.vn/anh-bia.jpg", r);
const long600 = "https://scontent.example.net/v/t39/" + "a".repeat(560) + ".jpg";
r = cleanArticleSource({ coverImage: long600 });
check("link ảnh dài ~600 ký tự (kiểu CDN) → nhận (giới hạn ảnh rộng hơn giới hạn link nguồn)", r.ok && r.value.coverImage === long600, r);
bad("cùng độ dài 600 làm LINK NGUỒN → bị từ chối (giới hạn 500)", { sourceUrl: long600 }, "sourceUrl");
bad("http (không phải https) → từ chối", { coverImage: "http://cdn.example.edu.vn/a.jpg" }, "coverImage");
bad("javascript: làm ảnh bìa", { coverImage: "javascript:alert(1)" }, "coverImage");
bad("data: làm ảnh bìa", { coverImage: "data:image/svg+xml,<svg onload=alert(1)>" }, "coverImage");
bad("tên đăng nhập trong link ảnh", { coverImage: "https://a@evil.example.com/x.png" }, "coverImage");
bad(`quá ${COVER_URL_MAX} ký tự`, { coverImage: "https://cdn.example.edu.vn/" + "a".repeat(COVER_URL_MAX) }, "coverImage");
bad("không có dấu chấm trong tên máy chủ", { coverImage: "https://intranet/a.png" }, "coverImage");
check("nguồn sai và ảnh bìa đúng: lỗi nằm ở nguồn (thứ tự kiểm: nguồn → tên → ảnh)", (() => { const x = cleanArticleSource({ sourceUrl: "javascript:1", coverImage: "https://cdn.example.edu.vn/a.jpg" }); return !x.ok && x.field === "sourceUrl"; })());

section("normalizePasted");
check("CRLF → LF, tối đa MỘT dòng trống, bỏ khoảng trắng cuối dòng", normalizePasted("a  \r\nb\r\n\r\n\r\n\r\nc \t\r\n") === "a\nb\n\nc", JSON.stringify(normalizePasted("a  \r\nb\r\n\r\n\r\n\r\nc \t\r\n")));
check("bỏ ký tự tàng hình (zero-width, BOM, NUL, ký tự điều khiển) nhưng giữ đổi dòng; tab trong dòng thành MỘT khoảng trắng (hai từ không dính nhau)", normalizePasted("a\u200bb\ufeffc\u0000d\u0007e\nf\tg") === "abcde\nf g", JSON.stringify(normalizePasted("a\u200bb\ufeffc\u0000d\u0007e\nf\tg")));

section("draftFromPaste: không có chữ");
check("rỗng / toàn khoảng trắng / toàn ký tự tàng hình → null", draftFromPaste("") === null && draftFromPaste("  \n\t \r\n ") === null && draftFromPaste("\u200b\ufeff\u0000") === null);
check("không phải chữ (số, null) → null, không ném lỗi", draftFromPaste(5 as unknown as string) === null && draftFromPaste(null as unknown as string) === null);

section("draftFromPaste: dòng đầu = tiêu đề");
let d = draftFromPaste("THÔNG BÁO: Điểm chuẩn ĐH Mẫu 2026\n\nTrường vừa công bố điểm chuẩn.\nNgành CNTT 27,5 điểm.\n\n#tuyensinh #2026");
check("dòng đầu ngắn → tiêu đề; nội dung là phần còn lại (không lặp tiêu đề)", !!d && d.title === "THÔNG BÁO: Điểm chuẩn ĐH Mẫu 2026" && d.content === "Trường vừa công bố điểm chuẩn.\nNgành CNTT 27,5 điểm.\n\n#tuyensinh #2026", d);
check("tóm tắt: nội dung dồn một dòng", !!d && d.excerpt === "Trường vừa công bố điểm chuẩn. Ngành CNTT 27,5 điểm. #tuyensinh #2026", d?.excerpt);
check("slug từ tiêu đề: không dấu, gạch nối", !!d && d.slug === "thong-bao-diem-chuan-dh-mau-2026", d?.slug);
d = draftFromPaste("Chỉ một dòng ngắn");
check("chỉ một dòng ngắn → tiêu đề = nội dung = dòng đó", !!d && d.title === "Chỉ một dòng ngắn" && d.content === "Chỉ một dòng ngắn" && d.excerpt === "Chỉ một dòng ngắn", d);
d = draftFromPaste("\r\n\r\n\r\n  Tiêu đề ở dòng thứ ba  \r\n\r\n\r\n\r\n\r\nĐoạn một\r\nĐoạn hai");
check("CRLF, dòng trống đầu, 5 dòng trống giữa → tiêu đề đúng, nội dung gọn, không còn \\r", !!d && d.title === "Tiêu đề ở dòng thứ ba" && d.content === "Đoạn một\nĐoạn hai" && !/\r/.test(d.content), d);
d = draftFromPaste("<script>alert(1)</script>\n<b>in đậm</b> & \"trích\"");
check("HTML dán vào vẫn là CHỮ (không bị cắt hay thoát ở đây; React thoát khi hiển thị)", !!d && d.title === "<script>alert(1)</script>" && d.content === "<b>in đậm</b> & \"trích\"", d);
d = draftFromPaste(`${NFD}\nNội dung`);
check("tiêu đề dán ở dạng tổ hợp (NFD) → NFC", !!d && d.title === NFC, d?.title);

section("draftFromPaste: dòng đầu quá dài");
const longFirst = "Thông báo tuyển sinh đại học chính quy năm 2026 của trường mẫu với nhiều ngành mới và học bổng ".repeat(3).trim();
d = draftFromPaste(longFirst);
check(`dòng đầu > ${TITLE_MAX} ký tự (bài chỉ một đoạn) → tiêu đề ≤ ${TITLE_MAX}, kết thúc bằng '…', cắt ở ranh giới từ`, !!d && d.title.length <= TITLE_MAX && d.title.endsWith("…") && longFirst.startsWith(d.title.slice(0, -1).trimEnd()) && !/\s…$/.test(d.title), d?.title);
check("…và nội dung là TOÀN BỘ chữ dán (không mất chữ)", !!d && d.content === longFirst, d?.content.length);
d = draftFromPaste(longFirst + "\nDòng hai");
check("dòng đầu quá dài + dòng thứ hai → nội dung vẫn là toàn bộ chữ dán", !!d && d.content === longFirst + "\nDòng hai" && d.title.length <= TITLE_MAX, d);
d = draftFromPaste("x".repeat(TITLE_MAX) + "\nphần sau");
check(`dòng đầu đúng ${TITLE_MAX} ký tự → còn là tiêu đề nguyên vẹn`, !!d && d.title === "x".repeat(TITLE_MAX) && d.content === "phần sau", d?.title.length);
d = draftFromPaste("y".repeat(TITLE_MAX + 1) + "\nphần sau");
check(`dòng đầu ${TITLE_MAX + 1} ký tự không có khoảng trắng → vẫn cắt ≤ ${TITLE_MAX} và có '…' (không treo)`, !!d && d.title.length <= TITLE_MAX && d.title.endsWith("…"), d?.title.length);

section("draftFromPaste: tóm tắt, thời gian đọc, slug");
d = draftFromPaste("Tiêu đề\n" + "chữ ".repeat(300));
check(`nội dung dài → tóm tắt ≤ ${EXCERPT_MAX} ký tự và kết thúc '…'`, !!d && d.excerpt.length <= EXCERPT_MAX && d.excerpt.endsWith("…"), d?.excerpt.length);
d = draftFromPaste("Tiêu đề\n" + "a".repeat(EXCERPT_MAX));
check(`nội dung đúng ${EXCERPT_MAX} ký tự → tóm tắt nguyên vẹn, KHÔNG thêm '…'`, !!d && d.excerpt.length === EXCERPT_MAX && !d.excerpt.endsWith("…"), d?.excerpt.length);
d = draftFromPaste("Tiêu đề\n" + "a".repeat(EXCERPT_MAX + 1));
check(`nội dung ${EXCERPT_MAX + 1} ký tự không có khoảng trắng → tóm tắt vẫn ≤ ${EXCERPT_MAX}`, !!d && d.excerpt.length <= EXCERPT_MAX && d.excerpt.endsWith("…"), d?.excerpt.length);
d = draftFromPaste("T\n" + "từ ".repeat(50));
check("50 từ → đọc 1 phút", d?.readTime === 1, d?.readTime);
d = draftFromPaste("T\n" + "từ ".repeat(200));
check("200 từ → 1 phút (không làm tròn lên thành 2)", d?.readTime === 1, d?.readTime);
d = draftFromPaste("T\n" + "từ ".repeat(201));
check("201 từ → 2 phút", d?.readTime === 2, d?.readTime);
d = draftFromPaste("T\n" + "từ ".repeat(100000));
check("bài khổng lồ → thời gian đọc bị kẹp ở 60 (đúng giới hạn ô nhập của form)", d?.readTime === 60, d?.readTime);
d = draftFromPaste("Điểm chuẩn ĐH Kinh tế 2026!");
check("slug: bỏ dấu, đ → d, bỏ dấu chấm than", d?.slug === "diem-chuan-dh-kinh-te-2026", d?.slug);
d = draftFromPaste(("Tuyển sinh " + "đại học ".repeat(30)).trim() + "\nnội dung");
check(`tiêu đề dài → slug ≤ ${SLUG_MAX}, không kết thúc bằng '-', chỉ gồm a-z 0-9 và '-'`, !!d && d.slug.length <= SLUG_MAX && !d.slug.endsWith("-") && /^[a-z0-9-]+$/.test(d.slug), d?.slug);
d = draftFromPaste("🎓🎓🎓\nnội dung");
check("tiêu đề chỉ có biểu tượng → slug rỗng (form bắt quản trị tự nhập slug, KHÔNG tự bịa)", !!d && d.slug === "", d);

done();
