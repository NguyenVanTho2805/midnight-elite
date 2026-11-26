import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Kho gốc có package-lock riêng (app KiN); chỉ định gốc là thư mục bca/.
  turbopack: { root: import.meta.dirname },
};

export default nextConfig;
