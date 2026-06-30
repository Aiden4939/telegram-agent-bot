import { Bot, type Context } from "grammy";
import { webhookCallback } from "grammy";
import type { Application } from "express";
import path from "node:path";
import { registerBotCommands } from "../config/botCommands.js";
import { HELP_TEXT, START_TEXT } from "../config/helpText.js";
import { env } from "../config/env.js";
import {
  getSession,
  updateSessionCwd,
} from "../repositories/sessionRepository.js";
import {
  cancelDevRun,
  isDevRunActive,
  sendDevPrompt,
  startNewDevSession,
} from "./agentOrchestrator.js";
import {
  clearScrapeBusy,
  isChatTaskLocked,
  isScrapeBusy,
  isPendingOps,
  markPendingDev,
  markPendingOps,
  markScrapeBusy,
  clearPendingDev,
  clearPendingOps,
} from "./chatTaskState.js";
import {
  formatForceResetMessage,
  performForceReset,
} from "./forceReset.js";
import { extractUrl } from "./intentRouter.js";
import { resolveIntent } from "./llmIntentRouter.js";
import { chat } from "./llmClient.js";
import { runScrapeNote } from "./scrapeNoteService.js";
import { planOpsAction } from "./opsPlanner.js";
import { executeOpsPlan, formatOpsResult } from "./opsExecutor.js";
import { getCurrentCwd, resolveAllowedCwd } from "../utils/cwd.js";
import {
  chunkMessage,
  plainTextForTelegram,
} from "../utils/messageChunk.js";

function isAllowed(userId: number | undefined): userId is number {
  if (!userId) {
    return false;
  }
  return env.allowedUserIds.includes(String(userId));
}

function isBusy(chatId: number): boolean {
  return isChatTaskLocked(chatId) || isDevRunActive(String(chatId));
}

function parseCommandArgs(text: string): string[] {
  return text
    .trim()
    .split(/\s+/)
    .slice(1)
    .map((part) => part.trim())
    .filter(Boolean);
}

async function sendTextChunks(ctx: Context, text: string): Promise<void> {
  const chunks = chunkMessage(plainTextForTelegram(text));
  for (const chunk of chunks) {
    await ctx.reply(chunk);
  }
}

async function replyInChunks(
  ctx: Context,
  chatId: number,
  statusMsgId: number,
  text: string,
  footer?: string
): Promise<void> {
  const body = plainTextForTelegram(text);
  const full = footer ? `${body}\n\n${footer}` : body;
  const chunks = chunkMessage(full);
  await ctx.api.editMessageText(chatId, statusMsgId, chunks[0] ?? "（無回覆）");
  for (const chunk of chunks.slice(1)) {
    await ctx.reply(chunk);
  }
}

async function handleScrape(ctx: Context, url: string): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) {
    return;
  }

  if (isBusy(chatId)) {
    await ctx.reply("目前有任務進行中，請稍候或使用 /cancel、/reset。");
    return;
  }

  markScrapeBusy(chatId);
  const statusMsg = await ctx.reply(`處理中…正在抓取：${url}`);

  void (async () => {
    try {
      const result = await runScrapeNote({ chatId, url });
      const preview = result.summary.slice(0, 500);
      const titleLine = result.title ? `\n標題：${result.title}` : "";

      await ctx.api.editMessageText(
        chatId,
        statusMsg.message_id,
        `已完成，來源：${result.sourceUrl}${titleLine}\n\n${preview}${
          result.summary.length > 500 ? "…" : ""
        }`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await ctx.api.editMessageText(
        chatId,
        statusMsg.message_id,
        `處理失敗：${message}`
      );
    } finally {
      clearScrapeBusy(chatId);
    }
  })();
}

async function handleDev(ctx: Context, text: string): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) {
    return;
  }

  if (isBusy(chatId)) {
    await ctx.reply("目前有任務進行中，請稍候或使用 /cancel、/reset。");
    return;
  }

  markPendingDev(chatId);
  const statusMsg = await ctx.reply("Agent 開發任務處理中…");

  void (async () => {
    try {
      const result = await sendDevPrompt(String(chatId), text);
      await replyInChunks(
        ctx,
        chatId,
        statusMsg.message_id,
        result.text,
        `— agent: ${result.agentId}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await ctx.api.editMessageText(
        chatId,
        statusMsg.message_id,
        `開發任務失敗：${message}`
      );
    } finally {
      clearPendingDev(chatId);
    }
  })();
}

async function handleChat(ctx: Context, text: string): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) {
    return;
  }

  if (isBusy(chatId)) {
    await ctx.reply("目前有任務進行中，請稍候。");
    return;
  }

  const statusMsg = await ctx.reply("思考中…");

  void (async () => {
    try {
      const answer = await chat(text);
      await replyInChunks(ctx, chatId, statusMsg.message_id, answer);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await ctx.api.editMessageText(
        chatId,
        statusMsg.message_id,
        `回覆失敗：${message}`
      );
    }
  })();
}

async function handleOps(ctx: Context, text: string): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) {
    return;
  }

  if (isBusy(chatId)) {
    await ctx.reply("目前有任務進行中，請稍候或使用 /cancel、/reset。");
    return;
  }

  if (!env.opsEnabled) {
    await ctx.reply("ops 執行器未啟用（OPS_ENABLED=false）。");
    return;
  }

  markPendingOps(chatId);
  const statusMsg = await ctx.reply("主機操作處理中…");

  void (async () => {
    try {
      const plan = await planOpsAction(text);
      const result = await executeOpsPlan(plan);
      try {
        await replyInChunks(
          ctx,
          chatId,
          statusMsg.message_id,
          formatOpsResult(result)
        );
      } catch (replyError) {
        const message =
          replyError instanceof Error ? replyError.message : String(replyError);
        await ctx.reply(`主機操作完成，但回覆失敗：${message}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await ctx.api.editMessageText(
        chatId,
        statusMsg.message_id,
        `主機操作失敗：${message}`
      );
    } finally {
      clearPendingOps(chatId);
    }
  })();
}

