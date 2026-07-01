export type Intent = "scrape" | "dev" | "ops" | "github" | "chat";

export interface IntentResult {
  intent: Intent;
  url?: string;
}
