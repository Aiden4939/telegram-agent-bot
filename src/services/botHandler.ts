import { Bot, type Context } from "grammy";
import { env } from "../config/env.js";
import { registerBotCommands } from "../config/botCommands.js";
import { getSession } from "../repositories/sessionRepository.js";
import {
  cancelDevRun,
  isDevRunActive,
  sendDevPrompt,
  startNewDevSession,
} from "./agentOrchestrator.js";
import { extractUrl } from "./intentRouter.js";
import { resolveIntent } from "./llmIntentRouter.js";
import { chat } from "./llmClient.js";
import { runScrapeNote } from "./scrapeNoteService.js";

const busyScrapeChats = new Set<number>();

function isAllowed(userId: number | undefined): userId is number {
  if (!userId) {
    return false;
  }
  return env.allowedUserIds.includes(String(userId));
}

function isBusy(chatId: number): boolean {
  return busyScrapeChats.has(chatId) || isDevRunActive(String(chatId));
}

async function handleScrape(ctx: Context, url: string): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) {
    return;
  }

  if (isBusy(chatId)) {
    await ctx.reply("目前有任務進行中，請稍候或使用 /cancel。");
    return;
  }

  busyScrapeChats.add(chatId);
  const statusMsg = await ctx.reply(`處理中…正在抓取：${url}`);

  try {
    const result = await runScrapeNote({ chatId, url });
    const preview = result.summary.slice(0, 500);
    const titleLine = result.title ? `\n標題：${result.title}` : "";

    await ctx.api.editMessageText(
      chatId,
      statusMsg.message_id,
      `已完成，筆記 #${result.noteId}${titleLine}\n\n${preview}${
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
    busyScrapeChats.delete(chatId);
  }
}

async function handleDev(ctx: Context, text: string): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) {
    return;
  }

  if (isBusy(chatId)) {
    await ctx.reply("目前有任務進行中，請稍候或使用 /cancel。");
    return;
  }

  const statusMsg = await ctx.reply("Agent 開發任務處理中…");

  try {
    const result = await sendDevPrompt(String(chatId), text);
    const preview = result.text.slice(0, 3500);
    const suffix = result.text.length > 3500 ? "\n\n（內容過長，已截斷）" : "";

    await ctx.api.editMessageText(
      chatId,
      statusMsg.message_id,
      `${preview}${suffix}\n\n— agent: ${result.agentId}`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await ctx.api.editMessageText(
      chatId,
      statusMsg.message_id,
      `開發任務失敗：${message}`
    );
  }
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

  try {
    const answer = await chat(text);
    await ctx.api.editMessageText(chatId, statusMsg.message_id, answer);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await ctx.api.editMessageText(
      chatId,
      statusMsg.message_id,
      `回覆失敗：${message}`
    );
  }
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
    await ctx.reply(
      [
        "Telegram 遠端 Agent（Phase 2）",
        "",
        "AI 會自動判斷你的意圖：",
        "• 存網頁筆記 → 爬蟲 + 摘要 + 存檔",
        "• 開發任務 → Cursor SDK（需 CURSOR_API_KEY）",
        "• 其他 → AI 閒聊",
        "",
        "指令：/status /new /cancel",
      ].join("\n")
    );
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
        `存筆記執行：${env.scrapeMode}`,
        `開發 cwd：${session?.cwd || env.defaultCwd}`,
        `Agent session：${session?.agentId || "（無）"}`,
        `Cursor SDK：${env.cursorApiKey ? "已設定" : "未設定"}`,
        `狀態：${busy ? "處理中" : "閒置"}`,
      ].join("\n")
    );
  });

  bot.command("new", async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) {
      return;
    }

    if (isBusy(chatId)) {
      await ctx.reply("目前有任務進行中，請先 /cancel。");
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
    if (busyScrapeChats.has(chatId)) {
      await ctx.reply("爬蟲任務進行中，暫不支援中途取消。");
      return;
    }

    if (cancelled) {
      await ctx.reply("已取消進行中的開發任務。");
      return;
    }

    await ctx.reply("目前沒有可取消的開發任務。");
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

    await handleChat(ctx, text);
  });

  bot.catch((error) => {
    console.error("[bot] Error:", error);
  });

  return bot;
}

export async function startBot(bot: Bot): Promise<void> {
  await bot.api.deleteWebhook({ drop_pending_updates: true });
  await registerBotCommands(bot);
  await bot.start({
    onStart: () => {
      console.log("[bot] Long polling started");
    },
  });
}
