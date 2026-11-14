// Cờ giao diện tập trung. Chỉ điều khiển phần HIỂN THỊ và LỐI VÀO; không đụng bảng, cột, API hay logic ghi. THUẦN: không Prisma, không node:*, không React.
//
// LOI-01 (11/11/2026, lời chủ: "xây web dùng trước mắt đáp ứng nhu cầu dạy học, kết nối học sinh; sau này mở rộng riêng từng tính năng"):
// chín phần dưới đây mặc định ẨN ở cả ba vai (học sinh, gia sư, quản trị) và với khách. Không xoá trang / component / route nào — chỉ gỡ lối vào
// (menu, trang chủ, chân trang, sitemap) và, với các route công khai, chốt chặn 307 + no-store ở src/proxy.ts (src/lib/hostRouting.ts gọi `blockedRouteFeature`).
// Bật lại một phần: đặt `NEXT_PUBLIC_KIN_MO_<TÊN>=1` (vd NEXT_PUBLIC_KIN_MO_LICH=1) rồi dựng lại — biến NEXT_PUBLIC_ được nhúng lúc dựng ở mã máy khách.
// Một nguồn duy nhất cho menu, trang chủ, sitemap và chốt chặn route: thêm đường dẫn ở `PATH_RULES`, đừng viết danh sách riêng ở chỗ khác.
// Test: tools/local-e2e/t-features-lib.ts.
//
// DG (14/11/2026, chủ: "đơn giản hoá, chỉ giữ tính năng dạy học" — ẨN BẰNG CỜ, KHÔNG XOÁ MÃ, không đổi dữ liệu): thêm tám phần, cũng mặc định ẨN:
//   HOC_PHI (học phí: module gia sư, phiếu của học sinh, bảng học phí lớp, mục Học phí ở Cài đặt lớp, dòng học phí ở Hộp việc, tin đẩy học phí),
//   KINH_DOANH (doanh thu, gói KiN Pro — quản trị và gia sư), DIEM_DANH (tab Điểm danh của lớp), SO_DIEM (sổ điểm + báo cáo tháng),
//   NHAC_HOC (Nhắc học của học sinh), HOP_VIEC (Hộp việc + Tổng quan của gia sư: trang đầu gia sư thành thư viện Lớp),
//   THI_THU_CONG_KHAI (danh sách thi thử công khai /thi-thu; đề được giao trong lớp /student/thi-thu/<mã đề> KHÔNG chặn),
//   VAN_HANH_PHU (quản trị: phễu gia sư, số đo sản phẩm, lịch sử đánh giá, chữ trang chủ).
//   Chỉ HIỂN THỊ + lối vào + chốt 307: không đụng logic tính tiền, API học phí, webhook, schema.
export const FEATURES = ["TIM_GIA_SU", "CONG_DONG", "LICH", "TIN_TUC", "THU_VIEN", "TIENG_ANH", "XEP_HANG", "COIN", "DIEM_CHUAN",
  "HOC_PHI", "KINH_DOANH", "DIEM_DANH", "SO_DIEM", "NHAC_HOC", "HOP_VIEC", "THI_THU_CONG_KHAI", "VAN_HANH_PHU"] as const;
export type FeatureKey = (typeof FEATURES)[number];
export type FeatureEnv = Partial<Record<FeatureKey, string | undefined>>;

/** Tên biến môi trường bật lại một phần (phòng Gia sư đọc đúng tên này cho LICH ở nhánh khác). */
export const featureEnvName = (k: FeatureKey): string => `NEXT_PUBLIC_KIN_MO_${k}`;

