import type { PortfolioSnapshot, StockHolding } from "../types/securities.js";

const STOCK_CODE_REGEX = /\b(\d{4,5})\b/;

export function extractStockCodeFromQuery(text: string): string | null {
  const match = text.match(STOCK_CODE_REGEX);
  return match?.[1] ?? null;
}

function formatHoldingLine(holding: StockHolding): string {
  const parts = [
    `• ${holding.stockName}（${holding.stockId}）`,
    `持股 ${holding.quantity.toLocaleString("zh-TW")} 股`,
    holding.lotType !== "普通" ? `類型：${holding.lotType}` : "",
    holding.refPrice ? `現價 ${holding.refPrice}` : "",
    holding.cost ? `成本 ${holding.cost}` : "",
    holding.marketValue ? `市值 ${holding.marketValue}` : "",
    holding.unrealizedProfitLoss
      ? `損益 ${holding.unrealizedProfitLoss}${
          holding.unrealizedProfitLossRate
            ? `（${holding.unrealizedProfitLossRate}%）`
            : ""
        }`
      : "",
  ].filter(Boolean);

  return parts.join("｜");
}

export function formatPortfolioReply(
  snapshot: PortfolioSnapshot,
  userQuery: string
): string {
  const stockCode = extractStockCodeFromQuery(userQuery);
  const holdings = stockCode
    ? snapshot.holdings.filter((item) => item.stockId === stockCode)
    : snapshot.holdings;

  if (holdings.length === 0) {
    if (stockCode) {
      return `查無 ${stockCode} 的持股紀錄。`;
    }
    return "目前沒有持股資料。";
  }

  const lines = [
    stockCode
      ? `台新證券持股（${stockCode}）`
      : `台新證券持股（共 ${holdings.length} 檔）`,
    "",
    ...holdings.map(formatHoldingLine),
    "",
    `查詢時間：${snapshot.queriedAt.toLocaleString("zh-TW", {
      hour12: false,
    })}`,
  ];

  return lines.join("\n");
}
