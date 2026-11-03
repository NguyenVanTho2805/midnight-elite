// BU-06 — Tìm gia sư kiểu sàn. Trang MÁY CHỦ (có metadata cho SEO); phần tương tác nằm ở TimGiaSu (client, bọc Suspense vì dùng useSearchParams).
// Khung Figma 299:115283 / 299:116882 là bản KH-02; bố cục sàn mới (lưới 4 cột, tờ trượt) chưa có khung để so — người có Figma đối chiếu trước khi gộp.
import type { Metadata } from "next";
import { Suspense } from "react";
import { TimGiaSu } from "@/components/tutor/tim-gia-su/TimGiaSu";
import { LuoiCho } from "@/components/tutor/tim-gia-su/LuoiGiaSu";

export const metadata: Metadata = {
  title: "Tìm gia sư — KiN",
  description: "Tìm gia sư theo môn, lớp, khu vực, hình thức dạy. Hồ sơ công khai, không cần tài khoản.",
  openGraph: { title: "Tìm gia sư — KiN", description: "Tìm gia sư theo môn, lớp, khu vực, hình thức dạy.", images: [{ url: "/og-kin.png", width: 1200, height: 630, alt: "KiN" }] },
};

export default function GiangVienPage() {
  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-[1440px] px-5 py-10 sm:px-8 lg:px-14"><LuoiCho /></div>}>
      <TimGiaSu />
    </Suspense>
  );
}
