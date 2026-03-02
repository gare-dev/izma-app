import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@izma/types", "@izma/protocol"],
};

export default nextConfig;
