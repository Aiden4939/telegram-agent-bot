import type { Intent, IntentResult } from "../types/intent.js";

const URL_REGEX = /https?:\/\/[^\s<>"']+/i;
const SCRAPE_KEYWORDS = /筆記|爬|存|抓|下來|摘|整理|網頁|網址/;
const DEV_KEYWORDS =
  /程式|code|coding|refactor|bug|除錯|開發|repo|檔案|function|api|實作|修改|加一個|解釋/i;

export function extractUrl(text: string): string | null {
  const match = text.match(URL_REGEX);
  if (!match) {
    return null;
  }
  return match[0].replace(/[.,;:!?)]+$/, "");
}

export function classifyIntentByRules(text: string): IntentResult {
  const url = extractUrl(text);

  if (url && SCRAPE_KEYWORDS.test(text)) {
    return { intent: "scrape", url };
  }

  if (DEV_KEYWORDS.test(text)) {
    return { intent: "dev" };
  }

  return { intent: "chat" };
}
