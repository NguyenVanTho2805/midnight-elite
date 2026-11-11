// LOI-01 (11/11/2026) — cờ ẩn tính năng chưa dùng (src/lib/features.ts) + chốt chặn route (src/lib/hostRouting.ts) + nơi dùng (homeLayout, adminNav, sitemap).
// THUẦN: không DB, không mạng, không máy chủ dev. Mỗi ca truyền `env` tường minh nên chạy được bất kể máy đang đặt cờ gì; riêng phần "mặc định" đọc process.env thật
// và chỉ kiểm khi KHÔNG có biến NEXT_PUBLIC_KIN_MO_* nào (in rõ là bỏ qua nếu có).
//
// Ca phá cố ý (đã chạy, mỗi dòng làm ĐỎ đúng ca ghi bên cạnh):
//  - features.featureOn: đổi `=== "1"` thành `!!env?.[k]` → ca "\"0\" / \"true\" / rác vẫn ẩn" đỏ.
//  - features.PATH_RULES: đổi quy tắc "/cong-dong" sang `sub: true` → ca "/cong-dong/<id> (câu hỏi trong lớp) KHÔNG bị chặn" đỏ.
//  - features.PATH_RULES: bỏ `route` của "/thu-vien" về `true` → ca "học sinh / gia sư vẫn vào /thu-vien" đỏ.
//  - features.PATH_RULES: thêm `route: true` cho "/lop-cua-toi/lich" → ca "Lịch: route KHÔNG chặn" đỏ.
//  - hostRouting.decideRoute: bỏ khối LOI-01 → cả phần "Chốt chặn route" đỏ.
//  - hostRouting.decideRoute: đổi 307 thành 308 → ca "mọi chuyển hướng là 307" đỏ.
//  - hostRouting.needsSession: bỏ `|| mayBlockRoute(pathname)` → ca "cần giải mã phiên ở đường bị chặn" đỏ.
import { FEATURES, featureEnvName, featureOn, hiddenLinkFeature, isLinkHidden, visibleLinks, blockedRouteFeature, mayBlockRoute, readFeatureEnv, type FeatureEnv, type FeatureKey } from "@/lib/features";
import { decideRoute, needsSession, featureViewerOf, type RouteSession, type RouteDecision } from "@/lib/hostRouting";
import { homeNavFor, homeBlocksFor } from "@/lib/homeLayout";
import { visibleModules, matchSub } from "@/lib/adminNav";
import { check, section, done } from "./h";

const OFF: FeatureEnv = {};
const ALL_ON: FeatureEnv = Object.fromEntries(FEATURES.map(k => [k, "1"])) as FeatureEnv;
const only = (k: FeatureKey): FeatureEnv => ({ [k]: "1" });
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

section("Tên cờ và cách đọc");
check("đúng 9 phần, đúng tên phiếu", FEATURES.join() === "TIM_GIA_SU,CONG_DONG,LICH,TIN_TUC,THU_VIEN,TIENG_ANH,XEP_HANG,COIN,DIEM_CHUAN", FEATURES);
check("tên biến môi trường NEXT_PUBLIC_KIN_MO_<TÊN> (phòng Gia sư đọc NEXT_PUBLIC_KIN_MO_LICH)", featureEnvName("LICH") === "NEXT_PUBLIC_KIN_MO_LICH" && featureEnvName("TIM_GIA_SU") === "NEXT_PUBLIC_KIN_MO_TIM_GIA_SU");
check("readFeatureEnv đọc đủ 9 khoá", eq(Object.keys(readFeatureEnv()).sort(), [...FEATURES].sort()));
for (const k of FEATURES) {
  check(`${k}: thiếu biến → ẩn`, !featureOn(k, OFF));
  check(`${k}: "1" → mở, chỉ mở đúng nó`, featureOn(k, only(k)) && FEATURES.filter(o => o !== k).every(o => !featureOn(o, only(k))));
}
check("\"0\" / \"true\" / \"yes\" / \" 1\" / rác vẫn ẩn (chỉ đúng \"1\" mới mở)", ["0", "true", "yes", " 1", "1 ", "on", ""].every(v => !featureOn("LICH", { LICH: v })));
// Đọc môi trường thật: ghi đè process.env rồi gọi không truyền env.
{
  const name = featureEnvName("XEP_HANG"), old = process.env[name];
  process.env[name] = "1";
  const on = featureOn("XEP_HANG");
  delete process.env[name];
  const off = featureOn("XEP_HANG");
  if (old !== undefined) process.env[name] = old;
  check("không truyền env thì đọc process.env lúc gọi (đặt =1 → mở; xoá → ẩn)", on && !off);
}
const setFlags = FEATURES.filter(k => process.env[featureEnvName(k)] !== undefined);
if (setFlags.length === 0) {
  check("mặc định (không đặt cờ nào): cả 9 phần đều ẩn", FEATURES.every(k => !featureOn(k)));
} else console.log(`  (bỏ qua ca "mặc định": máy đang đặt ${setFlags.map(featureEnvName).join(", ")})`);

