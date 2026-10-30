// BU-00 bước 3 (31/10/2026) — bản đồ đường gia sư ↔ quản trị (src/lib/tutorRoutes.ts), phần THUẦN: không DB, không mạng.
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-tutor-routes-lib.ts
// Ca phá cố ý:
//   - bỏ `banned: ["danh-muc"]` trong FAMILIES → ca "danh-muc → null" đỏ (gia sư lại có bí danh cho trang chỉ quản trị);
//   - đổi `return f[to] + … + search` thành không nối `search` → 3 ca "giữ query" đỏ;
//   - trong contentTabsFor đổi mặc định "cai-dat" thành null → ca "không ?tab= thì Cài đặt sáng" đỏ;
//   - contentHref trả `adminPath` khi toTutorPath null → ca "không map được thì về /lop-cua-toi" đỏ.
import { toTutorPath, toAdminPath, contentHref, contentTabsFor } from "@/lib/tutorRoutes";
import { check, section, done } from "./h";

const PAIRS: [admin: string, tutor: string][] = [
  ["/admin/thi-thu", "/lop-cua-toi/de-thi"],
  ["/admin/thi-thu/abc123", "/lop-cua-toi/de-thi/abc123"],
  ["/admin/thi-thu/tao-moi", "/lop-cua-toi/de-thi/tao-moi"],
  ["/admin/thi-thu/ngan-hang-cau-hoi", "/lop-cua-toi/de-thi/ngan-hang-cau-hoi"],
  ["/admin/thi-thu/ngan-hang-cau-hoi/bank1", "/lop-cua-toi/de-thi/ngan-hang-cau-hoi/bank1"],
  ["/admin/thi-thu/ngan-hang-cau-hoi/cau-hoi", "/lop-cua-toi/de-thi/ngan-hang-cau-hoi/cau-hoi"],
  ["/admin/thi-thu/ngan-hang-de-thi", "/lop-cua-toi/de-thi/ngan-hang-de-thi"],
  ["/admin/khoa-hoc", "/lop-cua-toi/quan-lop"],
  ["/admin/khoa-hoc/tao-moi", "/lop-cua-toi/quan-lop/tao-moi"],
  ["/admin/khoa-hoc/toan-9", "/lop-cua-toi/quan-lop/toan-9"],
  ["/admin/khoa-hoc/toan-9/hoc-vien", "/lop-cua-toi/quan-lop/toan-9/hoc-vien"],
  ["/admin/khoa-hoc/toan-9/diem-danh", "/lop-cua-toi/quan-lop/toan-9/diem-danh"],
  ["/admin/khoa-hoc/toan-9/diem-danh/in", "/lop-cua-toi/quan-lop/toan-9/diem-danh/in"],
];

section("toTutorPath / toAdminPath — hai chiều, từng cặp");
for (const [a, t] of PAIRS) {
  check(`${a} → ${t}`, toTutorPath(a) === t, toTutorPath(a));
  check(`${t} → ${a} (chiều ngược)`, toAdminPath(t) === a, toAdminPath(t));
}
check("đi rồi về đúng chỗ cũ với mọi cặp", PAIRS.every(([a, t]) => toAdminPath(toTutorPath(a)!) === a && toTutorPath(toAdminPath(t)!) === t));

section("Giữ nguyên query string");
check("/admin/thi-thu/abc?x=1 → /lop-cua-toi/de-thi/abc?x=1", toTutorPath("/admin/thi-thu/abc?x=1") === "/lop-cua-toi/de-thi/abc?x=1", toTutorPath("/admin/thi-thu/abc?x=1"));
check("/admin/khoa-hoc?tao=1 → /lop-cua-toi/quan-lop?tao=1 (mở sẵn ngăn tạo lớp)", toTutorPath("/admin/khoa-hoc?tao=1") === "/lop-cua-toi/quan-lop?tao=1");
check("/admin/khoa-hoc/toan-9?tab=lich-hoc&moi=1 → giữ cả hai tham số; chiều ngược cũng giữ", toTutorPath("/admin/khoa-hoc/toan-9?tab=lich-hoc&moi=1") === "/lop-cua-toi/quan-lop/toan-9?tab=lich-hoc&moi=1" && toAdminPath("/lop-cua-toi/quan-lop/toan-9?tab=hoc-vien") === "/admin/khoa-hoc/toan-9?tab=hoc-vien");
check("/admin/khoa-hoc/toan-9/diem-danh?date=2026-10-20 (link trong Hộp việc / thông báo cũ) → giữ ?date=", toTutorPath("/admin/khoa-hoc/toan-9/diem-danh?date=2026-10-20") === "/lop-cua-toi/quan-lop/toan-9/diem-danh?date=2026-10-20");
check("/admin/thi-thu/ngan-hang-cau-hoi/cau-hoi?categoryId=c1&select=1 → giữ", toTutorPath("/admin/thi-thu/ngan-hang-cau-hoi/cau-hoi?categoryId=c1&select=1") === "/lop-cua-toi/de-thi/ngan-hang-cau-hoi/cau-hoi?categoryId=c1&select=1");

