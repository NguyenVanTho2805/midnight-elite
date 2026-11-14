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
//  - Rà soát COO: thêm lại quy tắc "/mentor" → ca "hồ sơ từng gia sư /mentor/<id> vẫn mở" đỏ; bỏ dòng ngoại lệ classScopeOf trong blockedRouteFeature → ca "hỏi trong lớp" đỏ;
//    cho classScopeOf nhận "common" → ca "scope=common vẫn chặn" đỏ; đổi COIN_LOGIC_ON thành featureOn("COIN") → ca "logic Coin là hằng tắt" đỏ khi chạy với cờ COIN=1.
//  - LOI-07 (dấu ?tam-dong=, đã chạy 11/11/2026): pausedNoticeFrom bỏ kiểm `FEATURES.includes` (nhận mọi giá trị) → 2 đỏ ("rác / chữ thường / tên lạ → null", "nhiều giá trị");
//    bỏ kiểm `!featureOn(k, env)` → 1 đỏ ("phần đã mở lại thì không nhắc"); decideRoute bỏ `search: paused` ở nhánh khách → 4 đỏ ("307 về '/?tam-dong=…'");
//    decideRoute dùng `search || pausedSearch(...)` (mang tham số cũ theo) → 4 đỏ, có ca "tham số cũ / rác bị bỏ".
//  - DG (14/11/2026, đã chạy, 202 ca): bỏ nhánh `r.re` trong `matches` → 9 đỏ (bảng học phí lớp, điểm danh lớp: liên kết + chốt chặn); regex điểm danh không neo cuối
//    (`diem-danh/`) → 1 đỏ; "/student/thi-thu" thêm `sub: true` → 4 đỏ (phòng thi đề được giao bị chặn); /admin/doanh-thu `route: true` thay vì ["admin"] → 1 đỏ;
//    bỏ chốt DG ở nhánh tên miền admin của decideRoute → 3 đỏ; bỏ nhánh TUTOR_ROOT → 1 đỏ; landingPath bỏ featureOn("HOP_VIEC") → 4 đỏ.
import { FEATURES, featureEnvName, featureOn, hiddenLinkFeature, isLinkHidden, visibleLinks, blockedRouteFeature, mayBlockRoute, readFeatureEnv, classScopeOf, COIN_LOGIC_ON, PAUSED_PARAM, pausedSearch, pausedNoticeFrom, type FeatureEnv, type FeatureKey } from "@/lib/features";
import { decideRoute, needsSession, featureViewerOf, ADMIN_HOST, type RouteSession, type RouteDecision } from "@/lib/hostRouting";
import { landingPath } from "@/lib/landing";
import { homeNavFor, homeBlocksFor } from "@/lib/homeLayout";
import { visibleModules, matchSub } from "@/lib/adminNav";
import { check, section, done } from "./h";

const OFF: FeatureEnv = {};
const ALL_ON: FeatureEnv = Object.fromEntries(FEATURES.map(k => [k, "1"])) as FeatureEnv;
const only = (k: FeatureKey): FeatureEnv => ({ [k]: "1" });
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

section("Tên cờ và cách đọc");
check("đúng 17 phần (9 của LOI-01 + 8 của DG), đúng tên phiếu", FEATURES.join() === "TIM_GIA_SU,CONG_DONG,LICH,TIN_TUC,THU_VIEN,TIENG_ANH,XEP_HANG,COIN,DIEM_CHUAN,HOC_PHI,KINH_DOANH,DIEM_DANH,SO_DIEM,NHAC_HOC,HOP_VIEC,THI_THU_CONG_KHAI,VAN_HANH_PHU", FEATURES);
check("tên biến môi trường NEXT_PUBLIC_KIN_MO_<TÊN> (phòng Gia sư đọc NEXT_PUBLIC_KIN_MO_LICH)", featureEnvName("LICH") === "NEXT_PUBLIC_KIN_MO_LICH" && featureEnvName("TIM_GIA_SU") === "NEXT_PUBLIC_KIN_MO_TIM_GIA_SU");
check("readFeatureEnv đọc đủ 17 khoá", eq(Object.keys(readFeatureEnv()).sort(), [...FEATURES].sort()));
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
  check("mặc định (không đặt cờ nào): cả 17 phần đều ẩn", FEATURES.every(k => !featureOn(k)));
} else console.log(`  (bỏ qua ca "mặc định": máy đang đặt ${setFlags.map(featureEnvName).join(", ")})`);

