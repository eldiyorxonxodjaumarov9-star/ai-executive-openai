import { NextResponse } from "next/server";
import { getEnv } from "@/lib/server/env";
import { testOpenAI } from "@/lib/server/openai";

export const dynamic = "force-dynamic";

export async function GET() {
  const env = getEnv();
  const result = await testOpenAI();
  return NextResponse.json({
    ...result,
    provider: env.aiProvider,
    model: env.openaiModel,
  });
}
