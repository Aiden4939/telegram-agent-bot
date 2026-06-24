import { summarizeWebPage } from "./llmClient.js";
import { scrapeUrl } from "./playwrightClient.js";
import { triggerScrapeNoteViaN8n } from "./workflowClient.js";
import { env } from "../config/env.js";

export interface ScrapeNoteInput {
  chatId: number;
  url: string;
}

export interface ScrapeNoteOutput {
  sourceUrl: string;
  summary: string;
  title: string | null;
}

export async function runScrapeNote(
  input: ScrapeNoteInput
): Promise<ScrapeNoteOutput> {
  if (env.scrapeMode === "n8n") {
    const result = await triggerScrapeNoteViaN8n(input.url, input.chatId);
    return {
      sourceUrl: result.sourceUrl || input.url,
      summary: result.summary,
      title: result.title ?? null,
    };
  }

  const scraped = await scrapeUrl(input.url);
  const summary = await summarizeWebPage(
    scraped.url,
    scraped.title,
    scraped.text
  );

  return {
    sourceUrl: scraped.url,
    summary,
    title: scraped.title,
  };
}
