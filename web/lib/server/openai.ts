import OpenAI from "openai";
import { assertOpenAIConfigured, getEnv } from "./env";

export class OpenAIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenAIError";
  }
}

function extractText(response: OpenAI.Responses.Response): string {
  const direct = response.output_text?.trim();
  if (direct) return direct;

  const parts: string[] = [];
  for (const item of response.output || []) {
    if (item.type !== "message") continue;
    for (const block of item.content || []) {
      if (block.type === "output_text" && block.text) parts.push(block.text);
    }
  }
  return parts.join("\n").trim();
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
    const response = await client.responses.create({
      model: openaiModel,
      instructions: systemPrompt,
      input: userPrompt,
      max_output_tokens: maxTokens,
    });

    const text = extractText(response);
    if (!text) throw new OpenAIError("OpenAI bo'sh javob qaytardi.");
    return text;
  } catch (e) {
    if (e instanceof OpenAIError) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("401") || msg.includes("Incorrect API key") || msg.includes("authentication")) {
      throw new OpenAIError("OpenAI API kaliti noto'g'ri — administrator bilan bog'laning.");
    }
    if (msg.includes("timeout") || msg.includes("timed out")) {
      throw new OpenAIError("OpenAI javobi vaqti tugadi — qayta urinib ko'ring.");
    }
    throw new OpenAIError("OpenAI bilan javob olishda xato yuz berdi — keyinroq qayta urinib ko'ring.");
  }
}

export async function testOpenAI(): Promise<{ success: boolean; response?: string; error?: string }> {
  try {
    const response = await chatCompletion(
      "Faqat o'zbek tilida javob ber.",
      "Faqat quyidagini yoz: OpenAI muvaffaqiyatli ulandi",
      32
    );
    return { success: true, response };
  } catch (e) {
    return {
      success: false,
      error: e instanceof OpenAIError ? e.message : "OpenAI ulanishi muvaffaqiyatsiz.",
    };
  }
}
