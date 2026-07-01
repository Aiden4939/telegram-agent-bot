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

function parseCsv(raw: string | undefined): string[] {
  if (!raw?.trim()) {
    return [];
  }
  return raw
    .split(",")
    .map((item) => item.trim())
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
const cloudRepos = parseCsv(process.env.CLOUD_REPOS);
const port = Number(process.env.PORT || 3001);
const playwrightServiceUrl =
  process.env.PLAYWRIGHT_SERVICE_URL || "http://127.0.0.1:3100";

function parsePositiveInt(
  raw: string | undefined,
  fallback: number,
  max: number
): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.min(Math.floor(value), max);
}

function resolveOpsHealthUrls(): string[] {
  const configured = parseCsv(process.env.OPS_HEALTH_URLS);
  if (configured.length > 0) {
    return configured;
  }

  return [
    `http://127.0.0.1:${port}/health`,
    `${playwrightServiceUrl.replace(/\/$/, "")}/health`,
  ];
}

export const env = {
  port,
  telegramBotToken: requireEnv("TELEGRAM_BOT_TOKEN"),
  allowedUserIds: parseUserIds(requireEnv("ALLOWED_TELEGRAM_USER_IDS")),
  openaiApiKey: requireEnv("OPENAI_API_KEY"),
  llmModel: process.env.LLM_MODEL || "gpt-4o-mini",
  internalApiSecret: requireEnv("INTERNAL_API_SECRET"),
  sessionDbPath: process.env.SESSION_DB_PATH || "./data/bot.db",
  playwrightServiceUrl,
  scrapeMode: (process.env.SCRAPE_MODE || "inline") as "inline" | "n8n",
  n8nWebhookUrl: process.env.N8N_WEBHOOK_URL || "",
  scrapeTimeoutMs: Number(process.env.SCRAPE_TIMEOUT_MS || 120000),
  intentRouter: (process.env.INTENT_ROUTER || "llm") as "llm" | "rules",
  cursorApiKey: process.env.CURSOR_API_KEY?.trim() || "",
  agentModel: process.env.AGENT_MODEL || "composer-2.5",
  devRuntime: (process.env.DEV_RUNTIME || "local") as "local" | "cloud",
  defaultCwd,
  allowedCwdRoots: parseAllowedCwdRoots(process.env.ALLOWED_CWD_ROOTS, defaultCwd),
  cloudRepos,
  cloudBaseBranch: process.env.CLOUD_BASE_BRANCH?.trim() || "main",
  cloudAutoCreatePr: process.env.CLOUD_AUTO_CREATE_PR !== "false",
  cloudSkipReviewerRequest: process.env.CLOUD_SKIP_REVIEWER_REQUEST !== "false",
  devBriefReply: process.env.DEV_BRIEF_REPLY !== "false",
  runTimeoutMs: Number(process.env.RUN_TIMEOUT_MS || 600000),
  telegramMode: (process.env.TELEGRAM_MODE || "polling") as "polling" | "webhook",
  webhookPath: process.env.WEBHOOK_PATH || "/telegram/webhook",
  webhookUrl: process.env.WEBHOOK_URL?.trim() || "",
  opsEnabled: process.env.OPS_ENABLED !== "false",
  opsDockerEnabled: process.env.OPS_DOCKER_ENABLED === "true",
  opsAllowedContainers: parseCsv(process.env.OPS_ALLOWED_CONTAINERS),
  opsHealthUrls: resolveOpsHealthUrls(),
  opsCommandTimeoutMs: parsePositiveInt(
    process.env.OPS_COMMAND_TIMEOUT_MS,
    30000,
    120000
  ),
  opsLogTailLines: parsePositiveInt(process.env.OPS_LOG_TAIL_LINES, 50, 500),
  githubToken: process.env.GITHUB_TOKEN?.trim() || "",
  githubAllowedRepos: parseCsv(process.env.GITHUB_ALLOWED_REPOS),
  githubIssueLimit: parsePositiveInt(process.env.GITHUB_ISSUE_LIMIT, 10, 30),
  taskMaxModelCalls: parsePositiveInt(process.env.TASK_MAX_MODEL_CALLS, 30, 1000),
  taskMaxToolCalls: parsePositiveInt(process.env.TASK_MAX_TOOL_CALLS, 80, 5000),
  taskMaxRuntimeMs: parsePositiveInt(process.env.TASK_MAX_RUNTIME_MS, 900000, 86_400_000),
  taskMaxEstimatedCost: Number(process.env.TASK_MAX_ESTIMATED_COST || 5),
  dailyMaxEstimatedCost: Number(process.env.DAILY_MAX_ESTIMATED_COST || 50),
  monthlyMaxEstimatedCost: Number(process.env.MONTHLY_MAX_ESTIMATED_COST || 500),
  logMaxLines: parsePositiveInt(process.env.LOG_MAX_LINES, 80, 1000),
  logMaxBytes: parsePositiveInt(process.env.LOG_MAX_BYTES, 12000, 2_000_000),
  taskApprovalTtlMs: parsePositiveInt(process.env.TASK_APPROVAL_TTL_MS, 900000, 86_400_000),
  toolCallTimeoutMs: parsePositiveInt(process.env.TOOL_CALL_TIMEOUT_MS, 120000, 3_600_000),
  modelCallTimeoutMs: parsePositiveInt(process.env.MODEL_CALL_TIMEOUT_MS, 120000, 3_600_000),
  taskHeartbeatTimeoutMs: parsePositiveInt(
    process.env.TASK_HEARTBEAT_TIMEOUT_MS,
    300000,
    86_400_000
  ),
  userMessagePerMinuteLimit: parsePositiveInt(
    process.env.USER_MESSAGE_PER_MINUTE_LIMIT,
    15,
    200
  ),
  userConcurrentDevTaskLimit: parsePositiveInt(
    process.env.USER_CONCURRENT_DEV_TASK_LIMIT,
    1,
    10
  ),
  globalConcurrentAgentLimit: parsePositiveInt(
    process.env.GLOBAL_CONCURRENT_AGENT_LIMIT,
    3,
    50
  ),
  minAgentStartIntervalMs: parsePositiveInt(
    process.env.MIN_AGENT_START_INTERVAL_MS,
    60000,
    3_600_000
  ),
  taskCiPollIntervalSeconds: parsePositiveInt(
    process.env.TASK_CI_POLL_INTERVAL_SECONDS,
    20,
    600
  ),
  taskCiTimeoutSeconds: parsePositiveInt(
    process.env.TASK_CI_TIMEOUT_SECONDS,
    1800,
    86_400
  ),
  taskCiMaxPolls: parsePositiveInt(process.env.TASK_CI_MAX_POLLS, 120, 5000),
  taskMaxAgentResumes: parsePositiveInt(process.env.TASK_MAX_AGENT_RESUMES, 3, 20),
  taskMaxCiFixAttempts: parsePositiveInt(process.env.TASK_MAX_CI_FIX_ATTEMPTS, 3, 20),
};