section("Liên kết bị gỡ (menu, chân trang, bản đồ, sitemap)");
const LINKS: [string, FeatureKey][] = [
  ["/giang-vien", "TIM_GIA_SU"], ["/giang-vien?mon=toan", "TIM_GIA_SU"], ["/giang-vien/x", "TIM_GIA_SU"],
  ["/cong-dong", "CONG_DONG"], ["/cong-dong?tab=hoi-dap-qa", "CONG_DONG"], ["/cong-dong/hoi-dap/q1", "CONG_DONG"], ["/cong-dong/ho-so/u1", "CONG_DONG"], ["/student/cong-dong", "CONG_DONG"], ["/student/hoi-dap", "CONG_DONG"],
  ["/lop-cua-toi/kiem-duyet", "CONG_DONG"], ["/admin/cong-dong", "CONG_DONG"],
  ["/lop-cua-toi/lich", "LICH"], ["/lop-cua-toi/lich/khung?lop=x", "LICH"], ["/student/lich-hoc", "LICH"],
  ["/tin-tuc", "TIN_TUC"], ["/tin-tuc/bai-1", "TIN_TUC"], ["/student/tin-tuc", "TIN_TUC"], ["/admin/tin-tuc", "TIN_TUC"],
  ["/thu-vien", "THU_VIEN"], ["/thu-vien#c-abc", "THU_VIEN"], ["/admin/thu-vien-video", "THU_VIEN"],
  ["/student/tieng-anh", "TIENG_ANH"], ["/student/tieng-anh/doc/1", "TIENG_ANH"],
  ["/bang-xep-hang", "XEP_HANG"], ["/student/bang-xep-hang", "XEP_HANG"], ["/vinh-danh", "XEP_HANG"], ["/admin/vinh-danh", "XEP_HANG"],
  ["/student/vi", "COIN"], ["/admin/topups", "COIN"],
  ["/diem-chuan", "DIEM_CHUAN"], ["/tra-cuu", "DIEM_CHUAN"], ["/student/tra-cuu", "DIEM_CHUAN"], ["/admin/diem-chuan/cong-thuc", "DIEM_CHUAN"],
  // DG (14/11/2026)
  ["/lop-cua-toi/hoc-phi", "HOC_PHI"], ["/lop-cua-toi/hoc-phi?tab=doi-soat", "HOC_PHI"], ["/lop-cua-toi/hoc-phi/thang", "HOC_PHI"], ["/student/hoc-phi", "HOC_PHI"],
  ["/lop-cua-toi/c1/bang-hoc-phi", "HOC_PHI"], ["/lop-cua-toi/c1/bang-hoc-phi/nhap", "HOC_PHI"],
  ["/lop-cua-toi/doanh-thu", "KINH_DOANH"], ["/lop-cua-toi/goi", "KINH_DOANH"], ["/admin/doanh-thu", "KINH_DOANH"], ["/admin/goi-pro", "KINH_DOANH"],
  ["/lop-cua-toi/quan-lop/c1/diem-danh", "DIEM_DANH"], ["/lop-cua-toi/quan-lop/c1/diem-danh/in?month=2026-11", "DIEM_DANH"],
  ["/lop-cua-toi/so-diem", "SO_DIEM"], ["/lop-cua-toi/bao-cao-thang", "SO_DIEM"], ["/lop-cua-toi/bao-cao-thang/in", "SO_DIEM"],
  ["/student/nhac-hoc", "NHAC_HOC"], ["/lop-cua-toi/tong-quan", "HOP_VIEC"],
  ["/thi-thu", "THI_THU_CONG_KHAI"], ["/thi-thu?mon=toan", "THI_THU_CONG_KHAI"], ["/student/thi-thu", "THI_THU_CONG_KHAI"],
  ["/admin/pheu", "VAN_HANH_PHU"], ["/admin/so-do", "VAN_HANH_PHU"], ["/admin/danh-gia", "VAN_HANH_PHU"], ["/admin/trang-chu", "VAN_HANH_PHU"], ["/admin/trang-chu/xem-truoc", "VAN_HANH_PHU"],
  ["/lop-cua-toi/bai-dang", "TIM_GIA_SU"], ["/lop-cua-toi/yeu-cau", "TIM_GIA_SU"],
];
for (const [href, k] of LINKS) {
  check(`${href} → ẩn theo ${k} khi tắt, hiện khi bật đúng ${k}`, hiddenLinkFeature(href, OFF) === k && !isLinkHidden(href, only(k)), hiddenLinkFeature(href, OFF));
}
// DG (14/11/2026): ĐỔI CÓ CHỦ ĐÍCH — /thi-thu, /student/thi-thu, /student/hoc-phi, /lop-cua-toi/hoc-phi, /lop-cua-toi/yeu-cau, /lop-cua-toi/bai-dang, /lop-cua-toi/so-diem,
// /admin/trang-chu rời danh sách này (nay thuộc cờ mới, xem LINKS). Thêm các đường dạy học PHẢI còn: phòng thi đề được giao, trang lớp gia sư, tab Học sinh / Lịch học / Cài đặt.
const KEEP = ["/", "/khoa-hoc", "/khoa-hoc?gia=free", "/student/thi-thu/de-1", "/student/thi-thu/de-1?lan=2", "/student/viec-cua-toi", "/student/hoc-tap", "/student/hoc-tap?course=c1", "/student/bai-giang/b1", "/student/ho-so", "/student/nhap-ma-lop",
  "/lop-cua-toi", "/lop-cua-toi/lop", "/lop-cua-toi/lop/tao", "/lop-cua-toi/bai-tap", "/lop-cua-toi/ho-so", "/lop-cua-toi/cai-dat", "/lop-cua-toi/ho-tro", "/lop-cua-toi/hoc-sinh", "/lop-cua-toi/de-thi", "/lop-cua-toi/de-thi/ngan-hang-de-thi",
  "/lop-cua-toi/quan-lop/c1", "/lop-cua-toi/quan-lop/c1?tab=cai-dat", "/lop-cua-toi/quan-lop/c1/hoc-vien", "/lop-cua-toi/quan-lop/c1/lich-hoc", "/lop-cua-toi/quan-lop/c1/giao-trinh", "/lop-cua-toi/c1", "/lop-cua-toi/c1/ban-ghi",
  "/lop-cua-toi/hoc-phix", "/lop-cua-toi/c1/bang-hoc-phix", "/lop-cua-toi/quan-lop/c1/diem-danhx", "/thi-thux", "/student/thi-thux",
  "/admin", "/admin/kiem-duyet", "/admin/gia-su", "/admin/hoc-sinh", "/admin/quan-tri-vien", "/admin/khoa-hoc/danh-muc", "/admin/thi-thu/ngan-hang-cau-hoi", "/admin/nhat-ky", "/admin/trien-khai", "/admin/ho-tro",
  "/admin/thi-thu", "/admin/khoa-hoc", "/dang-ky", "/dang-nhap", "/phu-huynh", "/ban-do",
  "/cong-dong/t123", "/cong-dong/t123#r-9", "/yeu-cau/abc", "/mentor/abc", "/mentor/abc/yeu-cau", "/mentor/abc?tab=lop", "/lich", "/giang-vienx", "/tin-tucx", "/thu-vienx", "https://zalo.me/x", "tel:0384", "//evil.com/giang-vien"];
