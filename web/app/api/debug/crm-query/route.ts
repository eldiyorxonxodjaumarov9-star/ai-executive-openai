import { NextRequest, NextResponse } from "next/server";
import { analyzeCrmQuery } from "@/lib/server/crm-query-router";
import { fetchCrmAnalytics } from "@/lib/server/crm-router";
import { buildCrmAnalyticsPreview } from "@/lib/server/crm-analytics";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json(
      { ok: false, error: "Parametr 'q' talab qilinadi", details: "Masalan: ?q=Jami nechta bitim bor" },
      { status: 400 }
    );
  }

  try {
    const routing = analyzeCrmQuery(q);
    const result = await fetchCrmAnalytics(q);

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

    const analytics = result.analytics;

    return NextResponse.json({
      ok: true,
      query: q,
      routing: {
        intent: routing.intent,
        domain: routing.domain,
        metric: routing.metric,
        date_range: {
          from: routing.dateRange.fromIso,
          to: routing.dateRange.toIso,
          label: routing.dateRange.label,
          explicit: routing.dateRange.explicit,
        },
        employee: routing.employee,
        stage: routing.stage,
        aggregation: routing.aggregation,
        dealStatusFilter: routing.dealStatusFilter,
        matchedKeywords: routing.matchedKeywords,
      },
      filters: {
        dealStatusFilter: routing.dealStatusFilter,
        dateExplicit: routing.dateRange.explicit,
        employee: routing.employee,
      },
      totalDealsLoaded: analytics?.totalDealsLoaded ?? 0,
      matchedDeals: analytics?.matchedDealsCount ?? 0,
      analytics: analytics ? buildCrmAnalyticsPreview(analytics) : {},
      contextPreview: analytics
        ? {
            hasContext: true,
            contextLength: result.data.salesBlock?.length ?? 0,
            summary: analytics.summary,
            periodStats: analytics.periodStats,
            notes: analytics.notes,
          }
        : { hasContext: false },
      error: null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "CRM query diagnostika xatosi";
    console.error("[debug/crm-query]", message);
    return NextResponse.json(
      { ok: false, error: "CRM diagnostika bajarilmadi", details: message },
      { status: 500 }
    );
  }
}
