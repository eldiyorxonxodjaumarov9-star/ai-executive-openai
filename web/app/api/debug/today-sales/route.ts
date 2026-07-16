import { NextResponse } from "next/server";
import { BitrixError, fetchAllDealsCompleteWithMeta, fetchDealStages } from "@/lib/server/bitrix";
import { buildTodaySalesDebugPayload } from "@/lib/server/sales-analytics";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    const [{ deals, paginationPages }, stages] = await Promise.all([
      fetchAllDealsCompleteWithMeta(),
      fetchDealStages(),
    ]);

    const payload = buildTodaySalesDebugPayload(deals, stages, paginationPages);
    return NextResponse.json(payload);
  } catch (e) {
    const error = e instanceof BitrixError ? e.message : "Bitrix24 diagnostika xatosi";
    const details =
      e instanceof BitrixError
        ? e.code || "bitrix_error"
        : e instanceof Error
          ? e.message
          : "unknown_error";

    console.error("[debug/today-sales]", { error, details });

    return NextResponse.json(
      {
        ok: false,
        error,
        details: typeof details === "string" ? details : "Diagnostika bajarilmadi",
      },
      { status: 500 }
    );
  }
}
