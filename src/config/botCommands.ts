import type { Bot } from "grammy";

export const BOT_COMMANDS = [
  { command: "start", description: "快速開始" },
  { command: "help", description: "完整使用說明" },
  { command: "status", description: "查看目前狀態與 Agent session" },
  { command: "notes", description: "列出最近筆記" },
  { command: "note", description: "查看筆記詳情（/note 1）" },
  { command: "cwd", description: "查看或切換開發目錄" },
  { command: "new", description: "開啟新的開發 Agent session" },
  { command: "cancel", description: "取消進行中的開發任務" },
] as const;

export async function registerBotCommands(bot: Bot): Promise<void> {
  await bot.api.setMyCommands([...BOT_COMMANDS]);
  console.log("[bot] Command menu registered");
}
