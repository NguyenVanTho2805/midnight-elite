// Quy tắc chuyển hướng theo tên miền + vai (src/lib/hostRouting.ts, phần thuần của src/proxy.ts). Không DB, không mạng.
// 14/10/2026: gia sư ở lại tên miền chính; người đã đăng nhập không thấy trang giới thiệu của khách.
import { ADMIN_HOST, MAIN_HOST, decideRoute, needsSession, isAdminHost, type RouteSession, type RouteDecision } from "@/lib/hostRouting";
import { check, section, done } from "./h";

const MAIN = "midnightelite-edu.com", ADM = ADMIN_HOST;
const student: RouteSession = { role: "student" };
const tutor: RouteSession = { role: "admin", adminRole: "teacher" };
const sup: RouteSession = { role: "admin", adminRole: "admin_super" };
const content: RouteSession = { role: "admin", adminRole: "admin_content" };
const d = (host: string, pathname: string, session: RouteSession | null, search = ""): RouteDecision => decideRoute({ host, pathname, search, session });
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

section("Hằng số");
check("tên miền chính suy ra từ tên miền admin", MAIN_HOST === MAIN && ADM === "admin.midnightelite-edu.com", [MAIN_HOST, ADM]);
check("nhận ra tên miền admin kể cả có cổng (giả lập cục bộ), không nhầm tên miền chính", isAdminHost(ADM) && isAdminHost(`${ADM}:3100`) && !isAdminHost(MAIN) && !isAdminHost("localhost:3100") && !isAdminHost(`x${ADM}`));

section("Tên miền chính — /admin/*: gia sư ở lại, người khác sang tên miền admin");
check("gia sư mở /admin/thi-thu → ở lại (next)", eq(d(MAIN, "/admin/thi-thu", tutor), { kind: "next" }));
check("gia sư mở trang sâu /admin/khoa-hoc/abc/diem-danh → ở lại", eq(d(MAIN, "/admin/khoa-hoc/abc/diem-danh", tutor), { kind: "next" }));
check("gia sư mở đúng /admin (bảng tổng quan quản trị, không dành cho gia sư) → về Hộp việc /lop-cua-toi", eq(d(MAIN, "/admin", tutor), { kind: "redirect", status: 307, pathname: "/lop-cua-toi" }));
for (const [name, s] of [["quản trị cấp 1", sup], ["quản trị nội dung", content], ["học viên", student], ["khách", null]] as const)
  check(`${name} mở /admin/thi-thu?x=1 → 308 sang tên miền admin, bỏ tiền tố /admin, giữ tham số`, eq(d(MAIN, "/admin/thi-thu", s, "?x=1"), { kind: "redirect", status: 308, host: "admin", pathname: "/thi-thu", search: "?x=1" }), d(MAIN, "/admin/thi-thu", s, "?x=1"));
check("/admin (không đường dẫn phụ) của quản trị → 308 sang tên miền admin, đường dẫn '/'", eq(d(MAIN, "/admin", sup), { kind: "redirect", status: 308, host: "admin", pathname: "/", search: "" }));
check("/administrator (chỉ giống tiền tố) KHÔNG bị coi là /admin", eq(d(MAIN, "/administrator", sup), { kind: "next" }) && eq(d(MAIN, "/administrator", tutor), { kind: "next" }));

