import { NextRequest, NextResponse } from "next/server";
import { AGENT_DISPLAY_NAMES, normalizeAgent } from "@/lib/server/constants";
import { runQuickAnswer } from "@/lib/server/agents";
import { BitrixError } from "@/lib/server/bitrix";
import { OpenAIError } from "@/lib/server/openai";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type RouteContext = { params: Promise<{ agent: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  const { agent: agentParam } = await context.params;

  let body: { question?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, detail: { code: "validation_error", message: "Noto'g'ri JSON." } },
      { status: 422 }
    );
  }

  const question = (body.question || "").trim();
  if (!question) {
    return NextResponse.json(
      { success: false, detail: { code: "validation_error", message: "Savol bo'sh bo'lishi mumkin emas." } },
      { status: 422 }
    );
  }

  try {
    const agent = normalizeAgent(agentParam);
    const { answer, crmSummary, intent, domainIntent, brainFiles, knowledgeFiles, crmEntities } =
      await runQuickAnswer(agent, question);

    return NextResponse.json({
      success: true,
      agent,
      agent_display_name: AGENT_DISPLAY_NAMES[agent],
      mode: "quick_answer",
      intent,
      domain_intent: domainIntent,
      question,
      answer,
      crm_summary: crmSummary,
      routing: {
        brain_files: brainFiles,
        knowledge_files: knowledgeFiles,
        crm_entities: crmEntities,
      },
    });
  } catch (e) {
    if (e instanceof BitrixError) {
      return NextResponse.json(
        {
          success: false,
          detail: {
            code: "crm_error",
            message: "CRM ma'lumot olishda xato — Bitrix24 ulanishini tekshiring.",
          },
        },
        { status: 502 }
      );
    }
    if (e instanceof OpenAIError) {
      const msg = e.message;
      const isTimeout = msg.includes("vaqti tugadi");
      const isConfig = msg.includes("sozlanmagan") || msg.includes("kaliti");
      return NextResponse.json(
        {
          success: false,
          detail: {
            code: isTimeout ? "ai_timeout" : isConfig ? "ai_config_error" : "ai_error",
            message: msg,
          },
        },
        { status: isTimeout ? 504 : isConfig ? 503 : 502 }
      );
    }
    const msg = e instanceof Error ? e.message : "Kutilmagan xato";
    if (msg.includes("Agent nomi")) {
      return NextResponse.json(
        { success: false, detail: { code: "agent_invalid", message: msg } },
        { status: 400 }
      );
    }
    console.error("chat agent error:", e);
    return NextResponse.json(
      { success: false, detail: { code: "internal_error", message: "Server ichki xatosi." } },
      { status: 500 }
    );
  }
}
