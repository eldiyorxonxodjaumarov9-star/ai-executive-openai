import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/api/chat/agent/[agent]": ["../brains/**/*", "../knowledge/**/*"],
    "/api/test/openai": ["../brains/**/*", "../knowledge/**/*"],
  },
};

export default nextConfig;
