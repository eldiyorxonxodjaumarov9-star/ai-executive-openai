import { NextRequest } from "next/server";
import { normalizeAgent } from "@/lib/server/constants";
import { runQuickAnswerStream } from "@/lib/server/agents";
import { OpenAIError } from "@/lib/server/openai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ agent: string }> };

function sse(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest, context: RouteContext) {
  const { agent: agentParam } = await context.params;

  let body: {
    message?: string;
    question?: string;
    agentId?: string;
    conversationId?: string;
    refresh?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(sse({ type: "error", message: "Noto'g'ri JSON." }), {
      status: 422,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  const question = (body.message || body.question || "").trim();
  if (!question) {
    return new Response(sse({ type: "error", message: "Savol bo'sh." }), {
      status: 422,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  try {
    const agent = body.agentId ? normalizeAgent(body.agentId) : normalizeAgent(agentParam);
    const stream = new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder();
        try {
          for await (const event of runQuickAnswerStream(agent, question, {
            bypassCache: Boolean(body.refresh),
            conversationId: body.conversationId,
          })) {
            controller.enqueue(enc.encode(sse(event)));
          }
          controller.enqueue(enc.encode("data: [DONE]\n\n"));
        } catch (e) {
          const msg =
            e instanceof OpenAIError
              ? e.message
              : e instanceof Error
                ? e.message
                : "Stream xatosi";
          controller.enqueue(enc.encode(sse({ type: "error", message: msg })));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Stream boshlanmadi";
    return new Response(sse({ type: "error", message: msg }), {
      status: 500,
      headers: { "Content-Type": "text/event-stream" },
    });
  }
}