section("Không có bí danh → null");
check("/admin/khoa-hoc/danh-muc → null (danh mục chỉ quản trị)", toTutorPath("/admin/khoa-hoc/danh-muc") === null, toTutorPath("/admin/khoa-hoc/danh-muc"));
check("/admin/khoa-hoc/danh-muc?x=1 → vẫn null (query không cứu được)", toTutorPath("/admin/khoa-hoc/danh-muc?x=1") === null);
for (const p of ["/admin", "/admin/kiem-duyet", "/admin/hoc-sinh", "/admin/doanh-thu", "/admin/tin-tuc", "/admin/thi-thuxyz", "/admin/khoa-hocabc", "/administrator"])
  check(`${p} → null`, toTutorPath(p) === null, toTutorPath(p));
check("đuôi lạ → null: /admin/khoa-hoc/a/b, /admin/khoa-hoc/a/diem-danh/x, /admin/thi-thu/a/b, /admin/thi-thu/ngan-hang-cau-hoi/a/b", ["/admin/khoa-hoc/a/b", "/admin/khoa-hoc/a/diem-danh/x", "/admin/thi-thu/a/b", "/admin/thi-thu/ngan-hang-cau-hoi/a/b"].every(p => toTutorPath(p) === null));
check("dấu '/' thừa → null: /admin/thi-thu/, /admin/khoa-hoc//a", toTutorPath("/admin/thi-thu/") === null && toTutorPath("/admin/khoa-hoc//a") === null);
check("toAdminPath với đường không thuộc hai họ → null: /lop-cua-toi, /lop-cua-toi/lich, /lop-cua-toi/de-thixyz, /student/x", ["/lop-cua-toi", "/lop-cua-toi/lich", "/lop-cua-toi/de-thixyz", "/student/x", "/admin/thi-thu"].every(p => toAdminPath(p) === null));
check("toAdminPath không nhận đường ngoài mẫu: /lop-cua-toi/quan-lop/danh-muc → null", toAdminPath("/lop-cua-toi/quan-lop/danh-muc") === null);

section("contentHref — liên kết trong trang dùng chung");
check("gia sư: /admin/khoa-hoc → /lop-cua-toi/quan-lop", contentHref(true, "/admin/khoa-hoc") === "/lop-cua-toi/quan-lop");
check("gia sư: giữ query (/admin/khoa-hoc/x?tab=chuong-bai)", contentHref(true, "/admin/khoa-hoc/x?tab=chuong-bai") === "/lop-cua-toi/quan-lop/x?tab=chuong-bai");
check("gia sư: không map được thì về /lop-cua-toi (không để rơi vào /admin)", contentHref(true, "/admin/khoa-hoc/danh-muc") === "/lop-cua-toi" && contentHref(true, "/admin") === "/lop-cua-toi");
check("quản trị: giữ nguyên /admin/... kể cả query", contentHref(false, "/admin/khoa-hoc/x?tab=chuong-bai") === "/admin/khoa-hoc/x?tab=chuong-bai" && contentHref(false, "/admin/khoa-hoc/danh-muc") === "/admin/khoa-hoc/danh-muc");

