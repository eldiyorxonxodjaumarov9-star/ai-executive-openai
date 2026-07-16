import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/api/chat/agent/[agent]": ["../legacy/brains/**/*", "../knowledge/**/*"],
    "/api/test/openai": ["../legacy/brains/**/*", "../knowledge/**/*"],
  },
};

export default nextConfig;
