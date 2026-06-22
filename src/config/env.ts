import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const envPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.env"
);
dotenv.config({ path: envPath });

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`[env] Missing required environment variable: ${name}`);
    console.error(`[env] Expected in: ${envPath}`);
    process.exit(1);
  }
  return value;
}

function parseUserIds(raw: string): string[] {
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

function parseAllowedCwdRoots(raw: string | undefined, defaultCwd: string): string[] {
  if (raw?.trim()) {
    return raw
      .split(",")
      .map((p) => path.resolve(p.trim()))
      .filter(Boolean);
  }
  return [path.resolve(defaultCwd)];
}

function resolveDefaultCwd(): string {
  const configured = process.env.DEFAULT_CWD?.trim();
  if (configured) {
    return path.resolve(configured);
  }
  return path.resolve(projectRoot, "..");
}

const defaultCwd = resolveDefaultCwd();

export const env = {
  port: Number(process.env.PORT || 3001),
  telegramBotToken: requireEnv("TELEGRAM_BOT_TOKEN"),
  allowedUserIds: parseUserIds(requireEnv("ALLOWED_TELEGRAM_USER_IDS")),
  openaiApiKey: requireEnv("OPENAI_API_KEY"),
  llmModel: process.env.LLM_MODEL || "gpt-4o-mini",
  internalApiSecret: requireEnv("INTERNAL_API_SECRET"),
  sessionDbPath: process.env.SESSION_DB_PATH || "./data/bot.db",
  playwrightServiceUrl:
    process.env.PLAYWRIGHT_SERVICE_URL || "http://127.0.0.1:3100",
  scrapeMode: (process.env.SCRAPE_MODE || "inline") as "inline" | "n8n",
  n8nWebhookUrl: process.env.N8N_WEBHOOK_URL || "",
  scrapeTimeoutMs: Number(process.env.SCRAPE_TIMEOUT_MS || 120000),
  intentRouter: (process.env.INTENT_ROUTER || "llm") as "llm" | "rules",
  cursorApiKey: process.env.CURSOR_API_KEY?.trim() || "",
  agentModel: process.env.AGENT_MODEL || "composer-2.5",
  defaultCwd,
  allowedCwdRoots: parseAllowedCwdRoots(process.env.ALLOWED_CWD_ROOTS, defaultCwd),
  devBriefReply: process.env.DEV_BRIEF_REPLY !== "false",
  runTimeoutMs: Number(process.env.RUN_TIMEOUT_MS || 600000),
  telegramMode: (process.env.TELEGRAM_MODE || "polling") as "polling" | "webhook",
  webhookPath: process.env.WEBHOOK_PATH || "/telegram/webhook",
  webhookUrl: process.env.WEBHOOK_URL?.trim() || "",
};
