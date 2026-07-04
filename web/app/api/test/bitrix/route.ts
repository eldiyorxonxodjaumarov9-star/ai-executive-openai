import { NextResponse } from "next/server";
import { testBitrixConnection } from "@/lib/server/bitrix";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await testBitrixConnection();
  return NextResponse.json(result, { status: result.success ? 200 : 502 });
}
