import { env } from "../config/env.js";

export interface ScrapeNoteResult {
  noteId: number;
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
      noteId?: number;
      summary?: string;
    };

    if (!data.noteId) {
      throw new Error("n8n response missing noteId");
    }

    return {
      noteId: data.noteId,
      summary: data.summary ?? "",
    };
  } finally {
    clearTimeout(timeout);
  }
}
