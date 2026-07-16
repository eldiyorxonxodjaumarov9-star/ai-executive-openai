import { NextResponse } from "next/server";
import { VALID_AGENTS } from "@/lib/server/constants";
import { getEnv } from "@/lib/server/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const env = getEnv();
  const openaiConfigured = Boolean(env.openaiApiKey);

  return NextResponse.json({
    ok: true,
    status: "ok",
    app_name: "AI Executive Platform",
    environment: process.env.VERCEL_ENV || "development",
    agents: VALID_AGENTS,
    ai_provider: "openai",
    ai_configured: openaiConfigured,
    openai_configured: openaiConfigured,
    claude_legacy_configured: false,
    ai_model: env.openaiModel,
  });
}