/** Đọc cờ từ môi trường. Mỗi biến viết NGUYÊN VĂN `process.env.NEXT_PUBLIC_…` để Next nhúng được vào mã máy khách (truy cập theo khoá động thì không nhúng). */
export function readFeatureEnv(): FeatureEnv {
  return {
    TIM_GIA_SU: process.env.NEXT_PUBLIC_KIN_MO_TIM_GIA_SU,
    CONG_DONG: process.env.NEXT_PUBLIC_KIN_MO_CONG_DONG,
    LICH: process.env.NEXT_PUBLIC_KIN_MO_LICH,
    TIN_TUC: process.env.NEXT_PUBLIC_KIN_MO_TIN_TUC,
    THU_VIEN: process.env.NEXT_PUBLIC_KIN_MO_THU_VIEN,
    TIENG_ANH: process.env.NEXT_PUBLIC_KIN_MO_TIENG_ANH,
    XEP_HANG: process.env.NEXT_PUBLIC_KIN_MO_XEP_HANG,
    COIN: process.env.NEXT_PUBLIC_KIN_MO_COIN,
    DIEM_CHUAN: process.env.NEXT_PUBLIC_KIN_MO_DIEM_CHUAN,
    HOC_PHI: process.env.NEXT_PUBLIC_KIN_MO_HOC_PHI,
    KINH_DOANH: process.env.NEXT_PUBLIC_KIN_MO_KINH_DOANH,
    DIEM_DANH: process.env.NEXT_PUBLIC_KIN_MO_DIEM_DANH,
    SO_DIEM: process.env.NEXT_PUBLIC_KIN_MO_SO_DIEM,
    NHAC_HOC: process.env.NEXT_PUBLIC_KIN_MO_NHAC_HOC,
    HOP_VIEC: process.env.NEXT_PUBLIC_KIN_MO_HOP_VIEC,
    THI_THU_CONG_KHAI: process.env.NEXT_PUBLIC_KIN_MO_THI_THU_CONG_KHAI,
    VAN_HANH_PHU: process.env.NEXT_PUBLIC_KIN_MO_VAN_HANH_PHU,
  };
}

/** Phần `k` đang mở? Chỉ đúng chuỗi "1" mới mở; thiếu / "0" / "true" / rác → ẩn (đóng khi lạ). `env` truyền vào để test; bỏ trống = đọc môi trường. */
export function featureOn(k: FeatureKey, env: FeatureEnv = readFeatureEnv()): boolean {
  return env?.[k] === "1";
}

/** Người xem, đủ để quyết chốt chặn: khách, học sinh (kể cả gia sư chờ duyệt), gia sư (admin + teacher), quản trị cấp 1 / nội dung. */
export type FeatureViewer = "guest" | "student" | "tutor" | "admin";

interface PathRule {
  feature: FeatureKey;
  path: string;
  /** DG: đường có đoạn động (mã lớp) — khớp theo biểu thức thay cho `path`/`sub`. `path` khi đó chỉ để đọc. */
  re?: RegExp;
  /** Khớp cả trang con (`path/…`). Không có = chỉ khớp đúng `path`. */
  sub?: boolean;
  /** Chốt chặn route (307) khi phần đang ẩn. Không có = chỉ gỡ lối vào (menu, liên kết), route vẫn chạy. Mảng = chỉ chặn với những vai này. */
  route?: true | FeatureViewer[];
}

