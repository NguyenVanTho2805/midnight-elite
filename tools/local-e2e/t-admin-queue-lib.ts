// Vỏ quản trị — quy tắc thuần: hàng chờ kiểm duyệt (src/lib/adminQueue.ts) và bản đồ điều hướng + quyền (src/lib/adminNav.ts).
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { check, section, done } from "./h";
import { agoLabel, buildAdminQueue, waitedText, MAX_QUEUE_ITEMS, SNIPPET, type AnswerRep, type ProfileRep, type ThreadRep, type TutorApp } from "@/lib/adminQueue";
import { ADMIN_MODULES, matchSub, visibleModules } from "@/lib/adminNav";
import { PERMISSIONS, checkPermission, type AdminRole, type Permission } from "@/lib/permissions";

// Thứ Ba 13/10/2026 20:00 giờ VN
const NOW = new Date("2026-10-13T13:00:00Z");
const vn = (key: string, hm: string) => new Date(`${key}T${hm}:00+07:00`);
const tutor = (o: Partial<TutorApp> = {}): TutorApp => ({ id: "u1", name: "Lê Thu", email: "thu@x.vn", phone: "0901234567", city: "Hà Nội", emailVerified: true, bio: "Dạy Toán 9 năm năm", subjects: ["Toán", "Lý"], appliedAt: vn("2026-10-12", "23:02"), ...o });
const thread = (o: Partial<ThreadRep> = {}): ThreadRep => ({ id: "t1", reason: "Quảng cáo", createdAt: vn("2026-10-11", "08:00"), reporter: "An", author: "Bình", content: "Bán sách giá rẻ liên hệ 090", course: null, ...o });
const prof = (o: Partial<ProfileRep> = {}): ProfileRep => ({ id: "p1", tutorId: "u9", tutorName: "Cô Mai", reason: "Ảnh không phải của gia sư", detail: null, channel: null, createdAt: vn("2026-10-10", "10:00"), ...o });
const ans = (o: Partial<AnswerRep> = {}): AnswerRep => ({ id: "a1", reason: "Sai kiến thức", createdAt: vn("2026-10-13", "19:30"), reporter: "Chi", author: "Dũng", content: "Đáp án là 5", questionTitle: "Tính 2+2", rewardPaid: 0, ...o });
const run = (p: Partial<{ tutors: TutorApp[]; threads: ThreadRep[]; profiles: ProfileRep[]; answers: AnswerRep[] }>) =>
  buildAdminQueue({ tutors: [], threads: [], profiles: [], answers: [], ...p, now: NOW });

section("Hồ sơ gia sư xin duyệt");
let q = run({ tutors: [tutor()] });
let it = q.items[0];
check("một dòng, kind gia-su, 'Chờ duyệt'", q.items.length === 1 && it.kind === "gia-su" && it.status.label === "Chờ duyệt" && it.status.tone === "cho");
check("tiêu đề + phụ đề: môn và thành phố", it.title === "Hồ sơ gia sư: Lê Thu" && it.subtitle === "Toán, Lý · Hà Nội", it.subtitle);
check("hai lệnh: Duyệt (không cần lý do) và Từ chối (bắt buộc lý do ≤ 500)", it.detail.actions.length === 2 && it.detail.actions[0].key === "approve" && !it.detail.actions[0].reason && it.detail.actions[1].key === "reject" && it.detail.actions[1].reason?.max === 500);
check("đúng API đã có: approve/reject theo id người nộp", it.detail.actions[0].url === "/api/admin/tutor-applications/u1/approve" && it.detail.actions[1].url === "/api/admin/tutor-applications/u1/reject" && it.detail.actions.every(a => a.method === "POST"));
check("duyệt được khi đã xác thực email (không bị khoá)", !it.detail.actions[0].disabled);
q = run({ tutors: [tutor({ emailVerified: false })] });
it = q.items[0];
check("chưa xác thực email: trạng thái đỏ + nút Duyệt bị khoá kèm lý do", it.status.label === "Chưa xác thực email" && it.status.tone === "loi" && !!it.detail.actions[0].disabled && !it.detail.actions[1].disabled);
check("khung đọc giải thích vì sao chưa duyệt được", it.detail.sections.some(s => s.title === "Chưa duyệt được"));
q = run({ tutors: [tutor({ subjects: [], city: null, bio: null, phone: null })] });
check("thiếu môn / thành phố / giới thiệu: có câu rõ ràng, không rỗng", q.items[0].subtitle === "Chưa ghi môn dạy" && q.items[0].detail.sections[0].text === "Người nộp đơn chưa viết giới thiệu." && q.items[0].detail.sections.find(s => s.title === "Liên hệ")?.text === "thu@x.vn");