section("Tên miền chính — người đã đăng nhập không thấy trang giới thiệu của khách");
check("học viên mở '/' → vào 'Việc của tôi'", eq(d(MAIN, "/", student), { kind: "redirect", status: 307, pathname: "/student/viec-cua-toi" }));
check("gia sư mở '/' → vào Hộp việc", eq(d(MAIN, "/", tutor), { kind: "redirect", status: 307, pathname: "/lop-cua-toi" }));
check("khách mở '/' → xem trang chủ như thường", eq(d(MAIN, "/", null), { kind: "next" }));
check("quản trị mở '/' trên tên miền chính → giữ nguyên (họ đăng nhập ở tên miền admin; chuyển sang đó sẽ không có phiên)", eq(d(MAIN, "/", sup), { kind: "next" }) && eq(d(MAIN, "/", content), { kind: "next" }));
for (const [name, s, home] of [["học viên", student, "/student/viec-cua-toi"], ["gia sư", tutor, "/lop-cua-toi"]] as const) {
  check(`${name} đã đăng nhập mở /dang-ky → vào thẳng dashboard`, eq(d(MAIN, "/dang-ky", s), { kind: "redirect", status: 307, pathname: home }));
  check(`${name} mở /dang-nhap → dashboard`, eq(d(MAIN, "/dang-nhap", s), { kind: "redirect", status: 307, pathname: home }));
  check(`${name} mở /dang-nhap?redirect=/student/lich-hoc → về đúng trang đang định vào`, eq(d(MAIN, "/dang-nhap", s, "?redirect=%2Fstudent%2Flich-hoc"), { kind: "redirect", status: 307, pathname: "/student/lich-hoc" }));
  for (const evil of ["https://evil.example/x", "//evil.example/x", "/\\evil.example"])
    check(`${name} mở /dang-nhap?redirect=${evil} → bỏ qua địa chỉ ngoài, về dashboard`, eq(d(MAIN, "/dang-nhap", s, `?redirect=${encodeURIComponent(evil)}`), { kind: "redirect", status: 307, pathname: home }));
}
check("khách mở /dang-nhap, /dang-ky → xem bình thường", eq(d(MAIN, "/dang-nhap", null), { kind: "next" }) && eq(d(MAIN, "/dang-ky", null), { kind: "next" }));
check("trang khách khác (/thu-vien, /khoa-hoc…) KHÔNG bị chặn bởi proxy — học viên/gia sư thấy chúng trong vỏ dashboard (GuestChrome)", ["/thu-vien", "/khoa-hoc", "/giang-vien", "/diem-chuan", "/tin-tuc"].every(p => eq(d(MAIN, p, student), { kind: "next" }) && eq(d(MAIN, p, tutor), { kind: "next" })));
check("/quen-mat-khau, /dat-lai-mat-khau, /xac-thuc-email vẫn mở được khi đã đăng nhập (liên kết trong thư)", ["/quen-mat-khau", "/dat-lai-mat-khau", "/xac-thuc-email"].every(p => eq(d(MAIN, p, student), { kind: "next" })));
check("API và đường khác → không đụng", eq(d(MAIN, "/api/auth/me", tutor), { kind: "next" }) && eq(d(MAIN, "/student/lich-hoc", student), { kind: "next" }) && eq(d(MAIN, "/lop-cua-toi", tutor), { kind: "next" }));

section("Tên miền admin");
for (const p of ["/api/auth/login", "/_next/static/x.js", "/dang-nhap"]) check(`${p} → giữ nguyên`, eq(d(ADM, p, sup), { kind: "next" }) && eq(d(ADM, p, null), { kind: "next" }) && eq(d(ADM, p, tutor), { kind: "next" }));
check("'/' → viết lại thành /admin (dashboard admin)", eq(d(ADM, "/", sup), { kind: "rewrite", pathname: "/admin" }) && eq(d(ADM, "/", null), { kind: "rewrite", pathname: "/admin" }));
check("/admin/kiem-duyet → qua", eq(d(ADM, "/admin/kiem-duyet", sup), { kind: "next" }) && eq(d(ADM, "/admin/kiem-duyet", null), { kind: "next" }));
check("đường lạ (/khoa-hoc) → về /admin", eq(d(ADM, "/khoa-hoc", sup), { kind: "redirect", status: 307, pathname: "/admin" }));
check("GIA SƯ trên tên miền admin → đưa về tên miền chính, giữ đường dẫn và tham số", eq(d(ADM, "/admin/thi-thu", tutor, "?a=1"), { kind: "redirect", status: 307, host: "main", pathname: "/admin/thi-thu", search: "?a=1" }), d(ADM, "/admin/thi-thu", tutor, "?a=1"));
check("gia sư ở '/' của tên miền admin → cũng đưa về tên miền chính", d(ADM, "/", tutor).kind === "redirect");
check("gia sư vẫn gọi được API / đăng nhập trên tên miền admin (không bị chuyển)", eq(d(ADM, "/api/auth/me", tutor), { kind: "next" }) && eq(d(ADM, "/dang-nhap", tutor), { kind: "next" }));

section("needsSession — chỉ giải mã phiên khi cần");
check("tên miền chính: chỉ '/', /admin*, /dang-ky, /dang-nhap cần phiên", ["/", "/admin", "/admin/x", "/dang-ky", "/dang-nhap"].every(p => needsSession(MAIN, p)));
check("tên miền chính: trang khách, API, học viên, gia sư KHÔNG tốn giải mã", ["/thu-vien", "/khoa-hoc", "/api/auth/me", "/student/x", "/lop-cua-toi", "/quen-mat-khau"].every(p => !needsSession(MAIN, p)));
check("tên miền admin: mọi trang cần phiên (để nhận ra gia sư), trừ API / _next / đăng nhập", needsSession(ADM, "/") && needsSession(ADM, "/admin/x") && needsSession(ADM, "/khoa-hoc") && !needsSession(ADM, "/api/x") && !needsSession(ADM, "/_next/x") && !needsSession(ADM, "/dang-nhap"));

done();
