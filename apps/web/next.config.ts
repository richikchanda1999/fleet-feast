import type { NextConfig } from "next";
import path from "path";

const pogicityPath = path.resolve(__dirname, "../../packages/pogicity-demo");

const nextConfig: NextConfig = {
  transpilePackages: ["pogicity"],
  // Turbopack configuration for Next.js 16+
  turbopack: {
    resolveAlias: {
      "@/app": path.join(pogicityPath, "app"),
      "@": pogicityPath,
    },
  },
  // Also keep webpack config for compatibility
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@/app": path.join(pogicityPath, "app"),
      "@": pogicityPath,
    };
    return config;
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL
  }
};

export default nextConfig;
