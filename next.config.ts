import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module — keep it out of the bundle.
  serverExternalPackages: ["better-sqlite3"],
  // pin the workspace root — the monorepo has many lockfiles above this dir.
  turbopack: { root: __dirname },
};

export default nextConfig;
