import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Native module — must be required at runtime, not bundled by webpack.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
