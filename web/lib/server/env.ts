export function getEnv() {
  const aiProvider = (process.env.AI_PROVIDER || "openai").trim().toLowerCase();
  const bitrixUrl = (process.env.BITRIX24_WEBHOOK_URL || "").trim().replace(/\/$/, "");
  const openaiKey = (process.env.OPENAI_API_KEY || "").trim();
  const openaiModel = (process.env.OPENAI_MODEL || "gpt-4o-mini").trim();

  return {
    aiProvider,
    bitrixWebhookUrl: bitrixUrl,
    openaiApiKey: openaiKey,
    openaiModel,
    bitrixLeadsLimit: parseInt(process.env.BITRIX_LEADS_LIMIT || "50", 10),
    bitrixDealsLimit: parseInt(process.env.BITRIX_DEALS_LIMIT || "50", 10),
    bitrixContactsLimit: parseInt(process.env.BITRIX_CONTACTS_LIMIT || "50", 10),
    bitrixTasksLimit: parseInt(process.env.BITRIX_TASKS_LIMIT || "50", 10),
    quickMaxTokens: parseInt(process.env.OPENAI_QUICK_MAX_TOKENS || "800", 10),
    fullMaxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || "3000", 10),
  };
}

export function assertBitrixConfigured() {
  const { bitrixWebhookUrl } = getEnv();
  if (!bitrixWebhookUrl) {
    throw new Error("BITRIX24_WEBHOOK_URL sozlanmagan.");
  }
}

export function assertOpenAIConfigured() {
  const { openaiApiKey, aiProvider } = getEnv();
  if (aiProvider !== "openai") {
    throw new Error(`AI_PROVIDER=${aiProvider}. OpenAI uchun AI_PROVIDER=openai sozlang.`);
  }
  if (!openaiApiKey) {
    throw new Error("OPENAI_API_KEY sozlanmagan.");
  }
}
