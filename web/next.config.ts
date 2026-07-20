import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/api/chat/agent/[agent]": [
      "./data/knowledge/ceo/**/*",
      "./data/knowledge/finance/**/*",
    ],
    "/api/chat/agent/[agent]/stream": [
      "./data/knowledge/ceo/**/*",
      "./data/knowledge/finance/**/*",
    ],
  },
  serverExternalPackages: ["mammoth", "pdf-parse"],
};

export default nextConfig;
