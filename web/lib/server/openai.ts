import OpenAI from "openai";
import { assertOpenAIConfigured, getEnv } from "./env";

export class OpenAIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenAIError";
  }
}

export async function chatCompletion(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number
): Promise<string> {
  assertOpenAIConfigured();
  const { openaiApiKey, openaiModel } = getEnv();

  const client = new OpenAI({ apiKey: openaiApiKey, timeout: 55000, maxRetries: 2 });

  try {
    const response = await client.chat.completions.create({
      model: openaiModel,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const text = response.choices[0]?.message?.content?.trim();
    if (!text) throw new OpenAIError("OpenAI bo'sh javob qaytardi.");
    return text;
  } catch (e) {
    if (e instanceof OpenAIError) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("401") || msg.includes("Incorrect API key")) {
      throw new OpenAIError("OpenAI API kaliti noto'g'ri — OPENAI_API_KEY ni tekshiring.");
    }
    if (msg.includes("timeout") || msg.includes("timed out")) {
      throw new OpenAIError("OpenAI javobi vaqti tugadi — qayta urinib ko'ring.");
    }
    throw new OpenAIError(`OpenAI xatosi: ${msg}`);
  }
}

export async function testOpenAI(): Promise<{ success: boolean; response?: string; error?: string }> {
  try {
    const response = await chatCompletion(
      "You are an AI assistant.",
      "Reply with exactly: OpenAI Connected Successfully",
      32
    );
    return { success: true, response };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "OpenAI test failed" };
  }
}
