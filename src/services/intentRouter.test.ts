import assert from "node:assert/strict";
import test from "node:test";
import { classifyIntentByRules } from "./intentRouter.js";

test("classifyIntentByRules routes github issue questions to github", () => {
  const result = classifyIntentByRules(
    "你可以幫我看 telegram-agent-bot 的 github issue 有什麼嗎"
  );
  assert.equal(result.intent, "github");
});

test("classifyIntentByRules keeps dev for code change requests", () => {
  const result = classifyIntentByRules("幫我修改 telegram-agent-bot 的登入 bug");
  assert.equal(result.intent, "dev");
});

test("classifyIntentByRules routes github merge request to github", () => {
  const result = classifyIntentByRules("列出 github merge request");
  assert.equal(result.intent, "github");
});
