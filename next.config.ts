import type { NextConfig } from "next";

const rawBasePath = process.env.NEXT_BASE_PATH || "";
const basePath = rawBasePath === "" ? "" : rawBasePath.replace(/\/+$/, "");

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["localhost", "127.0.0.1", "::1"],
  images: { unoptimized: true },
  basePath,
};

export default nextConfig;