section("Liên kết bị gỡ (menu, chân trang, bản đồ, sitemap)");
const LINKS: [string, FeatureKey][] = [
  ["/giang-vien", "TIM_GIA_SU"], ["/giang-vien?mon=toan", "TIM_GIA_SU"], ["/mentor/abc", "TIM_GIA_SU"], ["/mentor/abc/yeu-cau", "TIM_GIA_SU"],
  ["/cong-dong", "CONG_DONG"], ["/cong-dong?tab=hoi-dap-qa", "CONG_DONG"], ["/cong-dong/hoi-dap/q1", "CONG_DONG"], ["/cong-dong/ho-so/u1", "CONG_DONG"], ["/student/cong-dong", "CONG_DONG"], ["/student/hoi-dap", "CONG_DONG"],
  ["/lop-cua-toi/kiem-duyet", "CONG_DONG"], ["/admin/cong-dong", "CONG_DONG"],
  ["/lop-cua-toi/lich", "LICH"], ["/lop-cua-toi/lich/khung?lop=x", "LICH"], ["/student/lich-hoc", "LICH"],
  ["/tin-tuc", "TIN_TUC"], ["/tin-tuc/bai-1", "TIN_TUC"], ["/student/tin-tuc", "TIN_TUC"], ["/admin/tin-tuc", "TIN_TUC"],
  ["/thu-vien", "THU_VIEN"], ["/thu-vien#c-abc", "THU_VIEN"], ["/admin/thu-vien-video", "THU_VIEN"],
  ["/student/tieng-anh", "TIENG_ANH"], ["/student/tieng-anh/doc/1", "TIENG_ANH"],
  ["/bang-xep-hang", "XEP_HANG"], ["/student/bang-xep-hang", "XEP_HANG"], ["/vinh-danh", "XEP_HANG"], ["/admin/vinh-danh", "XEP_HANG"],
  ["/student/vi", "COIN"], ["/admin/topups", "COIN"],
  ["/diem-chuan", "DIEM_CHUAN"], ["/tra-cuu", "DIEM_CHUAN"], ["/student/tra-cuu", "DIEM_CHUAN"], ["/admin/diem-chuan/cong-thuc", "DIEM_CHUAN"],
];
for (const [href, k] of LINKS) {
  check(`${href} → ẩn theo ${k} khi tắt, hiện khi bật đúng ${k}`, hiddenLinkFeature(href, OFF) === k && !isLinkHidden(href, only(k)), hiddenLinkFeature(href, OFF));
}
const KEEP = ["/", "/khoa-hoc", "/khoa-hoc?gia=free", "/thi-thu", "/student/thi-thu", "/student/viec-cua-toi", "/student/hoc-tap", "/student/hoc-phi", "/student/ho-so", "/student/nhap-ma-lop",
  "/lop-cua-toi", "/lop-cua-toi/lop", "/lop-cua-toi/bai-tap", "/lop-cua-toi/hoc-phi", "/lop-cua-toi/ho-so", "/lop-cua-toi/cai-dat", "/lop-cua-toi/de-thi", "/lop-cua-toi/de-thi/ngan-hang-de-thi",
  "/lop-cua-toi/yeu-cau", "/lop-cua-toi/bai-dang", "/lop-cua-toi/so-diem", "/admin/thi-thu", "/admin/khoa-hoc", "/admin/trang-chu", "/dang-ky", "/dang-nhap", "/phu-huynh", "/ban-do",
  "/cong-dong/t123", "/cong-dong/t123#r-9", "/yeu-cau/abc", "/lich", "/giang-vienx", "/tin-tucx", "/thu-vienx", "https://zalo.me/x", "tel:0384", "//evil.com/giang-vien"];