// Thứ tự không quan trọng (không có hai quy tắc chồng nhau). Mỗi dòng ghi lý do khi KHÔNG chặn route.
const PATH_RULES: readonly PathRule[] = [
  // 1. Tìm gia sư: chỉ ẩn SÀN (/giang-vien: danh sách, lọc; menu; khối trang chủ; liên kết dẫn tới sàn). Rà soát LOI-01 (COO): hồ sơ từng gia sư /mentor/<id>
  //    (kể cả /mentor/<id>/yeu-cau) vẫn MỞ cho mọi người để link gia sư đã chia sẻ không chết. /yeu-cau/<mã> (theo dõi yêu cầu đã gửi) cũng không chặn.
  { feature: "TIM_GIA_SU", path: "/giang-vien", sub: true, route: true },
  // 2. Cộng đồng: bảng tin chung. /cong-dong/<id> KHÔNG khớp (chỉ đúng "/cong-dong"): câu hỏi trong LỚP (thread gắn course) vẫn mở cho gia sư và thành viên lớp —
  //    Hộp việc gia sư và thông báo trả lời trỏ /cong-dong/<id>. Trang đó tự chặn bài chung (courseId = null) ở máy chủ: src/app/(guest)/cong-dong/[id]/page.tsx.
  //    Lối HỎI TRONG LỚP: /cong-dong?scope=<mã lớp> vẫn mở với học sinh / gia sư (xem `classScopeOf`); bảng tin chung vẫn chặn.
  { feature: "CONG_DONG", path: "/cong-dong", route: true },
  { feature: "CONG_DONG", path: "/cong-dong/hoi-dap", sub: true, route: true },
  { feature: "CONG_DONG", path: "/cong-dong/ho-so", sub: true, route: true },
  { feature: "CONG_DONG", path: "/student/cong-dong", route: true },
  { feature: "CONG_DONG", path: "/student/hoi-dap", sub: true, route: true },
  // Kiểm duyệt của gia sư / quản trị: chỉ rút khỏi menu. Hộp việc gia sư và Hàng chờ quản trị vẫn dẫn tới khi có báo cáo bài trong lớp.
  { feature: "CONG_DONG", path: "/lop-cua-toi/kiem-duyet", sub: true },
  { feature: "CONG_DONG", path: "/admin/cong-dong", sub: true },
  // 3. Lịch: CHỈ gỡ lối vào ở menu. Không chặn route: Hộp việc còn dòng báo nghỉ / buổi bù / nhắc lịch trỏ vào đó; dữ liệu lịch, điểm danh, học phí theo buổi giữ nguyên.
  { feature: "LICH", path: "/lop-cua-toi/lich", sub: true },
  { feature: "LICH", path: "/student/lich-hoc", sub: true },
  // 4. Tin tức.
  { feature: "TIN_TUC", path: "/tin-tuc", sub: true, route: true },
  { feature: "TIN_TUC", path: "/student/tin-tuc", sub: true, route: true },
  { feature: "TIN_TUC", path: "/admin/tin-tuc", sub: true },
  // 5. Thư viện CHUNG (danh sách công khai của khách / quản trị). Cùng đường /thu-vien, học sinh thấy thư viện các lớp mình học và gia sư thấy "Thư viện của tôi"
  //    (module Thư viện của vỏ gia sư) — hai vai này KHÔNG bị chặn.
  { feature: "THU_VIEN", path: "/thu-vien", sub: true, route: ["guest", "admin"] },
  { feature: "THU_VIEN", path: "/admin/thu-vien-video", sub: true },
  // 6. Tiếng Anh tự học.
  { feature: "TIENG_ANH", path: "/student/tieng-anh", sub: true, route: true },
  // 7. Xếp hạng / vinh danh.
  { feature: "XEP_HANG", path: "/bang-xep-hang", sub: true, route: true },
  { feature: "XEP_HANG", path: "/student/bang-xep-hang", sub: true, route: true },
  { feature: "XEP_HANG", path: "/vinh-danh", sub: true, route: true }, // chưa có trang công khai /vinh-danh (chỉ /admin/vinh-danh); giữ chỗ để route mới sinh ra cũng ẩn theo cờ.
  { feature: "XEP_HANG", path: "/admin/vinh-danh", sub: true },
  // 8. Coin: chỉ hiển thị (COIN_VISIBLE); route /student/vi tự xử lý trong layout của nó. Không đụng logic Coin.
  { feature: "COIN", path: "/student/vi", sub: true },
  { feature: "COIN", path: "/admin/topups", sub: true },
  // 9. Điểm chuẩn / tra cứu.
  { feature: "DIEM_CHUAN", path: "/diem-chuan", sub: true, route: true },
  { feature: "DIEM_CHUAN", path: "/tra-cuu", sub: true, route: true },
  { feature: "DIEM_CHUAN", path: "/student/tra-cuu", sub: true, route: true },
  { feature: "DIEM_CHUAN", path: "/admin/diem-chuan", sub: true },
  // ── DG (14/11/2026): tám phần mới. Trang gia sư / học sinh: chặn route (307 về trang đầu theo vai). Trang quản trị: chặn với vai quản trị — chốt ở nhánh
  //    tên miền admin của hostRouting.decideRoute (307 về /admin?tam-dong=…). Chỉ trang; API giữ nguyên.
  // 10. Học phí. Chỉ TRANG; API /api/tutor/invoices…, webhook SePay, invoiceServer không đổi (TIỀN).
  { feature: "HOC_PHI", path: "/lop-cua-toi/hoc-phi", sub: true, route: true },
  { feature: "HOC_PHI", path: "/student/hoc-phi", sub: true, route: true },
  { feature: "HOC_PHI", path: "/lop-cua-toi/<lớp>/bang-hoc-phi", re: /^\/lop-cua-toi\/[^/]+\/bang-hoc-phi(?:\/.*)?$/, route: true },
  // 11. Kinh doanh: doanh thu, gói KiN Pro.
  { feature: "KINH_DOANH", path: "/lop-cua-toi/doanh-thu", sub: true, route: true },
  { feature: "KINH_DOANH", path: "/lop-cua-toi/goi", sub: true, route: true },
  { feature: "KINH_DOANH", path: "/admin/doanh-thu", sub: true, route: ["admin"] },
  { feature: "KINH_DOANH", path: "/admin/goi-pro", sub: true, route: ["admin"] },
  // 12. Điểm danh: trang Điểm danh của lớp (kể cả bản in). Dữ liệu điểm danh, chốt buổi giữ nguyên.
  { feature: "DIEM_DANH", path: "/lop-cua-toi/quan-lop/<lớp>/diem-danh", re: /^\/lop-cua-toi\/quan-lop\/[^/]+\/diem-danh(?:\/.*)?$/, route: true },
  // 13. Sổ điểm + báo cáo tháng.
  { feature: "SO_DIEM", path: "/lop-cua-toi/so-diem", sub: true, route: true },
  { feature: "SO_DIEM", path: "/lop-cua-toi/bao-cao-thang", sub: true, route: true },
  // 14. Nhắc học của học sinh.
  { feature: "NHAC_HOC", path: "/student/nhac-hoc", sub: true, route: true },
  // 15. Hộp việc: /lop-cua-toi là gốc của cả vỏ gia sư nên KHÔNG là quy tắc đường (liên kết logo vẫn sống) — trang tự chuyển sang thư viện Lớp (landingPath).
  //     Tổng quan (bản thay Hộp việc khi gia sư tự tắt module) đi cùng cờ này.
  { feature: "HOP_VIEC", path: "/lop-cua-toi/tong-quan", sub: true, route: true },
  // 16. Thi thử công khai: CHỈ danh sách /thi-thu (và bí danh /student/thi-thu). Phòng thi /student/thi-thu/<mã đề> (đề giao qua lớp, Việc của tôi) KHÔNG khớp.
  { feature: "THI_THU_CONG_KHAI", path: "/thi-thu", route: true },
  { feature: "THI_THU_CONG_KHAI", path: "/student/thi-thu", route: true },
  // 17. Vận hành phụ (quản trị).
  { feature: "VAN_HANH_PHU", path: "/admin/pheu", sub: true, route: ["admin"] },
  { feature: "VAN_HANH_PHU", path: "/admin/so-do", sub: true, route: ["admin"] },
  { feature: "VAN_HANH_PHU", path: "/admin/danh-gia", sub: true, route: ["admin"] },
  { feature: "VAN_HANH_PHU", path: "/admin/trang-chu", sub: true, route: ["admin"] },
  // TIM_GIA_SU (DG): hai trang gia sư của sàn — bài đăng tìm học sinh, yêu cầu tìm gia sư.
  { feature: "TIM_GIA_SU", path: "/lop-cua-toi/bai-dang", sub: true, route: true },
  { feature: "TIM_GIA_SU", path: "/lop-cua-toi/yeu-cau", sub: true, route: true },
];