export function createBot(): Bot {
  const bot = new Bot(env.telegramBotToken);

  bot.use(async (ctx, next) => {
    if (!isAllowed(ctx.from?.id)) {
      return;
    }
    await next();
  });

  bot.command("start", async (ctx) => {
    await ctx.reply(START_TEXT);
  });

  bot.command("help", async (ctx) => {
    await sendTextChunks(ctx, HELP_TEXT);
  });

  bot.command("status", async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) {
      return;
    }

    const session = getSession(String(chatId));
    const busy = isBusy(chatId);

    await ctx.reply(
      [
        `意圖路由：${env.intentRouter}`,
        `網頁分析執行：${env.scrapeMode}`,
        `Telegram 模式：${env.telegramMode}`,
        `開發執行：${env.devRuntime}`,
        `開發 cwd：${getCurrentCwd(String(chatId))}`,
        `Cloud repos：${env.cloudRepos.join(",") || "（未設定）"}`,
        `Ops 執行器：${env.opsEnabled ? "開啟" : "關閉"}`,
        `Ops docker：${env.opsDockerEnabled ? "開啟" : "關閉"}`,
        `Ops 容器白名單：${env.opsAllowedContainers.join(",") || "（未設定）"}`,
        `Agent session：${session?.agentId || "（無）"}`,
        `Cursor SDK：${env.cursorApiKey ? "已設定" : "未設定"}`,
        `簡短 dev 回覆：${env.devBriefReply ? "開啟" : "關閉"}`,
        `狀態：${busy ? "處理中" : "閒置"}`,
      ].join("\n")
    );
  });

  bot.command("cwd", async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId || !ctx.message?.text) {
      return;
    }

    const args = parseCommandArgs(ctx.message.text);
    const chatKey = String(chatId);

    if (args.length === 0) {
      await ctx.reply(
        [
          `目前開發目錄：`,
          getCurrentCwd(chatKey),
          "",
          `允許根目錄：`,
          ...env.allowedCwdRoots.map((root) => `• ${root}`),
          "",
          "切換：/cwd <路徑>",
        ].join("\n")
      );
      return;
    }

    const requested = path.resolve(args.join(" "));
    const resolved = resolveAllowedCwd(requested);
    if (!resolved) {
      await ctx.reply("此路徑不在允許清單內，請換一個目錄。");
      return;
    }

    updateSessionCwd(chatKey, resolved);
    await ctx.reply(
      `已切換開發目錄為：\n${resolved}\n\n（已清除 agent session，下次開發任務會用新目錄）`
    );
  });

  bot.command("new", async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) {
      return;
    }

    if (isBusy(chatId)) {
      await ctx.reply("目前有任務進行中，請先 /cancel 或 /reset。");
      return;
    }

    await startNewDevSession(String(chatId));
    await ctx.reply("已開啟新的開發 Agent session。");
  });

  bot.command("cancel", async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) {
      return;
    }

    const cancelled = await cancelDevRun(String(chatId));
    if (isScrapeBusy(chatId)) {
      await ctx.reply("爬蟲任務進行中，暫不支援中途取消。卡死時請用 /reset。");
      return;
    }

    if (cancelled) {
      await ctx.reply("已取消進行中的開發任務。");
      return;
    }

    if (isPendingOps(chatId)) {
      clearPendingOps(chatId);
      await ctx.reply(
        "已解除 ops 忙碌狀態。背景請求可能仍在執行，完成後不會再更新訊息。卡死時請用 /reset。"
      );
      return;
    }

    await ctx.reply("目前沒有可取消的開發任務。若狀態異常請用 /reset。");
  });

  bot.command("reset", async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) {
      return;
    }

    const report = await performForceReset(String(chatId));
    await ctx.reply(formatForceResetMessage(report));
  });

  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text.trim();

    if (text.startsWith("/")) {
      return;
    }

    const routed = await resolveIntent(text);

    if (routed.intent === "scrape") {
      const url = routed.url || extractUrl(text);
      if (!url) {
        await ctx.reply("請附上有效的 http(s) 網址。");
        return;
      }
      await handleScrape(ctx, url);
      return;
    }

    if (routed.intent === "dev") {
      await handleDev(ctx, text);
      return;
    }

    if (routed.intent === "ops") {
      await handleOps(ctx, text);
      return;
    }

    await handleChat(ctx, text);
  });

  bot.catch((error) => {
    console.error("[bot] Error:", error);
  });

  return bot;
}

export async function startBot(bot: Bot, app?: Application): Promise<void> {
  await registerBotCommands(bot);

  if (env.telegramMode === "webhook") {
    if (!env.webhookUrl) {
      throw new Error("WEBHOOK_URL is required when TELEGRAM_MODE=webhook");
    }
    if (!app) {
      throw new Error("Express app is required for webhook mode");
    }

    app.use(
      env.webhookPath,
      webhookCallback(bot, "express", {
        onTimeout: "return",
        timeoutMilliseconds: 10_000,
      })
    );
    await bot.api.setWebhook(env.webhookUrl);
    console.log(`[bot] Webhook mode: ${env.webhookUrl}`);
    return;
  }

  await bot.api.deleteWebhook({ drop_pending_updates: true });
  void bot.start({
    onStart: () => {
      console.log("[bot] Long polling started");
    },
  });
}
