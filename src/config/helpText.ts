export const HELP_TEXT = [
  "Telegram 遠端 Agent 使用說明",
  "",
  "直接傳文字，AI 會自動判斷：",
  "• 存網頁筆記（含 URL + 存/筆記等）",
  "• 開發任務（解釋 code、改檔案）",
  "• 一般閒聊",
  "",
  "範例：",
  "• 幫我把 https://example.com 存進筆記",
  "• 幫我解釋 line-reminder-bot 的指令有哪些（可加：請 5 條列點）",
  "",
  "指令：",
  "/status — 狀態與 session",
  "/notes — 最近筆記",
  "/note <id> — 查看筆記",
  "/cwd [路徑] — 查看或切換開發目錄",
  "/new — 新開發 session",
  "/cancel — 取消開發任務",
  "/help — 本說明",
].join("\n");

export const START_TEXT = [
  "Telegram 遠端 Agent 已就緒。",
  "",
  "傳一般訊息即可；輸入 /help 看完整說明。",
].join("\n");
