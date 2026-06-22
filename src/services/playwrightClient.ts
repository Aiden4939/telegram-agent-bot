import { env } from "../config/env.js";

export interface ScrapeResult {
  url: string;
  title: string;
  text: string;
}

export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.scrapeTimeoutMs);

  try {
    const response = await fetch(`${env.playwrightServiceUrl}/scrape`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Playwright service error ${response.status}: ${body}`);
    }

    return (await response.json()) as ScrapeResult;
  } finally {
    clearTimeout(timeout);
  }
}
