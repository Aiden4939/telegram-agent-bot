export type Intent = "scrape" | "dev" | "ops" | "securities" | "chat";

export interface IntentResult {
  intent: Intent;
  url?: string;
}
