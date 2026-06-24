import { env } from "../config/env.js";

export interface ScrapeNoteResult {
  sourceUrl?: string;
  title?: string;
  summary: string;
}

export async function triggerScrapeNoteViaN8n(
  url: string,
  chatId: number
): Promise<ScrapeNoteResult> {
  if (!env.n8nWebhookUrl) {
    throw new Error("N8N_WEBHOOK_URL is not configured");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.scrapeTimeoutMs);

  try {
    const response = await fetch(env.n8nWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, chatId }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`n8n webhook error ${response.status}: ${body}`);
    }

    const data = (await response.json()) as {
      sourceUrl?: string;
      title?: string;
      summary?: string;
    };

    if (!data.summary?.trim()) {
      throw new Error("n8n response missing summary");
    }

    return {
      sourceUrl: data.sourceUrl,
      title: data.title,
      summary: data.summary,
    };
  } finally {
    clearTimeout(timeout);
  }
}
