import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @napi-rs/canvas ships a native binary loader (js-binding.js) that
  // Turbopack's production build can't place in an ESM chunk — only used
  // server-side (route handler PDF rasterization), so opt it out of bundling
  // and let Node's native require() load it directly at runtime.
  serverExternalPackages: ["@napi-rs/canvas"],
};

export default nextConfig;
