import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @napi-rs/canvas ships a native binary loader (js-binding.js) that
  // Turbopack's production build can't place in an ESM chunk — only used
  // server-side (route handler PDF rasterization), so opt it out of bundling
  // and let Node's native require() load it directly at runtime.
  serverExternalPackages: ["@napi-rs/canvas"],

  // Chỉ có tác dụng ở `next dev`: src/middleware.ts ép /admin sang domain
  // admin.midnightelite-edu.com. Khi chạy thử cục bộ qua domain đó (ánh xạ
  // về 127.0.0.1) Next sẽ chặn tài nguyên dev (HMR, chunk) vì khác origin
  // với localhost → trang admin không hydrate. Cho phép domain này. 15/10/2026: thêm cả tên miền chính — bài rà liên kết chạy thử
  // cả hai tên miền thật (chuyển tên miền giữ nguyên cổng) và cần trang hydrate được ở cả hai.
  allowedDevOrigins: ["admin.midnightelite-edu.com", "midnightelite-edu.com"],
};

export default nextConfig;