section("Báo cáo bài viết");
q = run({ threads: [thread()] });
it = q.items[0];
check("kind bai-viet, 'Chờ xử lý'", it.kind === "bai-viet" && it.status.label === "Chờ xử lý");
check("Gỡ bài (hỏi lại trước, decision approved) + Giữ bài lại (decision rejected)", it.detail.actions[0].key === "remove" && !!it.detail.actions[0].confirm && JSON.stringify(it.detail.actions[0].body) === '{"decision":"approved"}' && it.detail.actions[1].key === "keep" && !it.detail.actions[1].confirm && JSON.stringify(it.detail.actions[1].body) === '{"decision":"rejected"}');
check("đúng API: /api/admin/thread-reports/<id>/resolve", it.detail.actions.every(a => a.url === "/api/admin/thread-reports/t1/resolve" && a.method === "POST"));
check("khung đọc có nội dung bài, lý do, người báo cáo + bài của ai + lớp nào", it.detail.sections.map(s => s.title).join("|") === "Nội dung bài viết|Lý do báo cáo|Người báo cáo" && it.detail.sections[2].text === "An · bài của Bình · cộng đồng chung");
q = run({ threads: [thread({ course: "Toán 9", content: "  ", reason: "" })] });
check("lớp có tên được ghi; bài trống / không lý do vẫn có câu", q.items[0].detail.sections[2].text.endsWith("Toán 9") && q.items[0].detail.sections[0].text === "(bài không có chữ)" && q.items[0].detail.sections[1].text === "Người báo cáo không ghi lý do.");
check("dòng danh sách: phụ đề cắt gọn có '…'", run({ threads: [thread({ content: "x".repeat(200) })] }).items[0].subtitle.length <= SNIPPET && run({ threads: [thread({ content: "x".repeat(200) })] }).items[0].subtitle.endsWith("…"));

section("Báo cáo hồ sơ gia sư");
q = run({ profiles: [prof()] });
it = q.items[0];
check("kind ho-so, Khoá cần lý do ≤ 500 (PATCH action lock), Bỏ qua không cần (action dismiss)", it.kind === "ho-so" && it.detail.actions[0].key === "lock" && it.detail.actions[0].reason?.max === 500 && it.detail.actions[0].method === "PATCH" && JSON.stringify(it.detail.actions[0].body) === '{"action":"lock"}' && it.detail.actions[1].key === "dismiss" && !it.detail.actions[1].reason && JSON.stringify(it.detail.actions[1].body) === '{"action":"dismiss"}');
check("đúng API: /api/admin/profile-reports/<id>", it.detail.actions.every(a => a.url === "/api/admin/profile-reports/p1"));
check("khung đọc nói rõ khoá làm gì", it.detail.sections.some(s => s.title === "Khoá hồ sơ làm gì" && /ẩn hồ sơ công khai/.test(s.text)));
q = run({ profiles: [prof({ detail: "Số điện thoại không đúng", channel: "Zalo" })] });
check("chi tiết + kênh báo hiện khi có", q.items[0].detail.sections.some(s => s.title === "Chi tiết") && q.items[0].detail.sections.some(s => s.title === "Báo cáo từ" && s.text === "Zalo"));

section("Báo cáo câu trả lời: KHÔNG xử lý ngay (có thể trừ xu)");
q = run({ answers: [ans(), ans({ id: "a2", rewardPaid: 20 })] });
check("không có lệnh nào trong khung đọc — chỉ liên kết sang trang riêng", q.items.every(i => i.kind === "tra-loi" && i.detail.actions.length === 0 && i.detail.links[0].href === "/admin/cong-dong/bao-cao"));
check("đã trả thưởng thì có 'Lưu ý' về việc trừ lại; chưa trả thì không", q.items.find(i => i.id === "tra-loi:a2")!.detail.sections.some(s => s.title === "Lưu ý") && !q.items.find(i => i.id === "tra-loi:a1")!.detail.sections.some(s => s.title === "Lưu ý"));

