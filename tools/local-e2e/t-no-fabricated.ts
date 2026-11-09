// Không bịa số liệu / cam kết / người thật — kiểm tra tĩnh trên mã nguồn (không cần máy chủ). Rà soát 14/10/2026: những thứ dưới đây từng
// nằm trong mã mà KHÔNG có nguồn (không có trong Figma, tài liệu hay dữ liệu thật) hoặc trái với cách sản phẩm vận hành.
// Muốn đưa lại một số liệu/cam kết: có nguồn thật rồi mới sửa danh sách này, kèm lý do.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { check, section, done } from "./h";
import { checkClaims } from "@/lib/homeContentGuard";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf-8");
const walk = (d: string, out: string[] = []) => { for (const n of readdirSync(join(ROOT, d))) { const p = join(d, n); if (statSync(join(ROOT, p)).isDirectory()) { if (n !== "generated") walk(p, out); } else out.push(p); } return out; };
const src = walk("src").filter(p => /\.(tsx?|css)$/.test(p));

(async () => {
  section("Dữ liệu mẫu đã xoá");
  for (const f of [
    "src/lib/teacherData.ts", "src/lib/curriculum.ts", "src/components/CourseShowcase.tsx", "src/components/Features.tsx",
    "src/components/Leaderboard.tsx", "src/components/PopupStrikeWarning.tsx", "src/components/PopupDeviceLimit.tsx",
    "prisma/seed.ts", "prisma/seed-users.ts",
  ]) check(`${f} không còn`, !existsSync(join(ROOT, f)));
  const pkg = JSON.parse(read("package.json"));
  check("package.json không còn script db:seed / prisma.seed (chúng xoá sạch người dùng + khoá học rồi tạo admin mật khẩu 'admin123')", !pkg.scripts?.["db:seed"] && !pkg.scripts?.seed && !pkg.prisma?.seed, [pkg.scripts?.["db:seed"], pkg.prisma]);
  const cd = read("src/lib/courseData.ts");
  check("courseData.ts không còn danh sách khoá học mẫu (COURSES / ENROLLED_IDS / COURSE_HASHTAGS)", !/export const (COURSES|ENROLLED_IDS|ALL_COURSES|COURSE_HASHTAGS)\b/.test(cd));
  check("courseData.ts vẫn xuất danh mục dùng thật", /COURSE_CATEGORIES/.test(cd) && /CATEGORY_GRADIENT/.test(cd) && /ADMIN_CATEGORIES/.test(cd));

  section("Cụm từ bịa không được lọt lại");
  const BANNED: [RegExp, string, string[]][] = [
    [/1\.200\+|10\.000\+/, "số liệu 'học sinh / đề thi' bịa ở trang chủ", []],
    [/2,847|2\.847/, "tổng thí sinh bịa trên bảng xếp hạng", []],
    [/support@tsix/i, "email hỗ trợ của thương hiệu cũ (hai địa chỉ khác nhau, không địa chỉ nào xác nhận)", []],
    [/Hoàn tiền 100%/i, "cam kết hoàn tiền bịa (KiN không thu học phí hộ)", []],
    [/Strike system|hệ thống gậy|3 gậy/i, "hệ thống kỷ luật 'gậy' không hề có", []],
    [/hàng đầu Việt Nam/i, "lời tự xưng 'hàng đầu' không có căn cứ", []],
    [/Học trọn đời|Mua 1 lần, xem không giới hạn/i, "trái cách bán thật (học phí theo tháng)", []],
    [/AI hỗ trợ giải bài|hỏi AI 24\/7|AI giải bài 24\/7|Ngoài giờ có AI/i, "cam kết AI khi chưa có AI thật", []],
    [/VNPay/i, "đối tác thanh toán không hề tích hợp", []],
    [/Combo 8 môn chỉ|tiết kiệm 57%/i, "khoá Combo và mức giảm giá bịa", []],
    [/Mô phỏng đăng nhập thiết bị|\(đã kick\)/i, "khối 'Thiết bị' giả ở hồ sơ học sinh", []],
    [/Khóa học toàn diện với đầy đủ bài giảng/i, "mô tả khoá học dùng chung cho mọi khoá", []],
    [/Kích hoạt (nhanh chóng|sau khi xác nhận)|trong vòng 24 giờ/i, "cam kết thời gian kích hoạt bịa", ["src/app/(guest)/chinh-sach/page.tsx"]],
    [/Google Analytics|Hotjar/i, "công cụ phân tích không hề gắn (trang chính sách chỉ được nhắc để nói KiN KHÔNG dùng)", ["src/app/(guest)/chinh-sach/page.tsx"]],
    [/47 đề thi/i, "câu 'đã đối chiếu 47 đề' của bong bóng AI giả", ["src/components/AIChatWidget.tsx", "src/app/(student)/layout.tsx"]],
    // STU-002: sáu lời hứa trang chủ từng có mà KiN không có. Không dùng /streak/i hay /GPA, streak/i trần — khớp tên biến ở api/users/me/stats.
    [/trợ giảng (riêng|phản hồi|người thật)|phân công trợ giảng/i, "KiN không có vai trợ giảng", ["src/app/(admin)/admin/quan-tri-vien/page.tsx"]],
    [/live mỗi tối|Học trực tiếp LIVE|video quay sẵn/i, "KiN không tổ chức lớp live", []],
    [/realtime|thời gian thực/i, "không có cập nhật thời gian thực", []],
    [/(phản hồi|trả lời) trong ngày/i, "SLA trả lời không ai đỡ", []],
    [/24\/7/, "KiN không hỗ trợ 24/7", []],
    [/thứ hạng toàn hệ thống|GPA, streak và/, "không có dashboard GPA/streak realtime", []],
  ];
  // HOME-02: src/lib/homeContentGuard.ts LÀ danh sách cụm cấm (chặn khi quản trị lưu chữ trang chủ), nên tự nó chứa các cụm này dưới dạng biểu thức chính quy.
  const GUARD_LISTS = ["src/lib/homeContentGuard.ts"];
  for (const [re, why, allow] of BANNED) {
    const hit = src.filter(p => !allow.includes(p) && !GUARD_LISTS.includes(p) && re.test(read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")));
    check(`không còn ${re.source.slice(0, 40)}${re.source.length > 40 ? "…" : ""} — ${why}`, hit.length === 0, hit);
  }
  // ca phá cố ý (STU-002): bộ quét phải bắt được câu vi phạm, và không bắt nhầm tên biến / câu nói KiN KHÔNG có trợ giảng.
  check("[phá cố ý] bộ quét bắt 'Trợ giảng riêng 1-1', 'live mỗi tối', 'realtime', 'phản hồi trong ngày', '24/7'",
    ["Trợ giảng riêng 1-1", "Buổi học live mỗi tối", "Theo dõi tiến độ realtime", "trợ giảng phản hồi trong ngày", "Hỗ trợ 24/7"].every(t => BANNED.some(([re]) => re.test(t))));
  check("[không bắt nhầm] 'gpa, streak, rank' và 'Trợ giảng, nhiều giáo viên' không khớp 6 dòng STU-002",
    ["gpa, streak, rank", "Trợ giảng, nhiều giáo viên"].every(t => !BANNED.slice(-6).some(([re]) => re.test(t))));

  section("Bong bóng 'KiN AI' giả không được gắn");
  const users = src.filter(p => p !== "src/components/AIChatWidget.tsx" && /AIChatWidget/.test(read(p).replace(/^\s*\/\/.*$/gm, "")));
  check("không tệp nào import AIChatWidget (nó chỉ trả chữ viết sẵn sau 2 giây)", users.length === 0, users);
  check("AIChatWidget.tsx có ghi chú 'KHÔNG GẮN LẠI' ở đầu tệp", /^\/\/ KHÔNG GẮN LẠI/.test(read("src/components/AIChatWidget.tsx")));

  section("Số liệu trang chủ là số đếm thật");
  const home = read("src/app/page.tsx");
  check("trang chủ đếm từ cơ sở dữ liệu (prisma) và làm mới theo giờ", /prisma\./.test(home) && /export const revalidate = 3600/.test(home));
  check("số nào bằng 0 thì ẩn, truy vấn lỗi thì ẩn cả khối (không bao giờ hiện số bịa)", /filter\(s => s\.value > 0\)/.test(home) && /catch \{\s*return \[\];/.test(home) && /stats\.length > 0/.test(read("src/components/guest/HomeSections.tsx")));
  check("không còn mảng STATS viết cứng", !/const STATS\s*=/.test(home));

  // BU-HS-LANDING (09/11/2026): trang chủ công khai dựng lại theo bố cục hsavnu; những khối của HSA mà KiN KHÔNG có dữ liệu thật (lời chứng thực, bảng vàng, "50.000+ học viên", tên giáo viên viết cứng)
  // không được dựng bằng chữ mẫu. Bộ quét chạy trên mã đã bỏ chú thích (chú thích được phép nhắc tên khối đã hoãn); phần "ca phá cố ý" chứng minh bộ quét bắt được và không bắt nhầm.
  section("Landing: khối không có dữ liệu thật không được dựng");
  const stripComments = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const HOME_FILE = /^src\/components\/guest\/Home[^/]*\.tsx$/;
  const FAKE_BLOCK_FILE = /^src\/components\/guest\/Home(Testimonials?|Honor|Reviews?)[^/]*\.tsx$/;
  const TESTIMONIAL_TEXT = /Học viên nói gì|Bảng vàng|lời chứng thực|Phụ huynh nói/i;
  const FABRICATED_COUNT = [/\d{1,3}(\.\d{3})+\+/, /\d+\+\s*(học viên|học sinh|gia sư|giáo viên|đề)/i] as const; // "50.000+ học viên", "200+ gia sư"
  // Tên người viết cứng: \p{Lu}\p{Ll} (không chỉ [A-ZĐ][a-z]) để "Cô Ánh Nguyệt" cũng bị bắt; "Gia sư <tên từ dữ liệu>" không khớp vì "Gia sư" không nằm trong danh sách.
  const HARDCODED_PERSON = /(Thầy|Cô|ThS|TS)\.?\s+\p{Lu}\p{Ll}+/u;
  const homeFiles = src.filter(p => HOME_FILE.test(p));
  check("có đủ tệp khối trang chủ để quét (HomeSections, HomeTutors, HomeCourses, HomeExams, HomeNews…)", ["HomeSections", "HomeTutors", "HomeCourses", "HomeExams", "HomeNews", "HomeLandingBlocks"].every(n => homeFiles.includes(`src/components/guest/${n}.tsx`)), homeFiles);
  check("không có tệp khối lời chứng thực / bảng vàng / đánh giá (Home{Testimonials,Honor,Reviews}*.tsx)", src.filter(p => FAKE_BLOCK_FILE.test(p)).length === 0, src.filter(p => FAKE_BLOCK_FILE.test(p)));
  const testiHits = [...homeFiles, "src/lib/siteContent.ts"].filter(p => TESTIMONIAL_TEXT.test(stripComments(read(p))));
  check("HomeSections.tsx, Home*.tsx và chữ mặc định (siteContent.ts) không có 'Học viên nói gì', 'Bảng vàng', 'lời chứng thực', 'Phụ huynh nói'", testiHits.length === 0, testiHits);
  for (const re of FABRICATED_COUNT) {
    const hit = src.filter(p => !GUARD_LISTS.includes(p) && re.test(stripComments(read(p))));
    check(`không tệp src nào có cụm số bịa ${re.source.slice(0, 44)} (kiểu '50.000+ học viên')`, hit.length === 0, hit);
  }
  const personHits = homeFiles.filter(p => HARDCODED_PERSON.test(stripComments(read(p))));
  check("không tên người viết cứng (Thầy / Cô / ThS / TS + Họ) trong Home*.tsx: tên gia sư chỉ đến từ dữ liệu", personHits.length === 0, personHits);
  // [phá cố ý] bộ quét phải bắt đúng cái cần bắt…
  check("[phá cố ý] bộ quét số bịa bắt '50.000+ học viên', '1.200+ gia sư', '200+ đề', '3+ giáo viên'", ["50.000+ học viên", "Hơn 1.200+ gia sư", "200+ đề thi thử", "3+ giáo viên"].every(t => FABRICATED_COUNT.some(re => re.test(t))));
  check("[phá cố ý] bộ quét tên người bắt 'Cô Nguyễn Lan', 'Cô Ánh Nguyệt', 'Thầy Bình', 'TS. Trần Hà', 'ThS Lê Minh'", ["Cô Nguyễn Lan", "Cô Ánh Nguyệt", "Thầy Bình", "TS. Trần Hà", "ThS Lê Minh"].every(t => HARDCODED_PERSON.test(t)));
  check("[phá cố ý] bộ quét lời chứng thực bắt 'Học viên nói gì', 'Bảng vàng học viên', 'Lời chứng thực', 'Phụ huynh nói gì'", ["Học viên nói gì", "Bảng vàng học viên", "Lời chứng thực", "Phụ huynh nói gì"].every(t => TESTIMONIAL_TEXT.test(t)));
  check("[phá cố ý] tên tệp: HomeTestimonials / HomeHonorRoll / HomeReviewsStrip bị bắt, HomeTutors / HomeNews không", ["HomeTestimonials", "HomeHonorRoll", "HomeReviewsStrip"].every(n => FAKE_BLOCK_FILE.test(`src/components/guest/${n}.tsx`)) && !["HomeTutors", "HomeNews", "HomeCommunity"].some(n => FAKE_BLOCK_FILE.test(`src/components/guest/${n}.tsx`)));
  {
    // …và bắt trên chính mã thật khi bị chèn: lấy HomeTutors.tsx thật, thêm một dòng bịa, quét lại.
    const real = read("src/components/guest/HomeTutors.tsx");
    const tampered = (line: string) => stripComments(real) + `\n<p>${line}</p>`;
    check("[phá cố ý] HomeTutors.tsx thật + '<p>Cô Nguyễn Lan, 12 năm kinh nghiệm</p>' → bộ quét tên người ĐỎ; bản thật thì không", HARDCODED_PERSON.test(tampered("Cô Nguyễn Lan, 12 năm kinh nghiệm")) && !HARDCODED_PERSON.test(stripComments(real)));
    check("[phá cố ý] HomeSections.tsx thật + '<h2>Học viên nói gì</h2>' → bộ quét chứng thực ĐỎ; + '<b>50.000+ học viên</b>' → bộ quét số bịa ĐỎ", TESTIMONIAL_TEXT.test(stripComments(read("src/components/guest/HomeSections.tsx")) + "<h2>Học viên nói gì</h2>") && FABRICATED_COUNT.some(re => re.test(stripComments(read("src/components/guest/HomeSections.tsx")) + "<b>50.000+ học viên</b>")));
    check("[phá cố ý] chú thích KHÔNG bị tính: dòng '// Học viên nói gì (chưa làm)' và '/* Cô Nguyễn Lan */' bị bỏ trước khi quét", !TESTIMONIAL_TEXT.test(stripComments("// Học viên nói gì (chưa làm)\n")) && !HARDCODED_PERSON.test(stripComments("{/* Cô Nguyễn Lan */}")));
  }
  // …và KHÔNG bắt nhầm dữ liệu / chữ hợp lệ.
  const OK_TEXT = ["Gia sư {t.name}", "Gia sư {course.teacher}", "Gia sư ${c.teacher}", "Thầy cô giáo", "Cô ấy dạy Toán", "Kỳ thi TSA", "TS", "Đang nhận học viên", "Còn 5 chỗ", "500.000đ", "1.200.000đ", "Hỗ trợ: 09:00 – 21:30 hằng ngày", "Xem tất cả 4 lớp", "Mở lúc 19:30 ngày 12/11", "90 phút · 2 câu", "0384 409 051", "ĐGNL HSA"];
  const badOk = OK_TEXT.filter(t => HARDCODED_PERSON.test(t) || TESTIMONIAL_TEXT.test(t) || FABRICATED_COUNT.some(re => re.test(t)));
  check("[không bắt nhầm] 'Gia sư <tên từ dữ liệu>', giá '500.000đ', 'Đang nhận học viên', giờ hỗ trợ, số điện thoại… không khớp bộ quét nào", badOk.length === 0, badOk);
  // Đồng bộ với bộ chặn của màn quản trị (homeContentGuard.ts ghi rõ: phải BAO TRÙM danh sách của bài này): quản trị không được lưu 'số bịa' vào chữ trang chủ.
  const unguarded = ["50.000+ học viên", "Hơn 3.500+ gia sư", "200+ đề thi"].filter(t => checkClaims(t) === null);
  check("màn sửa chữ trang chủ (checkClaims) cũng chặn '50.000+ học viên', '3.500+ gia sư', '200+ đề thi' — đồng bộ với bộ quét mã nguồn", unguarded.length === 0, unguarded);

  section("Trang chính sách chỉ nói điều kiểm chứng được");
  const pol = read("src/app/(guest)/chinh-sach/page.tsx");
  check("không còn ngày 'Cập nhật lần cuối' và chữ 'cam kết'", !/Cập nhật lần cuối/.test(pol) && !/cam kết/i.test(pol));
  check("học phí do gia sư thu trực tiếp, KiN không thu hộ", /gia sư thu trực tiếp/.test(pol) && /không thu hộ/.test(pol));
  check("liên hệ bằng hotline/Zalo, không còn email cũ", /0384409051/.test(pol) && !/mailto:/.test(pol));
  check("nêu đúng bên xử lý dữ liệu thật: Vercel, Neon, Cloudinary, Gmail, SePay, Google", ["Vercel", "Neon", "Cloudinary", "Gmail", "SePay", "Google"].every(w => pol.includes(w)));
  check("mốc phiên khớp mã: 30 ngày (học sinh, gia sư) / 12 giờ (quản trị)", /30 ngày cho học sinh và gia sư/.test(pol) && /12 giờ cho quản trị/.test(pol));
  done();
})().catch(e => { console.error("CRASH", e); process.exit(1); });
