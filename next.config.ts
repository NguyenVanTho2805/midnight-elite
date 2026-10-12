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
  // với localhost → trang admin không hydrate. Cho phép domain này.
  allowedDevOrigins: ["admin.midnightelite-edu.com"],
};

export default nextConfig;