check("đường giữ nguyên (Thi thử, đề, Lớp, Bài tập, Học phí, Hộp việc, Hồ sơ, Cài đặt, Nhập mã lớp…) không bao giờ bị gỡ", KEEP.every(h => !isLinkHidden(h, OFF)), KEEP.filter(h => isLinkHidden(h, OFF)));
check("bật cả 9 cờ → không liên kết nào bị gỡ", LINKS.every(([h]) => !isLinkHidden(h, ALL_ON)), LINKS.filter(([h]) => isLinkHidden(h, ALL_ON)));
const items = [{ href: "/khoa-hoc", label: "a" }, { href: "/giang-vien", label: "b" }, { href: "/thi-thu", label: "c" }, { href: "/tin-tuc", label: "d" }];
check("visibleLinks giữ thứ tự, bỏ đúng mục ẩn", visibleLinks(items, OFF).map(i => i.label).join() === "a,c" && visibleLinks(items, only("TIN_TUC")).map(i => i.label).join() === "a,c,d" && visibleLinks(items, ALL_ON).length === 4);

section("Chốt chặn route (blockedRouteFeature)");
const VIEWERS = ["guest", "student", "tutor", "admin"] as const;
const BLOCKED: [string, FeatureKey][] = [
  ["/giang-vien", "TIM_GIA_SU"], ["/mentor/abc", "TIM_GIA_SU"], ["/mentor/abc/yeu-cau", "TIM_GIA_SU"],
  ["/cong-dong", "CONG_DONG"], ["/cong-dong/hoi-dap/q1", "CONG_DONG"], ["/cong-dong/ho-so/u1", "CONG_DONG"], ["/student/cong-dong", "CONG_DONG"], ["/student/hoi-dap", "CONG_DONG"], ["/student/hoi-dap/q1", "CONG_DONG"],
  ["/tin-tuc", "TIN_TUC"], ["/tin-tuc/bai-1", "TIN_TUC"], ["/student/tin-tuc", "TIN_TUC"],
  ["/student/tieng-anh", "TIENG_ANH"], ["/student/tieng-anh/tu-vung/on", "TIENG_ANH"],
  ["/bang-xep-hang", "XEP_HANG"], ["/student/bang-xep-hang", "XEP_HANG"], ["/vinh-danh", "XEP_HANG"],
  ["/diem-chuan", "DIEM_CHUAN"], ["/diem-chuan/x", "DIEM_CHUAN"], ["/tra-cuu", "DIEM_CHUAN"], ["/student/tra-cuu", "DIEM_CHUAN"],
];
for (const [p, k] of BLOCKED) {
  check(`${p}: mọi vai bị chặn khi ${k} tắt; mở lại khi ${k}=1`, VIEWERS.every(v => blockedRouteFeature(p, v, OFF) === k) && VIEWERS.every(v => blockedRouteFeature(p, v, only(k)) === null));
}
check("/cong-dong/<id> (câu hỏi trong lớp) KHÔNG bị chặn ở proxy — trang tự kiểm courseId", VIEWERS.every(v => blockedRouteFeature("/cong-dong/t123", v, OFF) === null));
check("Lịch: route KHÔNG chặn (chỉ gỡ menu) — /lop-cua-toi/lich, /student/lich-hoc", VIEWERS.every(v => blockedRouteFeature("/lop-cua-toi/lich", v, OFF) === null && blockedRouteFeature("/student/lich-hoc", v, OFF) === null));
check("Coin: route /student/vi không chặn ở đây (layout của nó tự lo); không đụng logic", VIEWERS.every(v => blockedRouteFeature("/student/vi", v, OFF) === null));
check("trang quản trị của phần ẩn (/admin/tin-tuc, /admin/cong-dong, /admin/diem-chuan…) chỉ rút menu, không chặn", ["/admin/tin-tuc", "/admin/cong-dong", "/admin/diem-chuan", "/admin/vinh-danh", "/admin/thu-vien-video", "/lop-cua-toi/kiem-duyet"].every(p => VIEWERS.every(v => blockedRouteFeature(p, v, OFF) === null)));
check("Thư viện CHUNG: khách và quản trị bị chặn /thu-vien", blockedRouteFeature("/thu-vien", "guest", OFF) === "THU_VIEN" && blockedRouteFeature("/thu-vien", "admin", OFF) === "THU_VIEN");
check("học sinh / gia sư vẫn vào /thu-vien (thư viện lớp mình học / Thư viện của tôi)", blockedRouteFeature("/thu-vien", "student", OFF) === null && blockedRouteFeature("/thu-vien", "tutor", OFF) === null);
check("bật cả 9 cờ → không route nào bị chặn", BLOCKED.every(([p]) => VIEWERS.every(v => blockedRouteFeature(p, v, ALL_ON) === null)) && blockedRouteFeature("/thu-vien", "guest", ALL_ON) === null);
check("mayBlockRoute: đúng ở đường có thể chặn, sai ở đường thường và ở Lịch", mayBlockRoute("/giang-vien", OFF) && mayBlockRoute("/thu-vien", OFF) && !mayBlockRoute("/khoa-hoc", OFF) && !mayBlockRoute("/lop-cua-toi/lich", OFF) && !mayBlockRoute("/cong-dong/t1", OFF) && !mayBlockRoute("/giang-vien", only("TIM_GIA_SU")));

