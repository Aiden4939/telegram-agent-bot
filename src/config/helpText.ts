export const HELP_TEXT = [
  "Telegram 遠端 Agent 使用說明",
  "",
  "直接傳文字，AI 會自動判斷：",
  "• 網頁抓取分析（含 URL）",
  "• 開發任務（解釋 code、改檔案）",
  "• 主機操作需求（ops：查健康；Docker 容器狀態/日誌需安全通道，預設停用）",
  "• 一般閒聊",
  "",
  "範例：",
  "• 幫我分析 https://example.com 並整理重點",
  "• 幫我解釋 line-reminder-bot 的指令有哪些（可加：請 5 條列點）",
  "• 幫我看現在服務是否健康",
  "",
  "指令：",
  "/status — 狀態與 session",
  "/cwd [路徑] — 查看或切換開發目錄",
  "/new — 新開發 session",
  "/cancel — 取消開發任務",
  "/reset — 緊急重置（卡死時用）",
  "/help — 本說明",
].join("\n");

export const START_TEXT = [
  "Telegram 遠端 Agent 已就緒。",
  "",
  "傳一般訊息即可；輸入 /help 看完整說明。",
].join("\n");