section("contentTabsFor — dải tab vỏ nội dung gia sư");
const dt = contentTabsFor("/lop-cua-toi/de-thi");
check("/lop-cua-toi/de-thi → nhóm Đề thi: Đề thi · Ngân hàng câu hỏi · Ngân hàng đề, 'Đề thi' sáng", dt?.label === "Đề thi" && dt.tabs.map(t => t.label).join(" · ") === "Đề thi · Ngân hàng câu hỏi · Ngân hàng đề" && dt.tabs.filter(t => t.active).map(t => t.label).join() === "Đề thi", dt);
check("/lop-cua-toi/de-thi/abc (một đề) → 'Đề thi' sáng", contentTabsFor("/lop-cua-toi/de-thi/abc")?.tabs.find(t => t.active)?.label === "Đề thi");
check("/lop-cua-toi/de-thi/ngan-hang-cau-hoi/bank1 → 'Ngân hàng câu hỏi' sáng (tiền tố dài nhất, không phải 'Đề thi')", contentTabsFor("/lop-cua-toi/de-thi/ngan-hang-cau-hoi/bank1")?.tabs.filter(t => t.active).map(t => t.label).join() === "Ngân hàng câu hỏi");
check("/lop-cua-toi/de-thi/ngan-hang-de-thi → 'Ngân hàng đề' sáng; href các tab là đường gia sư", (() => { const g = contentTabsFor("/lop-cua-toi/de-thi/ngan-hang-de-thi")!; return g.tabs.find(t => t.active)?.label === "Ngân hàng đề" && g.tabs.every(t => t.href.startsWith("/lop-cua-toi/de-thi")); })());
const ql = contentTabsFor("/lop-cua-toi/quan-lop/toan-9");
check("/lop-cua-toi/quan-lop/toan-9 (không ?tab=) → nhóm Quản lớp 5 tab, 'Cài đặt' sáng (mặc định như trang gốc)", ql?.label === "Quản lớp" && ql.tabs.map(t => t.label).join(" · ") === "Cài đặt · Chương bài · Lịch học · Học viên · Điểm danh" && ql.tabs.filter(t => t.active).map(t => t.label).join() === "Cài đặt", ql);
check("tab ?tab= trỏ ?tab=… của đúng lớp; Học viên / Điểm danh trỏ trang con", ql?.tabs[1].href === "/lop-cua-toi/quan-lop/toan-9?tab=chuong-bai" && ql.tabs[3].href === "/lop-cua-toi/quan-lop/toan-9/hoc-vien" && ql.tabs[4].href === "/lop-cua-toi/quan-lop/toan-9/diem-danh");
check("?tab=lich-hoc → 'Lịch học' sáng, chỉ một tab sáng", contentTabsFor("/lop-cua-toi/quan-lop/toan-9", "lich-hoc")?.tabs.filter(t => t.active).map(t => t.label).join() === "Lịch học");
check("?tab=hoc-vien (tab 'Học viên đăng ký' trong trang gốc) → tab 'Học viên' sáng", contentTabsFor("/lop-cua-toi/quan-lop/toan-9", "hoc-vien")?.tabs.filter(t => t.active).map(t => t.label).join() === "Học viên");
check("?tab=rác → về Cài đặt", contentTabsFor("/lop-cua-toi/quan-lop/toan-9", "xyz")?.tabs.find(t => t.active)?.label === "Cài đặt");
check("/hoc-vien → 'Học viên' sáng; /diem-danh và /diem-danh/in → 'Điểm danh' sáng", contentTabsFor("/lop-cua-toi/quan-lop/toan-9/hoc-vien")?.tabs.find(t => t.active)?.label === "Học viên" && contentTabsFor("/lop-cua-toi/quan-lop/toan-9/diem-danh")?.tabs.find(t => t.active)?.label === "Điểm danh" && contentTabsFor("/lop-cua-toi/quan-lop/toan-9/diem-danh/in", "cai-dat")?.tabs.filter(t => t.active).map(t => t.label).join() === "Điểm danh");
check("danh sách lớp, tao-moi, trang khác → không dải tab", contentTabsFor("/lop-cua-toi/quan-lop") === null && contentTabsFor("/lop-cua-toi/quan-lop/tao-moi") === null && contentTabsFor("/lop-cua-toi/lich") === null && contentTabsFor("/admin/thi-thu") === null);

done();
