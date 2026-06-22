export type Intent = "scrape" | "dev" | "chat";

export interface IntentResult {
  intent: Intent;
  url?: string;
}
