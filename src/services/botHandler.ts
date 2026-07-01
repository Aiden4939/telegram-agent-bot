import { Bot, InlineKeyboard, type Context } from "grammy";
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
  isPendingGitHub,
  markPendingDev,
  markPendingOps,
  markPendingGitHub,
  markScrapeBusy,
  clearPendingDev,
  clearPendingOps,
  clearPendingGitHub,
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
import { planGitHubAction } from "./githubPlanner.js";
import { executeGitHubPlan, formatGitHubResult } from "./githubExecutor.js";
import {
  approveAndRunDevTask,
  cancelTask,
  createDevTask,
  getRecoverableTaskChoices,
  pauseTask,
  rejectDevTask,
} from "./devTaskWorkflow.js";
import { getCurrentCwd, resolveAllowedCwd } from "../utils/cwd.js";
import {
  chunkMessage,
  plainTextForTelegram,
} from "../utils/messageChunk.js";
import {
  markTelegramUpdateDuplicate,
  markTelegramUpdateFailed,
  markTelegramUpdateProcessed,
  registerTelegramUpdate,
} from "../repositories/updateRepository.js";
import { getLatestTaskByChat } from "../repositories/taskRepository.js";
import { checkAndTrackUserMessage } from "./rateLimitService.js";
import { redactSecrets } from "./redaction.js";

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

