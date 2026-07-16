import { NextResponse } from "next/server";
import { checkBitrixHealth } from "@/lib/server/bitrix";

export const dynamic = "force-dynamic";

export async function GET() {
  const health = await checkBitrixHealth();
  return NextResponse.json(health, { status: health.connected ? 200 : 502 });
}
