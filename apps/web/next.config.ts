import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  transpilePackages: ["@izma/types", "@izma/protocol"],
};

export default nextConfig;