section("hostRouting.decideRoute — 307 về trang đầu theo vai (dùng cờ của MÁY đang chạy bài)");
const MAIN = "midnightelite-edu.com";
const student: RouteSession = { role: "student" }, tutor: RouteSession = { role: "admin", adminRole: "teacher" }, sup: RouteSession = { role: "admin", adminRole: "admin_super" };
const d = (pathname: string, s: RouteSession | null, search = ""): RouteDecision => decideRoute({ host: MAIN, pathname, search, session: s });
check("featureViewerOf: khách / học sinh / gia sư / quản trị; vai lạ → khách", featureViewerOf(null) === "guest" && featureViewerOf(student) === "student" && featureViewerOf(tutor) === "tutor" && featureViewerOf(sup) === "admin" && featureViewerOf({ role: "x" }) === "guest");
if (!featureOn("TIM_GIA_SU")) {
  check("khách mở /giang-vien?mon=toan → 307 về '/' (bỏ tham số)", eq(d("/giang-vien", null, "?mon=toan"), { kind: "redirect", status: 307, pathname: "/" }), d("/giang-vien", null, "?mon=toan"));
  check("học sinh mở /mentor/abc → 307 về Việc của tôi", eq(d("/mentor/abc", student), { kind: "redirect", status: 307, pathname: "/student/viec-cua-toi" }), d("/mentor/abc", student));
  check("gia sư mở /giang-vien → 307 về Hộp việc", eq(d("/giang-vien", tutor), { kind: "redirect", status: 307, pathname: "/lop-cua-toi" }));
  check("quản trị mở /giang-vien ở tên miền chính → 307 thẳng sang /admin ở tên miền admin", eq(d("/giang-vien", sup), { kind: "redirect", status: 307, host: "admin", pathname: "/admin", search: "" }));
  check("cần giải mã phiên ở đường bị chặn (đích theo vai)", needsSession(MAIN, "/giang-vien") && needsSession(MAIN, "/mentor/x"));
} else console.log("  (máy đang bật TIM_GIA_SU: bỏ qua ca chặn /giang-vien)");
if (!featureOn("CONG_DONG")) {
  check("khách mở /cong-dong?tab=hoi-dap-qa → 307 về '/'", eq(d("/cong-dong", null, "?tab=hoi-dap-qa"), { kind: "redirect", status: 307, pathname: "/" }));
  check("/cong-dong/<id> cho qua (trang tự xử lý bài lớp / bài chung)", VIEWERS.length === 4 && [null, student, tutor].every(s => eq(d("/cong-dong/t1", s), { kind: "next" })));
}
check("mọi chuyển hướng LOI-01 là 307 (không 308)", [...BLOCKED.map(([p]) => p), "/thu-vien"].every(p => [null, student, tutor, sup].every(s => { const r = d(p, s); return r.kind !== "redirect" || r.status === 307; })));
check("đường không thuộc phần ẩn → next như trước (Lớp, Thi thử, Lịch, câu hỏi lớp)", ["/khoa-hoc", "/thi-thu", "/lop-cua-toi/lich", "/student/lich-hoc", "/cong-dong/t1"].every(p => [null, student, tutor].every(s => eq(d(p, s), { kind: "next" }))));
check("/khoa-hoc không cần giải mã phiên (không tốn gì thêm)", !needsSession(MAIN, "/khoa-hoc") && !needsSession(MAIN, "/lop-cua-toi/lich"));