check("đường giữ nguyên (Thi thử, đề, Lớp, Bài tập, Học phí, Hộp việc, Hồ sơ, Cài đặt, Nhập mã lớp…) không bao giờ bị gỡ", KEEP.every(h => !isLinkHidden(h, OFF)), KEEP.filter(h => isLinkHidden(h, OFF)));
check("bật mọi cờ → không liên kết nào bị gỡ", LINKS.every(([h]) => !isLinkHidden(h, ALL_ON)), LINKS.filter(([h]) => isLinkHidden(h, ALL_ON)));
const items = [{ href: "/khoa-hoc", label: "a" }, { href: "/giang-vien", label: "b" }, { href: "/lop-cua-toi/lop", label: "c" }, { href: "/tin-tuc", label: "d" }];
check("visibleLinks giữ thứ tự, bỏ đúng mục ẩn", visibleLinks(items, OFF).map(i => i.label).join() === "a,c" && visibleLinks(items, only("TIN_TUC")).map(i => i.label).join() === "a,c,d" && visibleLinks(items, ALL_ON).length === 4);

section("Chốt chặn route (blockedRouteFeature)");
const VIEWERS = ["guest", "student", "tutor", "admin"] as const;
const BLOCKED: [string, FeatureKey][] = [
  ["/giang-vien", "TIM_GIA_SU"], ["/giang-vien/x", "TIM_GIA_SU"],
  ["/cong-dong", "CONG_DONG"], ["/cong-dong/hoi-dap/q1", "CONG_DONG"], ["/cong-dong/ho-so/u1", "CONG_DONG"], ["/student/cong-dong", "CONG_DONG"], ["/student/hoi-dap", "CONG_DONG"], ["/student/hoi-dap/q1", "CONG_DONG"],
  ["/tin-tuc", "TIN_TUC"], ["/tin-tuc/bai-1", "TIN_TUC"], ["/student/tin-tuc", "TIN_TUC"],
  ["/student/tieng-anh", "TIENG_ANH"], ["/student/tieng-anh/tu-vung/on", "TIENG_ANH"],
  ["/bang-xep-hang", "XEP_HANG"], ["/student/bang-xep-hang", "XEP_HANG"], ["/vinh-danh", "XEP_HANG"],
  ["/diem-chuan", "DIEM_CHUAN"], ["/diem-chuan/x", "DIEM_CHUAN"], ["/tra-cuu", "DIEM_CHUAN"], ["/student/tra-cuu", "DIEM_CHUAN"],
  // DG (14/11/2026): trang gia sư / học sinh / khách của phần mới — chặn với MỌI vai.
  ["/lop-cua-toi/hoc-phi", "HOC_PHI"], ["/lop-cua-toi/hoc-phi/thang", "HOC_PHI"], ["/student/hoc-phi", "HOC_PHI"], ["/lop-cua-toi/c1/bang-hoc-phi/nhap", "HOC_PHI"],
  ["/lop-cua-toi/doanh-thu", "KINH_DOANH"], ["/lop-cua-toi/goi", "KINH_DOANH"], ["/lop-cua-toi/quan-lop/c1/diem-danh", "DIEM_DANH"], ["/lop-cua-toi/quan-lop/c1/diem-danh/in", "DIEM_DANH"],
  ["/lop-cua-toi/so-diem", "SO_DIEM"], ["/lop-cua-toi/bao-cao-thang/in", "SO_DIEM"], ["/student/nhac-hoc", "NHAC_HOC"], ["/lop-cua-toi/tong-quan", "HOP_VIEC"],
  ["/thi-thu", "THI_THU_CONG_KHAI"], ["/student/thi-thu", "THI_THU_CONG_KHAI"], ["/lop-cua-toi/bai-dang", "TIM_GIA_SU"], ["/lop-cua-toi/yeu-cau", "TIM_GIA_SU"],
];
for (const [p, k] of BLOCKED) {
  check(`${p}: mọi vai bị chặn khi ${k} tắt; mở lại khi ${k}=1`, VIEWERS.every(v => blockedRouteFeature(p, v, OFF) === k) && VIEWERS.every(v => blockedRouteFeature(p, v, only(k)) === null));
}
check("/cong-dong/<id> (câu hỏi trong lớp) KHÔNG bị chặn ở proxy — trang tự kiểm courseId", VIEWERS.every(v => blockedRouteFeature("/cong-dong/t123", v, OFF) === null));
check("hồ sơ từng gia sư /mentor/<id>, /mentor/<id>/yeu-cau vẫn mở cho mọi vai (link đã chia sẻ không chết); chỉ sàn /giang-vien bị chặn", ["/mentor/abc", "/mentor/abc/yeu-cau"].every(p => VIEWERS.every(v => blockedRouteFeature(p, v, OFF) === null)) && !mayBlockRoute("/mentor/abc", OFF));

