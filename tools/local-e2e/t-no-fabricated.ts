// Không bịa số liệu / cam kết / người thật — kiểm tra tĩnh trên mã nguồn (không cần máy chủ). Rà soát 14/10/2026: những thứ dưới đây từng
// nằm trong mã mà KHÔNG có nguồn (không có trong Figma, tài liệu hay dữ liệu thật) hoặc trái với cách sản phẩm vận hành.
// Muốn đưa lại một số liệu/cam kết: có nguồn thật rồi mới sửa danh sách này, kèm lý do.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { check, section, done } from "./h";

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
  ];
  for (const [re, why, allow] of BANNED) {
    const hit = src.filter(p => !allow.includes(p) && re.test(read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")));
    check(`không còn ${re.source.slice(0, 40)}${re.source.length > 40 ? "…" : ""} — ${why}`, hit.length === 0, hit);
  }

  section("Bong bóng 'KiN AI' giả không được gắn");
  const users = src.filter(p => p !== "src/components/AIChatWidget.tsx" && /AIChatWidget/.test(read(p).replace(/^\s*\/\/.*$/gm, "")));
  check("không tệp nào import AIChatWidget (nó chỉ trả chữ viết sẵn sau 2 giây)", users.length === 0, users);
  check("AIChatWidget.tsx có ghi chú 'KHÔNG GẮN LẠI' ở đầu tệp", /^\/\/ KHÔNG GẮN LẠI/.test(read("src/components/AIChatWidget.tsx")));

  section("Số liệu trang chủ là số đếm thật");
  const home = read("src/app/page.tsx");
  check("trang chủ đếm từ cơ sở dữ liệu (prisma) và làm mới theo giờ", /prisma\./.test(home) && /export const revalidate = 3600/.test(home));
  check("số nào bằng 0 thì ẩn, truy vấn lỗi thì ẩn cả khối (không bao giờ hiện số bịa)", /filter\(s => s\.value > 0\)/.test(home) && /catch \{\s*return \[\];/.test(home) && /stats\.length > 0/.test(home));
  check("không còn mảng STATS viết cứng", !/const STATS\s*=/.test(home));

  section("Trang chính sách chỉ nói điều kiểm chứng được");
  const pol = read("src/app/(guest)/chinh-sach/page.tsx");
  check("không còn ngày 'Cập nhật lần cuối' và chữ 'cam kết'", !/Cập nhật lần cuối/.test(pol) && !/cam kết/i.test(pol));
  check("học phí do gia sư thu trực tiếp, KiN không thu hộ", /gia sư thu trực tiếp/.test(pol) && /không thu hộ/.test(pol));
  check("liên hệ bằng hotline/Zalo, không còn email cũ", /0384409051/.test(pol) && !/mailto:/.test(pol));
  check("nêu đúng bên xử lý dữ liệu thật: Vercel, Neon, Cloudinary, Gmail, SePay, Google", ["Vercel", "Neon", "Cloudinary", "Gmail", "SePay", "Google"].every(w => pol.includes(w)));
  check("mốc phiên khớp mã: 30 ngày (học sinh, gia sư) / 12 giờ (quản trị)", /30 ngày cho học sinh và gia sư/.test(pol) && /12 giờ cho quản trị/.test(pol));
  done();
})().catch(e => { console.error("CRASH", e); process.exit(1); });
