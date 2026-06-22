import { openai } from "./openaiClient.js";
import { env } from "../config/env.js";
import type { Intent, IntentResult } from "../types/intent.js";
import { classifyIntentByRules, extractUrl } from "./intentRouter.js";

const VALID_INTENTS: Intent[] = ["scrape", "dev", "chat"];

function parseIntentJson(raw: string): IntentResult | null {
  try {
    const parsed = JSON.parse(raw) as { intent?: string; url?: string };
    if (!parsed.intent || !VALID_INTENTS.includes(parsed.intent as Intent)) {
      return null;
    }

    const intent = parsed.intent as Intent;
    const url = parsed.url?.trim() || undefined;

    return { intent, url };
  } catch {
    return null;
  }
}

export async function classifyIntentWithLlm(
  text: string
): Promise<IntentResult> {
  const completion = await openai.chat.completions.create({
    model: env.llmModel,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: [
          "你是意圖分類器。分析使用者訊息，只回傳 JSON：",
          '{"intent":"scrape|dev|chat","url":"可選，scrape 時若有網址必填"}',
          "",
          "分類規則：",
          "- scrape：抓取/保存/整理網頁內容成筆記",
          "- dev：程式開發、改 code、解釋 repo、除錯、refactor、加功能",
          "- chat：一般問答、閒聊、與開發無關的問題",
        ].join("\n"),
      },
      { role: "user", content: text },
    ],
  });

  const content = completion.choices[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("LLM intent response empty");
  }

  const parsed = parseIntentJson(content);
  if (!parsed) {
    throw new Error("LLM intent response invalid");
  }

  if (parsed.intent === "scrape" && !parsed.url) {
    const url = extractUrl(text);
    if (url) {
      return { intent: "scrape", url };
    }
    throw new Error("LLM scrape intent missing url");
  }

  return parsed;
}

export async function resolveIntent(text: string): Promise<IntentResult> {
  if (env.intentRouter === "rules") {
    return classifyIntentByRules(text);
  }

  try {
    return await classifyIntentWithLlm(text);
  } catch (error) {
    console.warn("[intent] LLM routing failed, fallback to rules:", error);
    return classifyIntentByRules(text);
  }
}