section("Hỏi trong lớp: /cong-dong?scope=<mã lớp> khi bảng tin ẩn");
check("classScopeOf: nhận đúng mã lớp; bỏ all / common / rác / tab Đã lưu / không có scope", classScopeOf("?scope=lop-1") === "lop-1" && classScopeOf("tab=hoi-dap&scope=abc_9") === "abc_9"
  && [null, "", "?tab=all", "?scope=all", "?scope=common", "?scope=a%20b", "?scope=lop-1&tab=da-luu", `?scope=${"x".repeat(65)}`].every(q => classScopeOf(q) === null));
check("học sinh / gia sư mở /cong-dong?scope=<lớp> → cho qua (quyền thành viên lớp do API quyết)", ["student", "tutor"].every(v => blockedRouteFeature("/cong-dong", v as "student", OFF, "?scope=lop-1") === null && blockedRouteFeature("/cong-dong", v as "student", OFF, "?tab=hoi-dap&scope=lop-1") === null));
check("khách / quản trị mở /cong-dong?scope=<lớp> → vẫn chặn", blockedRouteFeature("/cong-dong", "guest", OFF, "?scope=lop-1") === "CONG_DONG" && blockedRouteFeature("/cong-dong", "admin", OFF, "?scope=lop-1") === "CONG_DONG");
check("scope=all / common / Đã lưu / không scope → bảng tin chung vẫn chặn với học sinh", ["", "?scope=all", "?scope=common", "?scope=lop-1&tab=da-luu", "?tab=hoi-dap-qa"].every(q => blockedRouteFeature("/cong-dong", "student", OFF, q) === "CONG_DONG"));
check("ngoại lệ chỉ ở đúng /cong-dong: /cong-dong/hoi-dap?scope=lop-1 vẫn chặn", blockedRouteFeature("/cong-dong/hoi-dap/q1", "student", OFF, "?scope=lop-1") === "CONG_DONG");

section("LOI-07: dấu ?tam-dong=<CỜ> cho dòng nhắc ở trang đích (pausedNoticeFrom)");
check("tên tham số 'tam-dong'; pausedSearch dựng đúng chuỗi", PAUSED_PARAM === "tam-dong" && pausedSearch("CONG_DONG") === "?tam-dong=CONG_DONG");
check("đọc đúng tên cờ đang tắt, có / không dấu '?', lẫn tham số khác", FEATURES.every(k => pausedNoticeFrom(`?tam-dong=${k}`, OFF) === k) && pausedNoticeFrom("tam-dong=TIN_TUC", OFF) === "TIN_TUC" && pausedNoticeFrom("?a=1&tam-dong=CONG_DONG&b=2", OFF) === "CONG_DONG");
check("rác / chữ thường / tên lạ / rỗng / thiếu → null", [null, undefined, "", "?", "?tam-dong=", "?tam-dong=cong_dong", "?tam-dong=CONG_DONG_X", "?tam-dong=%3Cscript%3E", "?tam-dong=__proto__", "?tam-dong=constructor", "?tamdong=CONG_DONG", "?tam-dong= CONG_DONG", "?x=CONG_DONG"].every(q => pausedNoticeFrom(q as string, OFF) === null));
check("phần đã mở lại (cờ =1) thì không nhắc nữa (null)", pausedNoticeFrom("?tam-dong=CONG_DONG", only("CONG_DONG")) === null && FEATURES.every(k => pausedNoticeFrom(`?tam-dong=${k}`, ALL_ON) === null));
check("nhiều giá trị: chỉ xét giá trị đầu", pausedNoticeFrom("?tam-dong=TIN_TUC&tam-dong=rac", OFF) === "TIN_TUC" && pausedNoticeFrom("?tam-dong=rac&tam-dong=TIN_TUC", OFF) === null);
check("dấu chỉ để hiển thị: không làm đường nào bị chặn / cho qua khác đi", blockedRouteFeature("/khoa-hoc", "student", OFF, "?tam-dong=CONG_DONG") === null && blockedRouteFeature("/cong-dong", "student", OFF, "?tam-dong=CONG_DONG") === "CONG_DONG");

