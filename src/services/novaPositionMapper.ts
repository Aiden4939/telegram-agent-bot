import type { StockHolding } from "../types/securities.js";

interface NovaPositionSummary {
  symbol?: string;
  name?: string;
  symbolName?: string;
  currentQuantity?: string;
  totalQuantity?: string;
  cost?: string;
  averagePrice?: string;
  currentPrice?: string;
  marketValue?: string;
  unrealizedProfit?: string;
  unrealizedProfitLossRate?: string;
  orderTypeName?: string;
}

interface NovaPositionResponse {
  positionSummaries?: NovaPositionSummary[];
}

function parseQuantity(raw: string | undefined): number {
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

export function mapNovaInventoriesToHoldings(
  response: NovaPositionResponse
): StockHolding[] {
  const summaries = response.positionSummaries ?? [];

  const holdings: StockHolding[] = [];

  for (const item of summaries) {
    const stockId = item.symbol?.trim() || "";
    const quantity = parseQuantity(item.currentQuantity ?? item.totalQuantity);
    if (!stockId || quantity <= 0) {
      continue;
    }

    holdings.push({
      stockId,
      stockName: item.name?.trim() || item.symbolName?.trim() || stockId,
      quantity,
      cost: item.cost?.trim() || item.averagePrice?.trim() || "",
      refPrice: item.currentPrice?.trim() || "",
      lotType: item.orderTypeName?.trim() || "普通",
      marketValue: item.marketValue?.trim() || undefined,
      unrealizedProfitLoss: item.unrealizedProfit?.trim() || undefined,
      unrealizedProfitLossRate:
        item.unrealizedProfitLossRate?.trim() || undefined,
    });
  }

  return holdings;
}
