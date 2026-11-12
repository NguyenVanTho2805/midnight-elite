// LOI-05 (làm lại BU-06) — Tìm gia sư. Trang MÁY CHỦ: metadata + tiêu đề + câu chân trang dựng sẵn cho SEO; phần tương tác ở SanGiaSu (client, bọc Suspense
// vì dùng useSearchParams). Đặc tả: docs/kin/phong-ban/dac-ta/LOI-05.md mục 4.1. Không Figma đợt này.
// Vẫn ẩn sau cờ TIM_GIA_SU (src/lib/features.ts): cờ tắt thì src/proxy.ts trả 307 trước khi tới trang này.
import type { Metadata } from "next";
import { Suspense } from "react";
import { SanGiaSu } from "@/components/guest/tim-gia-su/SanGiaSu";
import { LuoiCho } from "@/components/guest/tim-gia-su/LuoiGiaSu";

const MO_TA = "Tìm gia sư theo môn, khu vực, hình thức dạy. Hồ sơ gia sư tự khai, xem miễn phí, không cần tài khoản.";

export const metadata: Metadata = {
  title: "Tìm gia sư — KiN",
  description: MO_TA,
  openGraph: { title: "Tìm gia sư — KiN", description: MO_TA, images: [{ url: "/og-kin.png", width: 1200, height: 630, alt: "KiN" }] },
};

function ChoSan() {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-[var(--kin-cham-toi-thieu)] w-full rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-nhat)]" aria-hidden />
      <p role="status" className="m-0 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">Đang tải…</p>
      <LuoiCho />
    </div>
  );
}

export default function GiangVienPage() {
  return (
    <div data-san-gia-su className="mx-auto flex w-full max-w-[1440px] flex-col gap-5 px-5 py-6 sm:px-8 lg:gap-6 lg:px-14 lg:py-10">
      <header className="flex flex-col gap-2">
        <h1 className="m-0 text-[length:var(--kin-co-h3)] font-semibold leading-tight text-[var(--kin-chu-chinh)] lg:text-[length:var(--kin-co-h2)]">Tìm gia sư</h1>
        <p className="m-0 text-[length:var(--kin-co-body)] text-[var(--kin-chu-phu)]">Hồ sơ do gia sư tự khai. Xem miễn phí, không cần tài khoản.</p>
      </header>

      <Suspense fallback={<ChoSan />}>
        <SanGiaSu />
      </Suspense>

      <p data-chan-san className="m-0 mt-4 text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">
        Khu vực, bằng cấp, giá do gia sư tự khai; KiN chưa xác minh. KiN không thu phí nhận lớp.
      </p>
    </div>
  );
}
