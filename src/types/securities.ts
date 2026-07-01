export interface StockHolding {
  stockId: string;
  stockName: string;
  quantity: number;
  cost: string;
  refPrice: string;
  lotType: string;
  marketValue?: string;
  unrealizedProfitLoss?: string;
  unrealizedProfitLossRate?: string;
}

export interface PortfolioSnapshot {
  holdings: StockHolding[];
  queriedAt: Date;
}
