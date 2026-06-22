import { createNote } from "../repositories/noteRepository.js";
import { summarizeWebPage } from "./llmClient.js";
import { scrapeUrl } from "./playwrightClient.js";
import { triggerScrapeNoteViaN8n } from "./workflowClient.js";
import { env } from "../config/env.js";

export interface ScrapeNoteInput {
  chatId: number;
  url: string;
}

export interface ScrapeNoteOutput {
  noteId: number;
  summary: string;
  title: string | null;
}

export async function runScrapeNote(
  input: ScrapeNoteInput
): Promise<ScrapeNoteOutput> {
  if (env.scrapeMode === "n8n") {
    const result = await triggerScrapeNoteViaN8n(input.url, input.chatId);
    return {
      noteId: result.noteId,
      summary: result.summary,
      title: null,
    };
  }

  const scraped = await scrapeUrl(input.url);
  const summary = await summarizeWebPage(
    scraped.url,
    scraped.title,
    scraped.text
  );

  const note = createNote({
    chatId: String(input.chatId),
    sourceUrl: scraped.url,
    title: scraped.title,
    summary,
    rawText: scraped.text.slice(0, 50000),
  });

  return {
    noteId: note.id,
    summary: note.summary,
    title: note.title,
  };
}
