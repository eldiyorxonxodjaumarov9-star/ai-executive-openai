import { NextRequest, NextResponse } from "next/server";
import { AGENT_DISPLAY_NAMES, normalizeAgent } from "@/lib/server/constants";
import { createExecutionPlan } from "@/lib/server/query-planner";
import { runExecutivePipeline } from "@/lib/server/executive-pipeline";
import { sanitizeDebugPayload } from "@/lib/server/pii-mask";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const agentParam = req.nextUrl.searchParams.get("agent") || "ceo";
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const refresh = req.nextUrl.searchParams.get("refresh") === "1";

  if (!q) {
    return NextResponse.json(
      { ok: false, error: "Parametr 'q' talab qilinadi", details: "?agent=ceo&q=..." },
      { status: 400 }
    );
  }

  try {
    const agent = normalizeAgent(agentParam);
    const plan = createExecutionPlan(agent, q);
    const result = await runExecutivePipeline(agent, q, { bypassCache: refresh });

    const ctx = result.orchestration.context;
    const payload = sanitizeDebugPayload({
      ok: true,
      agent: { id: agent, name: AGENT_DISPLAY_NAMES[agent] },
      planner: plan,
      tools: result.orchestration.stepResults.map((s) => ({
        name: s.name,
        success: s.success,
        durationMs: s.durationMs,
        error: s.error || null,
        meta: s.meta || null,
      })),
      reasoning: plan.reasoning,
      analytics: {
        summary: ctx.analytics?.base.summary ?? null,
        agentSpecific: ctx.analytics?.agentSpecific ?? null,
      },
      kpis: ctx.kpis,
      forecast: ctx.forecasts,
      risks: ctx.risks.slice(0, 10),
      recommendations: ctx.recommendations,
      dataFreshness: {
        fetchedAt: result.fetchedAt,
        timezone: "Asia/Tashkent",
        source: "Bitrix24",
        cached: result.cached,
      },
      entitiesFetched: ctx.loaded.entitiesFetched,
      limitations: ctx.loaded.limitations,
      collaboratorInsights: Object.keys(ctx.collaboratorInsights),
      executionTimeMs: result.orchestration.totalDurationMs,
      error: null,
    });

    return NextResponse.json(payload);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Executive debug xatosi";
    console.error("[debug/executive]", message);
    return NextResponse.json(
      sanitizeDebugPayload({ ok: false, error: message, details: "executive pipeline failed" }),
      { status: 500 }
    );
  }
}
