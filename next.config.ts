import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module — keep it out of the bundle.
  serverExternalPackages: ["better-sqlite3"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
          },
        ],
      },
    ];
  },
  // pin the workspace root — the monorepo has many lockfiles above this dir.
  turbopack: { root: __dirname },
};

export default nextConfig;