section("Gộp, thứ tự, badge");
q = run({ tutors: [tutor()], threads: [thread()], profiles: [prof()], answers: [ans()] });
check("bốn loại trong cùng một hàng chờ", new Set(q.items.map(i => i.kind)).size === 4 && q.items.length === 4);
check("chờ lâu nhất lên trước (hồ sơ 10/10 → bài 11/10 → gia sư 12/10 → trả lời 13/10)", q.items.map(i => i.kind).join(",") === "ho-so,bai-viet,gia-su,tra-loi", q.items.map(i => i.at));
check("badge = số dòng cần xử lý", q.badge === 4);
check("không có dữ liệu → trống, badge 0", run({}).items.length === 0 && run({}).badge === 0);
check("id duy nhất và mang tiền tố loại", new Set(q.items.map(i => i.id)).size === 4 && q.items.every(i => i.id.startsWith(i.kind + ":")));
check("cùng thời điểm: thứ tự ổn định theo id", run({ threads: [thread({ id: "b" }), thread({ id: "a" })] }).items.map(i => i.id).join() === "bai-viet:a,bai-viet:b");
const many = run({ threads: Array.from({ length: MAX_QUEUE_ITEMS + 30 }, (_, i) => thread({ id: `t${String(i).padStart(3, "0")}`, createdAt: new Date(NOW.getTime() - (1000 - i) * 60_000) })) });
check(`cắt ở ${MAX_QUEUE_ITEMS} dòng (giữ những dòng chờ lâu nhất)`, many.items.length === MAX_QUEUE_ITEMS && many.items[0].id === "bai-viet:t000" && many.badge === MAX_QUEUE_ITEMS);
check("mỗi dòng có tiêu đề, phụ đề, nhãn thời gian, khung đọc có tiêu đề + meta + ít nhất một mục", q.items.every(i => i.title && i.subtitle && i.when && i.detail.heading && i.detail.meta && i.detail.sections.length >= 1));

section("Nhãn thời gian");
check("hôm nay → giờ VN (19:30)", agoLabel(vn("2026-10-13", "19:30"), NOW) === "19:30");
check("sau nửa đêm giờ VN vẫn đúng ngày VN (00:05 ngày 14 = hôm nay khi NOW là 14/10 08:00 VN)", agoLabel(new Date("2026-10-13T17:05:00Z"), new Date("2026-10-14T01:00:00Z")) === "00:05");
check("hôm qua → 'Hôm qua'", agoLabel(vn("2026-10-12", "23:02"), NOW) === "Hôm qua");
check("cũ hơn → dd/mm", agoLabel(vn("2026-10-10", "10:00"), NOW) === "10/10");
check("đã chờ: 3 ngày / 5 giờ / 12 phút / vừa gửi", waitedText(new Date(NOW.getTime() - 3 * 86_400_000 - 5 * 3_600_000), NOW) === "đã chờ 3 ngày" && waitedText(new Date(NOW.getTime() - 5 * 3_600_000), NOW) === "đã chờ 5 giờ" && waitedText(new Date(NOW.getTime() - 12 * 60_000), NOW) === "đã chờ 12 phút" && waitedText(new Date(NOW.getTime() - 5_000), NOW) === "vừa gửi");
check("giờ ở tương lai (lệch đồng hồ) không âm: 'vừa gửi'", waitedText(new Date(NOW.getTime() + 60_000), NOW) === "vừa gửi");

