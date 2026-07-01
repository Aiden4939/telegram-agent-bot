import assert from "node:assert/strict";
import test from "node:test";
import { classifyIntentByRules } from "./intentRouter.js";
import {
  extractStockCodeFromQuery,
  formatPortfolioReply,
} from "./securitiesReplyFormatter.js";

test("classifyIntentByRules routes securities keywords", () => {
  const result = classifyIntentByRules("我現在持有哪些股票？");
  assert.equal(result.intent, "securities");
});

test("extractStockCodeFromQuery finds stock code", () => {
  assert.equal(extractStockCodeFromQuery("2330 我持有多少股？"), "2330");
});

test("formatPortfolioReply filters by stock code", () => {
  const text = formatPortfolioReply(
    {
      queriedAt: new Date("2026-07-01T10:00:00+08:00"),
      holdings: [
        {
          stockId: "2330",
          stockName: "台積電",
          quantity: 1000,
          cost: "500",
          refPrice: "900",
          lotType: "普通",
        },
        {
          stockId: "2887",
          stockName: "台新金",
          quantity: 500,
          cost: "20",
          refPrice: "18",
          lotType: "普通",
        },
      ],
    },
    "2330 我持有多少股？"
  );

  assert.match(text, /台積電/);
  assert.doesNotMatch(text, /台新金/);
});
