// BU-05 — /cong-dong: trang MỎNG (máy chủ). Đọc ?tab= ?scope= ?da-gui= ?loi= rồi dựng khung 3/2/1 cột; mọi thứ động nằm ở src/components/community.
// Là server component có metadata để liên kết công khai đọc được (og:title ≤ 60, og:description ≤ 110).
// Cờ KIN_GUEST_QUESTIONS=1 (đọc ở máy chủ, lúc yêu cầu) bật ô hỏi của khách; chưa bật → khách chỉ thấy lời mời đăng nhập.
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CommunityHome, type HomeTab } from "@/components/community/CommunityHome";
import { classScopeOf, featureOn } from "@/lib/features";

const TITLE = "Cộng đồng — KiN";
const DESC = "Hỏi đáp và chia sẻ cách học cùng gia sư và các bạn. Xem tự do, không cần tài khoản.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  openGraph: { title: TITLE, description: DESC, type: "website" },
};

const TABS: readonly HomeTab[] = ["all", "hoi-dap", "kinh-nghiem", "tai-lieu", "goc-vui", "da-luu"];

type Raw = Record<string, string | string[] | undefined>;

export default async function CongDongPage({ searchParams: raw }: { searchParams: Promise<Raw> }) {
  const resolved = await raw;
  const searchParams = new URLSearchParams();
  for (const [k, v] of Object.entries(resolved)) {
    const first = Array.isArray(v) ? v[0] : v;
    if (typeof first === "string") searchParams.set(k, first);
  }

  // "hoi-dap-qa" là giá trị cũ của /student/hoi-dap và thông báo cũ: giữ nguyên, đổi thành "hoi-dap" khi gọi API.
  const rawTab = searchParams.get("tab") === "hoi-dap-qa" ? "hoi-dap" : searchParams.get("tab");
  const tab: HomeTab = (TABS as readonly string[]).includes(rawTab ?? "") ? (rawTab as HomeTab) : "all";
  const s = searchParams.get("scope") ?? "all";
  const scope = /^[A-Za-z0-9_-]{1,64}$/.test(s) ? s : "all";
  const loi = searchParams.get("loi");
  // LOI-01: bảng tin chung đang ẩn → proxy chỉ cho tới đây khi địa chỉ là MỘT lớp (classScopeOf, học sinh / gia sư). Phòng hờ: địa chỉ khác thì về trang chủ.
  const classOnly = !featureOn("CONG_DONG");
  if (classOnly && !classScopeOf(searchParams.toString())) redirect("/");

  return (
    <CommunityHome
      tab={tab}
      scope={scope}
      daGui={searchParams.get("da-gui") === "1"}
      loi={loi && /^[a-z_]{1,40}$/.test(loi) ? loi : null}
      guestOpen={process.env.KIN_GUEST_QUESTIONS === "1"}
      classOnly={classOnly}
    />
  );
}
