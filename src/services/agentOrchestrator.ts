import { env } from "../config/env.js";
import {
  clearSession,
  getSession,
  upsertSession,
} from "../repositories/sessionRepository.js";

type CursorSdk = typeof import("@cursor/sdk");
type SdkRun = Awaited<ReturnType<CursorSdk["Agent"]["create"]>> extends {
  send: (...args: never[]) => infer R;
}
  ? Awaited<R>
  : never;

const activeRuns = new Map<string, SdkRun>();

async function loadCursorSdk(): Promise<CursorSdk> {
  try {
    return await import("@cursor/sdk");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("node:sqlite")) {
      throw new Error(
        "Cursor SDK 需要 Node.js >= 22.13。請升級 Node 後再使用開發任務。"
      );
    }
    throw error;
  }
}

function assertCursorConfigured(): void {
  if (!env.cursorApiKey) {
    throw new Error(
      "尚未設定 CURSOR_API_KEY，無法執行開發任務。請在 .env 填入後重試。"
    );
  }
}

function collectAssistantText(
  content: Array<{ type: string; text?: string }>
): string {
  return content
    .filter((block) => block.type === "text" && block.text)
    .map((block) => block.text)
    .join("");
}

function agentBaseOptions(cwd: string) {
  return {
    apiKey: env.cursorApiKey,
    model: { id: env.agentModel },
    local: { cwd },
  };
}

async function openAgent(chatId: string, sdk: CursorSdk) {
  assertCursorConfigured();

  const session = getSession(chatId);
  const cwd = session?.cwd || env.defaultCwd;
  const options = agentBaseOptions(cwd);

  if (session?.agentId) {
    try {
      const agent = await sdk.Agent.resume(session.agentId, options);
      return { agent, cwd };
    } catch (error) {
      console.warn(
        `[agent] Resume failed for chat ${chatId}, creating new agent:`,
        error
      );
    }
  }

  const agent = await sdk.Agent.create(options);

  return { agent, cwd };
}

const DEV_TELEGRAM_HINT = `

回覆要求（Telegram 手機閱讀）：
- 用繁體中文
- 簡潔優先，避免長篇
- 不要 markdown 表格
- 若使用者未另行指定格式，用列點且 8 條以內`;

function buildDevPrompt(prompt: string): string {
  if (!env.devBriefReply) {
    return prompt;
  }
  return `${prompt}${DEV_TELEGRAM_HINT}`;
}

export async function sendDevPrompt(
  chatId: string,
  prompt: string
): Promise<{ text: string; agentId: string }> {
  assertCursorConfigured();

  const sdk = await loadCursorSdk();
  const fullPrompt = buildDevPrompt(prompt);

  const { agent, cwd } = await openAgent(chatId, sdk);

  upsertSession({
    chatId,
    agentId: agent.agentId,
    cwd,
    status: "running",
  });

  try {
    const run = await agent.send(fullPrompt, { model: { id: env.agentModel } });
    activeRuns.set(chatId, run);

    let text = "";
    for await (const event of run.stream()) {
      if (event.type === "assistant") {
        text += collectAssistantText(event.message.content);
      }
    }

    const result = await run.wait();
    if (result.status === "error") {
      throw new Error(`Agent run failed: ${result.id}`);
    }

    upsertSession({
      chatId,
      agentId: agent.agentId,
      cwd,
      status: "idle",
    });

    return {
      text: text.trim() || "（Agent 已完成，但沒有文字回覆）",
      agentId: agent.agentId,
    };
  } catch (error) {
    upsertSession({
      chatId,
      agentId: getSession(chatId)?.agentId ?? null,
      cwd,
      status: "error",
    });

    if (error instanceof sdk.CursorAgentError) {
      throw new Error(`Agent 啟動失敗：${error.message}`);
    }
    throw error;
  } finally {
    activeRuns.delete(chatId);
    await agent[Symbol.asyncDispose]();
  }
}

export async function startNewDevSession(chatId: string): Promise<void> {
  clearSession(chatId);
  activeRuns.delete(chatId);
}

export async function cancelDevRun(chatId: string): Promise<boolean> {
  const run = activeRuns.get(chatId);
  if (!run) {
    return false;
  }

  if (run.supports("cancel")) {
    await run.cancel();
    activeRuns.delete(chatId);
    upsertSession({
      chatId,
      agentId: getSession(chatId)?.agentId ?? null,
      cwd: getSession(chatId)?.cwd || env.defaultCwd,
      status: "idle",
    });
    return true;
  }

  return false;
}

export interface ForceResetDevResult {
  devRunCancelled: boolean;
  hadActiveRun: boolean;
  sessionReset: boolean;
  previousSessionStatus: string | null;
}

export async function forceResetDev(
  chatId: string
): Promise<ForceResetDevResult> {
  const sessionBefore = getSession(chatId);
  const previousSessionStatus = sessionBefore?.status ?? null;
  const hadActiveRun = activeRuns.has(chatId);
  let devRunCancelled = false;

  const run = activeRuns.get(chatId);
  if (run?.supports("cancel")) {
    try {
      await run.cancel();
      devRunCancelled = true;
    } catch (error) {
      console.warn(
        `[agent] force reset cancel failed for chat ${chatId}:`,
        error
      );
    }
  }
  activeRuns.delete(chatId);

  let sessionReset = false;
  if (
    sessionBefore &&
    (sessionBefore.status !== "idle" || sessionBefore.agentId)
  ) {
    upsertSession({
      chatId,
      agentId: null,
      cwd: sessionBefore.cwd,
      status: "idle",
    });
    sessionReset = true;
  }

  return {
    devRunCancelled,
    hadActiveRun,
    sessionReset,
    previousSessionStatus,
  };
}

type TestActiveRun = Pick<SdkRun, "supports" | "cancel">;

export function setActiveRunForTest(
  chatId: string,
  run: TestActiveRun
): void {
  activeRuns.set(chatId, run as SdkRun);
}

export function clearActiveRunsForTest(): void {
  activeRuns.clear();
}

export function isDevRunActive(chatId: string): boolean {
  return activeRuns.has(chatId);
}
