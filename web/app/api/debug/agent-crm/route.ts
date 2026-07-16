import { NextRequest, NextResponse } from "next/server";
import { AGENT_DISPLAY_NAMES, normalizeAgent } from "@/lib/server/constants";
import { analyzeCrmQuery } from "@/lib/server/crm-query-router";
import { fetchCrmAnalytics } from "@/lib/server/crm-router";
import { buildCrmAnalyticsPreview } from "@/lib/server/crm-analytics";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const agentParam = req.nextUrl.searchParams.get("agent") || "ceo";
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const refresh = req.nextUrl.searchParams.get("refresh") === "1";

  if (!q) {
    return NextResponse.json(
      { ok: false, error: "Parametr 'q' talab qilinadi", details: "?agent=sales&q=..." },
      { status: 400 }
    );
  }

  try {
    const agent = normalizeAgent(agentParam);
    const routing = analyzeCrmQuery(q);
    const result = await fetchCrmAnalytics(q, agent, { bypassCache: refresh });

    if (result.fetchStatus === "webhook_error" || result.fetchStatus === "permission_denied") {
      return NextResponse.json(
        {
          ok: false,
          error: result.fetchLogReason || "Bitrix24 xatosi",
          details: result.fetchStatus,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      agent: {
        id: agent,
        name: AGENT_DISPLAY_NAMES[agent],
      },
      routing: {
        intent: routing.intent,
        domain: routing.domain,
        metric: routing.metric,
        date_range: {
          from: routing.dateRange.fromIso,
          to: routing.dateRange.toIso,
          label: routing.dateRange.label,
        },
        aggregation: routing.aggregation,
      },
      dataFreshness: {
        fetchedAt: result.fetchedAt,
        timezone: "Asia/Tashkent",
        source: "Bitrix24",
        cached: result.cached ?? false,
      },
      entitiesFetched: result.data.summary,
      analytics: result.analytics ? buildCrmAnalyticsPreview(result.analytics) : {},
      contextPreview: {
        hasContext: Boolean(result.data.salesBlock),
        contextLength: result.data.salesBlock?.length ?? 0,
        structured: result.contextStructured ?? null,
      },
      limitations: result.limitations ?? [],
      error: null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Agent CRM diagnostika xatosi";
    console.error("[debug/agent-crm]", message);
    return NextResponse.json(
      { ok: false, error: "Diagnostika bajarilmadi", details: message },
      { status: 500 }
    );
  }
}
