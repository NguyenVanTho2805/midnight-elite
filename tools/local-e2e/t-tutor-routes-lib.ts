// BU-00 bước 3 (31/10/2026) — bản đồ đường gia sư ↔ quản trị (src/lib/tutorRoutes.ts), phần THUẦN: không DB, không mạng.
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-tutor-routes-lib.ts
// Ca phá cố ý:
//   - bỏ `banned: ["danh-muc"]` trong FAMILIES → ca "danh-muc → null" đỏ (gia sư lại có bí danh cho trang chỉ quản trị);
//   - đổi `return f[to] + … + search` thành không nối `search` → 3 ca "giữ query" đỏ;
//   - GS-LOP-GON: trong contentTabsFor để "Cài đặt" sáng khi không ?tab= (mặc định cũ) → ca "gốc trần KHÔNG tab nào sáng" đỏ; bỏ lọc vai đồng giảng → ca "chỉ Giáo trình · Lịch học" đỏ;
//   - contentHref trả `adminPath` khi toTutorPath null → ca "không map được thì về /lop-cua-toi" đỏ;
//   - BU-02: bỏ tab "Giáo trình" khỏi contentTabsFor → ca "6 tab đúng thứ tự" đỏ; làm sáng cả "Giáo trình" lẫn "Bài tập tự nộp" cùng lúc → ca "chỉ một tab sáng" đỏ;
//     giaoTrinhHref không encode courseId → ca "id lạ không thoát khỏi đường dẫn" đỏ.
//   - LOI-02: để lại tab "Giáo trình"/"Lịch học"/"Bài tập" → ca "KHÔNG còn nhãn…" đỏ; bỏ điều kiện `!ROOT_NON_BAI_HOC_TABS` → hàng "?tab=lich-hoc → không tab nào"
//     và "?tab=cai-dat → Cài đặt" (hai tab sáng) đỏ; bỏ lọc vai → hai ca A3 đỏ; giaoTrinhHref(…, true) còn trả …/giao-trinh → ca đầu mục giaoTrinhHref đỏ.
import { toTutorPath, toAdminPath, contentHref, contentTabsFor, giaoTrinhHref, baiHocHref } from "@/lib/tutorRoutes";
import { classBase } from "@/lib/tutorClassRoutes";
import { check, section, done } from "./h";

