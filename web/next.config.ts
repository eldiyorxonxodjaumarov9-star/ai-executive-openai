import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/api/chat/agent/[agent]": ["./data/knowledge/ceo/**/*"],
    "/api/chat/agent/[agent]/stream": ["./data/knowledge/ceo/**/*"],
  },
  serverExternalPackages: ["mammoth", "pdf-parse"],
};

export default nextConfig;
