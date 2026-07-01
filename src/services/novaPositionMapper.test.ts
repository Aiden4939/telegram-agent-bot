import assert from "node:assert/strict";
import test from "node:test";
import { mapNovaInventoriesToHoldings } from "./novaPositionMapper.js";

test("mapNovaInventoriesToHoldings maps Nova position summaries", () => {
  const holdings = mapNovaInventoriesToHoldings({
    positionSummaries: [
      {
        symbol: "2330",
        name: "台積電",
        currentQuantity: "1000",
        cost: "500",
        currentPrice: "900",
        marketValue: "900000",
        unrealizedProfit: "400000",
        unrealizedProfitLossRate: "80",
      },
      {
        symbol: "2887",
        name: "台新金",
        currentQuantity: "0",
      },
    ],
  });

  assert.equal(holdings.length, 1);
  assert.equal(holdings[0]?.stockId, "2330");
  assert.equal(holdings[0]?.marketValue, "900000");
});