async function handleGitHub(ctx: Context, text: string): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) {
    return;
  }

  if (isBusy(chatId)) {
    await ctx.reply("目前有任務進行中，請稍候或使用 /cancel、/reset。");
    return;
  }

  markPendingGitHub(chatId);
  const statusMsg = await ctx.reply("GitHub 查詢處理中…");

  void (async () => {
    try {
      const plan = await planGitHubAction(text);
      const result = await executeGitHubPlan(plan);
      try {
        await replyInChunks(
          ctx,
          chatId,
          statusMsg.message_id,
          formatGitHubResult(result)
        );
      } catch (replyError) {
        const message =
          replyError instanceof Error ? replyError.message : String(replyError);
        await ctx.reply(`GitHub 查詢完成，但回覆失敗：${message}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await ctx.api.editMessageText(
        chatId,
        statusMsg.message_id,
        `GitHub 查詢失敗：${message}`
      );
    } finally {
      clearPendingGitHub(chatId);
    }
  })();
}

export function createBot(): Bot {
  const bot = new Bot(env.telegramBotToken);

  bot.use(async (ctx, next) => {
    if (!isAllowed(ctx.from?.id)) {
      return;
    }
    const messageRate = checkAndTrackUserMessage(String(ctx.from?.id));
    if (!messageRate.ok) {
      await ctx.reply(
        `訊息過於頻繁，請 ${messageRate.retryAfterSec ?? 10} 秒後再試。`
      );
      return;
    }
    const updateId = String(ctx.update.update_id);
    const chatId = String(ctx.chat?.id ?? "");
    const userId = String(ctx.from?.id ?? "");
    const messageId = ctx.msg?.message_id ? String(ctx.msg.message_id) : null;
    const { inserted } = registerTelegramUpdate({
      updateId,
      chatId,
      userId,
      messageId,
    });
    if (!inserted) {
      markTelegramUpdateDuplicate(updateId);
      return;
    }
    try {
      await next();
      markTelegramUpdateProcessed(updateId);
    } catch (error) {
      markTelegramUpdateFailed(updateId, "handler_error");
      throw error;
    }
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
    const latestTask = getLatestTaskByChat(String(chatId));

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
        `GitHub token：${env.githubToken ? "已設定" : "未設定"}`,
        `GitHub repos：${env.githubAllowedRepos.join(",") || "（未設定）"}`,
        `Agent session：${session?.agentId || "（無）"}`,
        `Task：${latestTask?.taskId || "（無）"}`,
        `Task 狀態：${latestTask?.status || "（無）"}`,
        `Task repo：${latestTask?.repository || "（無）"}`,
        `Task PR：${latestTask?.pullRequestUrl || "（無）"}`,
        `Task 成本(估)：${latestTask?.estimatedCost ?? 0}`,
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

  bot.command("dev", async (ctx) => {
    const chatId = ctx.chat?.id;
    const fromId = ctx.from?.id;
    if (!chatId || !fromId || !ctx.message?.text) {
      return;
    }
    const raw = ctx.message.text.replace(/^\/dev(@\w+)?\s*/i, "").trim();
    if (!raw) {
      await ctx.reply("請在 /dev 後描述需求，例如：/dev 修正登入錯誤");
      return;
    }

    try {
      const { task, planLines, approvalToken } = createDevTask({
        chatId: String(chatId),
        userId: String(fromId),
        updateId: String(ctx.update.update_id),
        messageId: String(ctx.message.message_id),
        text: raw,
      });
      const keyboard = new InlineKeyboard()
        .text("確認執行", `approve:${task.taskId}:${approvalToken}`)
        .text("取消", `reject:${task.taskId}:${approvalToken}`);
      await ctx.reply(
        [
          `Task ID：${task.taskId}`,
          `Repo：${task.repository ?? "（未指定）"}`,
          `狀態：${task.status}`,
          "",
          "執行計畫：",
          ...planLines.map((line, i) => `${i + 1}. ${line}`),
        ].join("\n"),
        { reply_markup: keyboard }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await ctx.reply(`無法建立 dev 任務：${redactSecrets(message)}`);
    }
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
    const recoverable = getRecoverableTaskChoices(String(chatId));
    if (recoverable.length > 0) {
      const cancelledTask = cancelTask(recoverable[0].taskId, String(ctx.from?.id ?? ""));
      await ctx.reply(`已取消 Task ${cancelledTask.taskId}。`);
      return;
    }

    if (isPendingOps(chatId)) {
      clearPendingOps(chatId);
      await ctx.reply(
        "已解除 ops 忙碌狀態。背景請求可能仍在執行，完成後不會再更新訊息。卡死時請用 /reset。"
      );
      return;
    }

    if (isPendingGitHub(chatId)) {
      clearPendingGitHub(chatId);
      await ctx.reply(
        "已解除 GitHub 查詢忙碌狀態。背景請求可能仍在執行，完成後不會再更新訊息。卡死時請用 /reset。"
      );
      return;
    }

    await ctx.reply("目前沒有可取消的開發任務。若狀態異常請用 /reset。");
  });

  bot.command("pause", async (ctx) => {
    const chatId = ctx.chat?.id;
    const fromId = ctx.from?.id;
    if (!chatId || !fromId) {
      return;
    }
    const recoverable = getRecoverableTaskChoices(String(chatId));
    if (recoverable.length === 0) {
      await ctx.reply("目前沒有可暫停的 task。");
      return;
    }
    const paused = pauseTask(recoverable[0].taskId, String(fromId));
    await ctx.reply(`已暫停 Task ${paused.taskId}。`);
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

    if (/^繼續$/.test(text)) {
      const candidates = getRecoverableTaskChoices(String(ctx.chat?.id ?? ""));
      if (candidates.length === 0) {
        await ctx.reply("目前沒有可恢復的 task。");
        return;
      }
      if (candidates.length > 1) {
        await ctx.reply(
          [
            "找到多個可恢復 task，請改用 /dev 指定新需求，或先 /status 查看目前 task：",
            ...candidates.map((t) => `- ${t.taskId} (${t.status}) ${t.repository ?? ""}`),
          ].join("\n")
        );
        return;
      }
      await ctx.reply(
        `已找到可恢復 Task ${candidates[0].taskId}（${candidates[0].status}），請用 /dev 補充下一步需求。`
      );
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

    if (routed.intent === "github") {
      await handleGitHub(ctx, text);
      return;
    }

    await handleChat(ctx, text);
  });

  bot.on("callback_query:data", async (ctx) => {
    const fromId = String(ctx.from?.id ?? "");
    const data = ctx.callbackQuery.data ?? "";
    const parts = data.split(":");
    if (parts.length !== 3) {
      await ctx.answerCallbackQuery({ text: "無效操作", show_alert: true });
      return;
    }
    const [action, taskId, token] = parts;
    try {
      if (action === "approve") {
        await ctx.answerCallbackQuery({ text: "已確認，開始執行。" });
        await ctx.editMessageReplyMarkup({ reply_markup: undefined });
        const status = await ctx.reply(`Task ${taskId} 執行中…`);
        try {
          const result = await approveAndRunDevTask({
            taskId,
            approvalToken: token,
            userId: fromId,
          });
          await ctx.api.editMessageText(
            ctx.chat!.id,
            status.message_id,
            [
              `Task ${result.taskId} 進度更新：${result.status}`,
              `Repo：${result.repository ?? "（未指定）"}`,
              `Branch：${result.workingBranch ?? "（未指定）"}`,
              `PR：${result.pullRequestUrl ?? "（尚未建立）"}`,
              `成本估算：${result.estimatedCost}`,
            ].join("\n")
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          await ctx.api.editMessageText(
            ctx.chat!.id,
            status.message_id,
            `Task ${taskId} 執行失敗：${redactSecrets(message)}`
          );
        }
      } else if (action === "reject") {
        rejectDevTask(taskId, fromId);
        await ctx.answerCallbackQuery({ text: "已取消。" });
        await ctx.editMessageReplyMarkup({ reply_markup: undefined });
        await ctx.reply(`Task ${taskId} 已取消。`);
      } else {
        await ctx.answerCallbackQuery({ text: "未知操作", show_alert: true });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await ctx.answerCallbackQuery({ text: redactSecrets(message), show_alert: true });
    }
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