section("Điều hướng quản trị: quyền từng vai");
const roles: AdminRole[] = ["admin_super", "admin_content", "teacher"];
const hrefsOf = (r: AdminRole | null) => visibleModules(r).flatMap(m => m.subs.map(s => s.href));
// Bản sao bảng NAV_ITEMS CŨ của AdminSidebar (href → quyền): vỏ mới không được hiện nhiều hơn hay ít hơn.
const OLD: [string, Permission | null][] = [
  ["/admin", null], ["/admin/khoa-hoc", PERMISSIONS.MANAGE_COURSES], ["/admin/khoa-hoc/danh-muc", PERMISSIONS.MANAGE_COURSES],
  ["/admin/thi-thu", PERMISSIONS.MANAGE_CURRICULUM], ["/admin/thi-thu/ngan-hang-cau-hoi", PERMISSIONS.MANAGE_CURRICULUM], ["/admin/thi-thu/ngan-hang-de-thi", PERMISSIONS.MANAGE_CURRICULUM],
  ["/admin/danh-gia", PERMISSIONS.MANAGE_COURSES], ["/admin/vinh-danh", PERMISSIONS.MANAGE_HONOR], ["/admin/tin-tuc", PERMISSIONS.MANAGE_NEWS],
  ["/admin/cong-dong", PERMISSIONS.MANAGE_COMMUNITY], ["/admin/cong-dong/bao-cao", PERMISSIONS.MANAGE_COMMUNITY],
  ["/admin/hoc-sinh", PERMISSIONS.MANAGE_STUDENTS], ["/admin/ho-so-gia-su", PERMISSIONS.MANAGE_TUTORS], ["/admin/pheu", PERMISSIONS.MANAGE_TUTORS], ["/admin/so-do", PERMISSIONS.MANAGE_TUTORS],
  ["/admin/diem-chuan", PERMISSIONS.MANAGE_NEWS], ["/admin/doanh-thu", PERMISSIONS.VIEW_REVENUE], ["/admin/quan-tri-vien", PERMISSIONS.MANAGE_ADMINS],
  // 23/10/2026 (KiN Pro, nền gói): trang cấu hình gói thêm MỚI sau thanh bên cũ, cùng quyền với các trang tiền khác (chỉ admin_super).
  ["/admin/goi-pro", PERMISSIONS.MANAGE_REVENUE],
  // 23/10/2026 (KiN Pro F6): hàng đợi hỗ trợ gia sư, mục menu MỚI có chủ ý, cùng quyền MANAGE_TUTORS.
  ["/admin/ho-tro", PERMISSIONS.MANAGE_TUTORS],
  // 24/10/2026 (QT-02/03/06): ba mục menu MỚI có chủ ý. Nhật ký chỉ cấp 1 (MANAGE_ADMINS); Triển khai và hạn mức + Duyệt nạp Coin cùng quyền MANAGE_REVENUE như Gói KiN Pro / API duyệt.
  ["/admin/nhat-ky", PERMISSIONS.MANAGE_ADMINS], ["/admin/trien-khai", PERMISSIONS.MANAGE_REVENUE], ["/admin/topups", PERMISSIONS.MANAGE_REVENUE],
];
for (const r of roles) {
  const now = new Set(hrefsOf(r));
  const old = OLD.filter(([, p]) => !p || checkPermission(r, p)).map(([h]) => h);
  const extra = [...now].filter(h => h !== "/admin/kiem-duyet" && !old.includes(h));
  const missing = old.filter(h => !now.has(h));
  check(`${r}: thấy đúng các trang như thanh bên cũ (không thừa, không thiếu)`, extra.length === 0 && missing.length === 0, { extra, missing });
}
check("'Hàng chờ' (/admin/kiem-duyet) hiện cho mọi vai quản trị", roles.every(r => hrefsOf(r).includes("/admin/kiem-duyet")));
check("chưa biết vai (đang tải) → chỉ trang không đòi quyền", JSON.stringify(hrefsOf(null)) === JSON.stringify(["/admin/kiem-duyet", "/admin"]), hrefsOf(null));
check("gia sư (teacher) không thấy: Người dùng, Doanh thu, Phễu, Số đo, Duyệt gia sư, Quản trị viên", !["/admin/hoc-sinh", "/admin/doanh-thu", "/admin/pheu", "/admin/so-do", "/admin/ho-so-gia-su", "/admin/quan-tri-vien"].some(h => hrefsOf("teacher").includes(h)));
check("module không còn trang con nào thì ẩn cả module (content không có 'Người dùng')", !visibleModules("admin_content").some(m => m.key === "nguoi-dung") && visibleModules("admin_super").length === ADMIN_MODULES.length);
check("đường vào module = trang con đầu tiên được phép (teacher → Nội dung mở 'Khoá học')", visibleModules("teacher").find(m => m.key === "noi-dung")!.href === "/admin/khoa-hoc" && visibleModules("admin_super").find(m => m.key === "nguoi-dung")!.href === "/admin/hoc-sinh");
check("không có hai module cùng khoá; không có trang con nằm ở hai module", new Set(ADMIN_MODULES.map(m => m.key)).size === ADMIN_MODULES.length && new Set(ADMIN_MODULES.flatMap(m => m.subs.map(s => s.href))).size === ADMIN_MODULES.flatMap(m => m.subs).length);

