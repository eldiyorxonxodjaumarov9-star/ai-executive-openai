import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/api/chat/agent/[agent]": [
      "./data/knowledge/ceo/**/*",
      "./data/knowledge/finance/**/*",
      "./data/knowledge/sales/**/*",
    ],
    "/api/chat/agent/[agent]/stream": [
      "./data/knowledge/ceo/**/*",
      "./data/knowledge/finance/**/*",
      "./data/knowledge/sales/**/*",
    ],
  },
  serverExternalPackages: ["mammoth", "pdf-parse"],
};

export default nextConfig;
