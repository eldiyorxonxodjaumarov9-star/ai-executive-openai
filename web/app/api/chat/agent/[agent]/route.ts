import { NextRequest, NextResponse } from "next/server";
import { AGENT_DISPLAY_NAMES, normalizeAgent } from "@/lib/server/constants";
import { runQuickAnswer } from "@/lib/server/agents";
import { mapThrownError } from "@/lib/server/user-errors";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ agent: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  const { agent: agentParam } = await context.params;

  let body: {
    question?: string;
    message?: string;
    agentId?: string;
    conversationId?: string;
    refresh?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, detail: { code: "validation_error", message: "Noto'g'ri JSON." } },
      { status: 422 }
    );
  }

  const question = (body.message || body.question || "").trim();
  if (!question) {
    return NextResponse.json(
      {
        success: false,
        detail: { code: "validation_error", message: "Savol bo'sh bo'lishi mumkin emas." },
      },
      { status: 422 }
    );
  }

  try {
    const agentFromBody = body.agentId ? normalizeAgent(body.agentId) : normalizeAgent(agentParam);
    const agentFromUrl = normalizeAgent(agentParam);

    if (body.agentId && agentFromBody !== agentFromUrl) {
      return NextResponse.json(
        {
          success: false,
          detail: {
            code: "agent_mismatch",
            message: "URL agent va body agentId mos kelmaydi.",
          },
        },
        { status: 400 }
      );
    }

    const agent = agentFromBody;
    const result = await runQuickAnswer(agent, question, {
      bypassCache: Boolean(body.refresh),
      conversationId: body.conversationId,
    });

    return NextResponse.json({
      success: true,
      agent,
      agentId: agent,
      agent_display_name: AGENT_DISPLAY_NAMES[agent],
      conversationId: body.conversationId || null,
      mode: result.mode || "quick_answer",
      execution_ms: result.executionMs ?? null,
      intent: result.intent,
      domain_intent: result.domainIntent,
      question,
      answer: result.answer,
      crm_summary: result.crmSummary,
      data_freshness: result.dataFreshness || null,
      routing: {
        brain_files: result.brainFiles,
        knowledge_files: result.knowledgeFiles,
        crm_entities: result.crmEntities,
      },
    });
  } catch (e) {
    const mapped = mapThrownError(e);
    if (mapped.code === "internal_error") {
      console.error("chat agent error:", mapped.code);
    }
    return NextResponse.json(
      { success: false, detail: { code: mapped.code, message: mapped.message } },
      { status: mapped.httpStatus }
    );
  }
}
