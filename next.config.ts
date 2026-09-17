import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * The local store's client reaches for `node:net` and `node:tls` and loads its command
   * table at require time, so the server calls it rather than bundling it. Upstash is
   * plain `fetch` and needs nothing here.
   */
  serverExternalPackages: ["ioredis"],
};

export default nextConfig;