section("Nơi dùng: thanh trên, khối trang chủ, menu quản trị");
const nav = (env: FeatureEnv, kind: "guest" | "student" = "guest") => homeNavFor({ kind }, env).map(i => i.label).join();
check("thanh trên khi tắt hết: Lớp học · Thi thử (học sinh thêm Lớp của tôi)", nav(OFF) === "Lớp học,Thi thử" && nav(OFF, "student") === "Lớp học,Thi thử,Lớp của tôi", [nav(OFF), nav(OFF, "student")]);
check("bật cả 9 cờ → đủ 4 mục như cũ", nav(ALL_ON) === "Lớp học,Thi thử,Cộng đồng,Tin tức");
check("bật riêng TIN_TUC → chỉ thêm Tin tức", nav(only("TIN_TUC")) === "Lớp học,Thi thử,Tin tức");
const blocks = (env: FeatureEnv) => homeBlocksFor({ kind: "guest" }, { quiz: true }, env);
check("trang chủ khi tắt: không bảng tin, không quiz (nằm trong bảng tin), không tính điểm", !blocks(OFF).community && !blocks(OFF).quiz && !blocks(OFF).score);
check("bật CONG_DONG + DIEM_CHUAN → bảng tin, quiz, tính điểm như cũ", blocks({ CONG_DONG: "1", DIEM_CHUAN: "1" }).community && blocks({ CONG_DONG: "1", DIEM_CHUAN: "1" }).quiz && blocks({ CONG_DONG: "1", DIEM_CHUAN: "1" }).score);
const adminHrefs = (env: FeatureEnv) => visibleModules("admin_super", env).flatMap(m => m.subs.map(s => s.href));
const HIDDEN_ADMIN = ["/admin/tin-tuc", "/admin/thu-vien-video", "/admin/cong-dong", "/admin/vinh-danh", "/admin/diem-chuan", "/admin/diem-chuan/cong-thuc"];
check("menu quản trị khi tắt: không Tin tức & Blog, Video tham khảo, Cộng đồng, Bảng vinh danh, Điểm chuẩn, Công thức tính điểm", HIDDEN_ADMIN.every(h => !adminHrefs(OFF).includes(h)), HIDDEN_ADMIN.filter(h => adminHrefs(OFF).includes(h)));
check("menu quản trị khi tắt vẫn còn Hàng chờ, Lớp, Đề thi, Ngân hàng đề, Chữ trang chủ", ["/admin/kiem-duyet", "/admin/khoa-hoc", "/admin/thi-thu", "/admin/thi-thu/ngan-hang-de-thi", "/admin/trang-chu"].every(h => adminHrefs(OFF).includes(h)));
check("bật cả 9 cờ → menu quản trị có lại đủ 6 trang", HIDDEN_ADMIN.every(h => adminHrefs(ALL_ON).includes(h)));
check("matchSub vẫn nhận trang ẩn (mở thẳng thì sáng đúng module Học vụ)", matchSub("/admin/tin-tuc/abc")?.moduleKey === "hoc-vu" && matchSub("/admin/diem-chuan")?.moduleKey === "hoc-vu");

done();