section("Coin: hiển thị theo cờ, logic là hằng");
check("logic Coin (trừ xu khi hỏi, hàng chờ nạp) là hằng TẮT — không đọc biến môi trường, kể cả khi NEXT_PUBLIC_KIN_MO_COIN=1", COIN_LOGIC_ON === false);
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
  // LOI-07: ĐỔI CÓ CHỦ ĐÍCH — bỏ tham số cũ, chỉ gắn dấu ?tam-dong=<CỜ> cho dòng nhắc "Phần này đang tạm đóng." ở trang đích.
  check("khách mở /giang-vien?mon=toan → 307 về '/?tam-dong=TIM_GIA_SU' (bỏ tham số cũ)", eq(d("/giang-vien", null, "?mon=toan"), { kind: "redirect", status: 307, pathname: "/", search: "?tam-dong=TIM_GIA_SU" }), d("/giang-vien", null, "?mon=toan"));
  check("học sinh mở /giang-vien → 307 về Việc của tôi ?tam-dong=TIM_GIA_SU", eq(d("/giang-vien", student), { kind: "redirect", status: 307, pathname: "/student/viec-cua-toi", search: "?tam-dong=TIM_GIA_SU" }), d("/giang-vien", student));
  check("mọi vai mở /mentor/abc → next (hồ sơ từng gia sư vẫn mở)", [null, student, tutor].every(s => eq(d("/mentor/abc", s), { kind: "next" })));
  // DG: đích của gia sư theo landingPath — Hộp việc ẩn (HOP_VIEC tắt) thì thư viện Lớp.
  const tutorHome = featureOn("HOP_VIEC") ? "/lop-cua-toi" : "/lop-cua-toi/lop";
  check(`gia sư mở /giang-vien → 307 về trang đầu gia sư (${tutorHome}) ?tam-dong=TIM_GIA_SU`, eq(d("/giang-vien", tutor), { kind: "redirect", status: 307, pathname: tutorHome, search: "?tam-dong=TIM_GIA_SU" }), d("/giang-vien", tutor));
  check("quản trị mở /giang-vien ở tên miền chính → 307 thẳng sang /admin?tam-dong=TIM_GIA_SU ở tên miền admin", eq(d("/giang-vien", sup), { kind: "redirect", status: 307, host: "admin", pathname: "/admin", search: "?tam-dong=TIM_GIA_SU" }), d("/giang-vien", sup));
  check("cần giải mã phiên ở đường bị chặn (đích theo vai); /mentor/x không tốn giải mã", needsSession(MAIN, "/giang-vien") && !needsSession(MAIN, "/mentor/x"));
} else console.log("  (máy đang bật TIM_GIA_SU: bỏ qua ca chặn /giang-vien)");
if (!featureOn("CONG_DONG")) {
  check("khách mở /cong-dong?tab=hoi-dap-qa → 307 về '/?tam-dong=CONG_DONG'", eq(d("/cong-dong", null, "?tab=hoi-dap-qa"), { kind: "redirect", status: 307, pathname: "/", search: "?tam-dong=CONG_DONG" }));
  check("/cong-dong/<id> cho qua (trang tự xử lý bài lớp / bài chung)", VIEWERS.length === 4 && [null, student, tutor].every(s => eq(d("/cong-dong/t1", s), { kind: "next" })));
  check("decideRoute: học sinh / gia sư mở /cong-dong?scope=lop-1 → next; khách → '/'; học sinh mở /cong-dong?scope=common → Việc của tôi",
    eq(d("/cong-dong", student, "?scope=lop-1"), { kind: "next" }) && eq(d("/cong-dong", tutor, "?tab=hoi-dap&scope=lop-1"), { kind: "next" })
    && eq(d("/cong-dong", null, "?scope=lop-1"), { kind: "redirect", status: 307, pathname: "/", search: "?tam-dong=CONG_DONG" }) && eq(d("/cong-dong", student, "?scope=common"), { kind: "redirect", status: 307, pathname: "/student/viec-cua-toi", search: "?tam-dong=CONG_DONG" }));
  check("câu hỏi cũ /student/hoi-dap/<id> (thông báo cũ) → Việc của tôi ?tam-dong=CONG_DONG", eq(d("/student/hoi-dap/q1", student), { kind: "redirect", status: 307, pathname: "/student/viec-cua-toi", search: "?tam-dong=CONG_DONG" }), d("/student/hoi-dap/q1", student));
}
if (!featureOn("TIN_TUC")) {
  check("bài tin tức cũ /tin-tuc/<bài>: khách → '/?tam-dong=TIN_TUC', học sinh → Việc của tôi ?tam-dong=TIN_TUC", eq(d("/tin-tuc/bai-1", null), { kind: "redirect", status: 307, pathname: "/", search: "?tam-dong=TIN_TUC" }) && eq(d("/tin-tuc/bai-1", student), { kind: "redirect", status: 307, pathname: "/student/viec-cua-toi", search: "?tam-dong=TIN_TUC" }));
  // Ca phá cố ý: tham số rác (kể cả một ?tam-dong= giả) KHÔNG được mang theo — đích chỉ có đúng dấu của phần thật sự bị chặn.
  check("tham số cũ / rác (?tam-dong=<script>, ?tam-dong=COIN&x=1) bị bỏ: đích chỉ có '?tam-dong=TIN_TUC'", ["?tam-dong=%3Cscript%3E", "?tam-dong=COIN&x=1", "?x=1&tam-dong=CONG_DONG"].every(q => { const r = d("/tin-tuc", student, q); return r.kind === "redirect" && r.search === "?tam-dong=TIN_TUC"; }));
}
check("mọi chuyển hướng LOI-01 là 307 (không 308)", [...BLOCKED.map(([p]) => p), "/thu-vien"].every(p => [null, student, tutor, sup].every(s => { const r = d(p, s); return r.kind !== "redirect" || r.status === 307; })));
check("đường không thuộc phần ẩn → next như trước (Lớp, phòng thi đề được giao, Lịch, câu hỏi lớp, trang lớp gia sư)", ["/khoa-hoc", "/student/thi-thu/de-1", "/lop-cua-toi/lich", "/student/lich-hoc", "/cong-dong/t1", "/lop-cua-toi/quan-lop/c1", "/lop-cua-toi/quan-lop/c1/hoc-vien"].every(p => [null, student, tutor].every(s => eq(d(p, s), { kind: "next" }))));
check("/khoa-hoc không cần giải mã phiên (không tốn gì thêm)", !needsSession(MAIN, "/khoa-hoc") && !needsSession(MAIN, "/lop-cua-toi/lich"));

