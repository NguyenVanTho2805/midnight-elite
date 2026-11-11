// Trang chủ "/" (BU-HS-TRANG-CHU): khối nào hiện cho ai, thanh trên có mục nào, và đường về Trang chủ từ khu học sinh. THUẦN: không prisma, không next, không react.
// Test: tools/local-e2e/t-home-layout-lib.ts, t-nav-home-lib.ts. Đặc tả: docs/kin/phong-ban/dac-ta/BU-HS-TRANG-CHU.md mục 4.1.
// LOI-01 (11/11/2026): mục / khối dẫn vào phần đang ẩn (src/lib/features.ts) bị bỏ ở đây — Cộng đồng, Tin tức trên thanh trên; khối bảng tin, tính điểm ở thân trang.
import { featureOn, visibleLinks, type FeatureEnv } from "@/lib/features";
//
// Trang chủ là trang TĨNH (không đọc cookie ở máy chủ): HTML ban đầu luôn là bản của khách, rồi các khối máy khách tự quyết theo `useAuth()`.
// Vì vậy `loading` (chưa biết là ai) phải giống khách NHƯNG không được hiện "Lớp của tôi" (tránh nháy khối cho khách) và không hiện nút đăng ký cuối trang.

/** Người đang xem trang chủ. Lạ / thiếu dữ liệu → "guest" (đóng khi lạ: không hiện gì dành riêng cho một vai). */
export type HomeViewer =
  | { kind: "loading" }        // AuthContext chưa trả lời
  | { kind: "guest" }
  | { kind: "student" }        // role student, không tutorPending
  | { kind: "tutor-pending" }  // role student + tutorPending
  | { kind: "tutor" }          // admin + adminRole teacher
  | { kind: "admin" };         // admin_super / admin_content (xem thử)

export interface HomeUserLike { role: string | null; adminRole?: string | null; tutorPending?: boolean }

/** Từ `user` + `isLoading` của AuthContext ra người xem. Chưa biết ai (không có user, còn đang hỏi) → loading. Đã có user thì dùng luôn, không chờ. */
export function toHomeViewer(user: HomeUserLike | null | undefined, isLoading: boolean): HomeViewer {
  if (!user || typeof user !== "object") return isLoading ? { kind: "loading" } : { kind: "guest" };
  if (user.role === "student") return user.tutorPending === true ? { kind: "tutor-pending" } : { kind: "student" };
  if (user.role === "admin") {
    if (user.adminRole === "teacher") return { kind: "tutor" };
    if (user.adminRole === "admin_super" || user.adminRole === "admin_content") return { kind: "admin" };
  }
  return { kind: "guest" };
}

/** Cờ đọc ở máy chủ rồi truyền xuống. `quiz` = `process.env.KIN_HOME_QUIZ !== "0"` (mặc định HIỆN khung quiz, kể cả khi rỗng; chỉ ẩn khi đặt tường minh KIN_HOME_QUIZ=0). */
export interface HomeFlags { quiz: boolean }

export interface HomeBlocks {
  myClass: boolean;   // "Lớp của tôi": chỉ học sinh thường
  community: boolean; // bảng tin: mọi người, mọi vai — khi phần Cộng đồng đang mở (LOI-01)
  quiz: boolean;      // theo cờ, cùng một giá trị cho mọi vai; nằm trong khối bảng tin nên ẩn theo nó
  score: boolean;     // tính điểm thi: mọi người — khi phần Điểm chuẩn đang mở (LOI-01)
  ctaFinal: boolean;  // nút đăng ký cuối trang: khách (và lúc chưa biết) — người đã có tài khoản không cần
}

export function homeBlocksFor(v: HomeViewer, f: HomeFlags, env?: FeatureEnv): HomeBlocks {
  const kind = v?.kind;
  const community = featureOn("CONG_DONG", env);
  return {
    myClass: kind === "student",
    community,
    quiz: community && f?.quiz === true,
    score: featureOn("DIEM_CHUAN", env),
    // `loading` KHÔNG hiện ctaFinal theo đặc tả 5.1 ("ẩn CTA cuối khi biết đã đăng nhập"): HTML tĩnh đã có sẵn CTA cho khách, khối này chỉ quyết việc ẨN sau khi biết.
    // Hai điều kiện đều đúng với bảng: khách → true; loading → false (không vẽ thêm gì lúc chưa biết); mọi vai đã đăng nhập → false.
    ctaFinal: kind === "guest",
  };
}

export interface HomeNavItem { label: string; href: string }

/** Mục thanh trên của Trang chủ: bốn mục chung cho mọi người; học sinh thường thêm "Lớp của tôi" ở CUỐI. Gia sư chờ duyệt không có lớp để học. */
export function homeNavFor(v: HomeViewer, env?: FeatureEnv): HomeNavItem[] {
  const items: HomeNavItem[] = [
    { label: "Lớp học", href: "/khoa-hoc" },
    { label: "Thi thử", href: "/thi-thu" },
    { label: "Cộng đồng", href: "/cong-dong" },
    { label: "Tin tức", href: "/tin-tuc" },
  ];
  if (v?.kind === "student") items.push({ label: "Lớp của tôi", href: "/student/hoc-tap" });
  return visibleLinks(items, env);
}

// ─── Lối về Trang chủ trong khu học sinh (mục 1.3) ───────────────────────────────────────────────────────────────

/** Đích của mọi lối về Trang chủ (logo, hàng đầu bảng "Khác", mục đầu thanh module, liên kết ở dải trên). */
export const HOME_HREF = "/";

/** Mục "Trang chủ" sáng khi và CHỈ KHI đang đứng đúng "/". Không dùng `startsWith`: mọi đường dẫn đều bắt đầu bằng "/", mục sẽ sáng ở mọi trang. */
export function isHomeActive(pathname: string | null | undefined): boolean {
  return pathname === HOME_HREF;
}

/**
 * Các đích đã RÚT khỏi menu học sinh ở BU-00 (31/10/2026) — không được xuất hiện làm `href` của một mục trong StudentShell / MorePanel
 * (route vẫn chạy, chỉ ẩn lối vào). Lấy từ `ui-student-shell.ts` (mục "BU-00: … đã rời bảng Khác") và đầu tệp StudentShell.tsx:
 * Thư viện, Thi thử, Bảng xếp hạng, Hỏi đáp, Khoá học đang mở, Lớp đang theo dõi, Tra cứu điểm chuẩn, Ví và Coin.
 *
 * KHÔNG có ở đây:
 *  - "/khoa-hoc?gia=free" ("Lớp miễn phí", thêm 08/11/2026 làm lối tìm lớp): href khác hẳn "/khoa-hoc" nên so khớp chính xác không dính.
 *  - "/student/tieng-anh": hiện còn là lối tắt `active: false` trong nhóm "Tự học" (sửa sau BU-00 ngày 01/11); đặc tả 6.7 ghi "không thêm", chứ không bắt rút lại.
 *  - "/student/thi-thu": là `also` của module "Việc của tôi" (đề được giao nằm ở đó), không phải href của mục menu. `also` không nằm trong phạm vi kiểm này.
 */
export const BU00_REMOVED_MENU_HREFS: readonly string[] = [
  "/thu-vien",
  "/thi-thu",
  "/student/thi-thu",
  "/bang-xep-hang",
  "/student/bang-xep-hang",
  "/student/hoi-dap",
  "/khoa-hoc",
  "/khoa-hoc-da-luu",
  "/diem-chuan",
  "/student/vi",
];
