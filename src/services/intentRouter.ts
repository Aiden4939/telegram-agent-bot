import type { Intent, IntentResult } from "../types/intent.js";

const URL_REGEX = /https?:\/\/[^\s<>"']+/i;
const SCRAPE_KEYWORDS =
  /爬|抓|抓取|摘要|分析|整理|網頁|網址|網站|內容重點|重點整理|存|保存|筆記/i;
const DEV_KEYWORDS =
  /程式|code|coding|refactor|bug|除錯|開發|檔案|function|api|實作|修改|加一個|解釋/i;
const GITHUB_KEYWORDS =
  /github|git hub|issue|issues|pull request|\bpr\b|議題|開卡/i;
const GITHUB_DEV_OVERRIDE =
  /改|修改|除錯|refactor|實作|加一個功能|開一張|建立|create|push/i;
const OPS_KEYWORDS =
  /主機|伺服器|server|ssh|docker|compose|容器|service|systemctl|nginx|重啟|restart|部署|deploy|監控|cpu|ram|記憶體|磁碟|log|健康|health/i;

export function extractUrl(text: string): string | null {
  const match = text.match(URL_REGEX);
  if (!match) {
    return null;
  }
  return match[0].replace(/[.,;:!?)]+$/, "");
}

export function classifyIntentByRules(text: string): IntentResult {
  const url = extractUrl(text);

  if (url && /github\.com/i.test(url) && GITHUB_KEYWORDS.test(text)) {
    return { intent: "github" };
  }

  if (url && SCRAPE_KEYWORDS.test(text)) {
    return { intent: "scrape", url };
  }

  if (GITHUB_KEYWORDS.test(text) && !GITHUB_DEV_OVERRIDE.test(text)) {
    return { intent: "github" };
  }

  if (DEV_KEYWORDS.test(text)) {
    return { intent: "dev" };
  }

  if (OPS_KEYWORDS.test(text)) {
    return { intent: "ops" };
  }

  return { intent: "chat" };
}
