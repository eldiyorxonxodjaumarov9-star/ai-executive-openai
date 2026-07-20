import { NextRequest, NextResponse } from "next/server";
import { routeQuery } from "@/lib/server/router/route-query";
import { runQuickAnswer } from "@/lib/server/agents";
import { AGENT_DISPLAY_NAMES, normalizeAgent } from "@/lib/server/constants";
import { mapThrownError } from "@/lib/server/user-errors";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  let body: { question?: string; message?: string; refresh?: boolean };
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

  const route = routeQuery(question);
  const targetAgent =
    route.primaryAgent === "ceo" && route.secondaryAgents.length > 0
      ? "ceo"
      : route.primaryAgent;

  try {
    const agent = normalizeAgent(targetAgent);
    const result = await runQuickAnswer(agent, question, { bypassCache: Boolean(body.refresh) });

    return NextResponse.json({
      success: true,
      routed: route,
      agent,
      agent_display_name: AGENT_DISPLAY_NAMES[agent],
      mode: result.mode || "quick_answer",
      answer: result.answer,
      intent: result.intent,
      domain_intent: result.domainIntent,
    });
  } catch (e) {
    const mapped = mapThrownError(e);
    return NextResponse.json(
      { success: false, detail: { code: mapped.code, message: mapped.message } },
      { status: mapped.httpStatus }
    );
  }
}