section("Điều hướng quản trị: khớp đường dẫn");
const at = (p: string) => matchSub(p);
check("/admin → Báo cáo · Tổng quan (chỉ khớp đúng /admin)", at("/admin")?.moduleKey === "bao-cao" && at("/admin")?.sub.label === "Tổng quan" && at("/admin/khong-co") === null);
check("/admin/kiem-duyet → Kiểm duyệt · Hàng chờ", at("/admin/kiem-duyet")?.moduleKey === "kiem-duyet");
check("khớp dài nhất thắng: /admin/cong-dong/bao-cao → 'Báo cáo trả lời', /admin/cong-dong → 'Bài viết cộng đồng'", at("/admin/cong-dong/bao-cao")?.sub.label === "Báo cáo trả lời" && at("/admin/cong-dong")?.sub.label === "Bài viết cộng đồng");
check("trang sâu thuộc đúng trang con: /admin/khoa-hoc/abc/diem-danh → Khoá học; /admin/khoa-hoc/danh-muc → Danh mục; /admin/thi-thu/ngan-hang-cau-hoi/cau-hoi → Ngân hàng câu hỏi", at("/admin/khoa-hoc/abc/diem-danh")?.sub.label === "Khoá học" && at("/admin/khoa-hoc/danh-muc")?.sub.label === "Danh mục" && at("/admin/thi-thu/ngan-hang-cau-hoi/cau-hoi")?.sub.label === "Ngân hàng câu hỏi");
check("không khớp nhầm tiền tố chữ: /admin/khoa-hocxyz không phải Khoá học", at("/admin/khoa-hocxyz") === null);
// QT-06 (24/10/2026): trước đây /admin/topups không có trong menu (test cũ khẳng định "không thuộc module nào" = đúng hiện trạng lúc đó). Nay có lối vào ở Cài đặt.
check("/admin/topups thuộc Cài đặt · Duyệt nạp Coin (QT-06)", at("/admin/topups")?.moduleKey === "cai-dat" && at("/admin/topups")?.sub.label === "Duyệt nạp Coin");
check("/admin/nhat-ky thuộc Kiểm duyệt · Nhật ký; /admin/trien-khai thuộc Cài đặt (QT-02/03)", at("/admin/nhat-ky")?.moduleKey === "kiem-duyet" && at("/admin/trien-khai")?.moduleKey === "cai-dat");
check("quyền: chỉ cấp 1 thấy Nhật ký, Triển khai và hạn mức, Duyệt nạp Coin; quản trị nội dung và gia sư KHÔNG", ["admin_content", "teacher"].every(r => !["/admin/nhat-ky", "/admin/trien-khai", "/admin/topups"].some(h => hrefsOf(r as AdminRole).includes(h))) && ["/admin/nhat-ky", "/admin/trien-khai", "/admin/topups"].every(h => hrefsOf("admin_super").includes(h)));

section("Mọi trang quản trị đang có đều có chỗ đứng trong một module");
const root = join(process.cwd(), "src/app/(admin)/admin");
const routes: string[] = [];
const walk = (dir: string, url: string) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, `${url}/${name.replace(/^\[.+\]$/, "x")}`);
    else if (name === "page.tsx") routes.push(url || "/admin");
  }
};
walk(root, "/admin");
const orphan = routes.filter(r => !r.includes("/_template") && !matchSub(r)); // /admin/topups không còn là ngoại lệ (QT-06)
check(`${routes.length} trang quản trị tìm thấy; trang mới thêm mà quên đưa vào module sẽ làm test này đỏ`, routes.length >= 20 && orphan.length === 0, orphan);

done();
