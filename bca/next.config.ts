import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Kho gốc có package-lock riêng (app KiN); chỉ định gốc là thư mục bca/.
  turbopack: { root: import.meta.dirname },
  // Cho trang gọi forbidden()/unauthorized() (next/navigation) để trả HTTP 403/401 thật (docs Next 16: config/authInterrupts).
  experimental: { authInterrupts: true },
};

export default nextConfig;
