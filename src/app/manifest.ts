// ĐX-02 — manifest của ứng dụng (PWA tối thiểu): để gia sư "Thêm vào Màn hình chính" (bắt buộc với iPhone iOS 16.4+ mới nhận được thông báo đẩy).
// Next 16 phục vụ tệp này ở /manifest.webmanifest và tự chèn thẻ <link rel="manifest">. Không có offline, không cache (xem public/sw.js).
// start_url "/" : proxy đưa người đã đăng nhập về đúng nơi của họ (gia sư → /lop-cua-toi), chưa đăng nhập thì thấy trang giới thiệu.
// Màu viết cứng vì manifest không đọc được biến CSS: theme = --kin-th-navy (sáng) trong src/app/kin-tokens.css.
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KiN — Sổ gia sư",
    short_name: "KiN",
    description: "Sổ lớp, điểm danh và học phí cho gia sư.",
    lang: "vi",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1e3a8a",
    icons: [
      { src: "/icons/kin-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/kin-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/kin-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