/** Bỏ ?tham số và #neo, bỏ "/" cuối (trừ gốc). Địa chỉ ngoài (https://, tel:, mailto:) không thuộc quy tắc nào. */
function pathOf(href: string): string | null {
  if (typeof href !== "string" || !href.startsWith("/") || href.startsWith("//")) return null;
  const p = href.split(/[?#]/)[0];
  return p.length > 1 ? p.replace(/\/+$/, "") : p;
}

const matches = (r: PathRule, p: string) => r.re ? r.re.test(p) : p === r.path || (!!r.sub && p.startsWith(r.path + "/"));

/** Phần (đang ẨN) mà liên kết `href` dẫn vào; null = liên kết hiện bình thường. Dùng cho menu, chân trang, bản đồ, sitemap. */
export function hiddenLinkFeature(href: string, env: FeatureEnv = readFeatureEnv()): FeatureKey | null {
  const p = pathOf(href);
  if (!p) return null;
  const r = PATH_RULES.find(x => matches(x, p) && !featureOn(x.feature, env));
  return r ? r.feature : null;
}

/** Liên kết có phải gỡ khỏi giao diện không (đích thuộc một phần đang ẩn). */
export const isLinkHidden = (href: string, env: FeatureEnv = readFeatureEnv()): boolean => hiddenLinkFeature(href, env) !== null;

/** Lọc danh sách mục có `href`: bỏ mục dẫn vào phần đang ẩn. Giữ nguyên thứ tự. */
export function visibleLinks<T extends { href: string }>(items: readonly T[], env: FeatureEnv = readFeatureEnv()): T[] {
  return items.filter(i => !isLinkHidden(i.href, env));
}

/**
 * Lối hỏi trong lớp khi bảng tin chung ẩn (rà soát LOI-01, lời hứa với chủ "giữ hỏi gia sư trong lớp"): `/cong-dong?scope=<mã lớp>` là feed + ô soạn CHỈ của lớp đó.
 * Trả mã lớp nếu `search` chỉ một lớp (không phải "all" / "common", không phải tab "Đã lưu" — tab đó gom bài từ mọi nơi); ngược lại null.
 * Quyền là thành viên lớp do API quyết (loadFeedPage / POST threads gọi canAccessClass); proxy chỉ cho học sinh / gia sư đi qua.
 */
export function classScopeOf(search: string | null | undefined): string | null {
  if (!search) return null;
  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const s = q.get("scope");
  if (!s || s === "all" || s === "common" || !/^[A-Za-z0-9_-]{1,64}$/.test(s)) return null;
  if (q.get("tab") === "da-luu") return null;
  return s;
}

/** Route `pathname` có bị chặn với người xem này không (phần đang ẩn và quy tắc có chặn route cho vai này). Trả về phần bị ẩn, hoặc null = cho qua.
 *  `search`: chỉ dùng cho ngoại lệ hỏi trong lớp `/cong-dong?scope=<mã lớp>` (học sinh / gia sư). */
export function blockedRouteFeature(pathname: string, viewer: FeatureViewer, env: FeatureEnv = readFeatureEnv(), search?: string): FeatureKey | null {
  const p = pathOf(pathname);
  if (!p) return null;
  if (p === "/cong-dong" && (viewer === "student" || viewer === "tutor") && classScopeOf(search)) return null;
  const r = PATH_RULES.find(x => x.route && matches(x, p) && (x.route === true || x.route.includes(viewer)) && !featureOn(x.feature, env));
  return r ? r.feature : null;
}

// LOI-07 (11/11/2026, nợ P3 của LOI-01): thông báo / liên kết cũ trỏ vào phần đang ẩn → bị chuyển về trang đầu mà không biết vì sao. Chốt chặn (hostRouting.decideRoute,
// trang /cong-dong/<id>) gắn `?tam-dong=<CỜ>` lên trang đích; một component dùng chung (src/components/kin/PausedNotice.tsx, cắm ở layout gốc) đọc dấu bằng
// `pausedNoticeFrom` rồi hiện MỘT dòng "Phần này đang tạm đóng." đóng được. Dấu chỉ là chữ hiển thị: không quyết quyền, không đổi mã 307 + no-store.
/** Tên tham số dấu "vừa bị chuyển ra khỏi phần đang tạm đóng". */
export const PAUSED_PARAM = "tam-dong";

/** Chuỗi search gắn lên trang đích khi chặn phần `k`: "?tam-dong=CONG_DONG". */
export const pausedSearch = (k: FeatureKey): string => `?${PAUSED_PARAM}=${k}`;

/** Đọc dấu từ `search` ("?a=1&tam-dong=TIN_TUC", không "?" cũng được). Chỉ nhận ĐÚNG tên một cờ trong FEATURES mà cờ đó đang TẮT (phần đã mở lại thì không nhắc nữa);
 *  thiếu / rỗng / rác / chữ thường / tên lạ → null. Nhiều giá trị: chỉ xét giá trị đầu. */
export function pausedNoticeFrom(search: string | null | undefined, env: FeatureEnv = readFeatureEnv()): FeatureKey | null {
  if (typeof search !== "string" || !search) return null;
  let v: string | null;
  try { v = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get(PAUSED_PARAM); } catch { return null; }
  const k = (FEATURES as readonly string[]).includes(v ?? "") ? (v as FeatureKey) : null;
  return k && !featureOn(k, env) ? k : null;
}

/** Đường này CÓ THỂ bị chặn với một vai nào đó (để proxy biết khi nào cần giải mã phiên). Không phụ thuộc vai. */
export function mayBlockRoute(pathname: string, env: FeatureEnv = readFeatureEnv()): boolean {
  const p = pathOf(pathname);
  return !!p && PATH_RULES.some(x => x.route && matches(x, p) && !featureOn(x.feature, env));
}

// COIN_VISIBLE (quyết định chủ CHỦ-02, 05/11/2026): false = ẩn mọi HIỂN THỊ Coin khỏi giao diện học sinh, gia sư, khách và quản trị (số dư, ví, thưởng,
// lịch sử nạp). Từ LOI-01 đọc cờ NEXT_PUBLIC_KIN_MO_COIN (mặc định ẩn); bật lại phần hiển thị: đặt =1.
export const COIN_VISIBLE = featureOn("COIN");

// COIN_LOGIC_ON (rà soát LOI-01, COO 11/11/2026): phần LOGIC Coin — trừ xu khi hỏi (src/app/api/questions/route.ts) và hàng chờ duyệt nạp Coin — TÁCH khỏi cờ hiển thị,
// giữ đúng hành vi của main (tắt, như hằng `false` cũ). Là HẰNG, cố ý không đọc biến môi trường: bật trừ xu phải qua sửa mã có rà, không bật bằng cấu hình.
export const COIN_LOGIC_ON = false;

/** Loại hàng chờ thuộc Coin: không hiện khi COIN_VISIBLE = false. */
export const COIN_QUEUE_KIND = "nap-coin";

/** Nhãn mô tả dữ liệu cũ (nhật ký, quyền): khi Coin ẩn, không để chữ "Coin" lọt ra màn hình. */
export function hideCoin(s: string): string {
  return COIN_VISIBLE ? s : s.replace(/Coin/g, "điểm thưởng");
}

// Ranh giới từ theo Unicode (\b của JS chỉ hiểu ASCII nên "xuống" bị coi là "xu" + "ống").
// \p{M} (dấu kết hợp): chữ ở dạng NFD như "xu" + dấu sắc ("xú") vẫn là MỘT từ khác, không được cắt "xu" ra rồi để dấu mồ côi.
const NOT_WORD_BEFORE = "(?<![\\p{L}\\p{N}\\p{M}])";
const NOT_WORD_AFTER = "(?![\\p{L}\\p{N}\\p{M}])";
// "xu" là đơn vị tiền, trừ khi đi liền "hướng"/"thế" ("Top 10 xu hướng", "Năm 2024 xu thế mới", "Điểm 8,5 xu thế" — số đứng trước không biến chúng thành tiền).
const XU = `xu(?!\\s+(?:hướng|thế)${NOT_WORD_AFTER})`;
// Số tiền kiểu VN: 20, 1.000, 12.500,5, và nhóm bằng khoảng trắng ("500 000", NBSP, thin space, narrow NBSP) — dấu/khoảng nằm GIỮA chữ số, không bao giờ kết thúc số.
const GROUP_SPACE = "[ \u00A0\u2007\u2009\u202F]";
const AMOUNT = `[+\\-\u2212]?(?:\\d{1,3}(?:${GROUP_SPACE}\\d{3})+(?:[.,]\\d+)*|\\d+(?:[.,]\\d+)*)`;
// Ký tự điều hướng / độ rộng bằng không (LRM, RLM, LRE…RLO, PDF, LRI…PDI, ZWSP, ZWNJ, ZWJ, BOM, word-joiner): vô hình nhưng chen giữa "20" và "xu" làm hụt khớp.
const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;
const COIN = "coins?";
const RE_DEDUCT = new RegExp(`,?\\s*bạn bị trừ ${AMOUNT}\\s*(?:${XU}|${COIN})${NOT_WORD_AFTER}`, "giu");
const RE_AMOUNT_UNIT = new RegExp(`\\s*${NOT_WORD_BEFORE}${AMOUNT}\\s*(?:${XU}|${COIN}|🪙)${NOT_WORD_AFTER}`, "giu");
const RE_COIN_AMOUNT = new RegExp(`\\s*🪙\\s*${AMOUNT}${NOT_WORD_AFTER}`, "gu");
// Nhãn rồi số: "Coin: 50", "Coin 50", "Coin = +50", "Xu: 50" — bỏ cả nhãn lẫn số (không để lọt "điểm thưởng: 50"). "xu" trơ trọi + số không có dấu hai chấm thì giữ (không chắc là tiền).
const RE_LABEL_AMOUNT = new RegExp(`\\s*${NOT_WORD_BEFORE}(?:${COIN}\\s*[:=\\-\u2013\u2014]?|xu\\s*[:=])\\s*${AMOUNT}${NOT_WORD_AFTER}`, "giu");
const RE_COIN_WORD = new RegExp(`${NOT_WORD_BEFORE}${COIN}${NOT_WORD_AFTER}`, "giu");

const DEDUCT_TAIL = "phần thưởng của câu trả lời này bị trừ lại";

/**
 * Chữ thông báo đã lưu từ trước (hàng cũ trong bảng thông báo có thể ghi "+20 xu", "bị trừ 20 xu", "Coin"):
 * khi Coin ẩn, bỏ phần "số + xu/Coin/🪙" khỏi chữ hiển thị. Không sửa dữ liệu đã lưu.
 * Chỉ "xu" là ĐƠN VỊ TIỀN đứng sau số mới bị bỏ: "Xu thế", "xu hướng", "xuống" giữ nguyên; "xu" không đi kèm số cũng giữ nguyên.
 * Số có dấu chấm hàng nghìn ("1.000 xu") hay nhóm bằng khoảng trắng ("500 000 xu") bỏ nguyên số, không để sót "1." / "Phí 500".
 * Ưu tiên KHÔNG để lộ số xu; mất ngữ cảnh ("1 xu rồi 2 xu" → "rồi") chấp nhận được, nhưng không để dấu phẩy / ngoặc rỗng / khoảng trắng mồ côi.
 */
export function hideCoinText(s: string): string {
  if (COIN_VISIBLE) return s;
  // So khớp trên chuỗi NFC, bỏ ký tự vô hình; không có gì để ẩn thì trả NGUYÊN chuỗi gốc.
  const n = s.normalize("NFC").replace(INVISIBLE, "");
  const out = n
    .replace(RE_DEDUCT, (_m, offset: number, whole: string) => {
      // Đầu chuỗi / đầu câu: không có dấu phẩy dẫn, viết hoa; giữa câu: ", phần thưởng…".
      const before = whole.slice(0, offset).replace(/\s+$/, "");
      return !before || /[.!?\n]$/.test(before) ? (before ? " " : "") + DEDUCT_TAIL.charAt(0).toUpperCase() + DEDUCT_TAIL.slice(1) : ", " + DEDUCT_TAIL;
    })
    .replace(RE_LABEL_AMOUNT, "")
    .replace(RE_AMOUNT_UNIT, "")
    .replace(RE_COIN_AMOUNT, "")
    .replace(/🪙/gu, "")
    .replace(RE_COIN_WORD, "điểm thưởng");
  if (out === n) return s;
  return out
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\(\s*\)|\[\s*\]/g, "")            // ngoặc rỗng sau khi bỏ "(20 xu)"
    .replace(/\s+([,.;:!?)\]])/g, "$1")
    .replace(/([(\[])\s+/g, "$1")
    .replace(/([,;:])(?:\s*[,;:])+/g, "$1")        // dấu phẩy chồng nhau
    .replace(/^[\s,;:.]+/, "")                       // dấu dẫn mồ côi
    .replace(/[\s,;:]+$/, "")                       // dấu cuối mồ côi
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