section("Nơi dùng: thanh trên, khối trang chủ, menu quản trị");
const nav = (env: FeatureEnv, kind: "guest" | "student" = "guest") => homeNavFor({ kind }, env).map(i => i.label).join();
// DG: ĐỔI CÓ CHỦ ĐÍCH — "Thi thử" rời thanh trên theo cờ THI_THU_CONG_KHAI.
check("thanh trên khi tắt hết: chỉ Lớp học (học sinh thêm Lớp của tôi)", nav(OFF) === "Lớp học" && nav(OFF, "student") === "Lớp học,Lớp của tôi", [nav(OFF), nav(OFF, "student")]);
check("bật mọi cờ → đủ 4 mục như cũ", nav(ALL_ON) === "Lớp học,Thi thử,Cộng đồng,Tin tức");
check("bật riêng TIN_TUC → chỉ thêm Tin tức; riêng THI_THU_CONG_KHAI → chỉ thêm Thi thử", nav(only("TIN_TUC")) === "Lớp học,Tin tức" && nav(only("THI_THU_CONG_KHAI")) === "Lớp học,Thi thử");
const blocks = (env: FeatureEnv) => homeBlocksFor({ kind: "guest" }, { quiz: true }, env);
check("trang chủ khi tắt: không bảng tin, không quiz (nằm trong bảng tin), không tính điểm", !blocks(OFF).community && !blocks(OFF).quiz && !blocks(OFF).score);
check("bật CONG_DONG + DIEM_CHUAN → bảng tin, quiz, tính điểm như cũ", blocks({ CONG_DONG: "1", DIEM_CHUAN: "1" }).community && blocks({ CONG_DONG: "1", DIEM_CHUAN: "1" }).quiz && blocks({ CONG_DONG: "1", DIEM_CHUAN: "1" }).score);
const adminHrefs = (env: FeatureEnv) => visibleModules("admin_super", env).flatMap(m => m.subs.map(s => s.href));
const HIDDEN_ADMIN = ["/admin/tin-tuc", "/admin/thu-vien-video", "/admin/cong-dong", "/admin/vinh-danh", "/admin/diem-chuan", "/admin/diem-chuan/cong-thuc"];
check("menu quản trị khi tắt: không Tin tức & Blog, Video tham khảo, Cộng đồng, Bảng vinh danh, Điểm chuẩn, Công thức tính điểm", HIDDEN_ADMIN.every(h => !adminHrefs(OFF).includes(h)), HIDDEN_ADMIN.filter(h => adminHrefs(OFF).includes(h)));
// DG (14/11/2026): giữ đúng danh sách chủ chốt; ẩn Doanh thu, Gói KiN Pro, Phễu gia sư, Số đo sản phẩm, Lịch sử đánh giá, Chữ trang chủ.
const DG_KEEP_ADMIN = ["/admin/kiem-duyet", "/admin/gia-su", "/admin/hoc-sinh", "/admin/quan-tri-vien", "/admin/khoa-hoc", "/admin/khoa-hoc/danh-muc", "/admin/thi-thu", "/admin/thi-thu/ngan-hang-cau-hoi",
  "/admin/thi-thu/ngan-hang-de-thi", "/admin/nhat-ky", "/admin/trien-khai", "/admin/ho-tro"];
