import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * The Redis client reaches for `node:net` and `node:tls` and builds its command
   * table at require time, so the server calls it rather than bundling it.
   */
  serverExternalPackages: ["ioredis"],
};

export default nextConfig;
