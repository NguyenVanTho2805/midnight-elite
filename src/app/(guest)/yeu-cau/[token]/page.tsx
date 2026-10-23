// PH-07 — theo dõi yêu cầu tìm gia sư bằng mã trong link (khách, không cần tài khoản). Không để công cụ tìm kiếm lập chỉ mục.
import type { Metadata } from "next";
import YeuCauTheoDoi from "@/components/guest/YeuCauTheoDoi";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Theo dõi yêu cầu tìm gia sư — KiN", robots: { index: false, follow: false } };

export default async function TheoDoiPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <div className="max-w-3xl mx-auto px-5 sm:px-8 py-8 lg:py-10">
      <h1 className="mb-1 text-[length:var(--kin-co-h1)] leading-[var(--kin-dong-h1)] font-medium" style={{ color: "var(--kin-chu-chinh)" }}>Yêu cầu tìm gia sư của anh/chị</h1>
      <p className="mb-6 text-[length:var(--kin-co-goc)]" style={{ color: "var(--kin-chu-mo)" }}>Theo dõi trạng thái và rút yêu cầu nếu không cần nữa.</p>
      <YeuCauTheoDoi token={token} />
    </div>
  );
}
