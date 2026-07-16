import { NextResponse } from "next/server";
import { fetchAllDealsComplete, fetchDealStages } from "@/lib/server/bitrix";
import { getTodaySalesDebugStats } from "@/lib/server/sales-analytics";

export const dynamic = "force-dynamic";

function isDevEnvironment(): boolean {
  const env = process.env.VERCEL_ENV || process.env.NODE_ENV || "development";
  return env === "development" || env === "preview";
}

export async function GET() {
  if (!isDevEnvironment()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const [deals, stages] = await Promise.all([fetchAllDealsComplete(), fetchDealStages()]);
    const stats = getTodaySalesDebugStats(deals, stages);
    return NextResponse.json(stats);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Debug fetch failed";
    console.error("[debug/today-sales]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