const PAIRS: [admin: string, tutor: string][] = [
  ["/admin/thi-thu", "/lop-cua-toi/de-thi"],
  ["/admin/thi-thu/abc123", "/lop-cua-toi/de-thi/abc123"],
  ["/admin/thi-thu/tao-moi", "/lop-cua-toi/de-thi/tao-moi"],
  ["/admin/thi-thu/ngan-hang-cau-hoi", "/lop-cua-toi/de-thi/ngan-hang-cau-hoi"],
  ["/admin/thi-thu/ngan-hang-cau-hoi/bank1", "/lop-cua-toi/de-thi/ngan-hang-cau-hoi/bank1"],
  ["/admin/thi-thu/ngan-hang-cau-hoi/cau-hoi", "/lop-cua-toi/de-thi/ngan-hang-cau-hoi/cau-hoi"],
  ["/admin/thi-thu/ngan-hang-de-thi", "/lop-cua-toi/de-thi/ngan-hang-de-thi"],
  // BU-03: đuôi mới
  ["/admin/thi-thu/ma-tran", "/lop-cua-toi/de-thi/ma-tran"],
  ["/admin/thi-thu/ma-tran/m1", "/lop-cua-toi/de-thi/ma-tran/m1"],
  ["/admin/thi-thu/ngan-hang-cau-hoi/nhap-word", "/lop-cua-toi/de-thi/ngan-hang-cau-hoi/nhap-word"],
  ["/admin/thi-thu/abc/phien-ban", "/lop-cua-toi/de-thi/abc/phien-ban"],
  ["/admin/thi-thu/abc/giao", "/lop-cua-toi/de-thi/abc/giao"],
  ["/admin/thi-thu/abc/ket-qua", "/lop-cua-toi/de-thi/abc/ket-qua"],
  ["/admin/thi-thu/abc/ma-de", "/lop-cua-toi/de-thi/abc/ma-de"],
  ["/admin/thi-thu/abc/cham", "/lop-cua-toi/de-thi/abc/cham"],
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
check("A4: /admin/khoa-hoc (danh sách) → /lop-cua-toi/lop, không còn trang danh sách riêng quan-lop; chiều ngược quan-lop → /admin/khoa-hoc giữ nguyên", toTutorPath("/admin/khoa-hoc") === "/lop-cua-toi/lop" && toAdminPath("/lop-cua-toi/quan-lop") === "/admin/khoa-hoc");
check("A4: /admin/khoa-hoc?tao=1 → /lop-cua-toi/lop/tao (cửa tạo lớp duy nhất); tham số khác giữ", toTutorPath("/admin/khoa-hoc?tao=1") === "/lop-cua-toi/lop/tao" && toTutorPath("/admin/khoa-hoc?q=toan") === "/lop-cua-toi/lop?q=toan");
check("/admin/khoa-hoc/toan-9?tab=lich-hoc&moi=1 → giữ cả hai tham số; chiều ngược cũng giữ", toTutorPath("/admin/khoa-hoc/toan-9?tab=lich-hoc&moi=1") === "/lop-cua-toi/quan-lop/toan-9?tab=lich-hoc&moi=1" && toAdminPath("/lop-cua-toi/quan-lop/toan-9?tab=hoc-vien") === "/admin/khoa-hoc/toan-9?tab=hoc-vien");
check("/admin/khoa-hoc/toan-9/diem-danh?date=2026-10-20 (link trong Hộp việc / thông báo cũ) → giữ ?date=", toTutorPath("/admin/khoa-hoc/toan-9/diem-danh?date=2026-10-20") === "/lop-cua-toi/quan-lop/toan-9/diem-danh?date=2026-10-20");
check("/admin/thi-thu/ngan-hang-cau-hoi/cau-hoi?categoryId=c1&select=1 → giữ", toTutorPath("/admin/thi-thu/ngan-hang-cau-hoi/cau-hoi?categoryId=c1&select=1") === "/lop-cua-toi/de-thi/ngan-hang-cau-hoi/cau-hoi?categoryId=c1&select=1");

section("Không có bí danh → null");
check("/admin/khoa-hoc/danh-muc → null (danh mục chỉ quản trị)", toTutorPath("/admin/khoa-hoc/danh-muc") === null, toTutorPath("/admin/khoa-hoc/danh-muc"));
check("/admin/khoa-hoc/danh-muc?x=1 → vẫn null (query không cứu được)", toTutorPath("/admin/khoa-hoc/danh-muc?x=1") === null);
for (const p of ["/admin", "/admin/kiem-duyet", "/admin/hoc-sinh", "/admin/doanh-thu", "/admin/tin-tuc", "/admin/thi-thuxyz", "/admin/khoa-hocabc", "/administrator"])
  check(`${p} → null`, toTutorPath(p) === null, toTutorPath(p));
check("đuôi lạ → null: /admin/khoa-hoc/a/b, /admin/khoa-hoc/a/diem-danh/x, /admin/thi-thu/a/b, /admin/thi-thu/ngan-hang-cau-hoi/a/b", ["/admin/khoa-hoc/a/b", "/admin/khoa-hoc/a/diem-danh/x", "/admin/thi-thu/a/b", "/admin/thi-thu/ngan-hang-cau-hoi/a/b"].every(p => toTutorPath(p) === null));
check("BU-03: đuôi lạ vẫn null (/ma-tran/a/b, /abc/giao/x, /abc/khong-co)", ["/admin/thi-thu/ma-tran/a/b", "/admin/thi-thu/abc/giao/x", "/admin/thi-thu/abc/khong-co"].every(p => toTutorPath(p) === null));
check("BU-03: khai báo đuôi cố định không bị nuốt làm :id (/admin/thi-thu/ma-tran → ma-tran, không phải đề tên ma-tran)", toTutorPath("/admin/thi-thu/ma-tran?x=1") === "/lop-cua-toi/de-thi/ma-tran?x=1");
check("dấu '/' thừa → null: /admin/thi-thu/, /admin/khoa-hoc//a", toTutorPath("/admin/thi-thu/") === null && toTutorPath("/admin/khoa-hoc//a") === null);
check("toAdminPath với đường không thuộc hai họ → null: /lop-cua-toi, /lop-cua-toi/lich, /lop-cua-toi/de-thixyz, /student/x", ["/lop-cua-toi", "/lop-cua-toi/lich", "/lop-cua-toi/de-thixyz", "/student/x", "/admin/thi-thu"].every(p => toAdminPath(p) === null));
check("toAdminPath không nhận đường ngoài mẫu: /lop-cua-toi/quan-lop/danh-muc → null", toAdminPath("/lop-cua-toi/quan-lop/danh-muc") === null);

section("contentHref — liên kết trong trang dùng chung");
check("gia sư: /admin/khoa-hoc → /lop-cua-toi/lop (A4)", contentHref(true, "/admin/khoa-hoc") === "/lop-cua-toi/lop");
check("gia sư: giữ query (/admin/khoa-hoc/x?tab=chuong-bai)", contentHref(true, "/admin/khoa-hoc/x?tab=chuong-bai") === "/lop-cua-toi/quan-lop/x?tab=chuong-bai");
check("gia sư: không map được thì về /lop-cua-toi (không để rơi vào /admin)", contentHref(true, "/admin/khoa-hoc/danh-muc") === "/lop-cua-toi" && contentHref(true, "/admin") === "/lop-cua-toi");
check("quản trị: giữ nguyên /admin/... kể cả query", contentHref(false, "/admin/khoa-hoc/x?tab=chuong-bai") === "/admin/khoa-hoc/x?tab=chuong-bai" && contentHref(false, "/admin/khoa-hoc/danh-muc") === "/admin/khoa-hoc/danh-muc");

section("giaoTrinhHref / baiHocHref (BU-02 → LOI-02)");
check("LOI-02: gia sư → gốc lớp /lop-cua-toi/quan-lop/<id> (bí danh cũ của Giáo trình; …/giao-trinh nay chỉ 307 về gốc)", giaoTrinhHref("toan-9", true) === "/lop-cua-toi/quan-lop/toan-9", giaoTrinhHref("toan-9", true));
check("LOI-02: baiHocHref = classBase (không query)", baiHocHref("toan-9") === "/lop-cua-toi/quan-lop/toan-9" && baiHocHref("toan-9") === classBase("toan-9"));
check("quản trị (không có màn này) → tab Chương bài của trang quản lớp /admin", giaoTrinhHref("toan-9", false) === "/admin/khoa-hoc/toan-9?tab=chuong-bai");
check("phá: id lạ (có '/', '?', '#', '..', '.', ' ') bị mã hoá, không thoát khỏi đường dẫn của lớp", ["a/b", "a?x=1", "a#h", "../admin", "..", ".", "a b"].every(id => [giaoTrinhHref(id, true), baiHocHref(id)].every(h => h.startsWith("/lop-cua-toi/quan-lop/") && h.split("/").length === 4 && !h.includes("?") && !h.includes("#") && !/\/\.{1,2}$/.test(h) && new URL(h, "https://x.vn").pathname.startsWith("/lop-cua-toi/quan-lop/"))), ["..", "../admin"].map(id => baiHocHref(id)));
check("đi vòng: đường gốc lớp / giáo trình KHÔNG có bản /admin riêng cho …/giao-trinh (toAdminPath → null, đúng quyết định 'không sửa FAMILIES')", toAdminPath("/lop-cua-toi/quan-lop/toan-9/giao-trinh") === null);

section("contentTabsFor — dải tab vỏ nội dung gia sư");
const dt = contentTabsFor("/lop-cua-toi/de-thi");
check("/lop-cua-toi/de-thi → nhóm Đề thi: Đề thi · Ngân hàng câu hỏi · Ma trận đề · Tệp đề gốc, 'Đề thi' sáng", dt?.label === "Đề thi" && dt.tabs.map(t => t.label).join(" · ") === "Đề thi · Ngân hàng câu hỏi · Ma trận đề · Tệp đề gốc" && dt.tabs.filter(t => t.active).map(t => t.label).join() === "Đề thi", dt);
check("/lop-cua-toi/de-thi/abc (một đề) → 'Đề thi' sáng", contentTabsFor("/lop-cua-toi/de-thi/abc")?.tabs.find(t => t.active)?.label === "Đề thi");
check("/lop-cua-toi/de-thi/ma-tran/m1 → 'Ma trận đề' sáng; /de-thi/abc/ma-de → 'Đề thi' sáng", contentTabsFor("/lop-cua-toi/de-thi/ma-tran/m1")?.tabs.filter(t => t.active).map(t => t.label).join() === "Ma trận đề" && contentTabsFor("/lop-cua-toi/de-thi/abc/ma-de")?.tabs.filter(t => t.active).map(t => t.label).join() === "Đề thi");
check("/lop-cua-toi/de-thi/ngan-hang-cau-hoi/bank1 → 'Ngân hàng câu hỏi' sáng (tiền tố dài nhất, không phải 'Đề thi')", contentTabsFor("/lop-cua-toi/de-thi/ngan-hang-cau-hoi/bank1")?.tabs.filter(t => t.active).map(t => t.label).join() === "Ngân hàng câu hỏi");
check("/lop-cua-toi/de-thi/ngan-hang-de-thi → 'Tệp đề gốc' sáng; href các tab là đường gia sư", (() => { const g = contentTabsFor("/lop-cua-toi/de-thi/ngan-hang-de-thi")!; return g.tabs.find(t => t.active)?.label === "Tệp đề gốc" && g.tabs.every(t => t.href.startsWith("/lop-cua-toi/de-thi")); })());

section("LOI-02 A2 — dải 4 tab của chủ lớp");
const Q = "/lop-cua-toi/quan-lop/toan-9";
const lit = (p: string, tab: string | null = null, role: Parameters<typeof contentTabsFor>[2] = null) => contentTabsFor(p, tab, role)?.tabs.filter(t => t.active).map(t => t.label).join(",") ?? "<null>";
const ql = contentTabsFor(Q);
check("gốc trần → nhóm 'Quản lớp', ĐÚNG 4 tab theo thứ tự Bài học · Học sinh · Điểm danh · Cài đặt", ql?.label === "Quản lớp" && ql.tabs.map(t => t.label).join(" · ") === "Bài học · Học sinh · Điểm danh · Cài đặt", ql);
check("href: Bài học = gốc lớp (không query) · Học sinh /hoc-vien · Điểm danh /diem-danh · Cài đặt ?tab=cai-dat", ql?.tabs.map(t => t.href).join(" ") === `${Q} ${Q}/hoc-vien ${Q}/diem-danh ${Q}?tab=cai-dat`, ql?.tabs.map(t => t.href));
check("phá: dải KHÔNG còn nhãn 'Giáo trình', 'Lịch học', 'Bài tập' (ở mọi trang của lớp, mọi vai)", [[Q, null], [Q, "chuong-bai"], [Q, "lich-hoc"], [`${Q}/lich-hoc`, null], [`${Q}/giao-trinh`, null], [`${Q}/hoc-vien`, null]].every(([p, t]) => ["owner", "admin", "co_teacher", "subject_teacher", null].every(r => !contentTabsFor(p as string, t, r as any)?.tabs.some(x => ["Giáo trình", "Lịch học", "Bài tập", "Bài tập tự nộp"].includes(x.label)))));
// Bảng A2 + A4: [đường, ?tab=, tab sáng]
const rows: [string, string | null, string][] = [
  [Q, null, "Bài học"],                         // gốc trần
  [Q, "chuong-bai", "Bài học"],                 // liên kết cũ "Bài tập" — render thẳng, tab Bài học sáng
  [Q, "giao-trinh", "Bài học"],
  [Q, "xyz", "Bài học"],                        // ?tab lạ ⇒ thân Bài học
  [Q, "", "Bài học"],
  [Q, "cai-dat", "Cài đặt"],
  [Q, "hoc-vien", "Học sinh"],                  // liên kết cũ (trang chuyển hướng sang /hoc-vien)
  [Q, "diem-danh", ""],                         // gốc ?tab=diem-danh chỉ là bước chuyển hướng ⇒ không sáng Bài học
  [Q, "lich-hoc", ""],                          // tab Lịch học đã bỏ ⇒ không tab nào sáng
  [`${Q}/hoc-vien`, null, "Học sinh"],
  [`${Q}/hoc-vien/x`, null, "Học sinh"],
  [`${Q}/diem-danh`, null, "Điểm danh"],
  [`${Q}/diem-danh/in`, "cai-dat", "Điểm danh"],
  [`${Q}/giao-trinh`, null, "Bài học"],          // (route 307 về gốc; nếu có vẽ thì vẫn là Bài học)
  [`${Q}/giao-trinh/xem/l-123`, null, "Bài học"],// "Xem như học sinh"
  [`${Q}/giao-trinh/xem/l-123`, "cai-dat", "Bài học"],
  [`${Q}/lich-hoc`, null, ""],                  // mở bằng link: dải vẫn hiện, KHÔNG tab nào sáng
  [`${Q}/lich-hoc`, "cai-dat", ""],
  [`${Q}/giao-trinh-khac`, null, ""],           // phá: tiền tố giả
  [`${Q}/hoc-vienx`, null, ""],
];
for (const [p, t, want] of rows) check(`${p.replace(Q, "<lớp>") || "<lớp>"}${t !== null ? `?tab=${t}` : ""} → sáng: ${want || "(không tab nào)"}`, lit(p, t) === want, lit(p, t));
check("…/lich-hoc: dải VẪN hiện (4 tab) dù không tab nào sáng", contentTabsFor(`${Q}/lich-hoc`)?.tabs.length === 4);
check("phá: mọi hàng của bảng có nhiều nhất MỘT tab sáng", rows.every(([p, t]) => (contentTabsFor(p, t)?.tabs.filter(x => x.active).length ?? 0) <= 1));
// Đường của lớp có id ".." luôn là classBase("..") = …/%252E%252E (trình duyệt đã chuẩn hoá "%2E%2E" trước khi tới đây, nên không có pathname đó).
check("phá: lớp id '..' / '.' (qua classBase) — dải không trỏ ra ngoài quan-lop", ["..", "."].map(id => classBase(id).split("/").pop()!).every(id => contentTabsFor(`/lop-cua-toi/quan-lop/${id}`)?.tabs.every(t => new URL(t.href, "https://x.vn").pathname.startsWith("/lop-cua-toi/quan-lop/"))));
check("tao-moi, danh sách lớp, trang khác → không dải tab", contentTabsFor("/lop-cua-toi/quan-lop/tao-moi/giao-trinh") === null && contentTabsFor("/lop-cua-toi/quan-lop/tao-moi") === null && contentTabsFor("/lop-cua-toi/quan-lop") === null && contentTabsFor("/lop-cua-toi/lich") === null && contentTabsFor("/admin/thi-thu") === null);

section("LOI-02 A3 — đồng giảng / giáo viên bộ môn chỉ có 'Bài học'");
for (const r of ["co_teacher", "subject_teacher"] as const) {
  check(`${r}: dải đúng MỘT tab 'Bài học' trỏ gốc lớp`, contentTabsFor(Q, null, r)?.tabs.map(t => `${t.label}|${t.href}`).join() === `Bài học|${Q}`, contentTabsFor(Q, null, r));
  check(`${r}: gốc / giao-trinh/xem → 'Bài học' sáng; /lich-hoc (mở bằng link) → không sáng`, lit(Q, null, r) === "Bài học" && lit(`${Q}/giao-trinh/xem/l1`, null, r) === "Bài học" && lit(`${Q}/lich-hoc`, null, r) === "");
}
check("owner / admin / không vai → 4 tab", (["owner", "admin", null, undefined] as const).every(r => contentTabsFor(Q, null, r)?.tabs.length === 4));

section("TUT-lich-keo-tha — trang khung giờ kéo-thả vẫn còn (mở bằng link)");
check("toAdminPath(/lich-hoc) → /admin/khoa-hoc/<id>?tab=lich-hoc; giữ query khác", toAdminPath("/lop-cua-toi/quan-lop/toan-9/lich-hoc") === "/admin/khoa-hoc/toan-9?tab=lich-hoc" && toAdminPath("/lop-cua-toi/quan-lop/toan-9/lich-hoc?x=1") === "/admin/khoa-hoc/toan-9?x=1&tab=lich-hoc", toAdminPath("/lop-cua-toi/quan-lop/toan-9/lich-hoc?x=1"));
check("chiều xuôi không đổi: /admin/khoa-hoc/toan-9?tab=lich-hoc → /quan-lop/toan-9?tab=lich-hoc", toTutorPath("/admin/khoa-hoc/toan-9?tab=lich-hoc") === "/lop-cua-toi/quan-lop/toan-9?tab=lich-hoc");
check("A4: /admin/khoa-hoc/<id>?tab=chuong-bai (gia sư) → /quan-lop/<id>?tab=chuong-bai (proxy giữ nguyên, trang vẽ Bài học)", toTutorPath("/admin/khoa-hoc/toan-9?tab=chuong-bai") === "/lop-cua-toi/quan-lop/toan-9?tab=chuong-bai" && lit(Q, "chuong-bai") === "Bài học");
check("phá: tao-moi/danh-muc/đuôi lạ không map: /quan-lop/tao-moi/lich-hoc, /quan-lop/danh-muc/lich-hoc, /quan-lop/a/lich-hoc/x, /quan-lop/a/lich-hocx", ["/lop-cua-toi/quan-lop/tao-moi/lich-hoc", "/lop-cua-toi/quan-lop/danh-muc/lich-hoc", "/lop-cua-toi/quan-lop/a/lich-hoc/x", "/lop-cua-toi/quan-lop/a/lich-hocx"].every(p => toAdminPath(p) === null), ["/lop-cua-toi/quan-lop/tao-moi/lich-hoc", "/lop-cua-toi/quan-lop/a/lich-hoc/x"].map(toAdminPath));

done();
