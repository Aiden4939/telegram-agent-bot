export type Intent = "scrape" | "dev" | "ops" | "chat";

export interface IntentResult {
  intent: Intent;
  url?: string;
}
