import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image.
  output: "standalone",
  reactStrictMode: true,
  // Native module — must be required at runtime, not bundled by webpack.
  serverExternalPackages: ["better-sqlite3"],
  async headers() {
    return [
      {
        // Allow Chrome extension content scripts to call extension API routes
        // from any website. Clerk auth is handled inside each route handler.
        source: "/api/extension-(.*)",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
          { key: "Access-Control-Max-Age", value: "86400" },
        ],
      },
    ];
  },
};

export default nextConfig;
