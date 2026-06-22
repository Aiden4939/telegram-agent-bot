import type { Bot } from "grammy";

export const BOT_COMMANDS = [
  { command: "start", description: "使用說明" },
  { command: "status", description: "查看目前狀態與 Agent session" },
  { command: "new", description: "開啟新的開發 Agent session" },
  { command: "cancel", description: "取消進行中的開發任務" },
] as const;

export async function registerBotCommands(bot: Bot): Promise<void> {
  await bot.api.setMyCommands([...BOT_COMMANDS]);
  console.log("[bot] Command menu registered");
}