const DG_HIDDEN_ADMIN = ["/admin/doanh-thu", "/admin/goi-pro", "/admin/pheu", "/admin/so-do", "/admin/danh-gia", "/admin/trang-chu"];
check("menu quản trị khi tắt: CHỈ còn Hàng chờ, Gia sư, Học sinh, Quản trị viên, Lớp, Danh mục lớp, Đề thi, Ngân hàng câu hỏi, Ngân hàng đề, Nhật ký, Triển khai, Hỗ trợ gia sư",
  eq(adminHrefs(OFF), DG_KEEP_ADMIN), adminHrefs(OFF));
check("menu quản trị khi tắt: không Doanh thu, Gói KiN Pro, Phễu gia sư, Số đo, Lịch sử đánh giá, Chữ trang chủ", DG_HIDDEN_ADMIN.every(h => !adminHrefs(OFF).includes(h)));
check("bật mọi cờ → menu quản trị có lại đủ các trang đã ẩn", [...HIDDEN_ADMIN, ...DG_HIDDEN_ADMIN].every(h => adminHrefs(ALL_ON).includes(h)));
check("bật riêng KINH_DOANH → Doanh thu + Gói KiN Pro trở lại; riêng VAN_HANH_PHU → bốn trang vận hành phụ trở lại", ["/admin/doanh-thu", "/admin/goi-pro"].every(h => adminHrefs(only("KINH_DOANH")).includes(h)) && !adminHrefs(only("KINH_DOANH")).includes("/admin/pheu")
  && ["/admin/pheu", "/admin/so-do", "/admin/danh-gia", "/admin/trang-chu"].every(h => adminHrefs(only("VAN_HANH_PHU")).includes(h)));
check("matchSub vẫn nhận trang ẩn (mở thẳng thì sáng đúng module Học vụ)", matchSub("/admin/tin-tuc/abc")?.moduleKey === "hoc-vu" && matchSub("/admin/diem-chuan")?.moduleKey === "hoc-vu");

section("DG (14/11/2026): tám cờ mới — vai, tên miền admin, trang đầu gia sư");
check("trang quản trị của phần mới chỉ chặn VAI QUẢN TRỊ (khách / học sinh / gia sư ở tên miền chính đã có luật riêng của /admin)", ["/admin/doanh-thu", "/admin/goi-pro", "/admin/pheu", "/admin/so-do", "/admin/danh-gia", "/admin/trang-chu"]
  .every(p => blockedRouteFeature(p, "admin", OFF) !== null && ["guest", "student", "tutor"].every(v => blockedRouteFeature(p, v as "guest", OFF) === null)));
check("phòng thi đề được giao /student/thi-thu/<mã> KHÔNG bị chặn với mọi vai; chỉ danh sách /thi-thu, /student/thi-thu", VIEWERS.every(v => blockedRouteFeature("/student/thi-thu/de-1", v, OFF) === null && blockedRouteFeature("/student/thi-thu/de-1/ket-qua", v, OFF) === null)
  && !mayBlockRoute("/student/thi-thu/de-1", OFF));
check("trang lớp gia sư (Bài học, Học sinh, Lịch học, Cài đặt) không bị chặn; chỉ …/diem-danh", ["/lop-cua-toi/quan-lop/c1", "/lop-cua-toi/quan-lop/c1/hoc-vien", "/lop-cua-toi/quan-lop/c1/lich-hoc", "/lop-cua-toi/quan-lop/c1/giao-trinh"].every(p => blockedRouteFeature(p, "tutor", OFF) === null)
  && blockedRouteFeature("/lop-cua-toi/quan-lop/c1/diem-danh", "tutor", OFF) === "DIEM_DANH" && blockedRouteFeature("/lop-cua-toi/quan-lop/c1/diem-danh", "tutor", only("DIEM_DANH")) === null);
