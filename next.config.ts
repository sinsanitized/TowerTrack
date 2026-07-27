import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(process.cwd()),
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
};
export default nextConfig;
