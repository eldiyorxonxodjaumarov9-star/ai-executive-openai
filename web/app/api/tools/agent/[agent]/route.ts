import { NextRequest, NextResponse } from "next/server";
import { AGENT_DISPLAY_NAMES, normalizeAgent } from "@/lib/server/constants";
import { runFullReport } from "@/lib/server/agents";
import { BitrixError } from "@/lib/server/bitrix";
import { OpenAIError } from "@/lib/server/openai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ agent: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  const { agent: agentParam } = await context.params;

  let body: { question?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Noto'g'ri JSON." }, { status: 422 });
  }

  const question = (body.question || "To'liq hisobot").trim();

  try {
    const agent = normalizeAgent(agentParam);
    const { answer, crmSummary } = await runFullReport(agent, question);

    return NextResponse.json({
      success: true,
      agent,
      agent_display_name: AGENT_DISPLAY_NAMES[agent],
      mode: "full_report",
      question,
      data: { answer },
      crm_summary: crmSummary,
    });
  } catch (e) {
    if (e instanceof BitrixError) {
      return NextResponse.json(
        { success: false, error: "CRM ma'lumot olishda xato — Bitrix24 ulanishini tekshiring." },
        { status: 502 }
      );
    }
    if (e instanceof OpenAIError) {
      return NextResponse.json({ success: false, error: e.message }, { status: 502 });
    }
    const msg = e instanceof Error ? e.message : "Kutilmagan xato";
    if (msg.includes("Agent nomi")) {
      return NextResponse.json({ success: false, error: msg }, { status: 400 });
    }
    console.error("tools agent error:", e);
    return NextResponse.json({ success: false, error: "Server ichki xatosi." }, { status: 500 });
  }
}