check("gốc /lop-cua-toi KHÔNG là quy tắc đường (logo / liên kết cũ không bị gỡ); Hộp việc xử lý ở landingPath + decideRoute", !isLinkHidden("/lop-cua-toi", OFF) && !mayBlockRoute("/lop-cua-toi", OFF));
check("bật riêng từng cờ mới → route của nó mở lại, cờ khác vẫn chặn", (["HOC_PHI", "KINH_DOANH", "SO_DIEM", "NHAC_HOC", "HOP_VIEC", "THI_THU_CONG_KHAI"] as FeatureKey[]).every(k => {
  const mine = BLOCKED.filter(([, f]) => f === k), other = BLOCKED.filter(([, f]) => f !== k);
  return mine.length > 0 && mine.every(([p]) => blockedRouteFeature(p, "student", only(k)) === null) && other.every(([p, f]) => blockedRouteFeature(p, "student", only(k)) === f);
}));
const AD = (pathname: string, s: RouteSession | null, search = ""): RouteDecision => decideRoute({ host: ADMIN_HOST, pathname, search, session: s });
if (!featureOn("KINH_DOANH") && !featureOn("VAN_HANH_PHU")) {
  check("tên miền admin: quản trị mở /admin/doanh-thu → 307 về /admin?tam-dong=KINH_DOANH", eq(AD("/admin/doanh-thu", sup), { kind: "redirect", status: 307, pathname: "/admin", search: "?tam-dong=KINH_DOANH" }), AD("/admin/doanh-thu", sup));
  check("tên miền admin: /admin/goi-pro?x=1, /admin/pheu, /admin/so-do, /admin/danh-gia, /admin/trang-chu/xem-truoc → 307 về /admin (bỏ tham số cũ)", [["/admin/goi-pro", "KINH_DOANH"], ["/admin/pheu", "VAN_HANH_PHU"], ["/admin/so-do", "VAN_HANH_PHU"], ["/admin/danh-gia", "VAN_HANH_PHU"], ["/admin/trang-chu/xem-truoc", "VAN_HANH_PHU"]]
    .every(([p, k]) => eq(AD(p, sup, "?x=1"), { kind: "redirect", status: 307, pathname: "/admin", search: `?tam-dong=${k}` })));
  check("tên miền admin: API /api/admin/analytics, /admin, /admin/kiem-duyet, /admin/khoa-hoc vẫn next", ["/api/admin/analytics", "/admin/kiem-duyet", "/admin/khoa-hoc", "/admin/thi-thu", "/admin/nhat-ky"].every(p => eq(AD(p, sup), { kind: "next" })) && eq(AD("/admin", sup), { kind: "next" }));
  check("tên miền admin: CHƯA đăng nhập mở /admin/doanh-thu → next (trang tự đưa tới cửa đăng nhập, giữ ?redirect= như cũ)", eq(AD("/admin/doanh-thu", null), { kind: "next" }));
} else console.log("  (máy đang bật KINH_DOANH/VAN_HANH_PHU: bỏ qua ca tên miền admin)");
if (!featureOn("HOP_VIEC")) {
  check("landingPath gia sư = thư viện Lớp /lop-cua-toi/lop khi Hộp việc ẩn; quản trị /admin; học sinh Việc của tôi", landingPath("admin", "teacher") === "/lop-cua-toi/lop" && landingPath("admin", "admin_super") === "/admin" && landingPath("student") === "/student/viec-cua-toi");
  check("gia sư mở gốc /lop-cua-toi → 307 sang /lop-cua-toi/lop (bỏ tham số); học sinh / khách / quản trị không đổi", eq(d("/lop-cua-toi", tutor, "?x=1"), { kind: "redirect", status: 307, pathname: "/lop-cua-toi/lop" })
    && eq(d("/lop-cua-toi", student), { kind: "next" }) && eq(d("/lop-cua-toi", null), { kind: "next" }));
  check("gốc /lop-cua-toi cần giải mã phiên (để biết gia sư); /lop-cua-toi/lop thì không", needsSession(MAIN, "/lop-cua-toi") && !needsSession(MAIN, "/lop-cua-toi/lop"));
  check("gia sư mở /admin (không bí danh) ở tên miền chính → 307 về trang đầu gia sư /lop-cua-toi/lop", eq(d("/admin", tutor), { kind: "redirect", status: 307, pathname: "/lop-cua-toi/lop" }), d("/admin", tutor));
  check("gia sư mở /lop-cua-toi/hoc-phi → 307 về /lop-cua-toi/lop?tam-dong=HOC_PHI; học sinh mở /student/hoc-phi → Việc của tôi", eq(d("/lop-cua-toi/hoc-phi", tutor, "?tab=doi-soat"), { kind: "redirect", status: 307, pathname: "/lop-cua-toi/lop", search: "?tam-dong=HOC_PHI" })
    && eq(d("/student/hoc-phi", student), { kind: "redirect", status: 307, pathname: "/student/viec-cua-toi", search: "?tam-dong=HOC_PHI" }));
  check("khách mở /thi-thu → 307 về '/?tam-dong=THI_THU_CONG_KHAI'; học sinh mở /student/thi-thu/de-1 → next", eq(d("/thi-thu", null), { kind: "redirect", status: 307, pathname: "/", search: "?tam-dong=THI_THU_CONG_KHAI" }) && eq(d("/student/thi-thu/de-1", student), { kind: "next" }));
} else console.log("  (máy đang bật HOP_VIEC: bỏ qua ca trang đầu gia sư)");

done();
