import type { Bot } from "grammy";

export const BOT_COMMANDS = [
  { command: "start", description: "快速開始" },
  { command: "help", description: "完整使用說明" },
  { command: "dev", description: "建立開發任務（需計畫確認）" },
  { command: "status", description: "查看目前狀態與 Agent session" },
  { command: "cwd", description: "查看或切換開發目錄" },
  { command: "new", description: "開啟新的開發 Agent session" },
  { command: "pause", description: "暫停目前 task" },
  { command: "cancel", description: "取消進行中的開發任務" },
  { command: "reset", description: "緊急重置任務狀態（卡死時用）" },
] as const;

export async function registerBotCommands(bot: Bot): Promise<void> {
  await bot.api.setMyCommands([...BOT_COMMANDS]);
  console.log("[bot] Command menu registered");
}
